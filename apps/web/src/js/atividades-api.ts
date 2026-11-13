/**
 * O que a tela de atividades fala com `/api/atividades`: so a leitura, da mais recente para
 * a mais antiga. Os tipos sao redigitados aqui, como nos outros modulos de `js/`, porque o
 * que atravessa a rede e JSON e o front nao conhece o pacote de persistencia.
 *
 * A pagina e por deslocamento (quantas linhas pular), e nao pelo horario da ultima: uma
 * importacao grava dezenas de linhas no mesmo instante, e o horario como cursor pularia as
 * que empatam.
 */
type Chamar = typeof fetch

export type Mudanca = { readonly campo: string; readonly antes: string; readonly depois: string }

export type AcaoDeAtividade = 'criou' | 'alterou' | 'apagou'
export type TipoDeAtividade = 'viagem' | 'abastecimento' | 'manutencao' | 'quebra' | 'km_atual'

export type Atividade = {
  readonly id: string
  /** ISO, com fuso. */
  readonly quando: string
  readonly usuario: string
  readonly acao: AcaoDeAtividade
  readonly tipo: TipoDeAtividade
  readonly base: string | null
  readonly resumo: string
  readonly mudancas: readonly Mudanca[]
}

export type PaginaDeAtividades = { readonly atividades: readonly Atividade[]; readonly temMais: boolean }

export type FiltroDeAtividades = {
  readonly base?: string | undefined
  readonly tipo?: TipoDeAtividade | undefined
  readonly deslocamento?: number | undefined
}

export async function listarAtividades(
  filtro: FiltroDeAtividades = {},
  chamar: Chamar = fetch,
): Promise<PaginaDeAtividades> {
  const params = new URLSearchParams()
  if (filtro.base) params.set('base', filtro.base)
  if (filtro.tipo) params.set('tipo', filtro.tipo)
  if (filtro.deslocamento) params.set('deslocamento', String(filtro.deslocamento))
  const consulta = params.toString()
  const resposta = await chamar(`/api/atividades${consulta === '' ? '' : `?${consulta}`}`)
  if (!resposta.ok) {
    const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
    throw new Error(falha?.erro ?? `pedido recusado com ${resposta.status}`)
  }
  return (await resposta.json()) as PaginaDeAtividades
}
