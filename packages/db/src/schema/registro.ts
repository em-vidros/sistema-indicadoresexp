import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { base, colaborador, rota, veiculo } from './cadastro.ts'
import { auditoria } from './comum.ts'
import { arquivo } from './documento.ts'

export const tipoManutencao = pgEnum('tipo_manutencao', ['preventiva', 'corretiva'])

const dinheiro = (nome: string) => numeric(nome, { precision: 12, scale: 2 })

export const viagem = pgTable(
  'viagem',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
    motoristaId: uuid('motorista_id')
      .notNull()
      .references(() => colaborador.id),
    rotaId: uuid('rota_id')
      .notNull()
      .references(() => rota.id),
    dataSaida: date('data_saida').notNull(),
    horaSaida: time('hora_saida'),
    horaPrevista: time('hora_prevista'),
    dataPrevista: date('data_prevista'),
    dataChegada: date('data_chegada'),
    horaChegada: time('hora_chegada'),
    kmSaida: integer('km_saida').notNull(),
    kmChegada: integer('km_chegada'),
    valorCarga: dinheiro('valor_carga').notNull(),
    combustivel: dinheiro('combustivel').notNull(),
    diarias: dinheiro('diarias').notNull(),
    m2: numeric('m2', { precision: 12, scale: 2 }),
    pesoKg: numeric('peso_kg', { precision: 12, scale: 2 }),
    observacao: text('observacao'),
    kmRodados: integer('km_rodados').generatedAlwaysAs(
      sql`CASE WHEN km_chegada > km_saida THEN km_chegada - km_saida END`,
    ),
    custoViagem: dinheiro('custo_viagem').generatedAlwaysAs(
      sql`ROUND((combustivel + diarias)::numeric, 2)`,
    ),
    pctCusto: dinheiro('pct_custo').generatedAlwaysAs(
      sql`ROUND((combustivel + diarias) / NULLIF(valor_carga, 0) * 100, 2)`,
    ),
    atrasoMin: integer('atraso_min').generatedAlwaysAs(
      sql`FLOOR(
        EXTRACT(
          EPOCH FROM
            (data_chegada + hora_chegada)
            - (COALESCE(data_prevista, data_saida) + hora_prevista)
        ) / 60 + 0.5
      )::integer`,
    ),
    ...auditoria(),
  },
  (t) => [
    check(
      'viagem_chegada_ck',
      sql`(${t.dataChegada} IS NULL AND ${t.horaChegada} IS NULL AND ${t.kmChegada} IS NULL)
          OR (${t.dataChegada} IS NOT NULL AND ${t.horaChegada} IS NOT NULL AND ${t.kmChegada} IS NOT NULL)`,
    ),
    check('viagem_previsao_ck', sql`${t.dataPrevista} IS NULL OR ${t.horaPrevista} IS NOT NULL`),
    // NULLIF(valor_carga, 0) so casa com o `valorCarga <= 0 -> null` do dominio
    // enquanto o negativo nao existir.
    check(
      'viagem_nao_negativo_ck',
      sql`${t.kmSaida} >= 0 AND ${t.valorCarga} >= 0 AND ${t.combustivel} >= 0 AND ${t.diarias} >= 0`,
    ),
  ],
)

export const abastecimento = pgTable('abastecimento', {
  id: uuid('id').primaryKey().defaultRandom(),
  baseId: uuid('base_id')
    .notNull()
    .references(() => base.id),
  veiculoId: uuid('veiculo_id')
    .notNull()
    .references(() => veiculo.id),
  rotaId: uuid('rota_id').references(() => rota.id),
  data: date('data').notNull(),
  ...auditoria(),
})

export const abastecimentoParada = pgTable(
  'abastecimento_parada',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    abastecimentoId: uuid('abastecimento_id')
      .notNull()
      .references(() => abastecimento.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull(),
    litros: numeric('litros', { precision: 10, scale: 2 }).notNull(),
    vlLitro: numeric('vl_litro', { precision: 10, scale: 3 }).notNull(),
    km: integer('km'),
    posto: text('posto'),
    valorTotal: dinheiro('valor_total').generatedAlwaysAs(sql`ROUND(litros * vl_litro, 2)`),
  },
  (t) => [
    unique('abastecimento_parada_ordem_uk').on(t.abastecimentoId, t.ordem),
    check('abastecimento_parada_ordem_ck', sql`${t.ordem} BETWEEN 1 AND 3`),
    check(
      'abastecimento_parada_nao_negativo_ck',
      sql`${t.litros} >= 0 AND ${t.vlLitro} >= 0`,
    ),
  ],
)

export const manutencao = pgTable(
  'manutencao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
    tipoManutencao: tipoManutencao('tipo_manutencao').notNull(),
    dataProgramada: date('data_programada'),
    dataEntrada: date('data_entrada').notNull(),
    horaEntrada: time('hora_entrada'),
    dataSaida: date('data_saida'),
    horaSaida: time('hora_saida'),
    servico: text('servico').notNull(),
    valor: dinheiro('valor').notNull(),
    kmOdometro: integer('km_odometro'),
    fornecedor: text('fornecedor'),
    orcamentoArquivoId: uuid('orcamento_arquivo_id').references(() => arquivo.id),
    osArquivoId: uuid('os_arquivo_id').references(() => arquivo.id),
    diasOficina: integer('dias_oficina').generatedAlwaysAs(sql`data_saida - data_entrada`),
    statusDocumental: boolean('status_documental').generatedAlwaysAs(
      sql`orcamento_arquivo_id IS NOT NULL AND os_arquivo_id IS NOT NULL`,
    ),
    ...auditoria(),
  },
  (t) => [
    check('manutencao_saida_ck', sql`${t.dataSaida} IS NULL OR ${t.dataSaida} >= ${t.dataEntrada}`),
    check('manutencao_valor_ck', sql`${t.valor} >= 0`),
  ],
)

export const quebra = pgTable(
  'quebra',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    baseId: uuid('base_id')
      .notNull()
      .references(() => base.id),
    data: date('data').notNull(),
    m2Expedido: numeric('m2_expedido', { precision: 12, scale: 2 }).notNull(),
    m2Quebrado: numeric('m2_quebrado', { precision: 12, scale: 2 }).notNull(),
    observacao: text('observacao'),
    pctQuebra: dinheiro('pct_quebra').generatedAlwaysAs(
      sql`ROUND(m2_quebrado / NULLIF(m2_expedido, 0) * 100, 2)`,
    ),
    ...auditoria(),
  },
  (t) => [check('quebra_nao_negativo_ck', sql`${t.m2Expedido} >= 0 AND ${t.m2Quebrado} >= 0`)],
)
