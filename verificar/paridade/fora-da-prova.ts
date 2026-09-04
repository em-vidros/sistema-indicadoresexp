/**
 * O que a prova declaradamente NAO cobre, e por que.
 *
 * Toda a paridade existe para uma frase: a tela desenha igual depois do porte. Uma
 * regiao listada aqui e uma excecao a essa frase, e uma excecao que nao esta escrita em
 * lugar nenhum vira, seis meses depois, alguem lendo verde e entendendo "isto foi
 * conferido". Entao o preco de tirar uma regiao da comparacao e escrever aqui o que se
 * perdeu e quem decidiu perder.
 *
 * O elemento que casa com o seletor continua na comparacao com todos os atributos dele:
 * a caixa, a classe, o tamanho, o lugar na arvore. O que sai e so o conteudo, trocado
 * por uma linha `<fora da prova>`. Uma regiao daqui nao esconde um `gap` errado no pai
 * nem um cartao que mudou de lugar.
 *
 * O que sai de uma prova ganha outra coisa no lugar, senao vira ponto cego: a paridade
 * fica verde com o grafico certo, com o errado e sem grafico nenhum.
 *
 * A lista esta vazia hoje. O unico recorte que existiu foi o `.chart-wrap` do dashboard,
 * dos dois graficos que trocaram Chart.js por Recharts em 2026-09-02; ele saiu junto com a
 * tela, que foi redesenhada e nao e mais comparada com baseline nenhuma. O par de olhos que
 * ficou no lugar e `verificar/olhar-dashboard.ts`. Rode depois de mexer no desenho.
 */
import type { Tela } from './palco.ts'

export type Recorte = {
  readonly tela: Tela
  /** O elemento continua comparado; o conteudo dele vira uma linha so. */
  readonly seletor: string
  /** O que se perdeu, e a decisao que trocou a cobertura por outra coisa. */
  readonly motivo: string
}

export const FORA_DA_PROVA: readonly Recorte[] = []

/** Os seletores que valem para uma tela, prontos para o `serializarDom`. */
export function recortesDe(tela: Tela): readonly string[] {
  return FORA_DA_PROVA.filter((r) => r.tela === tela).map((r) => r.seletor)
}
