/**
 * O dominio da Visao geral: ler um registro da API, filtrar por base e periodo, somar os
 * indicadores e formatar numero. Estava dentro de `telas/dashboard-semanal.tsx` ate o
 * redesenho, e saiu inteiro daquele arquivo quando a view velha morreu. As quatro telas
 * do painel dividem estas funcoes.
 *
 * Nada aqui desenha. `faixaDe` e a unica funcao que olha para a tela, e mesmo ela devolve
 * a faixa em que o numero caiu, e nao a classe de CSS que a faixa vira.
 */
import type { Registro } from '../js/registros-api.ts'
import type { Tom } from '../geist/primitivos.tsx'

export type { Tom }
import type { Periodo } from './filtros.ts'

// Minutos de tolerancia antes de a chegada contar como atraso. Nenhuma rota da API
// entrega parametro ainda, e a origem usa `<select>` manual sem numero real, entao
// o 15 segue hardcoded e pendente da decisao da Livia; quando houver parametro, ele sai daqui.
export const TOLERANCIA_PONTUALIDADE_MIN = 15

export type Pontualidade = 'adiantado' | 'no_prazo' | 'atrasado'

/**
 * Como cada classificacao se escreve na tela. Fica aqui e nao na tela porque Viagens
 * escreve os tres no selo da linha e tambem no menu do filtro, e duas listas que precisam
 * concordar sao uma lista.
 */
export const PONTUALIDADES = {
  adiantado: { rotulo: 'Adiantado' },
  no_prazo: { rotulo: 'No prazo' },
  atrasado: { rotulo: 'Atrasado' },
} as const satisfies Readonly<Record<Pontualidade, { readonly rotulo: string }>>

/** O que os dois filtros do topo leem de qualquer registro, seja qual for o tipo. */
export type Comum = {
  readonly base: string
  /** `data_saida || data || registrado_em`: como o filtro de periodo data o registro. */
  readonly quando: string
}

/**
 * Um registro da API depois de lido.
 *
 * `Registro` chega como `Record<string, unknown>`, entao a leitura de campo acontece uma
 * vez, aqui, e nao dentro de cada soma e de cada `<td>`. Um tipo que a tela nao desenha
 * cai em `outro`, que ainda conta no total de registros, como contava antes.
 */
export type Item =
  | (Comum & {
    readonly tipo: 'viagem'
    readonly dataSaida: string
    readonly motorista: string
    readonly veiculo: string
    readonly rota: string
    readonly km: number | null
    readonly valorCarga: number
    readonly custoViagem: number
    readonly pctCusto: number
    readonly pontualidade: Pontualidade | null
    /** O registro como a API entregou, para o que a tela nao desenha mas o Excel leva (m², peso, km, horas...). */
    readonly bruto: Registro
  })
  | (Comum & {
    readonly tipo: 'manutencao'
    readonly data: string
    readonly placa: string
    readonly servico: string
    readonly valor: number
    readonly fornecedor: string
  })
  | (Comum & {
    readonly tipo: 'abastecimento'
    readonly data: string
    readonly placa: string
    readonly litros: number
    readonly vlLitro: number
    readonly valorTotal: number
    readonly km: number
  })
  | (Comum & { readonly tipo: 'quebra'; readonly m2Expedido: number; readonly m2Quebrado: number })
  | (Comum & { readonly tipo: 'outro' })

export function numero(registro: Registro, chave: string): number {
  const valor = registro[chave]
  return typeof valor === 'number' ? valor : 0
}

export function texto(registro: Registro, chave: string): string {
  const valor = registro[chave]
  return typeof valor === 'string' ? valor : ''
}

/**
 * A `pontualidade` que esta tela le era a escolha de um campo do formulario antigo,
 * gravada junto com a viagem. O banco nao guarda mais a escolha: guarda `atraso_min`, a
 * diferenca em minutos entre a chegada prevista e a real, e nula quando nao houve
 * previsao. Viagem sem previsao continua sem pontualidade, que e o mesmo que o campo em
 * branco fazia aqui, e ai sobra o que o registro antigo tiver gravado. A classificacao
 * repete `classificarPontualidade` do dominio.
 */
export function pontualidadeDe(registro: Registro): Pontualidade | null {
  const atraso = registro.atraso_min
  if (typeof atraso === 'number') {
    const tolerancia = Math.abs(TOLERANCIA_PONTUALIDADE_MIN)
    if (atraso > tolerancia) return 'atrasado'
    if (atraso < -tolerancia) return 'adiantado'
    return 'no_prazo'
  }
  const gravada = registro.pontualidade
  return gravada === 'adiantado' || gravada === 'no_prazo' || gravada === 'atrasado' ? gravada : null
}

