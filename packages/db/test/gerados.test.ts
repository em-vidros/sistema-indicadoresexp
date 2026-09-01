/**
 * `atraso_min` contra o Postgres de verdade. A coluna e `GENERATED ALWAYS`, entao a
 * definicao autoritativa mora no SQL da migracao e so um INSERT prova o que ela faz.
 *
 * O que estes testes prendem e a ausencia do `COALESCE(data_prevista, data_saida)`:
 * ele fabricava um dia previsto que ninguem informou e errava por 24 horas na viagem
 * que vira o dia. Sem `data_prevista`, o atraso e NULL. Numero ausente e melhor que
 * numero inventado.
 *
 * Fica em arquivo proprio, e nao no `derivados.test.ts`, porque `atraso_min` e
 * `status_documental` sao os dois derivados que nasceram de estado ilegal, nao de
 * numero faltando (docs/planos/arquitetura.md, "o que sai do jeito antigo").
 */
import { instante, minutosEntre } from '@ind/core/dominio'
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError } from 'drizzle-orm'
import { criarDb } from '../src/index.ts'
import { base, colaborador, rota, veiculo } from '../src/schema/cadastro.ts'
import { manutencao, viagem } from '../src/schema/registro.ts'

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

async function cenario(tx: Tx) {
  const [b] = await tx.insert(base).values({ nome: 'Teste gerados' }).returning()
  const baseId = b!.id
  const [v] = await tx.insert(veiculo).values({ placa: 'GER0001', baseId }).returning()
  const [c] = await tx
    .insert(colaborador)
    .values({ nome: 'Motorista Gerados', funcao: 'motorista', baseId })
    .returning()
  const [r] = await tx.insert(rota).values({ nome: 'Rota Gerados', baseId }).returning()
  return { baseId, veiculoId: v!.id, motoristaId: c!.id, rotaId: r!.id }
}

const erroDe = (p: Promise<unknown>) =>
  p.then(() => null).catch((e: unknown) => e as { cause?: { constraint_name?: string } })

const VIAGEM = {
  dataSaida: '2026-08-31',
  horaSaida: '22:00:00',
  kmSaida: 100000,
  valorCarga: '45000.00',
  combustivel: '1200.00',
  diarias: '300.00',
} as const

const ATRASO_NOTURNO_ESPERADO = 1200

test('atraso_min e NULL quando data_prevista e NULL, mesmo com hora prevista', async () => {
  const linhas = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return tx
      .insert(viagem)
      .values([
        // A tela de hoje manda so a hora prevista: nao ha campo de data prevista.
        {
          ...ids,
          ...VIAGEM,
          horaPrevista: '06:00:00',
          dataChegada: '2026-09-01',
          horaChegada: '02:00:00',
          kmChegada: 100850,
        },
        // Viagem em curso: nem previsao nem chegada.
        { ...ids, ...VIAGEM },
      ])
      .returning()
  })

  expect(linhas[0]!.atrasoMin).toBeNull()
  expect(linhas[1]!.atrasoMin).toBeNull()
})

// Antes, `COALESCE(data_prevista, data_saida)` lia o dia da saida como dia previsto e
// devolvia -240: 4 horas adiantada, quando a viagem chegou 20 horas atrasada.
test('viagem noturna com data prevista: atraso_min conta a virada do dia', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        dataPrevista: '2026-08-31',
        horaPrevista: '06:00:00',
        dataChegada: '2026-09-01',
        horaChegada: '02:00:00',
        kmChegada: 100850,
      })
      .returning()
    return linha!
  })

  expect(l.atrasoMin).toBe(ATRASO_NOTURNO_ESPERADO)
  expect(l.atrasoMin).toBe(
    minutosEntre(instante('2026-08-31', '06:00'), instante('2026-09-01', '02:00')),
  )
})

test('atraso_min e NULL na viagem que ainda nao chegou, mesmo com previsao completa', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({ ...ids, ...VIAGEM, dataPrevista: '2026-08-31', horaPrevista: '06:00:00' })
      .returning()
    return linha!
  })

  expect(l.atrasoMin).toBeNull()
})

test('data prevista sem hora prevista nao passa no viagem_previsao_ck', async () => {
  const erro = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(tx.insert(viagem).values({ ...ids, ...VIAGEM, dataPrevista: '2026-08-31' }))
  })

  expect(erro?.cause?.constraint_name).toBe('viagem_previsao_ck')
})

afterAll(async () => {
  await sql.end()
})

// Os dois CHECK abaixo fecham divergencias que o dominio ja recusava e o banco
// aceitava. O `manutencao_saida_ck` comparava so a data, entao entrada as 17:00 e
// saida as 08:00 do mesmo dia gravava; o `ordemCronologica` do dominio recusa.
//
// Cada tentativa vai na propria transacao: o Postgres aborta a transacao inteira no
// primeiro erro, e a segunda tentativa morreria por isso, nao pelo CHECK.
const MANUTENCAO = {
  tipoManutencao: 'corretiva' as const,
  dataEntrada: '2026-08-25',
  servico: 'Troca de oleo',
  valor: '890.40',
} as const

async function tentarManutencao(extra: Record<string, unknown>) {
  return emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(manutencao).values({
        baseId: ids.baseId,
        veiculoId: ids.veiculoId,
        ...MANUTENCAO,
        ...extra,
      }),
    )
  })
}

test('manutencao com saida antes da entrada nao entra, nem por data nem por hora', async () => {
  const diaAnterior = await tentarManutencao({ dataSaida: '2026-08-24' })
  const horaAnterior = await tentarManutencao({
    horaEntrada: '17:00:00',
    dataSaida: '2026-08-25',
    horaSaida: '08:00:00',
  })
  const mesmoDiaDepois = await tentarManutencao({
    horaEntrada: '08:00:00',
    dataSaida: '2026-08-25',
    horaSaida: '17:00:00',
  })

  expect(diaAnterior?.cause?.constraint_name).toBe('manutencao_saida_ck')
  expect(horaAnterior?.cause?.constraint_name).toBe('manutencao_saida_ck')
  expect(mesmoDiaDepois).toBeNull()
})

test('odometro zerado nao entra: o dominio ja o queria positivo', async () => {
  const zerado = await tentarManutencao({ kmOdometro: 0 })
  const nulo = await tentarManutencao({ kmOdometro: null })

  expect(zerado?.cause?.constraint_name).toBe('manutencao_odometro_ck')
  expect(nulo).toBeNull()
})
