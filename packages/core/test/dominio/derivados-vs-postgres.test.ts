import { SQL } from 'bun'
import { afterAll, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  custoViagem,
  diasOficina,
  kmRodados,
  mediaKmL,
  pctCusto,
  pctQuebra,
  valorTotalParada,
} from '../../src/dominio/derivados.ts'
import { dataISO, instante, minutosEntre } from '../../src/dominio/tempo.ts'

/**
 * O arbitro das contas derivadas e o Postgres, nao a leitura da documentacao.
 * Cada operacao de `derivados.ts` e comparada com a expressao que a coluna
 * gerada usa, sobre uma grade fixa de pares. `minutosEntre`, que mora em
 * `tempo.ts`, entra junto porque `viagem.atraso_min` tambem arredonda e tambem
 * precisa casar. Grade fixa, e nao aleatoria: teste
 * que muda de entrada a cada rodada nao serve para provar igualdade, porque
 * quebra num dia e passa no outro sem ninguem ter mexido no codigo.
 *
 * Cada grade tem 500 pares ou mais, cobre a terceira casa decimal (a escala de
 * `vl_litro`, que e `numeric(10,3)`) e cobre os empates em x.xx5, que e onde o
 * decimal do banco e o binario do TypeScript discordam.
 *
 * Uma consulta por operacao, com os pares chegando por `unnest`. Quinhentas
 * consultas separadas levariam mais tempo do que qualquer um espera de um teste.
 *
 * O banco tem que estar de pe: `./infra/banco.sh`.
 */

const SEPARADOR = '|'
const NULO = 'NULO'

