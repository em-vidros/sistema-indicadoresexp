/**
 * O cadastro: o GET traz as listas que o formulario autocompleta, e o POST e o
 * PUT deixam a tela editar o que antes so mudava por migracao.
 *
 * O GET sem parametro continua entregando so o que esta ativo, que e o que o
 * formulario precisa; `?todos=1` e para a tela de cadastro, que tem de mostrar
 * o inativo para poder reativa-lo.
 *
 * A placa e normalizada aqui e nao no banco: `' zzc-0001 '` e `ZZC0001` sao a
 * mesma placa para quem digita, e deixar as duas entrarem faria o unique da
 * coluna parar de significar o que ele promete.
 */
import {
  CadastroInvalido,
  type Db,
  atualizarVeiculo,
  catalogoCadastro,
  criarVeiculo,
} from '@ind/db'
import { type Context, Hono } from 'hono'
import { z } from 'zod'
import { TextoOuNulo, mensagemDaEntrada } from './entrada.ts'
import type { Ambiente } from './portao.ts'

const Placa = z
  .string()
  .transform((valor) => valor.trim().toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().min(1).max(10))

const Id = z.string().uuid()

/**
 * As nove rotas recusam do mesmo jeito, e a recusa e a parte que nao pode
 * divergir entre elas: um `catch` esquecido em uma vira 500 onde as outras
 * dizem 403.
 */
async function responder<T>(
  c: Context<Ambiente>,
  consulta: () => Promise<T>,
  status: 200 | 201 = 200,
): Promise<Response> {
  try {
    return c.json(await consulta(), status)
  } catch (falha) {
    if (falha instanceof CadastroInvalido) return c.json({ erro: falha.message }, falha.status)
    throw falha
  }
}

const Veiculo = z.object({
  placa: Placa,
  marca: TextoOuNulo.optional().default(null),
  modelo: TextoOuNulo.optional().default(null),
  ano: TextoOuNulo.optional().default(null),
  baseId: z.string().uuid(),
  ativo: z.boolean().optional().default(true),
})

/** No PUT a tela manda a linha inteira, entao `ativo` deixa de ter padrao. */
const VeiculoSalvo = Veiculo.extend({ ativo: z.boolean() })

export function rotasCadastro(db: Db): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()

  rotas.get('/cadastro', async (c) =>
    responder(c, () => catalogoCadastro(db, c.get('usuarioId'), c.req.query('todos') === '1')),
  )

  rotas.post('/cadastro/veiculos', async (c) => {
    const entrada = Veiculo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada invalida') }, 400)
    }
    return responder(c, () => criarVeiculo(db, c.get('usuarioId'), entrada.data), 201)
  })

  rotas.put('/cadastro/veiculos/:id', async (c) => {
    const id = Id.safeParse(c.req.param('id'))
    const entrada = VeiculoSalvo.safeParse(await c.req.json().catch(() => null))
    if (!id.success) return c.json({ erro: 'entrada invalida' }, 400)
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada invalida') }, 400)
    }
    return responder(c, () => atualizarVeiculo(db, c.get('usuarioId'), id.data, entrada.data))
  })

  return rotas
}
