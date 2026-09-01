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
    contatoEmergencia: text('contato_emergencia'),
    cnhNumero: text('cnh_numero'),
    cnhCategoria: text('cnh_categoria'),
    ...auditoria(),
  },
  (t) => [
    // Chave redundante para a FK composta de documento_veiculo prender o tipo 'manual'.
    unique('documento_id_tipo_uk').on(t.id, t.tipo),
    // O CHECK diz de quem o campo pode ser, nao que ele tem que estar preenchido.
    // `grep -c tacografo_venc documentos-frota.html` devolve 0: os 7 tacografos que o
    // sistema entrega hoje nao tem data nenhuma, e exigir o vencimento impediria de
    // semear o parque que existe. Manual e plano_pgq continuam sem poder ter um.
    check(
      'documento_vencimento_ck',
      sql`${t.vencimento} IS NULL OR ${t.tipo} IN ('apolice', 'crlv', 'tacografo', 'cnh')`,
    ),
    // Mesmo motivo: a tela tem `<option value="">—</option>` na categoria (linha 651) e
    // renderiza com `||'—'` (linha 468), entao CNH sem numero e sem categoria existe.
    check(
      'documento_cnh_ck',
      sql`(${t.cnhNumero} IS NULL AND ${t.cnhCategoria} IS NULL) OR ${t.tipo} = 'cnh'`,
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
    // `IS NOT NULL` nao era fonte: `link_externo = ''` entrava como documento sem
    // fonte nenhuma, e `link_externo = 'javascript:alert(document.cookie)'` entrava
    // inteiro. Quem grava pelo seed ou por importador nao passa pelo zod, e a tela da
    // fase 2 renderiza esse valor num `<a href>`. O CHECK repete, em regex do
    // Postgres, o mesmo par que o `link` de `dominio/documento.ts` aceita: URL http
    // ou https, ou caminho relativo sem espaco e sem esquema, que e o formato dos
    // literais de origem ('docs/manual-atego.pdf', 'docs/pgq-manutencao-2026.pdf').
    // As classes sao POSIX, e nao \s: o drizzle-kit passa o SQL por JSON ao gerar
    // a migracao e come a barra invertida, entao \S chegava ao banco como a letra S.
    // O COALESCE nao e enfeite: `NULL ~ regex` e NULL, e `FALSE OR NULL OR NULL` da
    // NULL, que o CHECK aceita. Sem ele, o documento sem arquivo e sem link, que este
    // mesmo CHECK existe para barrar, voltava a passar.
    check(
      'documento_fonte_ck',
      sql`${t.arquivoId} IS NOT NULL
          OR COALESCE(${t.linkExterno}, '') ~ '^https?://[^[:space:]]+$'
          OR COALESCE(${t.linkExterno}, '') ~ '^[^[:space:]:]+$'`,
    ),
    check('documento_seguradora_ck', sql`${t.seguradora} IS NULL OR ${t.tipo} = 'apolice'`),
    check(
      'documento_contato_emergencia_ck',
      sql`${t.contatoEmergencia} IS NULL OR ${t.tipo} = 'apolice'`,
    ),
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