function urlBanco(): string {
  const doAmbiente = process.env.DATABASE_URL
  if (doAmbiente !== undefined && doAmbiente !== '') return doAmbiente
  const texto = readFileSync(new URL('../../../../.env', import.meta.url), 'utf8')
  for (const linha of texto.split('\n')) {
    const casou = linha.match(/^\s*DATABASE_URL\s*=\s*(.*?)\s*$/)
    const valor = casou?.[1]
    if (valor !== undefined) return valor.replace(/^["']|["']$/g, '')
  }
  throw new Error('DATABASE_URL ausente: rode ./infra/banco.sh e ajuste o .env da raiz.')
}

const sql = new SQL(urlBanco(), { max: 1 })

afterAll(async () => {
  await sql.close()
})

/**
 * Pares onde a igualdade com o Postgres nao pode ser garantida, com o motivo
 * escrito. Divergencia fora deste mapa reprova; entrada que parou de divergir
 * tambem reprova, para a excecao nao envelhecer em silencio.
 *
 * O mapa esta vazio: nas seis operacoes, em todas as grades abaixo, TypeScript e
 * Postgres devolvem o mesmo numero. As duas diferencas que existem no papel
 * ficam fora do alcance do dominio e por isso nao entram na grade:
 *
 * 1. Denominador negativo. `pctCusto` e `pctQuebra` devolvem null para qualquer
 *    denominador <= 0; o SQL so troca o zero por NULL e um denominador negativo
 *    daria percentual negativo. As checagens `viagem_nao_negativo_ck` e
 *    `quebra_nao_negativo_ck` impedem que esse valor exista na tabela.
 * 2. Quociente acima de 10^16. Nesse ponto o `select_div_scale` do Postgres
 *    passa a dividir com menos de duas casas e perde a terceira antes de
 *    arredondar. Percentual de custo, percentual de quebra e media de km por
 *    litro vivem entre 0 e algumas centenas.
 * 3. Segundo no horario. `atraso_min` le colunas `time`, que guardam segundo, e
 *    arredonda para o minuto. `HoraHM` so tem hora e minuto, entao `minutosEntre`
 *    nao ve o segundo para arredondar. Isso e limite de tipo, nao de aritmetica,
 *    e esta escrito no teste `atraso_min arredonda como o Math.round`.
 */
const EXCECOES: ReadonlyMap<string, string> = new Map<string, string>()

type Linha = { rotulo: string; ts: number | null }

function mostrar(v: number | null): string {
  return v === null ? 'null' : String(v)
}

function juntar(valores: readonly (string | null)[]): string {
  return valores.map((v) => v ?? NULO).join(SEPARADOR)
}

function colunaV(linha: unknown): number | null {
  if (typeof linha !== 'object' || linha === null || !('v' in linha)) {
    throw new Error('o postgres respondeu sem a coluna v')
  }
  const v = linha.v
  if (v === null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  throw new Error(`coluna v com tipo inesperado: ${typeof v}`)
}

/**
 * `string_to_array` no lugar de um array ligado direto: o cliente do Bun manda
 * array de JavaScript como texto separado por virgula, e o Postgres recusa isso
 * como literal de array.
 */
async function perguntarAoBanco(
  expressao: string,
  a: readonly (string | null)[],
  b: readonly (string | null)[],
): Promise<(number | null)[]> {
  const bruto: unknown = await sql.unsafe(
    `select (${expressao})::text as v
       from unnest(string_to_array($1, '${SEPARADOR}', '${NULO}'),
                   string_to_array($2, '${SEPARADOR}', '${NULO}')) with ordinality as t(a, b, i)
      order by i`,
    [juntar(a), juntar(b)],
  )
  if (!Array.isArray(bruto)) throw new Error('o postgres nao devolveu linhas')
  if (bruto.length !== a.length) {
    throw new Error(`o postgres devolveu ${bruto.length} linhas para ${a.length} pares`)
  }
  return bruto.map(colunaV)
}

function conferir(operacao: string, linhas: readonly Linha[], doBanco: readonly (number | null)[]) {
  const divergentes: string[] = []
  const toleradas: string[] = []
  const usadas = new Set<string>()

  linhas.forEach((linha, i) => {
    const pg = doBanco[i]
    if (pg === undefined) throw new Error(`sem resposta do banco para ${linha.rotulo}`)
    const chave = `${operacao} ${linha.rotulo}`
    const motivo = EXCECOES.get(chave)
    if (linha.ts === pg) {
      if (motivo !== undefined) {
        divergentes.push(`${chave}: excecao registrada que ja nao diverge (${motivo}), remova-a`)
      }
      return
    }
    if (motivo !== undefined) {
      usadas.add(chave)
      toleradas.push(`${chave}: ${motivo}`)
      return
    }
    divergentes.push(`${chave}: typescript ${mostrar(linha.ts)}, postgres ${mostrar(pg)}`)
  })

  return { divergentes, toleradas, usadas }
}

/** O arredondamento antigo, guardado so para provar que a grade tem dente. */
function antigo(x: number): number {
  return Math.round(x * 100) / 100
}

// --- grades ---------------------------------------------------------------

// Duas casas: o centavo, os redondos e os valores que ja apareceram em relatorio.
const DUAS_CASAS = [
  0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 0.99, 1, 1.5, 2.5, 3, 7, 9.99, 10.05, 12.34, 33.33, 55.5,
  99.99, 100, 120.5, 250.25, 333.33, 500, 999.99, 1234.56,
]

// Tres casas, a escala real de vl_litro. A maioria termina em 5 na terceira
// casa, que e onde decimal e float discordam.
const TRES_CASAS = [
  0.005, 0.015, 0.105, 0.125, 1.005, 1.115, 1.235, 2.005, 2.675, 3.145, 4.005, 4.115, 5.555,
  6.195, 7.005, 7.815, 8.325, 9.995, 10.005, 12.345, 0.001, 0.999, 3.333, 4.111, 6.19,
]

const DENOMINADORES = [
  0, 1, 3, 7, 8, 9, 16, 100, 125, 160, 200, 320, 400, 800, 1000, 1600, 4500, 10000, 15000, 45000,
]

// Quociente com exatamente tres casas terminadas em 5: o empate que o `numeric`
// sobe e o float as vezes desce.
const QUOCIENTES_EMPATE = [0.005, 0.015, 1.005, 2.675, 4.445, 7.815, 12.345, 33.335, 55.555, 99.995]
// Multiplos de 1000 mantem `quociente * denominador / 100` com duas casas, que e
// o que cabe em numeric(12,2).
const DENOMINADORES_EMPATE = [1000, 2000, 4000, 10000, 20000]

function paresDeEmpateDeDivisao(): [number, number][] {
  const pares: [number, number][] = []
  for (const q of QUOCIENTES_EMPATE) {
    for (const d of DENOMINADORES_EMPATE) {
      // (q * 1000 * d) e inteiro exato; dividir por 100000 devolve o double mais
      // proximo do valor de duas casas, que e o mesmo que Number('10.05').
      pares.push([(Math.round(q * 1000) * d) / 100000, d])
    }
  }
  return pares
}

function produto<A, B>(as: readonly A[], bs: readonly B[]): [A, B][] {
  return as.flatMap((a) => bs.map((b): [A, B] => [a, b]))
}

// --- os seis derivados ----------------------------------------------------

const KM_SAIDA = [
  0, 1, 5, 7, 50, 99, 100, 500, 999, 1000, 5000, 12345, 50000, 99999, 100000, 123456, 500000,
  999999, 1000000, 2147483,
]
const DELTA_KM = [
  -1000, -100, -1, 0, 1, 2, 3, 7, 10, 17, 50, 99, 100, 101, 450, 850, 1000, 1234, 5000, 9999,
  12345, 50000, 100000, 250000, 1000001,
]

test('kmRodados casa com a coluna gerada de viagem', async () => {
  const pares = produto(KM_SAIDA, DELTA_KM).map(([saida, delta]): [number, number] => [
    saida,
    saida + delta,
  ])
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([saida, chegada]) => ({
    rotulo: `kmSaida=${saida} kmChegada=${chegada}`,
    ts: kmRodados(saida, chegada),
  }))
  const doBanco = await perguntarAoBanco(
    'case when b::integer > a::integer then b::integer - a::integer end',
    pares.map(([saida]) => String(saida)),
    pares.map(([, chegada]) => String(chegada)),
  )

  const { divergentes, toleradas } = conferir('kmRodados', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])
})

test('custoViagem casa com ROUND((combustivel + diarias)::numeric, 2)', async () => {
  // Grade A: os dois lados na escala da coluna, numeric(12,2).
  const naEscalaDaColuna = produto(DUAS_CASAS, DUAS_CASAS)
  // Grade B: a segunda parcela com tres casas. A funcao pura recebe o valor
  // antes de ele ser guardado, e e ai que o arredondamento de meio aparece.
  const antesDaColuna = produto(DUAS_CASAS, TRES_CASAS)
  const pares = [...naEscalaDaColuna, ...antesDaColuna]
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([combustivel, diarias]) => ({
    rotulo: `combustivel=${combustivel} diarias=${diarias}`,
    ts: custoViagem(combustivel, diarias),
  }))
  const doBanco = await perguntarAoBanco(
    'ROUND((a::numeric + b::numeric)::numeric, 2)',
    pares.map(([combustivel]) => String(combustivel)),
    pares.map(([, diarias]) => String(diarias)),
  )

  const { divergentes, toleradas } = conferir('custoViagem', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])

  const erradosAntes = pares.filter(
    ([c, d], i) => antigo(c + d) !== linhas[i]?.ts,
  ).length
  expect(erradosAntes).toBeGreaterThan(0)
})

