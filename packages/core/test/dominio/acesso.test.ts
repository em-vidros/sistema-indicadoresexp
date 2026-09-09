import { describe, expect, test } from 'bun:test'
import { CAPACIDADES, Papel, baseFixaCoerente, podeRegistrar } from '../../src/dominio/acesso.ts'
import type { Permissao } from '../../src/dominio/acesso.ts'
import { BaseId, criarId } from '../../src/dominio/ids.ts'

const raposa = criarId(BaseId, 'raposa')
const imperatriz = criarId(BaseId, 'imperatriz')

const admin: Permissao = { papel: 'admin', bases: [], tipos: [] }
const gestor: Permissao = {
  papel: 'gestor',
  bases: [raposa],
  tipos: ['viagem', 'abastecimento', 'manutencao', 'quebra'],
}
const operador: Permissao = {
  papel: 'operador',
  bases: [raposa],
  tipos: ['viagem', 'abastecimento'],
}

describe('CAPACIDADES', () => {
  test('os tres papeis do enum estao na tabela, e so eles', () => {
    expect(Object.keys(CAPACIDADES).sort()).toEqual([...Papel.options].sort())
  })

  test('so o admin gerencia usuarios, e operador nao edita cadastro', () => {
    expect(CAPACIDADES.admin).toEqual({
      todasAsBases: true,
      gerenciaUsuarios: true,
      editaCadastro: true,
    })
    expect(CAPACIDADES.gestor.gerenciaUsuarios).toBe(false)
    expect(CAPACIDADES.gestor.editaCadastro).toBe(true)
    expect(CAPACIDADES.operador.editaCadastro).toBe(false)
  })

  /**
   * O CHECK `user_papel_base_ck` compara com `'admin'` literal, porque SQL nao le
   * esta tabela. Enquanto admin for o unico papel com `todasAsBases`, as duas
   * frases dizem o mesmo. Este teste e o que avisa no dia em que deixarem: quem
   * marcar `todasAsBases` no gestor quebra aqui, e nao seis meses depois num
   * INSERT recusado em producao.
   */
  test('admin e o unico papel com todasAsBases, que e o que o CHECK do banco assume', () => {
    const comTodas = Papel.options.filter((papel) => CAPACIDADES[papel].todasAsBases)
    expect(comTodas).toEqual(['admin'])
  })
})

describe('baseFixaCoerente', () => {
  test('admin sem base passa, admin com base nao', () => {
    expect(baseFixaCoerente('admin', false)).toBe(true)
    expect(baseFixaCoerente('admin', true)).toBe(false)
  })

  test('gestor e operador precisam de base fixa', () => {
    expect(baseFixaCoerente('gestor', true)).toBe(true)
    expect(baseFixaCoerente('gestor', false)).toBe(false)
    expect(baseFixaCoerente('operador', true)).toBe(true)
    expect(baseFixaCoerente('operador', false)).toBe(false)
  })
})

describe('podeRegistrar', () => {
  test('admin passa em tudo, mesmo sem base e sem tipo na lista', () => {
    expect(podeRegistrar(admin, raposa, 'viagem')).toBe(true)
    expect(podeRegistrar(admin, imperatriz, 'quebra')).toBe(true)
  })

  test('gestor passa na base dele, e nao na de fora', () => {
    expect(podeRegistrar(gestor, raposa, 'manutencao')).toBe(true)
    expect(podeRegistrar(gestor, imperatriz, 'manutencao')).toBe(false)
  })

  test('base certa e tipo certo', () => {
    expect(podeRegistrar(operador, raposa, 'viagem')).toBe(true)
  })

  test('base certa com tipo errado', () => {
    expect(podeRegistrar(operador, raposa, 'manutencao')).toBe(false)
  })

  test('base errada, ainda que o tipo esteja liberado', () => {
    expect(podeRegistrar(operador, imperatriz, 'viagem')).toBe(false)
  })

  test('sem base nenhuma e sem ser admin, nada passa', () => {
    const nenhuma: Permissao = { papel: 'operador', bases: [], tipos: ['viagem'] }
    expect(podeRegistrar(nenhuma, raposa, 'viagem')).toBe(false)
  })
})
