/**
 * O que sai de `apps/web/dist/`: a casca da SPA, as seis telas legadas e o guia.
 *
 * Ate agora nenhum teste pedia nada por aqui: apagar a contencao de caminho de
 * `paginas.ts` inteira deixava a suite verde. As telas em si sao pouco mais que um
 * 200, mas o `..` que sai da pasta do build serve o repositorio inteiro pela rota
 * que menos parece perigosa, porque e a que so devolve HTML.
 */
import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CAMINHOS_DA_SPA, REDIRECIONADOS } from '../src/caminhos.ts'
import { cookieDaLivia, NAVEGACAO, pedir } from './ajuda.ts'

/** A mesma raiz que `paginas.ts` calcula, e da mesma profundidade de pasta. */
const RAIZ = resolve(new URL('../../web/dist/', import.meta.url).pathname)

/**
 * A tela de login esta na lista, mas nao pede sessao: o portao manda quem ja entrou de
 * volta para `PAGINA_PADRAO` antes de `paginas` ser chamada. Ela sai por aqui para quem
 * chega sem cookie.
 */
const LOGIN = 'entrar.html'

const TELAS = ['app.html', 'entrar.html', 'GUIA-CONFIGURACAO.html']

describe('as tres cascas do build', () => {
  // Contar tres nao prova nada; prova que sao estas tres. Casca nova entra na lista de
  // proposito, e nao passa a existir sem ninguem ter escrito o nome dela. Eram onze ate
  // as dez telas virarem rotas de uma casca so, `app.html`.
  test('sao exatamente as tres que o `dist` tem', async () => {
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

/**
 * Os dez caminhos da SPA recebem a mesma casca. Sem isto, abrir `/viagens` direto na
 * barra de enderecos, ou recarregar a pagina depois de navegar, cairia em 404: o
 * roteador do navegador nunca chega a rodar.
 */
describe('os caminhos da SPA', () => {
  test.each([...CAMINHOS_DA_SPA])('%s recebe a casca do app', async (caminho) => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir(caminho, { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await resposta.text()).toContain('src="/assets/app-')
  })

  test.each(Object.entries(REDIRECIONADOS))('%s redireciona para %s', async (velho: string, novo: string) => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir(velho, { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(302)
    expect(resposta.headers.get('location')).toBe(novo)
  })

  // O filtro esta na query, e perde-lo no redirecionamento levaria quem clicou de
  // "Raposa, este mes" para "todas as bases, esta semana" sem aviso.
  test('o redirecionamento leva a query junto', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/rotas.html?base=Raposa&periodo=mes', {
      headers: { cookie, ...NAVEGACAO },
    })
    expect(resposta.headers.get('location')).toBe('/rotas?base=Raposa&periodo=mes')
  })
})

/**
 * O nome dentro de `/assets/` carrega o hash do conteudo, entao guardar para sempre e
 * seguro; o `.html` tem nome fixo e conteudo que muda a cada build, e guarda-lo entrega
 * uma casca velha apontando para assets que nao existem mais.
 */
describe('por quanto tempo o navegador pode guardar', () => {
  test('asset com hash e imutavel', async () => {
    const cookie = await cookieDaLivia()
    const casca = await pedir('/visao-geral', { headers: { cookie, ...NAVEGACAO } })
    const nome = /src="(\/assets\/app-[^"]+)"/.exec(await casca.text())?.[1]
    expect(nome).toBeDefined()
    const resposta = await pedir(nome ?? '', { headers: { cookie } })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })

  test('o asset de nome fixo da login e guardado por pouco e volta em 304 na mesma versao', async () => {
    const resposta = await pedir('/assets/entrar.js')
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('cache-control')).toBe('public, max-age=600, must-revalidate')
    const etiqueta = resposta.headers.get('etag')
    expect(etiqueta).not.toBeNull()
    const denovo = await pedir('/assets/entrar.js', { headers: { 'if-none-match': etiqueta ?? '' } })
    expect(denovo.status).toBe(304)
    expect(await denovo.text()).toBe('')
  })

  test('a casca da SPA nao e guardada', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/viagens', { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.headers.get('cache-control')).toBe('no-cache')
  })
})

describe('o que a rota resolve sozinha', () => {
  test('a raiz leva a pagina padrao, como o _redirects fazia', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/', { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.status).toBe(302)
    expect(resposta.headers.get('location')).toBe('/registrar')
  })

  test('caminho sem extensao acha o .html de mesmo nome', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/GUIA-CONFIGURACAO', { headers: { cookie, ...NAVEGACAO } })
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
    const resposta = await pedir('/qualquer%2f..%2fGUIA-CONFIGURACAO.html', {
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
