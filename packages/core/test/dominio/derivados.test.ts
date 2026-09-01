import { describe, expect, test } from 'bun:test'
import {
  custoViagem,
  diasOficina,
  kmRodados,
  mediaKmL,
  pctCusto,
  pctQuebra,
  valorTotalParada,
} from '../../src/dominio/derivados.ts'
import { dataISO } from '../../src/dominio/tempo.ts'

describe('kmRodados', () => {
  test('chegada maior, igual e menor que a saida', () => {
    expect(kmRodados(120000, 120450)).toBe(450)
    expect(kmRodados(120000, 120000)).toBe(null)
    expect(kmRodados(120000, 119000)).toBe(null)
  })
})

describe('custoViagem', () => {
  test('soma e arredonda em duas casas', () => {
    expect(custoViagem(850.5, 120)).toBe(970.5)
    expect(custoViagem(0.005, 0.005)).toBe(0.01)
    expect(custoViagem(0, 0)).toBe(0)
  })
})

describe('pctCusto', () => {
  test('denominador zero nao vira zero por cento', () => {
    expect(pctCusto(970.5, 0)).toBe(null)
  })

  test('duas casas, igual ao Math.round do formulario', () => {
    expect(pctCusto(700, 10000)).toBe(7)
    expect(pctCusto(1234.56, 15000)).toBe(8.23)
  })
})

describe('valorTotalParada', () => {
  test('litros por valor do litro', () => {
    expect(valorTotalParada(123.45, 6.19)).toBe(764.16)
    expect(valorTotalParada(0, 6.19)).toBe(0)
  })
})

describe('mediaKmL', () => {
  test('sem km rodado ou sem litro nao ha media', () => {
    expect(mediaKmL(null, 100)).toBe(null)
    expect(mediaKmL(450, 0)).toBe(null)
  })

  test('duas casas', () => {
    expect(mediaKmL(450, 150)).toBe(3)
    expect(mediaKmL(1000, 333)).toBe(3)
    expect(mediaKmL(1000, 331)).toBe(3.02)
  })
})

describe('diasOficina', () => {
  test('sem saida a manutencao ainda esta em curso', () => {
    expect(diasOficina(dataISO('2026-08-25'), null)).toBe(null)
  })

  test('entrada e saida no mesmo dia dao zero', () => {
    expect(diasOficina(dataISO('2026-08-25'), dataISO('2026-08-25'))).toBe(0)
    expect(diasOficina(dataISO('2026-08-25'), dataISO('2026-09-02'))).toBe(8)
  })
})

describe('pctQuebra', () => {
  test('denominador zero nao vira zero por cento', () => {
    expect(pctQuebra(3, 0)).toBe(null)
  })

  test('duas casas', () => {
    expect(pctQuebra(12.5, 1000)).toBe(1.25)
    expect(pctQuebra(1, 3)).toBe(33.33)
  })
})
