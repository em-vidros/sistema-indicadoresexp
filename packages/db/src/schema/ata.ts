import { sql } from 'drizzle-orm'
import { boolean, check, date, integer, pgTable, text, time, unique, uuid } from 'drizzle-orm/pg-core'
import { colaborador } from './cadastro.ts'
import { auditoria } from './comum.ts'
import { arquivo } from './documento.ts'

export const ata = pgTable('ata', {
  id: uuid('id').primaryKey().defaultRandom(),
  numero: text('numero').notNull().unique(),
  titulo: text('titulo').notNull(),
  data: date('data').notNull(),
  horario: time('horario'),
  local: text('local'),
  convocada: text('convocada'),
  facilitadores: text('facilitadores'),
  participantesGeral: text('participantes_geral'),
  gestor1Nome: text('gestor1_nome'),
  gestor1Cargo: text('gestor1_cargo'),
  gestor2Nome: text('gestor2_nome'),
  gestor2Cargo: text('gestor2_cargo'),
  pdfArquivoId: uuid('pdf_arquivo_id').references(() => arquivo.id),
  importada: boolean('importada').notNull().default(false),
  ...auditoria(),
})

export const ataTopico = pgTable(
  'ata_topico',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ataId: uuid('ata_id')
      .notNull()
      .references(() => ata.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull(),
    discussao: text('discussao'),
    conclusao: text('conclusao'),
    responsavel: text('responsavel'),
    prazo: date('prazo'),
  },
  (t) => [unique('ata_topico_ordem_uk').on(t.ataId, t.ordem)],
)

export const ataParticipante = pgTable(
  'ata_participante',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ataId: uuid('ata_id')
      .notNull()
      .references(() => ata.id, { onDelete: 'cascade' }),
    colaboradorId: uuid('colaborador_id').references(() => colaborador.id),
    nomeExterno: text('nome_externo'),
    presente: boolean('presente').notNull().default(true),
  },
  (t) => [
    check(
      'ata_participante_pessoa_ck',
      sql`${t.colaboradorId} IS NOT NULL OR ${t.nomeExterno} IS NOT NULL`,
    ),
  ],
)
