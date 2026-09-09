import { describe, expect, test } from 'bun:test'
import {
  atualizarBase,
  atualizarColaborador,
  atualizarRota,
  atualizarVeiculo,
  criarBase,
  criarColaborador,
  criarRota,
  criarVeiculo,
  obterCadastro,
  FalhaDeCadastro,
  type EntradaBase,
  type EntradaColaborador,
  type EntradaRota,
  type EntradaVeiculo,
} from '../src/js/cadastro-api.ts'

type Pedido = { caminho: string; metodo: string; corpo: unknown }

function espiao(): { pedidos: Pedido[]; chamar: typeof fetch } {
  const pedidos: Pedido[] = []
  const chamar = async (entrada: string | URL | Request, init?: RequestInit) => {
    pedidos.push({
      caminho: entrada.toString(),
      metodo: init?.method ?? 'GET',
      corpo: init?.body === undefined ? null : JSON.parse(String(init.body)),
    })
    return Response.json({ id: 'a5a3d9e6-1a4e-4b7d-9a1c-2e3f4a5b6c7d' })
  }
  return { pedidos, chamar: chamar as typeof fetch }
}

const VEICULO: EntradaVeiculo = {
  placa: 'ZZC0001',
  marca: 'VW',
  modelo: 'Delivery',
  ano: '2020',
  baseId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  ativo: true,
}
const COLABORADOR: EntradaColaborador = {
  nome: 'Pessoa',
  cargo: null,
  funcao: 'motorista',
  admissao: null,
  baseId: VEICULO.baseId,
  ativo: true,
}
const ROTA: EntradaRota = { nome: 'ZZ ROTA', baseId: VEICULO.baseId, local: false, ativo: true }
const BASE: EntradaBase = { nome: 'ZZ Base', ativo: true }

describe('a tela de cadastro fala com a API', () => {
  test('o GET so pede o inativo quando mandam', async () => {
    const { pedidos, chamar } = espiao()
    await obterCadastro(false, chamar)
    await obterCadastro(true, chamar)
    expect(pedidos.map((item) => item.caminho)).toEqual([
      '/api/cadastro',
      '/api/cadastro?todos=1',
    ])
    expect(pedidos.every((item) => item.metodo === 'GET')).toBe(true)
  })

  test('criar é POST na coleção e editar é PUT no id', async () => {
    const { pedidos, chamar } = espiao()
    await criarVeiculo(VEICULO, chamar)
    await atualizarVeiculo('v1', VEICULO, chamar)
    await criarColaborador(COLABORADOR, chamar)
    await atualizarColaborador('c1', COLABORADOR, chamar)
    await criarRota(ROTA, chamar)
    await atualizarRota('r1', ROTA, chamar)
    await criarBase(BASE, chamar)
    await atualizarBase('b1', BASE, chamar)

    expect(pedidos).toEqual([
      { caminho: '/api/cadastro/veiculos', metodo: 'POST', corpo: VEICULO },
      { caminho: '/api/cadastro/veiculos/v1', metodo: 'PUT', corpo: VEICULO },
      { caminho: '/api/cadastro/colaboradores', metodo: 'POST', corpo: COLABORADOR },
      { caminho: '/api/cadastro/colaboradores/c1', metodo: 'PUT', corpo: COLABORADOR },
      { caminho: '/api/cadastro/rotas', metodo: 'POST', corpo: ROTA },
      { caminho: '/api/cadastro/rotas/r1', metodo: 'PUT', corpo: ROTA },
      { caminho: '/api/cadastro/bases', metodo: 'POST', corpo: BASE },
      { caminho: '/api/cadastro/bases/b1', metodo: 'PUT', corpo: BASE },
    ])
  })

  test('o id vai escapado, e o erro da API vira a mensagem do Error', async () => {
    const pedidos: string[] = []
    const chamar = (async (entrada: string | URL | Request) => {
      pedidos.push(entrada.toString())
      return Response.json({ erro: 'já existe um veículo com essa placa' }, { status: 409 })
    }) as typeof fetch

    await expect(criarVeiculo(VEICULO, chamar)).rejects.toThrow('já existe um veículo com essa placa')
    await atualizarRota('a/b?c', ROTA, chamar).catch(() => null)
    expect(pedidos).toContain('/api/cadastro/rotas/a%2Fb%3Fc')
  })

  test('o status da recusa chega junto com a mensagem', async () => {
    const recusa = (status: number, erro: string) =>
      (async () => Response.json({ erro }, { status })) as typeof fetch

    const conflito = await criarVeiculo(VEICULO, recusa(409, 'já existe um veículo com essa placa')).catch(
      (motivo: unknown) => motivo,
    )
    expect(conflito).toBeInstanceOf(FalhaDeCadastro)
    expect((conflito as FalhaDeCadastro).status).toBe(409)
    expect((conflito as FalhaDeCadastro).message).toBe('já existe um veículo com essa placa')

    const proibido = await atualizarBase('b1', BASE, recusa(403, 'só o admin mexe nas bases')).catch(
      (motivo: unknown) => motivo,
    )
    expect(proibido).toBeInstanceOf(FalhaDeCadastro)
    expect((proibido as FalhaDeCadastro).status).toBe(403)
    expect((proibido as FalhaDeCadastro).message).toBe('só o admin mexe nas bases')
  })
})
