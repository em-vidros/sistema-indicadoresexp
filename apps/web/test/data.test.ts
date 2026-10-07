import { expect, test } from 'bun:test'
import { hojeISO } from '../src/app/data.ts'

test('hoje segue o calendário local mesmo quando UTC já mudou de dia', () => {
  const agora = new Date(2026, 9, 7, 23, 30)
  expect(hojeISO(agora)).toBe('2026-10-07')
})
