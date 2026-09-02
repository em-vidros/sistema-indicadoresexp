/**
 * O palco e um navegador de verdade sem servidor e sem banco atras dele.
 *
 * A tela roda contra `apps/web/dist/`, e tudo que ela pede de fora vira decisao
 * declarada aqui: `/api/*` sai de um JSON de fixture, `/docs/*` sai do disco, o
 * resto e recusado. Sem isso a prova depende do banco de dev estar de pe e com os
 * mesmos dados de ontem, e uma prova que depende disso nao segura nada.
 *
 * O relogio tambem e nosso. `page.clock.install` congela `new Date()` na hora do
 * roteiro e faz `setTimeout` andar so quando o passo mandar, entao o erro de login
 * que some em 3 s some no mesmo lugar em toda maquina.
 *
 * A rota e do `context`, nao da `page`. Com `page.route` o popup de `window.open`
 * e o download de `<a download>` nao sao servidos e os eventos nunca chegam, e os
 * dois sao justamente o que prova `verDocCard` e `baixarDocCard`.
 */
import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page, Request as PedidoHttp, Route } from 'playwright'

export type Tela =
  | 'entrar'
  | 'documentos-frota'
  | 'integracao-frota'
  | 'dashboard-semanal'
  | 'ata-reuniao'
  | 'manutencao-frota'
  | 'formulario-registro'

export const TELAS: readonly Tela[] = [
  'entrar',
  'documentos-frota',
  'integracao-frota',
  'dashboard-semanal',
  'ata-reuniao',
  'manutencao-frota',
  'formulario-registro',
]

/** A resposta que a rota devolve para `METODO /caminho?query`, com a query ordenada. */
export type Fixture = { readonly status?: number; readonly corpo: unknown }

/** Chave: `"GET /api/documentos"`. Um segmento `*` casa um segmento qualquer. */
export type Fixtures = Readonly<Record<string, Fixture>>

export type Passo = {
  /** Vira nome de arquivo, entao kebab-case. */
  readonly nome: string
  /** Handlers de `handlers.txt` que este passo exercita. */
  readonly cobre: readonly string[]
  /** So interacao de gente: click, fill, selectOption, setInputFiles, teclado. */
  readonly agir: (p: Page) => Promise<void>
  /** Quanto o relogio anda depois do `agir`. Default 3500. Menor para ver estado intermediario. */
  readonly esperaMs?: number
  /** Fixtures que valem deste passo em diante, por cima das do roteiro. */
  readonly fixtures?: Fixtures
}

export type Roteiro = {
  readonly tela: Tela
  /** Caminho na origem do palco, com query se a tela precisar. */
  readonly url: string
  /** ISO com fuso. O relogio da pagina congela aqui. */
  readonly agora: string
  readonly fixtures: Fixtures
  /** O primeiro e sempre `inicial`, que nao age. */
  readonly passos: readonly Passo[]
}

export type Palco = {
  readonly page: Page
  /** Em ordem de acontecimento, congelada. */
  efeitos(): readonly string[]
  limparEfeitos(): void
  /** Chaves de fixture que a tela pediu e nao existem. */
  faltando(): readonly string[]
  usarFixtures(f: Fixtures): void
  /** Espera a tela parar de se mexer. `onde` so aparece se estourar o teto. */
  assentar(onde: string): Promise<void>
  fechar(): Promise<void>
}

export const ORIGEM = 'http://paridade.local'

export const RAIZ = new URL('../../', import.meta.url).pathname

const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'

const TETO_MS = 15_000
const REDE_PARADA_MS = 150
const EFEITO_PARADO_MS = 200

const TIPOS: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export async function lerFixtures(tela: Tela): Promise<Fixtures> {
  return (await Bun.file(new URL(`fixtures/${tela}.json`, import.meta.url)).json()) as Fixtures
}

export async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch()
  } catch {
    console.error('o Chromium do Playwright nao esta nesta maquina. instale com:')
    console.error('\n    bunx playwright install chromium\n')
    process.exit(2)
  }
}

function dormir(ms: number): Promise<void> {
  // Timer do Bun, nao do navegador. O relogio da pagina esta congelado, entao um
  // `setTimeout` de la nunca dispararia e o palco esperaria para sempre.
  return new Promise((pronto) => setTimeout(pronto, ms))
}

function extensao(caminho: string): string {
  const ultimo = caminho.slice(caminho.lastIndexOf('/') + 1)
  const ponto = ultimo.lastIndexOf('.')
  return ponto <= 0 ? '' : ultimo.slice(ponto).toLowerCase()
}

/**
 * Um caminho que uma pessoa navegaria para chegar noutra tela. A checagem existe
 * porque `<a download href="algo.pdf">` tambem e pedido de navegacao do quadro
 * principal, e trata-lo como saida da tela mataria o evento de download, que e o
 * unico jeito de provar `baixarDocCard`.
 */
