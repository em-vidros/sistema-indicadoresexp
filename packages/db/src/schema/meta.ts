import { sql } from 'drizzle-orm'
import { check, numeric, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'

export const direcaoMeta = pgEnum('direcao_meta', ['menor_melhor', 'maior_melhor'])

export const meta = pgTable(
  'meta',
  {
    chave: text('chave').primaryKey(),
    direcao: direcaoMeta('direcao').notNull(),
    limiteOk: numeric('limite_ok', { precision: 12, scale: 4 }).notNull(),
    limiteAtencao: numeric('limite_atencao', { precision: 12, scale: 4 }),
  },
  // O mesmo que o `Limiar` de `dominio/kpi.ts` cobra. A tabela so tinha a chave
  // primaria, entao ('custo_carga','menor_melhor', 9, 7) entrava: todo valor que
  // passa de 7 ja passou de 9, a faixa amarela some e `avaliarKpi(8, ...)` responde
  // `ok`. Sao quatro linhas vindas do seed, e este CHECK e o unico guarda que existe
  // no caminho de quem nao passa pelo zod. Nulo continua valido, porque o percentual
  // de atraso (linha 431 do dashboard) so tem duas faixas.
  (t) => [
    check(
      'meta_limite_ck',
      sql`${t.limiteAtencao} IS NULL
          OR (${t.direcao} = 'menor_melhor' AND ${t.limiteAtencao} >= ${t.limiteOk})
          OR (${t.direcao} = 'maior_melhor' AND ${t.limiteAtencao} <= ${t.limiteOk})`,
    ),
  ],
)

export const parametro = pgTable('parametro', {
  chave: text('chave').primaryKey(),
  valor: numeric('valor', { precision: 12, scale: 4 }).notNull(),
  descricao: text('descricao').notNull(),
})
