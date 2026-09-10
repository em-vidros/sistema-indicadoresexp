/**
 * A administracao de usuarios: listar, cadastrar, editar e apagar.
 *
 * Ao contrario de `sessao.ts`, aqui e query builder e nao SQL cru. A cerca de
 * `verificar/fronteiras.ts` passou a liberar import relativo que resolve para
 * dentro do proprio pacote, entao `../schema/` e o tipo `Db` de `../index.ts`
 * estao ao alcance.
 *
 * O que continua fora do alcance e o `@ind/auth`, porque `auth` ja importa `db` e
 * a seta nao pode apontar nos dois sentidos. Por isso a senha chega aqui **ja
 * hasheada** e o par `(providerId, issuer)` que identifica a conta de senha chega
 * em `DepsConta`: quem hasheia e quem conhece as duas constantes e o servidor, que
 * e a raiz de composicao. E o mesmo arranjo que `seed.ts` usa.
 *
 * Quem decide o que um papel pode e a tabela `CAPACIDADES` de `@ind/core`, e nao
 * uma comparacao com a string `'admin'` escrita aqui. Este arquivo le a tabela.
 */
import { CAPACIDADES, type Papel, baseFixaCoerente } from '@ind/core'
import { and, count, eq, gt, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { base } from '../schema/cadastro.ts'
import { account, conviteSenha, user, usuarioBase, usuarioTipo } from '../schema/auth.ts'
import type { tipoRegistro } from '../schema/auth.ts'

export type TipoRegistro = (typeof tipoRegistro.enumValues)[number]

/**
 * O dominio da casa, e as duas funcoes que atravessam login e e-mail.
 *
 * Ele mora aqui porque este e o arquivo que cria usuario, e criar e o unico lugar
 * onde a direcao login -> e-mail e usada de verdade. `seed.ts` e
 * `rotas-sessao.ts` importam daqui em vez de cada um guardar a propria copia:
 * dominio duplicado nao da erro, da um usuario que existe no banco e nao entra.
 */
export const DOMINIO_EMAIL = 'emvidros.com.br'

/** A parte local do e-mail: 'livia@emvidros.com.br' -> 'livia'. */
export const loginDe = (email: string): string => email.split('@')[0] ?? email

/** O contrario: 'livia' -> 'livia@emvidros.com.br'. Sempre minusculo, porque o
 * `sign-in/email` procura por `email.toLowerCase()`. */
export const emailDe = (login: string): string => `${login.toLowerCase()}@${DOMINIO_EMAIL}`

/** `usr_<login>`, que e o formato que o seed usa desde a fase 0. Id de usuario e
 * uma das poucas chaves que alguem le direto na tabela, e por isso ele e legivel
 * em vez de uuid. */
export const idDeUsuario = (login: string): string => `usr_${login.toLowerCase()}`

/**
 * O que a tela de administracao lista. E a forma de `DadosSessao` menos o
 * `usuarioId`: o id interno nao tem uso no navegador e sair dali so aumentaria o
 * que vaza numa tela que ja mostra login e permissao.
 *
 * Os dois ultimos campos existem para a tela saber o que oferecer. Sem eles o
 * admin nao consegue distinguir quem nunca abriu o link de primeiro acesso de
 * quem ja definiu senha, e o unico botao possivel seria "gerar link" para todo
 * mundo, inclusive para quem entra todo dia.
 */
export type UsuarioListado = {
  usuario: string
  nome: string
  papel: Papel
  baseFixa: string | null
  bases: string[]
  tipos: TipoRegistro[]
  /** Ja usou algum link de primeiro acesso, ou teve senha trocada pelo admin. */
  senhaDefinida: boolean
  /** Existe convite valido e ainda nao usado. */
  conviteAberto: boolean
}

/** O cadastro. Nao tem senha de proposito: quem escolhe a senha e a propria
 * pessoa, pelo link que a rota devolve. */
export type NovoUsuario = {
  usuario: string
  nome: string
  papel: Papel
  baseFixa: string | null
  bases: string[]
  tipos: TipoRegistro[]
}

/**
 * `senhaHash`, `papel`, `baseFixa`, `bases` e `tipos` ausentes querem dizer "nao
 * muda". Presentes, `bases` e `tipos` substituem: o que nao esta na lista sai.
 *
 * `baseFixa` distingue ausente de `null`: ausente e "nao muda", `null` e "tire a
 * base", que e o que promover alguem a admin exige. Sem a distincao nao daria
 * para promover ninguem sem o CHECK do banco recusar.
 */
export type MudancaUsuario = {
  usuario: string
  nome: string
  senhaHash?: string | undefined
  papel?: Papel | undefined
  baseFixa?: string | null | undefined
  bases?: string[] | undefined
  tipos?: TipoRegistro[] | undefined
}

export type DepsConta = {
  /** `account.provider_id` que o `sign-in/email` exige. */
  provedorSenha: string
  /** `account.issuer` que o `sign-in/email` exige, hoje `local:credential`. */
  issuerSenha: string
}

/** Login ou nome de base que nao existe. Culpa de quem chamou, e vira 400 na rota. */
export class EntradaInvalida extends Error {}

/** Login que ja existe. Separado de `EntradaInvalida` porque a rota responde 409,
 * e nao 400: o corpo estava certo, o mundo e que ja tinha aquele nome. */
export class UsuarioJaExiste extends Error {}

/**
 * O enum `tipo_registro` ordena pela ordem em que foi declarado, nao pelo alfabeto.
 * `sessao.ts` ja resolve isso com o mesmo cast, e as duas rotas precisam devolver a
 * mesma sequencia: a tela compara os dois arrays.
 */
const TIPO_TEXTO = sql`${usuarioTipo.tipo}::text`

export async function listarUsuarios(db: Db, deps: DepsConta): Promise<UsuarioListado[]> {
  const agora = new Date()

  const linhas = await db
    .select({
      id: user.id,
      email: user.email,
      nome: user.name,
      papel: user.papel,
      baseFixa: base.nome,
    })
    .from(user)
    .leftJoin(base, eq(base.id, user.baseId))
    // O dominio do e-mail e o mesmo para todos, entao ordenar por ele e ordenar
    // por login, que e o que a tela mostra.
    .orderBy(user.email)

  const vinculos = await db
    .select({ usuarioId: usuarioBase.usuarioId, nome: base.nome })
    .from(usuarioBase)
    .innerJoin(base, eq(base.id, usuarioBase.baseId))
    .orderBy(base.nome)

  const tipos = await db
    .select({ usuarioId: usuarioTipo.usuarioId, tipo: usuarioTipo.tipo })
    .from(usuarioTipo)
    .orderBy(TIPO_TEXTO)

  const comSenha = await db
    .select({ usuarioId: account.userId })
    .from(account)
    .where(
      and(
        eq(account.providerId, deps.provedorSenha),
        eq(account.issuer, deps.issuerSenha),
        isNotNull(account.password),
      ),
    )

  const abertos = await db
    .select({ usuarioId: conviteSenha.usuarioId })
    .from(conviteSenha)
    .where(and(isNull(conviteSenha.usadoEm), gt(conviteSenha.expiraEm, agora)))

  const basesPor = agrupar(vinculos, (v) => v.nome)
  const tiposPor = agrupar(tipos, (t) => t.tipo)
  const temSenha = new Set(comSenha.map((c) => c.usuarioId))
  const temConvite = new Set(abertos.map((c) => c.usuarioId))

  return linhas.map((l) => ({
    usuario: loginDe(l.email),
    nome: l.nome,
    papel: l.papel,
    baseFixa: l.baseFixa,
    bases: basesPor.get(l.id) ?? [],
    tipos: tiposPor.get(l.id) ?? [],
    senhaDefinida: temSenha.has(l.id),
    conviteAberto: temConvite.has(l.id),
  }))
}

function agrupar<T extends { usuarioId: string }, V>(linhas: T[], valor: (l: T) => V): Map<string, V[]> {
  const mapa = new Map<string, V[]>()
  for (const linha of linhas) {
    const lista = mapa.get(linha.usuarioId)
    if (lista) lista.push(valor(linha))
    else mapa.set(linha.usuarioId, [valor(linha)])
  }
  return mapa
}

/**
 * Cria e devolve o id, para quem chamou gerar o convite na sequencia.
 *
 * Sem senha e sem linha em `account`: quem nasce aqui so entra depois de abrir o
 * link de primeiro acesso. Cadastrar e definir senha em nome de outra pessoa e
 * exatamente o que este desenho recusa fazer.
 */
export function criarUsuario(db: Db, novo: NovoUsuario): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    if (!baseFixaCoerente(novo.papel, novo.baseFixa !== null)) {
      throw new EntradaInvalida(desacordo(novo.papel))
    }

    const id = idDeUsuario(novo.usuario)
    const email = emailDe(novo.usuario)

    const [existente] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
    if (existente) throw new UsuarioJaExiste(`usuario '${novo.usuario}' ja existe`)

    const idPorBase = await mapaDeBases(tx, [
      ...novo.bases,
      ...(novo.baseFixa === null ? [] : [novo.baseFixa]),
    ])

    await tx.insert(user).values({
      id,
      name: novo.nome,
      email,
      // Nao ha servidor de e-mail neste app, e exigir verificacao trancaria do
      // lado de fora justamente quem acabou de ser cadastrado.
      emailVerified: true,
      papel: novo.papel,
      baseId: novo.baseFixa === null ? null : idPorBase.get(novo.baseFixa)!,
    })

    await gravarBases(tx, id, novo.bases, idPorBase)
    await gravarTipos(tx, id, novo.tipos)

    return { id }
  })
}