test('valorTotalParada casa com ROUND(litros * vl_litro, 2)', async () => {
  const pares = produto(DUAS_CASAS, TRES_CASAS)
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([litros, vlLitro]) => ({
    rotulo: `litros=${litros} vlLitro=${vlLitro}`,
    ts: valorTotalParada(litros, vlLitro),
  }))
  const doBanco = await perguntarAoBanco(
    'ROUND(a::numeric(10,2) * b::numeric(10,3), 2)',
    pares.map(([litros]) => String(litros)),
    pares.map(([, vlLitro]) => String(vlLitro)),
  )

  const { divergentes, toleradas } = conferir('valorTotalParada', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])

  const erradosAntes = pares.filter(([l, v], i) => antigo(l * v) !== linhas[i]?.ts).length
  expect(erradosAntes).toBeGreaterThan(0)
})

test('pctCusto casa com ROUND(custo / NULLIF(carga, 0) * 100, 2)', async () => {
  const pares = [...produto(DUAS_CASAS, DENOMINADORES), ...paresDeEmpateDeDivisao()]
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([custo, carga]) => ({
    rotulo: `custoViagem=${custo} valorCarga=${carga}`,
    ts: pctCusto(custo, carga),
  }))
  const doBanco = await perguntarAoBanco(
    'ROUND(a::numeric(12,2) / NULLIF(b::numeric(12,2), 0) * 100, 2)',
    pares.map(([custo]) => String(custo)),
    pares.map(([, carga]) => String(carga)),
  )

  const { divergentes, toleradas } = conferir('pctCusto', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])

  const erradosAntes = pares.filter(
    ([c, v], i) => (v <= 0 ? null : antigo((c / v) * 100)) !== linhas[i]?.ts,
  ).length
  expect(erradosAntes).toBeGreaterThan(0)
})

