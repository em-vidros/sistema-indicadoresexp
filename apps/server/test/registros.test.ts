import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cookieDaLivia, cookieDe, pedir, sql } from './ajuda.ts'

let livia = ''
let andreina = ''
const viagens: string[] = []
const abastecimentos: string[] = []
const manutencoes: string[] = []
const quebras: string[] = []

beforeAll(async () => {
  ;[livia, andreina] = await Promise.all([
    cookieDaLivia(),
    cookieDe('andreina', 'SENHA_ANDREINA'),
  ])
})

afterAll(async () => {
  if (viagens.length) await sql`delete from viagem where id = any(${sql.array(viagens)}::uuid[])`
  if (abastecimentos.length) await sql`delete from abastecimento where id = any(${sql.array(abastecimentos)}::uuid[])`
  if (manutencoes.length) await sql`delete from manutencao where id = any(${sql.array(manutencoes)}::uuid[])`
  if (quebras.length) await sql`delete from quebra where id = any(${sql.array(quebras)}::uuid[])`
})

const viagem = {
  tipo: 'viagem',
  base: 'Imperatriz',
  data_saida: '2026-09-01',
  hora_saida: '08:00',
  data_chegada: '2026-09-01',
  hora_prevista: '18:00',
  hora_chegada: '18:30',
  motorista: 'Nataniel Pereira Rocha',
  veiculo: 'DMG9D41',
  rota: 'PARAUAPEBAS',
  km_saida: 1000,
  km_chegada: 1200,
  valor_carga: 10000,
  combustivel: 500,
  diarias: 200,
  m2: 50,
  peso_kg: 1000,
  observacao: 'Prova da fase 2',
}

describe('registros operacionais no banco', () => {
  test('a Lívia grava e outra requisição lê a mesma viagem', async () => {
    const resposta = await pedir('/api/registros', {
      method: 'POST',
      headers: { cookie: livia, 'content-type': 'application/json' },
      body: JSON.stringify({ registros: [viagem] }),
    })
    expect(resposta.status).toBe(201)
    const [salva] = (await resposta.json()) as Array<{ id: string }>
    viagens.push(salva!.id)

    const lista = await pedir('/api/registros?base=Imperatriz', { headers: { cookie: livia } })
    expect(lista.status).toBe(200)
    expect((await lista.json()) as unknown[]).toContainEqual(expect.objectContaining({
      id: salva!.id,
      tipo: 'viagem',
      base: 'Imperatriz',
      veiculo: 'DMG9D41',
      km_rodados: 200,
    }))
  })

  test('Andreina não consegue lançar na base de Imperatriz', async () => {
    const resposta = await pedir('/api/registros', {
      method: 'POST',
      headers: { cookie: andreina, 'content-type': 'application/json' },
      body: JSON.stringify({ registros: [viagem] }),
    })
    expect(resposta.status).toBe(403)
  })

  test('grava abastecimento com três paradas, manutenção e quebra no mesmo banco', async () => {
    const registros = [
      ...[1, 2, 3].map((ordem) => ({
        tipo: 'abastecimento', base: 'Raposa', data: '2026-09-01', placa: 'PTV0006',
        rota: 'PINHEIRO', litros: 50 + ordem, vl_litro: 6.1, km: 1000 + ordem * 100,
        posto: `Posto ${ordem}`, slot: ['Saída', 'Interior', 'Chegada'][ordem - 1], viagem_longa: true,
      })),
      {
        tipo: 'manutencao', base: 'Raposa', tipo_manutencao: 'preventiva',
        data_programada: '2026-08-31', data_entrada: '2026-09-01', hora_entrada: '08:00',
        data_saida: '2026-09-02', hora_saida: '09:00', placa: 'PTV0006',
        servico: 'Revisão da prova', valor: 1200, km_odometro: 30000, fornecedor: 'Oficina teste',
      },
      {
        tipo: 'quebra', base: 'Raposa', data: '2026-09-01', m2_expedido: 100,
        m2_quebrado: 0.5, observacao: 'Prova',
      },
    ]
    const resposta = await pedir('/api/registros', {
      method: 'POST', headers: { cookie: livia, 'content-type': 'application/json' },
      body: JSON.stringify({ registros }),
    })
    expect(resposta.status).toBe(201)
    const salvos = (await resposta.json()) as Array<{ id: string; tipo: string }>
    abastecimentos.push(salvos.find((item) => item.tipo === 'abastecimento')!.id)
    manutencoes.push(salvos.find((item) => item.tipo === 'manutencao')!.id)
    quebras.push(salvos.find((item) => item.tipo === 'quebra')!.id)

    const lista = (await (await pedir('/api/registros?base=Raposa', { headers: { cookie: livia } })).json()) as Array<Record<string, unknown>>
    expect(lista.filter((item) => item['abastecimento_id'] === abastecimentos[0])).toHaveLength(3)
    expect(lista).toContainEqual(expect.objectContaining({ tipo: 'manutencao', id: manutencoes[0] }))
    expect(lista).toContainEqual(expect.objectContaining({ tipo: 'quebra', id: quebras[0], pct_quebra: 0.5 }))
  })
})

