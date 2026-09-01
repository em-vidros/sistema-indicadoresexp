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
import { criarDb } from '../src/index.ts'
import { base, colaborador, rota, veiculo } from '../src/schema/cadastro.ts'
import { arquivo } from '../src/schema/documento.ts'
import { abastecimento, abastecimentoParada, manutencao, quebra, viagem } from '../src/schema/registro.ts'

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
// 3.00 L x 2.675 = 8.025, meio exato. O `numeric` sobe para 8.03; o antigo
// `Math.round(x * 100) / 100` descia para 8.02, porque em float o produto ja
// nasce 8.024999999999999. E o par que faz esta comparacao valer alguma coisa.
const VALOR_TOTAL_MEIO_ESPERADO = 8.03
const DIAS_OFICINA_ESPERADO = 8
const PCT_QUEBRA_ESPERADO = 1.23 // 55.5 / 4500 * 100 = 1.2333...
// 10.05 / 1000 * 100 = 1.005, meio exato: o `numeric` sobe para 1.01 e o antigo
// arredondamento em float descia para 1.00.
const PCT_QUEBRA_MEIO_ESPERADO = 1.01
// (10.00 + 0.05) / 1000 * 100 = 1.005, o mesmo meio exato no custo da viagem.
const PCT_CUSTO_MEIO_ESPERADO = 1.01
// 10.00 + 0.05 = 10.05. As colunas sao numeric(12,2), entao o centavo fracionario
// que o revisor sugeriu (10.005 e 0.005) seria arredondado ja na atribuicao e a
// coluna gravaria 10.02, divergindo da funcao pura. 10.05 e o menor custo que o
// esquema representa e que o `ROUND(..., 0)` estragaria.
const CUSTO_COM_CENTAVO_ESPERADO = 10.05

test('viagem concluida: km_rodados, custo_viagem, pct_custo e atraso_min', async () => {
  const l = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        horaSaida: '06:00:00',
        dataPrevista: '2026-08-10',
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
        dataPrevista: '2026-08-10',
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
        dataPrevista: '2026-08-10',
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

// O dominio usa `positivo` no `valorCarga`, e o banco aceitava o zero: era o
// `NULLIF(valor_carga, 0)` do `pct_custo` cobrindo uma linha que nao devia existir.
// Agora o CHECK recusa a linha, e o NULLIF nunca dispara. A funcao pura continua
// devolvendo nulo para o zero, porque ela tambem le linha antiga e entrada de tela.
test('viagem com carga zerada nao entra: quem recusa e o viagem_nao_negativo_ck', async () => {
  const zerada = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(tx.insert(viagem).values({ ...ids, ...VIAGEM, valorCarga: '0.00' }))
  })

  expect(zerada?.cause?.constraint_name).toBe('viagem_nao_negativo_ck')
  expect(pctCusto(1500, 0)).toBeNull()
})

// O `superRefine` do dominio exige `combustivel + diarias > 0` desde sempre, e o
// banco nao tinha CHECK nenhum para isso: a linha com as duas parcelas zeradas
// gravava e saia com custo_viagem 0.
test('combustivel e diarias zerados juntos nao entram, mas cada um sozinho entra', async () => {
  const soma = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(viagem).values({ ...ids, ...VIAGEM, combustivel: '0.00', diarias: '0.00' }),
    )
  })
  const umaParcela = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({ ...ids, ...VIAGEM, combustivel: '0.00', diarias: '300.00' })
      .returning()
    return linha!
  })

  expect(soma?.cause?.constraint_name).toBe('viagem_custo_ck')
  expect(num(umaParcela.custoViagem)).toBe(custoViagem(0, 300))
})

