/**
 * A maior tela das sete, e a unica em que a sessao decide o que a pagina mostra antes
 * de qualquer clique: `GET /api/sessao` roda no `DOMContentLoaded`, e so depois disso
 * o formulario aparece. A fixture usa a Livia real (administradora, sem base fixa),
 * entao o passo `inicial` fecha com o aviso "selecione uma base" na tela e o
 * formulario escondido — e o `base-raposa-selecionada` que revela tudo, exatamente
 * como uma administradora usaria a tela.
 *
 * Quatro tipos de registro dividem o formulario (viagem, abastecimento, manutencao,
 * quebra), e os passos `tipo-*` trocam entre os quatro por cima de campos ja
 * preenchidos nos passos anteriores: `selecionarTipo` so alterna qual `<div>` aparece,
 * nao limpa nada, entao voltar para "viagem" no passo `tipo-viagem` reencontra o
 * formulario como ele estava.
 *
 * O que foi acrescentado a mao na fixture, e por que. A branch `porte-react` nao tinha
 * nenhum registro: `GET /api/registros?base=Raposa` viria vazio, e nem o Historico do
 * dia nem `renderizarHistorico` desenhariam os quatro modelos de linha. Os quatro
 * registros acrescentados — um de cada tipo, todos datados de hoje (`agora` do
 * roteiro) — cobrem essa lacuna. `POST /api/registros`, o `DELETE` de `limparHoje` e o
 * `PUT /api/usuarios` nao existem na base real pelo mesmo motivo dos outros dois
 * roteiros desta leva: sao a forma da resposta, escrita a mao. `GET /api/usuarios` e
 * `POST /api/sair` saem do servidor de verdade.
 */
import { lerFixtures, type Roteiro } from '../palco.ts'

/**
 * O botao de um tipo de registro. Os quatro passos `tipo-*` miravam
 * `[onclick*="selecionarTipo('x'"]`, e o porte apaga esse atributo. O rotulo que a
 * pessoa le mora no `.tipo-nome` de dentro do botao, e e por ele que o botao sai. O
 * texto do botao inteiro nao serve: ele traz junto o emoji do `.tipo-ico`.
 */
function botaoDeTipo(nome: string): string {
  return `.tipo-grid button:has(.tipo-nome:text-is("${nome}"))`
}

/**
 * O item da lateral, achado pelo rotulo. Os tres que miravam `[onclick="f()"]` sao
 * unicos pelo texto, e `.nav > .nav-item` deixa de fora o de Administracao, que esta
 * dentro de `#menuAdmin` e sai pelo proprio id.
 */
function itemDaLateral(rotulo: string): string {
  return `.nav > .nav-item:has-text("${rotulo}")`
}

export const formularioRegistro: Roteiro = {
  tela: 'formulario-registro',
  url: '/formulario-registro.html',
  agora: '2026-09-02T12:00:00-03:00',
  fixtures: await lerFixtures('formulario-registro'),
  passos: [
    {
      nome: 'inicial',
      cobre: [],
      agir: async () => {},
    },
    {
      nome: 'base-raposa-selecionada',
      cobre: ['selecionarBase'],
      agir: async (p) => {
        await p.click('#btnRaposa')
      },
    },
    {
      nome: 'tipo-abastecimento',
      cobre: ['selecionarTipo'],
      agir: async (p) => {
        await p.click(botaoDeTipo('Abastecimento'))
      },
    },
    {
      nome: 'viagem-longa-marcada',
      cobre: ['onToggleViagemLonga'],
      agir: async (p) => {
        await p.check('#a_viagem_longa')
      },
    },
    {
      nome: 'abastecimento-totais',
      cobre: ['calcularTotaisAbastecimento'],
      agir: async (p) => {
        await p.fill('#a_litros_1', '180.5')
        await p.fill('#a_vl_litro_1', '5.899')
        await p.fill('#a_km_1', '48520')
      },
    },
    {
      nome: 'slot-adicionado',
      cobre: ['adicionarSlotAbastecimento'],
      agir: async (p) => {
        await p.click('#a_btn_adicionar')
      },
    },
    {
      nome: 'rota-local-selecionada',
      cobre: ['onRotaAbastecimentoChange'],
      agir: async (p) => {
        await p.selectOption('#a_rota', 'IMPERATRIZ')
      },
    },
    {
      nome: 'tipo-manutencao',
      cobre: [],
      agir: async (p) => {
        await p.click(botaoDeTipo('Manutenção'))
      },
    },
    {
      nome: 'manutencao-corretiva',
      cobre: ['selecionarTipoManutencao'],
      agir: async (p) => {
        await p.click('#btnCorretiva')
      },
    },
    {
      nome: 'tipo-quebra',
      cobre: [],
      agir: async (p) => {
        await p.click(botaoDeTipo('Quebra'))
      },
    },
    {
      nome: 'tipo-viagem',
      cobre: [],
      agir: async (p) => {
        await p.click(botaoDeTipo('Viagem'))
      },
    },
    {
      nome: 'custo-viagem-calculado',
      cobre: ['calcularCustoViagem'],
      agir: async (p) => {
        await p.fill('#v_combustivel', '800')
        await p.fill('#v_diarias', '100')
      },
    },
    {
      nome: 'registro-enviado',
      cobre: ['registrar'],
      agir: async (p) => {
        await p.fill('#v_motorista', 'Gabriel Reis Costa')
        await p.fill('#v_veiculo', 'PTV0006')
        await p.fill('#v_rota', 'PINHEIRO')
        await p.fill('#v_valor_carga', '12000')
        await p.click('.btn-registrar')
      },
    },
    {
      nome: 'dados-exportados',
      cobre: ['exportarDados'],
      agir: async (p) => {
        await p.click(itemDaLateral('Exportar dados'))
      },
    },
    {
      nome: 'historico-limpo',
      cobre: ['limparHoje'],
      agir: async (p) => {
        await p.click(itemDaLateral('Limpar histórico'))
      },
    },
    {
      nome: 'usuarios-modal-aberto',
      cobre: ['abrirGerenciarUsuarios'],
      agir: async (p) => {
        await p.click('#menuAdmin .nav-item')
      },
    },
    {
      nome: 'usuarios-modal-fechado',
      cobre: ['fecharModal'],
      agir: async (p) => {
        await p.click('.modal-close')
      },
    },
    {
      nome: 'usuarios-salvos',
      cobre: ['salvarUsuarios'],
      agir: async (p) => {
        await p.click('#menuAdmin .nav-item')
        await p.fill('#edit_nome_livia', 'Livia Lima')
        await p.click('.btn-salvar')
      },
    },
    {
      nome: 'logout',
      cobre: ['fazerLogout'],
      agir: async (p) => {
        await p.click('.btn-logout')
      },
    },
  ],
}