test('pctQuebra casa com ROUND(m2_quebrado / NULLIF(m2_expedido, 0) * 100, 2)', async () => {
  const pares = [...produto(DUAS_CASAS, DENOMINADORES), ...paresDeEmpateDeDivisao()]
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([quebrado, expedido]) => ({
    rotulo: `m2Quebrado=${quebrado} m2Expedido=${expedido}`,
    ts: pctQuebra(quebrado, expedido),
  }))
  const doBanco = await perguntarAoBanco(
    'ROUND(a::numeric(12,2) / NULLIF(b::numeric(12,2), 0) * 100, 2)',
    pares.map(([quebrado]) => String(quebrado)),
    pares.map(([, expedido]) => String(expedido)),
  )

  const { divergentes, toleradas } = conferir('pctQuebra', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])
})

const KM_RODADOS = [
  1, 2, 3, 7, 11, 13, 17, 23, 37, 41, 59, 97, 101, 150, 333, 450, 700, 850, 1000, 1234, 2500,
  5000, 7777, 12345, 99999,
]
const LITROS = [
  0, 0.01, 0.1, 0.5, 1, 1.5, 3, 7, 9.99, 12.5, 33.33, 50, 100, 150, 200, 331, 333, 500, 800, 1000,
]
const MEDIAS_EMPATE = [0.005, 0.125, 1.005, 2.675, 3.145, 4.445, 5.555, 7.815, 9.995, 12.345]
// Multiplo de 200 mantem `media * litros` inteiro, que e o que km_rodados aceita.
const LITROS_EMPATE = [200, 400, 600, 800, 1000, 2000]

test('mediaKmL casa com ROUND(km_rodados / NULLIF(litros, 0), 2)', async () => {
  const empates = produto(MEDIAS_EMPATE, LITROS_EMPATE).map(([media, litros]): [number, number] => [
    (Math.round(media * 1000) * litros) / 1000,
    litros,
  ])
  const pares = [...produto(KM_RODADOS, LITROS), ...empates]
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([km, litros]) => ({
    rotulo: `kmRodados=${km} totalLitros=${litros}`,
    ts: mediaKmL(km, litros),
  }))
  const doBanco = await perguntarAoBanco(
    'ROUND(a::integer::numeric / NULLIF(b::numeric(10,2), 0), 2)',
    pares.map(([km]) => String(km)),
    pares.map(([, litros]) => String(litros)),
  )

  const { divergentes, toleradas } = conferir('mediaKmL', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])

  const erradosAntes = pares.filter(
    ([km, l], i) => (l <= 0 ? null : antigo(km / l)) !== linhas[i]?.ts,
  ).length
  expect(erradosAntes).toBeGreaterThan(0)
})

// Datas espalhadas por anos bissextos, viradas de mes e o 29 de fevereiro.
function dataDeslocada(dias: number): string {
  const iso = new Date(Date.UTC(2024, 0, 1) + dias * 86_400_000).toISOString()
  return iso.slice(0, 10)
}
const ENTRADAS = [
  0, 1, 30, 58, 59, 60, 200, 364, 365, 366, 400, 730, 731, 800, 1000, 1095, 1096, 1200, 1460,
  1461, 1500, 1826, 2192, 2557, 2922,
]
const DELTA_DIAS = [
  -30, -7, -1, 0, 1, 2, 3, 7, 14, 15, 28, 29, 30, 31, 60, 90, 180, 365, 366, 730,
]

test('diasOficina casa com (data_saida - data_entrada)', async () => {
  const pares = produto(ENTRADAS, DELTA_DIAS).map(([entrada, delta]): [number, number | null] => [
    entrada,
    entrada + delta,
  ])
  // Manutencao em curso: sem saida nao ha dias de oficina, nos dois lados.
  const comNulo: [number, number | null][] = ENTRADAS.map((entrada) => [entrada, null])
  const todos = [...pares, ...comNulo]
  expect(todos.length).toBeGreaterThanOrEqual(400)

  const linhas = todos.map(([entrada, saida]) => ({
    rotulo: `entrada=${dataDeslocada(entrada)} saida=${saida === null ? 'null' : dataDeslocada(saida)}`,
    ts: diasOficina(
      dataISO(dataDeslocada(entrada)),
      saida === null ? null : dataISO(dataDeslocada(saida)),
    ),
  }))
  const doBanco = await perguntarAoBanco(
    'b::date - a::date',
    todos.map(([entrada]) => dataDeslocada(entrada)),
    todos.map(([, saida]) => (saida === null ? null : dataDeslocada(saida))),
  )

  const { divergentes, toleradas } = conferir('diasOficina', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])
})

