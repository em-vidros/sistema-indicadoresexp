/**
 * A prova de que o desenho nao mudou: fotografa as doze telas e cobra pixel identico.
 *
 * O `olhar.ts` fotografa para alguem olhar e nao reprova nada. Este reprova. Enquanto o
 * `geist.css` escrito a mao vira Tailwind, o unico jeito de afirmar "o desenho continua o
 * mesmo" e comparar imagem com imagem; ler o CSS dos dois lados nao prova nada, porque o
 * ponto da troca e justamente o CSS ficar diferente.
 *
 *   bun verificar/paridade.ts guardar <rotulo>      # fotografa em var/paridade/<rotulo>/
 *   bun verificar/paridade.ts comparar <a> <b>      # diff pixel a pixel, sai 1 se diferir
 *
 * As fotos saem contra um servidor de verdade, com o banco que ele tiver, entao os dois
 * rotulos comparados precisam sair da mesma sessao e do mesmo banco. Nao ha relogio falso:
 * congelar `Date` deixaria grafico do recharts parado no meio da animacao, e o que muda com
 * a hora nestas telas muda so na virada do dia. Comparar duas rodadas separadas por minutos
 * e seguro; separadas por um dia, nao.
 *
 * Quando reprova, o diff sai em `var/paridade/<a>-vs-<b>/<tela>.png`, com o pixel diferente
 * pintado. E la que se descobre se o delta e a borda de um botao ou a tela inteira deslocada
 * por um pixel de padding.
 */
import { mkdir, readdir } from 'node:fs/promises'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { chromium } from 'playwright'
import { CAMINHOS_DA_SPA } from '../apps/server/src/caminhos.ts'

const PASTA = new URL('../var/paridade/', import.meta.url).pathname
const LARGURA = 1440
const ALTURA = 900

/** A login pinta sem sessao, entao ela sai de um contexto proprio, sem cookie. */
const LOGIN = '/entrar.html'

function nomeDaTela(caminho: string): string {
  return caminho === LOGIN ? 'entrar' : caminho.slice(1)
}

async function guardar(rotulo: string): Promise<void> {
  const origem = process.env.PARIDADE_ORIGEM ?? 'http://localhost:3000'
  const usuario = process.env.PARIDADE_USUARIO ?? 'livia'
  const senha = process.env[`SENHA_${usuario.toUpperCase()}`]
  if (senha === undefined) {
    console.error(`paridade: defina SENHA_${usuario.toUpperCase()} no .env`)
    process.exit(1)
  }

  const destino = `${PASTA}${rotulo}/`
  await mkdir(destino, { recursive: true })

  const navegador = await chromium.launch()
  const contexto = await navegador.newContext({ viewport: { width: LARGURA, height: ALTURA } })
  const erros: string[] = []
  contexto.on('page', (pagina) => {
    pagina.on('pageerror', (erro) => erros.push(erro.message))
    pagina.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text())
    })
  })

  const entrada = await contexto.request.post(`${origem}/api/entrar`, {
    data: { usuario, senha, lembrar: false },
  })
  if (!entrada.ok()) {
    console.error(`paridade: login de ${usuario} falhou com ${entrada.status()}`)
    process.exit(1)
  }

  const comSessao = await contexto.newPage()
  const semSessao = await navegador.newContext({ viewport: { width: LARGURA, height: ALTURA } })

  for (const caminho of [LOGIN, ...CAMINHOS_DA_SPA]) {
    const nome = nomeDaTela(caminho)
    const pagina = caminho === LOGIN ? await semSessao.newPage() : comSessao
    await pagina.goto(`${origem}${caminho}`, { waitUntil: 'networkidle' })
    // Fonte que ainda nao chegou pinta no fallback do sistema, e o fallback muda a altura
    // de cada linha. Sem esperar aqui o diff acusaria a pagina inteira deslocada.
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.screenshot({ path: `${destino}${nome}.png`, fullPage: true, animations: 'disabled' })
    if (caminho === LOGIN) await pagina.close()
    console.log(`paridade: ${rotulo}/${nome}.png`)
  }

  await navegador.close()
  if (erros.length > 0) {
    console.error(`paridade: ${erros.length} erro(s) de console ou de pagina`)
    for (const erro of erros) console.error(`  ${erro}`)
    process.exit(1)
  }
}

async function comparar(a: string, b: string): Promise<void> {
  const ladoA = `${PASTA}${a}/`
  const ladoB = `${PASTA}${b}/`
  const diffs = `${PASTA}${a}-vs-${b}/`

  const telas = (await readdir(ladoA)).filter((n) => n.endsWith('.png')).sort()
  if (telas.length === 0) {
    console.error(`paridade: ${ladoA} nao tem foto nenhuma`)
    process.exit(1)
  }
  await mkdir(diffs, { recursive: true })

  let reprovadas = 0
  for (const tela of telas) {
    const bytesA = await Bun.file(`${ladoA}${tela}`).arrayBuffer()
    const arquivoB = Bun.file(`${ladoB}${tela}`)
    if (!(await arquivoB.exists())) {
      console.error(`paridade: FALTA  ${tela} em ${b}`)
      reprovadas += 1
      continue
    }
    const pngA = PNG.sync.read(Buffer.from(bytesA))
    const pngB = PNG.sync.read(Buffer.from(await arquivoB.arrayBuffer()))

    if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
      console.error(
        `paridade: TAMANHO ${tela}  ${pngA.width}x${pngA.height} vs ${pngB.width}x${pngB.height}`,
      )
      reprovadas += 1
      continue
    }

    const diff = new PNG({ width: pngA.width, height: pngA.height })
    // Limiar zero: a troca de folha nao tem por que mexer em nenhum pixel, e um limiar
    // frouxo esconderia exatamente o erro de meio pixel que se procura aqui.
    const diferentes = pixelmatch(pngA.data, pngB.data, diff.data, pngA.width, pngA.height, {
      threshold: 0,
    })
    if (diferentes === 0) {
      console.log(`paridade: ok     ${tela}`)
      continue
    }
    await Bun.write(`${diffs}${tela}`, PNG.sync.write(diff))
    const total = pngA.width * pngA.height
    console.error(
      `paridade: DIFERE ${tela}  ${diferentes} pixel(s) de ${total}  ->  ${diffs}${tela}`,
    )
    reprovadas += 1
  }

  if (reprovadas > 0) {
    console.error(`paridade: ${reprovadas} de ${telas.length} tela(s) mudaram`)
    process.exit(1)
  }
  console.log(`paridade: ${telas.length} telas identicas`)
}

const [comando, ...resto] = process.argv.slice(2)
if (comando === 'guardar' && resto[0] !== undefined) await guardar(resto[0])
else if (comando === 'comparar' && resto[0] !== undefined && resto[1] !== undefined) {
  await comparar(resto[0], resto[1])
} else {
  console.error('uso: paridade.ts guardar <rotulo> | paridade.ts comparar <a> <b>')
  process.exit(1)
}
