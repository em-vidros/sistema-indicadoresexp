/**
 * Raiz de composicao. E o unico lugar que cria a instancia do banco e a do
 * better-auth e as liga; o resto do servidor recebe as duas prontas e nao sabe de
 * onde vieram.
 *
 * O `logger()` fica aqui, e nao em `montarRotas`, porque escrever no stdout e do
 * processo que roda, nao do app: o teste monta as mesmas rotas sem ele.
 */
import { criarAuth } from '@ind/auth'
import { criarDb, opcional } from '@ind/db'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { montarRotas } from './app.ts'
import type { Ambiente } from './portao.ts'

const { db } = criarDb()
const auth = criarAuth(db)

const app = new Hono<Ambiente>()
app.use('*', logger())
montarRotas(app, { auth, db })

const port = Number(opcional('PORTA_SERVIDOR', '3100'))

export default { port, fetch: app.fetch }
