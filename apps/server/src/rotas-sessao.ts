/**
 * As rotas de sessao que a tela usa: entrar, sair, saber quem esta logado e as
 * duas do primeiro acesso.
 *
 * O e-mail e montado no servidor, e nao no navegador. A tela pede "usuario" porque
 * e o que o operador tem na cabeca, e o dominio da casa e a rota interna do
 * better-auth sao detalhe de servidor: mudar `@emvidros.com.br` amanha nao deve
 * exigir republicar as telas. O `emailDe` vem de `@ind/db` porque o cadastro de
 * usuario ja precisava dele, e duas copias do dominio dariam um usuario que existe
 * no banco e nao entra.
 *
 * O convite mora aqui, e nao em `rotas-usuarios.ts`, por causa do portao: as duas
 * rotas dele sao publicas, como `/api/entrar`, e ficam sujeitas ao mesmo limitador
 * por IP. As de `rotas-usuarios.ts` sao o oposto, todas exigem sessao de quem
 * gerencia usuarios.
 */
import { ISSUER_SENHA, PROVEDOR_SENHA, type Auth, type Hasher, hasherDe } from '@ind/auth'
import { type Db, aceitarConvite, emailDe, lerConvite, sessaoDoUsuario } from '@ind/db'
import { type Context, Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

/**
 * O freio de tentativa do `/api/entrar`.
 *
 * O limitador do better-auth mora no `onRequest` do roteador dele e so roda quando a
 * requisicao entra por `auth.handler`. Esta rota chama `signInEmail` direto, entao
 * passa por fora dele. E ela e publica, e ate os nomes dos logins ja andaram
 * escritos no HTML: o que sobra entre um estranho e o sistema e adivinhar a senha.
 *
 * As duas rotas de convite dividem o mesmo contador pelo mesmo motivo, so que ali o
 * que se adivinha e o token. Cota gasta so em tentativa errada, entao quem tem o
 * link na mao nunca esbarra nele.
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

/**
 * Oito caracteres. Nao e forca de senha de verdade, e o piso abaixo do qual nao
 * vale a pena ter senha. Quem escolhe uma boa continua podendo.
 */
const SENHA_MINIMA = 8

const Convite = z.object({
  token: z.string().min(1).max(256),
  senha: z.string().min(1).max(256),
})

export type Dependencias = { auth: Auth; db: Db }

export function rotasSessao({ auth, db }: Dependencias): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  // `hasherDe` abre o contexto do better-auth, que e assincrono e caro. Uma vez por
  // processo, e so no primeiro convite aceito.
  let hasher: Promise<Hasher> | null = null

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
        email: emailDe(entrada.data.usuario),
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

  /**
   * O primeiro acesso, em duas rotas publicas.
   *
   * Os tres motivos de recusa (token que nao existe, token expirado, token ja
   * usado) devolvem o mesmo 404 de proposito. Dizer qual deles e conta a quem
   * estiver testando tokens quais logins existem, que e a informacao que o 401 do
   * `/api/entrar` ja se recusa a dar.
   */
  rotas.get('/convite', async (c) => {
    const token = c.req.query('token') ?? ''
    const ip = ipDe(c)
    const agora = Date.now()
    if (excedeu(ip, agora)) return c.json({ erro: 'muitas tentativas' }, 429)

    const dono = token === '' ? null : await lerConvite(db, token)
    if (!dono) {
      registrarFalha(ip, agora)
      return c.json({ erro: 'convite invalido' }, 404)
    }
    return c.json({ usuario: dono.usuario, nome: dono.nome })
  })

  rotas.post('/convite', async (c) => {
    const entrada = Convite.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) return c.json({ erro: 'entrada invalida' }, 400)

    const ip = ipDe(c)
    const agora = Date.now()
    if (excedeu(ip, agora)) return c.json({ erro: 'muitas tentativas' }, 429)

    // Antes de olhar o banco, porque e a unica recusa que nao depende do token e a
    // unica cujo motivo pode ser dito sem contar nada a quem esta tentando.
    if (entrada.data.senha.length < SENHA_MINIMA) return c.json({ erro: 'senha curta' }, 400)

    const hash = await (await (hasher ??= hasherDe(auth))).hash(entrada.data.senha)
    const dono = await aceitarConvite(db, entrada.data.token, hash, {
      provedorSenha: PROVEDOR_SENHA,
      issuerSenha: ISSUER_SENHA,
    })
    if (!dono) {
      registrarFalha(ip, agora)
      return c.json({ erro: 'convite invalido' }, 404)
    }

    // A senha acabou de ser gravada, entao entrar e chamar o mesmo `signInEmail` do
    // `/api/entrar`. Pedir para digitar de novo o que a pessoa digitou ha um
    // segundo seria so uma chance a mais de errar.
    const sessao = await auth.api.signInEmail({
      asResponse: true,
      body: { email: emailDe(dono.usuario), password: entrada.data.senha, rememberMe: true },
    })
    const saida = c.json({ ok: true })
    for (const cookie of sessao.headers.getSetCookie()) {
      saida.headers.append('set-cookie', cookie)
    }
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
