import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { base } from './cadastro.ts'

/**
 * O estoque de pneus do almoxarifado: pneus guardados, ainda nao montados em veiculo. E
 * independente do controle por veiculo (`pneu`), que cuida do pneu ja montado.
 *
 * Conta por quantidade, nao por pneu: cada linha e uma combinacao base x medida x marca x
 * condicao, e `quantidade` e o saldo. `recapagens` e a condicao: 0 e pneu nao recapado
 * (novo), 1 a 3 e quantas vezes ja foi recapado.
 *
 * O saldo so muda por movimentacao (`estoque_pneu_movimento`), na mesma transacao: assim
 * o historico explica todo numero, e ninguem digita o saldo direto. `marca` vazia quer
 * dizer "sem marca informada" (texto vazio, e nao nulo, para a chave unica funcionar).
 */
export const estoquePneu = pgTable(
  'estoque_pneu',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
    medida: text('medida').notNull(),
    marca: text('marca').notNull().default(''),
    /**
     * `direcional`, `tracao` ou `misto`. Vazio so existe nas linhas lancadas antes deste campo
     * existir ("sem tipo"): toda movimentacao nova exige um dos tres.
     */
    tipoPneu: text('tipo_pneu').notNull().default(''),
    recapagens: integer('recapagens').notNull().default(0),
    quantidade: integer('quantidade').notNull().default(0),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('estoque_pneu_chave_uk').on(t.baseId, t.medida, t.marca, t.tipoPneu, t.recapagens),
    check('estoque_pneu_tipo_ck', sql`${t.tipoPneu} in ('', 'direcional', 'tracao', 'misto')`),
    check('estoque_pneu_recapagens_ck', sql`${t.recapagens} between 0 and 3`),
    check('estoque_pneu_quantidade_ck', sql`${t.quantidade} >= 0`),
  ],
)

/**
 * Uma linha por movimentacao: entrada, saida ou ajuste de inventario. So acrescenta.
 * `delta` e a variacao com sinal (+4, -2) e `saldo_depois` e o saldo logo depois dela,
 * para o historico se ler sozinho. Na saida por instalacao, `placa` diz em que veiculo.
 */
export const movimentoEstoquePneu = pgTable(
  'estoque_pneu_movimento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quando: timestamp('quando', { withTimezone: true }).notNull().defaultNow(),
    usuarioId: text('usuario_id').references(() => user.id),
    estoqueId: uuid('estoque_id')
      .notNull()
      .references(() => estoquePneu.id),
    /** `entrada`, `saida` ou `ajuste`. */
    tipo: text('tipo').notNull(),
    delta: integer('delta').notNull(),
    saldoDepois: integer('saldo_depois').notNull(),
    motivo: text('motivo').notNull(),
    placa: text('placa'),
    observacao: text('observacao'),
  },
  (t) => [
    index('estoque_pneu_movimento_quando_idx').on(t.quando),
    index('estoque_pneu_movimento_estoque_idx').on(t.estoqueId),
    check('estoque_pneu_movimento_tipo_ck', sql`${t.tipo} in ('entrada', 'saida', 'ajuste')`),
    check('estoque_pneu_movimento_delta_ck', sql`${t.delta} <> 0`),
    check('estoque_pneu_movimento_saldo_ck', sql`${t.saldoDepois} >= 0`),
  ],
)
