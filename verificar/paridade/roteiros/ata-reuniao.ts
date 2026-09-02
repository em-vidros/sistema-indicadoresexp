/**
 * Dezessete handlers, tres deles em torno de PDF: `gerarPDF`/`downloadPDF` disparam
 * impressao e download, `anexarPDF`/`anexarParaAta` sobem arquivo pelo mesmo input
 * escondido (`#inputPDF`), so que um a partir da barra superior e o outro a partir de
 * um card do historico. Os dois levam ao mesmo `onchange`, entao os dois passos que os
 * cobrem usam o mesmo `waitForEvent('filechooser')` + `setFiles`.
 *
 * A ata que a tela grava (`gerarPDF`) e a ata que ela importa (`salvarImportadas`)
 * respondem pela MESMA chave de fixture `POST /api/atas`, porque o palco nao tem
 * estado: uma URL sempre devolve a mesma coisa. Por isso as oito atas que o modal de
 * importar pre-carrega (uma por mes) teriam ido para o historico com o id e o titulo
 * identicos se todas fossem salvas; o passo `importadas-salvas` reabre o modal e limpa
 * sete das oito linhas antes de salvar, deixando so Janeiro, para o historico final
 * nao virar oito cartoes iguais.
 *
 * O que foi acrescentado a mao na fixture, e por que. `GET /api/atas/catalogo` e
 * `GET /api/atas` saem exatamente do servidor de dev (branch `porte-react`); a base ja
 * tinha uma ata de verdade la ("Ata da prova da fase 4", com PDF), que vira o alvo do
 * passo `ata-excluida`. O resto — `POST /api/atas`, `POST` e `GET` de
 * `/api/atas/<id>/pdf` — nao existe na base real porque nenhuma ata foi gerada por
 * este roteiro antes dele rodar; sao as respostas que o servidor daria se desse.
 *
 * Nenhum seletor daqui olha para `onclick`, pelo mesmo motivo do `documentos-frota.ts`:
 * o porte apaga o atributo e um seletor preso a ele passaria a nao achar nada, entao o
 * passo reprovaria por causa da prova e nao da tela. Os dois cartoes do historico ficam
 * separados pelo titulo que a pessoa le, e nao pelo id da ata, que nem chega ao DOM.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

const PDF = Buffer.from('%PDF-1.4\n%%EOF\n')

/** A ata que o passo `pdf-gerado` grava, achada pelo titulo que ele mesmo digitou. */
const TITULO_NOVA = 'Alinhamento Equipe Expedição Setembro'
/** A ata de verdade que ja estava na base antes deste roteiro rodar. */
const TITULO_ORIGINAL = 'Ata da prova da fase 4'

export const ataReuniao: Roteiro = {
  tela: 'ata-reuniao',
  url: '/ata-reuniao.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('ata-reuniao'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'topico-adicionado',
      cobre: ['adicionarTopico'],
      agir: async (p) => {
        await p.click('.btn-add-topico')
      },
    },
    {
      nome: 'topico-removido',
      cobre: ['removerTopico'],
      agir: async (p) => {
        // Escopo no `#topico_2` porque `.btn-remover` tambem e o ✕ do participante extra.
        await p.click('#topico_2 .btn-remover')
      },
    },
    {
      nome: 'colaborador-marcado',
      cobre: ['atualizarMarcado'],
      agir: async (p) => {
        await p.locator('#checkMotoristas input[type="checkbox"]').first().check()
      },
    },
    {
      nome: 'todos-marcados',
      cobre: ['marcarTodos'],
      agir: async (p) => {
        // Com o ✔, senao "✕ Desmarcar todos" tambem casa: `hasText` e substring.
        await p.locator('.btn-add', { hasText: '✔ Marcar todos' }).click()
      },
    },
    {
      nome: 'participante-extra',
      cobre: ['adicionarParticipanteExtra'],
      agir: async (p) => {
        await p.locator('.btn-add', { hasText: '+ Adicionar externo' }).click()
      },
    },
    {
      nome: 'pdf-gerado',
      cobre: ['gerarPDF'],
      agir: async (p) => {
        await p.fill('#f_titulo', TITULO_NOVA)
        await p.locator('.btn-gerar', { hasText: 'Gerar PDF para Assinatura' }).click()
      },
    },
    {
      nome: 'pdf-anexado',
      cobre: ['anexarPDF'],
      agir: async (p) => {
        const escolha = p.waitForEvent('filechooser')
        escolha.catch(() => {})
        await p.click('#btnAnexar')
        await (await escolha).setFiles({ name: 'ata-assinada.pdf', mimeType: 'application/pdf', buffer: PDF })
      },
    },
    {
      nome: 'historico-visto',
      cobre: ['switchTab'],
      agir: async (p) => {
        await p.click('#tabBtnHist')
      },
    },
    {
      nome: 'pdf-substituido',
      cobre: ['anexarParaAta'],
      agir: async (p) => {
        const escolha = p.waitForEvent('filechooser')
        escolha.catch(() => {})
        await p.locator('.hist-card', { hasText: TITULO_NOVA }).getByText('Substituir PDF').click()
        await (await escolha).setFiles({ name: 'ata-substituida.pdf', mimeType: 'application/pdf', buffer: PDF })
      },
    },
    {
      nome: 'ata-baixada',
      cobre: ['downloadPDF'],
      agir: async (p) => {
        await p.locator('.hist-card', { hasText: TITULO_NOVA }).locator('.btn-hist.primary').click()
      },
    },
    {
      nome: 'ata-excluida',
      cobre: ['deletarAta'],
      agir: async (p) => {
        await p.locator('.hist-card', { hasText: TITULO_ORIGINAL }).locator('.btn-hist.danger').click()
      },
    },
    {
      nome: 'import-modal-aberto',
      cobre: ['abrirModalImportar'],
      agir: async (p) => {
        await p.locator('.btn-gerar', { hasText: 'Importar Atas Passadas' }).click()
      },
    },
    {
      nome: 'import-linha-adicionada',
      cobre: ['addImportRow'],
      agir: async (p) => {
        await p.locator('.btn-add', { hasText: '+ Adicionar linha' }).click()
      },
    },
    {
      nome: 'import-pdf-escolhido',
      cobre: ['escolherPDFImport', 'onPDFImportSelecionado'],
      agir: async (p) => {
        const escolha = p.waitForEvent('filechooser')
        escolha.catch(() => {})
        await p.click('#imp_1_pdfbtn')
        await (await escolha).setFiles({ name: 'ata-janeiro.pdf', mimeType: 'application/pdf', buffer: PDF })
      },
    },
    {
      nome: 'import-modal-fechado',
      cobre: ['fecharModalImportar'],
      agir: async (p) => {
        await p.click('.btn-modal-cancel')
      },
    },
    {
      nome: 'importadas-salvas',
      cobre: ['salvarImportadas'],
      agir: async (p) => {
        // Reabre do zero (`abrirModalImportar` limpa as linhas e recria as oito do
        // ano), e so entao esvazia data e titulo de sete delas: `salvarImportadas`
        // pula linha sem os dois campos, entao so Janeiro chega a salvar.
        await p.locator('.btn-gerar', { hasText: 'Importar Atas Passadas' }).click()
        const linhas = p.locator('#importRows .import-row')
        const total = await linhas.count()
        for (let i = 1; i < total; i++) {
          const linha = linhas.nth(i)
          await linha.locator('input[type="date"]').fill('')
          await linha.locator('input[type="text"]').first().fill('')
        }
        await p.click('.btn-modal-save')
      },
    },
  ],
}
