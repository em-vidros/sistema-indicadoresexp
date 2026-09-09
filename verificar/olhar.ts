/**
 * Fotografa as dez telas do app, uma a uma, para alguem olhar. Nao reprova nada.
 *
 * Roda contra um servidor de verdade, com o banco que ele tiver: a tela que aparece na
 * foto e a que a Livia veria. A prova de pixel morreu com o redesenho, e o que sobrou e
 * isto, um jeito de ver as dez telas em trinta segundos depois de mexer numa folha que
 * todas dividem.
 *
 *   bun verificar/olhar.ts [origem] [usuario]
 *
 * Padrao: http://localhost:3000 e livia, com a senha em SENHA_<USUARIO> do `.env`. As
 * fotos vao para `var/olhar/<tela>.png`, em 1440 de largura e pagina inteira.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { CAMINHOS_DA_SPA } from '../apps/server/src/caminhos.ts'

const ORIGEM = process.argv[2] ?? 'http://localhost:3000'
const USUARIO = process.argv[3] ?? 'livia'
const senha = process.env[`SENHA_${USUARIO.toUpperCase()}`]
if (senha === undefined) {
  console.error(`olhar: defina SENHA_${USUARIO.toUpperCase()} no .env`)
  process.exit(1)
}

const PASTA = new URL('../var/olhar/', import.meta.url).pathname
await mkdir(PASTA, { recursive: true })

const navegador = await chromium.launch()
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
const pagina = await contexto.newPage()
const erros: string[] = []
pagina.on('pageerror', (erro) => erros.push(erro.message))
pagina.on('console', (msg) => {
  if (msg.type() === 'error') erros.push(msg.text())
})

const entrada = await contexto.request.post(`${ORIGEM}/api/entrar`, {
  data: { usuario: USUARIO, senha, lembrar: false },
})
if (!entrada.ok()) {
  console.error(`olhar: login de ${USUARIO} falhou com ${entrada.status()}`)
  process.exit(1)
}

for (const caminho of ['/entrar.html', ...CAMINHOS_DA_SPA]) {
  const nome = caminho === '/entrar.html' ? 'entrar' : caminho.slice(1)
  const sessao = caminho === '/entrar.html' ? await navegador.newContext({ viewport: { width: 1440, height: 900 } }) : null
  const alvo = sessao === null ? pagina : await sessao.newPage()
  await alvo.goto(`${ORIGEM}${caminho}`, { waitUntil: 'networkidle' })
  await alvo.screenshot({ path: `${PASTA}${nome}.png`, fullPage: true })
  console.log(`olhar: ${nome}.png`)
  if (sessao !== null) await sessao.close()
}

await navegador.close()
if (erros.length > 0) {
  console.error(`olhar: ${erros.length} erro(s) de console ou de pagina`)
  for (const erro of erros) console.error(`  ${erro}`)
  process.exit(1)
}
