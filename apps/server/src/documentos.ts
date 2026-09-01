/**
 * As apolices, os manuais e os discos de tacografo, que ate agora baixavam de um
 * site estatico sem pedir nada a ninguem.
 *
 * A pasta e a mesma `docs/` da raiz do repositorio, e ela guarda duas coisas de
 * naturezas diferentes: os PDFs, que a frota le, e `docs/planos/`, que sao os
 * documentos de planejamento em markdown e nao podem sair por aqui. Quem derruba
 * `.md` e a lista de extensoes, e ela e a barreira que faz esse trabalho.
 */
import { basename, resolve } from 'node:path'
import { opcional } from '@ind/db'
import type { Handler } from 'hono'
import { caminhoPedido, dentroDe, extensaoDe, tipoDe } from './arquivos.ts'
import type { Ambiente } from './portao.ts'

const PADRAO = new URL('../../../docs/', import.meta.url).pathname

// `opcional` so cai no padrao quando a chave nao existe. Um `DOCS_DIR=` vazio no
// .env passaria por ele e resolveria para o cwd, servindo o repositorio inteiro.
const RAIZ = resolve(opcional('DOCS_DIR', PADRAO).trim() || PADRAO)

const PREFIXO = '/docs/'

/** O que a frota abre. Markdown, YAML e qualquer outra coisa nao sai daqui. */
const PERMITIDAS = new Set(['.pdf', '.svg'])

export const documentos: Handler<Ambiente> = async (c) => {
  const pedido = caminhoPedido(c.req.url)
  if (pedido === null || !pedido.startsWith(PREFIXO)) return c.notFound()

  const extensao = extensaoDe(pedido)
  if (!PERMITIDAS.has(extensao)) return c.notFound()

  // Travessia normal nao chega aqui: `caminhoPedido` le o caminho de
  // `new URL(...).pathname`, e o parser de URL ja resolveu `..`, `%2e%2e` e as
  // outras grafias antes de a string existir. `dentroDe` e a rede embaixo, para o
  // dia em que a origem do caminho mudar e para o `..` que so aparece depois de uma
  // segunda decodificacao, que e exatamente a que `caminhoPedido` nao faz.
  const alvo = dentroDe(RAIZ, pedido.slice(PREFIXO.length))
  if (alvo === null) return c.notFound()

  const arquivo = Bun.file(alvo)
  if (!(await arquivo.exists())) return c.notFound()

  const cabecalhos: Record<string, string> = { 'content-type': tipoDe(extensao) }
  if (extensao === '.pdf') {
    // `documentos-frota.html` abre o PDF num iframe e tambem em aba nova. Sem
    // `inline` o navegador baixa o arquivo e o iframe fica em branco.
    // As aspas do proprio nome quebrariam o cabecalho, entao elas caem.
    cabecalhos['content-disposition'] = `inline; filename="${basename(alvo).replace(/["\\\r\n]/g, '')}"`
  }
  return new Response(arquivo, { headers: cabecalhos })
}
