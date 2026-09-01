import { diasEntre } from './tempo.ts'
import type { DataISO } from './tempo.ts'

/**
 * As colunas geradas do Postgres arredondam com `ROUND(...::numeric, 2)`. O
 * `numeric` e decimal exato e arredonda meio para longe do zero; o `number` do
 * TypeScript e binario e ja chega errado antes do arredondamento. Com
 * litros = 3 e vl_litro = 2.675 o produto em float e 8.024999999999999, entao
 * `Math.round(x * 100) / 100` devolvia 8.02 enquanto a coluna gravava 8.03. O
 * formulario mostrava um numero e o banco guardava outro.
 *
 * Aqui a conta e decimal do comeco ao fim. Cada `number` vira o par
 * (unidades, escala) lido da representacao em string, soma, subtracao e produto
 * acontecem em `bigint`, e o arredondamento final compara o resto com metade do
 * divisor, tambem em inteiro. Nenhum float participa da conta: ele so reaparece
 * no valor de volta, e o double que sai e o mesmo que `Number('8.03')` produz.
 *
 * ## Ate onde a conta e exata
 *
 * O `bigint` nao transborda, entao nao existe o limite de `Number.MAX_SAFE_INTEGER`
 * no meio do calculo. A ponte com o decimal e o `toString()` do `number`, que
 * devolve a menor cadeia que volta ao mesmo double. Ela e o decimal que a pessoa
 * digitou enquanto o valor tiver ate 15 digitos significativos e modulo abaixo de
 * 2^53 (9007199254740992). Acima disso o double ja nao distingue decimais
 * vizinhos: a conta continua exata sobre o numero que chegou, mas o numero que
 * chegou pode nao ser o que se escreveu. O maior valor do dominio e
 * `numeric(12,2)`, ou seja menos de 10^10 com duas casas, quatro ordens de
 * grandeza abaixo do limite. Fora dos finitos nao ha decimal nenhum: NaN e
 * Infinity levantam erro em vez de virar NaN silencioso, e os schemas de
 * `registro.ts` ja recusam os dois com `.finite()`.
 *
 * O valor de retorno tem duas casas e e um double, entao ele so representa a
 * fracao exatamente ate 2^53 / 100, cerca de 9.0e13. Acima disso o double mais
 * proximo do resultado ja e o unico disponivel, e e o mesmo que o driver produz
 * ao ler a coluna, entao os dois lados continuam iguais.
 *
 * ## Onde a igualdade com o Postgres acaba
 *
 * Soma, subtracao e produto sao exatos nos dois lados e sempre casam.
 *
 * Divisao nao fecha em inteiro, e os dois lados chegam ao resultado por caminhos
 * diferentes. O Postgres divide primeiro num numero de casas escolhido por
 * `select_div_scale` (pelo menos 16 digitos significativos), depois multiplica
 * por 100 e so entao arredonda para duas casas. Aqui a divisao e feita uma vez
 * so, sobre o racional exato, ja escalado para as duas casas finais. Os dois
 * caminhos so podem divergir se o quociente exato estiver a menos de 10^-16 de
 * um empate em x.xx5 sem ser esse empate, o que exige denominador com mais de
 * 12 digitos. Com `numeric(12,2)` de um lado e `numeric(12,3)` do outro o
 * denominador nao passa de 10^12 e a distancia minima ate um empate falso e da
 * ordem de 10^-17, ainda acima da resolucao do Postgres. O teste
 * `derivados-vs-postgres.test.ts` cobre a faixa que o dominio produz.
 *
 * A outra ponta da divisao e o proprio `select_div_scale`: quando o dividendo e
 * enorme perto do divisor (quociente acima de 10^16), o Postgres passa a dividir
 * com menos casas que as duas que precisamos e perde a terceira casa antes de
 * arredondar. Nenhum indicador daqui chega la: percentual de custo, percentual de
 * quebra e media de km por litro vivem entre 0 e algumas centenas.
 */

type Decimal = { readonly unidades: bigint; readonly escala: number }

const CASAS = 2
const CEM: Decimal = { unidades: 100n, escala: 0 }

function potencia(expoente: number): bigint {
  return 10n ** BigInt(expoente)
}

/**
 * Le o decimal que o `toString()` do number mostra, inclusive quando ele sai em
 * notacao exponencial (`1e-7`, `1e+21`). Contar as casas pela string e o que
 * amarra o valor ao decimal que a pessoa digitou, em vez de a fracao binaria
 * que o double guarda.
 */