// Minutos desde 2026-01-01T00:00Z. Cobre meia-noite, a virada do dia, o meio-dia
// e a volta de um dia inteiro para tras.
function carimbo(minutos: number): { data: string; hora: string } {
  const iso = new Date(Date.UTC(2026, 0, 1) + minutos * 60_000).toISOString()
  return { data: iso.slice(0, 10), hora: iso.slice(11, 16) }
}
const PREVISTOS = [
  0, 1, 59, 60, 359, 360, 719, 720, 721, 839, 840, 1080, 1379, 1380, 1439, 1440, 1441, 10080,
  44640, 86400, 129600, 180000, 260000, 400000, 525600,
]
const DELTA_MINUTOS = [
  -1440, -721, -720, -180, -60, -40, -15, -1, 0, 1, 15, 20, 40, 60, 90, 180, 720, 721, 1440, 2880,
]

test('minutosEntre casa com a coluna atraso_min de viagem', async () => {
  const pares = produto(PREVISTOS, DELTA_MINUTOS).map(([previsto, delta]): [number, number] => [
    previsto,
    previsto + delta,
  ])
  expect(pares.length).toBeGreaterThanOrEqual(400)

  const linhas = pares.map(([previsto, chegada]) => {
    const p = carimbo(previsto)
    const c = carimbo(chegada)
    return {
      rotulo: `previsto=${p.data} ${p.hora} chegada=${c.data} ${c.hora}`,
      ts: minutosEntre(instante(p.data, p.hora), instante(c.data, c.hora)),
    }
  })
  const doBanco = await perguntarAoBanco(
    "FLOOR(EXTRACT(EPOCH FROM (b::timestamp - a::timestamp)) / 60 + 0.5)::integer",
    pares.map(([previsto]) => {
      const p = carimbo(previsto)
      return `${p.data} ${p.hora}`
    }),
    pares.map(([, chegada]) => {
      const c = carimbo(chegada)
      return `${c.data} ${c.hora}`
    }),
  )

  const { divergentes, toleradas } = conferir('minutosEntre', linhas, doBanco)
  expect(toleradas).toEqual([])
  expect(divergentes).toEqual([])
})

/**
 * `atraso_min` e o unico derivado que nao arredonda meio para longe do zero. Ele
 * usa `FLOOR(x / 60 + 0.5)`, que e meio para cima na reta, o mesmo que o
 * `Math.round` do JavaScript: 40 minutos e meio de adiantamento dao -40, e nao
 * -41. Trocar isso por `ROUND()` para "uniformizar" com as outras colunas mudaria
 * o sinal do empate negativo. Este teste existe para impedir essa troca.
 *
 * `minutosEntre` nunca chega no empate, porque `HoraHM` so guarda hora e minuto.
 * O empate so aparece quando a coluna `time` traz segundo, e ai o dominio nem ve
 * o numero que a coluna arredondou. E limite de tipo, nao divergencia de conta.
 */
test('atraso_min arredonda como o Math.round, inclusive no meio negativo', async () => {
  const meios = ['13:19:30', '13:20:30', '13:59:30', '14:00:30', '14:40:30', '14:41:30']
  const doBanco = await perguntarAoBanco(
    "FLOOR(EXTRACT(EPOCH FROM (('2026-08-10 ' || b)::timestamp - a::timestamp)) / 60 + 0.5)::integer",
    meios.map(() => '2026-08-10 14:00'),
    meios,
  )
  const emMinutos = meios.map((hora) => {
    const [h, m, s] = hora.split(':').map(Number)
    return ((h ?? 0) * 60 + (m ?? 0) + (s ?? 0) / 60) - 14 * 60
  })

  expect(emMinutos).toEqual([-40.5, -39.5, -0.5, 0.5, 40.5, 41.5])
  // `+ 0` porque `Math.round(-0.5)` devolve -0, e o banco devolve 0. Os dois sao
  // iguais para `===`, que e o que a comparacao das grades usa, mas nao para
  // `Object.is`, que e o que o `toEqual` usa.
  expect(doBanco).toEqual(emMinutos.map((v) => Math.round(v) + 0))
  expect(doBanco).toEqual([-40, -39, 0, 1, 41, 42])
  // Meio para longe do zero daria -41 e -40 nos dois primeiros. Nao e essa a regra.
  expect(doBanco[0]).not.toBe(-41)
})
