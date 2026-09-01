import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  text,
  time,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { base, colaborador } from './cadastro.ts'
import { auditoria } from './comum.ts'
import { arquivo } from './documento.ts'

export const ata = pgTable(
  'ata',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    numero: text('numero'),
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
    // A base dona da ata. Nula de proposito: ata criada pelo admin e da empresa
    // inteira e nao pertence a base nenhuma. A base nunca vem do corpo da
    // requisicao, porque a tela nao tem esse campo. Ela vem da base fixa de quem
    // gravou, e por isso ata antiga (anterior a esta coluna) fica nula sem travar.
    baseId: uuid('base_id').references(() => base.id),
    pdfArquivoId: uuid('pdf_arquivo_id').references(() => arquivo.id),
    importada: boolean('importada').notNull().default(false),
    ...auditoria(),
  },
  /**
   * A numeracao da ata e da base, nao da empresa. O `UNIQUE (numero)` global que
   * estava aqui fazia duas coisas erradas ao mesmo tempo: repetir um numero
   * subia 23505 cru como 500, e como a unicidade era global e a leitura e por
   * base, a diferenca entre 201 e 500 dizia se aquele numero ja existia em
   * outra base -- numero de ata e curto e sequencial, entao a numeracao das
   * outras bases ficava enumeravel, e cada tentativa deixava uma ata de verdade
   * no banco.
   *
   * Sao dois indices parciais e nao um `UNIQUE NULLS NOT DISTINCT (numero,
   * base_id)` porque `NULLS NOT DISTINCT` vale para a linha inteira: ele
   * resolveria a ata da empresa (`base_id` nulo) e quebraria a ata sem numero,
   * que e legitima desde a 0006 e da qual existe mais de uma por base. Com o
   * predicado `numero is not null` nenhuma coluna indexada e nula, entao a
   * questao de NULL distinto de NULL nem se coloca.
   *
   * `numero` nulo continua livre para repetir: ata sem numero nao colide com
   * ata sem numero.
   */
  (t) => [
    uniqueIndex('ata_numero_base_uk')
      .on(t.numero, t.baseId)
      .where(sql`numero is not null and base_id is not null`),
    uniqueIndex('ata_numero_empresa_uk')
      .on(t.numero)
      .where(sql`numero is not null and base_id is null`),
  ],
)

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
    prazo: text('prazo'),
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
