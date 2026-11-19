/**
 * As tres rotas do estoque de pneus: o saldo, o historico e a movimentacao.
 *
 * O portao ja barrou quem nao tem sessao. Quem alcanca a base mexe no estoque dela; base
 * alheia e 403. O saldo nunca e escrito direto: so `POST /estoque-pneus/movimentos`
 * (entrada, saida ou ajuste de inventario) o altera, e a consulta grava saldo e historico
 * na mesma transacao.
 */
import {
  CadastroInvalido,
  type Db,
  MAXIMO_DE_RECAPAGENS,
  MOTIVOS,
  TIPOS_DE_MOVIMENTO,
  TIPOS_DE_PNEU,
  listarEstoquePneu,
  listarMovimentosDePneu,
  registrarMovimentoDePneu,
} from '@ind/db'
import { type Context, Hono } from 'hono'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

const Consulta = z.object({
  base: z.string().trim().min(1).max(80).optional(),
  deslocamento: z.coerce.number().int().min(0).max(1_000_000).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
})

const Movimento = z.object({
  base: z.string().trim().min(1).max(80),
  medida: z.string().trim().min(1, 'Informe a medida do pneu.').max(40),
  marca: z.string().trim().max(60).optional().default(''),
  // Direcional, tracao ou misto. O vazio so passa nas linhas antigas ("sem tipo"), e a consulta
  // so o aceita em saida e ajuste: entrada nova exige um dos tres.
  tipoPneu: z.enum(['', ...TIPOS_DE_PNEU], { message: 'Informe o tipo do pneu: direcional, tração ou misto.' }),
  recapagens: z.number().int().min(0).max(MAXIMO_DE_RECAPAGENS),
  tipo: z.enum(TIPOS_DE_MOVIMENTO as [string, ...string[]]),
  // O ajuste e a contagem fisica e pode ser zero; entrada e saida exigem mais que zero, e a
  // consulta confere. O teto e so contra digitacao absurda.
  quantidade: z.number().int().min(0).max(100_000),
  motivo: z.string().trim().min(1).max(40),
  placa: z.string().trim().max(10).nullable().optional().default(null),
  observacao: z.string().trim().max(500).nullable().optional().default(null),
})

async function responder<T>(c: Context<Ambiente>, consulta: () => Promise<T>, status: 200 | 201 = 200) {
  try {
    return c.json(await consulta(), status)
  } catch (falha) {
    if (falha instanceof CadastroInvalido) return c.json({ erro: falha.message }, falha.status)
    throw falha
  }
}

export function rotasEstoquePneu(db: Db): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  rotas.get('/estoque-pneus', async (c) => {
    const consulta = Consulta.safeParse(c.req.query())
    if (!consulta.success) return c.json({ erro: 'entrada invalida' }, 400)
    return responder(c, async () => ({ linhas: await listarEstoquePneu(db, c.get('usuarioId'), consulta.data.base) }))
  })

  rotas.get('/estoque-pneus/movimentos', async (c) => {
    const consulta = Consulta.safeParse(c.req.query())
    if (!consulta.success) return c.json({ erro: 'entrada invalida' }, 400)
    return responder(c, () => listarMovimentosDePneu(db, c.get('usuarioId'), consulta.data))
  })

  rotas.post('/estoque-pneus/movimentos', async (c) => {
    const entrada = Movimento.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) {
      return c.json({ erro: entrada.error.issues[0]?.message ?? 'entrada invalida' }, 400)
    }
    const tipo = entrada.data.tipo as (typeof TIPOS_DE_MOVIMENTO)[number]
    if (!MOTIVOS[tipo].includes(entrada.data.motivo)) {
      return c.json({ erro: 'Motivo inválido para esta movimentação.' }, 400)
    }
    return responder(c, () => registrarMovimentoDePneu(db, c.get('usuarioId'), { ...entrada.data, tipo }), 201)
  })

  return rotas
}
