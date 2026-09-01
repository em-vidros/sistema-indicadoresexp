import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { ArmazenamentoArquivo } from '@ind/core'
import { montarRotas } from '../src/app.ts'
import type { Ambiente } from '../src/portao.ts'
import { auth, cookieDaLivia, cookieDe, db, pedir, sql } from './ajuda.ts'

const json = { 'content-type': 'application/json' }
const tituloTeste = 'Ata da prova da fase 2'
const PREFIXO = 'Prova de permissao de ata'
/** O numero das atas da prova. Nenhuma ata de verdade comeca assim. */
const NUMERO = 'PROVA-F2-'
/** Um PDF de verdade comeca com `%PDF-`, e a rota agora confere isso nos bytes. */
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 69, 79, 70])
let cookie = ''
let cookieAndreina = ''
let cookieLucas = ''
/** Ata da empresa (base nula), criada pela Livia, que e admin. */
let ataDaEmpresa = ''
/** Ata da Raposa, a base fixa da andreina. */
let ataDaAndreina = ''
/** Ata de Imperatriz, a base do lucascunha. A andreina nao tem essa base. */
let ataDeOutraBase = ''
const criadas: string[] = []
const arquivosCriados: string[] = []

function corpoAta(titulo: string) {
  return {
    numero: null,
    titulo,
    data: '2026-09-01',
    horario: null,
    local: null,
    convocada: null,
    facilitadores: null,
    participantesGeral: null,
    gestor1Nome: null,
    gestor1Cargo: null,
    gestor2Nome: null,
    gestor2Cargo: null,
    importada: false,
    topicos: [],
    participantes: [],
  }
}

/** Manda o corpo como veio e anota o id quando a ata de fato nasceu. */
async function postarAta(cookieDoAutor: string, corpo: unknown): Promise<Response> {
  const resposta = await pedir('/api/atas', {
    method: 'POST',
    headers: { cookie: cookieDoAutor, ...json },
    body: JSON.stringify(corpo),
  })
  if (resposta.status === 201) {
    criadas.push(((await resposta.clone().json()) as { id: string }).id)
  }
  return resposta
}

async function criarAtaComo(cookieDoAutor: string, titulo: string): Promise<string> {
  const resposta = await pedir('/api/atas', {
    method: 'POST',
    headers: { cookie: cookieDoAutor, ...json },
    body: JSON.stringify(corpoAta(titulo)),
  })
  expect(resposta.status).toBe(201)
  const criada = (await resposta.json()) as { id: string }
  criadas.push(criada.id)
  return criada.id
}

function formularioPdf(conteudo: Uint8Array<ArrayBuffer> = PDF, tipo = 'application/pdf'): FormData {
  const formulario = new FormData()
  formulario.set('arquivo', new File([conteudo], 'ata-assinada.pdf', { type: tipo }))
  return formulario
}

async function anexarPdfComo(cookieDoAutor: string, ataId: string): Promise<Response> {
  const envio = await pedir(`/api/atas/${ataId}/pdf`, {
    method: 'POST',
    headers: { cookie: cookieDoAutor },
    body: formularioPdf(),
  })
  if (envio.status === 201) arquivosCriados.push(((await envio.clone().json()) as { id: string }).id)
  return envio
}

beforeAll(async () => {
  await sql`delete from ata where titulo = ${tituloTeste} or titulo like ${`${PREFIXO}%`}`
  await sql`delete from ata where numero like ${`${NUMERO}%`}`
  cookie = await cookieDaLivia()
  cookieAndreina = await cookieDe('andreina', 'SENHA_ANDREINA')
  cookieLucas = await cookieDe('lucascunha', 'SENHA_LUCASCUNHA')
  ataDaEmpresa = await criarAtaComo(cookie, `${PREFIXO}: da empresa`)
  ataDaAndreina = await criarAtaComo(cookieAndreina, `${PREFIXO}: da Raposa`)
  ataDeOutraBase = await criarAtaComo(cookieLucas, `${PREFIXO}: de Imperatriz`)
  expect((await anexarPdfComo(cookie, ataDaEmpresa)).status).toBe(201)
  expect((await anexarPdfComo(cookieLucas, ataDeOutraBase)).status).toBe(201)
})

