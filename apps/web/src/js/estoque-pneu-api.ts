/**
 * O que a aba Estoque da tela de pneus fala com `/api/estoque-pneus`: o saldo, o historico
 * e a movimentacao. Os tipos sao redigitados aqui, como nos outros modulos de `js/`, porque
 * o que atravessa a rede e JSON e o front nao conhece o pacote de persistencia.
 *
 * O saldo nunca e escrito direto: so a movimentacao (entrada, saida ou ajuste de inventario)
 * o altera. A recusa do servidor chega como `Error` com a frase que a tela mostra.
 */
type Chamar = typeof fetch

export type TipoDeMovimento = 'entrada' | 'saida' | 'ajuste'

export type LinhaDeEstoque = {
  readonly id: string
  readonly base: string
  readonly medida: string
  readonly marca: string
  /** 0 e pneu nao recapado (novo); 1 a 3 e quantas vezes ja foi recapado. */
  readonly recapagens: number
  readonly quantidade: number
}

export type MovimentoListado = {
  readonly id: string
  /** ISO, com fuso. */
  readonly quando: string
  readonly usuario: string
  readonly base: string
  readonly medida: string
  readonly marca: string
  readonly recapagens: number
  readonly tipo: TipoDeMovimento
  /** A variacao com sinal: +4 na entrada, -2 na saida. */
  readonly delta: number
  readonly saldoDepois: number
  readonly motivo: string
  readonly placa: string | null
  readonly observacao: string | null
}

export type EntradaDeMovimento = {
  readonly base: string
  readonly medida: string
  readonly marca: string
  readonly recapagens: number
  readonly tipo: TipoDeMovimento
  /** Na entrada e na saida, quantos; no ajuste, a contagem fisica (o saldo novo). */
  readonly quantidade: number
  readonly motivo: string
  readonly placa: string | null
  readonly observacao: string | null
}

async function pedirJson<T>(caminho: string, init: RequestInit, chamar: Chamar): Promise<T> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) {
    const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
    throw new Error(falha?.erro ?? `pedido recusado com ${resposta.status}`)
  }
  return (await resposta.json()) as T
}

export async function listarEstoque(base: string, chamar: Chamar = fetch): Promise<readonly LinhaDeEstoque[]> {
  const corpo = await pedirJson<{ linhas: LinhaDeEstoque[] }>(
    `/api/estoque-pneus?base=${encodeURIComponent(base)}`,
    {},
    chamar,
  )
  return corpo.linhas
}

export async function listarMovimentos(
  base: string,
  limite: number,
  chamar: Chamar = fetch,
): Promise<{ readonly movimentos: readonly MovimentoListado[]; readonly temMais: boolean }> {
  return await pedirJson(
    `/api/estoque-pneus/movimentos?base=${encodeURIComponent(base)}&limite=${limite}`,
    {},
    chamar,
  )
}

export async function registrarMovimento(
  entrada: EntradaDeMovimento,
  chamar: Chamar = fetch,
): Promise<LinhaDeEstoque> {
  return await pedirJson(
    '/api/estoque-pneus/movimentos',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entrada) },
    chamar,
  )
}
