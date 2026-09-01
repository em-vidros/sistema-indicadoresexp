/**
 * O portao e a unica coisa entre a frota e sete telas que ate ontem eram publicas.
 * Aqui ele e provado pelo comportamento observavel, nao pela leitura do codigo.
 */
import { describe, expect, test } from 'bun:test'
import { destinoSeguro } from '../src/portao.ts'
import { CODIGO, NAVEGACAO, pedir } from './ajuda.ts'

describe('quem nao tem sessao', () => {
  test('pedindo pagina, e mandado ao login com o destino de volta', async () => {
    const resposta = await pedir('/dashboard-semanal.html?semana=32', { headers: NAVEGACAO })
    expect(resposta.status).toBe(302)
    expect(resposta.headers.get('location')).toBe(
      '/entrar.html?destino=%2Fdashboard-semanal.html%3Fsemana%3D32',
    )
  })

  test('pedindo a API, leva 401 e nao 302', async () => {
    const resposta = await pedir('/api/sessao', { headers: CODIGO })
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: 'sem sessao' })
  })

  test('pedindo PDF, leva 401', async () => {
    const resposta = await pedir('/docs/apolice-PTV0006.pdf', { headers: CODIGO })
    expect(resposta.status).toBe(401)
  })

  test('o logo continua publico, porque a tela de login o mostra', async () => {
    const resposta = await pedir('/docs/logo-emvidros.svg', { headers: CODIGO })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('image/svg+xml')
  })

  test('`/saude` continua publico', async () => {
    expect((await pedir('/saude')).status).toBe(200)
  })

  test('a tela de login e publica', async () => {
    expect((await pedir('/entrar.html', { headers: NAVEGACAO })).status).toBe(200)
  })
})

/**
 * A mesma URL, dois clientes. E o ponto todo de decidir por `Sec-Fetch-Dest` e nao
 * por prefixo: um 302 devolvido a um `fetch` chegaria ao JavaScript como 200 com o
 * HTML do login no corpo.
 */
describe('a mesma URL responde diferente conforme quem pede', () => {
  test('navegacao de topo recebe 302', async () => {
    const resposta = await pedir('/manutencao-frota.html', { headers: NAVEGACAO })
    expect(resposta.status).toBe(302)
  })

  test('o mesmo caminho, pedido por codigo, recebe 401 JSON', async () => {
    const resposta = await pedir('/manutencao-frota.html', { headers: CODIGO })
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: 'sem sessao' })
  })

  test('o iframe do visualizador de PDF nao e navegacao', async () => {
    const resposta = await pedir('/docs/apolice-PTV0006.pdf', {
      headers: { 'sec-fetch-dest': 'iframe' },
    })
    expect(resposta.status).toBe(401)
  })

  test('sem Sec-Fetch-Dest, o Accept decide', async () => {
    const html = await pedir('/ata-reuniao.html', { headers: { accept: 'text/html' } })
    expect(html.status).toBe(302)
    const json = await pedir('/ata-reuniao.html', { headers: { accept: 'application/json' } })
    expect(json.status).toBe(401)
  })
})

describe('destino vindo de fora', () => {
  test('caminho normal passa', () => {
    expect(destinoSeguro('/dashboard-semanal.html?semana=32')).toBe('/dashboard-semanal.html?semana=32')
  })

  test.each([
    ['//evil.com', 'URL relativa a esquema'],
    ['https://evil.com', 'URL absoluta'],
    ['javascript:alert(1)', 'esquema javascript'],
    ['/\\evil.com', 'barra invertida que o navegador normaliza'],
    ['dashboard-semanal.html', 'caminho relativo'],
    ['/a\nLocation: /b', 'quebra de linha para injetar cabecalho'],
    ['', 'vazio'],
    [null, 'ausente'],
  ])('%s e recusado (%s)', (bruto) => {
    expect(destinoSeguro(bruto)).toBeNull()
  })
})

describe('o destino envenenado sai da query antes de a tela carregar', () => {
  // Uma revisao derrubou a versao anterior deste teste, que esperava 200 e dizia em
  // comentario que quem recusava o destino era o script da tela. Era exatamente o
  // furo: sem sessao o servidor servia a tela e nunca olhava o destino, entao a
  // unica checagem que valia era a mais fraca das duas.
  test.each([
    ['//evil.com', 'relativo a esquema'],
    ['https://evil.com', 'absoluto'],
    ['/\tx/evil.com', 'com caractere de controle'],
    ['/\\evil.com', 'com barra invertida'],
  ])('%s e limpo da query (%s)', async (destino) => {
    const resposta = await pedir(`/entrar.html?destino=${encodeURIComponent(destino)}`, {
      headers: NAVEGACAO,
    })
    expect(resposta.status).toBe(302)
    expect(resposta.headers.get('location')).toBe('/entrar.html')
  })

  test('destino legitimo continua na query, e a tela e servida', async () => {
    const resposta = await pedir('/entrar.html?destino=%2Fdashboard-semanal.html', {
      headers: NAVEGACAO,
    })
    expect(resposta.status).toBe(200)
  })
})
