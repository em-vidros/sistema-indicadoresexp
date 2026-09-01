export type ParticipanteAta = {
  colaboradorId: string | null
  nomeExterno: string | null
  presente: boolean
}

export type EntradaAta = {
  numero: string | null
  titulo: string
  data: string
  horario: string | null
  local: string | null
  convocada: string | null
  facilitadores: string | null
  participantesGeral: string | null
  gestor1Nome: string | null
  gestor1Cargo: string | null
  gestor2Nome: string | null
  gestor2Cargo: string | null
  importada: boolean
  topicos: Array<{
    discussao: string | null
    conclusao: string | null
    responsavel: string | null
    prazo: string | null
  }>
  participantes: ParticipanteAta[]
}

export type AtaSalva = EntradaAta & {
  id: string
  salvoEm: string
  temPdf: boolean
}

export type ColaboradorAta = {
  id: string
  nome: string
  cargo: string | null
  funcao: string | null
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

export async function obterCatalogoAtas(chamar: Chamar = fetch): Promise<ColaboradorAta[]> {
  return await pedirJson('/api/atas/catalogo', {}, chamar)
}

export async function listarAtas(chamar: Chamar = fetch): Promise<AtaSalva[]> {
  return await pedirJson('/api/atas', {}, chamar)
}

export async function salvarAta(
  id: string | null,
  entrada: EntradaAta,
  chamar: Chamar = fetch,
): Promise<AtaSalva> {
  return await pedirJson(
    id ? `/api/atas/${encodeURIComponent(id)}` : '/api/atas',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entrada),
    },
    chamar,
  )
}

export async function enviarPdfAta(id: string, arquivo: File, chamar: Chamar = fetch): Promise<void> {
  const formulario = new FormData()
  formulario.set('arquivo', arquivo)
  await pedirJson(`/api/atas/${encodeURIComponent(id)}/pdf`, { method: 'POST', body: formulario }, chamar)
}

export async function apagarAta(id: string, chamar: Chamar = fetch): Promise<void> {
  const resposta = await chamar(`/api/atas/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!resposta.ok) throw new Error(`pedido recusado com ${resposta.status}`)
}

export function caminhoPdfAta(id: string): string {
  return `/api/atas/${encodeURIComponent(id)}/pdf`
}
