export type FechamentoDaBase = { id: string; mes: string; fechadoEm: string; fechadoPor: string | null }

/** Nome da base -> os meses fechados dela. So o que a sessao alcanca. */
export type Fechamentos = Record<string, FechamentoDaBase[]>

type Chamar = typeof fetch

async function pedirJson<T>(caminho: string, init: RequestInit, chamar: Chamar): Promise<T> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) {
    const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
    throw new Error(falha?.erro ?? `pedido recusado com ${resposta.status}`)
  }
  return (await resposta.json()) as T
}

export async function listarFechamentos(chamar: Chamar = fetch): Promise<Fechamentos> {
  return await pedirJson('/api/fechamentos', {}, chamar)
}

/** So o admin fecha; a rota recusa quem nao ve todas as bases. */
export async function fecharMes(base: string, mes: string, chamar: Chamar = fetch): Promise<{ id: string }> {
  return await pedirJson('/api/fechamentos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base, mes }),
  }, chamar)
}

export async function reabrirMes(id: string, chamar: Chamar = fetch): Promise<void> {
  await pedirJson(`/api/fechamentos/${encodeURIComponent(id)}`, { method: 'DELETE' }, chamar)
}
