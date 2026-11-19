/**
 * As regras do estoque de pneus que nao precisam de banco: como a medida e a marca sao
 * escritas, quais motivos cada tipo de movimentacao aceita e como o saldo muda. Separado
 * para testar de graca, e para a consulta so cuidar de gravar.
 */

export type TipoDeMovimento = 'entrada' | 'saida' | 'ajuste'

export const TIPOS_DE_MOVIMENTO: readonly TipoDeMovimento[] = ['entrada', 'saida', 'ajuste']

/** Quantas vezes uma carcaca pode ser recapada: o estoque conta de 0 (novo) a 3. */
export const MAXIMO_DE_RECAPAGENS = 3

/** O motivo e escolhido de uma lista, e nao digitado: contar por motivo so funciona assim. */
export const MOTIVOS: Readonly<Record<TipoDeMovimento, readonly string[]>> = {
  entrada: ['compra', 'retorno_recapadora', 'retirado_veiculo', 'outro'],
  saida: ['instalado_veiculo', 'enviado_recapadora', 'sucata', 'outro'],
  ajuste: ['inventario'],
}

export const ROTULO_DO_MOTIVO: Readonly<Record<string, string>> = {
  compra: 'Compra',
  retorno_recapadora: 'Voltou da recapadora',
  retirado_veiculo: 'Retirado de veículo',
  instalado_veiculo: 'Instalado em veículo',
  enviado_recapadora: 'Enviado à recapadora',
  sucata: 'Sucata',
  inventario: 'Inventário (contagem)',
  outro: 'Outro',
}

/**
 * O tipo do pneu pela posicao em que trabalha: direcional (eixo dianteiro), tracao (eixo
 * motriz) ou misto (serve nos dois). O estoque vazio ("sem tipo") so existe nas linhas
 * lancadas antes deste campo; movimentacao nova exige um dos tres.
 */
export const TIPOS_DE_PNEU = ['direcional', 'tracao', 'misto'] as const

export type TipoDePneu = (typeof TIPOS_DE_PNEU)[number]

export const ROTULO_DO_TIPO_DE_PNEU: Readonly<Record<string, string>> = {
  direcional: 'Direcional',
  tracao: 'Tração',
  misto: 'Misto',
  '': 'Sem tipo',
}

export function tipoDePneuValido(tipo: string): tipo is TipoDePneu {
  return (TIPOS_DE_PNEU as readonly string[]).includes(tipo)
}

/** `295/80  r22.5 ` vira `295/80 R22.5`: a mesma medida escrita de dois jeitos e duas linhas. */
export function normalizarMedida(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function normalizarMarca(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** `Não recapado` ou `Recapado 2×`. */
export function rotuloDaCondicao(recapagens: number): string {
  return recapagens === 0 ? 'Não recapado' : `Recapado ${recapagens}×`
}

export function motivoValido(tipo: TipoDeMovimento, motivo: string): boolean {
  return MOTIVOS[tipo].includes(motivo)
}

/**
 * O saldo depois da movimentacao. Entrada soma, saida subtrai e nunca deixa negativo, e o
 * ajuste de inventario e a contagem fisica: o `quantidade` dele e o saldo novo, e nao uma
 * diferenca. Quantidade invalida e saida maior que o saldo voltam como `erro`, com a frase
 * que a tela mostra.
 */
export function novoSaldo(
  tipo: TipoDeMovimento,
  saldoAtual: number,
  quantidade: number,
): { readonly saldo: number } | { readonly erro: string } {
  if (!Number.isInteger(quantidade) || quantidade < 0) return { erro: 'A quantidade precisa ser um número inteiro.' }
  if (tipo !== 'ajuste' && quantidade === 0) return { erro: 'A quantidade precisa ser maior que zero.' }
  if (tipo === 'entrada') return { saldo: saldoAtual + quantidade }
  if (tipo === 'ajuste') return { saldo: quantidade }
  if (quantidade > saldoAtual) {
    return {
      erro: saldoAtual === 0
        ? 'Não há pneus em estoque desta medida e condição.'
        : `Só há ${saldoAtual} em estoque desta medida e condição; a saída de ${quantidade} deixaria o saldo negativo.`,
    }
  }
  return { saldo: saldoAtual - quantidade }
}
