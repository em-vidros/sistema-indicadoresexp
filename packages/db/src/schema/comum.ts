import { text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

export const auditoria = () => ({
  criadoPor: text('criado_por').references(() => user.id),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoPor: text('atualizado_por').references(() => user.id),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  apagadoEm: timestamp('apagado_em', { withTimezone: true }),
})