export function kmDaViagem(registro: Registro): number | null {
  const rodados = numero(registro, 'km_rodados')
  if (rodados !== 0) return rodados
  const chegada = numero(registro, 'km_chegada')
  const saida = numero(registro, 'km_saida')
  return chegada !== 0 && saida !== 0 ? chegada - saida : null
}

export function lerItem(registro: Registro): Item {
  const comum: Comum = {
    base: texto(registro, 'base'),
    quando: texto(registro, 'data_saida') || texto(registro, 'data') || texto(registro, 'registrado_em'),
  }
  if (registro.tipo === 'viagem') {
    return {
      ...comum,
      tipo: 'viagem',
      dataSaida: texto(registro, 'data_saida'),
      motorista: texto(registro, 'motorista'),
      veiculo: texto(registro, 'veiculo'),
      rota: texto(registro, 'rota'),
      km: kmDaViagem(registro),
      valorCarga: numero(registro, 'valor_carga'),
      custoViagem: numero(registro, 'custo_viagem'),
      pctCusto: numero(registro, 'pct_custo'),
      pontualidade: pontualidadeDe(registro),
      bruto: registro,
    }
  }
  if (registro.tipo === 'manutencao') {
    return {
      ...comum,
      tipo: 'manutencao',
      data: texto(registro, 'data'),
      placa: texto(registro, 'placa'),
      servico: texto(registro, 'servico'),
      valor: numero(registro, 'valor'),
      fornecedor: texto(registro, 'fornecedor'),
    }
  }
  if (registro.tipo === 'abastecimento') {
    return {
      ...comum,
      tipo: 'abastecimento',
      data: texto(registro, 'data'),
      placa: texto(registro, 'placa'),
      litros: numero(registro, 'litros'),
      vlLitro: numero(registro, 'vl_litro'),
      valorTotal: numero(registro, 'valor_total'),
      km: numero(registro, 'km'),
    }
  }
  if (registro.tipo === 'quebra') {
    return {
      ...comum,
      tipo: 'quebra',
      m2Expedido: numero(registro, 'm2_expedido'),
      m2Quebrado: numero(registro, 'm2_quebrado'),
    }
  }
  return { ...comum, tipo: 'outro' }
}

/** Os meses (`AAAA-MM`) que tem algum registro, do mais recente para o mais antigo. */
export function mesesComRegistro(itens: readonly Item[], base: string): string[] {
  const meses = new Set<string>()
  for (const item of itens) {
    if (base !== 'todas' && item.base !== base) continue
    const mes = item.quando.slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(mes)) meses.add(mes)
  }
  return [...meses].sort().reverse()
}

export function filtrarDados(itens: readonly Item[], base: string, periodo: Periodo, mes: string | null = null): Item[] {
  // Um mes escolhido vale no lugar do periodo: `quando` comeca com `AAAA-MM-DD`, entao o
  // mes do registro e o inicio do texto, sem passar por `Date` e por fuso.
  if (mes !== null) {
    return itens.filter((item) => (base === 'todas' || item.base === base) && item.quando.slice(0, 7) === mes)
  }
  const agora = new Date()

  let inicio: Date
  if (periodo === 'semana') {
    inicio = new Date(agora)
    inicio.setDate(agora.getDate() - agora.getDay() + (agora.getDay() === 0 ? -6 : 1))
    inicio.setHours(0, 0, 0, 0)
  } else if (periodo === 'ultima_semana') {
    inicio = new Date(agora)
    inicio.setDate(agora.getDate() - agora.getDay() + (agora.getDay() === 0 ? -13 : -6))
    inicio.setHours(0, 0, 0, 0)
    const fim = new Date(inicio)
    fim.setDate(fim.getDate() + 7)
    return itens.filter((item) => {
      if (base !== 'todas' && item.base !== base) return false
      const quando = new Date(item.quando)
      return quando >= inicio && quando < fim
    })
  } else if (periodo === 'mes') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
  } else {
    inicio = new Date('2020-01-01')
  }

  return itens.filter((item) => {
    if (base !== 'todas' && item.base !== base) return false
    return new Date(item.quando) >= inicio
  })
}