afterAll(async () => {
  // A ata aponta para o arquivo, entao ela sai primeiro; o contrario esbarra na
  // chave estrangeira.
  if (criadas.length > 0) await sql`delete from ata where id = any(${sql.array(criadas)}::uuid[])`
  if (arquivosCriados.length > 0) {
    await sql`delete from arquivo where id = any(${sql.array(arquivosCriados)}::uuid[])`
  }
})

describe('atas no banco', () => {
  test('o catalogo traz os colaboradores sem repetir o cadastro no HTML', async () => {
    const resposta = await pedir('/api/atas/catalogo', { headers: { cookie } })
    expect(resposta.status).toBe(200)
    const pessoas = (await resposta.json()) as Array<{ id: string; nome: string }>
    expect(pessoas).toHaveLength(31)
    expect(pessoas.map((p) => p.nome)).toContain('Andreina Santos Vilar')
  })

  test('grava a ata inteira e aceita prazo escrito como a tela permite', async () => {
    const catalogo = await pedir('/api/atas/catalogo', { headers: { cookie } })
    const pessoas = (await catalogo.json()) as Array<{ id: string; nome: string }>
    const andreina = pessoas.find((p) => p.nome === 'Andreina Santos Vilar')!
    const corpo = {
      numero: null,
      titulo: tituloTeste,
      data: '2026-09-01',
      horario: '09:30',
      local: 'Raposa - MA',
      convocada: 'Lívia',
      facilitadores: 'Raimundo',
      participantesGeral: 'Equipe de expedição',
      gestor1Nome: 'Gestor 1',
      gestor1Cargo: 'Coordenação',
      gestor2Nome: 'Gestor 2',
      gestor2Cargo: 'Gerência',
      importada: false,
      topicos: [
        {
          discussao: 'Rota do mês',
          conclusao: 'Revisar o roteiro',
          responsavel: 'Coordenação',
          prazo: 'Imediato',
        },
      ],
      participantes: [
        { colaboradorId: andreina.id, nomeExterno: null, presente: true },
        { colaboradorId: null, nomeExterno: 'Convidado externo', presente: true },
      ],
    }

    const resposta = await pedir('/api/atas', {
      method: 'POST',
      headers: { cookie, ...json },
      body: JSON.stringify(corpo),
    })
    expect(resposta.status).toBe(201)
    const criada = (await resposta.json()) as { id: string }
    criadas.push(criada.id)

    const lista = await pedir('/api/atas', { headers: { cookie } })
    expect(lista.status).toBe(200)
    const ata = ((await lista.json()) as Array<Record<string, unknown>>).find(
      (item) => item['id'] === criada.id,
    )!
    expect(ata).toMatchObject({
      numero: null,
      titulo: tituloTeste,
      facilitadores: 'Raimundo',
      participantesGeral: 'Equipe de expedição',
    })
    expect(ata['topicos']).toEqual([
      {
        discussao: 'Rota do mês',
        conclusao: 'Revisar o roteiro',
        responsavel: 'Coordenação',
        prazo: 'Imediato',
      },
    ])
    expect(ata['participantes']).toHaveLength(2)

    const atualizacao = await pedir(`/api/atas/${criada.id}`, {
      method: 'PUT',
      headers: { cookie, ...json },
      body: JSON.stringify({ ...corpo, titulo: `${tituloTeste} atualizada` }),
    })
    expect(atualizacao.status).toBe(200)
    expect(await atualizacao.json()).toMatchObject({ id: criada.id, titulo: `${tituloTeste} atualizada` })

    const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 69, 79, 70])
    const formulario = new FormData()
    formulario.set('arquivo', new File([pdf], 'ata-assinada.pdf', { type: 'application/pdf' }))
    const envio = await pedir(`/api/atas/${criada.id}/pdf`, {
      method: 'POST',
      headers: { cookie },
      body: formulario,
    })
    expect(envio.status).toBe(201)
    arquivosCriados.push(((await envio.clone().json()) as { id: string }).id)

    const leitura = await pedir(`/api/atas/${criada.id}/pdf`, { headers: { cookie } })
    expect(leitura.status).toBe(200)
    expect(leitura.headers.get('content-type')).toBe('application/pdf')
    expect(new Uint8Array(await leitura.arrayBuffer())).toEqual(pdf)

    const exclusao = await pedir(`/api/atas/${criada.id}`, { method: 'DELETE', headers: { cookie } })
    expect(exclusao.status).toBe(204)
    const depois = (await (await pedir('/api/atas', { headers: { cookie } })).json()) as Array<{ id: string }>
    expect(depois.some((item) => item.id === criada.id)).toBe(false)
  })
})

