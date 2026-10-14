export type Registro = Record<string, unknown> & { tipo: string; base: string }
type Chamar = typeof fetch

async function pedir(caminho: string, init: RequestInit, chamar: Chamar): Promise<Response> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) {
    const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
    throw new Error(falha?.erro ?? `pedido recusado com ${resposta.status}`)
  }
  return resposta
}

async function pedirJson<T>(caminho: string, init: RequestInit, chamar: Chamar): Promise<T> {
  return (await (await pedir(caminho, init, chamar)).json()) as T
}

export async function listarRegistros(base?: string | null, chamar: Chamar = fetch): Promise<Registro[]> {
  const consulta = base ? `?base=${encodeURIComponent(base)}` : ''
  return await pedirJson(`/api/registros${consulta}`, {}, chamar)
}

/**
 * O "Limpar hoje" da tela. Base e data vao na query, e nao no corpo, porque a rota
 * recusa a limpeza quando qualquer uma das duas chega vazia: apagar o dia errado nao
 * tem desfazer do lado de quem clicou.
 */
export async function apagarRegistrosDoDia(
  base: string,
  data: string,
  chamar: Chamar = fetch,
): Promise<{ apagados: number }> {
  const consulta = `?base=${encodeURIComponent(base)}&data=${encodeURIComponent(data)}`
  return await pedirJson(`/api/registros${consulta}`, { method: 'DELETE' }, chamar)
}

export async function salvarRegistros(registros: Registro[], chamar: Chamar = fetch): Promise<void> {
  await pedirJson('/api/registros', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ registros }),
  }, chamar)
}

/**
 * A edicao de um lancamento ja gravado. O `id` e o que a leitura devolveu; no abastecimento
 * e o `abastecimento_id`, e o corpo leva o grupo de paradas inteiro.
 */
export async function atualizarRegistro(id: string, registros: Registro[], chamar: Chamar = fetch): Promise<void> {
  await pedirJson(`/api/registros/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ registros }),
  }, chamar)
}

/** Apaga um lancamento so. No abastecimento o id e o do grupo inteiro de paradas. */
export async function apagarRegistro(tipo: string, id: string, chamar: Chamar = fetch): Promise<void> {
  // A rota responde 204, sem corpo.
  await pedir(`/api/registros/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}`, { method: 'DELETE' }, chamar)
}
