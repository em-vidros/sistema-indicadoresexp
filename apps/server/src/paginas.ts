import type { Handler } from 'hono'
import { resolve } from 'node:path'
import { caminhoPedido, dentroDe, extensaoDe, pastaDeConteudo, tipoDe } from './arquivos.ts'
import { CAMINHOS_DA_SPA, REDIRECIONADOS } from './caminhos.ts'
import { PUBLICOS_DE_ASSET, type Ambiente } from './portao.ts'

// `PASTA_WEB_DIST` existe para varios servidores locais lerem builds diferentes ao
// mesmo tempo, cada um de um `vp build --outDir` proprio; producao nunca a define.
const RAIZ = process.env['PASTA_WEB_DIST']
  ? resolve(process.env['PASTA_WEB_DIST'])
  : pastaDeConteudo('apps/web/dist', new URL('../../web/dist/', import.meta.url))

const DA_SPA = new Set(CAMINHOS_DA_SPA)

/** Os quatro nomes fixos do build, que a tela de login carrega antes de existir sessao. */
const SEM_HASH = new Set(PUBLICOS_DE_ASSET)

/**
 * O nome dentro de `/assets/` carrega o hash do conteudo, entao ele nunca serve conteudo
 * diferente e pode ficar guardado para sempre. As excecoes sao os sem hash, cujo nome e
 * estavel e cujo conteudo muda a cada build: eles ficam guardados por dez minutos e depois
 * voltam a perguntar, e a pergunta sai em 304 enquanto a publicacao for a mesma.
 * `verificar/publicos.ts` prova que esses sao exatamente os que o portao libera.
 */
function cacheDe(caminho: string, extensao: string): string {
  if (extensao === '.html') return 'no-cache'
  if (caminho.startsWith('/assets/') && !SEM_HASH.has(caminho)) {
    return 'public, max-age=31536000, immutable'
  }
  if (caminho.startsWith('/assets/')) return 'public, max-age=600, must-revalidate'
  return 'no-cache'
}

/**
 * A etiqueta de versao do que esta no disco. Na Vercel cada publicacao tem id proprio e o
 * conteudo do `dist/` so muda com ela; local, a hora em que o processo subiu faz o mesmo
 * papel, porque o `dist/` so muda com um build e o servidor sobe depois dele.
 */
const VERSAO = `"${process.env['VERCEL_DEPLOYMENT_ID'] ?? Date.now().toString(36)}"`

async function servir(
  caminho: string,
  arquivo: string,
  extensao: string,
  cabecalhos: Headers,
): Promise<Response | null> {
  const conteudo = Bun.file(arquivo)
  if (!(await conteudo.exists())) return null
  const comuns = {
    'cache-control': cacheDe(caminho, extensao),
    etag: VERSAO,
  }
  if (cabecalhos.get('if-none-match') === VERSAO) return new Response(null, { status: 304, headers: comuns })
  return new Response(conteudo, {
    headers: { ...comuns, 'content-type': tipoDe(extensao) },
  })
}

export const paginas: Handler<Ambiente> = async (c) => {
  const pedido = caminhoPedido(c.req.url)
  if (pedido === null) return c.notFound()

  const novo = REDIRECIONADOS[pedido]
  if (novo !== undefined) return c.redirect(novo + new URL(c.req.url).search, 302)

  if (DA_SPA.has(pedido)) {
    const casca = await servir(pedido, `${RAIZ}/app.html`, '.html', c.req.raw.headers)
    return casca ?? c.notFound()
  }

  // Como em `documentos.ts`: quem normaliza `..` e suas grafias e o parser de URL
  // dentro de `caminhoPedido`, entao esta checagem nao dispara no caminho comum.
  // Ela e a rede embaixo, e o que cobre de verdade e a dupla decodificacao.
  const alvo = dentroDe(RAIZ, pedido)
  if (alvo === null) return c.notFound()

  const extensao = extensaoDe(pedido)
  const candidato = extensao === '' ? `${alvo}.html` : alvo
  return (await servir(pedido, candidato, extensao === '' ? '.html' : extensao, c.req.raw.headers)) ?? c.notFound()
}
