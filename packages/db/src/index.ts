import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { URL_BANCO } from './env.ts'
import * as schema from './schema/index.ts'

/**
 * A conexao pooled da Neon passa por PgBouncer em modo transacao, que nao guarda
 * prepared statement entre uma query e a seguinte. A `postgres-js` os usa por
 * padrao, e a falha disso nao aparece em teste: ela precisa de duas queries
 * concorrentes na mesma conexao, que e o que producao tem e o desenvolvimento nao.
 * Por isso a deteccao e pela URL, e nao um parametro que alguem tem que lembrar de
 * passar. O host pooled da Neon termina em `-pooler`.
 *
 * `max` cai junto pelo mesmo motivo: com Fluid compute a instancia e reusada e o
 * pool e por instancia, entao 10 conexoes viram 10 vezes o numero de instancias.
 */
export function criarDb(
  url: string = URL_BANCO,
  opcoes: { max?: number; prepare?: boolean } = {},
) {
  const pooled = /-pooler\./.test(url) || /[?&]pgbouncer=true/.test(url)
  const sql = postgres(url, {
    max: opcoes.max ?? (pooled ? 3 : 10),
    prepare: opcoes.prepare ?? !pooled,
  })
  return { db: drizzle(sql, { schema }), sql }
}

export type Db = ReturnType<typeof criarDb>['db']

export { schema, URL_BANCO }
export { exigir, opcional, urlMigracao } from './env.ts'
export * from './schema/index.ts'
export * from './consultas/sessao.ts'
export * from './consultas/usuarios.ts'
export * from './consultas/integracoes.ts'
export * from './consultas/atas.ts'
export * from './consultas/documentos.ts'
export * from './consultas/registros.ts'
export * from './consultas/preventiva.ts'