/**
 * Tudo ou nada, numa transacao so. Metade aplicada e o pior estado possivel aqui:
 * o admin fecha a tela achando que salvou, e metade da frota fica com a permissao
 * antiga sem ninguem saber qual metade.
 *
 * Devolve quantos usuarios foram atualizados.
 */
export function atualizarUsuarios(
  db: Db,
  mudancas: MudancaUsuario[],
  deps: DepsConta,
): Promise<number> {
  return db.transaction(async (tx) => {
    const alvos = await tx
      .select({ id: user.id, email: user.email, papel: user.papel, baseFixa: base.nome })
      .from(user)
      .leftJoin(base, eq(base.id, user.baseId))
    const porLogin = new Map(alvos.map((u) => [loginDe(u.email), u]))

    // Toda a validacao de forma antes de qualquer escrita. Um login errado no fim
    // do array nao pode ter deixado rastro dos que vinham antes dele.
    const depois = new Map<string, { papel: Papel; baseFixa: string | null }>()
    for (const m of mudancas) {
      const alvo = porLogin.get(m.usuario)
      if (!alvo) {
        // Esta rota edita; quem cria e `criarUsuario`. Criar em silencio deixaria
        // um usuario sem conta de senha e sem convite, que e um estado que ninguem
        // pediu e que nenhuma tela mostra.
        throw new EntradaInvalida(`usuario '${m.usuario}' nao existe`)
      }

      const papel = m.papel ?? alvo.papel
      const baseFixa = m.baseFixa === undefined ? alvo.baseFixa : m.baseFixa
      if (!baseFixaCoerente(papel, baseFixa !== null)) throw new EntradaInvalida(desacordo(papel))

      // A base fixa e a que a tela ja deixa selecionada e travada; as `bases` sao
      // as que ele pode escolher. Tirar a fixa da lista deixa a pessoa presa numa
      // base cujo botao some da tela, e cuja escrita a fase 2 vai recusar. Nao e um
      // estado que alguem queira, entao nao pode ser gravado.
      if (baseFixa !== null && m.bases && !m.bases.includes(baseFixa)) {
        throw new EntradaInvalida(
          `'${m.usuario}' e da base '${baseFixa}', que nao pode sair das bases liberadas`,
        )
      }

      depois.set(m.usuario, { papel, baseFixa })
    }

    const idPorBase = await mapaDeBases(tx, [
      ...mudancas.flatMap((m) => m.bases ?? []),
      ...[...depois.values()].flatMap((d) => (d.baseFixa === null ? [] : [d.baseFixa])),
    ])
    const agora = new Date()

    for (const m of mudancas) {
      const alvo = porLogin.get(m.usuario)!
      const alvoDepois = depois.get(m.usuario)!

      await tx
        .update(user)
        .set({
          name: m.nome,
          papel: alvoDepois.papel,
          baseId:
            alvoDepois.baseFixa === null ? null : idPorBase.get(alvoDepois.baseFixa)!,
          updatedAt: agora,
        })
        .where(eq(user.id, alvo.id))

      if (m.senhaHash !== undefined) {
        // Os tres campos que o `sign-in/email` casa. Acertar a linha por outro
        // criterio gravaria a senha nova numa conta que o login nunca le, e o
        // usuario ficaria de fora sem mensagem de erro.
        const trocadas = await tx
          .update(account)
          .set({ password: m.senhaHash, updatedAt: agora })
          .where(
            and(
              eq(account.userId, alvo.id),
              eq(account.providerId, deps.provedorSenha),
              eq(account.issuer, deps.issuerSenha),
            ),
          )
          .returning({ id: account.id })
        if (trocadas.length === 0) throw new Error(`'${m.usuario}' nao tem conta de senha`)
      }

      // Quem ve todas as bases tem tudo, e por isso a tela desenha as caixas dele
      // desabilitadas. Se `bases` ou `tipos` vierem assim mesmo, gravar apagaria o
      // que ele tem.
      if (CAPACIDADES[alvoDepois.papel].todasAsBases) continue

      if (m.bases) {
        await tx.delete(usuarioBase).where(eq(usuarioBase.usuarioId, alvo.id))
        await gravarBases(tx, alvo.id, m.bases, idPorBase)
      }

      if (m.tipos) {
        await tx.delete(usuarioTipo).where(eq(usuarioTipo.usuarioId, alvo.id))
        await gravarTipos(tx, alvo.id, m.tipos)
      }
    }

    await exigirAlgumAdmin(tx)
    return mudancas.length
  })
}

