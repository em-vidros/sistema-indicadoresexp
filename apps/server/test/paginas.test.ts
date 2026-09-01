/**
 * As oito telas construidas, servidas de `apps/web/dist/`.
 *
 * Ate agora nenhum teste pedia nada por aqui: apagar a contencao de caminho de
 * `paginas.ts` inteira deixava a suite verde. As telas em si sao pouco mais que um
 * 200, mas o `..` que sai da pasta do build serve o repositorio inteiro pela rota
 * que menos parece perigosa, porque e a que so devolve HTML.
 */
import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cookieDaLivia, NAVEGACAO, pedir } from './ajuda.ts'

/** A mesma raiz que `paginas.ts` calcula, e da mesma profundidade de pasta. */
const RAIZ = resolve(new URL('../../web/dist/', import.meta.url).pathname)

/**
 * A tela de login esta na lista, mas nao pede sessao: o portao manda quem ja
 * entrou de volta para `/formulario-registro.html` antes de `paginas` ser chamada.
 * Ela sai por aqui para quem chega sem cookie.
 */
const LOGIN = 'entrar.html'

const TELAS = [
  'ata-reuniao.html',
  'dashboard-semanal.html',
  'documentos-frota.html',
  'entrar.html',
  'formulario-registro.html',
  'GUIA-CONFIGURACAO.html',
  'integracao-frota.html',
  'manutencao-frota.html',
]

describe('as oito telas do build', () => {
  // Contar oito nao prova nada; prova que sao estas oito. Tela nova entra na lista
  // de proposito, e nao passa a existir sem ninguem ter escrito o nome dela.
  test('sao exatamente as oito que o `dist` tem', async () => {
    const construidas = (await readdir(RAIZ)).filter((n) => n.endsWith('.html')).sort()
    expect(construidas).toEqual([...TELAS].sort())
  })

  test.each(TELAS.filter((t) => t !== LOGIN))('%s sai com sessao, como HTML', async (tela) => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir(`/${tela}`, { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await resposta.text()).toContain('<!DOCTYPE html>')
  })

  test(`${LOGIN} sai sem sessao, que e quem precisa dela`, async () => {
    const resposta = await pedir(`/${LOGIN}`, { headers: NAVEGACAO })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await resposta.text()).toContain('<!DOCTYPE html>')
  })
})

describe('o que a rota resolve sozinha', () => {
  test('a raiz leva ao formulario, como o _redirects fazia', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/', { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(302)
    expect(resposta.headers.get('location')).toBe('/formulario-registro.html')
  })

  test('caminho sem extensao acha o .html de mesmo nome', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/dashboard-semanal', { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await resposta.text()).toContain('<!DOCTYPE html>')
  })

  test.each(['/nao-existe.html', '/nao-existe', '/planos/app-funcional.md'])(
    '%s e 404, sem inventar pagina',
    async (caminho) => {
      const cookie = await cookieDaLivia()
      const resposta = await pedir(caminho, { headers: { cookie, ...NAVEGACAO } })
      expect(resposta.status).toBe(404)
    },
  )
})

/**
 * O que sai e o que nao sai da pasta do build.
 *
 * `..` e `%2e%2e` crus nao servem de prova: `new URL(...).pathname` normaliza os
 * dois antes de a rota ver qualquer coisa, e o pedido chega ja limpo. O que
 * atravessa a normalizacao e a barra codificada, `..%2f`, porque `..%2f..%2f` nao e
 * um segmento `..` para o parser da URL e so vira um depois do `decodeURIComponent`
 * da rota. E ai a contencao e a unica coisa entre o pedido e o arquivo.
 */
describe('sair da pasta do build', () => {
  const ESCAPE = '/..%2f..%2f..%2fpackage.json'

  // Sem isto o teste apodrece em silencio: no dia em que o alvo nao existir mais,
  // o 404 vira "nao achei" e para de significar "nao deixei sair".
  test('o alvo do escape existe mesmo, tres niveis acima do build', async () => {
    expect(await Bun.file(resolve(RAIZ, '../../../package.json')).exists()).toBe(true)
  })

  test('a barra codificada nao sai da pasta, e o alvo la fora nao vaza', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir(ESCAPE, { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(404)
    expect(await resposta.text()).not.toContain('"workspaces"')
  })

  // O par do teste acima. Sem ele, o 404 de la poderia vir do roteador nao casar a
  // rota com uma URL cheia de `%2f`, e nao da contencao. O mesmo `%2f`, quando sobe
  // e volta para dentro, entrega a tela: quem decide e a contencao.
  test('a mesma barra codificada, subindo e voltando para dentro, entrega a tela', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/qualquer%2f..%2fdashboard-semanal.html', {
      headers: { cookie, ...NAVEGACAO },
    })
    expect(resposta.status).toBe(200)
    expect(await resposta.text()).toContain('<!DOCTYPE html>')
  })

  /**
   * A dupla codificacao. `%252e%252e` so vira `..` para quem decodifica duas vezes,
   * e a segunda decodificacao aconteceria depois de a contencao ja ter passado:
   * o caminho estaria contido na hora da checagem e escaparia na hora de abrir o
   * arquivo. Uma decodificacao, uma checagem.
   */
  test.each([
    '/%252e%252e/%252e%252e/%252e%252e/package.json',
    '/%252e%252e%252fpackage.json',
    '/planos/%252e%252e/%252e%252e/package.json',
  ])('%s nao e decodificado duas vezes', async (caminho) => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir(caminho, { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(404)
    expect(await resposta.text()).not.toContain('"workspaces"')
  })
})
