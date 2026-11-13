import { describe, expect, test } from 'bun:test'
import { listarAtividades } from '../src/js/atividades-api.ts'

describe('a tela de atividades fala com a API', () => {
  test('sem filtro pede a lista inteira, sem query', async () => {
    const pedidos: string[] = []
    const chamar = async (recurso: string | URL | Request) => {
      pedidos.push(recurso.toString())
      return Response.json({ atividades: [], temMais: false })
    }
    expect(await listarAtividades({}, chamar)).toEqual({ atividades: [], temMais: false })
    expect(pedidos).toEqual(['/api/atividades'])
  })

  test('base, tipo e deslocamento vão na query', async () => {
    const pedidos: string[] = []
    const chamar = async (recurso: string | URL | Request) => {
      pedidos.push(recurso.toString())
      return Response.json({ atividades: [], temMais: true })
    }
    await listarAtividades({ base: 'Raposa', tipo: 'viagem', deslocamento: 50 }, chamar)
    expect(pedidos).toEqual(['/api/atividades?base=Raposa&tipo=viagem&deslocamento=50'])
  })

  test('recusa do servidor vira erro com a mensagem dele', async () => {
    const chamar = async () => Response.json({ erro: 'sem permissão para ver as atividades' }, { status: 403 })
    await expect(listarAtividades({}, chamar)).rejects.toThrow('sem permissão para ver as atividades')
  })
})
