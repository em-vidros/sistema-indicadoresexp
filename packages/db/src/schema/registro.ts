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
    // Sem COALESCE. `COALESCE(data_prevista, data_saida)` fabricava um dia previsto
    // que ninguem informou e errava por 24 horas na viagem que vira o dia: previsao
    // 31/08 06:00 com chegada real 01/09 02:00 saia como 240 minutos adiantada em vez
    // de 1200 atrasada. Sem `data_prevista`, o atraso e NULL, e numero ausente e
    // melhor que numero inventado.
    //
    // A tela de hoje nao coleta a data prevista: ha um campo de data para a chegada
    // (`v_data_chegada`, linha 296 de formulario-registro.html) e dois de hora. A fase
    // 2 vai mandar `data_prevista = data_chegada`, reproduzindo a suposicao de mesmo
    // dia; a saida e acrescentar um campo de data ao lado de "Hora Prevista" quando o
    // visual abrir para mudanca.
    atrasoMin: integer('atraso_min').generatedAlwaysAs(
      sql`FLOOR(
        EXTRACT(
          EPOCH FROM
            (data_chegada + hora_chegada) - (data_prevista + hora_prevista)
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
    // `HoraHM` do dominio e 'HH:MM' e nao representa segundo, entao uma linha com
    // 13:19:30 faria `atraso_min` valer -40 no banco e -41 na funcao pura. Nenhuma
    // tela coleta segundo; proibir aqui torna a divergencia impossivel de gravar.
    check(
      'viagem_hora_sem_segundo_ck',
      sql`COALESCE(EXTRACT(SECOND FROM ${t.horaSaida}), 0) = 0
          AND COALESCE(EXTRACT(SECOND FROM ${t.horaPrevista}), 0) = 0
          AND COALESCE(EXTRACT(SECOND FROM ${t.horaChegada}), 0) = 0`,
    ),
    check('viagem_previsao_ck', sql`${t.dataPrevista} IS NULL OR ${t.horaPrevista} IS NOT NULL`),
    // O piso de cada coluna e o do schema do dominio, campo a campo: `valorCarga` e
    // `positivo`, o resto e `naoNegativo`. O comentario antigo dizia que o
    // `NULLIF(valor_carga, 0)` do `pct_custo` casava com o `valorCarga <= 0 -> null`
    // da funcao pura, e nao casava: o dominio recusa o zero, e o banco o aceitava.
    // Com `valor_carga > 0` o NULLIF vira cinto e suspensorio, nunca dispara.
    check(
      'viagem_nao_negativo_ck',
      sql`${t.kmSaida} >= 0
          AND (${t.kmChegada} IS NULL OR ${t.kmChegada} >= 0)
          AND ${t.valorCarga} > 0
          AND ${t.combustivel} >= 0
          AND ${t.diarias} >= 0
          AND (${t.m2} IS NULL OR ${t.m2} >= 0)
          AND (${t.pesoKg} IS NULL OR ${t.pesoKg} >= 0)`,
    ),
    // O `superRefine` do dominio exige `combustivel + diarias > 0`, espelhando o
    // guarda da linha 816 do formulario (`cv = comb + diar`, e `!cv` recusa). Cada
    // parcela pode ser zero; a soma nao. Ate agora isso nao existia no banco.
    check('viagem_custo_ck', sql`${t.combustivel} + ${t.diarias} > 0`),
    // O par do `manutencao_saida_ck`, que faltava aqui: sem ele uma linha com
    // saida 2026-08-01 e chegada 2026-07-01 gravava e ainda saia com km_rodados 500.
    // A comparacao segue a `ordemCronologica` do dominio: com hora dos dois lados
    // compara o instante, porque a mesma data com hora menor tambem e invalida; com
    // qualquer uma das horas nula, compara so o dia.
    check(
      'viagem_chegada_ordem_ck',
      sql`CASE
            WHEN ${t.dataChegada} IS NULL THEN TRUE
            WHEN ${t.horaSaida} IS NULL OR ${t.horaChegada} IS NULL
              THEN ${t.dataChegada} >= ${t.dataSaida}
            ELSE (${t.dataChegada} + ${t.horaChegada}) >= (${t.dataSaida} + ${t.horaSaida})
          END`,
    ),
    // `atraso_min` e `FLOOR(...)::integer`, e o int estoura quando as duas pontas
    // distam mais de 4.083 anos, o que um ano digitado errado produz. A janela sa
    // fecha o intervalo em que o estouro e aritmeticamente impossivel (80 anos sao
    // 42 milhoes de minutos, contra 2,1 bilhoes de teto) e, de quebra, pega o
    // '0202-08-01' que ninguem quis digitar.
    //
    // Ela nao melhora a mensagem no caso extremo. O Postgres calcula a coluna gerada
    // antes de checar as constraints, entao um '9999-01-01' com previsao em 2026
    // ainda sai como "integer out of range", sem nomear coluna. Provado em
    // `derivados.test.ts`, no teste da janela.
    check(
      'viagem_janela_ck',
      sql`${t.dataSaida} BETWEEN DATE '2020-01-01' AND DATE '2100-01-01'
          AND (${t.dataPrevista} IS NULL
               OR ${t.dataPrevista} BETWEEN DATE '2020-01-01' AND DATE '2100-01-01')
          AND (${t.dataChegada} IS NULL
               OR ${t.dataChegada} BETWEEN DATE '2020-01-01' AND DATE '2100-01-01')`,
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
    // `litros` e `positivo` no dominio (linha 848 do formulario recusa zero) e
    // `vl_litro` e `naoNegativo`, porque a linha 866 e `if (lt === 0) continue` e so
    // olha os litros. O piso de cada um segue o seu, sem uniformizar.
    check(
      'abastecimento_parada_nao_negativo_ck',
      sql`${t.litros} > 0 AND ${t.vlLitro} >= 0 AND (${t.km} IS NULL OR ${t.km} > 0)`,
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
    // Comparar so a data deixava entrar entrada 17:00 e saida 08:00 do mesmo dia,
    // que o `superRefine` do dominio recusa. Mesmo defeito do `viagem_chegada_ordem_ck`.
    check(
      'manutencao_saida_ck',
      sql`${t.dataSaida} IS NULL
          OR CASE
               WHEN ${t.horaEntrada} IS NOT NULL AND ${t.horaSaida} IS NOT NULL
                 THEN (${t.dataSaida} + ${t.horaSaida}) >= (${t.dataEntrada} + ${t.horaEntrada})
               ELSE ${t.dataSaida} >= ${t.dataEntrada}
             END`,
    ),
    check('manutencao_valor_ck', sql`${t.valor} >= 0`),
    // O dominio quer o odometro positivo. Sem isto, km_odometro = 0 gravava.
    check('manutencao_odometro_ck', sql`${t.kmOdometro} IS NULL OR ${t.kmOdometro} > 0`),
    check(
      'manutencao_hora_sem_segundo_ck',
      sql`COALESCE(EXTRACT(SECOND FROM ${t.horaEntrada}), 0) = 0
          AND COALESCE(EXTRACT(SECOND FROM ${t.horaSaida}), 0) = 0`,
    ),
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
  // `m2Expedido` e `positivo` no dominio (linha 925 do formulario), e o zero fazia
  // o `NULLIF` do `pct_quebra` disparar em vez de a linha ser recusada.
  // `m2Quebrado` continua em `naoNegativo`: carga sem quebra e o caso comum.
  (t) => [check('quebra_nao_negativo_ck', sql`${t.m2Expedido} > 0 AND ${t.m2Quebrado} >= 0`)],
)
