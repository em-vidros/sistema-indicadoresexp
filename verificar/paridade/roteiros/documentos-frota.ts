/**
 * O roteiro de uma tela, e o modelo para os outros cinco que faltam. Leia junto com
 * `entrar.ts`, que e o caso simples; aqui estao as partes chatas.
 *
 * Um passo e uma interacao de gente e nada alem disso: clicar, digitar, escolher no
 * select, largar arquivo no input. Chamar funcao do modulo por dentro seria mais
 * curto e provaria menos, porque e justo o caminho do atributo ate a funcao que se
 * rompe quando o script vira modulo, e foi assim que a fase 2 matou 28 handlers com
 * a suite inteira verde.
 *
 * Os passos NAO sao independentes. Cada um comeca do estado que o anterior deixou:
 * o modal so pode ser salvo depois de aberto, e o PDF so entra depois do modal. O
 * nome de cada passo tem que deixar a ordem obvia.
 *
 * `cobre` lista os handlers de `handlers.txt` que aquele passo exercita, e a uniao
 * dos `cobre` tem que ser exatamente o conjunto do arquivo. Os onze desta tela estao
 * distribuidos abaixo; sobra ou falta reprova a prova, nao a tela.
 *
 * `esperaMs` e quanto o relogio congelado anda depois do `agir`, e o default de 3500
 * leva todo `setTimeout` ao fim. So declare menor quando o que voce quer ver e o
 * estado intermediario, como o aviso de erro que some sozinho em `entrar.ts`. Aqui
 * nenhum passo precisa disso.
 *
 * `press('Enter')` em vez de `click()` nos botoes de `.doc-linha-btns`. Medido: a
 * 1440 px os tres botoes da linha transbordam a largura do `.doc-card` e o card
 * vizinho da grade pinta por cima, entao `page.click()` neles falha com "intercepts
 * pointer events". Acao de teclado nao faz teste de acerto e dispara o mesmo
 * `onclick`. Isso vale so para esses botoes; `button.btn-edit`, `.btn-salvar`,
 * `.btn-cancelar`, `.nav-item` e o `select` recebem clique de mouse normalmente.
 *
 * Os cards sao localizados por `.doc-card` mais o texto da placa ou do nome, e os
 * botoes pelo proprio `onclick`. As duas coisas sobrevivem a reordenacao da grade e
 * dizem em voz alta o que o passo esta apertando.
 *
 * O que foi acrescentado a mao na fixture, e por que. A base real nao exercita a
 * tela inteira: ela nao tem nenhum CRLV, nenhuma CNH e nenhum documento com arquivo
 * no servidor, entao tres ramos grandes da tela nunca desenhariam. Sobre a resposta
 * real de `GET /api/documentos` foram feitas cinco edicoes.
 *   1. `Tacógrafo PTV0006` ganhou `temArquivo: true`, `arquivoId`, `nomeArquivo` e
 *      vencimento 2026-09-20. E o unico documento com arquivo, e e dele que saem os
 *      botoes Ver e Baixar dos passos `doc-visto` e `doc-baixado`, apontando para
 *      `/api/documentos/<id>/arquivo` em vez de um link de Drive. O vencimento cai
 *      dentro dos 30 dias do tacografo, entao ele tambem e o caso "em alerta".
 *   2. `Apólice ROW3A87` ganhou `contatoEmergencia`, que acende a tarja amarela de
 *      sinistro. Sem ela nenhum card mostraria esse ramo, so o convite pontilhado.
 *   3. Um `crlv` novo para PTT0004, sem arquivo e sem link, vencendo em 2026-10-20.
 *      Ele e o CRLV que a base nao tem, e e a linha sem Ver nem Baixar do passo
 *      `doc-importado`.
 *   4 e 5. Duas `cnh` para os dois primeiros de `MOTORISTAS_RAPOSA`, uma com link de
 *      Drive e outra sem, para desenhar os dois lados do `<a>` "CNH" no card.
 * Os nomes de colaborador ficaram identicos aos do catalogo real porque o modulo casa
 * por nome com listas fixas dentro dele; trocar o nome apagaria o ramo. Os numeros de
 * CNH sao ficticios.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

/** O mesmo PDF de uma linha que a fase 4 usa. Serve para o upload ter um arquivo de verdade. */
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n')

export const documentosFrota: Roteiro = {
  tela: 'documentos-frota',
  url: '/documentos-frota.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('documentos-frota'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'veiculo-modal',
      cobre: ['abrirModalVeiculo'],
      agir: async (p) => {
        await p.locator('.doc-card', { hasText: 'PTV0006' }).locator('button.btn-edit').click()
      },
    },
    {
      nome: 'veiculo-pdf-escolhido',
      cobre: ['escolherArquivoDoc', 'onDocFileChange'],
      agir: async (p) => {
        // O botao so abre o seletor do `#segPdf`; quem escreve em `#segPdfNome` e o
        // `onchange` do input. Um passo so, porque separa-los nao provaria a ligacao.
        //
        // O `catch` vazio e para o caso em que o clique falha, que e o que acontece
        // quando a prova esta pegando um handler morto. Sem ele esta promessa fica
        // pendurada, rejeita sozinha depois, e o relatorio da mutacao sai enterrado
        // debaixo de um rastro de pilha que nao e o defeito.
        const escolha = p.waitForEvent('filechooser')
        escolha.catch(() => {})
        await p.click('button[onclick*="segPdf"]')
        await (await escolha).setFiles({
          name: 'apolice-PTV0006.pdf',
          mimeType: 'application/pdf',
          buffer: PDF,
        })
      },
    },
    {
      nome: 'veiculo-salvo',
      cobre: ['salvarDoc'],
      agir: async (p) => {
        await p.click('.btn-salvar')
      },
    },
    {
      nome: 'motorista-modal',
      cobre: ['abrirModalMotorista'],
      agir: async (p) => {
        await p
          .locator('.doc-card', { hasText: 'Gabriel Reis Costa' })
          .locator('button.btn-edit')
          .click()
      },
    },
    {
      nome: 'motorista-modal-fechado',
      cobre: ['fecharModalDoc'],
      agir: async (p) => {
        await p.click('.btn-cancelar')
      },
    },
    {
      nome: 'doc-visto',
      cobre: ['verDocCard'],
      agir: async (p) => {
        await p.locator(`[onclick*="verDocCard('PTV0006','tacografo')"]`).press('Enter')
      },
    },
    {
      nome: 'doc-baixado',
      cobre: ['baixarDocCard'],
      agir: async (p) => {
        await p.locator(`[onclick*="baixarDocCard('PTV0006','tacografo')"]`).press('Enter')
      },
    },
    {
      nome: 'doc-importado',
      cobre: ['importarDocCard', 'onDocCardChange'],
      agir: async (p) => {
        const escolha = p.waitForEvent('filechooser')
        await p.locator(`[onclick*="importarDocCard('PTT0004','crlv')"]`).press('Enter')
        await (await escolha).setFiles({
          name: 'crlv-PTT0004.pdf',
          mimeType: 'application/pdf',
          buffer: PDF,
        })
      },
    },
    {
      nome: 'base-trocada',
      cobre: ['renderTudo'],
      agir: async (p) => {
        await p.selectOption('#filtroBase', 'Imperatriz')
      },
    },
  ],
}
