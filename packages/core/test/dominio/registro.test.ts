import { describe, expect, test } from 'bun:test'
import { Abastecimento, Manutencao, Quebra, Viagem } from '../../src/dominio/registro.ts'
import { pctCusto } from '../../src/dominio/derivados.ts'
import { classificarPontualidade } from '../../src/dominio/pontualidade.ts'
import { dataISO, horaHM, instante, minutosEntre } from '../../src/dominio/tempo.ts'

const registrado = {
  base: 'raposa',
  registradoPor: 'u-livia',
  registradoEm: { data: '2026-08-31', hora: '18:00' },
}

const viagemCrua = {
  ...registrado,
  id: 'v-1',
  veiculo: 'PTV0006',
  motorista: 'c-3',
  rota: 'r-7',
  saida: { data: '2026-08-30', hora: '22:00' },
  dataPrevista: '2026-08-31',
  horaPrevista: '06:00',
  dataChegada: null,
  horaChegada: null,
  kmSaida: 120000,
  kmChegada: null,
  valorCarga: 10000,
  combustivel: 850,
  diarias: 120,
  m2: 340.5,
  pesoKg: 8200,
  observacao: '',
}

const chegou = {
  dataChegada: '2026-08-31',
  horaChegada: '06:20',
  kmChegada: 120450,
}

const paradaCrua = { id: 'p-1', ordem: 1, litros: 120.5, vlLitro: 6.19, km: 120000, posto: 'Ipiranga' }

const abastecimentoCru = {
  ...registrado,
  id: 'ab-1',
  veiculo: 'PTV0006',
  rota: null,
  data: '2026-08-31',
  paradas: [paradaCrua],
}

const manutencaoCrua = {
  ...registrado,
  id: 'm-1',
  veiculo: 'PTV0006',
  tipo: 'preventiva',
  dataProgramada: null,
  entrada: { data: '2026-08-25', hora: '08:00' },
  dataSaida: null,
  horaSaida: null,
  servico: 'Troca de oleo',
  valor: 890.4,
  kmOdometro: 120000,
  fornecedor: 'Oficina Central',
  orcamento: null,
  os: null,
}

