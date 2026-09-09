/**
 * A navegacao da SPA, em cima da History API.
 *
 * A URL continua sendo a memoria do app. `useLocalizacao` le `pathname` e `search` de
 * `window.location`, e nao ha copia do estado da rota em React: quem navega escreve o
 * historico e avisa, e quem le sempre le a mesma fonte. E por isso que o botao voltar do
 * navegador nao precisa de tratamento proprio alem do `popstate`.
 *
 * `Ligacao` e um `<a href>` de verdade, com o caminho certo dentro. Ela so intercepta o
 * clique simples e sem modificador; abrir em aba nova, salvar o link ou clicar com o botao
 * do meio continuam sendo o que o navegador faz com um link, que e o que uma `<div
 * onClick>` perde em silencio.
 */
import { useSyncExternalStore } from 'react'
import type { AnchorHTMLAttributes, JSX, MouseEvent, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ROTAS } from './rotas.ts'

export type Localizacao = { readonly caminho: string; readonly busca: string }

/**
 * A foto atual. Ela e o mesmo objeto enquanto a URL nao muda, porque `useSyncExternalStore`
 * compara por identidade e refazer o objeto a cada leitura seria um render sem fim.
 */
let atual: Localizacao = { caminho: window.location.pathname, busca: window.location.search }

const ouvintes = new Set<() => void>()

function publicar(): void {
  const { pathname, search } = window.location
  if (pathname === atual.caminho && search === atual.busca) return
  atual = { caminho: pathname, busca: search }
  for (const ouvinte of ouvintes) ouvinte()
}

window.addEventListener('popstate', publicar)

export function useLocalizacao(): Localizacao {
  return useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar)
      return () => ouvintes.delete(avisar)
    },
    () => atual,
  )
}

/** O que o navegador expoe quando ele sabe animar a troca. Nem todos sabem. */
type ComTransicao = Document & {
  readonly startViewTransition?: (acao: () => void) => { readonly finished: Promise<void> }
}

function animada(): boolean {
  const documento = document as ComTransicao
  if (typeof documento.startViewTransition !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A troca do painel, dentro de uma transicao de view quando da. O `flushSync` esta aqui
 * porque a transicao fotografa o DOM antes e depois do retorno do callback: sem ele o
 * React agendaria o render para depois, e as duas fotos sairiam iguais.
 */
function trocar(acao: () => void): void {
  const documento = document as ComTransicao
  if (!animada() || documento.startViewTransition === undefined) {
    acao()
    return
  }
  documento.startViewTransition(() => {
    flushSync(acao)
  })
}

export function navegar(url: string, { substituir = false }: { substituir?: boolean } = {}): void {
  const alvo = new URL(url, window.location.href)
  const destino = alvo.pathname + alvo.search
  if (alvo.pathname === atual.caminho && alvo.search === atual.busca) return
  trocar(() => {
    if (substituir) window.history.replaceState(null, '', destino)
    else window.history.pushState(null, '', destino)
    publicar()
  })
  // Tela nova comeca do topo. Sem isto, sair do fim de uma tabela longa abre a proxima
  // tela no meio dela, que e a diferenca mais visivel entre navegar e recarregar.
  if (!substituir) window.scrollTo(0, 0)
}

/** Traz o pedaco de JavaScript da rota antes de alguem clicar nela. */
export function prefetchar(id: string): void {
  const rota = ROTAS.find((r) => r.id === id)
  if (rota === undefined) return
  void rota.carregar().catch(() => {})
}

/** Clique que o navegador tem que tratar sozinho: outra aba, download, outro botao. */
function doNavegador(evento: MouseEvent<HTMLAnchorElement>): boolean {
  return evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey
}

export type LigacaoProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  readonly para: string
  readonly children: ReactNode
}

/** Link para fora do site sai daqui como link comum: `pushState` para outra origem estoura. */
function daCasa(para: string): boolean {
  return new URL(para, window.location.href).origin === window.location.origin
}

export function Ligacao({ para, children, onClick, ...resto }: LigacaoProps): JSX.Element {
  return (
    <a
      {...resto}
      href={para}
      onClick={(evento) => {
        onClick?.(evento)
        if (evento.defaultPrevented || doNavegador(evento) || !daCasa(para)) return
        evento.preventDefault()
        navegar(para)
      }}
    >
      {children}
    </a>
  )
}
