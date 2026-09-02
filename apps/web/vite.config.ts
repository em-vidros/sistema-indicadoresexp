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

/**
 * O que a tela de login carrega. Ela pinta antes de existir sessao, entao o portao
 * precisa liberar cada um destes pelo nome, e nome com hash muda a cada build. Sao os
 * unicos sem hash no `dist/`, e `verificar/publicos.ts` cobra os dois sentidos: o que
 * a login pede tem que estar liberado, e o que esta liberado tem que ser pedido.
 */
const SEM_HASH = new Set(['entrar', 'entrar.css', 'vendor-react', 'modulepreload-polyfill'])

function nome(base: string, extensao: string): string {
  const semExtensao = base.replace(/\.[^.]+$/, '')
  if (SEM_HASH.has(base) || SEM_HASH.has(semExtensao)) return `assets/${base}${extensao}`
  return `assets/[name]-[hash]${extensao === '' ? '[extname]' : extensao}`
}

export default defineConfig({
  root: 'src',
  plugins: [react()],
  // Nao ha publicDir. `docs/` continua na raiz do repositorio e quem serve e o
  // Hono, atras da sessao. Um publicDir aqui copiaria os 11 MB de PDF para dentro
  // do bundle, que e exatamente o que a fase 1 desfaz.
  publicDir: false,
  build: {
    // O `estilo.css` da baseline sai do CSSOM, que reserializa os dois lados igual,
    // entao minificar nao reprovaria a prova. Fica desligado porque o CSS destas telas
    // e o mesmo texto que a Livia aprovou e ele tem que continuar legivel em `dist/`,
    // que e onde alguem vai ler quando a cor estiver errada em producao.
    cssMinify: false,
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: entradas,
      output: {
        // React sai num pedaco proprio desde ja. Enquanto so `entrar` o importa, o
        // Rollup o dobraria dentro de `entrar.js`, e na segunda tela portada ele
        // viraria um pedaco compartilhado com hash, que a tela de login carrega antes
        // de existir sessao. Separar agora troca uma mudanca no portao a cada porte
        // por nenhuma.
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'vendor-react' : undefined),
        entryFileNames: (chunk) => nome(chunk.name, '.js'),
        chunkFileNames: (chunk) => nome(chunk.name, '.js'),
        assetFileNames: (asset) => nome(asset.names[0] ?? '', ''),
      },
    },
  },
})
