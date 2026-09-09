/**
 * A unica chamada que as telas do painel fazem ao carregar: `GET /api/registros`.
 *
 * O estado da sincronia e uma uniao e nao um par `{ texto, cor }`. Com o par, "carregando
 * em verde" e "sincronizado sem hora" compilam, e quem le a tela nao tem como saber que
 * nao acontecem. Aqui cada estado carrega exatamente o que ele tem: so `ok` tem hora, so
 * `offline` diz que o numero na tela nao veio de agora.
 *
 * Quem guarda a resposta e `app/dados.ts`, sob a chave `registros`. Com a casca unica, ir
 * de Viagens a Rotas nao recarrega mais a pagina, entao as quatro telas dividem a mesma
 * copia e so quem chega depois de 15 s paga uma busca nova, em segundo plano.
 *
 * Cair para `offline` nao apaga o que ja foi carregado: a copia guardada fica de pe e a
 * tela continua mostrando o ultimo numero que chegou, dizendo que ele nao e de agora.
 */
import { useRecurso } from '../app/dados.ts'
import { listarRegistros } from '../js/registros-api.ts'
import { lerItem } from './dominio.ts'
import type { Item } from './dominio.ts'

export type Sincronia =
  | { readonly estado: 'carregando' }
  /** Hora local em `HH:MM`, do momento em que a resposta chegou. */
  | { readonly estado: 'ok'; readonly quando: string }
  | { readonly estado: 'offline' }

function hora(em: number): string {
  return new Date(em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function useRegistros(): { readonly itens: readonly Item[]; readonly sincronia: Sincronia } {
  const recurso = useRecurso('registros', listarRegistros)
  const itens = recurso.dados === null ? [] : recurso.dados.map(lerItem)
  if (recurso.estado === 'erro') return { itens, sincronia: { estado: 'offline' } }
  if (recurso.estado === 'carregando') return { itens, sincronia: { estado: 'carregando' } }
  return { itens, sincronia: { estado: 'ok', quando: hora(recurso.em) } }
}
