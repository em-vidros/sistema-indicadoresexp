import { describe, expect, test } from 'bun:test'
import { fecharMes, listarFechamentos, reabrirMes } from '../src/js/fechamentos-api.ts'

describe('fechamentos-api fala com /api/fechamentos', () => {
  test('lista os fechamentos por base', async () => {
    const chamar = async () => Response.json({ Raposa: [{ id: 'f1', mes: '2026-07-01', fechadoEm: '2026-08-01T00:00:00Z', fechadoPor: 'usr_livia' }] })
    const saida = await listarFechamentos(chamar)
    expect(saida['Raposa']).toHaveLength(1)
  })

  test('fechar manda base e mês no corpo, por POST', async () => {
    let pedido = { caminho: '', metodo: '', corpo: undefined as BodyInit | null | undefined }
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedido = { caminho: recurso.toString(), metodo: init?.method ?? 'GET', corpo: init?.body }
      return Response.json({ id: 'f1' })
    }
    const saida = await fecharMes('Raposa', '2026-07', chamar)
    expect(pedido.caminho).toBe('/api/fechamentos')
    expect(pedido.metodo).toBe('POST')
    expect(pedido.corpo).toBe(JSON.stringify({ base: 'Raposa', mes: '2026-07' }))
    expect(saida.id).toBe('f1')
  })

  test('reabrir manda o id na URL, por DELETE', async () => {
    let pedido = { caminho: '', metodo: '' }
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedido = { caminho: recurso.toString(), metodo: init?.method ?? 'GET' }
      return new Response(null, { status: 204 })
    }
    await reabrirMes('f1', chamar)
    expect(pedido.caminho).toBe('/api/fechamentos/f1')
    expect(pedido.metodo).toBe('DELETE')
  })

  test('recusa da API vira erro com o texto da API', async () => {
    const chamar = async () => Response.json({ erro: 'só o administrador fecha o mês' }, { status: 403 })
    expect(fecharMes('Raposa', '2026-07', chamar)).rejects.toThrow('só o administrador fecha o mês')
  })
})
