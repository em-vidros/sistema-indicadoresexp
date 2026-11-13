/**
 * A rota do registro de atividades: quem lancou, alterou ou apagou o que.
 *
 * So leitura, e so para quem administra o sistema (`gerenciaUsuarios`). A tabela e escrita
 * dentro das transacoes dos lancamentos, em `packages/db`; nada aqui grava. A capacidade e
 * conferida no banco a cada pedido, pelo mesmo motivo de `rotas-usuarios.ts`: o menu que
 * esconde a tela e conforto, nao autorizacao.
 */
import { type Db, listarAtividades, sessaoDoUsuario } from '@ind/db'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

const Consulta = z.object({
  base: z.string().trim().min(1).max(80).optional(),
  tipo: z.enum(['viagem', 'abastecimento', 'manutencao', 'quebra', 'km_atual']).optional(),
  deslocamento: z.coerce.number().int().min(0).max(1_000_000).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
})

export function rotasAtividades(db: Db): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  rotas.get('/atividades', async (c) => {
    const dados = await sessaoDoUsuario(db, c.get('usuarioId'))
    if (!dados) return c.json({ erro: 'sem sessao' }, 401)
    if (!dados.capacidades.gerenciaUsuarios) {
      return c.json({ erro: 'sem permissão para ver as atividades' }, 403)
    }
    const consulta = Consulta.safeParse(c.req.query())
    if (!consulta.success) return c.json({ erro: 'entrada invalida' }, 400)
    return c.json(await listarAtividades(db, consulta.data))
  })

  return rotas
}
