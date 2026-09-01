import { describe, expect, test } from 'bun:test'
import { dataISO } from '../../src/dominio/tempo.ts'
import { statusVencimento } from '../../src/dominio/vencimento.ts'

const hoje = dataISO('2026-08-31')

describe('statusVencimento', () => {
  test('no dia exato do vencimento ainda e alerta, nao vencido', () => {
    expect(statusVencimento(hoje, dataISO('2026-08-31'), 60)).toBe('alerta')
  })

  test('um dia depois ja e vencido', () => {
    expect(statusVencimento(hoje, dataISO('2026-08-30'), 60)).toBe('vencido')
  })

  test('o primeiro dia da janela de alerta', () => {
    expect(statusVencimento(hoje, dataISO('2026-10-30'), 60)).toBe('alerta')
    expect(statusVencimento(hoje, dataISO('2026-10-31'), 60)).toBe('ok')
  })

  test('a janela de 30 dias do tacografo', () => {
    expect(statusVencimento(hoje, dataISO('2026-09-30'), 30)).toBe('alerta')
    expect(statusVencimento(hoje, dataISO('2026-10-01'), 30)).toBe('ok')
  })

  // Espelha o 'sem-data' de documentos-frota.html, linha 295. Os 7 tacografos do
  // parque nao tem data de vencimento, e nenhum deles e "ok".
  test('sem data de vencimento o status e sem_dado', () => {
    expect(statusVencimento(hoje, null, 60)).toBe('sem_dado')
    expect(statusVencimento(hoje, null, 0)).toBe('sem_dado')
  })

  test('alerta de zero dia so pega o proprio dia', () => {
    expect(statusVencimento(hoje, dataISO('2026-08-31'), 0)).toBe('alerta')
    expect(statusVencimento(hoje, dataISO('2026-09-01'), 0)).toBe('ok')
  })
})