const DIA = '2026-09-03'
const OUTRO_DIA = '2026-09-04'

async function limpar(cookie: string, base: string, data: string, init: RequestInit = {}) {
  return await pedir(`/api/registros?base=${encodeURIComponent(base)}&data=${data}`, {
    method: 'DELETE',
    headers: { cookie },
    ...init,
  })
}

const guardas = { viagem: viagens, abastecimento: abastecimentos, manutencao: manutencoes, quebra: quebras }

/** Lança e já anota os ids, para o `afterAll` levar tudo embora. */
async function lancar(cookie: string, registros: unknown[]) {
  const resposta = await pedir('/api/registros', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ registros }),
  })
  expect(resposta.status).toBe(201)
  const salvos = (await resposta.json()) as Array<{ id: string; tipo: keyof typeof guardas }>
  for (const salvo of salvos) guardas[salvo.tipo].push(salvo.id)
  return salvos
}

const quebraEm = (base: string, data: string) => ({
  tipo: 'quebra', base, data, m2_expedido: 80, m2_quebrado: 1, observacao: 'do dia',
})

/** Duas linhas em Imperatriz no mesmo dia, e os ids para a limpeza do arquivo. */
async function lancarODia(cookie: string) {
  const salvos = await lancar(cookie, [
    { ...viagem, data_saida: DIA, data_chegada: DIA },
    quebraEm('Imperatriz', DIA),
  ])
  return {
    idViagem: salvos.find((item) => item.tipo === 'viagem')!.id,
    idQuebra: salvos.find((item) => item.tipo === 'quebra')!.id,
  }
}

async function apagadoEmDe(tabela: 'viagem' | 'quebra', id: string) {
  const [linha] = await sql<Array<{ apagado_em: Date | null }>>`
    select apagado_em from ${sql(tabela)} where id = ${id}::uuid`
  expect(linha).toBeDefined()
  return linha!.apagado_em
}

