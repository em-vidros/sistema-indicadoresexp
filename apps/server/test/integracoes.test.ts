import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cookieDaLivia, cookieDe, pedir, sql } from './ajuda.ts'

const json = { 'content-type': 'application/json' }

type AtividadeCatalogo = { id: string; codigo: string }
type ProgramaCatalogo = {
  id: string
  funcao: 'motorista' | 'ajudante'
  semanas: Array<{ atividades: AtividadeCatalogo[] }>
}
type Catalogo = {
  colaboradores: Array<{ id: string; nome: string; funcao: 'motorista' | 'ajudante' }>
  programas: ProgramaCatalogo[]
}
type IntegracaoSalva = {
  id: string
  programaId: string
  nome: string
  atividades: Array<{ atividadeId: string; codigo: string; feito: boolean; data: string | null }>
}

let cookie = ''
let cookieAndreina = ''
let cookieLucas = ''
const criadas: string[] = []

beforeAll(async () => {
  await sql`
    delete from integracao
    where nome_livre = 'Adinaldo de Souza de Jesus'
      and coord = 'Coordenação'
      and inicio = '2026-09-01'
  `
  cookie = await cookieDaLivia()
  cookieAndreina = await cookieDe('andreina', 'SENHA_ANDREINA')
  cookieLucas = await cookieDe('lucascunha', 'SENHA_LUCASCUNHA')
})

afterAll(async () => {
  if (criadas.length === 0) return
  await sql`delete from integracao where id = any(${sql.array(criadas)}::uuid[])`
})

async function catalogo(cookieDoPedido: string = cookie): Promise<Catalogo> {
  const resposta = await pedir('/api/integracoes/catalogo', {
    headers: { cookie: cookieDoPedido },
  })
  expect(resposta.status).toBe(200)
  return (await resposta.json()) as Catalogo
}

describe('GET /api/integracoes/catalogo', () => {
  test('devolve os programas e os colaboradores que a tela precisa', async () => {
    const dados = await catalogo()

    expect(dados.programas.map((p) => p.funcao)).toEqual(['ajudante', 'motorista'])
    expect(dados.programas.flatMap((p) => p.semanas.flatMap((s) => s.atividades))).toHaveLength(47)
    expect(dados.colaboradores.every((c) => ['motorista', 'ajudante'].includes(c.funcao))).toBe(true)
    expect(dados.colaboradores.map((c) => c.nome)).toContain('Adinaldo de Souza de Jesus')
  })
})

describe('salvar e reler uma integracao', () => {
  test('o registro reaparece com o progresso depois de outra requisicao', async () => {
    const dados = await catalogo()
    const programa = dados.programas.find((p) => p.funcao === 'motorista')!
    const colaborador = dados.colaboradores.find((c) => c.nome === 'Adinaldo de Souza de Jesus')!
    const atividades = programa.semanas.flatMap((s) => s.atividades)

    const corpo = {
      colaboradorId: colaborador.id,
      nome: colaborador.nome,
      cargo: 'Motorista Carreteiro',
      admissao: '2026-04-01',
      programaId: programa.id,
      inicio: '2026-09-01',
      coord: 'Coordenação',
      gerente: 'Gerência',
      rh: 'RH',
      atividades: atividades.map((a, i) => ({
        atividadeId: a.id,
        feito: i === 0,
        data: i === 0 ? '2026-09-01' : null,
      })),
    }
    const resposta = await pedir('/api/integracoes', {
      method: 'POST',
      headers: { cookie, ...json },
      body: JSON.stringify(corpo),
    })

    expect(resposta.status).toBe(201)
    const criada = (await resposta.json()) as IntegracaoSalva
    criadas.push(criada.id)

    const lista = await pedir('/api/integracoes', { headers: { cookie } })
    expect(lista.status).toBe(200)
    const registro = ((await lista.json()) as IntegracaoSalva[]).find((i) => i.id === criada.id)!

    expect(registro.nome).toBe('Adinaldo de Souza de Jesus')
    expect(registro.atividades).toHaveLength(23)
    expect(registro.atividades.find((a) => a.codigo === 'm1a')).toMatchObject({
      feito: true,
      data: '2026-09-01',
    })
    expect(registro.atividades.find((a) => a.codigo === 'm1b')).toMatchObject({
      feito: false,
      data: null,
    })

    const atualizacao = await pedir(`/api/integracoes/${criada.id}`, {
      method: 'PUT',
      headers: { cookie, ...json },
      body: JSON.stringify({
        ...corpo,
        atividades: corpo.atividades.map((atividade, i) => ({
          ...atividade,
          feito: i < 2,
          data: i < 2 ? '2026-09-02' : null,
        })),
      }),
    })
    expect(atualizacao.status).toBe(200)

    const atualizada = (await atualizacao.json()) as IntegracaoSalva
    expect(atualizada.id).toBe(criada.id)
    expect(atualizada.atividades.filter((a) => a.feito)).toHaveLength(2)
  })

  test('uma atividade de outro programa recusa o corpo inteiro', async () => {
    const dados = await catalogo()
    const motorista = dados.programas.find((p) => p.funcao === 'motorista')!
    const atividadeAjudante = dados.programas
      .find((p) => p.funcao === 'ajudante')!
      .semanas[0]!.atividades[0]!

    const resposta = await pedir('/api/integracoes', {
      method: 'POST',
      headers: { cookie, ...json },
      body: JSON.stringify({
        nome: 'Registro inválido',
        programaId: motorista.id,
        atividades: [{ atividadeId: atividadeAjudante.id, feito: true, data: '2026-09-01' }],
      }),
    })

    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toEqual({ erro: 'atividade fora do programa' })
    const linhas = await sql`select count(*)::int as n from integracao where nome_livre = 'Registro inválido'`
    expect(linhas[0]?.['n']).toBe(0)
  })
})

