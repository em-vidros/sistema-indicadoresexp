import { describe, expect, test } from 'bun:test'
import { lerItem } from '../src/dashboard/dominio.ts'
import type { Item } from '../src/dashboard/dominio.ts'
import { COLUNAS_DO_EXCEL, linhaDoExcel } from '../src/dashboard/excel-viagens.ts'

type Viagem = Extract<Item, { tipo: 'viagem' }>

const completa = {
  tipo: 'viagem', base: 'Raposa', id: 'x',
  data_saida: '2026-10-21', hora_saida: '08:30:00',
  data_prevista: '2026-10-21', hora_prevista: '18:00:00',
  data_chegada: '2026-10-21', hora_chegada: '18:20:00',
  motorista: 'Anderson', veiculo: 'PTV0006', rota: 'PINHEIRO',
  km_saida: 1000, km_chegada: 1200, km_rodados: 200,
  valor_carga: 10000, combustivel: 500, diarias: 200, custo_viagem: 700, pct_custo: 7,
  m2: 50.5, peso_kg: 1234.5, litros: 80, vl_litro: 6.1, atraso_min: 20,
  observacao: 'Chuva', registrado_em: '2026-10-21T20:00:00.000Z',
}

const viagemDe = (registro: Record<string, unknown>): Viagem => {
  const item = lerItem(registro as never)
  if (item.tipo !== 'viagem') throw new Error('nao e viagem')
  return item
}

const valorDe = (celula: unknown): unknown =>
  celula !== null && typeof celula === 'object' && 'value' in celula ? (celula as { value: unknown }).value : celula

describe('o Excel das viagens leva tudo o que se preenche', () => {
  test('viagem completa: metragem, km, peso, horas e datas como dados', () => {
    const linha = linhaDoExcel(viagemDe(completa))
    expect(linha).toHaveLength(COLUNAS_DO_EXCEL.length)
    const porNome = (nome: string): unknown => valorDe(linha[COLUNAS_DO_EXCEL.findIndex(([n]) => n === nome)])
    expect(porNome('m²')).toBe(50.5)
    expect(porNome('Peso (kg)')).toBe(1234.5)
    expect(porNome('Km saída')).toBe(1000)
    expect(porNome('Km chegada')).toBe(1200)
    expect(porNome('Km rodados')).toBe(200)
    expect(porNome('Hora saída')).toBe('08:30')
    expect(porNome('Combustível')).toBe(500)
    expect(porNome('Atraso (min)')).toBe(20)
    expect(porNome('Pontualidade')).toBe('Atrasado')
    expect(porNome('Observação')).toBe('Chuva')
    // 21/10/2026 em meia-noite UTC: nao escorrega para o dia 20 em fuso atras do UTC.
    expect((porNome('Data saída') as Date).toISOString()).toBe('2026-10-21T00:00:00.000Z')
  })

  test('campo nao preenchido sai vazio, nao zero: m², peso, horas e chegada', () => {
    const { m2: _m2, peso_kg: _peso, hora_chegada: _h, data_chegada: _d, km_chegada: _k, km_rodados: _r, ...incompleta } = completa
    const linha = linhaDoExcel(viagemDe({ ...incompleta, atraso_min: null, litros: null, vl_litro: null }))
    const porNome = (nome: string): unknown => linha[COLUNAS_DO_EXCEL.findIndex(([n]) => n === nome)]
    for (const nome of ['m²', 'Peso (kg)', 'Hora chegada', 'Data chegada', 'Km chegada', 'Km rodados', 'Litros', 'Valor do litro', 'Atraso (min)', 'Pontualidade']) {
      expect(porNome(nome)).toBeNull()
    }
    expect(linha).toHaveLength(COLUNAS_DO_EXCEL.length)
  })

  test('registro quase vazio nao quebra: data invalida e textos ausentes', () => {
    const linha = linhaDoExcel(viagemDe({ tipo: 'viagem', base: 'Raposa', data_saida: 'lixo' }))
    expect(linha).toHaveLength(COLUNAS_DO_EXCEL.length)
    expect(linha[0]).toBeNull()
  })

  test('cada coluna tem nome e largura', () => {
    expect(COLUNAS_DO_EXCEL.every(([nome, largura]) => nome !== '' && largura > 0)).toBe(true)
  })
})
