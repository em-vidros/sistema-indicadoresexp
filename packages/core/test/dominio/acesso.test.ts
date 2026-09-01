import { describe, expect, test } from 'bun:test'
import { podeRegistrar } from '../../src/dominio/acesso.ts'
import type { Permissao } from '../../src/dominio/acesso.ts'
import { BaseId, criarId } from '../../src/dominio/ids.ts'

const raposa = criarId(BaseId, 'raposa')
const imperatriz = criarId(BaseId, 'imperatriz')

const admin: Permissao = { admin: true, bases: [], tipos: [] }
const andreina: Permissao = {
  admin: false,
  bases: [raposa],
  tipos: ['viagem', 'abastecimento'],
}

describe('podeRegistrar', () => {
  test('admin passa em tudo, mesmo sem base e sem tipo na lista', () => {
    expect(podeRegistrar(admin, raposa, 'viagem')).toBe(true)
    expect(podeRegistrar(admin, imperatriz, 'quebra')).toBe(true)
  })

  test('base certa e tipo certo', () => {
    expect(podeRegistrar(andreina, raposa, 'viagem')).toBe(true)
  })

  test('base certa com tipo errado', () => {
    expect(podeRegistrar(andreina, raposa, 'manutencao')).toBe(false)
  })

  test('base errada, ainda que o tipo esteja liberado', () => {
    expect(podeRegistrar(andreina, imperatriz, 'viagem')).toBe(false)
  })

  test('sem base nenhuma e sem admin, nada passa', () => {
    const nenhuma: Permissao = { admin: false, bases: [], tipos: ['viagem'] }
    expect(podeRegistrar(nenhuma, raposa, 'viagem')).toBe(false)
  })
})
