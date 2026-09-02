/**
 * Raiz de composicao. E o unico lugar que cria a instancia do banco e a do
 * better-auth e as liga; o resto do servidor recebe as duas prontas e nao sabe de
 * onde vieram.
 *
 * O `logger()` fica aqui, e nao em `montarRotas`, porque escrever no stdout e do
 * processo que roda, nao do app: o teste monta as mesmas rotas sem ele.
 *
 * Quem abre a porta e `server.ts`, na raiz do repositorio. A separacao existe por
 * causa da Vercel, que detecta o servidor pela chamada de `Bun.serve()` no modulo de
 * entrada e so procura por ela na raiz ou em `src/`. Deixar o `Bun.serve` aqui
 * significaria um entrypoint para producao e outro para o desenvolvimento, e a
 * diferenca entre os dois so apareceria depois de publicar.
 */
import { criarAuth } from '@ind/auth'
import { criarDb } from '@ind/db'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { montarRotas } from './app.ts'
import type { Ambiente } from './portao.ts'
import { armazenamentoDoAmbiente } from './armazenamento.ts'

export function criarApp(): Hono<Ambiente> {
  const { db } = criarDb()
  const auth = criarAuth(db)
  const arquivos = armazenamentoDoAmbiente()

  const app = new Hono<Ambiente>()
  app.use('*', logger())
  montarRotas(app, { auth, db, arquivos })
  return app
}
