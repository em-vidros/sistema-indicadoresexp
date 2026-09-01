import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cookieDaLivia, cookieDe, pedir, sql } from './ajuda.ts'

type Item = {
  tipo: string
  tipo_preventivo_id: string
  intervalo_km: number
  alerta_km: number
  ultimo_km: number | null
  obs: string | null
}
type Veiculo = { id: string; placa: string; base: string; itens: Item[] }
type Plano = { tipos: Array<{ id: string; tipo: string }>; veiculos: Veiculo[] }

let livia = ''
let andreina = ''
/** Veiculos so deste teste, para nao mexer no plano que o seed trouxe. */
let deImperatriz = ''
let daRaposa = ''

const PLACAS = ['ZZT0001', 'ZZT0002']
const TIPO_NOVO = 'ZZ Correia dentada de teste'

const geral = { tipo: 'Manutenção Preventiva Geral', intervalo_km: 20000, alerta_km: 2000, ultimo_km: 100000, obs: 'do teste' }
const lavagem = { tipo: 'Lavagem', intervalo_km: 3000, alerta_km: 300, ultimo_km: 100000, obs: null }

async function gravar(cookie: string, veiculoId: string, itens: unknown[]) {
  return await pedir(`/api/preventiva/${veiculoId}`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ itens }),
  })
}

async function planoDe(cookie: string): Promise<Plano> {
  const resposta = await pedir('/api/preventiva', { headers: { cookie } })
  expect(resposta.status).toBe(200)
  return (await resposta.json()) as Plano
}

beforeAll(async () => {
  ;[livia, andreina] = await Promise.all([cookieDaLivia(), cookieDe('andreina', 'SENHA_ANDREINA')])
  const [imperatriz] = await sql<Array<{ id: string }>>`
    insert into veiculo (placa, modelo, base_id)
    select ${PLACAS[0]!}, 'Teste', id from base where nome = 'Imperatriz'
    returning id`
  const [raposa] = await sql<Array<{ id: string }>>`
    insert into veiculo (placa, modelo, base_id)
    select ${PLACAS[1]!}, 'Teste', id from base where nome = 'Raposa'
    returning id`
  deImperatriz = imperatriz!.id
  daRaposa = raposa!.id
})

afterAll(async () => {
  await sql`delete from item_preventivo where veiculo_id = any(${sql.array([deImperatriz, daRaposa])}::uuid[])`
  await sql`delete from veiculo where placa = any(${sql.array(PLACAS)})`
  await sql`delete from tipo_preventivo where nome = ${TIPO_NOVO}`
})

