/**
 * O roteiro de `integracao-frota`. Leia `documentos-frota.ts` para o modelo geral;
 * aqui vao so as escolhas de estado especificas desta tela.
 *
 * A tela guarda dois estados em memoria que sobrevivem entre passos: `funcaoAtual`
 * (motorista ou ajudante, cada um com seu proprio programa de 45 dias) e `progresso`
 * (o que foi marcado, por codigo de atividade). Os passos seguem um fluxo de uso
 * real: escolher colaborador, marcar atividade, salvar, carregar um registro salvo,
 * trocar de funcao, imprimir. Cada um comeca do estado que o anterior deixou.
 *
 * O que foi acrescentado a mao na fixture, e por que. `GET /api/integracoes/catalogo`
 * ficou como veio do `porte-react`: colaboradores e os dois programas de 45 dias sao
 * dado real, sem ramo escondido. `GET /api/integracoes` veio vazio da base, porque
 * ninguem salvou uma ficha ainda na branch de teste, e um historico vazio esconde
 * tres coisas que a tela desenha diferente: a cor "completo" (verde), a cor "parcial"
 * (laranja) e o proprio `carregarRegistro`, que nao tem o que carregar sem uma
 * entrada. Dois registros foram escritos a mao:
 *   1. Um de Alejandro Marques Alves (ajudante), com as 24 atividades do programa de
 *      ajudante marcadas `feito: true`. E o caso "completo", 100%.
 *   2. Um de Gabriel Reis Costa (motorista), com so as 6 atividades da semana 1
 *      marcadas. E o caso "parcial", 26%.
 * Os dois usam nomes e cargos do catalogo real para o texto do card bater com o
 * colaborador de verdade. `POST /api/integracoes` tambem nao veio da captura, porque
 * gravar-fixtures.ts so faz GET: e a resposta que `salvarProgresso` recebe ao criar a
 * ficha de Adinaldo de Souza de Jesus (motorista) no passo `progresso-salvo`, com
 * so a atividade `m1a` marcada, a mesma que o passo anterior marcou na tela.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

export const integracaoFrota: Roteiro = {
  tela: 'integracao-frota',
  url: '/integracao-frota.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('integracao-frota'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'colaborador-selecionado',
      cobre: ['selecionarColaborador'],
      agir: async (p) => {
        await p.selectOption('#f_select_colab', '7b5158f1-076d-51a5-b8df-f8315b06b76e')
      },
    },
    {
      nome: 'atividade-marcada',
      cobre: ['toggleAtividade'],
      agir: async (p) => {
        await p.click('#chk_m1a')
      },
    },
    {
      nome: 'progresso-salvo',
      cobre: ['salvarProgresso'],
      agir: async (p) => {
        await p.click('.btn-salvar')
      },
    },
    {
      nome: 'registro-carregado',
      cobre: ['carregarRegistro'],
      agir: async (p) => {
        await p
          .locator('.hist-item', { hasText: 'Alejandro Marques Alves' })
          .locator('.btn-carregar')
          .click()
      },
    },
    {
      nome: 'funcao-motorista',
      cobre: ['selecionarFuncao'],
      agir: async (p) => {
        await p.click('#btnMotorista')
      },
    },
    {
      // `f_nome`, `f_cargo` e `f_rh` ficaram vazios pelo passo anterior: `gerarPDF`
      // cai no fallback de cada um (linha pontilhada, titulo do programa, e o mesmo
      // pontilhado), que so aparece assim, sem preencher nada de proposito antes.
      nome: 'pdf-gerado',
      cobre: ['gerarPDF'],
      agir: async (p) => {
        await p.click('.btn-gerar')
      },
    },
  ],
}
