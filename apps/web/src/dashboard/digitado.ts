/**
 * Le o que a pessoa digitou num campo de numero ou de R$. Quem lanca escreve do jeito
 * que fala: `1.500`, `1.500,00`, `1500,5`, `R$ 2.300,90`. Trocar so a primeira virgula por
 * ponto lia `1.500` como 1,5 e `1.234,56` como zero, e o total da viagem mudava sem
 * ninguem ter errado nada.
 *
 * Com virgula, a virgula e o decimal e todo ponto e milhar. So com ponto, um grupo de
 * exatamente tres digitos depois do ponto (`1.500`, `12.345.678`) e milhar; qualquer
 * outro (`12.5`, `1500.50`) e decimal, que e o que um campo numerico do navegador devolve.
 *
 * `milhar: false` desliga a leitura do ponto como milhar. O valor por litro tem tres casas
 * (`5.899`) e nunca chega a mil, entao ali o ponto e sempre decimal.
 */
export function lerNumero(digitado: string, { milhar = true }: { readonly milhar?: boolean } = {}): number {
  const limpo = digitado.replace(/[^\d.,-]/g, '')
  const normalizado = limpo.includes(',')
    ? limpo.replaceAll('.', '').replace(',', '.')
    : milhar && /^-?\d{1,3}(\.\d{3})+$/.test(limpo)
    ? limpo.replaceAll('.', '')
    : limpo
  const lido = Number(normalizado)
  return Number.isFinite(lido) ? lido : 0
}
