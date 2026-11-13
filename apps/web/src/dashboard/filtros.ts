/**
 * Os dois filtros que as quatro telas do painel dividem, lidos da query string.
 *
 * `?base=Raposa&periodo=mes` e a unica memoria do filtro. Nao ha estado de filtro em
 * React: trocar filtro escreve a query no historico e as telas releem dali. Isso e o que
 * faz o filtro sobreviver a navegacao entre Visao geral, Viagens, Rotas e Frota sem uma
 * linha de sincronia, e o que torna a troca idempotente, porque o resultado depende so da
 * URL. E o que faz o botao voltar do navegador desfazer um filtro sem nenhum codigo.
 *
 * `lerFiltros` e a borda: a query e texto de fora, e sai daqui tipada ou no default.
 * Valor invalido nao estoura nem propaga `string` solta, cai no default, que e o mesmo
 * que a tela mostrava antes de alguem mexer.
 *
 * `useFiltros` e a mesma borda, mas pelo nuqs: os parsers validam e o default e aplicado
 * pelo proprio hook, entao a tela recebe `Filtros` tipado sem ler `location.search` a
 * mao. `lerFiltros` e `consultaDe` continuam existindo porque href precisa de string, e
 * string nao e hook: a sidebar e o switcher da casca montam o destino do link com elas.
 */
import { createParser, parseAsStringLiteral, useQueryStates } from 'nuqs'

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
  Belém: { rotulo: 'Belém', naCasca: 'Belém', noRelatorio: 'Belém' },
} as const

export type Base = keyof typeof BASES

/**
 * `mes` e um mes inteiro escolhido (`AAAA-MM`) e, quando existe, manda no `periodo`: o painel
 * mostra o resultado daquele mes. Nulo e o que a tela mostrava antes: vale o `periodo`.
 */
export type Filtros = { readonly base: Base; readonly periodo: Periodo; readonly mes: string | null }

/** O que a tela mostra sem query nenhuma, e para onde o botao de limpar leva. */
export const FILTROS_PADRAO: Filtros = { base: 'todas', periodo: 'semana', mes: null }

const NOMES_DOS_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export function ehMes(valor: string | null): valor is string {
  return valor !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)
}

/** `2026-11` vira `Novembro/2026`. */
export function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split('-')
  return `${NOMES_DOS_MESES[Number(numero) - 1] ?? mes}/${ano}`
}

/** O mes imediatamente antes de `AAAA-MM`, no mesmo formato. */
export function mesAnterior(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number) as [number, number]
  return numero === 1 ? `${ano - 1}-12` : `${ano}-${String(numero - 1).padStart(2, '0')}`
}

/** O texto do periodo nas telas e nos relatorios: o mes escolhido, ou o periodo de sempre. */
export function rotuloDoPeriodo(filtros: Filtros, formato: 'rotulo' | 'noRelatorio' = 'rotulo'): string {
  return filtros.mes === null ? PERIODOS[filtros.periodo][formato] : rotuloDoMes(filtros.mes)
}

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
  const mes = params.get('mes')
  return {
    base: ehBase(base) ? base : FILTROS_PADRAO.base,
    periodo: ehPeriodo(periodo) ? periodo : FILTROS_PADRAO.periodo,
    mes: ehMes(mes) ? mes : null,
  }
}

/** A query com `?`, pronta para colar num href ou em `location.search`. */
export function consultaDe(filtros: Filtros): string {
  const mes = filtros.mes === null ? '' : `&mes=${encodeURIComponent(filtros.mes)}`
  return `?base=${encodeURIComponent(filtros.base)}&periodo=${encodeURIComponent(filtros.periodo)}${mes}`
}

/**
 * Os parsers do nuqs, tirados das mesmas tabelas que `lerFiltros` valida. Valor fora da
 * tabela cai no default, igual a borda manual fazia. `clearOnDefault: false` mantem a
 * query sempre explicita, no mesmo formato que `consultaDe` escreve, para o link
 * copiado da barra continuar igual ao que a sidebar montava.
 */
const BASES_VALIDAS = Object.keys(BASES) as unknown as readonly Base[]
const PERIODOS_VALIDOS = Object.keys(PERIODOS) as unknown as readonly Periodo[]

const PARSERS_DE_FILTROS = {
  base: parseAsStringLiteral(BASES_VALIDAS).withDefault(FILTROS_PADRAO.base),
  periodo: parseAsStringLiteral(PERIODOS_VALIDOS).withDefault(FILTROS_PADRAO.periodo),
  // Sem default: sem `mes` na query o valor e nulo e o `periodo` vale. Mes fora do formato
  // cai em nulo, igual os outros parsers caem no default.
  mes: createParser<string>({
    parse: (valor) => (ehMes(valor) ? valor : null),
    serialize: (valor) => valor,
  }),
}

/**
 * Base e periodo como estado da query, pelo nuqs. Trocar escreve no historico com push,
 * que e o que faz o voltar do navegador desfazer o filtro, igual o `navegar` fazia.
 * Sem scroll: trocar periodo no meio da pagina nao joga a pessoa para o topo.
 */
export function useFiltros(): readonly [
  Filtros,
  (novos: Partial<Filtros>) => Promise<URLSearchParams>,
] {
  const [filtros, definir] = useQueryStates(PARSERS_DE_FILTROS, {
    history: 'push',
    scroll: false,
    clearOnDefault: false,
    shallow: true,
  })
  return [filtros, (novos) => definir(novos)] as const
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
