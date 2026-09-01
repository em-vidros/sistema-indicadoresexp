import { describe, expect, test } from 'bun:test'
import { BaseId, MetaChave, VeiculoId, criarId } from '../../src/dominio/ids.ts'

describe('ids marcados', () => {
  test('constroi e devolve o valor cru', () => {
    const base: string = criarId(BaseId, 'raposa')
    const chave: string = criarId(MetaChave, 'custo_carga')
    expect(base).toBe('raposa')
    expect(chave).toBe('custo_carga')
  })

  test('apara o espaco em volta', () => {
    const base: string = criarId(BaseId, '  raposa  ')
    expect(base).toBe('raposa')
  })

  test('recusa vazio e so espaco', () => {
    expect(BaseId.safeParse('').success).toBe(false)
    expect(BaseId.safeParse('   ').success).toBe(false)
    expect(() => criarId(VeiculoId, '')).toThrow()
  })

  test('a marca nao deixa um id passar por outro', () => {
    const base = criarId(BaseId, 'raposa')
    const cru: string = base
    const soVeiculo = (v: VeiculoId): VeiculoId => v
    // @ts-expect-error BaseId nao e VeiculoId
    soVeiculo(base)
    expect(cru).toBe('raposa')
  })
})