/**
 * Apaga, e deixa os registros que a pessoa lancou. `criado_por` e `atualizado_por`
 * viram nulo em vez de a viagem sumir junto: o dado operacional e da empresa, e
 * quem digitou e so procedencia.
 *
 * Apagar a si mesmo e recusado antes de tudo. O resto das recusas mora no
 * `exigirAlgumAdmin` do fim, que ve o estado ja aplicado em vez de tentar
 * adivinha-lo, e por isso nao tem como divergir dele.
 */
export function apagarUsuario(db: Db, login: string, pedidoPor: string): Promise<void> {
  return db.transaction(async (tx) => {
    const [alvo] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailDe(login)))
    if (!alvo) throw new EntradaInvalida(`usuario '${login}' nao existe`)
    if (alvo.id === pedidoPor) throw new EntradaInvalida('nao da para apagar a si mesmo')

    await anularAuditoriaDe(tx, [alvo.id])
    await tx.delete(user).where(eq(user.id, alvo.id))
    await exigirAlgumAdmin(tx)
  })
}

type Escritor = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * O sistema sem nenhum admin nao tem como voltar a ter um: quem promove e admin.
 * A conferencia e depois da escrita, dentro da mesma transacao, e nao antes: antes
 * exigiria simular o efeito das mudancas para saber quantos admins sobrariam, e
 * simulacao de escrita e a copia que diverge da escrita de verdade.
 */
