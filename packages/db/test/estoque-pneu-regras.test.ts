import { describe, expect, test } from 'bun:test'
import {
  MOTIVOS,
  motivoValido,
  normalizarMarca,
  normalizarMedida,
  novoSaldo,
  rotuloDaCondicao,
} from '../src/consultas/estoque-pneu-regras.ts'

describe('a escrita da medida e da marca', () => {
  test('a mesma medida escrita de jeitos diferentes vira uma só', () => {
    expect(normalizarMedida('295/80 r22.5')).toBe('295/80 R22.5')
    expect(normalizarMedida('  295/80   R22.5 ')).toBe('295/80 R22.5')
    expect(normalizarMarca(' michelin ')).toBe('MICHELIN')
    expect(normalizarMarca('')).toBe('')
  })

  test('a condição é lida como não recapado ou recapado N×', () => {
    expect(rotuloDaCondicao(0)).toBe('Não recapado')
    expect(rotuloDaCondicao(2)).toBe('Recapado 2×')
  })
})

describe('o saldo depois de uma movimentação', () => {
  test('caminho feliz: entrada soma, saída subtrai e o ajuste é a contagem', () => {
    expect(novoSaldo('entrada', 5, 3)).toEqual({ saldo: 8 })
    expect(novoSaldo('saida', 5, 3)).toEqual({ saldo: 2 })
    expect(novoSaldo('saida', 5, 5)).toEqual({ saldo: 0 })
    expect(novoSaldo('ajuste', 5, 12)).toEqual({ saldo: 12 })
    expect(novoSaldo('ajuste', 5, 0)).toEqual({ saldo: 0 })
  })

  test('falha 1: saída maior que o saldo é recusada, dizendo quanto há', () => {
    expect(novoSaldo('saida', 2, 3)).toEqual({
      erro: 'Só há 2 em estoque desta medida e condição; a saída de 3 deixaria o saldo negativo.',
    })
    expect(novoSaldo('saida', 0, 1)).toEqual({ erro: 'Não há pneus em estoque desta medida e condição.' })
  })

  test('falha 2: quantidade zero, negativa ou quebrada é recusada (só o ajuste aceita zero)', () => {
    expect(novoSaldo('entrada', 5, 0)).toEqual({ erro: 'A quantidade precisa ser maior que zero.' })
    expect(novoSaldo('saida', 5, 0)).toEqual({ erro: 'A quantidade precisa ser maior que zero.' })
    expect(novoSaldo('entrada', 5, -2)).toEqual({ erro: 'A quantidade precisa ser um número inteiro.' })
    expect(novoSaldo('entrada', 5, 1.5)).toEqual({ erro: 'A quantidade precisa ser um número inteiro.' })
    expect(novoSaldo('ajuste', 5, -1)).toEqual({ erro: 'A quantidade precisa ser um número inteiro.' })
  })
})

describe('os motivos de cada tipo', () => {
  test('cada tipo só aceita os seus motivos', () => {
    expect(motivoValido('entrada', 'compra')).toBe(true)
    expect(motivoValido('saida', 'instalado_veiculo')).toBe(true)
    expect(motivoValido('ajuste', 'inventario')).toBe(true)
    expect(motivoValido('entrada', 'instalado_veiculo')).toBe(false)
    expect(motivoValido('saida', 'compra')).toBe(false)
    expect(motivoValido('ajuste', 'compra')).toBe(false)
    expect(Object.keys(MOTIVOS)).toEqual(['entrada', 'saida', 'ajuste'])
  })
})
