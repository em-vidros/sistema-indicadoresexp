import { boolean, date, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'

export const funcaoColaborador = pgEnum('funcao_colaborador', [
  'motorista',
  'ajudante',
  'atendimento',
  'logistica',
])

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
