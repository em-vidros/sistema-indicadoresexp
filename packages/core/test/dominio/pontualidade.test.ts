import { describe, expect, test } from 'bun:test'
import { classificarPontualidade } from '../../src/dominio/pontualidade.ts'
import { instante } from '../../src/dominio/tempo.ts'

const TOLERANCIA = 15

describe('classificarPontualidade', () => {
  test('dentro da tolerancia, nos dois sentidos, e no prazo', () => {
    const previsto = instante('2026-08-31', '14:00')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '14:00'), TOLERANCIA)).toBe('no_prazo')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '14:15'), TOLERANCIA)).toBe('no_prazo')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '13:45'), TOLERANCIA)).toBe('no_prazo')
  })

  test('fora da tolerancia', () => {
    const previsto = instante('2026-08-31', '14:00')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '14:16'), TOLERANCIA)).toBe('atrasado')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '13:44'), TOLERANCIA)).toBe('adiantado')
  })

  test('chegada no dia seguinte', () => {
    const previsto = instante('2026-08-31', '23:50')
    expect(classificarPontualidade(previsto, instante('2026-09-01', '00:00'), TOLERANCIA)).toBe('no_prazo')
    expect(classificarPontualidade(previsto, instante('2026-09-01', '00:30'), TOLERANCIA)).toBe('atrasado')
  })

  test('previsao no dia seguinte e chegada no mesmo dia da saida', () => {
    expect(
      classificarPontualidade(instante('2026-09-01', '06:00'), instante('2026-08-31', '23:00'), TOLERANCIA),
    ).toBe('adiantado')
  })

  test('tolerancia zero cobra o minuto exato', () => {
    const previsto = instante('2026-08-31', '14:00')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '14:00'), 0)).toBe('no_prazo')
    expect(classificarPontualidade(previsto, instante('2026-08-31', '14:01'), 0)).toBe('atrasado')
  })
})
