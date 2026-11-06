import { describe, expect, test } from 'bun:test'
import { gravarKmAtual, gravarPreventiva, obterPreventiva } from '../src/js/preventiva-api.ts'

describe('a tela de manutencao fala com a API', () => {
  test('le o plano e o catalogo do banco', async () => {
    const pedidos: string[] = []
    const chamar = async (recurso: string | URL | Request) => {
      pedidos.push(recurso.toString())
      return Response.json({ tipos: [], veiculos: [] })
    }
    expect(await obterPreventiva(chamar)).toEqual({ tipos: [], veiculos: [] })
    expect(pedidos).toEqual(['/api/preventiva'])
  })

  // O GET manda os tres, e o tipo do front tem que dizer o mesmo. A tabela da manutencao
  // escreve o modelo na coluna "Modelo"; sem esta prova, um deles some do tipo e a coluna
  // fica vazia sem nada reclamar.
  test('o veiculo do plano traz modelo, marca e ano', async () => {
    const veiculo = {
      id: 'd84e0e82-b094-55ad-bb3e-f6cdf910a208',
      placa: 'PTV0006',
      base: 'Raposa',
      modelo: 'ATEGO 3030 CE',
      marca: 'Mercedes-Benz',
      ano: '2019/2020',
      itens: [],
    }
    const chamar = async () => Response.json({ tipos: [], veiculos: [veiculo] })
    const plano = await obterPreventiva(chamar)
    expect(plano.veiculos[0]).toEqual(veiculo)
  })

  test('grava o plano inteiro do veiculo num PUT so', async () => {
    const pedidos: Array<{ caminho: string; metodo: string; corpo: BodyInit | null | undefined }> = []
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedidos.push({ caminho: recurso.toString(), metodo: init?.method ?? 'GET', corpo: init?.body })
      return Response.json({ id: 'x', placa: 'PTV0006', base: 'Raposa', itens: [] })
    }
    const id = 'd84e0e82-b094-55ad-bb3e-f6cdf910a208'

    await gravarPreventiva(
      id,
      [{ tipo: 'Lavagem', intervalo_km: 3000, alerta_km: 300, ultimo_km: 408413, obs: null }],
      chamar,
    )

    expect(pedidos[0]?.caminho).toBe(`/api/preventiva/${id}`)
    expect(pedidos[0]?.metodo).toBe('PUT')
    expect(JSON.parse(String(pedidos[0]?.corpo))).toEqual({
      itens: [{ tipo: 'Lavagem', intervalo_km: 3000, alerta_km: 300, ultimo_km: 408413, obs: null }],
    })
  })

  // Lista vazia e o usuario removendo o ultimo item, e nao um pedido a ignorar: se o
  // modulo pulasse o PUT aqui, o item removido voltaria no proximo carregamento.
  test('a lista vazia tambem vai para o servidor', async () => {
    let corpo: BodyInit | null | undefined
    const chamar = async (_recurso: string | URL | Request, init?: RequestInit) => {
      corpo = init?.body
      return Response.json({ id: 'x', placa: 'PTV0006', base: 'Raposa', itens: [] })
    }
    await gravarPreventiva('d84e0e82-b094-55ad-bb3e-f6cdf910a208', [], chamar)
    expect(JSON.parse(String(corpo))).toEqual({ itens: [] })
  })

  // A tela avisa a pessoa com o texto que a API mandou. Erro engolido aqui viraria
  // "salvei" na tela e nada no banco, que e o defeito que esta fase esta tirando.
  test('a recusa da API vira erro com o motivo dela', async () => {
    const chamar = async () => Response.json({ erro: 'operação não permitida' }, { status: 403 })
    expect(gravarPreventiva('d84e0e82-b094-55ad-bb3e-f6cdf910a208', [], chamar)).rejects.toThrow(
      'operação não permitida',
    )
  })
})

describe('a aba KM atual fala com a API', () => {
  const id = 'd84e0e82-b094-55ad-bb3e-f6cdf910a208'

  test('grava o km num PUT para a rota do veiculo', async () => {
    const pedidos: Array<{ caminho: string; metodo: string; corpo: BodyInit | null | undefined }> = []
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedidos.push({ caminho: recurso.toString(), metodo: init?.method ?? 'GET', corpo: init?.body })
      return Response.json({ id, placa: 'PTV0006', km_atual: 424638, km_atual_em: '2026-11-06T12:00:00.000Z' })
    }
    const salvo = await gravarKmAtual(id, 424638, chamar)
    expect(pedidos[0]?.caminho).toBe(`/api/preventiva/${id}/km`)
    expect(pedidos[0]?.metodo).toBe('PUT')
    expect(JSON.parse(String(pedidos[0]?.corpo))).toEqual({ km: 424638 })
    expect(salvo.km_atual).toBe(424638)
  })

  // Limpar e um pedido de verdade: se o modulo pulasse o PUT com `null`, o veiculo voltaria
  // ao km manual no proximo carregamento.
  test('km nulo tambem vai para o servidor, para limpar', async () => {
    let corpo: BodyInit | null | undefined
    const chamar = async (_recurso: string | URL | Request, init?: RequestInit) => {
      corpo = init?.body
      return Response.json({ id, placa: 'PTV0006', km_atual: null, km_atual_em: null })
    }
    await gravarKmAtual(id, null, chamar)
    expect(JSON.parse(String(corpo))).toEqual({ km: null })
  })

  test('a recusa da API vira erro com o motivo dela', async () => {
    const chamar = async () => Response.json({ erro: 'km inválido' }, { status: 400 })
    expect(gravarKmAtual(id, 0, chamar)).rejects.toThrow('km inválido')
  })
})
