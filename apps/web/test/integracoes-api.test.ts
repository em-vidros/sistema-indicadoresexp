import { describe, expect, test } from 'bun:test'
import {
  listarIntegracoes,
  obterCatalogoIntegracoes,
  salvarIntegracao,
  type EntradaIntegracao,
} from '../src/js/integracoes-api.ts'

describe('a tela de integracao fala com a API', () => {
  test('le catalogo e historico sem consultar localStorage', async () => {
    const pedidos: string[] = []
    const chamar = async (entrada: string | URL | Request) => {
      const caminho = typeof entrada === 'string' ? entrada : entrada.toString()
      pedidos.push(caminho)
      return Response.json(caminho.endsWith('/catalogo') ? { programas: [], colaboradores: [] } : [])
    }

    expect(await obterCatalogoIntegracoes(chamar)).toEqual({ programas: [], colaboradores: [] })
    expect(await listarIntegracoes(chamar)).toEqual([])
    expect(pedidos).toEqual(['/api/integracoes/catalogo', '/api/integracoes'])
  })

  test('cria na primeira vez e atualiza o mesmo id nas seguintes', async () => {
    const pedidos: Array<{ caminho: string; metodo: string; corpo: unknown }> = []
    const chamar = async (entrada: string | URL | Request, init?: RequestInit) => {
      pedidos.push({
        caminho: entrada.toString(),
        metodo: init?.method ?? 'GET',
        corpo: JSON.parse(String(init?.body)),
      })
      return Response.json({ id: '07f76855-e566-41a6-80b2-a223309fe48e' })
    }
    const corpo: EntradaIntegracao = {
      colaboradorId: null,
      nome: 'Pessoa',
      cargo: null,
      admissao: null,
      programaId: '7302d573-d1e6-42cd-b68f-5ea980476320',
      inicio: null,
      coord: null,
      gerente: null,
      rh: null,
      atividades: [],
    }

    await salvarIntegracao(null, corpo, chamar)
    await salvarIntegracao('07f76855-e566-41a6-80b2-a223309fe48e', corpo, chamar)

    expect(pedidos).toEqual([
      { caminho: '/api/integracoes', metodo: 'POST', corpo },
      {
        caminho: '/api/integracoes/07f76855-e566-41a6-80b2-a223309fe48e',
        metodo: 'PUT',
        corpo,
      },
    ])
  })
})
