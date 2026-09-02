/**
 * As migracoes usam a conexao direta, nao a pooled.
 *
 * `drizzle-kit` e o migrador abrem transacao com DDL e dependem de sessao estavel,
 * e o PgBouncer em modo transacao devolve uma conexao diferente a cada statement.
 * Na Neon as duas strings existem lado a lado e diferem so pelo `-pooler` no host,
 * o que torna facil apontar a errada e descobrir no meio de um DDL aplicado pela
 * metade. Fora da Neon nao ha duas: `DATABASE_URL` responde pelas duas coisas.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { urlMigracao } from './env.ts'

const sql = postgres(urlMigracao(), { max: 1 })
await migrate(drizzle(sql), {
  migrationsFolder: new URL('./migrations', import.meta.url).pathname,
})
await sql.end()
console.log('migracoes aplicadas')
