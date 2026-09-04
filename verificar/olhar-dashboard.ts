/**
 * Isto NAO e uma prova. Nada aqui reprova nada, e nenhum script chama este arquivo.
 *
 * As telas do painel foram redesenhadas em 2026-09-03 contra o canvas de
 * `var/design-dashboard/`, e o dashboard saiu da paridade no mesmo commit: comparar a tela
 * nova com uma baseline gravada antes do redesenho nao produz divergencia para investigar,
 * so uma tela inteira diferente. O motivo esta em `verificar/paridade/roteiros/todos.ts`.
 *
 * O que sai de uma prova precisa ganhar outra coisa no lugar, senao a regiao vira ponto
 * cego. O que ficou no lugar e um par de olhos, e esta e a ferramenta deles. Monta a tela
 * no mesmo palco da paridade, com a mesma fixture e o mesmo relogio congelado, em 1440 de
 * largura, e fotografa a pagina inteira:
 *
 *   bun verificar/olhar-dashboard.ts
 *
 * Rode depois de mexer no desenho, e olhe a foto ao lado do artboard. Os artboards saem de
 * `cd var/design-dashboard && node build.mjs`.
 *
 * ----------------------------------------------------------------------------------------
 * A fixture, e por que ela e escrita a mao
 *
 * `verificar/paridade/fixtures/dashboard-semanal.json` continua no lugar, e o roteiro que
 * a explicava foi apagado junto com a prova. A justificativa dele vem para ca, porque quem
 * mexer nos numeros precisa dela.
 *
 * O relogio congela em quarta-feira 2026-09-02, e a semana corrente (filtro padrao "Esta
 * semana") comeca na segunda 2026-08-31 sem teto superior: qualquer data a partir dali
 * entra. Os dez registros ficam todos entre 31/08 e 02/09, entao a tela ja abre com os
 * cartoes, o grafico e a tabela cheios, sem precisar trocar filtro para ver algo.
 *
 * A captura contra a branch de teste devolvia `GET /api/registros: []`: nao ha registro na
 * semana corrente por la, e um dashboard vazio nao desenha nenhuma das faixas de KPI nem
 * preenche grafico ou tabela. Os dez registros foram escritos a mao, quatro viagens, duas
 * manutencoes, dois abastecimentos e duas quebras, com Raposa e Imperatriz misturadas, para
 * as faixas ficarem assim:
 *   - % Custo/Carga: 6,79% do total, dentro da meta (< 7%). Por rota fica variado: a
 *     Raposa-Imperatriz e a Imperatriz-Bacabal ficam verdes, a Imperatriz-Timon fica
 *     amarela e a Raposa-Barra do Corda fica vermelha, entao a tabela de rotas mostra os
 *     tres selos mesmo com o cartao do topo verde.
 *   - % Manutencao/Producao: 3,33% do total, fora da meta (>= 3%).
 *   - % Quebra Expedicao: 1,50% do total, em atencao (entre 1% e 2%).
 *   - Pontualidade: das quatro viagens, tres tem `atraso_min` (a quarta fica sem previsao)
 *     e uma passa dos 15 min de tolerancia, dando 33% de atraso, acima da meta de 5%.
 * Motorista, veiculo e fornecedor sao ficticios; datas e valores sao os unicos que importam.
 *
 * ----------------------------------------------------------------------------------------
 * As outras tres telas do painel entram nesta lista quando existirem.
 */
import { abrirNavegador, lerFixtures, montarPalco, ORIGEM } from './paridade/palco.ts'
import type { Roteiro } from './paridade/palco.ts'

type Pagina = { readonly nome: string; readonly url: string }

const PAGINAS: readonly Pagina[] = [
  { nome: 'geral', url: '/dashboard-semanal.html' },
]

/**
 * O roteiro minimo mora aqui e nao em `roteiros/`, porque `roteiros/` e o registro do que a
 * paridade cobra, e nada aqui e cobrado. Um passo, que nao age: a foto e da tela parada.
 */
const roteiro: Roteiro = {
  tela: 'dashboard-semanal',
  url: PAGINAS[0]?.url ?? '/dashboard-semanal.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('dashboard-semanal'),
  passos: [{ nome: 'inicial', cobre: [], agir: async () => {} }],
}

const navegador = await abrirNavegador()
const palco = await montarPalco(navegador, roteiro, `${process.cwd()}/apps/web/dist`)
try {
  await palco.page.setViewportSize({ width: 1440, height: 1080 })
  for (const pagina of PAGINAS) {
    const foto = `${process.cwd()}/var/olhar-dashboard-${pagina.nome}.png`
    await palco.page.goto(ORIGEM + pagina.url)
    await palco.assentar(pagina.nome)
    // Sem isto a foto pega a tela desenhada com a fonte de sistema, e cada medida de
    // largura da pagina sai errada.
    await palco.page.evaluate(() => document.fonts.ready)
    await palco.page.screenshot({ path: foto, fullPage: true })
    console.log(`${pagina.nome}: ${foto}`)
  }

  const faltando = palco.faltando()
  if (faltando.length > 0) console.log(`fixtures que a tela pediu e nao existem: ${faltando.join(', ')}`)
} finally {
  await palco.fechar()
  await navegador.close()
}
