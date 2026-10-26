/**
 * O pneu individual, cadastrado dentro de `/api/cadastro/pneus` junto com veiculo,
 * colaborador, rota e base -- a mesma maquina de permissao e conflito que `cadastro.ts`
 * ja tem, so que a base do pneu vem do veiculo por join, porque o pneu nao guarda a
 * propria.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cookieDaLivia, cookieDe, pedir, sql } from './ajuda.ts'

let livia = ''
let andreina = ''

type Veiculo = { id: string; placa: string; eixos: number | null; baseId: string; base: string }
type Pneu = {
  id: string
  veiculoId: string
  placa: string
  posicao: string
  numeroFogo: string | null
  marca: string | null
  status: 'novo' | 'recapado' | 'sucateado'
  recapagens: number
  kmInstalado: number | null
  dataInstalado: string | null
  observacao: string | null
  ativo: boolean
}
type Catalogo = { veiculos: Veiculo[]; pneus: Pneu[] }

async function catalogo(quem: string, todos = false): Promise<Catalogo> {
  const resposta = await pedir(todos ? '/api/cadastro?todos=1' : '/api/cadastro', { headers: { cookie: quem } })
  return (await resposta.json()) as Catalogo
}

async function escrever(cookie: string, caminho: string, corpo: unknown, metodo = 'POST') {
  return await pedir(`/api/cadastro/${caminho}`, {
    method: metodo,
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

const POSICOES = ['ZZ Dianteiro Esquerdo', 'ZZ Dianteiro Direito']

let raposa: Veiculo
let imperatriz: Veiculo

beforeAll(async () => {
  ;[livia, andreina] = await Promise.all([cookieDaLivia(), cookieDe('andreina', 'SENHA_ANDREINA')])
  const { veiculos } = await catalogo(livia)
  raposa = veiculos.find((v) => v.placa === 'PTV0006')!
  imperatriz = veiculos.find((v) => v.placa === 'DMG9D41')!
})

afterAll(async () => {
  await sql`delete from pneu where posicao = any(${sql.array(POSICOES)})`
})

describe('cadastro de pneu', () => {
  let criado = ''

  test('a Lívia cria um pneu na Raposa e ele entra no catálogo com a placa do veículo', async () => {
    const resposta = await escrever(livia, 'pneus', {
      veiculoId: raposa.id,
      posicao: POSICOES[0]!,
      marca: 'Pirelli',
      status: 'novo',
      kmInstalado: 100000,
      dataInstalado: '2026-09-01',
    })
    expect(resposta.status).toBe(201)
    const salvo = (await resposta.json()) as Pneu
    expect(salvo.placa).toBe('PTV0006')
    expect(salvo.status).toBe('novo')
    expect(salvo.recapagens).toBe(0)
    expect(salvo.ativo).toBe(true)
    criado = salvo.id

    const { pneus } = await catalogo(livia)
    expect(pneus.map((p) => p.id)).toContain(criado)
  })

  test('o PUT recapa: muda o status, soma recapagem e atualiza o km de referência', async () => {
    const resposta = await escrever(
      livia,
      `pneus/${criado}`,
      {
        veiculoId: raposa.id,
        posicao: POSICOES[0]!,
        marca: 'Pirelli',
        status: 'recapado',
        recapagens: 1,
        kmInstalado: 160000,
        dataInstalado: '2026-10-20',
        ativo: true,
      },
      'PUT',
    )
    expect(resposta.status).toBe(200)
    const salvo = (await resposta.json()) as Pneu
    expect(salvo.status).toBe('recapado')
    expect(salvo.recapagens).toBe(1)
    expect(salvo.kmInstalado).toBe(160000)
  })

  test('duas posições iguais no mesmo veículo levam 409', async () => {
    const resposta = await escrever(livia, 'pneus', {
      veiculoId: raposa.id,
      posicao: POSICOES[0]!,
      status: 'novo',
    })
    expect(resposta.status).toBe(409)
    expect(((await resposta.json()) as { erro: string }).erro).toBe(
      'já existe um pneu ativo nessa posição desse veículo',
    )
  })

  test('a mesma posição em outro veículo não conflita', async () => {
    const resposta = await escrever(livia, 'pneus', {
      veiculoId: imperatriz.id,
      posicao: POSICOES[0]!,
      status: 'novo',
    })
    expect(resposta.status).toBe(201)
    const salvo = (await resposta.json()) as Pneu
    expect(salvo.placa).toBe('DMG9D41')
  })

  test('desativar some do catálogo e o histórico de recapagem fica no banco', async () => {
    const resposta = await escrever(
      livia,
      `pneus/${criado}`,
      {
        veiculoId: raposa.id,
        posicao: POSICOES[0]!,
        status: 'recapado',
        recapagens: 1,
        kmInstalado: 160000,
        ativo: false,
      },
      'PUT',
    )
    expect(resposta.status).toBe(200)

    const { pneus } = await catalogo(livia)
    expect(pneus.map((p) => p.id)).not.toContain(criado)

    const [linha] = await sql<Array<{ recapagens: number; status: string }>>`
      select recapagens, status from pneu where id = ${criado}::uuid`
    expect(linha!.recapagens).toBe(1)
    expect(linha!.status).toBe('recapado')
  })

  test('a Andreina cria pneu na Raposa e leva 403 em veículo de Imperatriz', async () => {
    const naRaposa = await escrever(andreina, 'pneus', {
      veiculoId: raposa.id,
      posicao: POSICOES[1]!,
      status: 'novo',
    })
    expect(naRaposa.status).toBe(201)
    const salvo = (await naRaposa.json()) as Pneu
    expect(salvo.placa).toBe('PTV0006')

    const emImperatriz = await escrever(andreina, 'pneus', {
      veiculoId: imperatriz.id,
      posicao: 'ZZ Traseiro',
      status: 'novo',
    })
    expect(emImperatriz.status).toBe(403)
    expect(((await emImperatriz.json()) as { erro: string }).erro).toBe('veículo fora das suas bases')
  })

  test('a Andreina leva 404, e não 403, no pneu de Imperatriz', async () => {
    const { pneus } = await catalogo(livia)
    const deImperatriz = pneus.find((p) => p.placa === 'DMG9D41' && p.posicao === POSICOES[0]!)!
    const resposta = await escrever(
      andreina,
      `pneus/${deImperatriz.id}`,
      { veiculoId: raposa.id, posicao: POSICOES[0]!, status: 'novo' },
      'PUT',
    )
    expect(resposta.status).toBe(404)
    expect(((await resposta.json()) as { erro: string }).erro).toBe('pneu inexistente')
  })

  test('posição vazia ou veículo que não é uuid voltam 400', async () => {
    expect((await escrever(livia, 'pneus', { veiculoId: raposa.id, posicao: '', status: 'novo' })).status).toBe(400)
    expect((await escrever(livia, 'pneus', { veiculoId: 'nao-e-uuid', posicao: 'ZZ Teste', status: 'novo' })).status).toBe(400)
  })
})
