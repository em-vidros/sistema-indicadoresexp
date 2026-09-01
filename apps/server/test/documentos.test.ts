import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ArmazenamentoArquivo } from '@ind/core'
import { Hono } from 'hono'
import { montarRotas } from '../src/app.ts'
import type { Ambiente } from '../src/portao.ts'
import { auth, cookieDaLivia, cookieDe, db, pedir, sql } from './ajuda.ts'

let cookie = ''
let andreina = ''
let lucascunha = ''
const documentos: string[] = []
const arquivos: string[] = []
/** Vinculo de manual que este arquivo inseriu direto no banco, para desfazer no fim. */
const vinculos: Array<{ documentoId: string; veiculoId: string }> = []

/** '%PDF-DOC': os cinco primeiros bytes sao a assinatura que o servidor confere. */
const PDF = new Uint8Array([37, 80, 68, 70, 45, 68, 79, 67])

type Catalogo = {
  bases: Array<{ id: string; nome: string }>
  veiculos: Array<{ id: string; placa: string; baseId: string }>
  colaboradores: Array<{ id: string; nome: string; baseId: string }>
}
type Salvo = { id?: string; arquivoId?: string | null }

let baseImperatriz = { id: '', nome: '' }
let veiculoImperatriz = { id: '', placa: '', baseId: '' }
let veiculoRaposa = { id: '', placa: '', baseId: '' }
let colaboradorRaposa = { id: '', nome: '', baseId: '' }
/** Documento de Imperatriz, com PDF, gravado pela admin. A Andreina e de Raposa. */
const docImperatriz = { id: '', arquivoId: '' }
const docRaposa = { id: '', arquivoId: '' }

async function corpo(resposta: Response): Promise<Salvo | null> {
  return (await resposta.json().catch(() => null)) as Salvo | null
}

/** O que a rota criar entra na limpeza, inclusive no que ela nao deveria ter criado. */
function registrar(salvo: Salvo | null): Salvo | null {
  if (salvo?.id && !documentos.includes(salvo.id)) documentos.push(salvo.id)
  if (salvo?.arquivoId && !arquivos.includes(salvo.arquivoId)) arquivos.push(salvo.arquivoId)
  return salvo
}

async function enviar(quem: string, dados: Record<string, unknown>, arquivo: File): Promise<Response> {
  const formulario = new FormData()
  formulario.set('dados', JSON.stringify(dados))
  formulario.set('arquivo', arquivo)
  return await pedir('/api/documentos', { method: 'POST', headers: { cookie: quem }, body: formulario })
}

