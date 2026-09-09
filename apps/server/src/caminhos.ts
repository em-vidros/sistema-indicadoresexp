/**
 * Os caminhos da SPA, para o servidor saber a quais deles entregar o `app.html`.
 *
 * E uma copia de `apps/web/src/app/caminhos.ts`, e nao um import. A cerca de
 * `verificar/fronteiras.ts` recusa o servidor importando de `apps/web`, e com razao: a
 * raiz de composicao nao alcanca o codigo do navegador. O que impede as duas listas de
 * divergirem e `apps/server/test/caminhos.test.ts`, que le as duas e compara.
 */
export const CAMINHOS_DA_SPA: readonly string[] = [
  '/visao-geral',
  '/viagens',
  '/rotas',
  '/frota',
  '/registrar',
  '/manutencao',
  '/documentos',
  '/atas',
  '/integracoes',
  '/cadastro',
]

/**
 * Os `.html` das quatro telas do painel, que agora sao caminhos da SPA.
 *
 * As seis telas legadas linkam para `dashboard-semanal.html` no `onClick` delas, e a
 * paridade compara essas telas byte a byte contra uma baseline: mexer nelas para trocar o
 * link reprovaria tela que este trabalho nao toca. O redirecionamento resolve isso do lado
 * de ca, e ainda salva o link que alguem tenha guardado nos favoritos.
 */
export const REDIRECIONADOS: Readonly<Record<string, string>> = {
  '/dashboard-semanal.html': '/visao-geral',
  '/viagens.html': '/viagens',
  '/rotas.html': '/rotas',
  '/frota.html': '/frota',
}
