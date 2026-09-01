/**
 * As tres rotas de sessao que a tela usa: entrar, sair e saber quem esta logado.
 *
 * O e-mail e montado aqui, e nao no navegador. A tela pede "usuario" porque e o que
 * o operador tem na cabeca, e o dominio da casa e a rota interna do better-auth sao
 * detalhe de servidor: mudar `@emvidros.com.br` amanha nao deve exigir republicar
 * as sete telas.
 */
import type { Auth } from '@ind/auth'
import { type Db, sessaoDoUsuario } from '@ind/db'
import { type Context, Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

const DOMINIO = '@emvidros.com.br'

/**
 * O freio de tentativa do `/api/entrar`.
 *
 * O limitador do better-auth mora no `onRequest` do roteador dele e so roda quando a
 * requisicao entra por `auth.handler`. Esta rota chama `signInEmail` direto, entao
 * passa por fora dele. E ela e publica, e ate os nomes dos quatro logins ja andaram
 * escritos no HTML: o que sobra entre um estranho e o sistema e adivinhar a senha.
 *
 * O contador vive na memoria deste processo. Ele zera no restart e nao e dividido
 * com outra instancia, o que basta para o custo de uma tentativa deixar de ser zero,
 * mas nao substitui limite na borda. E o IP so vale o que o `x-forwarded-for` valer:
 * atras de proxy o cabecalho precisa vir de proxy confiavel, e decidir isso e da
 * fase 4.
 */
const JANELA_MS = 5 * 60 * 1000
const LIMITE = 10
const falhas = new Map<string, number[]>()

/** O primeiro da lista do `x-forwarded-for`, com o socket de reserva. */
function ipDe(c: Context): string {
  const encaminhado = c.req.header('x-forwarded-for')
  if (encaminhado) {
    const primeiro = encaminhado.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }
  try {
    return getConnInfo(c).remote.address ?? 'desconhecido'
  } catch {
    // Sem servidor Bun por baixo (o teste monta o app e chama `app.request`).
    return 'desconhecido'
  }
}

/**
 * IP que erra a senha uma vez e nunca mais volta deixa a entrada dele parada no
 * mapa para sempre, porque quem limpa e a proxima visita do mesmo IP. Uma varredura
 * quando o mapa cresce demais fecha isso, e o custo dela e uma vez a cada muitas.
 */
const TETO_IPS = 5000

function varrer(agora: number): void {
  for (const [ip, marcas] of falhas) {
    if (marcas.every((t) => agora - t >= JANELA_MS)) falhas.delete(ip)
  }
}

function excedeu(ip: string, agora: number): boolean {
  if (falhas.size > TETO_IPS) varrer(agora)
  const recentes = (falhas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS)
  if (recentes.length === 0) falhas.delete(ip)
  else falhas.set(ip, recentes)
  return recentes.length >= LIMITE
}

/** So a tentativa errada conta: quem sabe a senha nao gasta cota. */
function registrarFalha(ip: string, agora: number): void {
  const recentes = (falhas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS)
  recentes.push(agora)
  falhas.set(ip, recentes)
}

const Credencial = z.object({
  usuario: z.string().trim().min(1).max(64),
  senha: z.string().min(1).max(256),
  /**
   * Decide se o cookie sobrevive ao fechar o navegador. E o `#lembrarMe` da tela,
   * que ja vem marcado hoje; ausente, vale o que o operador ja tinha.
   */
  lembrar: z.boolean().default(true),
})

export type Dependencias = { auth: Auth; db: Db }

export function rotasSessao({ auth, db }: Dependencias): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  rotas.post('/entrar', async (c) => {
    const corpo = await c.req.json().catch(() => null)
    const entrada = Credencial.safeParse(corpo)
    if (!entrada.success) return c.json({ erro: 'entrada invalida' }, 400)

    const ip = ipDe(c)
    const agora = Date.now()
    if (excedeu(ip, agora)) return c.json({ erro: 'muitas tentativas' }, 429)

    // A resposta do better-auth volta inteira, sem reembalar: e nela que vem o
    // `Set-Cookie` da sessao. E o 401 dele ja e o certo, porque nao diz se errou o
    // usuario ou a senha, e dizer daria a quem tenta uma lista de quem existe.
    const resposta = await auth.api.signInEmail({
      asResponse: true,
      body: {
        email: `${entrada.data.usuario.toLowerCase()}${DOMINIO}`,
        password: entrada.data.senha,
        rememberMe: entrada.data.lembrar,
      },
    })
    if (!resposta.ok) registrarFalha(ip, agora)
    return resposta
  })

  rotas.post('/sair', async (c) => {
    const resposta = await auth.api.signOut({ headers: c.req.raw.headers, asResponse: true })
    const saida = new Response(null, { status: 204 })
    // O 204 e nosso, mas o `Set-Cookie` que apaga a sessao e do better-auth. Sem
    // copiar, o navegador seguiria mandando o cookie de uma sessao ja encerrada.
    for (const cookie of resposta.headers.getSetCookie()) saida.headers.append('set-cookie', cookie)
    return saida
  })

  rotas.get('/sessao', async (c) => {
    const dados = await sessaoDoUsuario(db, c.get('usuarioId'))
    // Cookie valido de um usuario que sumiu da tabela e sessao orfa. Tratar como
    // sem sessao mantem uma resposta so para "nao ha quem".
    if (!dados) return c.json({ erro: 'sem sessao' }, 401)
    return c.json(dados)
  })

  return rotas
}