describe('Viagem', () => {
  test('sem chegada nasce em curso', () => {
    const v = Viagem.parse(viagemCrua)
    expect(v.estado).toBe('em_curso')
    expect(v.previsto).toEqual(instante('2026-08-31', '06:00'))
  })

  test('com chegada e km de chegada vira concluida', () => {
    const v = Viagem.parse({ ...viagemCrua, ...chegou })
    expect(v.estado).toBe('concluida')
    if (v.estado !== 'concluida') throw new Error('estado inesperado')
    expect(v.chegada).toEqual(instante('2026-08-31', '06:20'))
    expect(v.kmChegada).toBe(120450)
  })

  // Previsao e chegada saiam da mesma coluna `dataChegada`, entao a viagem que vira
  // o dia era classificada ao contrario: 1200 minutos de atraso viravam 240 de
  // adiantamento, porque o previsto herdava o dia da chegada.
  test('viagem noturna: previsao num dia, chegada no outro, e o atraso e real', () => {
    const v = Viagem.parse({
      ...viagemCrua,
      dataPrevista: '2026-08-31',
      horaPrevista: '06:00',
      dataChegada: '2026-09-01',
      horaChegada: '02:00',
      kmChegada: 120450,
    })
    if (v.estado !== 'concluida') throw new Error('estado inesperado')
    expect(v.previsto).toEqual(instante('2026-08-31', '06:00'))
    expect(v.chegada).toEqual(instante('2026-09-01', '02:00'))

    const previsto = v.previsto
    if (previsto === null) throw new Error('previsao esperada')
    expect(minutosEntre(previsto, v.chegada)).toBe(1200)
    expect(classificarPontualidade(previsto, v.chegada, 15)).toBe('atrasado')
  })

  // `viagem_chegada_ck` permite `data_chegada` nula, e o parse recusava a metade da
  // frota que ainda nao voltou.
  test('viagem em curso vinda do banco, com data de chegada nula, passa', () => {
    const v = Viagem.parse({
      ...viagemCrua,
      dataPrevista: null,
      horaPrevista: null,
      dataChegada: null,
      horaChegada: null,
      kmChegada: null,
    })
    expect(v.estado).toBe('em_curso')
    expect(v.previsto).toBeNull()
  })

  test('a hora de saida e opcional, porque a tela nao a exige', () => {
    const v = Viagem.parse({ ...viagemCrua, saida: { data: '2026-08-30', hora: null } })
    expect(v.saida).toEqual({ data: dataISO('2026-08-30'), hora: null })
  })

  test('chegada pela metade e estado ilegal', () => {
    expect(Viagem.safeParse({ ...viagemCrua, kmChegada: 120450 }).success).toBe(false)
    expect(Viagem.safeParse({ ...viagemCrua, horaChegada: '06:20' }).success).toBe(false)
    expect(Viagem.safeParse({ ...viagemCrua, dataChegada: '2026-08-31' }).success).toBe(false)
    const semHora = { ...viagemCrua, ...chegou, horaChegada: null }
    expect(Viagem.safeParse(semHora).success).toBe(false)
  })

  test('dia previsto sem hora prevista nao e previsao', () => {
    expect(Viagem.safeParse({ ...viagemCrua, horaPrevista: null }).success).toBe(false)
  })

  test('hora prevista sem dia previsto passa, e a previsao fica nula', () => {
    const v = Viagem.parse({ ...viagemCrua, dataPrevista: null })
    expect(v.previsto).toBeNull()
  })

  test('chegada anterior a saida nao passa', () => {
    const r = Viagem.safeParse({
      ...viagemCrua,
      dataChegada: '2026-08-30',
      horaChegada: '21:00',
      kmChegada: 120450,
    })
    expect(r.success).toBe(false)
  })

  // O guarda da linha 816 do formulario e
  // `if (!ds || !mot || !vei || !rot || !vc || !cv)`, com `vc = parseFloat(...) || 0`.
  // Carga zero cai em `!vc` e a tela recusa, citando "Valor da Carga".
  test('carga zerada e recusada, igual ao formulario', () => {
    expect(Viagem.safeParse({ ...viagemCrua, valorCarga: 0 }).success).toBe(false)
    expect(pctCusto(1500, 0)).toBeNull()
  })

  test('carga negativa nao passa', () => {
    expect(Viagem.safeParse({ ...viagemCrua, valorCarga: -1 }).success).toBe(false)
  })

  // Mesmo guarda: `cv = comb + diar` e `!cv` recusa a soma zerada.
  test('combustivel mais diarias zerado e recusado', () => {
    const r = Viagem.safeParse({ ...viagemCrua, combustivel: 0, diarias: 0 })
    expect(r.success).toBe(false)
    if (r.success) throw new Error('soma zerada deveria falhar')
    expect(r.error.issues.some((i) => i.message.includes('combustivel mais diarias'))).toBe(true)
  })

  test('so uma das duas parcelas basta para a soma existir', () => {
    expect(Viagem.safeParse({ ...viagemCrua, combustivel: 0, diarias: 120 }).success).toBe(true)
    expect(Viagem.safeParse({ ...viagemCrua, combustivel: 850, diarias: 0 }).success).toBe(true)
  })
})