// `manutencao_saida_ck` existia e o par em `viagem` nao: a linha com saida
// 2026-08-01 e chegada 2026-07-01 gravava e ainda saia com km_rodados 500.
test('viagem com chegada anterior a saida nao entra, nem por data nem por hora', async () => {
  const diaAnterior = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(viagem).values({
        ...ids,
        ...VIAGEM,
        dataSaida: '2026-08-01',
        dataChegada: '2026-07-01',
        horaChegada: '14:00:00',
        kmChegada: 100500,
      }),
    )
  })
  // Mesmo dia, hora menor: o `ordemCronologica` do dominio ja recusava.
  const horaAnterior = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(viagem).values({
        ...ids,
        ...VIAGEM,
        horaSaida: '14:00:00',
        dataChegada: '2026-08-10',
        horaChegada: '06:00:00',
        kmChegada: 100850,
      }),
    )
  })
  // Sem hora de um dos lados a comparacao e por dia, igual ao dominio: chegar no
  // mesmo dia com hora menor que a saida continua valendo, porque nao ha hora.
  const soPorDia = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [linha] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        dataChegada: '2026-08-10',
        horaChegada: '06:00:00',
        kmChegada: 100850,
      })
      .returning()
    return linha!
  })

  expect(diaAnterior?.cause?.constraint_name).toBe('viagem_chegada_ordem_ck')
  expect(horaAnterior?.cause?.constraint_name).toBe('viagem_chegada_ordem_ck')
  expect(soPorDia.kmRodados).toBe(KM_RODADOS_ESPERADO)
})

// `atraso_min` e `FLOOR(...)::integer`. A janela sa fecha o intervalo onde o
// estouro e impossivel e pega o ano digitado errado.
test('data fora da janela de 2020 a 2100 nao entra', async () => {
  const anoErrado = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(tx.insert(viagem).values({ ...ids, ...VIAGEM, dataSaida: '0202-08-10' }))
  })

  expect(anoErrado?.cause?.constraint_name).toBe('viagem_janela_ck')
})

// O que a janela NAO resolve, e por isso esta escrito aqui em vez de prometido no
// comentario do schema: o Postgres calcula a coluna gerada antes de checar as
// constraints, entao a data absurda que estoura o `::integer` ainda sai com
// "integer out of range", sem nomear a coluna nem a restricao.
test('a janela nao chega a tempo quando o proprio atraso_min estoura', async () => {
  const estouro = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(viagem).values({
        ...ids,
        ...VIAGEM,
        dataPrevista: '9999-08-10',
        horaPrevista: '14:00:00',
        dataChegada: '2026-08-10',
        horaChegada: '14:20:00',
        kmChegada: 100850,
      }),
    )
  })

  expect(estouro?.cause?.constraint_name).toBeUndefined()
  expect((estouro?.cause as { message?: string } | undefined)?.message).toBe('integer out of range')
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
    return tx
      .insert(abastecimentoParada)
      .values([
        { abastecimentoId: a!.id, ordem: 1, litros: '2.50', vlLitro: '4.111' },
        { abastecimentoId: a!.id, ordem: 2, litros: '3.00', vlLitro: '2.675' },
      ])
      .returning()
  })

  expect(num(l[0]!.valorTotal)).toBe(VALOR_TOTAL_ESPERADO)
  expect(num(l[0]!.valorTotal)).toBe(valorTotalParada(2.5, 4.111))
  expect(num(l[1]!.valorTotal)).toBe(VALOR_TOTAL_MEIO_ESPERADO)
  expect(num(l[1]!.valorTotal)).toBe(valorTotalParada(3, 2.675))
})

