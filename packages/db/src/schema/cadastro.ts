import { sql } from 'drizzle-orm'
import { boolean, date, integer, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const funcaoColaborador = pgEnum('funcao_colaborador', [
  'motorista',
  'ajudante',
  'atendimento',
  'logistica',
])

export const statusPneu = pgEnum('status_pneu', ['novo', 'recapado', 'sucateado'])

export const base = pgTable('base', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull().unique(),
  ativo: boolean('ativo').notNull().default(true),
})

export const veiculo = pgTable('veiculo', {
  id: uuid('id').primaryKey().defaultRandom(),
  placa: text('placa').notNull().unique(),
  modelo: text('modelo'),
  marca: text('marca'),
  ano: text('ano'),
  /** Quantos eixos o veiculo tem. Nulo pra picape e outro veiculo que nao se conta assim. */
  eixos: integer('eixos'),
  baseId: uuid('base_id')
    .notNull()
    .references(() => base.id),
  ativo: boolean('ativo').notNull().default(true),
})

export const colaborador = pgTable('colaborador', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  cargo: text('cargo'),
  funcao: funcaoColaborador('funcao').notNull(),
  admissao: date('admissao'),
  baseId: uuid('base_id')
    .notNull()
    .references(() => base.id),
  ativo: boolean('ativo').notNull().default(true),
})

export const rota = pgTable(
  'rota',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
    local: boolean('local').notNull().default(false),
    ativo: boolean('ativo').notNull().default(true),
  },
  (t) => [unique('rota_nome_base_uk').on(t.nome, t.baseId)],
)

/**
 * O pneu individual de um veiculo: posicao, status (novo/recapado/sucateado) e quantas
 * vezes ja recapou. Sem `baseId` proprio -- a base vem do `veiculo` por join, igual
 * `itemPreventivo` ja faz, e por isso nao ha coluna duplicada pra desalinhar.
 *
 * `ativo`, e nao soft-delete por data: pneu segue o padrao do resto deste arquivo
 * (veiculo/colaborador/rota/base), onde "tirar da lista" e desativar, nao apagar.
 */
export const pneu = pgTable(
  'pneu',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
    posicao: text('posicao').notNull(),
    numeroFogo: text('numero_fogo'),
    marca: text('marca'),
    status: statusPneu('status').notNull().default('novo'),
    recapagens: integer('recapagens').notNull().default(0),
    /** km do veiculo quando este pneu foi instalado (ou recapado) nesta posicao. */
    kmInstalado: integer('km_instalado'),
    dataInstalado: date('data_instalado'),
    observacao: text('observacao'),
    ativo: boolean('ativo').notNull().default(true),
  },
  (t) => [
    // So um pneu ativo por posicao do veiculo; desativar libera a posicao pro proximo.
    uniqueIndex('pneu_veiculo_posicao_uk').on(t.veiculoId, t.posicao).where(sql`${t.ativo} = true`),
  ],
)