describe('apagar os registros do dia', () => {
  test('a Lívia limpa o dia da base e as linhas somem da leitura', async () => {
    // O dia começa vazio: outra execução pode ter deixado lançamento nesta data,
    // e sem isso a contagem exata não seria dela.
    await limpar(livia, 'Imperatriz', DIA)
    const { idViagem, idQuebra } = await lancarODia(livia)

    const resposta = await limpar(livia, 'Imperatriz', DIA)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({
      apagados: 2,
      por_tipo: { viagem: 1, abastecimento: 0, manutencao: 0, quebra: 1 },
    })

    const lista = (await (await pedir('/api/registros?base=Imperatriz', { headers: { cookie: livia } })).json()) as Array<{ id: string }>
    expect(lista.map((item) => item.id)).not.toContain(idViagem)
    expect(lista.map((item) => item.id)).not.toContain(idQuebra)
  })

  test('o dia apagado continua no banco, com apagado_em e quem apagou', async () => {
    const [linha] = await sql<Array<{ apagado_em: Date | null; atualizado_por: string | null }>>`
      select apagado_em, atualizado_por from viagem where id = ${viagens.at(-1)!}::uuid`
    expect(linha).toBeDefined()
    expect(linha!.apagado_em).not.toBeNull()
    expect(linha!.atualizado_por).toBe('usr_livia')
  })

  test('a base e a data também chegam pelo corpo', async () => {
    const { idViagem } = await lancarODia(livia)
    const resposta = await pedir('/api/registros', {
      method: 'DELETE',
      headers: { cookie: livia, 'content-type': 'application/json' },
      body: JSON.stringify({ base: 'Imperatriz', data: DIA }),
    })
    expect(resposta.status).toBe(200)
    expect((await resposta.json()) as { apagados: number }).toMatchObject({ apagados: 2 })
    const [linha] = await sql<Array<{ apagado_em: Date | null }>>`
      select apagado_em from viagem where id = ${idViagem}::uuid`
    expect(linha!.apagado_em).not.toBeNull()
  })

  test('sem base ou sem data é 400, e nada é apagado', async () => {
    const { idViagem } = await lancarODia(livia)
    expect((await pedir('/api/registros', { method: 'DELETE', headers: { cookie: livia } })).status).toBe(400)
    expect((await limpar(livia, 'Imperatriz', 'hoje')).status).toBe(400)
    const [linha] = await sql<Array<{ apagado_em: Date | null }>>`
      select apagado_em from viagem where id = ${idViagem}::uuid`
    expect(linha!.apagado_em).toBeNull()
  })

  test('Andreina não limpa o dia de Imperatriz, e o dia continua lá', async () => {
    const idViagem = viagens.at(-1)!
    const resposta = await limpar(andreina, 'Imperatriz', DIA)
    expect(resposta.status).toBe(403)
    const [linha] = await sql<Array<{ apagado_em: Date | null }>>`
      select apagado_em from viagem where id = ${idViagem}::uuid`
    expect(linha!.apagado_em).toBeNull()

    // E a Lívia, que pode, apaga o mesmo dia: o 403 foi da base, não do estado.
    expect((await limpar(livia, 'Imperatriz', DIA)).status).toBe(200)
  })

  test('a limpeza alcança só a base e o dia pedidos', async () => {
    const { idViagem, idQuebra } = await lancarODia(livia)
    const [vizinhaDeDia] = await lancar(livia, [{ ...viagem, data_saida: OUTRO_DIA, data_chegada: OUTRO_DIA }])
    const [vizinhaDeBase] = await lancar(livia, [quebraEm('Raposa', DIA)])

    const resposta = await limpar(livia, 'Imperatriz', DIA)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({
      apagados: 2,
      por_tipo: { viagem: 1, abastecimento: 0, manutencao: 0, quebra: 1 },
    })

    expect(await apagadoEmDe('viagem', idViagem)).not.toBeNull()
    expect(await apagadoEmDe('quebra', idQuebra)).not.toBeNull()
    expect(await apagadoEmDe('viagem', vizinhaDeDia!.id)).toBeNull()
    expect(await apagadoEmDe('quebra', vizinhaDeBase!.id)).toBeNull()
  })
})

/**
 * Regra do banco violada é entrada inválida, e entrada inválida é 400 com
 * mensagem. Antes disto, o CHECK do Postgres subia cru e a tela recebia
 * `Internal Server Error` em texto puro, sem dizer o que corrigir.
 *
 * O cadastro da Raposa é o que existe na base: sem motorista, veículo e rota
 * de verdade a rota recusaria antes com "cadastro inexistente", e o teste
 * passaria pelo motivo errado.
 */
