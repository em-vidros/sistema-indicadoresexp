import { describe, expect, test } from 'bun:test'
import { diaMesDe, diferencas, textoDe } from '../src/consultas/atividades-texto.ts'

describe('o texto do registro de atividades', () => {
  test('datas, horas e números saem como a pessoa lê', () => {
    expect(textoDe('2026-10-14')).toBe('14/10/2026')
    expect(textoDe('08:30:00')).toBe('08:30')
    expect(textoDe('6.100')).toBe('6,1')
    expect(textoDe('163500')).toBe('163500')
    expect(textoDe('SMP6F86')).toBe('SMP6F86')
  })

  test('vazio, nulo e só espaços viram o traço', () => {
    expect(textoDe(null)).toBe('—')
    expect(textoDe(undefined)).toBe('—')
    expect(textoDe('   ')).toBe('—')
  })

  test('o dia e o mês de uma data ISO', () => {
    expect(diaMesDe('2026-10-14')).toBe('14/10')
    expect(diaMesDe('lixo')).toBe('lixo')
  })
})

describe('o que mudou entre dois retratos', () => {
  const antes = { 'Km de chegada': '163500', Rota: 'PINHEIRO', Motorista: 'Ana' }

  test('caminho feliz: só o campo que mudou, com antes e depois', () => {
    expect(diferencas(antes, { ...antes, 'Km de chegada': '154559' })).toEqual([
      { campo: 'Km de chegada', antes: '163500', depois: '154559' },
    ])
  })

  test('falha 1: retratos iguais não geram mudança nenhuma', () => {
    expect(diferencas(antes, { ...antes })).toEqual([])
  })

  test('falha 2: campo que apareceu ou sumiu conta como mudança, com traço do lado vazio', () => {
    expect(diferencas({ A: '1' }, { A: '1', B: '2' })).toEqual([{ campo: 'B', antes: '—', depois: '2' }])
    expect(diferencas({ A: '1', B: '2' }, { A: '1' })).toEqual([{ campo: 'B', antes: '2', depois: '—' }])
  })
})
