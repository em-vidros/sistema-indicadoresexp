import { describe, expect, test } from 'bun:test'
import {
  apagarAta,
  enviarPdfAta,
  listarAtas,
  obterCatalogoAtas,
  salvarAta,
  type EntradaAta,
} from '../src/js/atas-api.ts'

const entrada: EntradaAta = {
  numero: null,
  titulo: 'Reunião mensal',
  data: '2026-09-01',
  horario: null,
  local: null,
  convocada: null,
  facilitadores: null,
  participantesGeral: null,
  gestor1Nome: null,
  gestor1Cargo: null,
  gestor2Nome: null,
  gestor2Cargo: null,
  importada: false,
  topicos: [],
  participantes: [],
}

describe('a tela de atas fala com a API', () => {
  test('lê o catálogo e o histórico do banco', async () => {
    const pedidos: string[] = []
    const chamar = async (recurso: string | URL | Request) => {
      const caminho = recurso.toString()
      pedidos.push(caminho)
      return Response.json([])
    }

    expect(await obterCatalogoAtas(chamar)).toEqual([])
    expect(await listarAtas(chamar)).toEqual([])
    expect(pedidos).toEqual(['/api/atas/catalogo', '/api/atas'])
  })

  test('cria, atualiza, envia o PDF e apaga pela API', async () => {
    const pedidos: Array<{ caminho: string; metodo: string; corpo: BodyInit | null | undefined }> = []
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedidos.push({ caminho: recurso.toString(), metodo: init?.method ?? 'GET', corpo: init?.body })
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return Response.json({ id: '8f66deae-68d0-417c-83f9-cce45a72b82d' }, { status: 201 })
    }
    const id = '8f66deae-68d0-417c-83f9-cce45a72b82d'

    await salvarAta(null, entrada, chamar)
    await salvarAta(id, entrada, chamar)
    await enviarPdfAta(id, new File(['%PDF'], 'ata.pdf', { type: 'application/pdf' }), chamar)
    await apagarAta(id, chamar)

    expect(pedidos.map(({ caminho, metodo }) => ({ caminho, metodo }))).toEqual([
      { caminho: '/api/atas', metodo: 'POST' },
      { caminho: `/api/atas/${id}`, metodo: 'PUT' },
      { caminho: `/api/atas/${id}/pdf`, metodo: 'POST' },
      { caminho: `/api/atas/${id}`, metodo: 'DELETE' },
    ])
    expect(pedidos[2]?.corpo).toBeInstanceOf(FormData)
  })
})
