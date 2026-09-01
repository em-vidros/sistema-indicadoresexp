/**
 * A administracao de usuarios: ler os quatro e gravar o que o admin editou.
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
 */
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { base } from '../schema/cadastro.ts'
import { account, user, usuarioBase, usuarioTipo } from '../schema/auth.ts'
import type { tipoRegistro } from '../schema/auth.ts'

export type TipoRegistro = (typeof tipoRegistro.enumValues)[number]

/**
 * O que a tela de administracao lista. E a forma de `DadosSessao` menos o
 * `usuarioId`: o id interno nao tem uso no navegador e sair dali so aumentaria o
 * que vaza numa tela que ja mostra login e permissao.
 */
export type UsuarioListado = {
  usuario: string
  nome: string
  admin: boolean
  baseFixa: string | null
  bases: string[]
  tipos: TipoRegistro[]
}

/**
 * `senhaHash`, `bases` e `tipos` ausentes querem dizer "nao muda". Presentes,
 * `bases` e `tipos` substituem: o que nao esta na lista sai.
 *
 * `admin` e `baseFixa` nao estao aqui de proposito. Rota que edita permissao de
 * base nao e rota que promove ninguem a administrador, e o jeito de garantir isso
 * e o campo nao existir.
 */
export type MudancaUsuario = {
  usuario: string
  nome: string
  senhaHash?: string | undefined
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

/** A parte local do e-mail: 'livia@emvidros.com.br' -> 'livia'. */
const loginDe = (email: string): string => email.split('@')[0] ?? email

/**
 * O enum `tipo_registro` ordena pela ordem em que foi declarado, nao pelo alfabeto.
 * `sessao.ts` ja resolve isso com o mesmo cast, e as duas rotas precisam devolver a
 * mesma sequencia: a tela compara os dois arrays.
 */
const TIPO_TEXTO = sql`${usuarioTipo.tipo}::text`

export async function listarUsuarios(db: Db): Promise<UsuarioListado[]> {
  const linhas = await db
    .select({
      id: user.id,
      email: user.email,
      nome: user.name,
      admin: user.admin,
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

  const basesPor = agrupar(vinculos, (v) => v.nome)
  const tiposPor = agrupar(tipos, (t) => t.tipo)

  return linhas.map((l) => ({
    usuario: loginDe(l.email),
    nome: l.nome,
    admin: l.admin,
    baseFixa: l.baseFixa,
    bases: basesPor.get(l.id) ?? [],
    tipos: tiposPor.get(l.id) ?? [],
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
 * Tudo ou nada, numa transacao so. Metade aplicada e o pior estado possivel aqui:
 * o admin fecha o modal achando que salvou, e metade da frota fica com a permissao
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
      .select({ id: user.id, email: user.email, admin: user.admin, baseFixa: base.nome })
      .from(user)
      .leftJoin(base, eq(base.id, user.baseId))
    const porLogin = new Map(alvos.map((u) => [loginDe(u.email), u]))

    // Toda a validacao antes de qualquer escrita. Um login errado no fim do array
    // nao pode ter deixado rastro dos que vinham antes dele.
    for (const m of mudancas) {
      const alvo = porLogin.get(m.usuario)
      if (!alvo) {
        // Esta rota edita, nao cria. Criar em silencio deixaria um usuario sem
        // base fixa e sem conta de senha, que e um estado que ninguem pediu.
        throw new EntradaInvalida(`usuario '${m.usuario}' nao existe`)
      }
      // A base fixa e a que a tela ja deixa selecionada e travada; as `bases` sao
      // as que ele pode escolher. Tirar a fixa da lista deixa o operador preso numa
      // base cujo botao some da tela, e cuja escrita a fase 2 vai recusar. Nao e um
      // estado que alguem queira, entao nao pode ser gravado.
      if (!alvo.admin && m.bases && alvo.baseFixa && !m.bases.includes(alvo.baseFixa)) {
        throw new EntradaInvalida(
          `'${m.usuario}' e da base '${alvo.baseFixa}', que nao pode sair das bases liberadas`,
        )
      }
    }

    const idPorBase = await mapaDeBases(tx, mudancas, porLogin)
    const agora = new Date()

    for (const m of mudancas) {
      const alvo = porLogin.get(m.usuario)!

      await tx.update(user).set({ name: m.nome, updatedAt: agora }).where(eq(user.id, alvo.id))

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

      // Admin tem tudo, e por isso a tela desenha as caixas dele desabilitadas.
      // Se `bases` ou `tipos` vierem assim mesmo, gravar apagaria o que ele tem.
      if (alvo.admin) continue

      if (m.bases) {
        await tx.delete(usuarioBase).where(eq(usuarioBase.usuarioId, alvo.id))
        const nomes = [...new Set(m.bases)]
        if (nomes.length > 0) {
          await tx
            .insert(usuarioBase)
            .values(nomes.map((nome) => ({ usuarioId: alvo.id, baseId: idPorBase.get(nome)! })))
        }
      }

      if (m.tipos) {
        await tx.delete(usuarioTipo).where(eq(usuarioTipo.usuarioId, alvo.id))
        const tipos = [...new Set(m.tipos)]
        if (tipos.length > 0) {
          await tx.insert(usuarioTipo).values(tipos.map((tipo) => ({ usuarioId: alvo.id, tipo })))
        }
      }
    }

    return mudancas.length
  })
}

type Escritor = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Nome -> id das bases citadas. Nome que nao existe para aqui, antes de escrever. */
async function mapaDeBases(
  tx: Escritor,
  mudancas: MudancaUsuario[],
  porLogin: Map<string, { admin: boolean }>,
): Promise<Map<string, string>> {
  const pedidos = [
    ...new Set(
      mudancas.filter((m) => !porLogin.get(m.usuario)?.admin).flatMap((m) => m.bases ?? []),
    ),
  ]
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
