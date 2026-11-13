import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

/**
 * O registro de atividades: quem fez o que, quando e, nas alteracoes, o valor antes e
 * depois. Uma linha por acao -- lancou, alterou ou apagou --, escrita na mesma transacao
 * do lancamento, para uma acao que falhou nao deixar rastro e uma que deu certo nunca
 * ficar sem ele.
 *
 * So acrescenta: nada aqui e editado nem apagado. `base` e `resumo` sao texto, e nao chave
 * estrangeira, de proposito: o que aconteceu continua legivel mesmo que o cadastro mude de
 * nome depois. O que foi feito antes desta tabela existir nao tem como ser recuperado.
 */
export const atividade = pgTable(
  'atividade',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quando: timestamp('quando', { withTimezone: true }).notNull().defaultNow(),
    usuarioId: text('usuario_id').references(() => user.id),
    /** `criou`, `alterou` ou `apagou`. */
    acao: text('acao').notNull(),
    /** `viagem`, `abastecimento`, `manutencao`, `quebra` ou `km_atual`. */
    tipo: text('tipo').notNull(),
    base: text('base'),
    /** O id do lancamento (ou do veiculo, no km atual). Nulo na limpeza de um dia inteiro. */
    registroId: text('registro_id'),
    /** O que foi mexido, em uma linha: "Viagem de 14/10 · SMP6F86 · PINHEIRO". */
    resumo: text('resumo').notNull(),
    /** Na alteracao, cada campo que mudou: `[{ campo, antes, depois }]`. */
    mudancas: jsonb('mudancas').$type<Array<{ campo: string; antes: string; depois: string }>>(),
  },
  (t) => [
    index('atividade_quando_idx').on(t.quando),
    check('atividade_acao_ck', sql`${t.acao} in ('criou', 'alterou', 'apagou')`),
    check(
      'atividade_tipo_ck',
      sql`${t.tipo} in ('viagem', 'abastecimento', 'manutencao', 'quebra', 'km_atual')`,
    ),
  ],
)
