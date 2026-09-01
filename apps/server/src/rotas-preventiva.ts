/**
 * O plano de preventiva que `manutencao-frota` guardava em `localStorage`.
 *
 * Duas rotas: o GET traz o plano de todos os veiculos que o usuario enxerga mais
 * o catalogo de tipos, e o PUT grava o plano de um veiculo por vez, que e como a
 * tela edita. Quem autoriza e a base do veiculo, na camada de consulta.
 */
import { RegistroInvalido, type Db, gravarPreventiva, listarPreventiva } from '@ind/db'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

const Item = z.object({
  tipo: z.string().trim().min(1).max(160),
  intervalo_km: z.number().int().positive(),
  // O alerta e uma folga antes do vencimento, entao zero e valido e negativo nao.
  alerta_km: z.number().int().nonnegative(),
  ultimo_km: z.number().int().positive().nullable().optional().default(null),
  obs: z.string().trim().max(2000).nullable().optional().default(null),
})

/**
 * A lista vazia e legitima: e o usuario removendo o ultimo item do veiculo. O que
 * nao pode e o mesmo tipo duas vezes, que no upsert por (veiculo, tipo) faria a
 * segunda linha sobrescrever a primeira em silencio.
 */
const Corpo = z
  .object({ itens: z.array(Item).max(50) })
  .superRefine((entrada, contexto) => {
    const tipos = entrada.itens.map((item) => item.tipo)
    if (new Set(tipos).size !== tipos.length) {
      contexto.addIssue({ code: 'custom', message: 'tipo repetido', path: ['itens'] })
    }
  })

export function rotasPreventiva(db: Db): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  rotas.get('/preventiva', async (c) => {
    try {
      return c.json(await listarPreventiva(db, c.get('usuarioId')))
    } catch (falha) {
      if (falha instanceof RegistroInvalido) {
        return c.json({ erro: falha.message }, falha.proibido ? 403 : 400)
      }
      throw falha
    }
  })

  rotas.put('/preventiva/:veiculoId', async (c) => {
    const veiculoId = z.string().uuid().safeParse(c.req.param('veiculoId'))
    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!veiculoId.success || !entrada.success) return c.json({ erro: 'entrada inválida' }, 400)
    try {
      return c.json(
        await gravarPreventiva(db, c.get('usuarioId'), veiculoId.data, entrada.data.itens),
      )
    } catch (falha) {
      if (falha instanceof RegistroInvalido) {
        return c.json({ erro: falha.message }, falha.proibido ? 403 : 400)
      }
      throw falha
    }
  })

  return rotas
}
