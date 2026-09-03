/**
 * Uma prova que nunca ficou vermelha nao provou nada. Cada linha aqui estraga a tela
 * de um jeito que a paridade TEM que pegar, e `--mutar` reprova se alguma passar.
 *
 * A revisao da fase 2 achou exatamente este buraco trocando `gap:5px` por `gap:50px`
 * num template do modal: a prova de entao passou verde. Sao tres familias. O pixel que
 * nasce dentro do modulo e nenhuma comparacao de arquivo enxerga. O handler que some e
 * transforma o botao em enfeite. E a regra de folha de estilo, que nao aparece no DOM e
 * so o `estilo.css` da baseline cobra.
 *
 * A segunda familia troca de forma no porte, e continua a mesma familia: antes o handler
 * caia fora do `Object.assign(window, ...)`, agora e uma prop `onClick` que da para
 * esquecer. Nos dois casos a tela abre, pinta certo, e o clique nao faz nada.
 *
 * A cada tela portada, a linha dela passa a apontar para o `.tsx` ou para o `.css`.
 */
import type { Tela } from './palco.ts'

export type Mutacao = {
  readonly tela: Tela
  /** Caminho a partir da raiz do repositorio. */
  readonly arquivo: string
  /** Tem que existir e aparecer uma unica vez, senao a mutacao para em erro. */
  readonly de: string
  readonly para: string
  /** O que a prova estaria deixando passar se esta mutacao nao reprovasse. */
  readonly motivo: string
}

