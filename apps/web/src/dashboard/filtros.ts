/**
 * Os dois filtros que as quatro telas do painel dividem, lidos da query string.
 *
 * `?base=Raposa&periodo=mes` e a unica memoria do filtro. Nao ha estado de filtro em
 * React: trocar filtro escreve `location.search` e a pagina recarrega. Isso e o que faz o
 * filtro sobreviver a navegacao entre Visao geral, Viagens, Rotas e Frota sem uma linha de
 * sincronia, e o que torna a troca idempotente, porque o resultado depende so da URL.
 *
 * `lerFiltros` e a borda: a query e texto de fora, e sai daqui tipada ou no default.
 * Valor invalido nao estoura nem propaga `string` solta, cai no default, que e o mesmo
 * que a tela mostrava antes de alguem mexer.
 */

/** O rotulo da tela e o do relatorio sao dois. O relatorio e formato congelado. */
type Descricao = { readonly rotulo: string; readonly noRelatorio: string }

export const PERIODOS = {
  semana: { rotulo: 'Esta semana', noRelatorio: 'Esta Semana' },
  ultima_semana: { rotulo: 'Semana passada', noRelatorio: 'Semana Passada' },
  mes: { rotulo: 'Este mês', noRelatorio: 'Este Mês' },
  tudo: { rotulo: 'Todo o período', noRelatorio: 'Todo o Período' },
} as const satisfies Readonly<Record<string, Descricao>>

export type Periodo = keyof typeof PERIODOS

/**
 * Tres escritas do mesmo filtro, e nao uma com `toLowerCase` por cima. `rotulo` e o item
 * do menu, `naCasca` e a linha de baixo do switcher e o subtitulo da pagina, e
 * `noRelatorio` e o texto do .txt e, em caixa alta, o do WhatsApp. As duas primeiras sao
 * do redesenho e a terceira e formato congelado desde antes dele.
 */
export const BASES = {
  todas: { rotulo: 'Todas', naCasca: 'Todas as bases', noRelatorio: 'Todas as Bases' },
  Raposa: { rotulo: 'Raposa', naCasca: 'Raposa', noRelatorio: 'Raposa' },
  Imperatriz: { rotulo: 'Imperatriz', naCasca: 'Imperatriz', noRelatorio: 'Imperatriz' },
} as const

export type Base = keyof typeof BASES

export type Filtros = { readonly base: Base; readonly periodo: Periodo }

/** O que a tela mostra sem query nenhuma, e para onde o botao de limpar leva. */
export const FILTROS_PADRAO: Filtros = { base: 'todas', periodo: 'semana' }

function ehBase(valor: string | null): valor is Base {
  return valor !== null && valor in BASES
}

function ehPeriodo(valor: string | null): valor is Periodo {
  return valor !== null && valor in PERIODOS
}

/**
 * As opcoes de um seletor, tiradas da propria tabela. O `as K[]` e o buraco conhecido do
 * `Object.keys`, que devolve `string[]` mesmo quando o tipo diz quais chaves existem; ele
 * fica preso aqui dentro, e nao espalhado por um `as` em cada tela.
 */
function opcoesDe<K extends string>(
  tabela: Readonly<Record<K, { readonly rotulo: string }>>,
): ReadonlyArray<{ readonly valor: K; readonly rotulo: string }> {
  return (Object.keys(tabela) as K[]).map((valor) => ({ valor, rotulo: tabela[valor].rotulo }))
}

export const OPCOES_DE_PERIODO = opcoesDe(PERIODOS)
export const OPCOES_DE_BASE = opcoesDe(BASES)

/** `busca` e o `location.search`, com `?` ou sem. */
export function lerFiltros(busca: string): Filtros {
  const params = new URLSearchParams(busca)
  const base = params.get('base')
  const periodo = params.get('periodo')
  return {
    base: ehBase(base) ? base : FILTROS_PADRAO.base,
    periodo: ehPeriodo(periodo) ? periodo : FILTROS_PADRAO.periodo,
  }
}

/** A query com `?`, pronta para colar num href ou em `location.search`. */
export function consultaDe(filtros: Filtros): string {
  return `?base=${encodeURIComponent(filtros.base)}&periodo=${encodeURIComponent(filtros.periodo)}`
}

/**
 * A janela imediatamente anterior, para o delta "vs. semana passada" do primeiro KPI. Os
 * dois periodos que nao tem anterior sao `tudo`, que ja e tudo, e `mes`, que so teria
 * comparacao se `filtrarDados` soubesse recuar um mes; hoje ele nao sabe, e um delta
 * comparando o mes com ele mesmo seria sempre zero, que e pior do que nao ter delta.
 */
export function periodoAnterior(periodo: Periodo): Periodo | null {
  return periodo === 'semana' ? 'ultima_semana' : null
}
