/**
 * As cinco rotas da tela de usuarios: listar, cadastrar, editar, gerar link novo e
 * apagar.
 *
 * O portao ja barrou quem nao tem sessao antes daqui. O que falta e o degrau de
 * cima, e ele e conferido no banco a cada requisicao: capacidade vinda do cliente
 * seria o proprio usuario dizendo que pode. A tela filtra o menu pela mesma
 * capacidade, mas isso e conforto, nao autorizacao.
 *
 * Este arquivo e o unico ponto onde o hash da senha do PUT e calculado, porque ele
 * esta do lado certo da cerca: o servidor e a raiz de composicao e alcanca
 * `@ind/auth`, e `packages/db` nao alcanca. A consulta recebe a senha pronta.
 *
 * O cadastro nao aceita senha, e isso e desenho e nao esquecimento. Ele devolve um
 * link de primeiro acesso, e quem escolhe a senha e a propria pessoa, em
 * `POST /api/convite`.
 */
import { ISSUER_SENHA, PROVEDOR_SENHA, type Auth, type Hasher, hasherDe } from '@ind/auth'
import {
  type Db,
  EntradaInvalida,
  type MudancaUsuario,
  UsuarioJaExiste,
  atualizarUsuarios,
  apagarUsuario,
  criarConvite,
  criarUsuario,
  idDeUsuario,
  listarUsuarios,
  papelUsuario,
  sessaoDoUsuario,
  tipoRegistro,
} from '@ind/db'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

const CONTA = {
  provedorSenha: PROVEDOR_SENHA,
  issuerSenha: ISSUER_SENHA,
}

/**
 * O login vira a parte local de um e-mail, entao ele nao pode ter `@` nem espaco.
 * A caixa cai para minusculo aqui, e nao no banco, porque `sign-in/email` procura
 * por `email.toLowerCase()`: um login com maiuscula gravado cru entraria na tabela
 * e nunca mais autenticaria.
 */
const Login = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((s) => s.toLowerCase())
  .refine((s) => /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(s), 'login invalido')

const Nome = z.string().trim().min(1).max(120)
const NomeDeBase = z.string().trim().min(1).max(64)
const Bases = z.array(NomeDeBase).max(20)
const Tipos = z.array(z.enum(tipoRegistro.enumValues)).max(20)
const Papel = z.enum(papelUsuario.enumValues)

/**
 * O cadastro. Sem `senha` de proposito, e o `z.object` descarta o que nao declarou:
 * mandar uma nao da erro nem tem efeito, o campo simplesmente nao existe depois do
 * parse.
 *
 * `baseFixa` ausente vale `null`. Se o papel exigir base, `criarUsuario` recusa com
 * 400, e a recusa sai de `baseFixaCoerente` em `@ind/core`, que e a mesma regra que
 * o CHECK do banco guarda.
 */
const Novo = z.object({
  usuario: Login,
  nome: Nome,
  papel: Papel,
  baseFixa: NomeDeBase.nullable().default(null),
  bases: Bases.default([]),
  tipos: Tipos.default([]),
})

/**
 * A edicao. `senha` ausente e "nao muda"; `senha` vazia nao e apagar, porque o
 * `min(1)` recusa o corpo inteiro: conta sem senha e conta que nao entra mais.
 *
 * `baseFixa` tem tres estados e os tres querem dizer coisas diferentes. Ausente e
 * "nao muda", `null` e "tire a base", que e o que promover alguem a admin exige, e
 * um nome e "troque para esta". Sem os tres nao daria para promover ninguem.
 */
const Mudanca = z.object({
  usuario: Login,
  nome: Nome,
  senha: z.string().min(1).max(256).optional(),
  papel: Papel.optional(),
  baseFixa: NomeDeBase.nullable().optional(),
  bases: Bases.optional(),
  tipos: Tipos.optional(),
})

const Corpo = z.array(Mudanca).min(1).max(50)

export type Dependencias = { auth: Auth; db: Db }

