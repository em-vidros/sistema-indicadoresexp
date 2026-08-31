import { sql } from 'drizzle-orm'
import {
  check,
  date,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { base, colaborador, veiculo } from './cadastro.ts'
import { auditoria } from './comum.ts'

export const tipoDocumento = pgEnum('tipo_documento', [
  'apolice',
  'crlv',
  'tacografo',
  'cnh',
  'manual',
  'plano_pgq',
])

export const arquivo = pgTable('arquivo', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomeOriginal: text('nome_original').notNull(),
  mime: text('mime').notNull(),
  tamanho: integer('tamanho').notNull(),
  caminho: text('caminho').notNull().unique(),
  sha256: text('sha256').notNull(),
  ...auditoria(),
})

export const documento = pgTable(
  'documento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tipo: tipoDocumento('tipo').notNull(),
    titulo: text('titulo'),
    descricao: text('descricao'),
    vencimento: date('vencimento'),
    arquivoId: uuid('arquivo_id').references(() => arquivo.id),
    linkExterno: text('link_externo'),
    veiculoId: uuid('veiculo_id').references(() => veiculo.id),
    colaboradorId: uuid('colaborador_id').references(() => colaborador.id),
    baseId: uuid('base_id').references(() => base.id),
    seguradora: text('seguradora'),
    cnhNumero: text('cnh_numero'),
    cnhCategoria: text('cnh_categoria'),
    ...auditoria(),
  },
  (t) => [
    // Chave redundante para a FK composta de documento_veiculo prender o tipo 'manual'.
    unique('documento_id_tipo_uk').on(t.id, t.tipo),
    check(
      'documento_vencimento_ck',
      sql`CASE WHEN ${t.tipo} IN ('apolice', 'crlv', 'tacografo', 'cnh')
            THEN ${t.vencimento} IS NOT NULL
            ELSE ${t.vencimento} IS NULL END`,
    ),
    check(
      'documento_cnh_ck',
      sql`CASE WHEN ${t.tipo} = 'cnh'
            THEN ${t.cnhNumero} IS NOT NULL AND ${t.cnhCategoria} IS NOT NULL
            ELSE ${t.cnhNumero} IS NULL AND ${t.cnhCategoria} IS NULL END`,
    ),
    check(
      'documento_veiculo_ck',
      sql`CASE WHEN ${t.tipo} IN ('apolice', 'crlv', 'tacografo')
            THEN ${t.veiculoId} IS NOT NULL
            ELSE ${t.veiculoId} IS NULL END`,
    ),
    check(
      'documento_colaborador_ck',
      sql`CASE WHEN ${t.tipo} = 'cnh'
            THEN ${t.colaboradorId} IS NOT NULL
            ELSE ${t.colaboradorId} IS NULL END`,
    ),
    check(
      'documento_base_ck',
      sql`CASE WHEN ${t.tipo} = 'plano_pgq'
            THEN ${t.baseId} IS NOT NULL
            ELSE ${t.baseId} IS NULL END`,
    ),
    check('documento_fonte_ck', sql`${t.arquivoId} IS NOT NULL OR ${t.linkExterno} IS NOT NULL`),
    check('documento_seguradora_ck', sql`${t.seguradora} IS NULL OR ${t.tipo} = 'apolice'`),
  ],
)

export const documentoVeiculo = pgTable(
  'documento_veiculo',
  {
    documentoId: uuid('documento_id').notNull(),
    tipo: tipoDocumento('tipo').notNull(),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
  },
  (t) => [
    primaryKey({ columns: [t.documentoId, t.veiculoId] }),
    foreignKey({
      columns: [t.documentoId, t.tipo],
      foreignColumns: [documento.id, documento.tipo],
      name: 'documento_veiculo_documento_fk',
    }).onDelete('cascade'),
    // A FK composta carrega o tipo junto, e o CHECK o prende em 'manual':
    // so manual pertence a varios veiculos.
    check('documento_veiculo_tipo_ck', sql`${t.tipo} = 'manual'`),
  ],
)

export const politicaDocumento = pgTable('politica_documento', {
  tipo: tipoDocumento('tipo').primaryKey(),
  alertaDias: integer('alerta_dias').notNull(),
})
