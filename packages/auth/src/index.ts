/**
 * Adaptador de sessao. better-auth sobre o mesmo Drizzle do `@ind/db`, sem tabela
 * propria e sem segundo banco: `user`, `session`, `account` e `verification` sao as
 * que `packages/db/src/schema/auth.ts` ja declara e as migracoes ja criaram.
 *
 * A forma dessas quatro tabelas nao foi copiada da documentacao, que nao lista os
 * campos. Ela saiu de `getAuthTables()` do proprio pacote, na versao 1.7.2, e o que
 * de fato muda em relacao as versoes anteriores e `account`: ganhou `issuer` NOT
 * NULL e um indice unico em `(issuer, account_id)`. O valor para login por senha e
 * `local:credential`, produzido por `createLocalAccountIssuer('credential')`, e o
 * `sign-in/email` procura a conta exatamente por
 * `providerId === 'credential' && issuer === 'local:credential' && accountId === user.id`.
 * Errar qualquer um dos tres devolve 401 sem dizer o motivo. Por isso `ISSUER_SENHA`,
 * `PROVEDOR_SENHA` e o formato de `accountId` sao exportados: o seed grava as contas
 * dos quatro usuarios e precisa acertar os tres na mao.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createLocalAccountIssuer } from 'better-auth/db'
import { account, type Db, exigir, opcional, session, user, verification } from '@ind/db'

/** O que o `sign-in/email` exige em `account.provider_id`. */
export const PROVEDOR_SENHA = 'credential'

/** O que o `sign-in/email` exige em `account.issuer`, hoje `local:credential`. */
export const ISSUER_SENHA = createLocalAccountIssuer(PROVEDOR_SENHA)

export function criarAuth(db: Db) {
  return betterAuth({
    // Nunca no codigo. O `.env` da raiz e a unica fonte, e `exigir` estoura se faltar.
    secret: exigir('BETTER_AUTH_SECRET'),
    baseURL: opcional('BETTER_AUTH_URL', `http://localhost:${opcional('PORTA_SERVIDOR', '3100')}`),
    basePath: '/api/auth',
    database: drizzleAdapter(db, {
      provider: 'pg',
      // Mapa explicito. Passar o namespace inteiro do schema faria o adaptador
      // escolher entre 32 tabelas por nome, e `user` colide com nada hoje mas
      // colidiria no dia em que alguem criar `usuario`.
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Nao ha servidor de e-mail neste app; exigir verificacao trancaria os quatro
      // usuarios do lado de fora.
      requireEmailVerification: false,
    },
  })
}

export type Auth = ReturnType<typeof criarAuth>

/**
 * O hasher que o login usa, tirado do contexto da propria instancia em vez de
 * reimportado de `better-auth/crypto`. A diferenca importa: se um dia
 * `emailAndPassword.password` trocar o algoritmo, o seed troca junto, de graca. Com
 * o import solto, o seed continuaria gravando scrypt enquanto o login verificaria
 * outra coisa, e os quatro usuarios nasceriam sem conseguir entrar.
 */
export async function hasherDe(auth: Auth) {
  const ctx = await auth.$context
  return {
    hash: (senha: string) => ctx.password.hash(senha),
    verificar: (senha: string, hash: string) => ctx.password.verify({ hash, password: senha }),
  }
}

export type Hasher = Awaited<ReturnType<typeof hasherDe>>