export function calcularKPIs(dados: readonly Item[]) {
  const viagens = dados.filter((d) => d.tipo === 'viagem')
  const abasts = dados.filter((d) => d.tipo === 'abastecimento')
  const manuts = dados.filter((d) => d.tipo === 'manutencao')
  const quebras = dados.filter((d) => d.tipo === 'quebra')

  const totalCarga = viagens.reduce((s, d) => s + d.valorCarga, 0)
  const totalCustoV = viagens.reduce((s, d) => s + d.custoViagem, 0)
  const totalManut = manuts.reduce((s, d) => s + d.valor, 0)
  const totalAbast = abasts.reduce((s, d) => s + d.valorTotal, 0)
  const m2Expedido = quebras.reduce((s, d) => s + d.m2Expedido, 0)
  const m2Quebrado = quebras.reduce((s, d) => s + d.m2Quebrado, 0)

  const pctCustoRota = totalCarga > 0 ? (totalCustoV / totalCarga) * 100 : null
  const pctQuebra = m2Expedido > 0 ? (m2Quebrado / m2Expedido) * 100 : null
  const pctManutProd = totalCarga > 0 ? (totalManut / totalCarga) * 100 : null

  const pont = { adiantado: 0, no_prazo: 0, atrasado: 0, total: 0 }
  for (const viagem of viagens) {
    if (viagem.pontualidade === null) continue
    pont[viagem.pontualidade]++
    pont.total++
  }

  return { viagens, abasts, manuts, quebras, totalCarga, totalCustoV, totalManut, totalAbast, pctCustoRota, pctQuebra, pctManutProd, pont }
}

export type CustoDaPlaca = {
  readonly placa: string
  readonly viagens: number
  readonly km: number
  readonly combustivel: number
  readonly manutencao: number
  /** Combustivel mais manutencao, sem diarias: a conta dos fechamentos mensais. */
  readonly custo: number
  /** Nulo quando nenhuma viagem da placa tem km rodado lancado. */
  readonly custoKm: number | null
}

/**
 * Custo por m², custo por km e custo por placa do periodo.
 *
 * - Custo por m²: custo das viagens (combustivel + diarias) / m² transportado. So entram
 *   as viagens com m² lancado, no numerador e no denominador.
 * - Custo por km: (combustivel das viagens + manutencao) / km rodado. Diarias ficam de
 *   fora, como nos fechamentos mensais. Como a manutencao nao e de uma viagem, ela entra
 *   inteira; o combustivel so das viagens com km rodado, para a viagem sem km nao
 *   inflar o custo de um km que nao existe.
 * - Por placa: a mesma conta do custo por km, uma placa por linha, da mais cara para a
 *   mais barata. Uma placa so com manutencao aparece, sem custo por km.
 */
export function indicadoresDeCusto(dados: readonly Item[]) {
  const viagens = dados.filter((d) => d.tipo === 'viagem')
  const manuts = dados.filter((d) => d.tipo === 'manutencao')

  const comM2 = viagens.filter((v) => numero(v.bruto, 'm2') > 0)
  const m2 = comM2.reduce((s, v) => s + numero(v.bruto, 'm2'), 0)
  const custoDasViagensComM2 = comM2.reduce((s, v) => s + v.custoViagem, 0)

  const comKm = viagens.filter((v) => (v.km ?? 0) > 0)
  const km = comKm.reduce((s, v) => s + (v.km ?? 0), 0)
  const combustivelComKm = comKm.reduce((s, v) => s + numero(v.bruto, 'combustivel'), 0)
  const manutencao = manuts.reduce((s, m) => s + m.valor, 0)

  const placas = new Map<string, { viagens: number; km: number; combustivel: number; manutencao: number }>()
  const da = (placa: string) => {
    const atual = placas.get(placa) ?? { viagens: 0, km: 0, combustivel: 0, manutencao: 0 }
    placas.set(placa, atual)
    return atual
  }
  for (const v of viagens) {
    if (v.veiculo === '') continue
    const atual = da(v.veiculo)
    atual.viagens++
    if ((v.km ?? 0) > 0) {
      atual.km += v.km ?? 0
      atual.combustivel += numero(v.bruto, 'combustivel')
    }
  }
  for (const m of manuts) {
    if (m.placa !== '') da(m.placa).manutencao += m.valor
  }
  const porPlaca: CustoDaPlaca[] = [...placas]
    .map(([placa, d]) => {
      const custo = d.combustivel + d.manutencao
      return { placa, ...d, custo, custoKm: d.km > 0 ? custo / d.km : null }
    })
    .sort((a, b) => b.custo - a.custo)

  return {
    custoPorM2: m2 > 0 ? custoDasViagensComM2 / m2 : null,
    m2,
    viagensComM2: comM2.length,
    viagensSemM2: viagens.length - comM2.length,
    custoPorKm: km > 0 ? (combustivelComKm + manutencao) / km : null,
    km,
    combustivelComKm,
    manutencao,
    viagensSemKm: viagens.length - comKm.length,
    porPlaca,
  }
}

export type Rota = {
  readonly rota: string
  readonly n: number
  readonly carga: number
  readonly custo: number
  readonly pct: number
  /** A saida mais recente da rota, como o registro a gravou. Vazia se nenhuma tem data. */
  readonly ultima: string
}

