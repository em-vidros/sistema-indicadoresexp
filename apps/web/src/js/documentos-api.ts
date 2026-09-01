export type TipoDocumento = 'apolice' | 'crlv' | 'tacografo' | 'cnh' | 'manual' | 'plano_pgq'

export type EntradaDocumento = {
  tipo: TipoDocumento
  titulo?: string | null
  descricao?: string | null
  vencimento?: string | null
  linkExterno?: string | null
  veiculoId?: string | null
  colaboradorId?: string | null
  baseId?: string | null
  seguradora?: string | null
  contatoEmergencia?: string | null
  cnhNumero?: string | null
  cnhCategoria?: string | null
}

export type DocumentoSalvo = Required<Omit<EntradaDocumento, 'tipo'>> & {
  id: string
  tipo: TipoDocumento
  arquivoId: string | null
  nomeArquivo: string | null
  temArquivo: boolean
  veiculos: string[]
}

export type CatalogoDocumentos = {
  bases: Array<{ id: string; nome: string }>
  veiculos: Array<{ id: string; placa: string; modelo: string | null; marca: string | null; ano: string | null; baseId: string }>
  colaboradores: Array<{ id: string; nome: string; cargo: string | null; funcao: string; baseId: string }>
}

type Chamar = typeof fetch

async function pedirJson<T>(caminho: string, init: RequestInit, chamar: Chamar): Promise<T> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) {
    const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
    throw new Error(falha?.erro ?? `pedido recusado com ${resposta.status}`)
  }
  return (await resposta.json()) as T
}

export async function obterCatalogoDocumentos(chamar: Chamar = fetch): Promise<CatalogoDocumentos> {
  return await pedirJson('/api/documentos/catalogo', {}, chamar)
}

export async function listarDocumentos(chamar: Chamar = fetch): Promise<DocumentoSalvo[]> {
  return await pedirJson('/api/documentos', {}, chamar)
}

export async function enviarDocumento(
  dados: EntradaDocumento,
  arquivo: File,
  chamar: Chamar = fetch,
): Promise<{ id: string; arquivoId: string }> {
  const formulario = new FormData()
  formulario.set('dados', JSON.stringify(dados))
  formulario.set('arquivo', arquivo)
  return await pedirJson('/api/documentos', { method: 'POST', body: formulario }, chamar)
}

export async function atualizarDocumento(
  id: string,
  dados: EntradaDocumento,
  chamar: Chamar = fetch,
): Promise<void> {
  await pedirJson(`/api/documentos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dados),
  }, chamar)
}

export async function salvarDadosDocumento(
  dados: EntradaDocumento,
  chamar: Chamar = fetch,
): Promise<{ id: string }> {
  return await pedirJson('/api/documentos/dados', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dados),
  }, chamar)
}

export function caminhoArquivoDocumento(id: string): string {
  return `/api/documentos/${encodeURIComponent(id)}/arquivo`
}
