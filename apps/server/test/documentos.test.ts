/**
 * A pasta `docs/` guarda duas coisas: o que a frota le e o que ela nao deve ler.
 * Estes testes cobrem as duas barreiras que separam as duas, uma de cada vez.
 */
import { describe, expect, test } from 'bun:test'
import { opcional } from '@ind/db'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { relative, resolve } from 'node:path'
import { dentroDe } from '../src/arquivos.ts'
import { cookieDaLivia, pedir } from './ajuda.ts'

const RAIZ = resolve('/tmp/docs')

/** A mesma raiz que `documentos.ts` calcula, do mesmo jeito e do mesmo env. */
const PADRAO_DOCS = new URL('../../../docs/', import.meta.url).pathname
const RAIZ_DOCS = resolve(opcional('DOCS_DIR', PADRAO_DOCS).trim() || PADRAO_DOCS)

describe('a contencao de caminho, sozinha', () => {
  test('nome simples fica dentro', () => {
    expect(dentroDe(RAIZ, 'apolice-PTV0006.pdf')).toBe(`${RAIZ}/apolice-PTV0006.pdf`)
  })

  test('subpasta fica dentro', () => {
    expect(dentroDe(RAIZ, 'planos/app-funcional.md')).toBe(`${RAIZ}/planos/app-funcional.md`)
  })

  test.each([['../.env'], ['../../etc/passwd'], ['planos/../../.env'], ['..'], ['a/b/../../../fora.pdf']])(
    '%s escapa e e recusado',
    (relativo) => {
      expect(dentroDe(RAIZ, relativo)).toBeNull()
    },
  )

  test('caminho absoluto nao vence a raiz', () => {
    expect(dentroDe(RAIZ, '/etc/passwd')).toBe(`${RAIZ}/etc/passwd`)
  })

  test('sobe e volta para dentro continua valendo', () => {
    expect(dentroDe(RAIZ, 'planos/../apolice-PTV0006.pdf')).toBe(`${RAIZ}/apolice-PTV0006.pdf`)
  })
})

describe('a rota, com sessao valida', () => {
  test('o PDF sai com o tipo certo e inline, porque o iframe o abre', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/docs/apolice-PTV0006.pdf', { headers: { cookie } })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toBe('application/pdf')
    expect(resposta.headers.get('content-disposition')).toBe('inline; filename="apolice-PTV0006.pdf"')
  })

  test('os planos em markdown nao saem pela rota', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/docs/planos/app-funcional.md', { headers: { cookie } })
    expect(resposta.status).toBe(404)
    expect(await resposta.text()).not.toContain('fase')
  })

  /**
   * Rotulo honesto: estes cinco nao exercitam contencao nenhuma. O parser de `URL`
   * come `%2e%2e` junto com `..`, entao o pedido chega a rota ja normalizado para
   * fora de `/docs/`, e quem devolve 404 e o teste de prefixo, na primeira linha do
   * handler. Vale como prova de que caminho normalizado nao volta a entrar; nao
   * vale como prova de que a pasta esta fechada.
   */
  test.each([
    '/docs/%2e%2e/.env',
    '/docs/%2e%2e/%2e%2e/.env',
    '/docs/%2e%2e/.env.pdf',
    '/docs/planos/%2e%2e/%2e%2e/package.json',
    '/docs/../.env',
  ])('%s ja chega normalizado para fora de /docs/, e o prefixo o recusa', async (caminho) => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir(caminho, { headers: { cookie } })
    expect(resposta.status).toBe(404)
  })

  // Este sobrevive a normalizacao, porque `%2e%2e%2f.env` nao e um segmento `..`
  // para o parser. Mas tambem nao chega a contencao: sem extensao, a lista de
  // permitidas para antes.
  test('/docs/%2e%2e%2f.env passa do prefixo e para na lista de extensoes', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/docs/%2e%2e%2f.env', { headers: { cookie } })
    expect(resposta.status).toBe(404)
  })

  /**
   * A contencao, finalmente exercitada. Um `.pdf` de verdade fora da pasta, e um
   * caminho que passa pelo prefixo `/docs/`, passa pela lista de extensoes e chega
   * inteiro ao `dentroDe` com um `..` valido. E o unico teste desta rota em que
   * apagar a checagem de contencao entrega o arquivo com 200.
   */
  test('caminho que sai da pasta nao entrega o arquivo de fora, mesmo sendo .pdf', async () => {
    const cookie = await cookieDaLivia()
    const MARCA = 'conteudo-que-nao-pode-sair-pela-rota'
    const fora = resolve(tmpdir(), `fora-do-docs-${crypto.randomUUID()}.pdf`)
    await Bun.write(fora, `%PDF-1.4 ${MARCA}`)
    try {
      // `..%2f` atravessa a normalizacao do parser de URL e so vira `../` no
      // `decodeURIComponent` da rota. O caminho e calculado, e nao escrito: quantos
      // `..` sao precisos depende de onde a pasta esta.
      const escape = relative(RAIZ_DOCS, fora).replaceAll('/', '%2f')
      const resposta = await pedir(`/docs/${escape}`, { headers: { cookie } })
      expect(resposta.status).toBe(404)
      expect(await resposta.text()).not.toContain(MARCA)
    } finally {
      await unlink(fora)
    }
  })
})
