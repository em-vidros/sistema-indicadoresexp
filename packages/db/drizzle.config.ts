import { defineConfig } from 'drizzle-kit'
import { urlMigracao } from './src/env.ts'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dbCredentials: { url: urlMigracao() },
  strict: true,
  verbose: true,
})
