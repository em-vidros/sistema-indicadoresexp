import { describe, expect, test } from 'bun:test'
import { DataISO, HoraHM, dataISO, diasEntre, instante, minutosEntre } from '../../src/dominio/tempo.ts'

describe('parse', () => {
  test('aceita o formato e recusa o resto', () => {
    expect(DataISO.safeParse('2026-08-31').success).toBe(true)
    expect(DataISO.safeParse('31/08/2026').success).toBe(false)
    expect(DataISO.safeParse('2026-02-30').success).toBe(false)
    expect(DataISO.safeParse('2026-13-01').success).toBe(false)
    expect(HoraHM.safeParse('07:05').success).toBe(true)
    expect(HoraHM.safeParse('24:00').success).toBe(false)
    expect(HoraHM.safeParse('7:05').success).toBe(false)
  })

  test('29 de fevereiro so existe em ano bissexto', () => {
    expect(DataISO.safeParse('2028-02-29').success).toBe(true)
    expect(DataISO.safeParse('2026-02-29').success).toBe(false)
    expect(DataISO.safeParse('2100-02-29').success).toBe(false)
    expect(DataISO.safeParse('2000-02-29').success).toBe(true)
  })
})

describe('diasEntre', () => {
  test('sinal, virada de mes e virada de ano', () => {
    expect(diasEntre(dataISO('2026-08-31'), dataISO('2026-09-01'))).toBe(1)
    expect(diasEntre(dataISO('2026-09-01'), dataISO('2026-08-31'))).toBe(-1)
    expect(diasEntre(dataISO('2026-12-31'), dataISO('2027-01-01'))).toBe(1)
    expect(diasEntre(dataISO('2026-01-01'), dataISO('2026-01-01'))).toBe(0)
    expect(diasEntre(dataISO('2026-01-01'), dataISO('2027-01-01'))).toBe(365)
  })

  test('nao depende do fuso da maquina', () => {
    expect(diasEntre(dataISO('2026-03-01'), dataISO('2026-03-02'))).toBe(1)
    expect(diasEntre(dataISO('1999-12-31'), dataISO('2000-03-01'))).toBe(61)
  })
})

describe('minutosEntre', () => {
  test('dentro do mesmo dia', () => {
    expect(minutosEntre(instante('2026-08-31', '08:00'), instante('2026-08-31', '09:30'))).toBe(90)
    expect(minutosEntre(instante('2026-08-31', '09:30'), instante('2026-08-31', '08:00'))).toBe(-90)
  })

  test('a viagem que chega no dia seguinte', () => {
    expect(minutosEntre(instante('2026-08-31', '22:00'), instante('2026-09-01', '02:00'))).toBe(240)
    expect(minutosEntre(instante('2026-08-31', '23:59'), instante('2026-09-01', '00:00'))).toBe(1)
  })
})
