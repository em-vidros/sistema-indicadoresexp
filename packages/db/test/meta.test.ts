/**
 * O `meta_limite_ck` contra o Postgres de verdade. A tabela so tinha a chave
 * primaria, entao o par invertido entrava: com
 * ('custo_carga','menor_melhor', 9, 7), todo valor que passa de 7 ja passou de 9, a
 * faixa amarela do painel some e `avaliarKpi(8, ...)` responde `ok`. Sao quatro
 * linhas vindas do seed, e o CHECK e o unico guarda no caminho de quem nao passa
 * pelo zod, porque o `Limiar` de `dominio/kpi.ts` so cobre o que atravessa o parse.
 */
import { avaliarKpi, Limiar } from '@ind/core/dominio'
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError, inArray } from 'drizzle-orm'
import { criarDb } from '../src/index.ts'
import { meta } from '../src/schema/meta.ts'

const { db, sql } = criarDb(undefined, { max: 1 })

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function emTransacao<T>(corpo: (tx: Tx) => Promise<T>): Promise<T> {
  let saida: T | undefined
  try {
    await db.transaction(async (tx) => {
      saida = await corpo(tx)
      tx.rollback()
    })
  } catch (erro) {
    if (!(erro instanceof TransactionRollbackError)) throw erro
  }
  return saida as T
}

const erroDe = (p: Promise<unknown>) =>
  p.then(() => null).catch((e: unknown) => e as { cause?: { constraint_name?: string } })

test('par invertido nao entra, nas duas direcoes', async () => {
  const menor = await emTransacao(async (tx) =>
    erroDe(
      tx.insert(meta).values({
        chave: 'custo_carga',
        direcao: 'menor_melhor',
        limiteOk: '9.0000',
        limiteAtencao: '7.0000',
      }),
    ),
  )
  const maior = await emTransacao(async (tx) =>
    erroDe(
      tx.insert(meta).values({
        chave: 'pontualidade',
        direcao: 'maior_melhor',
        limiteOk: '90.0000',
        limiteAtencao: '95.0000',
      }),
    ),
  )

  expect(menor?.cause?.constraint_name).toBe('meta_limite_ck')
  expect(maior?.cause?.constraint_name).toBe('meta_limite_ck')

  // O dominio ja recusava os dois; o banco e que deixava passar.
  expect(Limiar.safeParse({ direcao: 'menor_melhor', limiteOk: 9, limiteAtencao: 7 }).success).toBe(
    false,
  )
  expect(
    Limiar.safeParse({ direcao: 'maior_melhor', limiteOk: 90, limiteAtencao: 95 }).success,
  ).toBe(false)
})

test('par na ordem certa entra, com faixa e sem faixa', async () => {
  const linhas = await emTransacao(async (tx) => {
    // Tres destas chaves sao as do proprio seed, e desde que ele existe elas ja estao
    // na tabela: sem o DELETE o INSERT bate em `meta_pkey` antes de chegar ao CHECK,
    // e o teste passaria a medir a chave primaria em vez do limiar. Trocar por chave
    // inventada seria mais facil e provaria menos, porque o que interessa aqui e que
    // os quatro pares reais entram. O DELETE morre no rollback junto com o resto.
    await tx.delete(meta).where(inArray(meta.chave, ['custo_carga', 'quebra', 'pontualidade', 'atraso']))
    return tx
      .insert(meta)
      .values([
        { chave: 'custo_carga', direcao: 'menor_melhor', limiteOk: '7.0000', limiteAtencao: '9.0000' },
        { chave: 'quebra', direcao: 'menor_melhor', limiteOk: '1.0000', limiteAtencao: '2.0000' },
        { chave: 'pontualidade', direcao: 'maior_melhor', limiteOk: '95.0000', limiteAtencao: '90.0000' },
        // O percentual de atraso (linha 431 do dashboard) so tem duas faixas.
        { chave: 'atraso', direcao: 'menor_melhor', limiteOk: '5.0000', limiteAtencao: null },
      ])
      .returning()
  })

  expect(linhas).toHaveLength(4)
  // A faixa amarela que o par invertido apagava.
  expect(avaliarKpi(8, { direcao: 'menor_melhor', limiteOk: 7, limiteAtencao: 9 })).toBe('atencao')
})

// Limites iguais sao a fronteira, e o dominio usa `>=` e `<=`: uma faixa amarela de
// largura zero e degenerada, mas nao e o par trocado que este CHECK ataca.
test('limites iguais passam nos dois lados', async () => {
  const linha = await emTransacao(async (tx) => {
    const [l] = await tx
      .insert(meta)
      .values({ chave: 'manutencao', direcao: 'menor_melhor', limiteOk: '2.0000', limiteAtencao: '2.0000' })
      .returning()
    return l!
  })

  expect(linha.limiteAtencao).toBe('2.0000')
  expect(
    Limiar.safeParse({ direcao: 'menor_melhor', limiteOk: 2, limiteAtencao: 2 }).success,
  ).toBe(true)
})

afterAll(async () => {
  await sql.end()
})
