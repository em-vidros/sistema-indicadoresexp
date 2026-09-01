import { z } from 'zod'
import {
  AbastecimentoId,
  ArquivoId,
  BaseId,
  ColaboradorId,
  ManutencaoId,
  ParadaId,
  QuebraId,
  RotaId,
  UsuarioId,
  VeiculoId,
  ViagemId,
} from './ids.ts'
import { DataISO, HoraHM, Instante, diasEntre, minutosEntre } from './tempo.ts'

/**
 * As casas decimais que a coluna guarda, contadas do decimal que o `toString()`
 * mostra, e nao da fracao binaria do double. E a mesma leitura que
 * `derivados.ts` faz para calcular igual ao `numeric`: `1e-7` tem 7 casas,
 * `1e+21` tem zero.
 */
function casasDecimais(x: number): number {
  const bruto = x.toString()
  const marca = bruto.indexOf('e')
  const corpo = marca === -1 ? bruto : bruto.slice(0, marca)
  const expoente = marca === -1 ? 0 : Number(bruto.slice(marca + 1))
  const ponto = corpo.indexOf('.')
  const fracao = ponto === -1 ? 0 : corpo.length - ponto - 1
  return Math.max(0, fracao - expoente)
}

/**
 * A escala e parte do tipo, porque a coluna tem escala e o Postgres arredonda na
 * atribuicao **sem erro**. Com `litros` em `numeric(10,2)` e `vl_litro` em
 * `numeric(10,3)`, `valorTotalParada(100.456, 4.111)` devolvia 412.97 na tela e o
 * banco gravava 412.99, calculado sobre 100.46. Idem em `integer`:
 * `kmRodados(100000.5, 100500.4)` dava 499.9 e a coluna guardava 499.
 *
 * Recusar aqui e o unico jeito de a tela e a linha gravada mostrarem o mesmo
 * numero. Cada schema abaixo cita a coluna de `packages/db/src/schema/registro.ts`
 * de onde a escala vem.
 */
function comEscala(base: z.ZodNumber, casas: number) {
  return base.refine(
    (v) => casasDecimais(v) <= casas,
    casas === 0
      ? 'valor tem que ser inteiro'
      : `valor aceita no maximo ${casas} casas decimais`,
  )
}

const naoNegativo = z.number().finite().nonnegative()
/**
 * `positivo` cobre o que o formulario recusa de verdade quando vem zerado: litros
 * do abastecimento (linha 848), m2 expedido da quebra (linha 925) e valor da
 * carga. O guarda da linha 816 e
 * `if (!ds || !mot || !vei || !rot || !vc || !cv)`, com `vc = parseFloat(...) || 0`:
 * carga zero cai em `!vc` e a tela recusa, com mensagem citando "Valor da Carga".
 * O `min="0"` da linha 341 limita o piso do input e nao torna o campo opcional, e
 * como nao existe `<form>` no arquivo o `required` nem chega a ser avaliado.
 *
 * Valor por litro fica de fora, e isso e proposital: a linha 866 e
 * `if (lt === 0) continue`, que checa so os litros, entao o valor por litro
 * escapa zerado no modo viagem longa. O dominio nao pode ser mais estrito que a
 * origem.
 */
const positivo = z.number().finite().positive()

/** Colunas `integer`: km_saida, km_chegada, abastecimento_parada.km, km_odometro. */
const inteiroNaoNegativo = comEscala(naoNegativo, 0)
const inteiroPositivo = comEscala(positivo, 0)
/** Colunas com escala 2: os `numeric(12,2)` e o `numeric(10,2)` dos litros. */
const duasCasas = comEscala(naoNegativo, 2)
const duasCasasPositivo = comEscala(positivo, 2)
/** Escala 3, so `abastecimento_parada.vl_litro`, que e `numeric(10,3)`. */
const tresCasas = comEscala(naoNegativo, 3)

const texto = z.string().trim()

