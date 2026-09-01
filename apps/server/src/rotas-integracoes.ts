import {
  type Db,
  IntegracaoInvalida,
  atualizarIntegracao,
  catalogoIntegracao,
  criarIntegracao,
  listarIntegracoes,
} from '@ind/db'
import { Hono } from 'hono'
import { z } from 'zod'
import { Data, mensagemDaEntrada } from './entrada.ts'
import type { Ambiente } from './portao.ts'

const Atividade = z.object({
  atividadeId: z.string().uuid(),
  feito: z.boolean(),
  data: Data.nullable(),
})
const Corpo = z
  .object({
    colaboradorId: z.string().uuid().nullable().optional().default(null),
    nome: z.string().trim().min(1).max(160),
    cargo: z.string().trim().max(160).nullable().optional().default(null),
    admissao: Data.nullable().optional().default(null),
    programaId: z.string().uuid(),
    inicio: Data.nullable().optional().default(null),
    coord: z.string().trim().max(160).nullable().optional().default(null),
    gerente: z.string().trim().max(160).nullable().optional().default(null),
    rh: z.string().trim().max(160).nullable().optional().default(null),
    atividades: z.array(Atividade).max(100),
  })
  .superRefine((entrada, contexto) => {
    const ids = entrada.atividades.map((atividade) => atividade.atividadeId)
    if (new Set(ids).size !== ids.length) {
      contexto.addIssue({ code: 'custom', message: 'atividade repetida', path: ['atividades'] })
    }
  })

export function rotasIntegracoes(db: Db): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  rotas.get('/integracoes/catalogo', async (c) =>
    c.json(await catalogoIntegracao(db, c.get('usuarioId'))),
  )
  rotas.get('/integracoes', async (c) => c.json(await listarIntegracoes(db, c.get('usuarioId'))))

  rotas.post('/integracoes', async (c) => {
    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada invalida') }, 400)
    }

    try {
      const criada = await criarIntegracao(db, c.get('usuarioId'), entrada.data)
      return c.json(criada, 201)
    } catch (falha) {
      if (falha instanceof IntegracaoInvalida) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })

  rotas.put('/integracoes/:id', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!id.success) return c.json({ erro: 'entrada invalida' }, 400)
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada invalida') }, 400)
    }

    try {
      return c.json(await atualizarIntegracao(db, c.get('usuarioId'), id.data, entrada.data))
    } catch (falha) {
      if (falha instanceof IntegracaoInvalida) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })

  return rotas
}
