/**
 * O que a tela de usuarios fala com `/api/usuarios`.
 *
 * O outro lado do convite, `/api/convite`, nao esta aqui: quem fala com ele e a tela de
 * login, e ela nao importa modulo nenhum de `js/` porque tudo que ela carrega tem que
 * passar pelo portao sem cookie. As duas chamadas de la sao dois `fetch` escritos na
 * propria `entrar.tsx`, como o `/api/entrar` que ja mora la.
 *
 * Os tipos sao redigitados aqui, como em `cadastro-api.ts`, e pelo mesmo motivo: o que
 * atravessa a rede e JSON, e o front nao conhece o pacote de persistencia. O preco e que
 * nada compara as duas copias, e o teste ao lado prende caminho, metodo e corpo.
 *
 * `Posto` e uma uniao e nao um par de campos soltos porque o banco escreve esse invariante
 * num CHECK: admin sem base fixa, gestor e operador com uma. Solto, a tela conseguiria
 * montar o pedido que o servidor recusa com 400, e a recusa chegaria depois do clique em
 * vez de antes. Sendo uniao, o admin nao tem `baseFixa` para mandar.
 *
 * O POST omite `baseFixa` do admin e o PUT manda `null` nele. Nao e capricho: no POST o
 * contrato diz que o campo e proibido para admin, e no PUT ele e a mudanca em si, porque
 * promover alguem a admin sem zerar a base deixaria os dois em desacordo.
 *
 * O `url` do convite chega relativo, e sai daqui relativo. Quem monta o link absoluto e a
 * tela, que sabe de que origem a pessoa esta olhando; um modulo de rede nao tem por que
 * ler `window.location`.
 */
export type Papel = 'admin' | 'gestor' | 'operador'

/** O par papel e base fixa, do jeito que o CHECK do banco escreve. */
export type Posto =
  | { readonly papel: 'admin' }
  | { readonly papel: 'gestor' | 'operador'; readonly baseFixa: string }

export type UsuarioListado = {
  usuario: string
  nome: string
  papel: Papel
  baseFixa: string | null
  bases: string[]
  tipos: string[]
  /** Falso enquanto a pessoa nao abriu o link de primeiro acesso. */
  senhaDefinida: boolean
  /** Ha um convite valido e ainda nao usado. */
  conviteAberto: boolean
}

export type Convite = {
  /** Relativo, na forma `/entrar.html?convite=<token>`. */
  url: string
  expiraEm: string
}

export type NovoUsuario = Posto & {
  /** Minusculo e sem `@`: o servidor completa com o dominio. */
  readonly usuario: string
  readonly nome: string
  readonly bases: readonly string[]
  readonly tipos: readonly string[]
}

/** Uma linha do PUT. Campo ausente quer dizer "nao mexe nisto". */
export type MudancaDeUsuario = {
  readonly usuario: string
  readonly nome: string
  readonly senha?: string
  readonly papel?: Papel
  readonly baseFixa?: string | null
  readonly bases?: readonly string[]
  readonly tipos?: readonly string[]
}

/** O status viaja junto porque 409 e erro de campo e 400 e recusa de regra. */
export class FalhaDeUsuarios extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

type Chamar = typeof fetch

async function recusa(resposta: Response): Promise<FalhaDeUsuarios> {
  const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
  return new FalhaDeUsuarios(falha?.erro ?? `pedido recusado com ${resposta.status}`, resposta.status)
}

async function pedirJson<T>(caminho: string, init: RequestInit, chamar: Chamar): Promise<T> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) throw await recusa(resposta)
  return (await resposta.json()) as T
}

/** Para quem so precisa saber que deu certo. O corpo da resposta nao e lido. */
async function pedirSemCorpo(caminho: string, init: RequestInit, chamar: Chamar): Promise<void> {
  const resposta = await chamar(caminho, init)
  if (!resposta.ok) throw await recusa(resposta)
}

function comJson(metodo: string, corpo: unknown): RequestInit {
  return { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }
}

export async function listarUsuarios(chamar: Chamar = fetch): Promise<readonly UsuarioListado[]> {
  return await pedirJson('/api/usuarios', {}, chamar)
}

/** Cria sem senha. Quem escolhe a senha e a propria pessoa, pelo link que volta daqui. */
export async function criarUsuario(
  novo: NovoUsuario,
  chamar: Chamar = fetch,
): Promise<{ usuario: string; convite: Convite }> {
  return await pedirJson('/api/usuarios', comJson('POST', novo), chamar)
}

/** As mudancas entram numa transacao so, entao ou todas valem ou nenhuma vale. */
export async function salvarUsuarios(
  mudancas: readonly MudancaDeUsuario[],
  chamar: Chamar = fetch,
): Promise<void> {
  await pedirSemCorpo('/api/usuarios', comJson('PUT', mudancas), chamar)
}

/** Um link novo para quem perdeu o dele. O anterior deixa de valer. */
export async function gerarConvite(login: string, chamar: Chamar = fetch): Promise<Convite> {
  const resposta = await pedirJson<{ convite: Convite }>(
    `/api/usuarios/${encodeURIComponent(login)}/convite`,
    { method: 'POST' },
    chamar,
  )
  return resposta.convite
}

/**
 * O servidor recusa apagar a si mesmo e o ultimo admin, e a recusa chega como mensagem
 * dele. A tela mostra o que voltou em vez de adivinhar qual dos dois casos era.
 */
export async function apagarUsuario(login: string, chamar: Chamar = fetch): Promise<void> {
  await pedirSemCorpo(`/api/usuarios/${encodeURIComponent(login)}`, { method: 'DELETE' }, chamar)
}