async function exigirAlgumAdmin(tx: Escritor): Promise<void> {
  const [linha] = await tx.select({ quantos: count() }).from(user).where(eq(user.papel, 'admin'))
  if ((linha?.quantos ?? 0) === 0) {
    throw new EntradaInvalida('o sistema ficaria sem nenhum administrador')
  }
}

const desacordo = (papel: Papel): string =>
  CAPACIDADES[papel].todasAsBases
    ? `papel '${papel}' ve todas as bases e nao pode ter base fixa`
    : `papel '${papel}' precisa de uma base fixa`

async function gravarBases(
  tx: Escritor,
  usuarioId: string,
  nomes: string[],
  idPorBase: Map<string, string>,
): Promise<void> {
  const unicos = [...new Set(nomes)]
  if (unicos.length === 0) return
  await tx
    .insert(usuarioBase)
    .values(unicos.map((nome) => ({ usuarioId, baseId: idPorBase.get(nome)! })))
}

async function gravarTipos(tx: Escritor, usuarioId: string, tipos: TipoRegistro[]): Promise<void> {
  const unicos = [...new Set(tipos)]
  if (unicos.length === 0) return
  await tx.insert(usuarioTipo).values(unicos.map((tipo) => ({ usuarioId, tipo })))
}

/** Nome -> id das bases citadas. Nome que nao existe para aqui, antes de escrever. */
async function mapaDeBases(tx: Escritor, nomes: string[]): Promise<Map<string, string>> {
  const pedidos = [...new Set(nomes)]
  if (pedidos.length === 0) return new Map()

  const achadas = await tx
    .select({ id: base.id, nome: base.nome })
    .from(base)
    .where(inArray(base.nome, pedidos))
  const mapa = new Map(achadas.map((b) => [b.nome, b.id]))

  for (const nome of pedidos) {
    if (!mapa.has(nome)) throw new EntradaInvalida(`base '${nome}' nao existe`)
  }
  return mapa
}

