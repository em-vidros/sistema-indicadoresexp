import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { URL_BANCO } from './env.ts'
import * as schema from './schema/index.ts'

export function criarDb(url: string = URL_BANCO, opcoes: { max?: number } = {}) {
  const sql = postgres(url, { max: opcoes.max ?? 10 })
  return { db: drizzle(sql, { schema }), sql }
}

export type Db = ReturnType<typeof criarDb>['db']

export { schema, URL_BANCO }
export * from './schema/index.ts'
