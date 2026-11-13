import { describe, expect, test } from 'bun:test'
import { filtrarDados, indicadoresDeCusto, lerItem, mesesComRegistro } from '../src/dashboard/dominio.ts'
import type { Item } from '../src/dashboard/dominio.ts'
import { ehMes, lerFiltros, consultaDe, mesAnterior, rotuloDoMes, rotuloDoPeriodo } from '../src/dashboard/filtros.ts'

const viagem = (extra: Record<string, unknown>): Item =>
  lerItem({
    tipo: 'viagem', base: 'Raposa', id: 'v', data_saida: '2026-10-10', registrado_em: '2026-10-10T12:00:00.000Z',
    motorista: 'Ana', veiculo: 'AAA1A11', rota: 'PINHEIRO',
    km_saida: 1000, km_chegada: 1200, km_rodados: 200,
    valor_carga: 10000, combustivel: 600, diarias: 100, custo_viagem: 700, m2: 100,
    ...extra,
  } as never)

const manutencao = (extra: Record<string, unknown>): Item =>
  lerItem({
    tipo: 'manutencao', base: 'Raposa', id: 'm', data: '2026-10-12', registrado_em: '2026-10-12T12:00:00.000Z',
    placa: 'AAA1A11', servico: 'Freio', valor: 400, fornecedor: 'Oficina', ...extra,
  } as never)

describe('custo por m², custo por km e custo por placa', () => {
  test('caminho feliz: m² e km usam combustível, o km soma a manutenção, e nenhum leva diárias', () => {
    const r = indicadoresDeCusto([
      viagem({}),
      viagem({ id: 'v2', veiculo: 'BBB2B22', km_rodados: 300, combustivel: 900, diarias: 0, custo_viagem: 900, m2: 200 }),
      manutencao({}),
    ])
    // (600 + 900) de combustível / (100 + 200) m², sem as diárias de R$ 100
    expect(r.custoPorM2).toBeCloseTo(1500 / 300, 6)
    // (600 + 900 + 400 manutenção) / (200 + 300) km
    expect(r.custoPorKm).toBeCloseTo(1900 / 500, 6)
    expect(r.porPlaca.map((p) => [p.placa, p.custo, p.km])).toEqual([
      ['BBB2B22', 900, 300],
      ['AAA1A11', 1000, 200],
    ].sort((a, b) => Number(b[1]) - Number(a[1])))
    expect(r.porPlaca.find((p) => p.placa === 'AAA1A11')?.custoKm).toBeCloseTo(1000 / 200, 6)
  })

  test('falha 1: viagem sem m² e sem km fica de fora da conta, e é contada', () => {
    const r = indicadoresDeCusto([
      viagem({}),
      viagem({ id: 'v2', m2: 0, km_chegada: null, km_rodados: 0, combustivel: 5000, custo_viagem: 5100 }),
    ])
    expect(r.custoPorM2).toBeCloseTo(600 / 100, 6)
    expect(r.custoPorKm).toBeCloseTo(600 / 200, 6)
    expect(r.viagensSemM2).toBe(1)
    expect(r.viagensSemKm).toBe(1)
  })

  test('falha 2: sem viagens não há custo por km nem por m², e placa só com manutenção aparece sem custo por km', () => {
    const vazio = indicadoresDeCusto([])
    expect(vazio.custoPorM2).toBeNull()
    expect(vazio.custoPorKm).toBeNull()
    expect(vazio.porPlaca).toEqual([])

    const soManutencao = indicadoresDeCusto([manutencao({ placa: 'CCC3C33' })])
    expect(soManutencao.porPlaca).toMatchObject([{ placa: 'CCC3C33', custo: 400, km: 0, custoKm: null }])
    expect(soManutencao.custoPorKm).toBeNull()
  })
})

describe('o filtro de mês', () => {
  const itens = [
    viagem({ id: 'a', data_saida: '2026-10-31' }),
    viagem({ id: 'b', data_saida: '2026-11-01' }),
    viagem({ id: 'c', data_saida: '2026-11-30', base: 'Imperatriz' }),
    manutencao({ data: '2026-09-15' }),
  ]

  test('o mês escolhido mostra o mês inteiro, sem passar por fuso, e respeita a base', () => {
    expect(filtrarDados(itens, 'todas', 'semana', '2026-11').map((i) => i.quando)).toEqual(['2026-11-01', '2026-11-30'])
    expect(filtrarDados(itens, 'Raposa', 'semana', '2026-11').map((i) => i.quando)).toEqual(['2026-11-01'])
    expect(filtrarDados(itens, 'todas', 'tudo', '2026-10')).toHaveLength(1)
  })

  test('sem mês escolhido vale o período, como antes', () => {
    expect(filtrarDados(itens, 'todas', 'tudo')).toHaveLength(4)
  })

  test('lista só os meses com registro, do mais recente para o mais antigo', () => {
    expect(mesesComRegistro(itens, 'todas')).toEqual(['2026-11', '2026-10', '2026-09'])
    expect(mesesComRegistro(itens, 'Imperatriz')).toEqual(['2026-11'])
  })

  test('mes anterior atravessa a virada do ano e os rótulos saem em português', () => {
    expect(mesAnterior('2026-11')).toBe('2026-10')
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(rotuloDoMes('2026-03')).toBe('Março/2026')
  })

  test('a query leva o mês, e mês inválido cai em nulo', () => {
    expect(lerFiltros('?base=Raposa&periodo=mes&mes=2026-10').mes).toBe('2026-10')
    expect(lerFiltros('?mes=2026-13').mes).toBeNull()
    expect(lerFiltros('?mes=outubro').mes).toBeNull()
    expect(lerFiltros('').mes).toBeNull()
    expect(ehMes('2026-00')).toBe(false)
    const filtros = lerFiltros('?base=Raposa&mes=2026-10')
    expect(consultaDe(filtros)).toBe('?base=Raposa&periodo=semana&mes=2026-10')
    expect(consultaDe({ ...filtros, mes: null })).toBe('?base=Raposa&periodo=semana')
    expect(rotuloDoPeriodo(filtros)).toBe('Outubro/2026')
    expect(rotuloDoPeriodo({ ...filtros, mes: null })).toBe('Esta semana')
  })
})