/**
 * O furo que estes testes fecham so passou despercebido porque toda prova de ata
 * usava o cookie da Livia, que e admin e por definicao ve tudo. Aqui quem pede e
 * a andreina, operadora da Raposa.
 *
 * A escolha entre 403 e 404 segue uma regra so: 403 quando ela ja enxerga o
 * alvo (ata da empresa aparece na lista dela, negar a escrita nao conta nada
 * novo); 404 quando ela nao enxerga (ata de Imperatriz), porque responder
 * "proibido" ali confirmaria que aquele id existe.
 */
describe('permissao por base nas atas', () => {
  test('a base da ata vem de quem grava, nunca do corpo do pedido', async () => {
    const [daAndreina] = await sql`
      select b.nome from ata a join base b on b.id = a.base_id where a.id = ${ataDaAndreina}
    `
    expect(daAndreina?.['nome']).toBe('Raposa')

    const [daEmpresa] = await sql`select base_id from ata where id = ${ataDaEmpresa}`
    expect(daEmpresa?.['base_id']).toBeNull()
  })

  test('a andreina lista a ata da base dela e a da empresa, e nao a de outra base', async () => {
    const resposta = await pedir('/api/atas', { headers: { cookie: cookieAndreina } })
    expect(resposta.status).toBe(200)
    const ids = ((await resposta.json()) as Array<{ id: string }>).map((item) => item.id)
    expect(ids).toContain(ataDaAndreina)
    expect(ids).toContain(ataDaEmpresa)
    expect(ids).not.toContain(ataDeOutraBase)
  })

  test('a Livia continua vendo as tres', async () => {
    const resposta = await pedir('/api/atas', { headers: { cookie } })
    const ids = ((await resposta.json()) as Array<{ id: string }>).map((item) => item.id)
    expect(ids).toContain(ataDaAndreina)
    expect(ids).toContain(ataDaEmpresa)
    expect(ids).toContain(ataDeOutraBase)
  })

  test('o catalogo de participantes para a andreina e so o pessoal da Raposa', async () => {
    const resposta = await pedir('/api/atas/catalogo', { headers: { cookie: cookieAndreina } })
    expect(resposta.status).toBe(200)
    const pessoas = (await resposta.json()) as Array<{ nome: string }>
    expect(pessoas).toHaveLength(22)
    expect(pessoas.map((p) => p.nome)).toContain('Andreina Santos Vilar')
    // Motorista de Imperatriz. O catalogo entregava as tres bases a qualquer sessao.
    expect(pessoas.map((p) => p.nome)).not.toContain('Adriel da Silva Santos')
  })

  test('na ata de outra base a andreina leva 404 em editar, apagar e baixar o PDF', async () => {
    const edicao = await pedir(`/api/atas/${ataDeOutraBase}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify(corpoAta('Prova de permissao de ata: sequestrada')),
    })
    expect(edicao.status).toBe(404)

    const anexo = await anexarPdfComo(cookieAndreina, ataDeOutraBase)
    expect(anexo.status).toBe(404)

    const leitura = await pedir(`/api/atas/${ataDeOutraBase}/pdf`, {
      headers: { cookie: cookieAndreina },
    })
    expect(leitura.status).toBe(404)

    const exclusao = await pedir(`/api/atas/${ataDeOutraBase}`, {
      method: 'DELETE',
      headers: { cookie: cookieAndreina },
    })
    expect(exclusao.status).toBe(404)

    // Nada disso encostou na ata: ela continua viva e com o titulo original.
    const [linha] = await sql`select titulo, apagado_em from ata where id = ${ataDeOutraBase}`
    expect(linha?.['titulo']).toBe('Prova de permissao de ata: de Imperatriz')
    expect(linha?.['apagado_em']).toBeNull()
  })

  test('a ata da empresa a andreina le e baixa, mas nao altera nem apaga', async () => {
    const leitura = await pedir(`/api/atas/${ataDaEmpresa}/pdf`, {
      headers: { cookie: cookieAndreina },
    })
    expect(leitura.status).toBe(200)

    const edicao = await pedir(`/api/atas/${ataDaEmpresa}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify(corpoAta('Prova de permissao de ata: reescrita')),
    })
    expect(edicao.status).toBe(403)

    const exclusao = await pedir(`/api/atas/${ataDaEmpresa}`, {
      method: 'DELETE',
      headers: { cookie: cookieAndreina },
    })
    expect(exclusao.status).toBe(403)

    const [linha] = await sql`select titulo, apagado_em from ata where id = ${ataDaEmpresa}`
    expect(linha?.['titulo']).toBe('Prova de permissao de ata: da empresa')
    expect(linha?.['apagado_em']).toBeNull()
  })

  test('na ata da base dela a andreina faz tudo, e a segunda exclusao e 404', async () => {
    const id = await criarAtaComo(cookieAndreina, `${PREFIXO}: ciclo completo`)

    const edicao = await pedir(`/api/atas/${id}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify(corpoAta(`${PREFIXO}: ciclo completo, revisada`)),
    })
    expect(edicao.status).toBe(200)

    expect((await anexarPdfComo(cookieAndreina, id)).status).toBe(201)
    const leitura = await pedir(`/api/atas/${id}/pdf`, { headers: { cookie: cookieAndreina } })
    expect(leitura.status).toBe(200)
    expect(new Uint8Array(await leitura.arrayBuffer())).toEqual(PDF)

    const exclusao = await pedir(`/api/atas/${id}`, {
      method: 'DELETE',
      headers: { cookie: cookieAndreina },
    })
    expect(exclusao.status).toBe(204)

    // Apagar de novo tem que ser 404. Antes o UPDATE achava a linha ja apagada e
    // devolvia 204 todas as vezes, e a tela dizia "apagada" para nada.
    const denovo = await pedir(`/api/atas/${id}`, {
      method: 'DELETE',
      headers: { cookie: cookieAndreina },
    })
    expect(denovo.status).toBe(404)
  })
})

describe('o PDF que a rota aceita', () => {
  test('arquivo que nao comeca com %PDF- e recusado, mesmo dizendo ser PDF', async () => {
    const disfarcado = new TextEncoder().encode('<?php system($_GET["c"]); ?>')
    const envio = await pedir(`/api/atas/${ataDaEmpresa}/pdf`, {
      method: 'POST',
      headers: { cookie },
      body: formularioPdf(disfarcado),
    })
    expect(envio.status).toBe(400)
  })

  test('corpo declarado acima de 4 MB e recusado antes de ser lido', async () => {
    // O corpo aqui e um multipart minusculo e valido: se a rota lesse o corpo
    // antes de olhar o `Content-Length`, o envio daria 201. O 400 so acontece
    // porque a recusa vem antes de `formData()` colocar tudo na memoria.
    const limite = 4 * 1024 * 1024
    const borda = '----prova'
    const corpo =
      `--${borda}\r\n` +
      'content-disposition: form-data; name="arquivo"; filename="ata.pdf"\r\n' +
      'content-type: application/pdf\r\n\r\n' +
      '%PDF-1.4\n%EOF\r\n' +
      `--${borda}--\r\n`
    const envio = await pedir(`/api/atas/${ataDaEmpresa}/pdf`, {
      method: 'POST',
      headers: {
        cookie,
        'content-type': `multipart/form-data; boundary=${borda}`,
        'content-length': String(limite + 1),
      },
      body: corpo,
    })
    expect(envio.status).toBe(400)
    expect(await envio.json()).toEqual({ erro: 'PDF invalido ou maior que 4 MB' })
  })
})

describe('a faxina do PDF anterior', () => {
  test('envio que ja gravou nao vira 500 porque o arquivo velho nao saiu', async () => {
    const id = await criarAtaComo(cookieAndreina, `${PREFIXO}: faxina`)
    expect((await anexarPdfComo(cookieAndreina, id)).status).toBe(201)

    // Um armazenamento que guarda, mas nao apaga. A troca do PDF acontece dentro
    // da transacao; apagar o arquivo antigo vem depois dela e e faxina, entao a
    // falha aqui nao pode desfazer um envio que ja esta gravado no banco.
    const guardados = new Map<string, Uint8Array>()
    const semFaxina: ArmazenamentoArquivo = {
      async guardar(novo) {
        guardados.set(`${novo.id}.bin`, novo.conteudo)
        return { caminho: `${novo.id}.bin` }
      },
      async ler(caminho) {
        return guardados.get(caminho) ?? null
      },
      async apagar() {
        throw new Error('armazenamento fora do ar')
      },
    }
    const appSemFaxina = montarRotas(new Hono<Ambiente>(), { auth, db, arquivos: semFaxina })

    const envio = await appSemFaxina.request(
      new Request(`http://teste.local/api/atas/${id}/pdf`, {
        method: 'POST',
        headers: { cookie: cookieAndreina },
        body: formularioPdf(),
      }),
    )
    expect(envio.status).toBe(201)
    arquivosCriados.push(((await envio.json()) as { id: string }).id)
  })
})

