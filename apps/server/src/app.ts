/**
 * A montagem das rotas, separada da criacao do banco e do better-auth.
 *
 * A separacao existe para o teste: ele monta o mesmo app contra suas proprias
 * instancias e chama `app.request(...)` sem abrir porta. Se a ordem das rotas
 * morasse no `index.ts`, o teste provaria outro app que nao o que roda.
 *
 * A ordem importa. O portao e a primeira coisa depois do que o chamador ja
 * registrou, e o `'*'` das paginas e a ultima: no Hono vence quem foi registrado
 * primeiro entre os que casam.
 */
import { Hono } from 'hono'
import { documentos } from './documentos.ts'
import { paginas } from './paginas.ts'
import { type Ambiente, PAGINA_PADRAO, portao } from './portao.ts'
import { type Dependencias, rotasSessao } from './rotas-sessao.ts'
import { rotasUsuarios } from './rotas-usuarios.ts'

export function montarRotas(app: Hono<Ambiente>, deps: Dependencias): Hono<Ambiente> {
  app.use('*', portao(deps.auth))

  // 200 com corpo fixo. Sem consulta ao banco: quem responde aqui e o processo, e
  // misturar as duas perguntas faz o health mentir sobre qual das duas caiu.
  app.get('/saude', (c) => c.json({ estado: 'ok' }))

  // O better-auth responde ao Request cru; o Hono so repassa. `basePath` da
  // instancia e '/api/auth', entao o prefixo aqui tem que ser o mesmo.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw))

  app.route('/api', rotasSessao(deps))
  app.route('/api', rotasUsuarios(deps))

  app.get('/docs/*', documentos)

  // Era o que o `_redirects` do Netlify fazia com a raiz.
  app.get('/', (c) => c.redirect(PAGINA_PADRAO, 302))

  app.get('*', paginas)

  return app
}
