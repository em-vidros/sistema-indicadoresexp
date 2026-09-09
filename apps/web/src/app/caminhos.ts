/**
 * Os caminhos da SPA, na ordem da sidebar.
 *
 * So texto, e sem import nenhum, porque a tabela de rotas em `rotas.ts` carrega icone e
 * `import()` de componente, e o servidor precisa desta lista para saber a quais caminhos
 * entregar o `app.html`. `apps/server/src/caminhos.ts` tem a copia que o servidor le, e
 * `apps/server/test/caminhos.test.ts` compara as duas.
 */
export const CAMINHOS = [
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
  '/usuarios',
] as const

export type Caminho = (typeof CAMINHOS)[number]