async function gravarDados(quem: string, dados: Record<string, unknown>): Promise<Response> {
  return await pedir('/api/documentos/dados', {
    method: 'POST',
    headers: { cookie: quem, 'content-type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

beforeAll(async () => {
  ;[cookie, andreina, lucascunha] = await Promise.all([
    cookieDaLivia(),
    cookieDe('andreina', 'SENHA_ANDREINA'),
    cookieDe('lucascunha', 'SENHA_LUCASCUNHA'),
  ])

  const catalogo = (await (await pedir('/api/documentos/catalogo', { headers: { cookie } })).json()) as Catalogo
  baseImperatriz = catalogo.bases.find((item) => item.nome === 'Imperatriz')!
  const raposa = catalogo.bases.find((item) => item.nome === 'Raposa')!
  // Nao a DMG9D41: ela e o veiculo do primeiro teste, e crlv e um por veiculo.
  veiculoImperatriz = catalogo.veiculos.find(
    (item) => item.baseId === baseImperatriz.id && item.placa !== 'DMG9D41',
  )!
  veiculoRaposa = catalogo.veiculos.find((item) => item.baseId === raposa.id)!
  colaboradorRaposa = catalogo.colaboradores.find((item) => item.baseId === raposa.id)!

  const resposta = await enviar(
    cookie,
    { tipo: 'crlv', titulo: 'CRLV de Imperatriz', veiculoId: veiculoImperatriz.id },
    new File([PDF], 'imperatriz.pdf', { type: 'application/pdf' }),
  )
  if (resposta.status !== 201) throw new Error(`fixture falhou com ${resposta.status}: ${await resposta.text()}`)
  const salvo = registrar(await corpo(resposta))!
  docImperatriz.id = salvo.id!
  docImperatriz.arquivoId = salvo.arquivoId!

  // O par do de cima, na base da Andreina. Sem ele a assercao de que ela continua
  // vendo o acervo dela seria `length > 0`, e isso passa mesmo com o filtro trocado
  // por `return []`: os manuais nao tem base nenhuma e aparecem para todo mundo.
  const daRaposa = await enviar(
    cookie,
    { tipo: 'crlv', titulo: 'CRLV da Raposa', veiculoId: veiculoRaposa.id },
    new File([PDF], 'raposa.pdf', { type: 'application/pdf' }),
  )
  if (daRaposa.status !== 201) throw new Error(`fixture falhou com ${daRaposa.status}: ${await daRaposa.text()}`)
  const outro = registrar(await corpo(daRaposa))!
  docRaposa.id = outro.id!
  docRaposa.arquivoId = outro.arquivoId!
})

afterAll(async () => {
  for (const vinculo of vinculos) {
    await sql`delete from documento_veiculo
      where documento_id = ${vinculo.documentoId}::uuid and veiculo_id = ${vinculo.veiculoId}::uuid`
  }
  if (documentos.length) await sql`delete from documento where id = any(${sql.array(documentos)}::uuid[])`
  if (arquivos.length) await sql`delete from arquivo where id = any(${sql.array(arquivos)}::uuid[])`
})

describe('documentos da frota no banco', () => {
  test('lista o cadastro central e guarda um PDF sem base64', async () => {
    const catalogo = await pedir('/api/documentos/catalogo', { headers: { cookie } })
    expect(catalogo.status).toBe(200)
    const dados = (await catalogo.json()) as {
      bases: Array<{ nome: string }>
      veiculos: Array<{ id: string; placa: string }>
      colaboradores: Array<{ nome: string }>
    }
    expect(dados.bases.map((item) => item.nome)).toContain('Raposa')
    expect(dados.veiculos).toHaveLength(15)
    const veiculo = dados.veiculos.find((item) => item.placa === 'DMG9D41')!

    const pdf = new Uint8Array([37, 80, 68, 70, 45, 68, 79, 67])
    const formulario = new FormData()
    formulario.set('dados', JSON.stringify({
      tipo: 'crlv',
      titulo: 'CRLV DMG9D41',
      vencimento: '2027-01-31',
      veiculoId: veiculo.id,
    }))
    formulario.set('arquivo', new File([pdf], 'crlv.pdf', { type: 'application/pdf' }))
    const envio = await pedir('/api/documentos', { method: 'POST', headers: { cookie }, body: formulario })
    expect(envio.status).toBe(201)
    const salvo = (await envio.json()) as { id: string; arquivoId: string }
    documentos.push(salvo.id)
    arquivos.push(salvo.arquivoId)

    const lista = await pedir('/api/documentos', { headers: { cookie } })
    const documento = ((await lista.json()) as Array<{ id: string; temArquivo: boolean }>).find(
      (item) => item.id === salvo.id,
    )
    expect(documento).toMatchObject({ id: salvo.id, temArquivo: true })

    const atualizacao = await pedir(`/api/documentos/${salvo.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'crlv', titulo: 'CRLV DMG9D41', vencimento: '2027-02-28',
        veiculoId: veiculo.id,
      }),
    })
    expect(atualizacao.status).toBe(200)

    const leitura = await pedir(`/api/documentos/${salvo.id}/arquivo`, { headers: { cookie } })
    expect(leitura.status).toBe(200)
    expect(new Uint8Array(await leitura.arrayBuffer())).toEqual(pdf)
  })
})

/**
 * A Livia e admin e ve as tres bases, e por isso todo teste acima passa com furo de
 * autorizacao embaixo. A Andreina e operadora de Raposa: e ela quem prova a regra.
 */
describe('data de vencimento', () => {
  // O regex de forma aceitava `2026-02-31`, o Postgres recusava com 22008, e o
  // cliente recebia 500 sem saber o que corrigir. A validacao mora em `entrada.ts`,
  // com a mesma funcao do dominio que as rotas de ata e de registro usam.
  test.each([
    ['2026-02-31', '31 de fevereiro'],
    ['2026-99-99', 'mes e dia fora da faixa'],
    ['2027-02-29', '29 de fevereiro em ano que nao e bissexto'],
  ])('%s é recusado com 400 e não 500 (%s)', async (vencimento) => {
    const resposta = await gravarDados(cookie, {
      tipo: 'apolice',
      titulo: 'Apólice com data impossível',
      vencimento,
      veiculoId: veiculoRaposa.id,
      linkExterno: 'apolice.pdf',
    })
    expect(resposta.status).toBe(400)
    expect((await resposta.json()) as { erro: string }).toMatchObject({
      erro: expect.stringContaining('data inválida'),
    })
  })

  test('2028-02-29 entra, porque 2028 é bissexto', async () => {
    const resposta = await gravarDados(cookie, {
      tipo: 'apolice',
      titulo: 'Apólice de ano bissexto',
      vencimento: '2028-02-29',
      veiculoId: veiculoRaposa.id,
      linkExterno: 'apolice.pdf',
    })
    expect(resposta.status).toBe(201)
    registrar(await corpo(resposta))
  })
})

describe('autorização dos documentos', () => {
  test('o catálogo da Andreina não tem veículo nem colaborador de outra base', async () => {
    const resposta = await pedir('/api/documentos/catalogo', { headers: { cookie: andreina } })
    expect(resposta.status).toBe(200)
    const dela = (await resposta.json()) as Catalogo
    // O vazamento entrava por aqui, e nao pela lista: ela nao via o documento de
    // Imperatriz e via a placa dos 7 veiculos de la no proprio select.
    expect(dela.bases.map((item) => item.nome)).toEqual(['Raposa'])
    expect(dela.veiculos.map((item) => item.baseId)).not.toContain(baseImperatriz.id)
    expect(dela.colaboradores.map((item) => item.baseId)).not.toContain(baseImperatriz.id)
    // E o cadastro da base dela continua chegando inteiro.
    expect(dela.veiculos.length).toBeGreaterThan(0)
    expect(dela.veiculos.map((item) => item.id)).toContain(veiculoRaposa.id)
  })

  test('a Andreina não vê na lista o documento de outra base', async () => {
    const resposta = await pedir('/api/documentos', { headers: { cookie: andreina } })
    expect(resposta.status).toBe(200)
    const dela = (await resposta.json()) as Array<{ id: string }>
    expect(dela.map((item) => item.id)).not.toContain(docImperatriz.id)
    // O acervo da base dela continua na mao dela, e a assercao e sobre um documento
    // com dono conhecido, nao sobre o tamanho da lista: `return []` no filtro reprova
    // aqui, e nao reprovava quando isto era `length > 0`.
    expect(dela.map((item) => item.id)).toContain(docRaposa.id)

    const daAdmin = (await (await pedir('/api/documentos', { headers: { cookie } })).json()) as Array<{ id: string }>
    expect(daAdmin.map((item) => item.id)).toContain(docImperatriz.id)
  })

  test('a Andreina não baixa o PDF de outra base mandando o uuid direto', async () => {
    const alheio = await pedir(`/api/documentos/${docImperatriz.id}/arquivo`, { headers: { cookie: andreina } })
    // 404, e nao 403: a resposta nao confirma que o id existe.
    expect(alheio.status).toBe(404)

    const daAdmin = await pedir(`/api/documentos/${docImperatriz.id}/arquivo`, { headers: { cookie } })
    expect(daAdmin.status).toBe(200)
  })

  test('a Andreina não grava em veículo nem em base que não são dela', async () => {
    const noVeiculo = await gravarDados(andreina, {
      tipo: 'crlv',
      titulo: 'CRLV que não é dela',
      veiculoId: veiculoImperatriz.id,
      linkExterno: 'docs/invasao.pdf',
    })
    registrar(await corpo(noVeiculo))
    expect(noVeiculo.status).toBe(403)

    const naBase = await gravarDados(andreina, {
      tipo: 'plano_pgq',
      titulo: 'PGQ que não é dela',
      baseId: baseImperatriz.id,
      linkExterno: 'docs/invasao.pdf',
    })
    registrar(await corpo(naBase))
    expect(naBase.status).toBe(403)

    // E o veiculo dela continua gravando.
    const dela = await gravarDados(andreina, {
      tipo: 'crlv',
      titulo: 'CRLV de Raposa',
      veiculoId: veiculoRaposa.id,
      linkExterno: 'docs/crlv-raposa.pdf',
    })
    registrar(await corpo(dela))
    expect(dela.status).toBe(201)
  })
})

describe('o que o documento aceita e devolve', () => {
  test('link externo com aspa não entra, nem com PDF junto', async () => {
    // A aspa fecha o `href="..."` da tela e o resto vira atributo. O CHECK do banco
    // nao barra: com arquivo junto, o primeiro disjunto dele ja basta.
    const resposta = await enviar(
      cookie,
      {
        tipo: 'crlv',
        titulo: 'CRLV de Imperatriz',
        veiculoId: veiculoImperatriz.id,
        linkExterno: 'https://drive.test/a"onmouseover=alert(document.cookie)',
      },
      new File([PDF], 'imperatriz.pdf', { type: 'application/pdf' }),
    )
    registrar(await corpo(resposta))
    expect(resposta.status).toBe(400)

    // O link legitimo continua entrando.
    const legitimo = await gravarDados(cookie, {
      tipo: 'crlv',
      titulo: 'CRLV de Imperatriz',
      veiculoId: veiculoImperatriz.id,
      linkExterno: 'https://drive.google.com/file/d/abc123/view',
    })
    registrar(await corpo(legitimo))
    expect(legitimo.status).toBe(201)
  })

  test('o download não ecoa o mime gravado e manda nosniff', async () => {
    await sql`update arquivo set mime = 'text/html' where id = ${docImperatriz.arquivoId}::uuid`
    try {
      const resposta = await pedir(`/api/documentos/${docImperatriz.id}/arquivo`, { headers: { cookie } })
      expect(resposta.status).toBe(200)
      expect(resposta.headers.get('content-type')).toBe('application/pdf')
      expect(resposta.headers.get('x-content-type-options')).toBe('nosniff')
    } finally {
      await sql`update arquivo set mime = 'application/pdf' where id = ${docImperatriz.arquivoId}::uuid`
    }
  })

  test('o tamanho anunciado é recusado antes de o corpo ser lido', async () => {
    const resposta = await pedir('/api/documentos', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'multipart/form-data; boundary=limite',
        'content-length': String(500 * 1024 * 1024),
      },
      // Corpo minusculo de proposito: o que recusa e o cabecalho, nao o que veio.
      body: '--limite--\r\n',
    })
    expect(resposta.status).toBe(413)
  })

  test('arquivo que não é PDF é recusado mesmo declarando application/pdf', async () => {
    const resposta = await enviar(
      cookie,
      { tipo: 'crlv', titulo: 'CRLV de Imperatriz', veiculoId: veiculoImperatriz.id },
      new File([new TextEncoder().encode('<script>alert(1)</script>')], 'falso.pdf', {
        type: 'application/pdf',
      }),
    )
    registrar(await corpo(resposta))
    expect(resposta.status).toBe(400)
  })

  test('PUT com tipo diferente do gravado é 404, e não cria documento novo', async () => {
    const resposta = await pedir(`/api/documentos/${docImperatriz.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'apolice',
        titulo: 'apólice colada no id do CRLV',
        veiculoId: veiculoImperatriz.id,
        // Com fonte propria: sem ela o INSERT do defeito parava antes, no 400 de
        // 'documento sem arquivo ou link', e o teste provava outra coisa.
        linkExterno: 'docs/apolice-falsa.pdf',
      }),
    })
    const salvo = registrar(await corpo(resposta))
    expect(resposta.status).toBe(404)
    expect(salvo?.id).toBeUndefined()

    const linhas = await sql`select tipo from documento where id = ${docImperatriz.id}::uuid`
    expect(linhas[0]?.tipo).toBe('crlv')
  })

  test('combinação que o CHECK do banco recusa vira 400, não 500', async () => {
    const resposta = await gravarDados(cookie, {
      tipo: 'cnh',
      titulo: 'CNH com veículo',
      colaboradorId: colaboradorRaposa.id,
      veiculoId: veiculoRaposa.id,
      linkExterno: 'docs/cnh.pdf',
    })
    registrar(await corpo(resposta))
    expect(resposta.status).toBe(400)
  })
})

describe('a faxina do PDF anterior', () => {
  test('troca de PDF que já gravou continua baixável quando a faxina falha', async () => {
    // Um veiculo de Imperatriz nao tem documento nenhum no seed, entao esta apolice
    // e so deste teste e a limpeza do fim nao encosta em dado semeado.
    const primeiro = await enviar(
      cookie,
      { tipo: 'apolice', titulo: 'Apólice da prova de faxina', veiculoId: veiculoImperatriz.id },
      new File([PDF], 'apolice.pdf', { type: 'application/pdf' }),
    )
    expect(primeiro.status).toBe(201)
    const documentoId = registrar(await corpo(primeiro))!.id!

    // Um armazenamento que guarda e le, mas recusa apagar o que nao foi ele que
    // guardou - que e o caso do PDF anterior, gravado pelo `app` compartilhado. E o
    // formato realista da falha: permissao, disco cheio, adaptador fora do ar. Apagar
    // o arquivo NOVO, esse sim, funciona, e por isso este duble mostra o estrago que
    // o rollback antigo fazia em vez de so mostrar um 500.
    const guardados = new Map<string, Uint8Array>()
    const faxinaQuebrada: ArmazenamentoArquivo = {
      async guardar(novo) {
        guardados.set(`${novo.id}.bin`, novo.conteudo)
        return { caminho: `${novo.id}.bin` }
      },
      async ler(caminho) {
        return guardados.get(caminho) ?? null
      },
      async apagar(caminho) {
        if (!guardados.has(caminho)) throw new Error('permissão negada ao apagar o arquivo antigo')
        guardados.delete(caminho)
      },
    }
    const appQuebrado = montarRotas(new Hono<Ambiente>(), { auth, db, arquivos: faxinaQuebrada })

    /** '%PDF-NOVO', para a leitura do fim dizer qual dos dois voltou. */
    const NOVO = new Uint8Array([37, 80, 68, 70, 45, 78, 79, 86, 79])
    const formulario = new FormData()
    formulario.set(
      'dados',
      JSON.stringify({ tipo: 'apolice', titulo: 'Apólice da prova de faxina', veiculoId: veiculoImperatriz.id }),
    )
    formulario.set('arquivo', new File([NOVO], 'apolice-nova.pdf', { type: 'application/pdf' }))
    const troca = await appQuebrado.request(
      new Request('http://teste.local/api/documentos', { method: 'POST', headers: { cookie }, body: formulario }),
    )
    registrar(await corpo(troca.clone()))
    // A linha do arquivo novo ja esta comitada mesmo se o POST devolver erro, e o
    // corpo de um 500 nao traz id nenhum. Sem esta busca, provar o defeito por
    // mutacao deixava um arquivo orfao no banco a cada rodada.
    const [linha] = await sql`select arquivo_id from documento where id = ${documentoId}::uuid`
    const novoArquivo = linha?.arquivo_id as string | undefined
    if (novoArquivo && !arquivos.includes(novoArquivo)) arquivos.push(novoArquivo)

    // O estado final vem antes do status de proposito, porque e ele o estrago: a
    // transacao ja fechou e a linha do documento ja aponta para o PDF novo. O
    // rollback antigo apagava justamente esse arquivo, e a lista seguia anunciando
    // `temArquivo: true` com o download em 404, sem ninguem saber. O id vem do
    // primeiro envio para esta leitura acontecer mesmo se o POST acima tiver falhado.
    const leitura = await appQuebrado.request(
      new Request(`http://teste.local/api/documentos/${documentoId}/arquivo`, { headers: { cookie } }),
    )
    expect(leitura.status).toBe(200)
    expect(new Uint8Array(await leitura.arrayBuffer())).toEqual(NOVO)
    // E o envio que gravou tem que ser anunciado como o que foi: faxina que falha nao
    // e envio que falha.
    expect(troca.status).toBe(201)
  })
})

describe('os veículos de um manual', () => {
  test('o manual continua visível para todos, sem os veículos de outra base', async () => {
    const lista = async (quem: string) =>
      (await (await pedir('/api/documentos', { headers: { cookie: quem } })).json()) as Array<{
        id: string
        tipo: string
        veiculos: string[]
      }>

    // O manual com mais veiculos, para o vazamento aparecer no maior tamanho que ele
    // tem: sao 7 veiculos de Raposa espalhados pelos 4 manuais do seed.
    const manual = (await lista(cookie))
      .filter((item) => item.tipo === 'manual')
      .sort((a, b) => b.veiculos.length - a.veiculos.length)[0]
    expect(manual?.veiculos.length).toBeGreaterThan(1)

    // Os manuais do seed so tem veiculo de Raposa. Um veiculo de Imperatriz entra
    // aqui para a prova valer nos dois sentidos: cada base ve o proprio veiculo, e so
    // ele. Sem isso, "o Lucas nao ve nada" passaria com o vinculo devolvendo `[]`.
    await sql`insert into documento_veiculo (documento_id, tipo, veiculo_id)
      values (${manual!.id}::uuid, 'manual', ${veiculoImperatriz.id}::uuid)
      on conflict do nothing`
    vinculos.push({ documentoId: manual!.id, veiculoId: veiculoImperatriz.id })

    // O Lucas e de Imperatriz. O manual nao tem base e e dele tambem; os 7 veiculos
    // de Raposa pendurados nele, nao.
    const doLucas = (await lista(lucascunha)).find((item) => item.id === manual!.id)
    expect(doLucas).toBeDefined()
    expect(doLucas?.veiculos).toEqual([veiculoImperatriz.id])

    // E a Andreina, de Raposa, continua com o parque dela dentro do mesmo manual.
    const daAndreina = (await lista(andreina)).find((item) => item.id === manual!.id)
    expect(daAndreina).toBeDefined()
    expect(daAndreina?.veiculos).not.toContain(veiculoImperatriz.id)
    expect(daAndreina?.veiculos.length).toBeGreaterThan(0)
    const catalogo = (await (await pedir('/api/documentos/catalogo', { headers: { cookie: andreina } })).json()) as Catalogo
    const dela = new Set(catalogo.veiculos.map((item) => item.id))
    expect(daAndreina?.veiculos.every((id) => dela.has(id))).toBe(true)

    // A admin ve as tres bases, entao para ela o manual tem os dois lados.
    const daAdmin = (await lista(cookie)).find((item) => item.id === manual!.id)
    expect(daAdmin?.veiculos).toContain(veiculoImperatriz.id)
    expect(daAdmin?.veiculos.length).toBeGreaterThan(daAndreina!.veiculos.length)
  })
})