/**
 * `2026-02-31` e `2026-99-99` casam com `^\d{4}-\d{2}-\d{2}$` e não existem. O
 * Postgres recusa a coluna `date` com 22008, que a rota não tratava: a resposta
 * era `Internal Server Error`, e a tela não tinha o que dizer a quem só errou o
 * dia.
 */
describe('data e horário da ata são conferidos contra o calendário', () => {
  async function recusa(corpo: unknown) {
    const resposta = await postarAta(cookie, corpo)
    const lido = (await resposta.json().catch(() => null)) as { erro?: string } | null
    return { status: resposta.status, erro: lido?.erro ?? '' }
  }

  test('30 de fevereiro é 400, e não 500', async () => {
    const { status, erro } = await recusa({
      ...corpoAta(`${PREFIXO}: 30 de fevereiro`),
      data: '2026-02-31',
    })
    expect(status).toBe(400)
    expect(erro).toMatch(/data inválida/i)
  })

  test('mês 99 é 400', async () => {
    expect((await recusa({ ...corpoAta(`${PREFIXO}: mes 99`), data: '2026-99-99' })).status).toBe(400)
  })

  test('horário que não existe no relógio é 400', async () => {
    const { status, erro } = await recusa({
      ...corpoAta(`${PREFIXO}: horario 25`),
      horario: '25:00',
    })
    expect(status).toBe(400)
    expect(erro).toMatch(/hora inválida/i)
  })

  test('a data inexistente também é recusada na edição', async () => {
    const id = await criarAtaComo(cookie, `${PREFIXO}: edicao com data ruim`)
    const resposta = await pedir(`/api/atas/${id}`, {
      method: 'PUT',
      headers: { cookie, ...json },
      body: JSON.stringify({ ...corpoAta(`${PREFIXO}: edicao com data ruim`), data: '2026-02-30' }),
    })
    expect(resposta.status).toBe(400)
  })

  test('nenhuma ata de data inválida ficou no banco', async () => {
    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from ata where titulo like ${`${PREFIXO}: 30 de fevereiro%`}
        or titulo like ${`${PREFIXO}: mes 99%`} or titulo like ${`${PREFIXO}: horario 25%`}`
    expect(linha!.n).toBe(0)
  })
})

/**
 * A numeração da ata é da base, não da empresa. O `UNIQUE (numero)` global fazia
 * repetir um número virar 500 mudo e, pior, transformava a diferença entre 201 e
 * 500 num oráculo: números de ata são curtos e sequenciais, então a andreina
 * enumerava a numeração de Imperatriz pela resposta — deixando uma ata de
 * verdade no banco a cada tentativa.
 */
describe('o número da ata é único dentro da base', () => {
  const comNumero = (numero: string | null, titulo: string) => ({
    ...corpoAta(titulo),
    numero,
  })

  test('repetir o número na mesma base é 409 com mensagem, e não 500', async () => {
    const primeira = await postarAta(cookieAndreina, comNumero(`${NUMERO}001`, `${PREFIXO}: numero 1`))
    expect(primeira.status).toBe(201)

    const repetida = await postarAta(cookieAndreina, comNumero(`${NUMERO}001`, `${PREFIXO}: numero 1 de novo`))
    expect(repetida.status).toBe(409)
    expect(((await repetida.json()) as { erro: string }).erro).toMatch(/já existe uma ata/i)

    // A tentativa recusada não deixou ata nenhuma para trás.
    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from ata where numero = ${`${NUMERO}001`}`
    expect(linha!.n).toBe(1)
  })

  test('o mesmo número em outra base passa: a numeração não é da empresa', async () => {
    const emImperatriz = await postarAta(cookieLucas, comNumero(`${NUMERO}001`, `${PREFIXO}: numero 1 imperatriz`))
    expect(emImperatriz.status).toBe(201)
  })

  test('a ata da empresa também não repete número entre si', async () => {
    // `base_id` nulo. Sem o índice parcial próprio da empresa, o NULL do
    // Postgres é distinto de si mesmo e as duas passariam.
    expect((await postarAta(cookie, comNumero(`${NUMERO}E01`, `${PREFIXO}: empresa 1`))).status).toBe(201)
    expect((await postarAta(cookie, comNumero(`${NUMERO}E01`, `${PREFIXO}: empresa 1 de novo`))).status).toBe(409)
  })

  test('ata sem número repete à vontade, na base e na empresa', async () => {
    // `numero` nulo é legítimo desde a 0006, e é por isto que a unicidade não
    // pode ser um `UNIQUE NULLS NOT DISTINCT (numero, base_id)`: ele trataria
    // duas atas sem número como a mesma ata.
    expect((await postarAta(cookieAndreina, comNumero(null, `${PREFIXO}: sem numero 1`))).status).toBe(201)
    expect((await postarAta(cookieAndreina, comNumero(null, `${PREFIXO}: sem numero 2`))).status).toBe(201)
    expect((await postarAta(cookie, comNumero(null, `${PREFIXO}: sem numero empresa 1`))).status).toBe(201)
    expect((await postarAta(cookie, comNumero(null, `${PREFIXO}: sem numero empresa 2`))).status).toBe(201)
  })

  test('salvar a ata de novo com o próprio número continua valendo', async () => {
    const criada = await postarAta(cookieAndreina, comNumero(`${NUMERO}777`, `${PREFIXO}: reedicao`))
    expect(criada.status).toBe(201)
    const { id } = (await criada.json()) as { id: string }
    const edicao = await pedir(`/api/atas/${id}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify(comNumero(`${NUMERO}777`, `${PREFIXO}: reedicao revisada`)),
    })
    expect(edicao.status).toBe(200)
  })
})

/**
 * A escrita aceitava qualquer uuid de colaborador: ata da Raposa com participante
 * de Imperatriz voltava 201. Não vazava nome, porque a lista devolve só o id e a
 * tela resolve pelo catálogo já filtrado, mas era chave estrangeira cruzando a
 * fronteira da base e um oráculo de existência.
 */
describe('participante de ata é conferido contra a base', () => {
  async function idDeImperatriz(): Promise<string> {
    const resposta = await pedir('/api/atas/catalogo', { headers: { cookie: cookieLucas } })
    const pessoas = (await resposta.json()) as Array<{ id: string; nome: string }>
    return pessoas.find((p) => p.nome === 'Adriel da Silva Santos')!.id
  }

  async function idDaRaposa(): Promise<string> {
    const resposta = await pedir('/api/atas/catalogo', { headers: { cookie: cookieAndreina } })
    const pessoas = (await resposta.json()) as Array<{ id: string; nome: string }>
    return pessoas.find((p) => p.nome === 'Andreina Santos Vilar')!.id
  }

  test('colaborador de outra base é recusado, e não vira ata', async () => {
    const forasteiro = await idDeImperatriz()
    const resposta = await postarAta(cookieAndreina, {
      ...corpoAta(`${PREFIXO}: participante de fora`),
      participantes: [{ colaboradorId: forasteiro, nomeExterno: null, presente: true }],
    })
    expect(resposta.status).toBe(400)
    expect(((await resposta.json()) as { erro: string }).erro).toBe('participante inexistente')

    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from ata where titulo = ${`${PREFIXO}: participante de fora`}`
    expect(linha!.n).toBe(0)
  })

  test('a recusa usa a mesma palavra do uuid que não existe: não é oráculo', async () => {
    const inexistente = await postarAta(cookieAndreina, {
      ...corpoAta(`${PREFIXO}: participante fantasma`),
      participantes: [
        { colaboradorId: '00000000-0000-4000-8000-000000000000', nomeExterno: null, presente: true },
      ],
    })
    expect(inexistente.status).toBe(400)
    expect(((await inexistente.json()) as { erro: string }).erro).toBe('participante inexistente')
  })

  test('a andreina segue montando ata com o pessoal da Raposa', async () => {
    const daCasa = await idDaRaposa()
    const resposta = await postarAta(cookieAndreina, {
      ...corpoAta(`${PREFIXO}: participante da casa`),
      participantes: [
        { colaboradorId: daCasa, nomeExterno: null, presente: true },
        { colaboradorId: null, nomeExterno: 'Convidado de Imperatriz', presente: true },
      ],
    })
    expect(resposta.status).toBe(201)
  })

  test('a Lívia, admin, monta ata com gente de qualquer base', async () => {
    const resposta = await postarAta(cookie, {
      ...corpoAta(`${PREFIXO}: admin junta as bases`),
      participantes: [
        { colaboradorId: await idDaRaposa(), nomeExterno: null, presente: true },
        { colaboradorId: await idDeImperatriz(), nomeExterno: null, presente: true },
      ],
    })
    expect(resposta.status).toBe(201)
  })

  test('a edição também não aceita participante de fora', async () => {
    const id = await criarAtaComo(cookieAndreina, `${PREFIXO}: edicao com forasteiro`)
    const resposta = await pedir(`/api/atas/${id}`, {
      method: 'PUT',
      headers: { cookie: cookieAndreina, ...json },
      body: JSON.stringify({
        ...corpoAta(`${PREFIXO}: edicao com forasteiro`),
        participantes: [
          { colaboradorId: await idDeImperatriz(), nomeExterno: null, presente: true },
        ],
      }),
    })
    expect(resposta.status).toBe(400)

    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from ata_participante where ata_id = ${id}::uuid`
    expect(linha!.n).toBe(0)
  })
})
