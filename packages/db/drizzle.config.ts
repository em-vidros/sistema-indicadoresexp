import { defineConfig } from 'drizzle-kit'
import { URL_BANCO } from './src/env.ts'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dbCredentials: { url: URL_BANCO },
  strict: true,
  verbose: true,
})
