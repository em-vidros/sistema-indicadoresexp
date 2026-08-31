import {
  custoViagem,
  dataISO,
  diasOficina,
  instante,
  kmRodados,
  minutosEntre,
  pctCusto,
  pctQuebra,
  valorTotalParada,
} from '@ind/core/dominio'
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError } from 'drizzle-orm'
import { criarDb } from './index.ts'
import { base, colaborador, rota, veiculo } from './schema/cadastro.ts'
import { arquivo } from './schema/documento.ts'
import { abastecimento, abastecimentoParada, manutencao, quebra, viagem } from './schema/registro.ts'

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
  const [b] = await tx.insert(base).values({ nome: 'Teste' }).returning()
  const baseId = b!.id
  const [v] = await tx.insert(veiculo).values({ placa: 'TST0001', baseId }).returning()
  const [c] = await tx
    .insert(colaborador)
    .values({ nome: 'Motorista Teste', funcao: 'motorista', baseId })
    .returning()
  const [r] = await tx.insert(rota).values({ nome: 'Rota Teste', baseId }).returning()
  return { baseId, veiculoId: v!.id, motoristaId: c!.id, rotaId: r!.id }
}

const num = (v: string | number | null) => (v === null ? null : Number(v))
const erroDe = (p: Promise<unknown>) =>
  p.then(() => null).catch((e: unknown) => e as { cause?: { constraint_name?: string } })

const VIAGEM = {
  dataSaida: '2026-08-10',
  kmSaida: 100000,
  valorCarga: '45000.00',
  combustivel: '1200.00',
  diarias: '300.00',
} as const

// combustivel 1200 + diarias 300 = 1500; 1500 / 45000 * 100 = 3.3333... -> 3.33
const CUSTO_ESPERADO = 1500
const PCT_CUSTO_ESPERADO = 3.33
const KM_RODADOS_ESPERADO = 850
const ATRASO_ESPERADO = 20
const ATRASO_VIRADA_ESPERADO = 40
const ATRASO_ADIANTADO_ESPERADO = -15
// 2.50 L x 4.111 = 10.2775 -> 10.28
const VALOR_TOTAL_ESPERADO = 10.28
const DIAS_OFICINA_ESPERADO = 8
const PCT_QUEBRA_ESPERADO = 1.23 // 55.5 / 4500 * 100 = 1.2333...

test('viagem concluida: km_rodados, custo_viagem, pct_custo e atraso_min', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        horaSaida: '06:00:00',
        horaPrevista: '14:00:00',
        dataChegada: '2026-08-10',
        horaChegada: '14:20:00',
        kmChegada: 100850,
      })
      .returning()
    return linha!
  })

  expect(l.kmRodados).toBe(KM_RODADOS_ESPERADO)
  expect(num(l.custoViagem)).toBe(CUSTO_ESPERADO)
  expect(num(l.pctCusto)).toBe(PCT_CUSTO_ESPERADO)
  expect(l.atrasoMin).toBe(ATRASO_ESPERADO)

  expect(l.kmRodados).toBe(kmRodados(100000, 100850))
  expect(num(l.custoViagem)).toBe(custoViagem(1200, 300))
  expect(num(l.pctCusto)).toBe(pctCusto(1500, 45000))
  expect(l.atrasoMin).toBe(
    minutosEntre(instante('2026-08-10', '14:00'), instante('2026-08-10', '14:20')),
  )
})

test('viagem que chega depois da meia-noite: atraso conta a virada do dia', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        horaPrevista: '23:30:00',
        dataChegada: '2026-08-11',
        horaChegada: '00:10:00',
        kmChegada: 100850,
      })
      .returning()
    return linha!
  })

  expect(l.atrasoMin).toBe(ATRASO_VIRADA_ESPERADO)
  expect(l.atrasoMin).toBe(
    minutosEntre(instante('2026-08-10', '23:30'), instante('2026-08-11', '00:10')),
  )
})

test('viagem adiantada: atraso_min e negativo', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        horaPrevista: '14:00:00',
        dataChegada: '2026-08-10',
        horaChegada: '13:45:00',
        kmChegada: 100850,
      })
      .returning()
    return linha!
  })

  expect(l.atrasoMin).toBe(ATRASO_ADIANTADO_ESPERADO)
  expect(l.atrasoMin).toBe(
    minutosEntre(instante('2026-08-10', '14:00'), instante('2026-08-10', '13:45')),
  )
})

test('viagem com carga zerada: pct_custo e nulo, nao zero nem erro', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({ ...ids, ...VIAGEM, valorCarga: '0.00' })
      .returning()
    return linha!
  })

  expect(num(l.custoViagem)).toBe(CUSTO_ESPERADO)
  expect(l.pctCusto).toBeNull()
  expect(pctCusto(1500, 0)).toBeNull()
})