function ehTela(caminho: string): boolean {
  const ext = extensao(caminho)
  return ext === '' || ext === '.html'
}

function tostao(caminho: string): string {
  return `<!doctype html><html lang="pt-BR"><head><title>saiu</title></head><body><p>a tela saiu para ${caminho}</p></body></html>`
}

/**
 * O corpo vira a forma, nao o conteudo. O que a prova segura e que a tela mandou
 * `titulo` como texto e `lembrar` como booleano; o valor muda a cada fixture e
 * transformaria toda edicao de dado de teste em divergencia.
 */
function redigir(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(redigir)
  if (valor !== null && typeof valor === 'object') {
    const saida: Record<string, unknown> = {}
    for (const [chave, dentro] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = redigir(dentro)
    }
    return saida
  }
  return valor === null ? 'null' : typeof valor
}

function corpoRedigido(bruto: string | null): string {
  if (bruto === null || bruto === '') return '<sem corpo>'
  try {
    return JSON.stringify(redigir(JSON.parse(bruto)))
  } catch {
    // O multipart do upload traz um boundary sorteado a cada envio, entao nem o
    // texto nem o tamanho dele servem para comparar.
    return '<corpo nao-JSON>'
  }
}

function chaveDe(metodo: string, url: URL): string {
  const params = [...url.searchParams.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const query = params.length === 0 ? '' : `?${params.map(([n, v]) => `${n}=${v}`).join('&')}`
  return `${metodo} ${url.pathname}${query}`
}

function casaCuringa(molde: string, chave: string): boolean {
  const a = molde.split('/')
  const b = chave.split('/')
  if (a.length !== b.length) return false
  return a.every((parte, i) => parte === '*' || parte === b[i])
}

function acharFixture(fixtures: Fixtures, chave: string): Fixture | null {
  const exata = fixtures[chave]
  if (exata !== undefined) return exata
  const candidatas = Object.keys(fixtures)
    .filter((molde) => molde.includes('*') && casaCuringa(molde, chave))
    // Menos curinga ganha, e o desempate por nome mantem a escolha igual entre execucoes.
    .sort((x, y) => x.split('*').length - y.split('*').length || (x < y ? -1 : 1))
  const molde = candidatas[0]
  return molde === undefined ? null : (fixtures[molde] ?? null)
}

async function arquivoDoDisco(caminho: string): Promise<Uint8Array | null> {
  const arquivo = Bun.file(caminho)
  if (!(await arquivo.exists())) return null
  return new Uint8Array(await arquivo.arrayBuffer())
}

export async function montarPalco(
  navegador: Browser,
  roteiro: Roteiro,
  dist: string,
): Promise<Palco> {
  const contexto: BrowserContext = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    deviceScaleFactor: 1,
    acceptDownloads: true,
  })
  // O default sao 30 s. Aqui nada demora, porque nao ha rede nem banco, entao o teto
  // so e alcancado quando o elemento nao vai aparecer nunca (handler morto). Esperar
  // meio minuto por cada um deles faz a prova levar minutos para dizer o obvio.
  contexto.setDefaultTimeout(4_000)
  const pagina = await contexto.newPage()
  await pagina.clock.install({ time: new Date(roteiro.agora) })

  const caminhoDaTela = new URL(roteiro.url, ORIGEM).pathname
  let fixtures: Fixtures = roteiro.fixtures
  const efeitos: string[] = []
  const faltando: string[] = []
  const popups: Page[] = []
  let emVoo = 0

  const registrar = (texto: string): void => {
    efeitos.push(texto)
  }

  const ehQuadroPrincipal = (pedido: PedidoHttp): boolean => {
    // `route.frame()` nao existe; quem sabe o quadro e o pedido.
    try {
      return pedido.frame() === pagina.mainFrame()
    } catch {
      return false
    }
  }

  const servir = async (rota: Route): Promise<void> => {
    const pedido = rota.request()
    const metodo = pedido.method()
    const url = new URL(pedido.url())
    const mesmaOrigem = url.origin === ORIGEM
    const caminho = url.pathname
    const ehApi = mesmaOrigem && caminho.startsWith('/api/')

    if (ehApi && metodo !== 'GET') {
      registrar(`${metodo} ${caminho} ${corpoRedigido(pedido.postData())}`)
    }

    if (pedido.isNavigationRequest()) {
      if (ehQuadroPrincipal(pedido)) {
        // `/api/*` fica de fora daqui: o PDF que `baixarDocCard` puxa tambem e pedido
        // de navegacao do quadro principal, e responder o tostao a ele mataria o
        // download antes de o evento existir.
        if (!ehApi && ehTela(caminho) && caminho !== caminhoDaTela) {
          // Deixar sair puxaria as fixtures de outra tela; `abort()` deixaria a
          // pagina em `chrome-error://` e destruiria o DOM do passo. Um documento
          // proprio mantem a pagina valida e registra para onde ela ia.
          registrar(`-> ${caminho}`)
          await rota.fulfill({
            status: 200,
            contentType: 'text/html; charset=utf-8',
            body: tostao(caminho),
          })
          return
        }
      } else {
        registrar(`popup ${caminho}`)
      }
    }

    if (ehApi) {
      const chave = chaveDe(metodo, url)
      const fixture = acharFixture(fixtures, chave)
      if (fixture === null) {
        if (!faltando.includes(chave)) faltando.push(chave)
        await rota.fulfill({ status: 599 })
        return
      }
      await rota.fulfill({
        status: fixture.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(fixture.corpo),
      })
      return
    }

    if (mesmaOrigem && caminho.startsWith('/docs/')) {
      const ext = extensao(caminho)
      if (ext !== '.svg' && ext !== '.pdf') {
        registrar(`bloqueado ${pedido.url()}`)
        await rota.abort()
        return
      }
      const corpo = await arquivoDoDisco(RAIZ + caminho.slice(1))
      if (corpo === null) {
        await rota.fulfill({ status: 404 })
        return
      }
      await rota.fulfill({
        status: 200,
        contentType: ext === '.svg' ? 'image/svg+xml' : 'application/pdf',
        body: Buffer.from(corpo),
      })
      return
    }

    if (pedido.url() === CHART_CDN) {
      const corpo = await arquivoDoDisco(`${RAIZ}apps/web/node_modules/chart.js/dist/chart.umd.js`)
      if (corpo === null) {
        await rota.fulfill({ status: 404 })
        return
      }
      await rota.fulfill({
        status: 200,
        contentType: 'text/javascript; charset=utf-8',
        body: Buffer.from(corpo),
      })
      return
    }

    if (mesmaOrigem) {
      const ext = extensao(caminho)
      const corpo = ext === '' ? null : await arquivoDoDisco(`${dist}${caminho}`)
      if (corpo === null) {
        await rota.fulfill({ status: 404 })
        return
      }
      await rota.fulfill({
        status: 200,
        contentType: TIPOS[ext] ?? 'application/octet-stream',
        body: Buffer.from(corpo),
      })
      return
    }

    registrar(`bloqueado ${pedido.url()}`)
    await rota.abort()
  }

  await contexto.route('**/*', async (rota) => {
    emVoo++
    try {
      await servir(rota)
    } finally {
      emVoo--
    }
  })

  pagina.on('dialog', (caixa) => {
    registrar(`${caixa.type()} ${caixa.message()}`)
    void caixa.accept(caixa.type() === 'prompt' ? '' : undefined).catch(() => {})
  })

  pagina.on('download', (baixado) => {
    let de = baixado.url()
    try {
      de = new URL(de).pathname
    } catch {
      // URL de blob ou data nao tem caminho; o que sobra ja identifica a origem.
    }
    registrar(`download ${baixado.suggestedFilename()} de ${de}`)
    void baixado.delete().catch(() => {})
  })

  // O efeito do popup ja foi registrado pela rota, com o caminho. Aqui so guardamos
  // a pagina para fechar no fim do passo, porque `url()` do evento chega vazio.
  pagina.on('popup', (aberta) => {
    popups.push(aberta)
  })

  const assentar = async (onde: string): Promise<void> => {
    const limite = Date.now() + TETO_MS
    let ultimaRede = Date.now()
    let ultimoEfeito = Date.now()
    let quantos = efeitos.length
    for (;;) {
      if (emVoo > 0) ultimaRede = Date.now()
      if (efeitos.length !== quantos) {
        quantos = efeitos.length
        ultimoEfeito = Date.now()
      }
      const agora = Date.now()
      // O evento de download chega depois da resposta, entao rede parada sozinha
      // fecharia o passo antes do efeito existir.
      if (agora - ultimaRede >= REDE_PARADA_MS && agora - ultimoEfeito >= EFEITO_PARADO_MS) break
      if (agora > limite) throw new Error(`o palco nao assentou em ${TETO_MS} ms (${onde})`)
      await dormir(20)
    }
    while (popups.length > 0) {
      const aberta = popups.pop()
      if (aberta !== undefined && !aberta.isClosed()) await aberta.close()
    }
  }

  return {
    page: pagina,
    efeitos: () => Object.freeze([...efeitos]),
    limparEfeitos: () => {
      efeitos.length = 0
    },
    faltando: () => Object.freeze([...faltando]),
    usarFixtures: (novas) => {
      fixtures = novas
    },
    assentar,
    fechar: () => contexto.close(),
  }
}