/**
 * Data obrigatoria, hora opcional. A tela nao exige hora de saida da viagem (o
 * label da linha 291 nao tem asterisco e a hora nao entra no guarda da linha 816)
 * nem hora de entrada na oficina (label da linha 505). Exigir aqui recusaria
 * registro que o sistema de hoje grava.
 */
export const DataComHoraOpcional = z.strictObject({ data: DataISO, hora: HoraHM.nullable() })
export type DataComHoraOpcional = z.infer<typeof DataComHoraOpcional>

/** Negativo quando `b` vem antes de `a`. Sem hora dos dois lados, compara so o dia. */
function ordemCronologica(a: DataComHoraOpcional, b: DataComHoraOpcional): number {
  if (a.hora === null || b.hora === null) return diasEntre(a.data, b.data)
  return minutosEntre({ data: a.data, hora: a.hora }, { data: b.data, hora: b.hora })
}

type Registrado = {
  base: BaseId
  registradoPor: UsuarioId
  registradoEm: Instante
}

const registrado = {
  base: BaseId,
  registradoPor: UsuarioId,
  registradoEm: Instante,
}

type ViagemComum = Registrado & {
  id: ViagemId
  veiculo: VeiculoId
  motorista: ColaboradorId
  rota: RotaId
  saida: DataComHoraOpcional
  previsto: Instante | null
  kmSaida: number
  valorCarga: number
  combustivel: number
  diarias: number
  m2: number
  pesoKg: number
  observacao: string
}

/** Metade das viagens ainda nao voltou. A uniao mata `{ chegada: null, kmChegada: 4000 }`. */
export type Viagem =
  | (ViagemComum & { estado: 'em_curso' })
  | (ViagemComum & { estado: 'concluida'; chegada: Instante; kmChegada: number })

/**
 * Previsao e chegada sao datas distintas, e nunca a mesma coluna lida duas vezes.
 * Uma viagem que sai dia 31/08 com previsao de chegar 31/08 06:00 e chega de fato
 * 01/09 02:00 esta 1200 minutos atrasada; ler o dia da chegada como se fosse o dia
 * previsto a classificava como adiantada em 240 minutos.
 *
 * A tela de hoje nao coleta a data prevista: ha um campo de data para a chegada
 * (`v_data_chegada`, linha 296 de formulario-registro.html) e dois de hora,
 * prevista (294) e real (299). Entao `previsto` so existe quando `dataPrevista` e
 * `horaPrevista` chegam juntas, e a fase 2, que envia o que a tela tem, vai mandar
 * `data_prevista = data_chegada` e reproduzir a suposicao de mesmo dia. A saida
 * disso e acrescentar um campo de data ao lado de "Hora Prevista" quando o visual
 * abrir para mudanca; ate la, a pontualidade da viagem que vira o dia continua sem
 * como ser calculada, e ficar nula e melhor que sair invertida.
 */
const viagemBruta = z.strictObject({
  ...registrado,
  id: ViagemId,
  veiculo: VeiculoId,
  motorista: ColaboradorId,
  rota: RotaId,
  saida: DataComHoraOpcional,
  dataPrevista: DataISO.nullable(),
  horaPrevista: HoraHM.nullable(),
  dataChegada: DataISO.nullable(),
  horaChegada: HoraHM.nullable(),
  // km_saida e km_chegada sao `integer`; o resto da viagem e `numeric(12,2)`.
  kmSaida: inteiroNaoNegativo,
  kmChegada: inteiroNaoNegativo.nullable(),
  valorCarga: duasCasasPositivo,
  combustivel: duasCasas,
  diarias: duasCasas,
  m2: duasCasas,
  pesoKg: duasCasas,
  observacao: texto,
})

