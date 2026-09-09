/**
 * O cache de dados da SPA: uma chave, uma busca, um valor guardado.
 *
 * Com uma casca so, trocar de tela nao recarrega mais a pagina, e sem cache cada volta a
 * Viagens refaria `GET /api/registros` inteiro. O que este arquivo entrega e a resposta
 * guardada de imediato e a busca de novo em segundo plano quando ela ja passou de
 * `REVALIDAR_APOS`.
 *
 * O estado e uma uniao e nao um par de booleanos. Com o par, "carregando e com erro" e
 * "ok sem dados" compilam, e quem le a tela nao tem como saber que nao acontecem. Aqui so
 * `ok` garante `dados`, e `erro` carrega o que ja tinha chegado antes de a conexao cair,
 * que e o que deixa a tela de pe em vez de piscar vazia.
 *
 * Os hooks se inscrevem por `useSyncExternalStore`, entao a foto de cada chave precisa ser
 * o mesmo objeto enquanto nada muda; e por isso que `Entrada` guarda `instantaneo` em vez
 * de monta-lo a cada leitura.
 */
import { useEffect, useSyncExternalStore } from 'react'

/** Depois disto, uma leitura ainda entrega o valor guardado e dispara a busca de novo. */
const REVALIDAR_APOS = 15_000

/** `em` e o instante em que a resposta chegou, para a tela poder dizer de quando ela e. */
type Instantaneo<T> =
  | { readonly estado: 'carregando'; readonly dados: null; readonly em: null }
  | { readonly estado: 'ok'; readonly dados: T; readonly em: number }
  | { readonly estado: 'erro'; readonly dados: T | null; readonly em: number | null }

export type Recurso<T> = Instantaneo<T> & { readonly recarregar: () => void }

type Entrada = {
  /** A busca em voo, para duas telas pedindo a mesma chave nao virarem dois pedidos. */
  promessa: Promise<unknown> | null
  guardado: { readonly valor: unknown; readonly em: number } | null
  erro: boolean
  /** A ultima busca vista para esta chave, para `invalidar` saber como refazer. */
  buscar: (() => Promise<unknown>) | null
  instantaneo: Instantaneo<unknown>
  ouvintes: Set<() => void>
}

const ENTRADAS = new Map<string, Entrada>()

function entradaDe(chave: string): Entrada {
  const existente = ENTRADAS.get(chave)
  if (existente !== undefined) return existente
  const nova: Entrada = {
    promessa: null,
    guardado: null,
    erro: false,
    buscar: null,
    instantaneo: { estado: 'carregando', dados: null, em: null },
    ouvintes: new Set(),
  }
  ENTRADAS.set(chave, nova)
  return nova
}

/** Erro na frente do valor: dado velho com a conexao caida ainda e conexao caida. */
function refazer(entrada: Entrada): void {
  entrada.instantaneo = entrada.erro
    ? { estado: 'erro', dados: entrada.guardado?.valor ?? null, em: entrada.guardado?.em ?? null }
    : entrada.guardado === null
      ? { estado: 'carregando', dados: null, em: null }
      : { estado: 'ok', dados: entrada.guardado.valor, em: entrada.guardado.em }
  for (const ouvinte of entrada.ouvintes) ouvinte()
}

function buscarAgora<T>(entrada: Entrada, buscar: () => Promise<T>): Promise<T> {
  const promessa = buscar().then(
    (valor) => {
      if (entrada.promessa === promessa) {
        entrada.promessa = null
        entrada.guardado = { valor, em: Date.now() }
        entrada.erro = false
        refazer(entrada)
      }
      return valor
    },
    (motivo: unknown) => {
      if (entrada.promessa === promessa) {
        entrada.promessa = null
        entrada.erro = true
        refazer(entrada)
      }
      throw motivo
    },
  )
  entrada.promessa = promessa
  return promessa
}

function velho(guardado: { readonly em: number }): boolean {
  return Date.now() - guardado.em >= REVALIDAR_APOS
}

/**
 * O valor desta chave. Entrega o guardado quando ele existe e ainda esta novo, aproveita a
 * busca em voo quando ha uma, e so entao pede de novo.
 */
export function recurso<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const entrada = entradaDe(chave)
  entrada.buscar = buscar as () => Promise<unknown>
  if (entrada.promessa !== null) return entrada.promessa as Promise<T>
  if (entrada.guardado !== null && !velho(entrada.guardado)) {
    return Promise.resolve(entrada.guardado.valor as T)
  }
  return buscarAgora(entrada, buscar)
}

/** Busca sem montar nada, para o clique chegar com a resposta ja no cache. */
export function prefetchar<T>(chave: string, buscar: () => Promise<T>): void {
  void recurso(chave, buscar).catch(() => {})
}

/**
 * Joga fora o que estava guardado nas chaves com este prefixo. Quem estiver montado busca
 * de novo na hora; o resto sai do mapa e volta a existir na proxima leitura.
 */
export function invalidar(prefixo: string): void {
  for (const [chave, entrada] of ENTRADAS) {
    if (!chave.startsWith(prefixo)) continue
    entrada.guardado = null
    entrada.erro = false
    if (entrada.ouvintes.size === 0 && entrada.promessa === null) {
      ENTRADAS.delete(chave)
      continue
    }
    refazer(entrada)
    if (entrada.buscar !== null) void buscarAgora(entrada, entrada.buscar).catch(() => {})
  }
}

export function useRecurso<T>(chave: string, buscar: () => Promise<T>): Recurso<T> {
  const instantaneo = useSyncExternalStore(
    (avisar) => {
      const entrada = entradaDe(chave)
      entrada.ouvintes.add(avisar)
      return () => entrada.ouvintes.delete(avisar)
    },
    () => entradaDe(chave).instantaneo as Instantaneo<T>,
  )

  // So a chave manda. `buscar` costuma ser uma funcao nova a cada render, e po-la nas
  // dependencias transformaria cada render num pedido.
  useEffect(() => {
    void recurso(chave, buscar).catch(() => {})
  }, [chave])

  const recarregar = (): void => {
    const entrada = entradaDe(chave)
    if (entrada.promessa === null) void buscarAgora(entrada, buscar).catch(() => {})
  }

  return { ...instantaneo, recarregar }
}

/** O que `GET /api/sessao` devolve. A forma esta em `packages/db/src/consultas/sessao.ts`. */
export type Sessao = {
  readonly usuarioId: string
  readonly usuario: string
  readonly nome: string
  readonly admin: boolean
  readonly baseFixa: string | null
  readonly bases: readonly string[]
  readonly tipos: readonly string[]
}

async function lerSessao(): Promise<Sessao> {
  const resposta = await fetch('/api/sessao')
  if (!resposta.ok) throw new Error(`sessao recusada com ${resposta.status}`)
  return (await resposta.json()) as Sessao
}

export function useSessao(): Recurso<Sessao> {
  return useRecurso('sessao', lerSessao)
}
