import { z } from 'zod'

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

const MINUTOS_POR_DIA = 1440

type PartesData = { ano: number; mes: number; dia: number }

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return bissexto(ano) ? 29 : 28
  return mes === 4 || mes === 6 || mes === 9 || mes === 11 ? 30 : 31
}

function partesData(bruto: string): PartesData | null {
  const casou = FORMATO_DATA.exec(bruto)
  if (casou === null) return null
  const [, a, m, d] = casou
  if (a === undefined || m === undefined || d === undefined) return null
  const ano = Number(a)
  const mes = Number(m)
  const dia = Number(d)
  if (mes < 1 || mes > 12) return null
  if (dia < 1 || dia > diasNoMes(ano, mes)) return null
  return { ano, mes, dia }
}

function partesHora(bruto: string): { hora: number; minuto: number } | null {
  const casou = FORMATO_HORA.exec(bruto)
  if (casou === null) return null
  const [, h, m] = casou
  if (h === undefined || m === undefined) return null
  return { hora: Number(h), minuto: Number(m) }
}

/**
 * A data existe no calendario, e nao so tem a forma de uma. `2026-02-31` e
 * `2026-99-99` casam com `^\d{4}-\d{2}-\d{2}$` e nao existem.
 *
 * Isto e exportado sem a marca de `DataISO` de proposito: no boundary HTTP o valor
 * segue como texto ate a coluna `date`, e o que se precisa la e um `refine`, nao um
 * tipo novo. As quatro rotas da fase 2 escreveram o regex na mao e deixaram passar
 * data inexistente, que o Postgres recusa com 22008 e o cliente recebe como 500.
 */
export const ehDataValida = (bruto: string): boolean => partesData(bruto) !== null

/** O par do `ehDataValida`, para as colunas `time`. */
export const ehHoraValida = (bruto: string): boolean => partesHora(bruto) !== null

export const DataISO = z
  .string()
  .refine((v) => partesData(v) !== null, 'data invalida, use AAAA-MM-DD')
  .brand<'DataISO'>()
export type DataISO = z.infer<typeof DataISO>

export const HoraHM = z
  .string()
  .refine((v) => partesHora(v) !== null, 'hora invalida, use HH:MM')
  .brand<'HoraHM'>()
export type HoraHM = z.infer<typeof HoraHM>

export const Instante = z.object({ data: DataISO, hora: HoraHM })
export type Instante = z.infer<typeof Instante>

export const dataISO = (bruto: string): DataISO => DataISO.parse(bruto)
export const horaHM = (bruto: string): HoraHM => HoraHM.parse(bruto)
export const instante = (data: string, hora: string): Instante => ({
  data: dataISO(data),
  hora: horaHM(hora),
})

/**
 * Contagem de dias direto do calendario proleptico gregoriano (algoritmo
 * days_from_civil). `new Date('2026-03-01')` seria interpretado em UTC e, num
 * fuso a oeste, voltaria o dia anterior quando formatado de volta. Uma diferenca
 * de um dia num alerta de vencimento e um bug silencioso.
 */
function diasDesdeEpoca(p: PartesData): number {
  const anoAjustado = p.ano - (p.mes <= 2 ? 1 : 0)
  const era = Math.floor(anoAjustado / 400)
  const anoNaEra = anoAjustado - era * 400
  const diaNoAno = Math.floor((153 * (p.mes + (p.mes > 2 ? -3 : 9)) + 2) / 5) + p.dia - 1
  const diaNaEra =
    anoNaEra * 365 + Math.floor(anoNaEra / 4) - Math.floor(anoNaEra / 100) + diaNoAno
  return era * 146097 + diaNaEra - 719468
}

function exigirData(d: DataISO): PartesData {
  const p = partesData(d)
  // O tipo marcado so nasce do schema, entao `p` nunca e nulo aqui. O compilador
  // nao consegue provar isso porque a marca vive no tipo, nao no valor.
  if (p === null) throw new Error(`data invalida: ${d}`)
  return p
}

function minutosDoDia(h: HoraHM): number {
  const p = partesHora(h)
  if (p === null) throw new Error(`hora invalida: ${h}`)
  return p.hora * 60 + p.minuto
}

export function diasEntre(a: DataISO, b: DataISO): number {
  return diasDesdeEpoca(exigirData(b)) - diasDesdeEpoca(exigirData(a))
}

export function minutosEntre(a: Instante, b: Instante): number {
  return (
    diasEntre(a.data, b.data) * MINUTOS_POR_DIA + minutosDoDia(b.hora) - minutosDoDia(a.hora)
  )
}
