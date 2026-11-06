/**
 * O que o "Exportar Excel" da tela Viagens leva: tudo o que se preenche numa viagem, e nao
 * so as nove colunas da tabela. Mora aqui, fora da tela, para ser testado sem desenhar nada.
 *
 * Numero sai como numero e data como data, para somar e filtrar no Excel sem converter
 * texto. Campo que nao foi preenchido sai como celula vazia, e nao como zero: m² ou peso
 * em branco nao podem virar "0" e entrar no custo por m² como se fossem verdade. Os que a
 * viagem sempre tem (carga, combustivel, diarias, custo) saem como numero mesmo quando 0.
 */
import type { Cell } from 'write-excel-file/universal'
import type { Registro } from '../js/registros-api.ts'
import { PONTUALIDADES, numero, texto } from './dominio.ts'
import type { Item } from './dominio.ts'

type Viagem = Extract<Item, { tipo: 'viagem' }>

/** Cada coluna com a sua largura em caracteres, juntas para cabecalho e largura nunca discordarem. */
export const COLUNAS_DO_EXCEL: ReadonlyArray<readonly [string, number]> = [
  ['Data saída', 12], ['Hora saída', 11], ['Data prevista', 13], ['Hora prevista', 13],
  ['Data chegada', 13], ['Hora chegada', 13], ['Base', 12], ['Motorista', 28],
  ['Veículo', 12], ['Rota', 24], ['Km saída', 11], ['Km chegada', 12], ['Km rodados', 12],
  ['Valor da carga', 16], ['Combustível', 14], ['Diárias', 12], ['Custo da viagem', 16],
  ['% custo', 10], ['m²', 10], ['Peso (kg)', 12], ['Litros', 10], ['Valor do litro', 14],
  ['Atraso (min)', 13], ['Pontualidade', 14], ['Observação', 40],
]

const DINHEIRO = '"R$" #,##0.00'

/** `AAAA-MM-DD` (ou com hora depois) vira data do Excel, em meia-noite UTC, sem escorregar de dia. */
export function dataDoExcel(valor: unknown): Cell {
  if (typeof valor !== 'string') return null
  const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number)
  return ano && mes && dia ? { value: new Date(Date.UTC(ano, mes - 1, dia)), type: Date, format: 'dd/mm/yyyy' } : null
}

/** `HH:MM:SS` vira `HH:MM`; vazio fica vazio. */
export function horaDoExcel(valor: unknown): Cell {
  return typeof valor === 'string' && valor !== '' ? valor.slice(0, 5) : null
}

/** Numero que pode nao ter sido preenchido: celula vazia, e nao zero, quando nao veio. */
function numeroDoExcel(bruto: Registro, chave: string, format: string): Cell {
  const valor = bruto[chave]
  return typeof valor === 'number' ? { value: valor, format } : null
}

export function linhaDoExcel(viagem: Viagem): Cell[] {
  const b = viagem.bruto
  return [
    dataDoExcel(b['data_saida']),
    horaDoExcel(b['hora_saida']),
    dataDoExcel(b['data_prevista']),
    horaDoExcel(b['hora_prevista']),
    dataDoExcel(b['data_chegada']),
    horaDoExcel(b['hora_chegada']),
    texto(b, 'base') || null,
    viagem.motorista || null,
    viagem.veiculo || null,
    viagem.rota || null,
    numeroDoExcel(b, 'km_saida', '#,##0'),
    numeroDoExcel(b, 'km_chegada', '#,##0'),
    viagem.km === null ? null : { value: viagem.km, format: '#,##0' },
    { value: viagem.valorCarga, format: DINHEIRO },
    { value: numero(b, 'combustivel'), format: DINHEIRO },
    { value: numero(b, 'diarias'), format: DINHEIRO },
    { value: viagem.custoViagem, format: DINHEIRO },
    { value: viagem.pctCusto / 100, format: '0.00%' },
    numeroDoExcel(b, 'm2', '#,##0.00'),
    numeroDoExcel(b, 'peso_kg', '#,##0.00'),
    numeroDoExcel(b, 'litros', '#,##0.00'),
    numeroDoExcel(b, 'vl_litro', DINHEIRO),
    numeroDoExcel(b, 'atraso_min', '#,##0'),
    viagem.pontualidade === null ? null : PONTUALIDADES[viagem.pontualidade].rotulo,
    texto(b, 'observacao') || null,
  ]
}
