/**
 * O roteiro de `dashboard-semanal`. Leia `documentos-frota.ts` para o modelo geral;
 * aqui vao so as escolhas de estado especificas desta tela.
 *
 * A tela nao pede nada ao carregar alem de `GET /api/registros`: filtro de base,
 * filtro de periodo e a troca entre KPIs/Viagens/Frota sao tudo local, contra o
 * mesmo array em memoria (`_dadosCache`). Os cinco handlers ficam expostos por
 * atributo `onclick`/`onchange`, entao cada passo clica ou seleciona de verdade em
 * vez de chamar a funcao do modulo, pelo mesmo motivo do `documentos-frota.ts`.
 *
 * Nenhum seletor daqui olha para `onclick`. Os itens da lateral sao achados pelo texto
 * que a pessoa le, e nao pelo atributo, porque o porte apaga o atributo: um seletor que
 * dependesse dele passaria a nao achar nada e o passo reprovaria por causa da prova, e
 * nao da tela.
 *
 * O relogio congela em quarta-feira 2026-09-02, e a semana corrente (filtro padrao
 * "Esta Semana") comeca na segunda 2026-08-31 sem teto superior: qualquer data a
 * partir dali entra. Os dez registros da fixture ficam todos entre 31/08 e 02/09,
 * entao o passo `inicial` ja mostra os cartoes e as duas tabelas com conteudo, sem
 * precisar trocar filtro para ver algo.
 *
 * O que foi acrescentado a mao na fixture, e por que. A captura devolveu
 * `GET /api/registros: []`: a branch de teste nao tem nenhum registro na semana
 * corrente, e um dashboard vazio nao desenha nenhum dos tres estados de KPI (verde,
 * amarelo, vermelho) nem preenche os graficos ou as tabelas. Dez registros foram
 * escritos a mao, quatro viagens, duas manutencoes, dois abastecimentos e duas
 * quebras, com as bases Raposa e Imperatriz misturadas, para as faixas ficarem
 * assim (ver `montar-fixtures.ts`, que fez a conta em vez de acertar o numero a
 * olho):
 *   - % Custo/Carga: 6,79% do total, cartao verde (< 7%). Por rota fica variado: a
 *     Raposa-Imperatriz e a Imperatriz-Bacabal ficam verdes, a Imperatriz-Timon fica
 *     amarela e a Raposa-Barra do Corda fica vermelha, entao a tabela "Por Rota" e a
 *     de "Viagens" mostram os tres selos mesmo com o cartao do topo verde.
 *   - % Manutencao/Producao: 3,33% do total, cartao vermelho (>= 3%).
 *   - % Quebra Expedicao: 1,50% do total, cartao amarelo (entre 1% e 2%).
 *   - Pontualidade: das quatro viagens, tres tem `atraso_min` (a quarta fica sem
 *     previsao, que e o "-" da tabela) e uma delas passa dos 15 min de tolerancia,
 *     dando 33% de atraso e cartao amarelo (> 5%).
 * As quatro cores dos cartoes de topo (verde, vermelho, amarelo, amarelo) e as tres
 * dos selos por linha cobrem as faixas que a tela desenha diferente. Motorista,
 * veiculo e fornecedor sao ficticios; datas e valores sao os unicos que importam.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

export const dashboardSemanal: Roteiro = {
  tela: 'dashboard-semanal',
  url: '/dashboard-semanal.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('dashboard-semanal'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'atualizado-manual',
      cobre: ['atualizarDados'],
      agir: async (p) => {
        await p.locator('.nav-item', { hasText: 'Atualizar' }).click()
      },
    },
    {
      // So a base Raposa: sobra a viagem verde e a vermelha, a manutencao, o
      // abastecimento e a quebra da Raposa. O total de registros cai de 10 para 5.
      nome: 'base-filtrada',
      cobre: ['atualizar'],
      agir: async (p) => {
        await p.selectOption('#filtroBase', 'Raposa')
      },
    },
    {
      nome: 'tela-viagens',
      cobre: ['mostrarTela'],
      agir: async (p) => {
        await p.locator('.nav-item', { hasText: 'Viagens' }).click()
      },
    },
    {
      // O relatorio sai por `URL.createObjectURL(new Blob(...))`, e o palco grava o
      // texto baixado em vez da URL, que carrega um UUID sorteado por chamada. O
      // efeito deste passo e o relatorio inteiro, linha por linha.
      nome: 'relatorio-gerado',
      cobre: ['gerarRelatorio'],
      agir: async (p) => {
        await p.click('.btn-top:has-text("Relatório .txt")')
      },
    },
    {
      // Mil milissegundos ficam abaixo dos 3 s do `setTimeout` que devolve o botao ao
      // rotulo original, entao este passo pega o botao ainda destacado. O efeito traz
      // a mensagem inteira, que e o que `copiarWhatsApp` produz de verdade.
      nome: 'whatsapp-copiado',
      cobre: ['copiarWhatsApp'],
      esperaMs: 1000,
      agir: async (p) => {
        await p.click('#btnWpp')
      },
    },
    {
      // Ninguem age. O relogio passa dos 3 s e o botao se desfaz sozinho, e sem um
      // passo depois do prazo esse retorno nao seria comparado com nada.
      nome: 'whatsapp-revertido',
      cobre: ['copiarWhatsApp'],
      agir: async () => {},
    },
  ],
}
