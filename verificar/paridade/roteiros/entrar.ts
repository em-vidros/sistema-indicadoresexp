/**
 * O roteiro de uma tela, e o modelo para os outros cinco que faltam.
 *
 * Um passo e uma interacao de gente e nada alem disso: clicar, digitar, escolher no
 * select, apertar tecla, largar arquivo no input. Chamar funcao do modulo por dentro
 * seria mais curto e provaria menos, porque e justo o caminho do atributo ate a
 * funcao que se rompe quando o script vira modulo, e foi assim que a fase 2 matou 28
 * handlers com a suite inteira verde.
 *
 * Os passos NAO sao independentes. Cada um comeca do estado que o anterior deixou,
 * como uma pessoa usando a tela de cima a baixo. Isso corta pela metade o numero de
 * passos, e o nome de cada um tem que deixar a ordem obvia.
 *
 * `cobre` lista os handlers de `handlers.txt` que aquele passo exercita. A uniao dos
 * `cobre` do roteiro tem que ser exatamente o conjunto do `handlers.txt`, senao a
 * prova reprova a si mesma. Handler que a tela tem e nenhum passo toca e um pedaco da
 * tela que pode quebrar no porte sem ninguem ficar sabendo.
 *
 * `esperaMs` e quanto o relogio congelado anda depois do `agir`, e o default de 3500
 * leva todo `setTimeout` da tela ao fim. Um passo so declara valor menor quando o que
 * ele quer ver e o estado intermediario, e aqui e o caso: `mostrarErro` esconde o
 * aviso 3 s depois, entao `erro` anda 500 ms para ver o aviso aceso e `erro-sumiu`
 * anda o resto para ver ele apagado.
 *
 * Quando usar `press('Enter')` em vez de `click()`: em telas com botao que transborda
 * a largura do card, o clique de mouse falha com "intercepts pointer events" porque o
 * card vizinho pinta por cima a 1440 px. Acao de teclado nao faz teste de acerto e
 * dispara o mesmo `onclick`. Nesta tela nao ha transbordo; o `press` do passo
 * `sucesso` esta ali por outro motivo, para exercitar o `onkeydown` do markup, que
 * chama o mesmo `fazerLogin` que o botao.
 *
 * O que foi acrescentado a mao na fixture: nada de dado. `entrar` nao faz nenhum GET,
 * entao o unico conteudo do arquivo e a resposta 401 do `POST /api/entrar`, escrita a
 * mao. O 200 nao mora no arquivo, ele entra pelo campo `fixtures` do passo `sucesso`,
 * porque a mesma chave precisa responder as duas coisas dentro do mesmo roteiro.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

export const entrar: Roteiro = {
  tela: 'entrar',
  url: '/entrar.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('entrar'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'erro',
      cobre: ['fazerLogin'],
      esperaMs: 500,
      agir: async (p) => {
        await p.fill('#loginUsuario', 'livia')
        await p.fill('#loginSenha', 'senha-errada')
        await p.click('.btn-login')
      },
    },
    {
      nome: 'erro-sumiu',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'sucesso',
      cobre: [],
      fixtures: { 'POST /api/entrar': { corpo: { ok: true } } },
      agir: async (p) => {
        await p.fill('#loginSenha', 'senha-certa')
        await p.press('#loginSenha', 'Enter')
      },
    },
    {
      nome: 'sucesso-com-destino',
      cobre: [],
      agir: async (p) => {
        // O pathname continua sendo `/entrar.html`, entao a rota deixa passar e serve
        // a tela de novo em vez de tratar como saida.
        await p.goto('http://paridade.local/entrar.html?destino=%2Fdashboard-semanal.html')
        await p.fill('#loginUsuario', 'livia')
        await p.fill('#loginSenha', 'senha-certa')
        await p.click('.btn-login')
      },
    },
  ],
}
