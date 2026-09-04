/**
 * O entrypoint, aqui e na Vercel.
 *
 * A Vercel descobre o servidor pela chamada de `Bun.serve()` durante a carga do
 * modulo, e o preset dela procura esse arquivo em `server.ts` na raiz do projeto ou
 * em `src/server.ts`. Dai o arquivo estar na raiz de um monorepo cujo servidor mora
 * em `apps/server`: o nome e o lugar sao contrato com a plataforma, e o conteudo e
 * so a ligacao.
 *
 * `port` vale so aqui. Na funcao a plataforma escolhe a porta e ignora esta. E a
 * porta sai de `process.env` cru, e nao do `opcional()` de `@ind/db`, porque este
 * arquivo mora na raiz do monorepo, onde `@ind/db` nao resolve: os pacotes da casa
 * so estao linkados dentro de `apps/` e `packages/`. O `bun server.ts` ja carrega o
 * `.env` da raiz sozinho, entao nao ha o que substituir.
 */
import { criarApp } from './apps/server/src/index.ts'

const app = criarApp()

const porta = Number(process.env['PORTA_SERVIDOR'] ?? 3200)

try {
  const servidor = Bun.serve({
    port: porta,
    fetch: app.fetch,
  })
  console.log(`Servidor ouvindo em http://localhost:${servidor.port}`)
} catch (erro) {
  const codigo = (erro as NodeJS.ErrnoException)?.code
  if (codigo === 'EADDRINUSE') {
    console.error(
      `A porta ${porta} ja esta em uso. Outro 'bun dev' rodando? Liste com 'lsof -i :${porta}' e encerre com 'kill <PID>'.`,
    )
    process.exit(1)
  }
  throw erro
}
