import { describe, expect, test } from 'bun:test'
import { apagarRegistrosDoDia, listarRegistros, salvarRegistros } from '../src/js/registros-api.ts'

describe('as três telas de indicadores usam a mesma API', () => {
  test('lê e grava lotes no banco', async () => {
    const pedidos: Array<{ caminho: string; metodo: string }> = []
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedidos.push({ caminho: recurso.toString(), metodo: init?.method ?? 'GET' })
      return Response.json([])
    }
    await listarRegistros('Raposa', chamar)
    await salvarRegistros([{ tipo: 'quebra', base: 'Raposa' }], chamar)
    expect(pedidos).toEqual([
      { caminho: '/api/registros?base=Raposa', metodo: 'GET' },
      { caminho: '/api/registros', metodo: 'POST' },
    ])
  })

  test('a limpeza do dia manda base e data na query, e nao no corpo', async () => {
    let pedido = { caminho: '', metodo: '', corpo: undefined as BodyInit | null | undefined }
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedido = { caminho: recurso.toString(), metodo: init?.method ?? 'GET', corpo: init?.body }
      return Response.json({ apagados: 3 })
    }
    const saida = await apagarRegistrosDoDia('Belém', '2026-09-01', chamar)
    expect(pedido.caminho).toBe('/api/registros?base=Bel%C3%A9m&data=2026-09-01')
    expect(pedido.metodo).toBe('DELETE')
    expect(pedido.corpo).toBeUndefined()
    expect(saida.apagados).toBe(3)
  })

  test('recusa da API vira erro com o texto da API, e nao limpeza silenciosa', async () => {
    const chamar = async () => Response.json({ erro: 'operação não permitida' }, { status: 403 })
    expect(apagarRegistrosDoDia('Imperatriz', '2026-09-01', chamar)).rejects.toThrow('operação não permitida')
  })
})