/**
 * A ficha de integracao nao tem base propria: ela e do colaborador, e a base sai
 * de `colaborador.base_id` por join. Ate aqui todo teste desta tela usava o
 * cookie da Livia, que e admin, e por isso ninguem viu que a andreina reescrevia
 * a ficha de qualquer colaborador da empresa.
 *
 * 404 na ficha de outra base (ela nem a enxerga na lista, e 403 confirmaria o
 * id) e 403 quando o colaborador recusado veio no corpo do pedido (quem enviou o
 * id ja sabe que ele existe, a recusa nao conta nada novo).
 */
describe('permissao por base nas integracoes', () => {
  async function criarComo(
    cookieDoAutor: string,
    colaboradorId: string,
    nome: string,
    programaId: string,
  ): Promise<Response> {
    const resposta = await pedir('/api/integracoes', {
      method: 'POST',
      headers: { cookie: cookieDoAutor, ...json },
      body: JSON.stringify({
        colaboradorId,
        nome,
        cargo: 'Motorista',
        programaId,
        inicio: '2026-09-01',
        coord: 'Prova de permissao',
        atividades: [],
      }),
    })
    if (resposta.status === 201) {
      criadas.push(((await resposta.clone().json()) as IntegracaoSalva).id)
    }
    return resposta
  }

  test('o catalogo da andreina traz so o pessoal da Raposa', async () => {
    const dela = await catalogo(cookieAndreina)
    const daLivia = await catalogo()

    expect(dela.colaboradores).toHaveLength(19)
    expect(dela.colaboradores.map((c) => c.nome)).toContain('Adinaldo de Souza de Jesus')
    // Motorista de Imperatriz: fora das bases dela.
    expect(dela.colaboradores.map((c) => c.nome)).not.toContain('Adriel da Silva Santos')
    expect(daLivia.colaboradores.map((c) => c.nome)).toContain('Adriel da Silva Santos')
    // Os programas nao tem base e continuam inteiros para os dois.
    expect(dela.programas.flatMap((p) => p.semanas.flatMap((s) => s.atividades))).toHaveLength(47)
  })

  test('a andreina so grava ficha de colaborador da base dela', async () => {
    const daLivia = await catalogo()
    const motorista = daLivia.programas.find((p) => p.funcao === 'motorista')!
    const deImperatriz = daLivia.colaboradores.find((c) => c.nome === 'Adriel da Silva Santos')!
    const daRaposa = (await catalogo(cookieAndreina)).colaboradores.find(
      (c) => c.funcao === 'motorista' && c.nome !== 'Adinaldo de Souza de Jesus',
    )!

    const recusada = await criarComo(
      cookieAndreina,
      deImperatriz.id,
      deImperatriz.nome,
      motorista.id,
    )
    expect(recusada.status).toBe(403)
    expect(await recusada.json()).toEqual({ erro: 'colaborador fora das suas bases' })
    const [linha] = await sql`
      select count(*)::int as n from integracao where colaborador_id = ${deImperatriz.id}
    `
    expect(linha?.['n']).toBe(0)

    const aceita = await criarComo(cookieAndreina, daRaposa.id, daRaposa.nome, motorista.id)
    expect(aceita.status).toBe(201)
    const minha = (await aceita.json()) as IntegracaoSalva

    const edicao = await pedir(`/api/integracoes/${minha.id}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify({
        colaboradorId: daRaposa.id,
        nome: daRaposa.nome,
        cargo: 'Motorista Carreteiro',
        programaId: motorista.id,
        inicio: '2026-09-02',
        coord: 'Prova de permissao',
        atividades: [],
      }),
    })
    expect(edicao.status).toBe(200)
  })

  test('a ficha de outra base a andreina nao lista e nao reescreve', async () => {
    const daLivia = await catalogo()
    const motorista = daLivia.programas.find((p) => p.funcao === 'motorista')!
    const deImperatriz = daLivia.colaboradores.find((c) => c.nome === 'Adriel da Silva Santos')!
    const criada = await criarComo(cookieLucas, deImperatriz.id, deImperatriz.nome, motorista.id)
    expect(criada.status).toBe(201)
    const doLucas = (await criada.json()) as IntegracaoSalva

    const listaDela = await pedir('/api/integracoes', { headers: { cookie: cookieAndreina } })
    const idsDela = ((await listaDela.json()) as IntegracaoSalva[]).map((i) => i.id)
    expect(idsDela).not.toContain(doLucas.id)

    const invasao = await pedir(`/api/integracoes/${doLucas.id}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify({
        colaboradorId: deImperatriz.id,
        nome: 'Reescrita pela andreina',
        programaId: motorista.id,
        atividades: [],
      }),
    })
    expect(invasao.status).toBe(404)

    const [linha] = await sql`select nome_livre from integracao where id = ${doLucas.id}`
    expect(linha?.['nome_livre']).toBe(deImperatriz.nome)

    // A Livia continua vendo e podendo tudo.
    const listaDaLivia = await pedir('/api/integracoes', { headers: { cookie } })
    const idsDaLivia = ((await listaDaLivia.json()) as IntegracaoSalva[]).map((i) => i.id)
    expect(idsDaLivia).toContain(doLucas.id)
    const pelaLivia = await pedir(`/api/integracoes/${doLucas.id}`, {
      method: 'PUT',
      headers: { cookie, ...json },
      body: JSON.stringify({
        colaboradorId: deImperatriz.id,
        nome: deImperatriz.nome,
        cargo: 'Motorista',
        programaId: motorista.id,
        atividades: [],
      }),
    })
    expect(pelaLivia.status).toBe(200)
  })
})

