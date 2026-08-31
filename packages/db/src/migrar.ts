import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { URL_BANCO } from './env.ts'

const sql = postgres(URL_BANCO, { max: 1 })
await migrate(drizzle(sql), {
  migrationsFolder: new URL('./migrations', import.meta.url).pathname,
})
await sql.end()
console.log('migracoes aplicadas')
