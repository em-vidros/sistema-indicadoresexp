/**
 * As duas listas de caminhos da SPA tem que ser a mesma.
 *
 * O servidor guarda uma copia porque a cerca de `verificar/fronteiras.ts` recusa a raiz de
 * composicao importando de `apps/web`. Copia sem prova diverge: um caminho novo entraria
 * na tabela de rotas do navegador, e o servidor devolveria 404 para quem abrisse a URL
 * direto ou recarregasse a pagina. Este teste e a prova, e ele mora em `test/` porque a
 * cerca so olha `src/`.
 */
import { describe, expect, test } from 'bun:test'
import { CAMINHOS } from '../../web/src/app/caminhos.ts'
import { CAMINHOS_DA_SPA } from '../src/caminhos.ts'

describe('a copia do servidor e a lista do navegador', () => {
  test('cobrem os mesmos caminhos, na mesma ordem', () => {
    expect(CAMINHOS_DA_SPA).toEqual([...CAMINHOS])
  })
})
