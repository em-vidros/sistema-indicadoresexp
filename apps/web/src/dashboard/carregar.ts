/**
 * A unica chamada que as telas do painel fazem ao carregar: `GET /api/registros`.
 *
 * O estado da sincronia e uma uniao e nao um par `{ texto, cor }`. Com o par, "carregando
 * em verde" e "sincronizado sem hora" compilam, e quem le a tela nao tem como saber que
 * nao acontecem. Aqui cada estado carrega exatamente o que ele tem: so `ok` tem hora, so
 * `offline` diz que o numero na tela nao veio de agora.
 *
 * Cair para `offline` nao apaga o que ja foi carregado. A copia guardada no navegador nao
 * existe mais desde a fase 4; o que sobra e a copia desta aba, e ela fica de pe.
 */
import { useEffect, useState } from 'react'
import { listarRegistros } from '../js/registros-api.ts'
import { lerItem } from './dominio.ts'
import type { Item } from './dominio.ts'

export type Sincronia =
  | { readonly estado: 'carregando' }
  /** Hora local em `HH:MM`, do momento em que a resposta chegou. */
  | { readonly estado: 'ok'; readonly quando: string }
  | { readonly estado: 'offline' }

export function useRegistros(): { readonly itens: readonly Item[]; readonly sincronia: Sincronia } {
  const [itens, setItens] = useState<readonly Item[]>([])
  const [sincronia, setSincronia] = useState<Sincronia>({ estado: 'carregando' })

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const registros = await listarRegistros()
        if (!vivo) return
        setItens(registros.map(lerItem))
        setSincronia({
          estado: 'ok',
          quando: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        })
      } catch {
        if (vivo) setSincronia({ estado: 'offline' })
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  return { itens, sincronia }
}
