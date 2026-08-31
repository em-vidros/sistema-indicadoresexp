import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { base } from './cadastro.ts'

export const tipoRegistro = pgEnum('tipo_registro', [
  'viagem',
  'abastecimento',
  'manutencao',
  'quebra',
])

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('account_issuer_accountId_uidx').on(t.issuer, t.accountId)],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const usuarioBase = pgTable(
  'usuario_base',
  {
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.baseId] })],
)

export const usuarioTipo = pgTable(
  'usuario_tipo',
  {
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tipo: tipoRegistro('tipo').notNull(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.tipo] })],
)