export function rotasUsuarios({ auth, db }: Dependencias): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  // `hasherDe` abre o contexto do better-auth, que e assincrono e caro. Uma vez por
  // processo, e so no primeiro PUT que traz senha.
  let hasher: Promise<Hasher> | null = null
  const hashear = async (senha: string) => (await (hasher ??= hasherDe(auth))).hash(senha)

  /** Devolve a resposta que barra quem pediu, ou `null` para deixar passar. */
  async function barrar(usuarioId: string) {
    const dados = await sessaoDoUsuario(db, usuarioId)
    if (!dados) return { corpo: { erro: 'sem sessao' }, status: 401 } as const
    if (!dados.capacidades.gerenciaUsuarios) {
      return { corpo: { erro: 'sem permissão para gerenciar usuários' }, status: 403 } as const
    }
    return null
  }

  const linkDe = (token: string) => `/entrar.html?convite=${token}`

  rotas.get('/usuarios', async (c) => {
    const barrado = await barrar(c.get('usuarioId'))
    if (barrado) return c.json(barrado.corpo, barrado.status)
    return c.json(await listarUsuarios(db, CONTA))
  })

  rotas.post('/usuarios', async (c) => {
    const barrado = await barrar(c.get('usuarioId'))
    if (barrado) return c.json(barrado.corpo, barrado.status)

    const entrada = Novo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) return c.json({ erro: 'entrada invalida' }, 400)

    try {
      const { id } = await criarUsuario(db, entrada.data)
      const convite = await criarConvite(db, id)
      return c.json(
        {
          usuario: entrada.data.usuario,
          convite: { url: linkDe(convite.token), expiraEm: convite.expiraEm.toISOString() },
        },
        201,
      )
    } catch (falha) {
      if (falha instanceof UsuarioJaExiste) return c.json({ erro: falha.message }, 409)
      if (falha instanceof EntradaInvalida) return c.json({ erro: falha.message }, 400)
      throw falha
    }
  })

  rotas.put('/usuarios', async (c) => {
    const barrado = await barrar(c.get('usuarioId'))
    if (barrado) return c.json(barrado.corpo, barrado.status)

    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) return c.json({ erro: 'entrada invalida' }, 400)

    const mudancas: MudancaUsuario[] = await Promise.all(
      entrada.data.map(async (m) => ({
        usuario: m.usuario,
        nome: m.nome,
        ...(m.senha === undefined ? {} : { senhaHash: await hashear(m.senha) }),
        ...(m.papel === undefined ? {} : { papel: m.papel }),
        ...(m.baseFixa === undefined ? {} : { baseFixa: m.baseFixa }),
        ...(m.bases === undefined ? {} : { bases: m.bases }),
        ...(m.tipos === undefined ? {} : { tipos: m.tipos }),
      })),
    )

    try {
      const atualizados = await atualizarUsuarios(db, mudancas, CONTA)
      return c.json({ atualizados })
    } catch (falha) {
      // Login errado, base que nao existe, papel em desacordo com a base e sistema
      // ficando sem admin sao erro de quem pediu, e a transacao ja desfez tudo.
      // Qualquer outra falha sobe: 500 e a resposta honesta.
      if (falha instanceof EntradaInvalida) return c.json({ erro: falha.message }, 400)
      throw falha
    }
  })

  /**
   * Link novo para quem ja existe, derrubando o anterior. E o caminho de quem
   * perdeu o link ou esqueceu a senha, e e por ele que o admin devolve acesso sem
   * escolher a senha de outra pessoa.
   */
  rotas.post('/usuarios/:login/convite', async (c) => {
    const barrado = await barrar(c.get('usuarioId'))
    if (barrado) return c.json(barrado.corpo, barrado.status)

    const login = Login.safeParse(c.req.param('login'))
    if (!login.success) return c.json({ erro: 'entrada invalida' }, 400)

    const lista = await listarUsuarios(db, CONTA)
    if (!lista.some((u) => u.usuario === login.data)) {
      return c.json({ erro: `usuario '${login.data}' nao existe` }, 404)
    }

    const convite = await criarConvite(db, idDeUsuario(login.data))
    return c.json({
      usuario: login.data,
      convite: { url: linkDe(convite.token), expiraEm: convite.expiraEm.toISOString() },
    })
  })

  rotas.delete('/usuarios/:login', async (c) => {
    const barrado = await barrar(c.get('usuarioId'))
    if (barrado) return c.json(barrado.corpo, barrado.status)

    const login = Login.safeParse(c.req.param('login'))
    if (!login.success) return c.json({ erro: 'entrada invalida' }, 400)

    try {
      await apagarUsuario(db, login.data, c.get('usuarioId'))
      return c.body(null, 204)
    } catch (falha) {
      if (falha instanceof EntradaInvalida) return c.json({ erro: falha.message }, 400)
      throw falha
    }
  })

  return rotas
}