test('abastecimento_parada e viagem: o meio exato sobe, igual ao numeric', async () => {
  const { parada, viagemDoMeio } = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [a] = await tx
      .insert(abastecimento)
      .values({ baseId: ids.baseId, veiculoId: ids.veiculoId, data: '2026-08-10' })
      .returning()
    const [parada] = await tx
      .insert(abastecimentoParada)
      .values({ abastecimentoId: a!.id, ordem: 1, litros: '1.00', vlLitro: '1.005' })
      .returning()
    const [viagemDoMeio] = await tx
      .insert(viagem)
      .values({
        ...ids,
        ...VIAGEM,
        valorCarga: '1000.00',
        combustivel: '10.00',
        diarias: '0.05',
      })
      .returning()
    return { parada: parada!, viagemDoMeio: viagemDoMeio! }
  })

  // 1.00 L x 1.005 = 1.005 -> 1.01, e nao o 1.00 que o float devolvia.
  expect(num(parada.valorTotal)).toBe(1.01)
  expect(num(parada.valorTotal)).toBe(valorTotalParada(1, 1.005))
  // As outras linhas de viagem valem 1500.00 redondo, entao trocar o `ROUND(..., 2)`
  // do `custo_viagem` por `ROUND(..., 0)` passava pela suite inteira sem ser pego.
  // Este e o unico custo com centavo que nao some no arredondamento para inteiro.
  expect(num(viagemDoMeio.custoViagem)).toBe(CUSTO_COM_CENTAVO_ESPERADO)
  expect(num(viagemDoMeio.custoViagem)).toBe(custoViagem(10, 0.05))
  expect(num(viagemDoMeio.pctCusto)).toBe(PCT_CUSTO_MEIO_ESPERADO)
  expect(num(viagemDoMeio.pctCusto)).toBe(pctCusto(custoViagem(10, 0.05), 1000))
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

test('quebra: pct_quebra, e o expedido zerado nao entra', async () => {
  const linhas = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return tx
      .insert(quebra)
      .values([
        { baseId: ids.baseId, data: '2026-08-10', m2Expedido: '4500.00', m2Quebrado: '55.50' },
        // m2Quebrado continua em `naoNegativo`: carga sem quebra e o caso comum.
        { baseId: ids.baseId, data: '2026-08-11', m2Expedido: '4500.00', m2Quebrado: '0.00' },
        { baseId: ids.baseId, data: '2026-08-12', m2Expedido: '1000.00', m2Quebrado: '10.05' },
      ])
      .returning()
  })
  // `m2Expedido` e `positivo` no dominio (linha 925 do formulario). O banco aceitava
  // o zero e deixava o `NULLIF` do `pct_quebra` cobrir a linha.
  const expedidoZero = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx
        .insert(quebra)
        .values({ baseId: ids.baseId, data: '2026-08-11', m2Expedido: '0.00', m2Quebrado: '55.50' }),
    )
  })

  expect(num(linhas[0]!.pctQuebra)).toBe(PCT_QUEBRA_ESPERADO)
  expect(num(linhas[0]!.pctQuebra)).toBe(pctQuebra(55.5, 4500))
  expect(num(linhas[1]!.pctQuebra)).toBe(0)
  expect(num(linhas[2]!.pctQuebra)).toBe(PCT_QUEBRA_MEIO_ESPERADO)
  expect(num(linhas[2]!.pctQuebra)).toBe(pctQuebra(10.05, 1000))
  expect(expedidoZero?.cause?.constraint_name).toBe('quebra_nao_negativo_ck')
  expect(pctQuebra(55.5, 0)).toBeNull()
})

// `litros` e `positivo` no dominio; `vl_litro` e `naoNegativo`, porque a linha 866
// do formulario e `if (lt === 0) continue` e so olha os litros.
test('parada: litros zerados nao entram, valor por litro zerado entra', async () => {
  const litrosZero = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [a] = await tx
      .insert(abastecimento)
      .values({ baseId: ids.baseId, veiculoId: ids.veiculoId, data: '2026-08-10' })
      .returning()
    return erroDe(
      tx
        .insert(abastecimentoParada)
        .values({ abastecimentoId: a!.id, ordem: 1, litros: '0.00', vlLitro: '4.111' }),
    )
  })
  const vlLitroZero = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [a] = await tx
      .insert(abastecimento)
      .values({ baseId: ids.baseId, veiculoId: ids.veiculoId, data: '2026-08-10' })
      .returning()
    const [parada] = await tx
      .insert(abastecimentoParada)
      .values({ abastecimentoId: a!.id, ordem: 1, litros: '2.50', vlLitro: '0.000' })
      .returning()
    return parada!
  })

  expect(litrosZero?.cause?.constraint_name).toBe('abastecimento_parada_nao_negativo_ck')
  expect(num(vlLitroZero.valorTotal)).toBe(valorTotalParada(2.5, 0))
})

afterAll(async () => {
  await sql.end()
})
