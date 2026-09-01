import { describe, expect, test } from 'bun:test'
import { statusPreventiva } from '../../src/dominio/preventiva.ts'

const lavagem = { intervaloKm: 10000, alertaKm: 300 }

describe('statusPreventiva', () => {
  test('sem ultimo km nao ha o que calcular', () => {
    expect(statusPreventiva({ ...lavagem, ultimoKm: null, kmAtual: 120000 })).toBe('sem_dado')
    expect(statusPreventiva({ ...lavagem, ultimoKm: 0, kmAtual: 120000 })).toBe('sem_dado')
  })

  test('as tres faixas', () => {
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: 105000 })).toBe('ok')
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: 109800 })).toBe('proxima')
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: 111000 })).toBe('vencida')
  })

  test('as fronteiras', () => {
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: 109700 })).toBe('proxima')
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: 109699 })).toBe('ok')
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: 110000 })).toBe('vencida')
  })

  test('sem km atual, a referencia e o proprio ultimo km', () => {
    expect(statusPreventiva({ ...lavagem, ultimoKm: 100000, kmAtual: null })).toBe('ok')
    expect(statusPreventiva({ ultimoKm: 100000, kmAtual: null, intervaloKm: 200, alertaKm: 300 })).toBe('proxima')
  })

  test('o alerta de 200 do catalogo e o de 300 da Raposa mudam a resposta', () => {
    const catalogo = { ultimoKm: 100000, kmAtual: 109750, intervaloKm: 10000, alertaKm: 200 }
    expect(statusPreventiva(catalogo)).toBe('ok')
    expect(statusPreventiva({ ...catalogo, alertaKm: 300 })).toBe('proxima')
  })
})