export const MUTACOES: readonly Mutacao[] = [
  {
    tela: 'entrar',
    arquivo: 'apps/web/src/telas/entrar.css',
    de: '.login-box{background:#fff;border-radius:16px;padding:36px 40px;',
    para: '.login-box{background:#fff;border-radius:4px;padding:36px 40px;',
    motivo:
      'o canto da caixa de login deixa de ser redondo e nada no DOM muda; so o `estilo.css` da baseline pega, e sem esta linha essa comparacao nunca ficou vermelha',
  },
  {
    tela: 'entrar',
    arquivo: 'apps/web/src/telas/entrar.tsx',
    de: 'autoComplete="current-password"\n            onKeyDown={aoTeclar}',
    para: 'autoComplete="current-password"',
    motivo:
      'o Enter no campo de senha para de enviar o formulario; e a familia de defeito que o porte cria, porque o handler deixa de morar num atributo do markup e passa a ser uma prop que da para esquecer sem quebrar nada',
  },
  {
    tela: 'documentos-frota',
    arquivo: 'apps/web/src/telas/documentos-frota.tsx',
    de: "style={{ display: 'flex', gap: '6px' }}>",
    para: "style={{ display: 'flex', gap: '60px' }}>",
    motivo:
      'o espacamento dos botoes do manual mudou dez vezes de tamanho e ninguem declarou; e o pixel que nasce dentro do componente, que nenhuma comparacao de arquivo enxerga',
  },
  {
    tela: 'documentos-frota',
    arquivo: 'apps/web/src/telas/documentos-frota.tsx',
    de: 'btn-sm btn-edit" onClick={() => abrirModalVeiculo(pl)}',
    para: 'btn-sm btn-edit"',
    motivo:
      'o botao de vencimentos do card do veiculo para de abrir o modal; depois do porte o handler nao some mais de `window`, some de uma prop, e some do mesmo jeito calado',
  },
  {
    tela: 'integracao-frota',
    arquivo: 'apps/web/src/telas/integracao-frota.tsx',
    de: 'font-size:9pt;margin-bottom:16pt;line-height:1.5;',
    para: 'font-size:90pt;margin-bottom:16pt;line-height:1.5;',
    motivo:
      'o paragrafo do termo de ciente no PDF de impressao cresce dez vezes e ninguem declarou; nasce dentro do modulo, em `gerarPDF`, e nenhuma comparacao de arquivo enxerga',
  },
  {
    tela: 'integracao-frota',
    arquivo: 'apps/web/src/telas/integracao-frota.tsx',
    de: 'id="btnMotorista" onClick={() => selecionarFuncao(\'motorista\')}',
    para: 'id="btnMotorista"',
    motivo:
      'a aba Motorista para de trocar de programa; o clique nao muda a funcao, a subarvore das semanas nao remonta, e a ficha do ajudante que estava aberta continua na tela como se nada tivesse sido pedido',
  },
  {
    tela: 'dashboard-semanal',
    arquivo: 'apps/web/src/telas/dashboard-semanal.tsx',
    de: "'nav-item ativo' : 'nav-item'} onClick={() => setAtiva('viagens')}",
    para: "'nav-item ativo' : 'nav-item'}",
    motivo:
      'o item Viagens da lateral para de trocar de tela e a navegacao entre KPIs, Viagens e Frota vira clique que nao faz nada; depois do porte o handler nao some mais de `window`, some de uma prop, e some do mesmo jeito calado',
  },
  {
    tela: 'dashboard-semanal',
    arquivo: 'apps/web/src/telas/dashboard-semanal.tsx',
    de: 'rotas.filter((r) => r.pct >= 7)',
    para: 'rotas.filter((r) => r.pct >= 70)',
    motivo:
      'a mensagem do WhatsApp passa a jurar que toda rota esta dentro da meta enquanto a tabela da mesma tela mostra rota critica; o texto so existe na area de transferencia, entao nenhuma comparacao de DOM enxerga a contradicao',
  },
  {
    tela: 'ata-reuniao',
    arquivo: 'apps/web/src/telas/ata-reuniao.tsx',
    de: 'id="tabBtnHist"\n            onClick={() => switchTab(\'hist\')}',
    para: 'id="tabBtnHist"',
    motivo:
      'a aba Historico vira clique que nao faz nada; depois do porte o handler nao some mais de `window`, some de uma prop, e some do mesmo jeito calado',
  },
  {
    tela: 'ata-reuniao',
    arquivo: 'apps/web/src/telas/ata-reuniao.tsx',
    de: "style={{ marginTop: '8px' }}",
    para: "style={{ marginTop: '80px' }}",
    motivo:
      'o selo de PDF do cartao do historico descola dez vezes mais do titulo e ninguem declarou; ele nasce dentro do componente, no cartao que so existe depois de `mostrarHistorico`, e nenhuma comparacao de arquivo enxerga',
  },
  {
    tela: 'manutencao-frota',
    arquivo: 'apps/web/src/telas/manutencao-frota.tsx',
    de: "marginLeft: '8px'",
    para: "marginLeft: '80px'",
    motivo:
      'o espaco entre a placa e o modelo do veiculo cresce dez vezes e ninguem declarou; nasce dentro do componente, no cartao do veiculo, e nenhuma comparacao de arquivo enxerga',
  },
  {
    tela: 'manutencao-frota',
    arquivo: 'apps/web/src/telas/manutencao-frota.tsx',
    de: 'className="btn-sm btn-config-sm" onClick={() => abrirConfig(cartao.placa)}',
    para: 'className="btn-sm btn-config-sm"',
    motivo:
      'o botao Configurar do cartao para de abrir o plano preventivo da placa; depois do porte o handler nao some mais de `window`, some de uma prop, e some do mesmo jeito calado',
  },
  {
    tela: 'formulario-registro',
    arquivo: 'apps/web/src/telas/formulario-registro.tsx',
    de: "decimal('v_combustivel') + decimal('v_diarias')",
    para: "decimal('v_combustivel') - decimal('v_diarias')",
    motivo:
      'o custo total da viagem passa a subtrair as diarias em vez de somar; o campo continua com numero dentro, so o numero esta errado, e nenhuma comparacao de arquivo enxerga uma conta',
  },
  {
    tela: 'formulario-registro',
    arquivo: 'apps/web/src/telas/formulario-registro.tsx',
    de: 'id="btnCorretiva" onClick={() => selecionarTipoManutencao(\'corretiva\')}',
    para: 'id="btnCorretiva"',
    motivo:
      'o botao Corretiva para de trocar o tipo da manutencao; as duas cores ficam onde estavam e o registro sai marcado como preventiva, e depois do porte o handler nao some mais de `window`, some de uma prop, e some do mesmo jeito calado',
  },
]
