import { describe, expect, test } from 'bun:test'
import { enviarDocumento, listarDocumentos, obterCatalogoDocumentos } from '../src/js/documentos-api.ts'

describe('a tela de documentos fala com a API', () => {
  test('lê cadastros e envia PDF sem base64', async () => {
    const pedidos: Array<{ caminho: string; corpo?: BodyInit | null }> = []
    const chamar = async (recurso: string | URL | Request, init?: RequestInit) => {
      pedidos.push({ caminho: recurso.toString(), corpo: init?.body })
      return Response.json([])
    }
    await obterCatalogoDocumentos(chamar)
    await listarDocumentos(chamar)
    await enviarDocumento(
      { tipo: 'crlv', titulo: null, vencimento: null, veiculoId: crypto.randomUUID() },
      new File(['%PDF'], 'crlv.pdf', { type: 'application/pdf' }),
      chamar,
    )
    expect(pedidos.map((item) => item.caminho)).toEqual([
      '/api/documentos/catalogo',
      '/api/documentos',
      '/api/documentos',
    ])
    expect(pedidos[2]?.corpo).toBeInstanceOf(FormData)
  })
})
