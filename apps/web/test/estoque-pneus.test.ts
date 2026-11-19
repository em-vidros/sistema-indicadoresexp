import { describe, expect, test } from 'bun:test'
import {
  agruparEstoque,
  medidasDoEstoque,
  rotuloDoTipoDePneu,
  totaisDoEstoque,
} from '../src/dashboard/estoque-pneus.ts'
import { listarEstoque, listarMovimentos, registrarMovimento } from '../src/js/estoque-pneu-api.ts'
import type { LinhaDeEstoque } from '../src/js/estoque-pneu-api.ts'

const linha = (
  medida: string,
  marca: string,
  recapagens: number,
  quantidade: number,
  tipoPneu = 'misto',
): LinhaDeEstoque => ({
  id: `${medida}-${marca}-${tipoPneu}-${recapagens}`,
  base: 'Raposa',
  medida,
  marca,
  tipoPneu,
  recapagens,
  quantidade,
})

describe('o estoque em forma de tabela', () => {
  const linhas = [
    linha('295/80 R22.5', 'MICHELIN', 0, 6),
    linha('295/80 R22.5', 'MICHELIN', 1, 4),
    linha('295/80 R22.5', 'MICHELIN', 2, 2),
    linha('295/80 R22.5', '', 3, 1),
    linha('275/80 R22.5', 'PIRELLI', 0, 3, 'direcional'),
  ]

  test('caminho feliz: uma linha por medida, marca e tipo, uma coluna por condição', () => {
    const grupos = agruparEstoque(linhas)
    expect(grupos.map((g) => [g.medida, g.marca, g.tipoPneu, ...g.porCondicao, g.total])).toEqual([
      ['275/80 R22.5', 'PIRELLI', 'direcional', 3, 0, 0, 0, 3],
      ['295/80 R22.5', 'MICHELIN', 'misto', 6, 4, 2, 0, 12],
      ['295/80 R22.5', '', 'misto', 0, 0, 0, 1, 1],
    ])
  })

  test('o mesmo pneu de tipos diferentes são linhas diferentes, na ordem direcional, tração, misto e sem tipo', () => {
    const grupos = agruparEstoque([
      linha('295/80 R22.5', 'MICHELIN', 0, 1, ''),
      linha('295/80 R22.5', 'MICHELIN', 0, 2, 'misto'),
      linha('295/80 R22.5', 'MICHELIN', 0, 3, 'tracao'),
      linha('295/80 R22.5', 'MICHELIN', 1, 4, 'tracao'),
      linha('295/80 R22.5', 'MICHELIN', 0, 5, 'direcional'),
    ])
    expect(grupos.map((g) => [g.tipoPneu, g.total])).toEqual([
      ['direcional', 5],
      ['tracao', 7],
      ['misto', 2],
      ['', 1],
    ])
    expect(rotuloDoTipoDePneu('tracao')).toBe('Tração')
    expect(rotuloDoTipoDePneu('')).toBe('Sem tipo')
    expect(rotuloDoTipoDePneu(null)).toBe('Sem tipo')
  })

  test('os totais separam novos de recapados e abrem os recapados por número de recapagens', () => {
    expect(totaisDoEstoque(linhas)).toEqual({ total: 16, novos: 9, recapados: 7, porRecapagem: [4, 2, 1] })
  })

  test('falha: estoque vazio dá zeros, sem estourar', () => {
    expect(agruparEstoque([])).toEqual([])
    expect(totaisDoEstoque([])).toEqual({ total: 0, novos: 0, recapados: 0, porRecapagem: [0, 0, 0] })
    expect(medidasDoEstoque([])).toEqual([])
  })

  test('as medidas existentes saem sem repetir e em ordem', () => {
    expect(medidasDoEstoque(linhas)).toEqual(['275/80 R22.5', '295/80 R22.5'])
  })
})

describe('a aba Estoque fala com a API', () => {
  test('lê o saldo e o histórico da base, com o limite', async () => {
    const pedidos: string[] = []
    const chamar = async (recurso: string | URL | Request) => {
      pedidos.push(recurso.toString())
      return Response.json({ linhas: [], movimentos: [], temMais: false })
    }
    expect(await listarEstoque('Raposa', chamar)).toEqual([])
    await listarMovimentos('Raposa', 30, chamar)
    expect(pedidos).toEqual([
      '/api/estoque-pneus?base=Raposa',
      '/api/estoque-pneus/movimentos?base=Raposa&limite=30',
    ])
  })

  test('a movimentação vai por POST com o corpo, e a recusa chega com a frase do servidor', async () => {
    const corpos: unknown[] = []
    const aceita = async (_: string | URL | Request, init?: RequestInit) => {
      corpos.push({ metodo: init?.method, corpo: JSON.parse(String(init?.body)) })
      return Response.json(linha('295/80 R22.5', '', 0, 4), { status: 201 })
    }
    const entrada = {
      base: 'Raposa', medida: '295/80 R22.5', marca: '', tipoPneu: 'tracao', recapagens: 0, tipo: 'entrada' as const,
      quantidade: 4, motivo: 'compra', placa: null, observacao: null,
    }
    expect((await registrarMovimento(entrada, aceita)).quantidade).toBe(4)
    expect(corpos).toEqual([{ metodo: 'POST', corpo: entrada }])

    const recusa = async () =>
      Response.json({ erro: 'Só há 2 em estoque desta medida e condição' }, { status: 400 })
    await expect(registrarMovimento({ ...entrada, tipo: 'saida', motivo: 'sucata', quantidade: 3 }, recusa))
      .rejects.toThrow('Só há 2 em estoque')
  })
})