function decimal(x: number): Decimal {
  if (!Number.isFinite(x)) throw new Error(`valor nao finito no calculo derivado: ${x}`)
  const texto = x.toString()
  const marca = texto.indexOf('e')
  const corpo = marca === -1 ? texto : texto.slice(0, marca)
  const expoente = marca === -1 ? 0 : Number(texto.slice(marca + 1))
  const ponto = corpo.indexOf('.')
  const digitos = ponto === -1 ? corpo : corpo.slice(0, ponto) + corpo.slice(ponto + 1)
  const escala = (ponto === -1 ? 0 : corpo.length - ponto - 1) - expoente
  const unidades = BigInt(digitos)
  return escala < 0 ? { unidades: unidades * potencia(-escala), escala: 0 } : { unidades, escala }
}

function somar(a: Decimal, b: Decimal): Decimal {
  const escala = Math.max(a.escala, b.escala)
  return {
    unidades: a.unidades * potencia(escala - a.escala) + b.unidades * potencia(escala - b.escala),
    escala,
  }
}

function subtrair(a: Decimal, b: Decimal): Decimal {
  return somar(a, { unidades: -b.unidades, escala: b.escala })
}

function multiplicar(a: Decimal, b: Decimal): Decimal {
  return { unidades: a.unidades * b.unidades, escala: a.escala + b.escala }
}

/**
 * Meio para longe do zero, que e a regra do `ROUND(numeric, n)` do Postgres.
 * `resto * 2 >= divisor` decide o empate sem sair do inteiro; comparar contra
 * `divisor / 2` perderia a metade quando o divisor fosse impar.
 */
function razaoArredondada(numerador: bigint, denominador: bigint): bigint {
  const negativo = (numerador < 0n) !== (denominador < 0n)
  const n = numerador < 0n ? -numerador : numerador
  const d = denominador < 0n ? -denominador : denominador
  const inteiro = n / d
  const resto = n % d
  const subiu = resto * 2n >= d ? inteiro + 1n : inteiro
  return negativo ? -subiu : subiu
}

/** Monta o double a partir do inteiro escalado, pela string, sem dividir em float. */
function numero(unidades: bigint, casas: number): number {
  const negativo = unidades < 0n
  const digitos = (negativo ? -unidades : unidades).toString().padStart(casas + 1, '0')
  const corte = digitos.length - casas
  const texto = casas === 0 ? digitos : `${digitos.slice(0, corte)}.${digitos.slice(corte)}`
  return Number(negativo ? `-${texto}` : texto)
}

/** Igual a `ROUND(x::numeric, 2)`. */
function duasCasas(d: Decimal): number {
  if (d.escala <= CASAS) return numero(d.unidades * potencia(CASAS - d.escala), CASAS)
  return numero(razaoArredondada(d.unidades, potencia(d.escala - CASAS)), CASAS)
}

/** Igual a `ROUND(a / b, 2)`, com a divisao feita uma unica vez sobre o racional exato. */
function divididoEmDuasCasas(a: Decimal, b: Decimal): number {
  const numerador = a.unidades * potencia(b.escala + CASAS)
  const denominador = b.unidades * potencia(a.escala)
  return numero(razaoArredondada(numerador, denominador), CASAS)
}

export function kmRodados(kmSaida: number, kmChegada: number): number | null {
  if (kmChegada <= kmSaida) return null
  return duasCasas(subtrair(decimal(kmChegada), decimal(kmSaida)))
}

export function custoViagem(combustivel: number, diarias: number): number {
  return duasCasas(somar(decimal(combustivel), decimal(diarias)))
}

export function pctCusto(custoViagem: number, valorCarga: number): number | null {
  if (valorCarga <= 0) return null
  return divididoEmDuasCasas(multiplicar(decimal(custoViagem), CEM), decimal(valorCarga))
}

export function valorTotalParada(litros: number, vlLitro: number): number {
  return duasCasas(multiplicar(decimal(litros), decimal(vlLitro)))
}

export function mediaKmL(kmRodados: number | null, totalLitros: number): number | null {
  if (kmRodados === null || kmRodados <= 0 || totalLitros <= 0) return null
  return divididoEmDuasCasas(decimal(kmRodados), decimal(totalLitros))
}

export function diasOficina(entrada: DataISO, saida: DataISO | null): number | null {
  if (saida === null) return null
  return diasEntre(entrada, saida)
}

export function pctQuebra(m2Quebrado: number, m2Expedido: number): number | null {
  if (m2Expedido <= 0) return null
  return divididoEmDuasCasas(multiplicar(decimal(m2Quebrado), CEM), decimal(m2Expedido))
}
