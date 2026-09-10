import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { base } from './cadastro.ts'

export const tipoRegistro = pgEnum('tipo_registro', [
  'viagem',
  'abastecimento',
  'manutencao',
  'quebra',
])

/**
 * Os mesmos tres valores de `Papel` em `@ind/core`. Repetidos aqui e nao
 * importados de la porque um `pgEnum` precisa da lista literal para o drizzle-kit
 * gerar o `create type`, e o dominio nao pode passar a depender do schema so para
 * evitar a repeticao. Quem cobra que as duas listas nao divirjam e
 * `packages/db/test/papel.test.ts`, contra o enum do banco de verdade.
 */
export const papelUsuario = pgEnum('papel_usuario', ['admin', 'gestor', 'operador'])

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // O que a pessoa pode, e a base que ja vem selecionada e travada na tela. O
    // `default` e o papel de menor alcance de proposito: linha inserida por quem
    // esqueceu a coluna nasce sem poder nenhum, e nao administrando o sistema.
    papel: papelUsuario('papel').notNull().default('operador'),
    baseId: uuid('base_id').references(() => base.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Ou a pessoa ve todas as bases, ou tem uma travada, e nao existe terceiro
    // caminho. O CHECK torna irrepresentavel o estado que a tela nao sabe
    // desenhar: admin com base, nao-admin sem base, nada entre os dois.
    //
    // A comparacao e com `'admin'` literal porque SQL nao le a tabela CAPACIDADES
    // de `@ind/core`. Enquanto admin for o unico papel com `todasAsBases` as duas
    // frases dizem o mesmo, e `acesso.test.ts` reprova o dia em que deixarem.
    check(
      'user_papel_base_ck',
      sql`(${t.papel} = 'admin' AND ${t.baseId} IS NULL) OR (${t.papel} <> 'admin' AND ${t.baseId} IS NOT NULL)`,
    ),
  ],
)

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

/**
 * O primeiro acesso. Ninguem nasce com senha: o cadastro devolve um link, e quem
 * escolhe a senha e a propria pessoa ao abrir esse link.
 *
 * O token vive so no link. Aqui fica o SHA-256 dele, pelo mesmo motivo que senha
 * nao fica em claro: quem le esta tabela nao ganha com isso a capacidade de
 * entrar como ninguem. E `usado_em` e coluna, e nao DELETE na hora do uso, porque
 * "esse link ja foi usado" e "esse link nunca existiu" sao a mesma resposta 404
 * para quem tenta, e sao perguntas diferentes para quem depura.
 */
export const conviteSenha = pgTable(
  'convite_senha',
  {
    id: text('id').primaryKey(),
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('convite_senha_usuario_idx').on(t.usuarioId)],
)
