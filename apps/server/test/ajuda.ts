/**
 * O app de verdade, montado em memoria contra o banco de desenvolvimento.
 *
 * Sem porta e sem `fetch` de rede: `app.request()` entrega o `Request` ao mesmo
 * roteador que roda em producao. O que fica de fora e so o `logger()`, que o
 * `index.ts` monta e que aqui so encheria a saida do teste.
 */
import { criarAuth } from '@ind/auth'
import { criarDb, exigir } from '@ind/db'
import { Hono } from 'hono'
import { montarRotas } from '../src/app.ts'
import type { Ambiente } from '../src/portao.ts'

export const { db, sql } = criarDb()
export const auth = criarAuth(db)
export const app = montarRotas(new Hono<Ambiente>(), { auth, db })

/** O navegador anuncia navegacao de topo assim, e so ela merece 302. */
export const NAVEGACAO = { 'sec-fetch-dest': 'document' }

/** `fetch`, XHR, iframe: tudo que nao e barra de enderecos. Merece 401. */
export const CODIGO = { 'sec-fetch-dest': 'empty' }

export async function pedir(caminho: string, init: RequestInit = {}): Promise<Response> {
  return await app.request(new Request(`http://teste.local${caminho}`, init))
}

/** O cookie de sessao da Livia, para os testes que precisam estar logados. */
export async function cookieDaLivia(): Promise<string> {
  const resposta = await pedir('/api/entrar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usuario: 'livia', senha: exigir('SENHA_LIVIA') }),
  })
  if (resposta.status !== 200) {
    throw new Error(`login da livia falhou com ${resposta.status}: ${await resposta.text()}`)
  }
  const cookies = resposta.headers.getSetCookie()
  return cookies.map((c) => c.split(';')[0]).join('; ')
}