describe('plano de preventiva no banco', () => {
  test('a Lívia grava o plano de um veículo e outra requisição lê o mesmo', async () => {
    const resposta = await gravar(livia, deImperatriz, [geral, lavagem])
    expect(resposta.status).toBe(200)
    const salvo = (await resposta.json()) as Veiculo
    expect(salvo.placa).toBe(PLACAS[0]!)
    expect(salvo.itens).toHaveLength(2)

    const plano = await planoDe(livia)
    const veiculo = plano.veiculos.find((item) => item.id === deImperatriz)
    expect(veiculo?.base).toBe('Imperatriz')
    expect(veiculo?.itens).toContainEqual(
      expect.objectContaining({ tipo: geral.tipo, intervalo_km: 20000, alerta_km: 2000, ultimo_km: 100000, obs: 'do teste' }),
    )
    expect(veiculo?.itens).toContainEqual(expect.objectContaining({ tipo: 'Lavagem', intervalo_km: 3000 }))
  })

  test('regravar altera o item que ficou e apaga o que saiu, sem apagar a linha', async () => {
    const resposta = await gravar(livia, deImperatriz, [{ ...geral, intervalo_km: 25000, ultimo_km: 123456 }])
    expect(resposta.status).toBe(200)
    const salvo = (await resposta.json()) as Veiculo
    expect(salvo.itens).toHaveLength(1)
    expect(salvo.itens[0]).toMatchObject({ tipo: geral.tipo, intervalo_km: 25000, ultimo_km: 123456 })

    // Soft-delete: a Lavagem some da leitura e continua no banco, com carimbo.
    const [linha] = await sql<Array<{ apagado_em: Date | null; atualizado_por: string | null }>>`
      select ip.apagado_em, ip.atualizado_por
      from item_preventivo ip
      join tipo_preventivo tp on tp.id = ip.tipo_preventivo_id
      where ip.veiculo_id = ${deImperatriz}::uuid and tp.nome = 'Lavagem'`
    expect(linha).toBeDefined()
    expect(linha!.apagado_em).not.toBeNull()
    expect(linha!.atualizado_por).toBe('usr_livia')
  })

  test('o item que voltou reaproveita a linha apagada, e a unique não estoura', async () => {
    const resposta = await gravar(livia, deImperatriz, [geral, lavagem])
    expect(resposta.status).toBe(200)
    expect(((await resposta.json()) as Veiculo).itens).toHaveLength(2)

    const [contagem] = await sql<Array<{ linhas: number }>>`
      select count(*)::int as linhas
      from item_preventivo ip
      join tipo_preventivo tp on tp.id = ip.tipo_preventivo_id
      where ip.veiculo_id = ${deImperatriz}::uuid and tp.nome = 'Lavagem'`
    expect(contagem!.linhas).toBe(1)
  })

  test('tipo digitado à mão entra no catálogo e volta no GET', async () => {
    const resposta = await gravar(livia, deImperatriz, [
      geral,
      lavagem,
      { tipo: TIPO_NOVO, intervalo_km: 40000, alerta_km: 1000, ultimo_km: null, obs: null },
    ])
    expect(resposta.status).toBe(200)

    const plano = await planoDe(livia)
    expect(plano.tipos.map((item) => item.tipo)).toContain(TIPO_NOVO)
    expect(plano.veiculos.find((item) => item.id === deImperatriz)?.itens).toContainEqual(
      expect.objectContaining({ tipo: TIPO_NOVO, intervalo_km: 40000, ultimo_km: null }),
    )
  })

  test('o mesmo tipo duas vezes no corpo é recusado', async () => {
    const resposta = await gravar(livia, deImperatriz, [geral, { ...geral, intervalo_km: 5000 }])
    expect(resposta.status).toBe(400)
  })

  test('Andreina não enxerga veículo de Imperatriz no plano', async () => {
    const plano = await planoDe(andreina)
    expect(plano.veiculos.length).toBeGreaterThan(0)
    expect(plano.veiculos.map((item) => item.base)).toEqual(plano.veiculos.map(() => 'Raposa'))
    expect(plano.veiculos.find((item) => item.id === deImperatriz)).toBeUndefined()
  })

  test('Andreina não grava o plano de um veículo de Imperatriz', async () => {
    const antes = await sql<Array<{ linhas: number }>>`
      select count(*)::int as linhas from item_preventivo
      where veiculo_id = ${deImperatriz}::uuid and apagado_em is null`
    const resposta = await gravar(andreina, deImperatriz, [
      { tipo: 'Lavagem', intervalo_km: 999, alerta_km: 1, ultimo_km: null, obs: 'invasão' },
    ])
    expect(resposta.status).toBe(403)
    const depois = await sql<Array<{ linhas: number }>>`
      select count(*)::int as linhas from item_preventivo
      where veiculo_id = ${deImperatriz}::uuid and apagado_em is null`
    expect(depois[0]!.linhas).toBe(antes[0]!.linhas)
  })

  test('Andreina grava o plano de um veículo da sua base', async () => {
    const resposta = await gravar(andreina, daRaposa, [lavagem])
    expect(resposta.status).toBe(200)
    const salvo = (await resposta.json()) as Veiculo
    expect(salvo).toMatchObject({ id: daRaposa, base: 'Raposa' })
    expect(salvo.itens).toHaveLength(1)
  })

  test('veículo inexistente é 400, e id que não é uuid também', async () => {
    expect((await gravar(livia, '00000000-0000-4000-8000-000000000000', [lavagem])).status).toBe(400)
    expect((await gravar(livia, 'PTV0006', [lavagem])).status).toBe(400)
  })
})
