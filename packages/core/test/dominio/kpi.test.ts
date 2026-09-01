import { describe, expect, test } from 'bun:test'
import { Limiar, avaliarKpi } from '../../src/dominio/kpi.ts'

const custoCarga: Limiar = { direcao: 'menor_melhor', limiteOk: 7, limiteAtencao: 9 }
const atraso: Limiar = { direcao: 'menor_melhor', limiteOk: 5, limiteAtencao: null }
const disponibilidade: Limiar = { direcao: 'maior_melhor', limiteOk: 95, limiteAtencao: 90 }

describe('avaliarKpi, menor_melhor', () => {
  test('as tres faixas', () => {
    expect(avaliarKpi(5, custoCarga)).toBe('ok')
    expect(avaliarKpi(8, custoCarga)).toBe('atencao')
    expect(avaliarKpi(12, custoCarga)).toBe('critico')
  })

  test('a fronteira e inclusiva nos dois limites', () => {
    expect(avaliarKpi(7, custoCarga)).toBe('ok')
    expect(avaliarKpi(9, custoCarga)).toBe('atencao')
  })

  test('os tres valores que hoje divergem entre dashboard, rotas e WhatsApp', () => {
    expect(avaliarKpi(7, custoCarga)).toBe('ok')
    expect(avaliarKpi(9, custoCarga)).toBe('atencao')
    expect(avaliarKpi(10, custoCarga)).toBe('critico')
  })

  test('sem faixa critica, o que passa do limite e atencao', () => {
    expect(avaliarKpi(5, atraso)).toBe('ok')
    expect(avaliarKpi(5.01, atraso)).toBe('atencao')
    expect(avaliarKpi(100, atraso)).toBe('atencao')
  })
})

describe('avaliarKpi, maior_melhor', () => {
  test('as tres faixas e as duas fronteiras', () => {
    expect(avaliarKpi(99, disponibilidade)).toBe('ok')
    expect(avaliarKpi(95, disponibilidade)).toBe('ok')
    expect(avaliarKpi(92, disponibilidade)).toBe('atencao')
    expect(avaliarKpi(90, disponibilidade)).toBe('atencao')
    expect(avaliarKpi(89.99, disponibilidade)).toBe('critico')
  })
})

test('valor nulo nunca vira cor', () => {
  expect(avaliarKpi(null, custoCarga)).toBe('sem_dado')
  expect(avaliarKpi(null, atraso)).toBe('sem_dado')
  expect(avaliarKpi(null, disponibilidade)).toBe('sem_dado')
})

// `avaliarKpi(8, { direcao: 'menor_melhor', limiteOk: 9, limiteAtencao: 7 })`
// respondia 'ok', e a faixa amarela ficava inalcancavel para qualquer valor.
describe('Limiar recusa o par de limites invertido', () => {
  test('em menor_melhor, atencao abaixo de ok nao passa', () => {
    const r = Limiar.safeParse({ direcao: 'menor_melhor', limiteOk: 9, limiteAtencao: 7 })
    expect(r.success).toBe(false)
    if (r.success) throw new Error('par invertido deveria falhar')
    expect(r.error.issues[0]?.path).toEqual(['limiteAtencao'])
  })

  test('em maior_melhor, atencao acima de ok nao passa', () => {
    expect(Limiar.safeParse({ direcao: 'maior_melhor', limiteOk: 90, limiteAtencao: 95 }).success).toBe(false)
  })

  test('a ordem certa e o limite unico continuam validos', () => {
    expect(Limiar.safeParse(custoCarga).success).toBe(true)
    expect(Limiar.safeParse(disponibilidade).success).toBe(true)
    expect(Limiar.safeParse(atraso).success).toBe(true)
  })

  test('limites iguais passam: a faixa do meio some, mas nenhuma some por engano', () => {
    expect(Limiar.safeParse({ direcao: 'menor_melhor', limiteOk: 7, limiteAtencao: 7 }).success).toBe(true)
  })
})
