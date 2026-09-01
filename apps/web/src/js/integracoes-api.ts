export type EntradaIntegracao = {
  colaboradorId: string | null
  nome: string
  cargo: string | null
  admissao: string | null
  programaId: string
  inicio: string | null
  coord: string | null
  gerente: string | null
  rh: string | null
  atividades: Array<{ atividadeId: string; feito: boolean; data: string | null }>
}

export type FuncaoIntegracao = 'motorista' | 'ajudante'

export type CatalogoIntegracao = {
  colaboradores: Array<{
    id: string
    nome: string
    cargo: string | null
    admissao: string | null
    funcao: FuncaoIntegracao
  }>
  programas: Array<{
    id: string
    funcao: FuncaoIntegracao
    titulo: string
    semanas: Array<{
      numero: number
      titulo: string
      atividades: Array<{ id: string; codigo: string; titulo: string; descricao: string }>
    }>
    criterios: Array<{ criterio: string; padrao: string; frequencia: string }>
  }>
}

export type IntegracaoSalva = {
  id: string
  colaboradorId: string | null
  programaId: string
  funcao: FuncaoIntegracao
  nome: string
  cargo: string | null
  admissao: string | null
  inicio: string | null
  coord: string | null
  gerente: string | null
  rh: string | null
  salvoEm: string
  atividades: Array<{
    atividadeId: string
    codigo: string
    feito: boolean
    data: string | null
  }>
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

export async function obterCatalogoIntegracoes(chamar: Chamar = fetch): Promise<CatalogoIntegracao> {
  return await pedirJson('/api/integracoes/catalogo', {}, chamar)
}

export async function listarIntegracoes(chamar: Chamar = fetch): Promise<IntegracaoSalva[]> {
  return await pedirJson('/api/integracoes', {}, chamar)
}

export async function salvarIntegracao(
  id: string | null,
  entrada: EntradaIntegracao,
  chamar: Chamar = fetch,
): Promise<IntegracaoSalva> {
  return await pedirJson(
    id ? `/api/integracoes/${encodeURIComponent(id)}` : '/api/integracoes',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entrada),
    },
    chamar,
  )
}
