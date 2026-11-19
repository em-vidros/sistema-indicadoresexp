/**
 * O estoque de pneus em forma de tabela: uma linha por medida e marca, uma coluna por
 * condicao (nao recapado, recapado 1x, 2x e 3x), e os totais do topo da tela. So conta,
 * sem tela e sem rede, para testar de graca.
 */
import type { LinhaDeEstoque } from '../js/estoque-pneu-api.ts'

/** Os tres tipos de pneu, na ordem em que a tela os oferece. */
export const TIPOS_DE_PNEU = ['direcional', 'tracao', 'misto'] as const

export const ROTULO_DO_TIPO_DE_PNEU: Readonly<Record<string, string>> = {
  direcional: 'Direcional',
  tracao: 'Tração',
  misto: 'Misto',
  '': 'Sem tipo',
}

/** `Sem tipo` e o das linhas lancadas antes do campo existir; so aparece quando ha saldo nele. */
export function rotuloDoTipoDePneu(tipo: string | null): string {
  return ROTULO_DO_TIPO_DE_PNEU[tipo ?? ''] ?? tipo ?? 'Sem tipo'
}

/** Nao recapado (0) e recapado 1x, 2x, 3x: as quatro colunas da tabela. */
export const CONDICOES = [0, 1, 2, 3] as const

export type GrupoDeEstoque = {
  readonly medida: string
  readonly marca: string
  /** `direcional`, `tracao`, `misto` ou vazio (sem tipo). */
  readonly tipoPneu: string
  /** O saldo de cada condicao, na ordem de `CONDICOES`. */
  readonly porCondicao: readonly [number, number, number, number]
  readonly total: number
}

/** Direcional, tracao, misto e, por ultimo, as linhas antigas sem tipo. */
function ordemDoTipo(tipo: string): number {
  const posicao = (TIPOS_DE_PNEU as readonly string[]).indexOf(tipo)
  return posicao === -1 ? TIPOS_DE_PNEU.length : posicao
}

/**
 * Medida, marca e tipo juntos, em ordem alfabetica da medida. Marca vazia fica por ultimo
 * da medida, e dentro dela os tipos seguem direcional, tracao, misto e sem tipo.
 */
export function agruparEstoque(linhas: readonly LinhaDeEstoque[]): GrupoDeEstoque[] {
  const grupos = new Map<
    string,
    { medida: string; marca: string; tipoPneu: string; saldos: [number, number, number, number] }
  >()
  for (const linha of linhas) {
    const chave = `${linha.medida}\u0000${linha.marca}\u0000${linha.tipoPneu}`
    const grupo = grupos.get(chave) ??
      { medida: linha.medida, marca: linha.marca, tipoPneu: linha.tipoPneu, saldos: [0, 0, 0, 0] }
    if (linha.recapagens >= 0 && linha.recapagens <= 3) {
      const condicao = linha.recapagens as 0 | 1 | 2 | 3
      grupo.saldos[condicao] += linha.quantidade
    }
    grupos.set(chave, grupo)
  }
  return [...grupos.values()]
    .map((g) => ({
      medida: g.medida,
      marca: g.marca,
      tipoPneu: g.tipoPneu,
      porCondicao: g.saldos,
      total: g.saldos.reduce((soma, n) => soma + n, 0),
    }))
    .sort((a, b) =>
      a.medida.localeCompare(b.medida) ||
      (a.marca === '' ? 1 : 0) - (b.marca === '' ? 1 : 0) ||
      a.marca.localeCompare(b.marca) ||
      ordemDoTipo(a.tipoPneu) - ordemDoTipo(b.tipoPneu)
    )
}

export type TotaisDoEstoque = {
  readonly total: number
  readonly novos: number
  readonly recapados: number
  /** Os recapados por numero de recapagens: 1x, 2x e 3x. */
  readonly porRecapagem: readonly [number, number, number]
}

export function totaisDoEstoque(linhas: readonly LinhaDeEstoque[]): TotaisDoEstoque {
  let novos = 0
  const porRecapagem: [number, number, number] = [0, 0, 0]
  for (const linha of linhas) {
    if (linha.recapagens === 0) novos += linha.quantidade
    else if (linha.recapagens >= 1 && linha.recapagens <= 3) {
      const posicao = (linha.recapagens - 1) as 0 | 1 | 2
      porRecapagem[posicao] += linha.quantidade
    }
  }
  const recapados = porRecapagem[0] + porRecapagem[1] + porRecapagem[2]
  return { total: novos + recapados, novos, recapados, porRecapagem }
}

/** As medidas que ja existem no estoque, para escolher em vez de digitar de novo. */
export function medidasDoEstoque(linhas: readonly LinhaDeEstoque[]): string[] {
  return [...new Set(linhas.map((l) => l.medida))].sort((a, b) => a.localeCompare(b))
}