/**
 * `admissao`, `inicio` e a data de cada atividade alimentam colunas `date`, e a
 * forma `^\d{4}-\d{2}-\d{2}$` deixava passar dia que não existe. O Postgres
 * recusa com 22008 e a ficha voltava 500. Agora quem recusa é o zod, com 400.
 */
describe('data da integração é conferida contra o calendário', () => {
  async function corpoValido() {
    const dados = await catalogo()
    const programa = dados.programas.find((p) => p.funcao === 'motorista')!
    const pessoa = dados.colaboradores.find((c) => c.nome === 'Adinaldo de Souza de Jesus')!
    const atividade = programa.semanas[0]!.atividades[0]!
    return {
      colaboradorId: pessoa.id,
      nome: pessoa.nome,
      cargo: 'Motorista Carreteiro',
      admissao: '2026-04-01',
      programaId: programa.id,
      inicio: '2026-09-01',
      coord: 'Coordenação',
      gerente: 'Gerência',
      rh: 'RH',
      atividades: [{ atividadeId: atividade.id, feito: true, data: '2026-09-01' }],
    }
  }

  async function recusa(corpo: unknown) {
    const resposta = await pedir('/api/integracoes', {
      method: 'POST',
      headers: { cookie, ...json },
      body: JSON.stringify(corpo),
    })
    if (resposta.status === 201) criadas.push(((await resposta.clone().json()) as { id: string }).id)
    const lido = (await resposta.json().catch(() => null)) as { erro?: string } | null
    return { status: resposta.status, erro: lido?.erro ?? '' }
  }

  test('30 de fevereiro na admissão é 400, e não 500', async () => {
    const { status, erro } = await recusa({ ...(await corpoValido()), admissao: '2026-02-31' })
    expect(status).toBe(400)
    expect(erro).toMatch(/data inválida/i)
  })

  test('texto arbitrário no início é 400', async () => {
    const { status, erro } = await recusa({ ...(await corpoValido()), inicio: 'banana' })
    expect(status).toBe(400)
    expect(erro).toMatch(/data inválida/i)
  })

  test('data inexistente na atividade também recusa o corpo inteiro', async () => {
    const corpo = await corpoValido()
    const { status } = await recusa({
      ...corpo,
      atividades: corpo.atividades.map((a) => ({ ...a, data: '2026-13-01' })),
    })
    expect(status).toBe(400)
  })

  test('nada disso virou ficha no banco', async () => {
    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from integracao
      where admissao is null and nome_livre = 'Adinaldo de Souza de Jesus' and coord = 'Coordenação'
        and inicio is null`
    expect(linha!.n).toBe(0)
  })
})
