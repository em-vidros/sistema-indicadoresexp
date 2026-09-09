/**
 * O cadastro que a fase 3 tirou dos literais do front e pos atras de sessao.
 *
 * A Livia ve as tres bases; a Andreina so a Raposa, e o que ela nao ve nao
 * aparece em nenhuma das quatro listas. Teste que afirma `length > 0` nao prova
 * permissao, entao aqui se afirma sobre placa e rota de dono conhecido.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cookieDaLivia, cookieDe, pedir, sql } from './ajuda.ts'

let livia = ''
let andreina = ''

type Base = { id: string; nome: string; ativo: boolean }
type Veiculo = { id: string; placa: string; modelo: string | null; marca: string | null; ano: string | null; baseId: string; base: string; ativo: boolean }
type Colaborador = { id: string; nome: string; cargo: string | null; funcao: string; admissao: string | null; baseId: string; base: string; ativo: boolean }
type Rota = { id: string; nome: string; baseId: string; base: string; local: boolean; ativo: boolean }

type Catalogo = {
  bases: Base[]
  veiculos: Veiculo[]
  colaboradores: Colaborador[]
  rotas: Rota[]
}

async function catalogo(
  quem: string,
  todos = false,
): Promise<{ status: number; corpo: Catalogo | null }> {
  const resposta = await pedir(todos ? '/api/cadastro?todos=1' : '/api/cadastro', {
    headers: { cookie: quem },
  })
  if (resposta.status !== 200) return { status: resposta.status, corpo: null }
  return { status: 200, corpo: (await resposta.json()) as Catalogo }
}

async function escrever(cookie: string, caminho: string, corpo: unknown, metodo = 'POST') {
  return await pedir(`/api/cadastro/${caminho}`, {
    method: metodo,
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

/** As bases do seed, para nao chumbar uuid que muda a cada banco novo. */
let bases: Base[] = []
const baseDe = (nome: string): string => bases.find((item) => item.nome === nome)!.id

const PLACAS = ['ZZC0001', 'ZZC0002']
const NOMES = ['ZZ Colaborador de Teste', 'ZZ Colaborador da Raposa']
const ROTAS = ['ZZ ROTA DE TESTE']
const BASES = ['ZZ Base de Teste']

beforeAll(async () => {
  ;[livia, andreina] = await Promise.all([
    cookieDaLivia(),
    cookieDe('andreina', 'SENHA_ANDREINA'),
  ])
  bases = (await catalogo(livia)).corpo!.bases
})

afterAll(async () => {
  await sql`delete from veiculo where placa = any(${sql.array(PLACAS)})`
  await sql`delete from colaborador where nome = any(${sql.array(NOMES)})`
  await sql`delete from rota where nome = any(${sql.array(ROTAS)})`
  await sql`delete from base where nome = any(${sql.array(BASES)})`
})

describe('cadastro atras da sessao', () => {
  test('sem sessao, leva 401 e nao a lista', async () => {
    const resposta = await pedir('/api/cadastro')
    expect(resposta.status).toBe(401)
  })

  test('a Livia ve as tres bases e os 15 veiculos do seed', async () => {
    const { status, corpo } = await catalogo(livia)
    expect(status).toBe(200)
    expect(corpo!.bases.map((b) => b.nome).sort()).toEqual(['Belém', 'Imperatriz', 'Raposa'])
    expect(corpo!.veiculos).toHaveLength(15)
    expect(corpo!.veiculos.map((v) => v.placa)).toContain('PTV0006')
    expect(corpo!.veiculos.map((v) => v.placa)).toContain('SMP2F01')
  })

  test('o veiculo traz ficha e base, e a rota traz o local', async () => {
    const { corpo } = await catalogo(livia)
    const ptt = corpo!.veiculos.find((v) => v.placa === 'PTT0004')!
    expect(ptt.modelo).toBe('ACCELO 1316')
    expect(ptt.base).toBe('Raposa')
    const imperatriz = corpo!.rotas.find((r) => r.nome === 'IMPERATRIZ')
    expect(imperatriz?.local).toBe(true)
    const pinheiro = corpo!.rotas.find((r) => r.nome === 'PINHEIRO')
    expect(pinheiro?.local).toBe(false)
  })

  test('a Andreina ve a Raposa e nao ve placa nem rota de Imperatriz', async () => {
    const { status, corpo } = await catalogo(andreina)
    expect(status).toBe(200)
    expect(corpo!.bases.map((b) => b.nome)).toEqual(['Raposa'])
    expect(corpo!.veiculos.map((v) => v.placa)).toContain('PTV0006')
    expect(corpo!.veiculos.map((v) => v.placa)).not.toContain('DMG9D41')
    expect(corpo!.colaboradores.map((c) => c.nome)).toContain('Anderson Penha Dos Anjos')
    expect(corpo!.colaboradores.map((c) => c.nome)).not.toContain('Nataniel Pereira Rocha')
    expect(corpo!.rotas.map((r) => r.nome)).toContain('PINHEIRO')
    expect(corpo!.rotas.map((r) => r.nome)).not.toContain('PARAUAPEBAS')
  })
})

