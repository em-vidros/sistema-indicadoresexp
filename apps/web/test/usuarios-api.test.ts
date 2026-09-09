import { describe, expect, test } from 'bun:test'
import {
  FalhaDeUsuarios,
  apagarUsuario,
  criarUsuario,
  gerarConvite,
  listarUsuarios,
  salvarUsuarios,
  type MudancaDeUsuario,
  type NovoUsuario,
} from '../src/js/usuarios-api.ts'

type Pedido = { caminho: string; metodo: string; corpo: unknown }

function espiao(resposta: unknown = { ok: true }): { pedidos: Pedido[]; chamar: typeof fetch } {
  const pedidos: Pedido[] = []
  const chamar = async (entrada: string | URL | Request, init?: RequestInit) => {
    pedidos.push({
      caminho: entrada.toString(),
      metodo: init?.method ?? 'GET',
      corpo: init?.body === undefined ? null : JSON.parse(String(init.body)),
    })
    return Response.json(resposta)
  }
  return { pedidos, chamar: chamar as typeof fetch }
}

const CONVITE = { url: '/entrar.html?convite=abc123', expiraEm: '2026-09-16T12:00:00.000Z' }

const OPERADOR: NovoUsuario = {
  usuario: 'marcos',
  nome: 'Marcos Silva',
  papel: 'operador',
  baseFixa: 'Raposa',
  bases: ['Raposa'],
  tipos: ['viagem', 'abastecimento'],
}

const ADMIN: NovoUsuario = {
  usuario: 'livia',
  nome: 'Livia',
  papel: 'admin',
  bases: ['Belém', 'Imperatriz', 'Raposa'],
  tipos: ['viagem'],
}

describe('a tela de usuarios fala com a API', () => {
  test('a lista é um GET seco', async () => {
    const { pedidos, chamar } = espiao([])
    await listarUsuarios(chamar)
    expect(pedidos).toEqual([{ caminho: '/api/usuarios', metodo: 'GET', corpo: null }])
  })

  test('criar é POST na coleção, e o corpo não leva senha nenhuma', async () => {
    const { pedidos, chamar } = espiao({ usuario: 'marcos', convite: CONVITE })
    const resposta = await criarUsuario(OPERADOR, chamar)

    expect(pedidos).toEqual([{ caminho: '/api/usuarios', metodo: 'POST', corpo: OPERADOR }])
    expect(Object.keys(pedidos[0]?.corpo as object)).not.toContain('senha')
    expect(resposta.convite).toEqual(CONVITE)
  })

  test('o admin sai sem baseFixa no corpo, porque o servidor a proíbe nele', async () => {
    const { pedidos, chamar } = espiao({ usuario: 'livia', convite: CONVITE })
    await criarUsuario(ADMIN, chamar)
    expect(Object.keys(pedidos[0]?.corpo as object)).not.toContain('baseFixa')
  })

  test('salvar é um PUT com o array de mudanças, e não uma chamada por pessoa', async () => {
    const mudancas: readonly MudancaDeUsuario[] = [
      { usuario: 'marcos', nome: 'Marcos Silva', papel: 'gestor', baseFixa: 'Raposa' },
      { usuario: 'livia', nome: 'Livia', papel: 'admin', baseFixa: null },
    ]
    const { pedidos, chamar } = espiao()
    await salvarUsuarios(mudancas, chamar)
    expect(pedidos).toEqual([{ caminho: '/api/usuarios', metodo: 'PUT', corpo: mudancas }])
  })

  test('o link novo é um POST no login, e volta só o convite', async () => {
    const { pedidos, chamar } = espiao({ usuario: 'marcos', convite: CONVITE })
    const convite = await gerarConvite('marcos', chamar)
    expect(pedidos).toEqual([{ caminho: '/api/usuarios/marcos/convite', metodo: 'POST', corpo: null }])
    expect(convite).toEqual(CONVITE)
  })

  test('o login vai escapado na URL, no link novo e no apagar', async () => {
    const { pedidos, chamar } = espiao({ convite: CONVITE })
    await gerarConvite('a/b?c', chamar)
    await apagarUsuario('a/b?c', chamar)
    expect(pedidos.map((p) => p.caminho)).toEqual([
      '/api/usuarios/a%2Fb%3Fc/convite',
      '/api/usuarios/a%2Fb%3Fc',
    ])
    expect(pedidos[1]?.metodo).toBe('DELETE')
  })

  test('a recusa da API vira a mensagem do Error, com o status junto', async () => {
    const recusar = (status: number, erro: string) =>
      (async () => Response.json({ erro }, { status })) as typeof fetch

    const conflito = await criarUsuario(OPERADOR, recusar(409, "usuario 'marcos' ja existe")).catch(
      (motivo: unknown) => motivo,
    )
    expect(conflito).toBeInstanceOf(FalhaDeUsuarios)
    expect((conflito as FalhaDeUsuarios).status).toBe(409)
    expect((conflito as FalhaDeUsuarios).message).toBe("usuario 'marcos' ja existe")

    const ultimo = await apagarUsuario('livia', recusar(400, 'nao da para apagar o ultimo admin')).catch(
      (motivo: unknown) => motivo,
    )
    expect(ultimo).toBeInstanceOf(FalhaDeUsuarios)
    expect((ultimo as FalhaDeUsuarios).status).toBe(400)
    expect((ultimo as FalhaDeUsuarios).message).toBe('nao da para apagar o ultimo admin')
  })

  test('recusa sem corpo JSON ainda vira Error, com o status na mensagem', async () => {
    const muda = (async () => new Response('', { status: 403 })) as typeof fetch
    const proibido = await listarUsuarios(muda).catch((motivo: unknown) => motivo)
    expect((proibido as FalhaDeUsuarios).status).toBe(403)
    expect((proibido as FalhaDeUsuarios).message).toBe('pedido recusado com 403')
  })
})
