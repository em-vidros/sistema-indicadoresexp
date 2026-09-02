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
import { abrirNavegador, montarPalco, ORIGEM } from './paridade/palco.ts'
import { ROTEIROS } from './paridade/roteiros/todos.ts'

const FOTO = `${process.cwd()}/var/graficos.png`

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
  console.log(`\nfoto em ${FOTO}`)
} finally {
  await palco.fechar()
  await navegador.close()
}
