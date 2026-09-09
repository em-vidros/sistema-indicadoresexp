/**
 * O que sai de `apps/web/dist/`: a casca da SPA, as seis telas legadas e os assets.
 *
 * Os dez caminhos da SPA recebem o mesmo `app.html`, e quem decide o que desenhar e o
 * roteador do navegador. Os `.html` das quatro telas do painel viraram esses caminhos e
 * saem daqui como 302, porque as seis telas legadas ainda linkam para eles.
 *
 * Fora isso nao ha reescrita esperta. `/` vai para `PAGINA_PADRAO`, que era o que o
 * `_redirects` do Netlify fazia, e caminho sem extensao tenta o `.html` de mesmo nome. O
 * resto e 404, que e resposta legitima: inventar fallback para a casca transformaria erro
 * de link em pagina errada servida com 200.
 */
import type { Handler } from 'hono'
import { caminhoPedido, dentroDe, extensaoDe, pastaDeConteudo, tipoDe } from './arquivos.ts'
import { CAMINHOS_DA_SPA, REDIRECIONADOS } from './caminhos.ts'
import { PUBLICOS_DE_ASSET, type Ambiente } from './portao.ts'

const RAIZ = pastaDeConteudo('apps/web/dist', new URL('../../web/dist/', import.meta.url))

const DA_SPA = new Set(CAMINHOS_DA_SPA)

/** Os quatro nomes fixos do build, que a tela de login carrega antes de existir sessao. */
const SEM_HASH = new Set(PUBLICOS_DE_ASSET)

/**
 * O nome dentro de `/assets/` carrega o hash do conteudo, entao ele nunca serve conteudo
 * diferente e pode ficar guardado para sempre. As excecoes sao os quatro sem hash, cujo
 * nome e estavel e cujo conteudo muda a cada build. `verificar/publicos.ts` prova que esses
 * quatro sao exatamente os que o portao libera, entao a lista nao anda por conta propria.
 */
function cacheDe(caminho: string, extensao: string): string {
  if (extensao === '.html') return 'no-cache'
  if (caminho.startsWith('/assets/') && !SEM_HASH.has(caminho)) {
    return 'public, max-age=31536000, immutable'
  }
  return 'no-cache'
}

async function servir(caminho: string, arquivo: string, extensao: string): Promise<Response | null> {
  const conteudo = Bun.file(arquivo)
  if (!(await conteudo.exists())) return null
  return new Response(conteudo, {
    headers: {
      'content-type': tipoDe(extensao),
      'cache-control': cacheDe(caminho, extensao),
    },
  })
}

export const paginas: Handler<Ambiente> = async (c) => {
  const pedido = caminhoPedido(c.req.url)
  if (pedido === null) return c.notFound()

  const novo = REDIRECIONADOS[pedido]
  if (novo !== undefined) return c.redirect(novo + new URL(c.req.url).search, 302)

  if (DA_SPA.has(pedido)) {
    const casca = await servir(pedido, `${RAIZ}/app.html`, '.html')
    return casca ?? c.notFound()
  }

  // Como em `documentos.ts`: quem normaliza `..` e suas grafias e o parser de URL
  // dentro de `caminhoPedido`, entao esta checagem nao dispara no caminho comum.
  // Ela e a rede embaixo, e o que cobre de verdade e a dupla decodificacao.
  const alvo = dentroDe(RAIZ, pedido)
  if (alvo === null) return c.notFound()

  const extensao = extensaoDe(pedido)
  const candidato = extensao === '' ? `${alvo}.html` : alvo
  return (await servir(pedido, candidato, extensao === '' ? '.html' : extensao)) ?? c.notFound()
}