export const Viagem = viagemBruta
  .superRefine((v, ctx) => {
    // O mesmo trio do `viagem_chegada_ck`: os tres nulos ou os tres preenchidos.
    // Viagem em curso vinda do banco tem os tres nulos e passa por aqui.
    const preenchidos = [v.dataChegada, v.horaChegada, v.kmChegada].filter((x) => x !== null).length
    if (preenchidos !== 0 && preenchidos !== 3) {
      ctx.addIssue({
        code: 'custom',
        message: 'chegada exige data, hora e km juntos, ou nenhum dos tres',
        path: ['dataChegada'],
      })
    }
    // Espelha o `viagem_previsao_ck`: dia previsto sem hora prevista nao e previsao.
    if (v.dataPrevista !== null && v.horaPrevista === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'data prevista exige hora prevista',
        path: ['horaPrevista'],
      })
    }
    // `cv = comb + diar` e o guarda da linha 816 recusa `!cv`.
    if (v.combustivel + v.diarias <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'combustivel mais diarias tem que ser maior que zero',
        path: ['combustivel'],
      })
    }
    if (
      v.dataChegada !== null &&
      ordemCronologica(v.saida, { data: v.dataChegada, hora: v.horaChegada }) < 0
    ) {
      ctx.addIssue({ code: 'custom', message: 'chegada anterior a saida', path: ['dataChegada'] })
    }
  })
  .transform((v): Viagem => {
    const comum: ViagemComum = {
      id: v.id,
      base: v.base,
      veiculo: v.veiculo,
      motorista: v.motorista,
      rota: v.rota,
      saida: v.saida,
      previsto:
        v.dataPrevista !== null && v.horaPrevista !== null
          ? { data: v.dataPrevista, hora: v.horaPrevista }
          : null,
      kmSaida: v.kmSaida,
      valorCarga: v.valorCarga,
      combustivel: v.combustivel,
      diarias: v.diarias,
      m2: v.m2,
      pesoKg: v.pesoKg,
      observacao: v.observacao,
      registradoPor: v.registradoPor,
      registradoEm: v.registradoEm,
    }
    if (v.dataChegada === null || v.horaChegada === null || v.kmChegada === null) {
      return { ...comum, estado: 'em_curso' }
    }
    return {
      ...comum,
      estado: 'concluida',
      chegada: { data: v.dataChegada, hora: v.horaChegada },
      kmChegada: v.kmChegada,
    }
  })

export const Parada = z.strictObject({
  id: ParadaId,
  ordem: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // litros e `numeric(10,2)`, vl_litro e `numeric(10,3)`, km e `integer`.
  litros: duasCasasPositivo,
  vlLitro: tresCasas,
  km: inteiroPositivo.nullable(),
  posto: texto,
})
export type Parada = z.infer<typeof Parada>

/**
 * Sem `modo` e sem `viagem_longa`. O ADR mostra que `viagem_longa` e escrito nas
 * linhas 856 e 877 do formulario e nunca lido de volta: e estado de interface. O
 * modo sai da contagem de paradas, entao nao ha dois campos para manter em
 * sincronia. `slot` tambem sai, porque e `['Saida','Interior','Chegada'][ordem-1]`.
 */
export type Abastecimento = Registrado & {
  id: AbastecimentoId
  veiculo: VeiculoId
  rota: RotaId | null
  data: DataISO
  paradas: readonly [Parada, ...Parada[]]
}

function comAoMenosUma(lista: Parada[]): readonly [Parada, ...Parada[]] | null {
  const [primeira, ...resto] = lista
  if (primeira === undefined) return null
  return [primeira, ...resto]
}

