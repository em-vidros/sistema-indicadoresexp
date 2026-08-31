import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { veiculo } from './cadastro.ts'
import { auditoria } from './comum.ts'

export const tipoPreventivo = pgTable('tipo_preventivo', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull().unique(),
  intervaloKm: integer('intervalo_km').notNull(),
  alertaKm: integer('alerta_km').notNull(),
})

export const itemPreventivo = pgTable(
  'item_preventivo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
    tipoPreventivoId: uuid('tipo_preventivo_id')
      .notNull()
      .references(() => tipoPreventivo.id),
    intervaloKm: integer('intervalo_km').notNull(),
    alertaKm: integer('alerta_km').notNull(),
    ultimoKm: integer('ultimo_km'),
    obs: text('obs'),
    ...auditoria(),
  },
  (t) => [unique('item_preventivo_veiculo_tipo_uk').on(t.veiculoId, t.tipoPreventivoId)],
)
