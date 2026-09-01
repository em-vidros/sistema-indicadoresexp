/**
 * Raiz de composicao. E o unico lugar que conhece `@ind/core`, `@ind/db` e
 * `@ind/auth` ao mesmo tempo, e e aqui que a instancia do banco e a do better-auth
 * sao criadas e ligadas.
 *
 * Isto e o servidor da fase 0, nao o da fase 1: ele existe para o `verificar/fase-0.sh`
 * ter contra o que fazer login. Sao duas montagens, `/api/auth/*` e `/saude`, e
 * nenhuma rota de negocio.
 */
import { criarAuth } from '@ind/auth'
import { criarDb, opcional } from '@ind/db'
import { Hono } from 'hono'
import { logger } from 'hono/logger'

const { db } = criarDb()
const auth = criarAuth(db)

const app = new Hono()

app.use('*', logger())

// 200 com corpo fixo. Sem consulta ao banco: quem responde aqui e o processo, e
// misturar as duas perguntas faz o health mentir sobre qual das duas caiu.
app.get('/saude', (c) => c.json({ estado: 'ok' }))

// O better-auth responde ao Request cru; o Hono so repassa. `basePath` da instancia
// e '/api/auth', entao o prefixo aqui tem que ser o mesmo.
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

const port = Number(opcional('PORTA_SERVIDOR', '3100'))

export default { port, fetch: app.fetch }