export const Abastecimento = z
  .strictObject({
    ...registrado,
    id: AbastecimentoId,
    veiculo: VeiculoId,
    rota: RotaId.nullable(),
    data: DataISO,
    paradas: z
      .array(Parada)
      .min(1, 'abastecimento exige ao menos uma parada')
      .max(3, 'abastecimento aceita no maximo 3 paradas'),
  })
  .superRefine((a, ctx) => {
    const ordens = new Set(a.paradas.map((p) => p.ordem))
    if (ordens.size !== a.paradas.length) {
      ctx.addIssue({ code: 'custom', message: 'ordem repetida entre paradas', path: ['paradas'] })
    }
  })
  .transform((a, ctx): Abastecimento => {
    const paradas = comAoMenosUma(a.paradas)
    if (paradas === null) {
      ctx.addIssue({ code: 'custom', message: 'abastecimento sem parada', path: ['paradas'] })
      return z.NEVER
    }
    return {
      id: a.id,
      base: a.base,
      veiculo: a.veiculo,
      rota: a.rota,
      data: a.data,
      paradas,
      registradoPor: a.registradoPor,
      registradoEm: a.registradoEm,
    }
  })

export const TipoManutencao = z.enum(['preventiva', 'corretiva'])
export type TipoManutencao = z.infer<typeof TipoManutencao>

type ManutencaoComum = Registrado & {
  id: ManutencaoId
  veiculo: VeiculoId
  tipo: TipoManutencao
  dataProgramada: DataISO | null
  entrada: DataComHoraOpcional
  servico: string
  valor: number
  kmOdometro: number | null
  fornecedor: string
  orcamento: ArquivoId | null
  os: ArquivoId | null
}

export type Manutencao =
  | (ManutencaoComum & { estado: 'na_oficina' })
  | (ManutencaoComum & { estado: 'liberada'; saida: DataComHoraOpcional })

const manutencaoBruta = z.strictObject({
  ...registrado,
  id: ManutencaoId,
  veiculo: VeiculoId,
  tipo: TipoManutencao,
  dataProgramada: DataISO.nullable(),
  entrada: DataComHoraOpcional,
  dataSaida: DataISO.nullable(),
  horaSaida: HoraHM.nullable(),
  servico: texto.min(1, 'servico e obrigatorio'),
  // valor e `numeric(12,2)`, km_odometro e `integer`.
  valor: duasCasas,
  kmOdometro: inteiroPositivo.nullable(),
  fornecedor: texto,
  orcamento: ArquivoId.nullable(),
  os: ArquivoId.nullable(),
})

/**
 * A liberacao e a data de saida sozinha, com a hora opcional. E o que o banco
 * exige (`manutencao_saida_ck` so cobra `data_saida >= data_entrada`) e o que a
 * tela usa: `dias_oficina`, na linha 897 do formulario, e calculado so das duas
 * datas. Hora de saida sem data de saida nao libera nada e fica de fora, igual ao
 * banco, que tambem nao a checa.
 */
export const Manutencao = manutencaoBruta
  .superRefine((m, ctx) => {
    if (
      m.dataSaida !== null &&
      ordemCronologica(m.entrada, { data: m.dataSaida, hora: m.horaSaida }) < 0
    ) {
      ctx.addIssue({ code: 'custom', message: 'saida anterior a entrada', path: ['dataSaida'] })
    }
  })
  .transform((m): Manutencao => {
    const comum: ManutencaoComum = {
      id: m.id,
      base: m.base,
      veiculo: m.veiculo,
      tipo: m.tipo,
      dataProgramada: m.dataProgramada,
      entrada: m.entrada,
      servico: m.servico,
      valor: m.valor,
      kmOdometro: m.kmOdometro,
      fornecedor: m.fornecedor,
      orcamento: m.orcamento,
      os: m.os,
      registradoPor: m.registradoPor,
      registradoEm: m.registradoEm,
    }
    if (m.dataSaida === null) return { ...comum, estado: 'na_oficina' }
    return { ...comum, estado: 'liberada', saida: { data: m.dataSaida, hora: m.horaSaida } }
  })

export const Quebra = z.strictObject({
  ...registrado,
  id: QuebraId,
  data: DataISO,
  // m2_expedido e m2_quebrado sao `numeric(12,2)`.
  m2Expedido: duasCasasPositivo,
  m2Quebrado: duasCasas,
  observacao: texto,
})
export type Quebra = z.infer<typeof Quebra>
