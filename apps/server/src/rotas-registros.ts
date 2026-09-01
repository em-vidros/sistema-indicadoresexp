import {
  RegistroInvalido,
  apagarRegistrosDoDia,
  type Db,
  listarRegistros,
  salvarRegistros,
} from '@ind/db'
import { Hono } from 'hono'
import { z } from 'zod'
import { Data, DataOuNula, HoraOuNula, mensagemDaEntrada } from './entrada.ts'
import type { Ambiente } from './portao.ts'

/**
 * A chegada so e gravada inteira ou nao gravada: `salvarViagem` zera as tres
 * colunas quando falta uma delas, e o `viagem_chegada_ck` cobra isso no banco.
 * A ordem cronologica so vale para a chegada que de fato vai ser gravada.
 */
const chegadaCompleta = (v: { data_chegada: string | null; hora_chegada: string | null; km_chegada: number | null }) =>
  Boolean(v.data_chegada && v.hora_chegada && v.km_chegada !== null)

const Viagem = z.object({
  tipo: z.literal('viagem'),
  base: z.string().trim().min(1),
  data_saida: Data,
  hora_saida: HoraOuNula.optional().default(null),
  data_chegada: DataOuNula.optional().default(null),
  hora_prevista: HoraOuNula.optional().default(null),
  hora_chegada: HoraOuNula.optional().default(null),
  motorista: z.string().trim().min(1),
  veiculo: z.string().trim().min(1),
  rota: z.string().trim().min(1),
  km_saida: z.number().int().nonnegative(),
  km_chegada: z.number().int().nonnegative().nullable().optional().default(null),
  valor_carga: z.number().positive(),
  combustivel: z.number().nonnegative(),
  diarias: z.number().nonnegative(),
  m2: z.number().nonnegative(),
  peso_kg: z.number().nonnegative(),
  observacao: z.string().trim().max(2000),
})
  /**
   * O que os CHECK de `schema/registro.ts` dizem, dito onde da para responder 400.
   * Sem isto, `combustivel: 0` com `diarias: 0` era entrada valida para o zod, o
   * Postgres recusava no `viagem_custo_ck` e o erro subia cru como 500.
   *
   * Os outros CHECK da viagem ja estao cobertos campo a campo aqui em cima: o
   * `viagem_nao_negativo_ck` pelo `positive()` do `valor_carga` mais o
   * `nonnegative()` de km, combustivel, diarias, m2 e peso; o `viagem_chegada_ck`
   * e o `viagem_previsao_ck` pelo proprio `salvarViagem`, que so grava a chegada
   * quando as tres partes vieram e so preenche `data_prevista` quando ha hora
   * prevista.
   */
  .superRefine((entrada, contexto) => {
    // `viagem_custo_ck`. Cada parcela pode ser zero; a soma nao.
    if (entrada.combustivel + entrada.diarias <= 0) {
      contexto.addIssue({
        code: 'custom',
        message: 'informe combustível ou diárias: a soma dos dois tem que ser maior que zero',
        path: ['combustivel'],
      })
    }
    // `viagem_chegada_ordem_ck`. Com hora dos dois lados compara o instante,
    // porque a mesma data com hora menor tambem e invalida; com qualquer uma das
    // horas nula, compara so o dia. E a mesma regra do banco.
    if (chegadaCompleta(entrada)) {
      const comHora = Boolean(entrada.hora_saida)
      const saida = comHora ? `${entrada.data_saida} ${entrada.hora_saida}` : entrada.data_saida
      const chegada = comHora ? `${entrada.data_chegada} ${entrada.hora_chegada}` : entrada.data_chegada!
      if (chegada < saida) {
        contexto.addIssue({
          code: 'custom',
          message: 'a chegada não pode ser anterior à saída',
          path: ['data_chegada'],
        })
      }
    }
  })