const viagemRaposa = {
  ...viagem,
  base: 'Raposa',
  motorista: 'Anderson Penha Dos Anjos',
  veiculo: 'PTV0006',
  rota: 'PINHEIRO',
}

async function recusa(registros: unknown[]) {
  const resposta = await pedir('/api/registros', {
    method: 'POST',
    headers: { cookie: livia, 'content-type': 'application/json' },
    body: JSON.stringify({ registros }),
  })
  const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null
  return { status: resposta.status, erro: corpo?.erro ?? '' }
}

describe('regra do banco violada vira 400 com mensagem', () => {
  test('viagem_custo_ck: combustível e diárias zerados', async () => {
    const { status, erro } = await recusa([{ ...viagemRaposa, combustivel: 0, diarias: 0 }])
    expect(status).toBe(400)
    expect(erro).toMatch(/combustível.*diárias/i)
    expect(erro).toMatch(/maior que zero/i)
  })

  test('viagem_chegada_ordem_ck: chegada antes da saída, no dia e na hora', async () => {
    const diaAnterior = await recusa([
      { ...viagemRaposa, data_saida: '2026-09-02', data_chegada: '2026-09-01' },
    ])
    expect(diaAnterior.status).toBe(400)
    expect(diaAnterior.erro).toMatch(/chegada não pode ser anterior à saída/i)

    const horaAnterior = await recusa([
      { ...viagemRaposa, hora_saida: '18:00', hora_chegada: '08:00' },
    ])
    expect(horaAnterior.status).toBe(400)
    expect(horaAnterior.erro).toMatch(/chegada não pode ser anterior à saída/i)
  })

  test('abastecimento_parada_ordem_ck: quatro paradas na mesma viagem longa', async () => {
    const { status, erro } = await recusa(
      [1, 2, 3, 4].map((ordem) => ({
        tipo: 'abastecimento', base: 'Raposa', data: '2026-09-05', placa: 'PTV0006',
        rota: 'PINHEIRO', litros: 50 + ordem, vl_litro: 6.1, km: 1000 + ordem * 100,
        posto: `Posto ${ordem}`, slot: null, viagem_longa: true,
      })),
    )
    expect(status).toBe(400)
    expect(erro).toMatch(/no máximo 3 paradas/i)
  })

  /**
   * A rede embaixo do espelhamento. `viagem_janela_ck` não está espelhado no zod
   * — é o caminho que ninguém previu —, e mesmo assim a resposta é 400, com o
   * nome da regra que recusou.
   */
  test('CHECK não espelhado também vira 400, citando a regra', async () => {
    const { status, erro } = await recusa([
      { ...viagemRaposa, data_saida: '1999-08-01', data_chegada: '1999-08-01' },
    ])
    expect(status).toBe(400)
    expect(erro).toMatch(/o banco recusou o lançamento/i)
    expect(erro).toContain('viagem_janela_ck')
  })

  test('a viagem legítima da mesma base continua entrando', async () => {
    const [salva] = await lancar(livia, [{ ...viagemRaposa, data_saida: '2026-09-06', data_chegada: '2026-09-06' }])
    expect(salva!.tipo).toBe('viagem')
  })
})

/**
 * Forma de data não é data. `^\d{4}-\d{2}-\d{2}$` casa `2026-02-31` e
 * `2026-99-99`, e `hora_saida` nem forma tinha: era `z.string().trim().nullable()`
 * alimentando coluna `time`, então texto arbitrário chegava ao Postgres.
 *
 * O Postgres recusa isso com 22008, que não é 23514 e por isso passava por fora
 * da rede de `checkViolado`: o cliente recebia 500 por ter digitado um dia que
 * não existe. Agora quem recusa é o zod, com `ehDataValida`/`ehHoraValida` de
 * `@ind/core`, e a resposta é 400 com o que corrigir.
 */
