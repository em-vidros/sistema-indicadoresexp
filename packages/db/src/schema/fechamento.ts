import { sql } from 'drizzle-orm'
import { date, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { base } from './cadastro.ts'
import { auditoria } from './comum.ts'

/**
 * O mes fechado de uma base. A linha e o fechamento em si: existir (com
 * `apagado_em` nulo) e "fechado"; nao existir, ou ter sido reaberta, e
 * "aberto". So o admin fecha e reabre -- ver `fecharMes`/`reabrirMes` em
 * `consultas/fechamento.ts`.
 *
 * Reabrir e soft-delete, no mesmo padrao do resto da casa (nao o DELETE que
 * `conviteSenha` usa: aqui o historico de quando cada mes foi reaberto e do
 * interesse de quem fecha, e nao so um bilhete de uso unico). Fechar nao
 * escreve por cima da linha reaberta -- o indice parcial deixa nascer uma
 * linha nova, e e essa a prova de que o mes foi reaberto e fechado de novo.
 */
export const fechamentoMensal = pgTable(
  'fechamento_mensal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
    /** Sempre o primeiro dia do mes, ex. `2026-09-01`. */
    mes: date('mes').notNull(),
    ...auditoria(),
  },
  (t) => [
    uniqueIndex('fechamento_mensal_base_mes_uk')
      .on(t.baseId, t.mes)
      .where(sql`apagado_em is null`),
  ],
)
