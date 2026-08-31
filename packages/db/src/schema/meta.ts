import { numeric, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'

export const direcaoMeta = pgEnum('direcao_meta', ['menor_melhor', 'maior_melhor'])

export const meta = pgTable('meta', {
  chave: text('chave').primaryKey(),
  direcao: direcaoMeta('direcao').notNull(),
  limiteOk: numeric('limite_ok', { precision: 12, scale: 4 }).notNull(),
  limiteAtencao: numeric('limite_atencao', { precision: 12, scale: 4 }),
})

export const parametro = pgTable('parametro', {
  chave: text('chave').primaryKey(),
  valor: numeric('valor', { precision: 12, scale: 4 }).notNull(),
  descricao: text('descricao').notNull(),
})
