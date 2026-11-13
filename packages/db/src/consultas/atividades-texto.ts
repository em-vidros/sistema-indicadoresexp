/**
 * A parte do registro de atividades que e so texto: como um valor vira legivel e como dois
 * retratos do mesmo lancamento viram a lista do que mudou. Sem banco, para testar de graca.
 */

export type Mudanca = { campo: string; antes: string; depois: string }

/** O lancamento em campos legiveis: o rotulo que a pessoa le e o valor como ela leria. */
export type Campos = Record<string, string>

const SEM_VALOR = '—'

/**
 * `2026-10-14` vira `14/10/2026`, `08:30:00` vira `08:30` e `6.100` vira `6,1`. Texto de
 * qualquer outro formato passa como esta, e vazio vira o traco.
 */
export function textoDe(valor: unknown): string {
  if (valor === null || valor === undefined) return SEM_VALOR
  const texto = String(valor).trim()
  if (texto === '') return SEM_VALOR
  const data = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (data) return `${data[3]}/${data[2]}/${data[1]}`
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(texto)) return texto.slice(0, 5)
  if (/^-?\d+(\.\d+)?$/.test(texto)) return String(Number(texto)).replace('.', ',')
  return texto
}

/** O dia e o mes (`14/10`), para o resumo de uma linha. */
export function diaMesDe(data: string): string {
  const [, mes, dia] = data.split('-')
  return dia === undefined || mes === undefined ? data : `${dia}/${mes}`
}

/** O que mudou entre `antes` e `depois`, na ordem dos campos. Sem mudanca, lista vazia. */
export function diferencas(antes: Campos, depois: Campos): Mudanca[] {
  const campos = [...new Set([...Object.keys(depois), ...Object.keys(antes)])]
  const mudancas: Mudanca[] = []
  for (const campo of campos) {
    const a = antes[campo] ?? SEM_VALOR
    const d = depois[campo] ?? SEM_VALOR
    if (a !== d) mudancas.push({ campo, antes: a, depois: d })
  }
  return mudancas
}