test('viagem em curso e viagem sem km ganho: derivados de chegada sao nulos', async () => {
  const linhas = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return tx
      .insert(viagem)
      .values([
        { ...ids, ...VIAGEM, horaPrevista: '14:00:00' },
        { ...ids, ...VIAGEM, dataChegada: '2026-08-10', horaChegada: '14:00', kmChegada: 100000 },
        { ...ids, ...VIAGEM, dataChegada: '2026-08-11', horaChegada: '14:00', kmChegada: 99000 },
      ])
      .returning()
  })

  expect(linhas.map((l) => l.kmRodados)).toEqual([null, null, null])
  expect(linhas[0]!.atrasoMin).toBeNull()
  expect(kmRodados(100000, 100000)).toBeNull()
  expect(kmRodados(100000, 99000)).toBeNull()
})

test('viagem recusa meia chegada e carga negativa', async () => {
  // Um erro aborta a transacao inteira no Postgres, entao cada recusa vai na sua.
  const meia = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(viagem).values({ ...ids, ...VIAGEM, dataChegada: '2026-08-10', kmChegada: 100850 }),
    )
  })
  const negativa = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(tx.insert(viagem).values({ ...ids, ...VIAGEM, valorCarga: '-100.00' }))
  })

  expect(meia?.cause?.constraint_name).toBe('viagem_chegada_ck')
  expect(negativa?.cause?.constraint_name).toBe('viagem_nao_negativo_ck')
})

test('abastecimento_parada: valor_total', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [a] = await tx
      .insert(abastecimento)
      .values({ baseId: ids.baseId, veiculoId: ids.veiculoId, data: '2026-08-10' })
      .returning()
    const [p] = await tx
      .insert(abastecimentoParada)
      .values({ abastecimentoId: a!.id, ordem: 1, litros: '2.50', vlLitro: '4.111' })
      .returning()
    return p!
  })

  expect(num(l.valorTotal)).toBe(VALOR_TOTAL_ESPERADO)
  expect(num(l.valorTotal)).toBe(valorTotalParada(2.5, 4.111))
})

test('manutencao: dias_oficina, status_documental e saida antes da entrada', async () => {
  const { linhas } = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const arquivos = await tx
      .insert(arquivo)
      .values([
        { nomeOriginal: 'orc.pdf', mime: 'application/pdf', tamanho: 10, caminho: 'a/1', sha256: 'a' },
        { nomeOriginal: 'os.pdf', mime: 'application/pdf', tamanho: 10, caminho: 'a/2', sha256: 'b' },
      ])
      .returning()
    const comum = { baseId: ids.baseId, veiculoId: ids.veiculoId, valor: '900.00' } as const
    const linhas = await tx
      .insert(manutencao)
      .values([
        {
          ...comum,
          tipoManutencao: 'corretiva',
          dataEntrada: '2026-08-03',
          dataSaida: '2026-08-11',
          servico: 'Troca de embreagem',
          orcamentoArquivoId: arquivos[0]!.id,
          osArquivoId: arquivos[1]!.id,
        },
        {
          ...comum,
          tipoManutencao: 'preventiva',
          dataEntrada: '2026-08-03',
          servico: 'Troca de oleo',
          orcamentoArquivoId: arquivos[0]!.id,
        },
      ])
      .returning()
    return { linhas }
  })
  const invertida = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(manutencao).values({
        baseId: ids.baseId,
        veiculoId: ids.veiculoId,
        valor: '900.00',
        tipoManutencao: 'corretiva',
        dataEntrada: '2026-08-11',
        dataSaida: '2026-08-03',
        servico: 'Data trocada',
      }),
    )
  })

  expect(linhas[0]!.diasOficina).toBe(DIAS_OFICINA_ESPERADO)
  expect(linhas[0]!.diasOficina).toBe(diasOficina(dataISO('2026-08-03'), dataISO('2026-08-11')))
  expect(linhas[0]!.statusDocumental).toBe(true)
  expect(linhas[1]!.diasOficina).toBeNull()
  expect(linhas[1]!.statusDocumental).toBe(false)
  expect(invertida?.cause?.constraint_name).toBe('manutencao_saida_ck')
})

test('quebra: pct_quebra, e nulo quando o expedido e zero', async () => {
  const linhas = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return tx
      .insert(quebra)
      .values([
        { baseId: ids.baseId, data: '2026-08-10', m2Expedido: '4500.00', m2Quebrado: '55.50' },
        { baseId: ids.baseId, data: '2026-08-11', m2Expedido: '0.00', m2Quebrado: '55.50' },
      ])
      .returning()
  })

  expect(num(linhas[0]!.pctQuebra)).toBe(PCT_QUEBRA_ESPERADO)
  expect(num(linhas[0]!.pctQuebra)).toBe(pctQuebra(55.5, 4500))
  expect(linhas[1]!.pctQuebra).toBeNull()
  expect(pctQuebra(55.5, 0)).toBeNull()
})

afterAll(async () => {
  await sql.end()
})