export function porRota(viagens: readonly Extract<Item, { tipo: 'viagem' }>[]): Rota[] {
  const acumulado = new Map<string, { n: number; carga: number; custo: number; ultima: string }>()
  for (const viagem of viagens) {
    if (!viagem.rota) continue
    const atual = acumulado.get(viagem.rota) ?? { n: 0, carga: 0, custo: 0, ultima: '' }
    atual.n++
    atual.carga += viagem.valorCarga
    atual.custo += viagem.custoViagem
    // Comparacao de texto, e nao de `Date`: as datas chegam em `AAAA-MM-DD`, onde a ordem
    // alfabetica ja e a cronologica, e `new Date` de uma data sem hora cai na meia-noite
    // em UTC, o que devolve o dia anterior neste fuso.
    const quando = viagem.dataSaida || viagem.quando
    if (quando > atual.ultima) atual.ultima = quando
    acumulado.set(viagem.rota, atual)
  }
  return [...acumulado]
    .map(([rota, d]) => ({ rota, ...d, pct: d.carga > 0 ? (d.custo / d.carga) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
}

/**
 * As ultimas `quantas` semanas do grafico de custo por carga. `pct` fica nulo na semana
 * sem carga. Eram oito fixas ate o redesenho; as tres abas do grafico ("8 semanas", "12",
 * "26") pedem a mesma janela em tres tamanhos, e aba que nao muda nada e enfeite.
 */
export function semanasDoGrafico(
  dados: readonly Item[],
  quantas = 8,
): Array<{ label: string; pct: number | null }> {
  const semanas: Array<{ label: string; pct: number | null }> = []
  const viagens = dados.filter((d) => d.tipo === 'viagem')
  for (let i = quantas - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const ini = new Date(d)
    ini.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
    ini.setHours(0, 0, 0, 0)
    const fim = new Date(ini)
    fim.setDate(ini.getDate() + 7)
    const daSemana = viagens.filter((v) => {
      const quando = new Date(v.dataSaida || v.quando)
      return quando >= ini && quando < fim
    })
    const carga = daSemana.reduce((s, v) => s + v.valorCarga, 0)
    const custo = daSemana.reduce((s, v) => s + v.custoViagem, 0)
    semanas.push({
      label: ini.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      pct: carga > 0 ? (custo / carga) * 100 : null,
    })
  }
  return semanas
}

/** Reais com centavos, para o que vale poucos reais (custo por km, custo por m²). */
export function brlCentavos(valor: number | null): string {
  if (valor === null) return '·'
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function brl(valor: number): string {
  if (valor <= 0) return '·'
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function fmtPct(valor: number | null): string {
  return valor === null ? '·' : `${valor.toFixed(2)}%`
}

/**
 * O mesmo numero de `fmtPct`, com a virgula que pt-BR escreve e que o canvas desenhou
 * ("6,42%"). `fmtPct` continua com ponto porque o texto do relatorio e do WhatsApp saiu
 * assim por anos e quem recebe compara com o da semana passada; a tela nao tem essa divida.
 */
export function porcento(valor: number | null, casas = 2): string {
  return valor === null ? '·' : `${valor.toFixed(casas).replace('.', ',')}%`
}

/** A fatia inteira que `parte` ocupa de `total`, como a tela sempre mostrou pontualidade. */
export function parcela(parte: number, total: number): number {
  return Math.round((parte / total) * 100)
}

/**
 * O dia e o mes de uma data que chegou como `AAAA-MM-DD`, recortados do texto. Passar por
 * `Date` custaria o desconto de fuso, que joga a data sem hora para o dia anterior aqui, e
 * a tela mostraria a viagem de 01/09 como 31/08.
 */
export function diaMes(quando: string): string {
  const [, mes, dia] = quando.slice(0, 10).split('-')
  return dia === undefined || mes === undefined ? '·' : `${dia}/${mes}`
}

/** Como cada faixa se chama na coluna de status das rotas. */
export const ROTULO_DA_FAIXA: Readonly<Record<Tom, string>> = {
  ok: 'Dentro da meta',
  atencao: 'Atenção',
  critico: 'Crítico',
}

/**
 * A faixa em que o numero caiu, ou `null` quando nao ha numero. Quem decide a cor de cada
 * faixa e o `Tom` do sistema visual; aqui so entram os dois limites que o indicador tem.
 */
export function faixaDe(valor: number | null, bom: number, atencao: number): Tom | null {
  if (valor === null) return null
  return valor < bom ? 'ok' : valor < atencao ? 'atencao' : 'critico'
}

/** As somas e as contagens de um periodo, do jeito que `calcularKPIs` as devolve. */
export type Indicadores = ReturnType<typeof calcularKPIs>