describe('escrita de veiculo', () => {
  let criado = ''

  test('a Lívia cria em Imperatriz e a placa chega normalizada', async () => {
    const resposta = await escrever(livia, 'veiculos', {
      placa: ' zzc-0001 ',
      marca: 'VW',
      modelo: 'Delivery',
      ano: '2020',
      baseId: baseDe('Imperatriz'),
    })
    expect(resposta.status).toBe(201)
    const salvo = (await resposta.json()) as Veiculo
    expect(salvo.placa).toBe(PLACAS[0]!)
    expect(salvo.base).toBe('Imperatriz')
    expect(salvo.ativo).toBe(true)
    criado = salvo.id
  })

  test('o PUT troca a ficha e desativa a linha', async () => {
    const resposta = await escrever(
      livia,
      `veiculos/${criado}`,
      {
        placa: PLACAS[0]!,
        marca: 'Mercedes',
        modelo: 'Accelo',
        ano: '2021',
        baseId: baseDe('Imperatriz'),
        ativo: false,
      },
      'PUT',
    )
    expect(resposta.status).toBe(200)
    const salvo = (await resposta.json()) as Veiculo
    expect(salvo.marca).toBe('Mercedes')
    expect(salvo.ativo).toBe(false)
  })

  test('o inativo some do GET normal e volta com ?todos=1', async () => {
    const { corpo } = await catalogo(livia)
    expect(corpo!.veiculos.map((item) => item.placa)).not.toContain(PLACAS[0]!)

    const { corpo: tudo } = await catalogo(livia, true)
    const achado = tudo!.veiculos.find((item) => item.placa === PLACAS[0]!)
    expect(achado?.ativo).toBe(false)
    expect(tudo!.veiculos.find((item) => item.placa === 'SMP2F01')?.ativo).toBe(true)
  })

  test('a Andreina cria na Raposa e leva 403 em Imperatriz', async () => {
    const naRaposa = await escrever(andreina, 'veiculos', {
      placa: PLACAS[1]!,
      baseId: baseDe('Raposa'),
    })
    expect(naRaposa.status).toBe(201)
    expect(((await naRaposa.json()) as Veiculo).base).toBe('Raposa')

    const alheia = await escrever(andreina, 'veiculos', {
      placa: 'ZZC0003',
      baseId: baseDe('Imperatriz'),
    })
    expect(alheia.status).toBe(403)
    expect(((await alheia.json()) as { erro: string }).erro).toBe('base fora das suas bases')
  })

  test('a Andreina leva 404, e nao 403, no veículo de Belém', async () => {
    const { corpo } = await catalogo(livia)
    const deBelem = corpo!.veiculos.find((item) => item.placa === 'SMP2F01')!
    const resposta = await escrever(
      andreina,
      `veiculos/${deBelem.id}`,
      { placa: 'SMP2F01', baseId: baseDe('Raposa'), ativo: true },
      'PUT',
    )
    expect(resposta.status).toBe(404)
    expect(((await resposta.json()) as { erro: string }).erro).toBe('veículo inexistente')
  })

  test('placa repetida volta 409 com a mensagem em português', async () => {
    const resposta = await escrever(livia, 'veiculos', {
      placa: 'SMP2F01',
      baseId: baseDe('Imperatriz'),
    })
    expect(resposta.status).toBe(409)
    expect(((await resposta.json()) as { erro: string }).erro).toBe(
      'já existe um veículo com essa placa',
    )
  })

  test('id torto volta 400 e sem sessão o POST volta 401', async () => {
    const torto = await escrever(livia, 'veiculos/nao-e-uuid', { placa: 'ZZC0004', baseId: baseDe('Raposa'), ativo: true }, 'PUT')
    expect(torto.status).toBe(400)

    const semSessao = await pedir('/api/cadastro/veiculos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ placa: 'ZZC0005', baseId: baseDe('Raposa') }),
    })
    expect(semSessao.status).toBe(401)
  })
})

