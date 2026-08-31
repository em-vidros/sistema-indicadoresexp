import { boolean, date, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { colaborador, funcaoColaborador } from './cadastro.ts'
import { auditoria } from './comum.ts'

export const programaIntegracao = pgTable('programa_integracao', {
  id: uuid('id').primaryKey().defaultRandom(),
  funcao: funcaoColaborador('funcao').notNull().unique(),
  titulo: text('titulo').notNull(),
  ativo: boolean('ativo').notNull().default(true),
})

export const programaSemana = pgTable(
  'programa_semana',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programaId: uuid('programa_id')
      .notNull()
      .references(() => programaIntegracao.id, { onDelete: 'cascade' }),
    numero: integer('numero').notNull(),
    titulo: text('titulo').notNull(),
  },
  (t) => [unique('programa_semana_numero_uk').on(t.programaId, t.numero)],
)

export const programaAtividade = pgTable(
  'programa_atividade',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    semanaId: uuid('semana_id')
      .notNull()
      .references(() => programaSemana.id, { onDelete: 'cascade' }),
    codigo: text('codigo').notNull().unique(),
    ordem: integer('ordem').notNull(),
    titulo: text('titulo').notNull(),
    descricao: text('descricao').notNull(),
  },
  (t) => [unique('programa_atividade_ordem_uk').on(t.semanaId, t.ordem)],
)

export const programaCriterio = pgTable(
  'programa_criterio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programaId: uuid('programa_id')
      .notNull()
      .references(() => programaIntegracao.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull(),
    criterio: text('criterio').notNull(),
    padrao: text('padrao').notNull(),
    frequencia: text('frequencia').notNull(),
  },
  (t) => [unique('programa_criterio_ordem_uk').on(t.programaId, t.ordem)],
)

export const integracao = pgTable('integracao', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').references(() => colaborador.id),
  nomeLivre: text('nome_livre').notNull(),
  cargo: text('cargo'),
  admissao: date('admissao'),
  programaId: uuid('programa_id')
    .notNull()
    .references(() => programaIntegracao.id),
  inicio: date('inicio'),
  coord: text('coord'),
  gerente: text('gerente'),
  rh: text('rh'),
  ...auditoria(),
})

export const integracaoAtividade = pgTable(
  'integracao_atividade',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integracaoId: uuid('integracao_id')
      .notNull()
      .references(() => integracao.id, { onDelete: 'cascade' }),
    atividadeId: uuid('atividade_id')
      .notNull()
      .references(() => programaAtividade.id),
    feito: boolean('feito').notNull().default(false),
    data: date('data'),
  },
  (t) => [unique('integracao_atividade_uk').on(t.integracaoId, t.atividadeId)],
)