describe('Abastecimento', () => {
  // O modo viagem longa so recusa a parada quando os litros sao zero (linha 866 do
  // formulario). O valor por litro escapa da checagem e chega zerado no dado gravado.
  test('valor por litro zerado passa no modo viagem longa', () => {
    const r = Abastecimento.safeParse({
      ...abastecimentoCru,
      paradas: [{ ...paradaCrua, vlLitro: 0 }],
    })
    expect(r.success).toBe(true)
  })

  test('uma parada e suficiente', () => {
    const a = Abastecimento.parse(abastecimentoCru)
    expect(a.paradas).toHaveLength(1)
    expect(a.paradas[0].litros).toBe(120.5)
  })

  test('tres paradas passam, quatro nao', () => {
    const tres = [1, 2, 3].map((ordem) => ({ ...paradaCrua, id: `p-${ordem}`, ordem }))
    expect(Abastecimento.safeParse({ ...abastecimentoCru, paradas: tres }).success).toBe(true)

    const quatro = [...tres, { ...paradaCrua, id: 'p-4', ordem: 1 }]
    const r = Abastecimento.safeParse({ ...abastecimentoCru, paradas: quatro })
    expect(r.success).toBe(false)
    if (r.success) throw new Error('quatro paradas deveriam falhar')
    expect(r.error.issues.some((i) => i.message.includes('no maximo 3'))).toBe(true)
  })

  test('nenhuma parada nao e abastecimento', () => {
    expect(Abastecimento.safeParse({ ...abastecimentoCru, paradas: [] }).success).toBe(false)
  })

  test('ordem repetida nao passa', () => {
    const repetida = [paradaCrua, { ...paradaCrua, id: 'p-2' }]
    expect(Abastecimento.safeParse({ ...abastecimentoCru, paradas: repetida }).success).toBe(false)
  })

  test('ordem fora de 1 a 3 nao passa', () => {
    const fora = [{ ...paradaCrua, ordem: 4 }]
    expect(Abastecimento.safeParse({ ...abastecimentoCru, paradas: fora }).success).toBe(false)
  })

  // Antes o zod fazia `strip` e devolvia sucesso: quem mandasse `viagem_longa`
  // acreditava ter gravado o campo. Agora a chave que nao existe e recusada pelo nome.
  test('modo e viagem_longa nao existem, e mandar um deles falha nomeando a chave', () => {
    const r = Abastecimento.safeParse({ ...abastecimentoCru, viagem_longa: true, modo: 'longa' })
    expect(r.success).toBe(false)
    const chaves = r.error?.issues.flatMap((i) => (i.code === 'unrecognized_keys' ? i.keys : []))
    expect(chaves?.sort()).toEqual(['modo', 'viagem_longa'])
  })

  // `slot` saiu junto, porque e `['Saida','Interior','Chegada'][ordem-1]`.
  test('slot nao existe na parada', () => {
    const r = Abastecimento.safeParse({
      ...abastecimentoCru,
      paradas: [{ ...paradaCrua, slot: 'Saida' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('Manutencao', () => {
  test('sem saida esta na oficina', () => {
    const m = Manutencao.parse(manutencaoCrua)
    expect(m.estado).toBe('na_oficina')
  })

  test('com data e hora de saida esta liberada', () => {
    const m = Manutencao.parse({ ...manutencaoCrua, dataSaida: '2026-08-27', horaSaida: '17:30' })
    expect(m.estado).toBe('liberada')
    if (m.estado !== 'liberada') throw new Error('estado inesperado')
    expect(m.saida).toEqual({ data: dataISO('2026-08-27'), hora: horaHM('17:30') })
  })

  // O banco so cobra `data_saida >= data_entrada`, e `dias_oficina` (linha 897 do
  // formulario) sai so das duas datas. Exigir a hora recusava registro que grava hoje.
  test('data de saida sem hora ja libera', () => {
    const m = Manutencao.parse({ ...manutencaoCrua, dataSaida: '2026-08-27' })
    expect(m.estado).toBe('liberada')
    if (m.estado !== 'liberada') throw new Error('estado inesperado')
    expect(m.saida).toEqual({ data: dataISO('2026-08-27'), hora: null })
  })

  test('a hora de entrada e opcional, porque o label da linha 505 nao tem asterisco', () => {
    const m = Manutencao.parse({ ...manutencaoCrua, entrada: { data: '2026-08-25', hora: null } })
    expect(m.entrada).toEqual({ data: dataISO('2026-08-25'), hora: null })
  })

  test('saida anterior a entrada nao passa', () => {
    const r = Manutencao.safeParse({ ...manutencaoCrua, dataSaida: '2026-08-24', horaSaida: '08:00' })
    expect(r.success).toBe(false)
  })

  test('sem hora dos dois lados, a comparacao e por dia', () => {
    const antes = { ...manutencaoCrua, entrada: { data: '2026-08-25', hora: null }, dataSaida: '2026-08-24' }
    expect(Manutencao.safeParse(antes).success).toBe(false)
    const mesmoDia = { ...antes, dataSaida: '2026-08-25' }
    expect(Manutencao.safeParse(mesmoDia).success).toBe(true)
  })
})

describe('Quebra', () => {
  test('parse do formato cru', () => {
    const q = Quebra.parse({ ...registrado, id: 'q-1', data: '2026-08-31', m2Expedido: 1000, m2Quebrado: 12.5, observacao: 'carga 3' })
    expect(q.m2Quebrado).toBe(12.5)
  })

  test('m2 expedido zerado nao passa, porque o percentual nao existe', () => {
    const r = Quebra.safeParse({ ...registrado, id: 'q-1', data: '2026-08-31', m2Expedido: 0, m2Quebrado: 0, observacao: '' })
    expect(r.success).toBe(false)
  })
})

// A coluna tem escala e o Postgres arredonda na atribuicao sem erro nenhum, entao
// o dominio aceitar mais casas que a coluna e a tela mostrar um numero e a linha
// gravada guardar outro. `valorTotalParada(100.456, 4.111)` devolvia 412.97 e o
// banco gravava 412.99, porque `litros` e `numeric(10,2)` e guardou 100.46.
describe('escala: o dominio nao aceita mais casas do que a coluna guarda', () => {
  const casasDa = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
    r.error?.issues.map((i) => i.message) ?? []

  test('km_saida e km_chegada sao integer', () => {
    const r = Viagem.safeParse({ ...viagemCrua, kmSaida: 100000.5 })
    expect(r.success).toBe(false)
    expect(casasDa(r)).toContain('valor tem que ser inteiro')
    expect(
      Viagem.safeParse({ ...viagemCrua, ...chegou, kmChegada: 120450.4 }).success,
    ).toBe(false)
    expect(Viagem.safeParse({ ...viagemCrua, ...chegou }).success).toBe(true)
  })

  test('valor_carga, combustivel, diarias, m2 e peso_kg sao numeric(12,2)', () => {
    for (const campo of ['valorCarga', 'combustivel', 'diarias', 'm2', 'pesoKg'] as const) {
      const r = Viagem.safeParse({ ...viagemCrua, [campo]: 1200.004 })
      expect(r.success).toBe(false)
      expect(casasDa(r)).toContain('valor aceita no maximo 2 casas decimais')
      expect(Viagem.safeParse({ ...viagemCrua, [campo]: 1200.01 }).success).toBe(true)
    }
  })

  test('litros e numeric(10,2) e vl_litro e numeric(10,3)', () => {
    const comLitros = (litros: number) =>
      Abastecimento.safeParse({ ...abastecimentoCru, paradas: [{ ...paradaCrua, litros }] })
    expect(comLitros(100.45).success).toBe(true)
    const r = comLitros(100.456)
    expect(r.success).toBe(false)
    expect(casasDa(r)).toContain('valor aceita no maximo 2 casas decimais')

    const comVlLitro = (vlLitro: number) =>
      Abastecimento.safeParse({ ...abastecimentoCru, paradas: [{ ...paradaCrua, vlLitro }] })
    expect(comVlLitro(4.111).success).toBe(true)
    const tresCasas = comVlLitro(4.1111)
    expect(tresCasas.success).toBe(false)
    expect(casasDa(tresCasas)).toContain('valor aceita no maximo 3 casas decimais')
  })

  test('km da parada e km_odometro sao integer', () => {
    expect(
      Abastecimento.safeParse({
        ...abastecimentoCru,
        paradas: [{ ...paradaCrua, km: 120000.5 }],
      }).success,
    ).toBe(false)
    expect(Manutencao.safeParse({ ...manutencaoCrua, kmOdometro: 120000.5 }).success).toBe(false)
  })

  test('valor da manutencao e m2 da quebra sao numeric(12,2)', () => {
    expect(Manutencao.safeParse({ ...manutencaoCrua, valor: 890.404 }).success).toBe(false)
    const quebra = { ...registrado, id: 'q-2', data: '2026-08-31', observacao: '' }
    expect(Quebra.safeParse({ ...quebra, m2Expedido: 1000.005, m2Quebrado: 12.5 }).success).toBe(false)
    expect(Quebra.safeParse({ ...quebra, m2Expedido: 1000, m2Quebrado: 12.505 }).success).toBe(false)
    expect(Quebra.safeParse({ ...quebra, m2Expedido: 1000, m2Quebrado: 12.5 }).success).toBe(true)
  })
})
