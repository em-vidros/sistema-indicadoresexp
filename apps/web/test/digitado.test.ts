import { describe, expect, test } from 'bun:test'
import { lerDinheiro, lerNumero } from '../src/dashboard/digitado.ts'

describe('lerNumero', () => {
  test('ponto de milhar não vira decimal', () => {
    expect(lerNumero('1.500')).toBe(1500)
    expect(lerNumero('12.345.678')).toBe(12345678)
  })

  test('milhar com vírgula decimal', () => {
    expect(lerNumero('1.234,56')).toBe(1234.56)
    expect(lerNumero('R$ 2.300,90')).toBe(2300.9)
  })

  test('só vírgula é decimal', () => {
    expect(lerNumero('1500,5')).toBe(1500.5)
    expect(lerNumero('0,75')).toBe(0.75)
  })

  test('ponto decimal do campo numérico continua decimal', () => {
    expect(lerNumero('12.5')).toBe(12.5)
    expect(lerNumero('1500.50')).toBe(1500.5)
    expect(lerNumero('1234')).toBe(1234)
  })

  test('valor por litro com três casas não vira milhar', () => {
    expect(lerNumero('5.899', { milhar: false })).toBe(5.899)
    expect(lerNumero('5,899', { milhar: false })).toBe(5.899)
  })

  test('vazio e lixo viram zero', () => {
    expect(lerNumero('')).toBe(0)
    expect(lerNumero('abc')).toBe(0)
    expect(lerNumero('1,2,3')).toBe(0)
  })
})

describe('lerDinheiro', () => {
  test('zero é um valor e texto inválido não vira manutenção gratuita', () => {
    expect(lerDinheiro('0')).toBe(0)
    expect(lerDinheiro('R$ 0,00')).toBe(0)
    expect(lerDinheiro('abc')).toBeNull()
    expect(lerDinheiro('R$')).toBeNull()
    expect(lerDinheiro('abc3')).toBeNull()
    expect(lerDinheiro('1,2,3')).toBeNull()
  })
  test('aceita dinheiro brasileiro e valor decimal da edição', () => {
    expect(lerDinheiro('R$ 1.234,56')).toBe(1234.56)
    expect(lerDinheiro('2480.50')).toBe(2480.5)
  })
})