describe('escrita de colaborador', () => {
  let criado = ''

  test('a Lívia cria em Imperatriz e depois edita a ficha', async () => {
    const resposta = await escrever(livia, 'colaboradores', {
      nome: NOMES[0]!,
      cargo: 'Motorista',
      funcao: 'motorista',
      admissao: '2024-03-01',
      baseId: baseDe('Imperatriz'),
    })
    expect(resposta.status).toBe(201)
    const salvo = (await resposta.json()) as Colaborador
    expect(salvo.base).toBe('Imperatriz')
    expect(salvo.admissao).toBe('2024-03-01')
    criado = salvo.id

    const edicao = await escrever(
      livia,
      `colaboradores/${criado}`,
      {
        nome: NOMES[0]!,
        cargo: 'Ajudante',
        funcao: 'ajudante',
        admissao: null,
        baseId: baseDe('Imperatriz'),
        ativo: false,
      },
      'PUT',
    )
    expect(edicao.status).toBe(200)
    const depois = (await edicao.json()) as Colaborador
    expect(depois.funcao).toBe('ajudante')
    expect(depois.admissao).toBeNull()
    expect(depois.ativo).toBe(false)
  })

  test('a Andreina leva 403 em base alheia', async () => {
    const resposta = await escrever(andreina, 'colaboradores', {
      nome: NOMES[1]!,
      funcao: 'ajudante',
      baseId: baseDe('Imperatriz'),
    })
    expect(resposta.status).toBe(403)
  })

  test('função fora do enum volta 400', async () => {
    const resposta = await escrever(livia, 'colaboradores', {
      nome: NOMES[1]!,
      funcao: 'piloto',
      baseId: baseDe('Raposa'),
    })
    expect(resposta.status).toBe(400)
  })
})

describe('escrita de rota', () => {
  test('a Lívia cria em Imperatriz e depois marca como local', async () => {
    const resposta = await escrever(livia, 'rotas', {
      nome: ROTAS[0]!,
      baseId: baseDe('Imperatriz'),
    })
    expect(resposta.status).toBe(201)
    const salva = (await resposta.json()) as Rota
    expect(salva.local).toBe(false)
    expect(salva.base).toBe('Imperatriz')

    const edicao = await escrever(
      livia,
      `rotas/${salva.id}`,
      { nome: ROTAS[0]!, baseId: baseDe('Imperatriz'), local: true, ativo: true },
      'PUT',
    )
    expect(edicao.status).toBe(200)
    expect(((await edicao.json()) as Rota).local).toBe(true)
  })

  test('o mesmo nome repete em outra base, mas não na mesma', async () => {
    const repetida = await escrever(livia, 'rotas', {
      nome: ROTAS[0]!,
      baseId: baseDe('Imperatriz'),
    })
    expect(repetida.status).toBe(409)
    expect(((await repetida.json()) as { erro: string }).erro).toBe(
      'já existe uma rota com esse nome nessa base',
    )

    const noutraBase = await escrever(livia, 'rotas', {
      nome: ROTAS[0]!,
      baseId: baseDe('Raposa'),
    })
    expect(noutraBase.status).toBe(201)
  })
})

describe('escrita de base', () => {
  test('a Lívia cria a base, desativa, e ela continua no ?todos=1', async () => {
    const resposta = await escrever(livia, 'bases', { nome: BASES[0]! })
    expect(resposta.status).toBe(201)
    const criada = (await resposta.json()) as Base
    expect(criada.ativo).toBe(true)

    const edicao = await escrever(livia, `bases/${criada.id}`, { nome: BASES[0]!, ativo: false }, 'PUT')
    expect(edicao.status).toBe(200)
    expect(((await edicao.json()) as Base).ativo).toBe(false)

    const { corpo } = await catalogo(livia)
    expect(corpo!.bases.map((item) => item.nome)).not.toContain(BASES[0]!)

    const { corpo: tudo } = await catalogo(livia, true)
    expect(tudo!.bases.find((item) => item.nome === BASES[0]!)?.ativo).toBe(false)
  })

  test('base inexistente volta 404 no PUT', async () => {
    const resposta = await escrever(
      livia,
      'bases/2f9a6a1c-9f5f-4d9a-9d5a-1f2b3c4d5e6f',
      { nome: 'ZZ Base Fantasma', ativo: true },
      'PUT',
    )
    expect(resposta.status).toBe(404)
    expect(((await resposta.json()) as { erro: string }).erro).toBe('base inexistente')
  })

  test('a Andreina não cria nem edita base', async () => {
    const criacao = await escrever(andreina, 'bases', { nome: 'ZZ Base da Andreina' })
    expect(criacao.status).toBe(403)
    expect(((await criacao.json()) as { erro: string }).erro).toBe('só administrador altera base')

    const edicao = await escrever(andreina, `bases/${baseDe('Raposa')}`, { nome: 'Raposa', ativo: true }, 'PUT')
    expect(edicao.status).toBe(403)
  })
})
