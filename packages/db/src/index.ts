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
export { exigir, opcional } from './env.ts'
export * from './schema/index.ts'
export * from './consultas/sessao.ts'
export * from './consultas/usuarios.ts'
export * from './consultas/integracoes.ts'
export * from './consultas/atas.ts'
export * from './consultas/documentos.ts'
export * from './consultas/registros.ts'
export * from './consultas/preventiva.ts'
