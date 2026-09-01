/**
 * As sete telas construidas, servidas de `apps/web/dist/`.
 *
 * Nao ha reescrita esperta aqui. `/` vai para o formulario, que era o que o
 * `_redirects` do Netlify fazia, e caminho sem extensao tenta o `.html` de mesmo
 * nome. O resto e 404, que e resposta legitima: inventar fallback para index
 * transformaria erro de link em pagina errada servida com 200.
 */
import { resolve } from 'node:path'
import type { Handler } from 'hono'
import { caminhoPedido, dentroDe, extensaoDe, tipoDe } from './arquivos.ts'
import type { Ambiente } from './portao.ts'

const RAIZ = resolve(new URL('../../web/dist/', import.meta.url).pathname)

export const paginas: Handler<Ambiente> = async (c) => {
  const pedido = caminhoPedido(c.req.url)
  if (pedido === null) return c.notFound()

  // Como em `documentos.ts`: quem normaliza `..` e suas grafias e o parser de URL
  // dentro de `caminhoPedido`, entao esta checagem nao dispara no caminho comum.
  // Ela e a rede embaixo, e o que cobre de verdade e a dupla decodificacao.
  const alvo = dentroDe(RAIZ, pedido)
  if (alvo === null) return c.notFound()

  const extensao = extensaoDe(pedido)
  const candidato = extensao === '' ? `${alvo}.html` : alvo
  const arquivo = Bun.file(candidato)
  if (!(await arquivo.exists())) return c.notFound()

  return new Response(arquivo, {
    headers: { 'content-type': tipoDe(extensao === '' ? '.html' : extensao) },
  })
}
