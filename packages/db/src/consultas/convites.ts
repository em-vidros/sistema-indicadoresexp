/**
 * O primeiro acesso: ninguem nasce com senha, e quem escolhe a dela e a propria
 * pessoa, num link de uso unico.
 *
 * A alternativa era o admin digitar uma senha no cadastro e passar por WhatsApp.
 * Ela custa o mesmo para implementar e deixa a senha de outra pessoa na mao de
 * duas, mais o histórico do aplicativo. O link nao evita o WhatsApp, mas o que
 * viaja por la deixa de servir depois do primeiro uso.
 *
 * O token vive so no link. No banco fica o SHA-256 dele, pelo mesmo motivo que
 * senha nao fica em claro: quem le a tabela nao ganha com isso a capacidade de
 * entrar como ninguem. SHA-256 puro, e nao scrypt, porque o token e 32 bytes de
 * `randomBytes` e nao tem dicionario: o que scrypt protege e senha escolhida por
 * gente.
 *
 * Convite aceito grava a conta de senha do better-auth, e por isso este arquivo
 * recebe `DepsConta` pelo mesmo motivo que `usuarios.ts`: `packages/db` nao pode
 * importar `@ind/auth`, entao o hash chega pronto e o par `(providerId, issuer)`
 * chega junto.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, ne } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { account, conviteSenha, user } from '../schema/auth.ts'
import { type DepsConta, loginDe } from './usuarios.ts'

/**
 * Sete dias. Curto o bastante para um link esquecido numa conversa antiga nao
 * valer nada, e longo o bastante para quem foi cadastrado numa sexta a noite
 * ainda entrar na segunda.
 */
export const VALIDADE_DIAS = 7

/** O que a rota devolve. `token` so existe aqui e no link; o banco nunca o ve. */
export type ConviteGerado = { token: string; expiraEm: Date }

/** Quem o convite identifica, para a tela de login dizer o nome de quem vai
 * escolher a senha em vez de pedir a senha de um desconhecido. */
export type DonoDoConvite = { usuarioId: string; usuario: string; nome: string }

/**
 * O menor conjunto de metodos que estas funcoes usam. O tipo e estrutural de
 * proposito: tanto o `Db` quanto a transacao o satisfazem, e por isso `criarConvite`
 * serve ao seed, que ja esta dentro de uma transacao, e a rota, que nao esta.
 */
type Gravador = Pick<Db, 'select' | 'insert' | 'update' | 'delete'>
type Leitor = Pick<Db, 'select'>

const hashDe = (token: string): string => createHash('sha256').update(token).digest('hex')

const validoAte = (agora: Date): Date =>
  new Date(agora.getTime() + VALIDADE_DIAS * 24 * 60 * 60 * 1000)

/**
 * `randomBytes`, e nao `Math.random`. O gerador do JavaScript e previsivel a
 * partir de algumas saidas, e aqui a saida e a unica coisa entre um estranho e a
 * conta de outra pessoa.
 */
const novoToken = (): string => randomBytes(32).toString('base64url')

/**
 * Gera o link e derruba os anteriores da mesma pessoa.
 *
 * Derrubar e DELETE, e nao `usado_em`: link substituido nao foi usado, e marcar
 * como usado apagaria a diferenca entre "alguem entrou com este link" e "o admin
 * gerou outro". A diferenca some do banco justamente no dia em que alguem
 * perguntar se o link vazado chegou a ser usado.
 */
export async function criarConvite(
  db: Gravador,
  usuarioId: string,
  agora = new Date(),
): Promise<ConviteGerado> {
  const token = novoToken()
  const expiraEm = validoAte(agora)

  await derrubarAbertos(db, usuarioId)
  await db.insert(conviteSenha).values({
    id: `cnv_${randomUUID()}`,
    usuarioId,
    tokenHash: hashDe(token),
    expiraEm,
    criadoEm: agora,
  })

  return { token, expiraEm }
}

/**
 * De quem e este token, se e que ele ainda vale.
 *
 * `null` cobre os tres casos, e a rota responde 404 para os tres pelo mesmo
 * motivo: dizer qual deles e conta a quem estiver testando tokens quais logins
 * existem.
 */
