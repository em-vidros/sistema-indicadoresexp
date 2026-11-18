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

/**
 * O primeiro campo numerico digitado num formato que nao se le como numero (`1,683,65`,
 * `12a`). `lerNumero` devolve zero para esses, e o aviso de campo obrigatorio que vinha
 * depois nao dizia qual campo estava errado, entao o formulario parecia todo preenchido e
 * bloqueado. Aqui o aviso diz o campo e o que foi digitado. Campo vazio passa: obrigatorio
 * e outra checagem.
 */
export function erroDeNumero(campos: ReadonlyArray<readonly [string, string]>): string | null {
  for (const [rotulo, digitado] of campos) {
    const texto = digitado.trim()
    if (texto === '') continue
    if (lerDinheiro(texto) === null) {
      return `${rotulo}: "${texto}" não é um número válido. Use, por exemplo, 1683,65 ou 1.683,65.`
    }
  }
  return null
}

export function lerDinheiro(digitado: string): number | null {
  const limpo = digitado.trim().replace(/^R\$\s*/, '')
  const brasileiro = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/
  const decimal = /^-?\d+(?:\.\d+)?$/
  return brasileiro.test(limpo) || decimal.test(limpo) ? lerNumero(limpo) : null
}
