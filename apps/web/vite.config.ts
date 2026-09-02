import { readdirSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

const RAIZ = new URL('src/', import.meta.url).pathname

/**
 * As entradas sao descobertas, nao listadas. Uma lista aqui e uma tela nova em
 * `src/` divergem em silencio, e o sintoma seria a tela sumir do build sem erro.
 */
const entradas = Object.fromEntries(
  readdirSync(RAIZ)
    .filter((nome) => nome.endsWith('.html'))
    .map((nome) => [nome.slice(0, -'.html'.length), RAIZ + nome]),
)

if (Object.keys(entradas).length === 0) throw new Error('nenhum .html em apps/web/src')

export default defineConfig({
  root: 'src',
  plugins: [react()],
  // Nao ha publicDir. `docs/` continua na raiz do repositorio e quem serve e o
  // Hono, atras da sessao. Um publicDir aqui copiaria os 11 MB de PDF para dentro
  // do bundle, que e exatamente o que a fase 1 desfaz.
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: { input: entradas },
  },
})