export async function lerConvite(
  db: Leitor,
  token: string,
  agora = new Date(),
): Promise<DonoDoConvite | null> {
  const [linha] = await db
    .select({ usuarioId: user.id, email: user.email, nome: user.name })
    .from(conviteSenha)
    .innerJoin(user, eq(user.id, conviteSenha.usuarioId))
    .where(valido(token, agora))
  if (!linha) return null
  return { usuarioId: linha.usuarioId, usuario: loginDe(linha.email), nome: linha.nome }
}

/**
 * Aceita: grava a conta de senha, marca o convite como usado e derruba os outros
 * abertos da mesma pessoa. Tudo numa transacao, porque conta gravada com convite
 * ainda aberto e um link que continua valendo depois de a senha existir.
 *
 * Devolve o id de quem entrou, para o servidor abrir a sessao na sequencia, ou
 * `null` se o token nao vale mais. A checagem e refeita aqui dentro de proposito:
 * entre o GET que a tela fez e este POST cabe um segundo POST com o mesmo token.
 */
export function aceitarConvite(
  db: Db,
  token: string,
  senhaHash: string,
  deps: DepsConta,
  agora = new Date(),
): Promise<DonoDoConvite | null> {
  return db.transaction(async (tx) => {
    const [linha] = await tx
      .select({
        conviteId: conviteSenha.id,
        usuarioId: user.id,
        email: user.email,
        nome: user.name,
      })
      .from(conviteSenha)
      .innerJoin(user, eq(user.id, conviteSenha.usuarioId))
      .where(valido(token, agora))
    if (!linha) return null

    await gravarSenha(tx, linha.usuarioId, loginDe(linha.email), senhaHash, deps, agora)

    await tx
      .update(conviteSenha)
      .set({ usadoEm: agora })
      .where(eq(conviteSenha.id, linha.conviteId))

    await derrubarAbertos(tx, linha.usuarioId, linha.conviteId)

    return { usuarioId: linha.usuarioId, usuario: loginDe(linha.email), nome: linha.nome }
  })
}

/**
 * A conta que o `sign-in/email` procura, e nenhuma outra.
 *
 * Os tres campos casados sao `providerId`, `issuer` e `accountId`, e o
 * `accountId` tem que ser o proprio `user.id`. Errar qualquer um dos tres nao da
 * erro na gravacao: da 401 mudo no login, que e o defeito mais caro de achar
 * deste sistema. `packages/auth/src/index.ts` documenta os tres.
 */
async function gravarSenha(
  tx: Gravador,
  usuarioId: string,
  login: string,
  senhaHash: string,
  deps: DepsConta,
  agora: Date,
): Promise<void> {
  const casa = and(
    eq(account.userId, usuarioId),
    eq(account.providerId, deps.provedorSenha),
    eq(account.issuer, deps.issuerSenha),
  )

  const trocadas = await tx
    .update(account)
    .set({ password: senhaHash, accountId: usuarioId, updatedAt: agora })
    .where(casa)
    .returning({ id: account.id })
  if (trocadas.length > 0) return

  await tx.insert(account).values({
    // `acc_<login>`, o mesmo formato que o seed usa. Id de conta tambem e lido
    // direto na tabela quando alguem depura um login que nao entra.
    id: `acc_${login}`,
    issuer: deps.issuerSenha,
    accountId: usuarioId,
    providerId: deps.provedorSenha,
    userId: usuarioId,
    password: senhaHash,
    createdAt: agora,
    updatedAt: agora,
  })
}

const valido = (token: string, agora: Date) =>
  and(
    eq(conviteSenha.tokenHash, hashDe(token)),
    isNull(conviteSenha.usadoEm),
    gt(conviteSenha.expiraEm, agora),
  )

async function derrubarAbertos(db: Gravador, usuarioId: string, exceto?: string): Promise<void> {
  await db
    .delete(conviteSenha)
    .where(
      and(
        eq(conviteSenha.usuarioId, usuarioId),
        isNull(conviteSenha.usadoEm),
        exceto === undefined ? undefined : ne(conviteSenha.id, exceto),
      ),
    )
}
