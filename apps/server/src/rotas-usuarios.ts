/**
 * As duas rotas da tela de administracao de usuarios: listar os quatro e gravar o
 * que o admin editou. O contrato e o que `abrirGerenciarUsuarios` e
 * `salvarUsuarios` de `formulario-registro.html` ja consomem.
 *
 * O portao ja barrou quem nao tem sessao antes daqui. O que falta e o degrau de
 * cima, e ele e conferido no banco: `admin` vindo do cliente seria o proprio
 * usuario dizendo que pode.
 *
 * Este arquivo e o unico ponto onde o hash da senha e calculado, porque ele esta do
 * lado certo da cerca: o servidor e a raiz de composicao e alcanca `@ind/auth`, e
 * `packages/db` nao alcanca. A consulta recebe a senha pronta.
 */
import { ISSUER_SENHA, PROVEDOR_SENHA, type Auth, type Hasher, hasherDe } from '@ind/auth'
import {
  type Db,
  EntradaInvalida,
  type MudancaUsuario,
  atualizarUsuarios,
  listarUsuarios,
  sessaoDoUsuario,
  tipoRegistro,
} from '@ind/db'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

/**
 * Nem `admin` nem `baseFixa` aparecem aqui, e o `z.object` descarta o que nao
 * declarou. E assim que "se vierem, ignore" vira codigo: o campo nao chega a
 * existir depois do parse, entao nenhuma linha adiante pode usa-lo por engano.
 *
 * `senha` ausente e "nao muda". `senha` vazia nao e apagar: o `min(1)` recusa o
 * corpo inteiro, porque conta sem senha e conta que nao entra mais.
 */
const Mudanca = z.object({
  usuario: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((s) => s.toLowerCase()),
  nome: z.string().trim().min(1).max(120),
  senha: z.string().min(1).max(256).optional(),
  bases: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  tipos: z.array(z.enum(tipoRegistro.enumValues)).max(20).optional(),
})

const Corpo = z.array(Mudanca).min(1).max(50)

export type Dependencias = { auth: Auth; db: Db }

export function rotasUsuarios({ auth, db }: Dependencias): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  // `hasherDe` abre o contexto do better-auth, que e assincrono e caro. Uma vez por
  // processo, e so no primeiro PUT que traz senha.
  let hasher: Promise<Hasher> | null = null
  const hashear = async (senha: string) => (await (hasher ??= hasherDe(auth))).hash(senha)

  /** Devolve o login de quem pediu, ou a resposta que o barra. */
  async function exigirAdmin(usuarioId: string) {
    const dados = await sessaoDoUsuario(db, usuarioId)
    if (!dados) return { erro: { corpo: { erro: 'sem sessao' }, status: 401 } as const }
    if (!dados.admin) return { erro: { corpo: { erro: 'somente administrador' }, status: 403 } as const }
    return { erro: null }
  }

  rotas.get('/usuarios', async (c) => {
    const { erro } = await exigirAdmin(c.get('usuarioId'))
    if (erro) return c.json(erro.corpo, erro.status)
    return c.json(await listarUsuarios(db))
  })

  rotas.put('/usuarios', async (c) => {
    const { erro } = await exigirAdmin(c.get('usuarioId'))
    if (erro) return c.json(erro.corpo, erro.status)

    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) return c.json({ erro: 'entrada invalida' }, 400)

    const mudancas: MudancaUsuario[] = await Promise.all(
      entrada.data.map(async (m) => ({
        usuario: m.usuario,
        nome: m.nome,
        ...(m.senha === undefined ? {} : { senhaHash: await hashear(m.senha) }),
        ...(m.bases === undefined ? {} : { bases: m.bases }),
        ...(m.tipos === undefined ? {} : { tipos: m.tipos }),
      })),
    )

    try {
      const atualizados = await atualizarUsuarios(db, mudancas, {
        provedorSenha: PROVEDOR_SENHA,
        issuerSenha: ISSUER_SENHA,
      })
      return c.json({ atualizados })
    } catch (falha) {
      // Login ou base que nao existe e erro de quem pediu, e a transacao ja desfez
      // tudo. Qualquer outra falha sobe: 500 e a resposta honesta.
      if (falha instanceof EntradaInvalida) return c.json({ erro: falha.message }, 400)
      throw falha
    }
  })

  return rotas
}
