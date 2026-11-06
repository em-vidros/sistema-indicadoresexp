/**
 * O plano de manutencao preventiva, que `manutencao-frota` guardava em
 * `emvidros_preventiva`, no armazenamento do navegador.
 *
 * Sao duas rotas so: o GET traz o catalogo de tipos mais o plano de todo veiculo
 * que a sessao enxerga, e o PUT grava o plano inteiro de um veiculo, que e como a
 * tela edita: ela abre a lista da placa, mexe nela e manda de volta. Lista vazia
 * e legitima e quer dizer "removi tudo".
 */
export type ItemPreventivo = {
  tipo_preventivo_id: string
  tipo: string
  intervalo_km: number
  alerta_km: number
  ultimo_km: number | null
  obs: string | null
}

export type EntradaItemPreventivo = {
  tipo: string
  intervalo_km: number
  alerta_km: number
  ultimo_km: number | null
  obs: string | null
}

export type TipoPreventivo = {
  id: string
  tipo: string
  intervalo_km: number
  alerta_km: number
}

export type VeiculoPreventivo = {
  id: string
  placa: string
  base: string
  modelo: string | null
  marca: string | null
  ano: string | null
  /** O km atual informado a mao na aba "KM atual", ou nulo quando vale o dos registros. */
  km_atual: number | null
  km_atual_em: string | null
  itens: ItemPreventivo[]
}

export type PlanoPreventivo = {
  tipos: TipoPreventivo[]
  veiculos: VeiculoPreventivo[]
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

export async function obterPreventiva(chamar: Chamar = fetch): Promise<PlanoPreventivo> {
  return await pedirJson('/api/preventiva', {}, chamar)
}

/** Grava o km atual de um veiculo, ou limpa com `null` para voltar ao km dos registros. */
export async function gravarKmAtual(
  veiculoId: string,
  km: number | null,
  chamar: Chamar = fetch,
): Promise<{ id: string; placa: string; km_atual: number | null; km_atual_em: string | null }> {
  return await pedirJson(
    `/api/preventiva/${encodeURIComponent(veiculoId)}/km`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ km }),
    },
    chamar,
  )
}

export async function gravarPreventiva(
  veiculoId: string,
  itens: EntradaItemPreventivo[],
  chamar: Chamar = fetch,
): Promise<VeiculoPreventivo> {
  return await pedirJson(
    `/api/preventiva/${encodeURIComponent(veiculoId)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itens }),
    },
    chamar,
  )
}