/**
 * Solta os registros de quem vai ser apagado, para a FK deixar o DELETE passar.
 *
 * A lista de tabelas sai do catalogo do Postgres, e nao de um array escrito aqui.
 * `auditoria()` de `schema/comum.ts` e um spread que qualquer tabela nova pode
 * usar, e um array escrito a mao ficaria desatualizado sem quebrar teste nenhum:
 * o DELETE so falharia no dia em que alguem tivesse lancado registro na tabela
 * esquecida, que e o pior dia para descobrir.
 */
export async function anularAuditoriaDe(tx: Escritor, usuarioIds: string[]): Promise<void> {
  if (usuarioIds.length === 0) return

  const tabelas = await tx.execute<{ table_name: string }>(sql`
    select distinct table_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name in ('criado_por', 'atualizado_por')
     order by table_name
  `)

  const ids = sql.join(
    usuarioIds.map((id) => sql`${id}`),
    sql`, `,
  )
  for (const { table_name } of tabelas) {
    const tabela = sql.identifier(table_name)
    await tx.execute(sql`
      update ${tabela}
         set criado_por = case when criado_por in (${ids}) then null else criado_por end,
             atualizado_por = case when atualizado_por in (${ids}) then null else atualizado_por end
       where criado_por in (${ids}) or atualizado_por in (${ids})
    `)
  }
}

/**
 * Apaga quem nao esta na lista de logins. E o seed que chama: usuario que saiu de
 * `USUARIOS_INICIAIS` tem que sair do banco tambem, senao a conta continua
 * entrando depois de a pessoa ter sido tirada da lista.
 *
 * Devolve quantos foram apagados.
 */
export async function apagarUsuariosForaDe(tx: Escritor, logins: string[]): Promise<number> {
  const emails = logins.map(emailDe)
  const sobrando = await tx
    .select({ id: user.id })
    .from(user)
    .where(emails.length === 0 ? undefined : notInArray(user.email, emails))
  if (sobrando.length === 0) return 0

  const ids = sobrando.map((u) => u.id)
  await anularAuditoriaDe(tx, ids)
  await tx.delete(user).where(inArray(user.id, ids))
  return ids.length
}