const manutencaoRaposa = {
  tipo: 'manutencao', base: 'Raposa', tipo_manutencao: 'preventiva',
  data_programada: null, data_entrada: '2026-09-07', hora_entrada: '08:00',
  data_saida: null, hora_saida: null, placa: 'PTV0006',
  servico: 'Prova de data inválida', valor: 100, km_odometro: 30000, fornecedor: 'Oficina teste',
}

describe('data e hora que não existem no calendário viram 400', () => {
  test('30 de fevereiro na saída da viagem', async () => {
    const { status, erro } = await recusa([
      { ...viagemRaposa, data_saida: '2026-02-31', data_chegada: '2026-02-31' },
    ])
    expect(status).toBe(400)
    expect(erro).toMatch(/data inválida/i)
  })

  test('mês 99 na saída da viagem', async () => {
    const { status, erro } = await recusa([{ ...viagemRaposa, data_saida: '2026-99-99' }])
    expect(status).toBe(400)
    expect(erro).toMatch(/data inválida/i)
  })

  test('29 de fevereiro só passa em ano bissexto', async () => {
    expect((await recusa([{ ...viagemRaposa, data_saida: '2026-02-29' }])).status).toBe(400)
    // 2028 é bissexto: aqui a recusa, se vier, é de outra regra que não a data.
    expect((await recusa([{ ...viagemRaposa, data_saida: '2028-02-29' }])).erro).not.toMatch(
      /data inválida/i,
    )
  })

  test('hora que não existe no relógio', async () => {
    const { status, erro } = await recusa([{ ...viagemRaposa, hora_saida: '99:99' }])
    expect(status).toBe(400)
    expect(erro).toMatch(/hora inválida/i)
  })

  test('texto arbitrário em data_programada da manutenção', async () => {
    const { status, erro } = await recusa([{ ...manutencaoRaposa, data_programada: 'banana' }])
    expect(status).toBe(400)
    expect(erro).toMatch(/data inválida/i)
  })

  test('texto arbitrário em hora_entrada da manutenção', async () => {
    const { status, erro } = await recusa([{ ...manutencaoRaposa, hora_entrada: 'meio-dia' }])
    expect(status).toBe(400)
    expect(erro).toMatch(/hora inválida/i)
  })

  test('data inexistente na quebra e no abastecimento', async () => {
    expect(
      (await recusa([
        { tipo: 'quebra', base: 'Raposa', data: '2026-04-31', m2_expedido: 10, m2_quebrado: 1, observacao: '' },
      ])).status,
    ).toBe(400)
    expect(
      (await recusa([{
        tipo: 'abastecimento', base: 'Raposa', data: '2026-13-01', placa: 'PTV0006',
        rota: null, litros: 10, vl_litro: 6, km: 100, posto: 'Posto', slot: null, viagem_longa: false,
      }])).status,
    ).toBe(400)
  })

  test('o campo vazio continua virando nulo, e não erro', async () => {
    // `''` é o campo em branco da tela, e vira nulo, que é o que a coluna
    // aceita. Apertar a data não pode custar isso.
    const [salva] = await lancar(livia, [
      { ...manutencaoRaposa, data_programada: '', hora_saida: '', data_entrada: '2026-09-08' },
    ])
    expect(salva!.tipo).toBe('manutencao')
    const [linha] = await sql<Array<{ data_programada: string | null; hora_saida: string | null }>>`
      select data_programada, hora_saida from manutencao where id = ${salva!.id}::uuid`
    expect(linha!.data_programada).toBeNull()
    expect(linha!.hora_saida).toBeNull()
  })

  test('nada disso encostou no banco', async () => {
    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from manutencao where servico = 'Prova de data inválida'
        and data_programada is not null`
    expect(linha!.n).toBe(0)
  })

  test('"Limpar hoje" com data inexistente é 400, e não apaga nada', async () => {
    const resposta = await limpar(livia, 'Imperatriz', '2026-02-31')
    expect(resposta.status).toBe(400)
    expect(((await resposta.json()) as { erro: string }).erro).toMatch(/data inválida/i)
  })
})
