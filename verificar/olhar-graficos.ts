/**
 * Isto NAO e uma prova. Nada aqui reprova nada, e nenhum script chama este arquivo.
 *
 * O desenho dos dois graficos do dashboard saiu da comparacao em 2026-09-02, quando eles
 * passaram de Chart.js para Recharts. `verificar/paridade/fora-da-prova.ts` diz o porque.
 * O que sai de uma prova precisa ganhar outra coisa no lugar, senao a regiao vira ponto
 * cego: a paridade fica verde do mesmo jeito com o grafico certo, com o grafico errado e
 * com nenhum grafico.
 *
 * O que ficou no lugar e um par de olhos, e esta e a ferramenta deles. Abre a tela no
 * mesmo palco da paridade, com as mesmas fixtures e o mesmo relogio congelado, fotografa
 * os dois cartoes e imprime o que cada `.chart-wrap` tem dentro.
 *
 * Rode depois de mexer em qualquer um dos dois graficos, e olhe a foto:
 *   bun verificar/olhar-graficos.ts
 *
 * Ja pegou coisa que a prova nao pegaria. A legenda do donut saiu na ordem errada porque
 * o `itemSorter` do Recharts ordena por valor por padrao e o Chart.js nao ordenava.
 */
import type { Locator } from 'playwright'
import { abrirNavegador, montarPalco, ORIGEM } from './paridade/palco.ts'
import { ROTEIROS } from './paridade/roteiros/todos.ts'

const FOTO = `${process.cwd()}/var/graficos.png`
const FOTO_AREA = `${process.cwd()}/var/graficos-tooltip-area.png`
const FOTO_PIZZA = `${process.cwd()}/var/graficos-tooltip-pizza.png`

const roteiro = ROTEIROS.find((r) => r.tela === 'dashboard-semanal')
if (roteiro === undefined) throw new Error('sem roteiro de dashboard-semanal')

const navegador = await abrirNavegador()
const palco = await montarPalco(navegador, roteiro, `${process.cwd()}/apps/web/dist`)
try {
  await palco.page.goto(ORIGEM + roteiro.url)
  await palco.assentar('dashboard-semanal')
  await palco.page.clock.runFor(3500)
  await palco.assentar('dashboard-semanal')

  await palco.page.locator('.charts-grid').screenshot({ path: FOTO })

  // O `.chart-wrap` continua cobrado pela paridade e tem que sair so com a classe. Sai
  // aqui tambem porque quem esta olhando o grafico e quem vai mexer nele.
  const dentro = await palco.page.evaluate(() =>
    Array.from(document.querySelectorAll('.chart-wrap')).map((el) => ({
      atributos: Array.from(el.attributes).map((a) => `${a.name}="${a.value}"`),
      svg: el.querySelectorAll('svg').length,
      texto: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  )
  console.log(JSON.stringify(dentro, null, 2))

  // O balao so existe com o mouse em cima, entao a foto parada nao o mostra. Nenhum dos
  // dois aceita o `hover()` do Playwright, que mira o centro do bounding box: no setor do
  // donut esse centro cai no buraco do meio, e no ponto da area ele fica na borda direita
  // da plotagem. Entao o mouse vai a coordenada calculada, uma por forma.
  const cartoes = palco.page.locator('.chart-wrap')
  const olhar = async (cartao: Locator, x: number, y: number, rotulo: string) => {
    await palco.page.mouse.move(x, y)
    await palco.page.waitForTimeout(200)
    const texto = (await cartao.locator('.recharts-tooltip-wrapper').textContent()) ?? ''
    console.log(`${rotulo}: ${texto.replace(/\s+/g, ' ').trim()}`)
  }

  const area = cartoes.nth(0)
  const caixa = await area.boundingBox()
  if (caixa === null) throw new Error('sem caixa no cartao da area')

  // O circulo do ponto e a unica forma daqui cujo centro esta dentro dela mesma.
  const ponto = await area.locator('.recharts-dot').first().boundingBox()
  if (ponto === null) throw new Error('sem ponto no grafico de area')
  console.log('')
  await olhar(area, ponto.x + ponto.width / 2, ponto.y + ponto.height / 2, 'area, semana com carga')
  await area.screenshot({ path: FOTO_AREA })

  // A fixture so tem carga na semana corrente, entao as outras sete mostram o `—` que o
  // `filterNull={false}` deixa aparecer.
  await olhar(area, caixa.x + caixa.width * 0.2, caixa.y + caixa.height / 2, 'area, semana sem carga')

  // Um ponto sobre o anel, tirado do proprio path, porque o centro nao serve.
  const pizza = cartoes.nth(1)
  const anel = await pizza.evaluate((el) =>
    Array.from(el.querySelectorAll<SVGGeometryElement>('.recharts-sector')).map((setor) => {
      const svg = setor.ownerSVGElement
      const matriz = setor.getScreenCTM()
      if (svg === null || matriz === null) throw new Error('setor sem matriz de tela')
      const meio = setor.getPointAtLength(setor.getTotalLength() * 0.1)
      const p = svg.createSVGPoint()
      p.x = meio.x
      p.y = meio.y
      const tela = p.matrixTransform(matriz)
      return { x: tela.x, y: tela.y }
    }),
  )
  for (const [i, p] of anel.entries()) {
    await olhar(pizza, p.x, p.y, `pizza, fatia ${i}`)
    if (i === 0) await pizza.screenshot({ path: FOTO_PIZZA })
  }

  console.log(`\nfotos em ${FOTO}, ${FOTO_AREA} e ${FOTO_PIZZA}`)
} finally {
  await palco.fechar()
  await navegador.close()
}