const Abastecimento = z.object({
  tipo: z.literal('abastecimento'), base: z.string().trim().min(1),
  data: Data, placa: z.string().trim().min(1),
  rota: z.string().trim().nullable().optional().default(null), litros: z.number().positive(),
  vl_litro: z.number().nonnegative(), km: z.number().int().positive().nullable().optional().default(null),
  posto: z.string().trim().max(240), slot: z.string().trim().nullable().optional().default(null),
  viagem_longa: z.boolean(),
})
// `manutencao_valor_ck` (valor >= 0) e `manutencao_odometro_ck` (odometro nulo ou
// maior que zero) ja estao ditos nos campos: `nonnegative()` e `positive()`.
const Manutencao = z.object({
  tipo: z.literal('manutencao'), base: z.string().trim().min(1),
  tipo_manutencao: z.enum(['preventiva', 'corretiva']),
  data_programada: DataOuNula.optional().default(null), data_entrada: Data,
  hora_entrada: HoraOuNula.optional().default(null), data_saida: DataOuNula.optional().default(null),
  hora_saida: HoraOuNula.optional().default(null), placa: z.string().trim().min(1),
  servico: z.string().trim().min(1), valor: z.number().nonnegative(),
  km_odometro: z.number().int().positive().nullable().optional().default(null),
  fornecedor: z.string().trim().max(240),
})
// `quebra_nao_negativo_ck` ja esta dito nos campos: expedido positivo, quebrado
// nao negativo.
const Quebra = z.object({
  tipo: z.literal('quebra'), base: z.string().trim().min(1),
  data: Data, m2_expedido: z.number().positive(),
  m2_quebrado: z.number().nonnegative(), observacao: z.string().trim().max(2000),
})
const Registro = z.discriminatedUnion('tipo', [Viagem, Abastecimento, Manutencao, Quebra])
const Corpo = z.object({ registros: z.array(Registro).min(1).max(100) })
  /**
   * `abastecimento_parada_ordem_ck` (ordem entre 1 e 3) e o unico CHECK que nao
   * cabe em um registro sozinho: a ordem da parada e a posicao dela dentro do
   * grupo que `salvarRegistros` monta, juntando os abastecimentos de viagem longa
   * com a mesma base, data, placa e rota. Quatro paradas no mesmo grupo geram
   * `ordem = 4`, que o banco recusa. Por isso a regra mora aqui, no corpo inteiro.
   *
   * O `abastecimento_parada_nao_negativo_ck` ja esta coberto no proprio registro,
   * por `litros` positivo, `vl_litro` nao negativo e `km` positivo ou nulo.
   */
  .superRefine((entrada, contexto) => {
    const porGrupo = new Map<string, number>()
    for (const registro of entrada.registros) {
      if (registro.tipo !== 'abastecimento' || !registro.viagem_longa) continue
      const chave = JSON.stringify([registro.base, registro.data, registro.placa, registro.rota])
      porGrupo.set(chave, (porGrupo.get(chave) ?? 0) + 1)
    }
    for (const paradas of porGrupo.values()) {
      if (paradas > 3) {
        contexto.addIssue({
          code: 'custom',
          message: 'viagem longa tem no máximo 3 paradas de abastecimento (saída, interior e chegada)',
          path: ['registros'],
        })
      }
    }
  })
const Limpeza = z.object({
  base: z.string().trim().min(1),
  data: Data,
})

/**
 * A rede embaixo do espelhamento.
 *
 * O espelho no zod cobre o CHECK que se conhece hoje. CHECK novo no schema, ou
 * caminho que ninguem previu, voltaria a virar 500 -- e 500 diz ao cliente que o
 * defeito e nosso e que nao adianta ele mexer no que mandou.
 *
 * 23514 e violacao de CHECK, e violacao de CHECK quer dizer que o dado veio de
 * fora e o banco o recusou: quem tem que corrigir e o cliente, entao 400 e a
 * resposta certa mesmo quando a unica coisa que da para dizer e o nome da
 * constraint. Feio e verdadeiro vale mais que 500 e mudo.
 *
 * Nenhum outro codigo do Postgres muda de tratamento. Chave duplicada (23505),
 * tipo invalido, conexao caida: tudo continua subindo como 500, porque nada disso
 * o cliente resolve reescrevendo o corpo.
 */
function checkViolado(falha: unknown): string | null {
  // A falha chega embrulhada pelo drizzle; o `PostgresError` fica no `cause`.
  let atual: unknown = falha
  while (atual instanceof Error) {
    const erro = atual as Error & { code?: string; constraint_name?: string }
    if (erro.code === '23514') return erro.constraint_name ?? 'sem nome'
    atual = erro.cause
  }
  return null
}

export function rotasRegistros(db: Db): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()
  rotas.get('/registros', async (c) => {
    try {
      return c.json(await listarRegistros(db, c.get('usuarioId'), c.req.query('base')))
    } catch (falha) {
      if (falha instanceof RegistroInvalido) {
        return c.json({ erro: falha.message }, falha.proibido ? 403 : 400)
      }
      throw falha
    }
  })
  rotas.post('/registros', async (c) => {
    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada inválida') }, 400)
    try {
      const salvas = await salvarRegistros(db, c.get('usuarioId'), entrada.data.registros)
      return c.json(salvas, 201)
    } catch (falha) {
      if (falha instanceof RegistroInvalido) {
        return c.json({ erro: falha.message }, falha.proibido ? 403 : 400)
      }
      const constraint = checkViolado(falha)
      if (constraint) {
        return c.json({ erro: `o banco recusou o lançamento pela regra ${constraint}; revise os valores enviados` }, 400)
      }
      throw falha
    }
  })

  /**
   * O "Limpar hoje" da tela. Base e data vem na query; o corpo JSON e aceito como
   * segunda forma porque `fetch('DELETE')` com corpo e o que a tela costuma
   * escrever, e uma das duas chegar vazia nao pode virar "apaguei tudo".
   */
  rotas.delete('/registros', async (c) => {
    const corpo = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
    const entrada = Limpeza.safeParse({
      base: c.req.query('base') ?? corpo?.['base'],
      data: c.req.query('data') ?? corpo?.['data'],
    })
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada inválida') }, 400)
    }
    try {
      return c.json(
        await apagarRegistrosDoDia(db, c.get('usuarioId'), entrada.data.base, entrada.data.data),
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
