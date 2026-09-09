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
  '/usuarios',
]

/**
 * Os `.html` das dez telas de antes da SPA, um por caminho novo.
 *
 * Nenhum arquivo daqui existe mais no `dist/`. O que sobrevive e o link guardado nos
 * favoritos de alguem, e o `destino` que uma sessao antiga ainda carrega na query da
 * login; os dois chegam aqui e saem com 302 para a tela certa.
 */
export const REDIRECIONADOS: Readonly<Record<string, string>> = {
  '/dashboard-semanal.html': '/visao-geral',
  '/viagens.html': '/viagens',
  '/rotas.html': '/rotas',
  '/frota.html': '/frota',
  '/formulario-registro.html': '/registrar',
  '/manutencao-frota.html': '/manutencao',
  '/documentos-frota.html': '/documentos',
  '/ata-reuniao.html': '/atas',
  '/integracao-frota.html': '/integracoes',
}
