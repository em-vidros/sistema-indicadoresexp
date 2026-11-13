/**
 * O registro de atividades: quem lancou, alterou ou apagou o que, e o valor antes e depois.
 *
 * `descreverRegistro` tira um retrato legivel do lancamento (campos com o rotulo que a
 * pessoa le). A alteracao tira dois, um antes e outro depois da gravacao, e guarda so o que
 * mudou. Tudo isto roda DENTRO da transacao do lancamento: uma gravacao que falha nao deixa
 * rastro, e uma que da certo nunca fica sem ele.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { user } from '../schema/auth.ts'
import { base, colaborador, rota, veiculo } from '../schema/cadastro.ts'
import { atividade } from '../schema/atividade.ts'
import { abastecimento, abastecimentoParada, manutencao, quebra, viagem } from '../schema/registro.ts'
import { type Campos, type Mudanca, diaMesDe, diferencas, textoDe } from './atividades-texto.ts'

type Escritor = Parameters<Parameters<Db['transaction']>[0]>[0]
type Leitor = Pick<Db, 'select'>

export type TipoDeAtividade = 'viagem' | 'abastecimento' | 'manutencao' | 'quebra' | 'km_atual'
export type AcaoDeAtividade = 'criou' | 'alterou' | 'apagou'

export type RetratoDoRegistro = { base: string; resumo: string; campos: Campos }

/** Os abastecimentos de uma viagem em uma frase por posto, para caber em um campo so. */
function frasesDasParadas(
  paradas: ReadonlyArray<{ litros: string; vlLitro: string; km: number | null; posto: string | null }>,
): string {
  if (paradas.length === 0) return textoDe(null)
  return paradas
    .map((p) => {
      const posto = p.posto ? ` · ${p.posto}` : ''
      const km = p.km ? ` · km ${p.km}` : ''
      return `${textoDe(p.litros)} L a R$ ${textoDe(p.vlLitro)}${posto}${km}`
    })
    .join(' | ')
}

async function paradasDe(db: Leitor, abastecimentoIds: string[]) {
  if (abastecimentoIds.length === 0) return []
  const todas = await Promise.all(
    abastecimentoIds.map((id) =>
      db
        .select({
          litros: abastecimentoParada.litros,
          vlLitro: abastecimentoParada.vlLitro,
          km: abastecimentoParada.km,
          posto: abastecimentoParada.posto,
        })
        .from(abastecimentoParada)
        .where(eq(abastecimentoParada.abastecimentoId, id))
        .orderBy(asc(abastecimentoParada.ordem))
    ),
  )
  return todas.flat()
}

/**
 * O lancamento como esta agora, em campos legiveis. Nulo quando o id nao existe. Nao olha
 * `apagado_em`: a limpeza e a exclusao descrevem o registro justo antes de apaga-lo.
 */
export async function descreverRegistro(
  db: Leitor,
  tipo: Exclude<TipoDeAtividade, 'km_atual'>,
  id: string,
): Promise<RetratoDoRegistro | null> {
  if (tipo === 'viagem') {
    const [v] = await db
      .select({
        base: base.nome,
        dataSaida: viagem.dataSaida,
        horaSaida: viagem.horaSaida,
        dataChegada: viagem.dataChegada,
        horaChegada: viagem.horaChegada,
        dataPrevista: viagem.dataPrevista,
        horaPrevista: viagem.horaPrevista,
        motorista: colaborador.nome,
        placa: veiculo.placa,
        rota: rota.nome,
        kmSaida: viagem.kmSaida,
        kmChegada: viagem.kmChegada,
        valorCarga: viagem.valorCarga,
        combustivel: viagem.combustivel,
        diarias: viagem.diarias,
        m2: viagem.m2,
        pesoKg: viagem.pesoKg,
        observacao: viagem.observacao,
      })
      .from(viagem)
      .innerJoin(base, eq(base.id, viagem.baseId))
      .innerJoin(veiculo, eq(veiculo.id, viagem.veiculoId))
      .innerJoin(colaborador, eq(colaborador.id, viagem.motoristaId))
      .innerJoin(rota, eq(rota.id, viagem.rotaId))
      .where(eq(viagem.id, id))
    if (!v) return null
    const abastecimentos = await db
      .select({ id: abastecimento.id })
      .from(abastecimento)
      .where(and(eq(abastecimento.viagemId, id), isNull(abastecimento.apagadoEm)))
    const paradas = await paradasDe(db, abastecimentos.map((a) => a.id))
    return {
      base: v.base,
      resumo: `Viagem de ${diaMesDe(v.dataSaida)} · ${v.placa} · ${v.rota}`,
      campos: {
        'Data de saída': textoDe(v.dataSaida),
        'Hora de saída': textoDe(v.horaSaida),
        Motorista: textoDe(v.motorista),
        'Veículo': textoDe(v.placa),
        Rota: textoDe(v.rota),
        'Km de saída': textoDe(v.kmSaida),
        'Km de chegada': textoDe(v.kmChegada),
        'Data de chegada': textoDe(v.dataChegada),
        'Hora de chegada': textoDe(v.horaChegada),
        'Data prevista': textoDe(v.dataPrevista),
        'Hora prevista': textoDe(v.horaPrevista),
        'Valor da carga': textoDe(v.valorCarga),
        'Combustível': textoDe(v.combustivel),
        'Diárias': textoDe(v.diarias),
        'm²': textoDe(v.m2),
        'Peso (kg)': textoDe(v.pesoKg),
        'Observação': textoDe(v.observacao),
        Abastecimentos: frasesDasParadas(paradas),
      },
    }
  }

  if (tipo === 'manutencao') {
    const [m] = await db
      .select({
        base: base.nome,
        tipo: manutencao.tipoManutencao,
        programada: manutencao.dataProgramada,
        dataEntrada: manutencao.dataEntrada,
        horaEntrada: manutencao.horaEntrada,
        dataSaida: manutencao.dataSaida,
        horaSaida: manutencao.horaSaida,
        placa: veiculo.placa,
        servico: manutencao.servico,
        valor: manutencao.valor,
        km: manutencao.kmOdometro,
        fornecedor: manutencao.fornecedor,
      })
      .from(manutencao)
      .innerJoin(base, eq(base.id, manutencao.baseId))
      .innerJoin(veiculo, eq(veiculo.id, manutencao.veiculoId))
      .where(eq(manutencao.id, id))
    if (!m) return null
    return {
      base: m.base,
      resumo: `Manutenção ${m.placa} · ${m.servico}`,
      campos: {
        Tipo: m.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva',
        Placa: textoDe(m.placa),
        'Serviço': textoDe(m.servico),
        'Data programada': textoDe(m.programada),
        'Data de entrada': textoDe(m.dataEntrada),
        'Hora de entrada': textoDe(m.horaEntrada),
        'Data de saída': textoDe(m.dataSaida),
        'Hora de saída': textoDe(m.horaSaida),
        Valor: textoDe(m.valor),
        'Km do odômetro': textoDe(m.km),
        Fornecedor: textoDe(m.fornecedor),
      },
    }
  }

  if (tipo === 'quebra') {
    const [q] = await db
      .select({
        base: base.nome,
        data: quebra.data,
        expedido: quebra.m2Expedido,
        quebrado: quebra.m2Quebrado,
        observacao: quebra.observacao,
      })
      .from(quebra)
      .innerJoin(base, eq(base.id, quebra.baseId))
      .where(eq(quebra.id, id))
    if (!q) return null
    return {
      base: q.base,
      resumo: `Quebra de ${diaMesDe(q.data)}`,
      campos: {
        Data: textoDe(q.data),
        'm² expedido': textoDe(q.expedido),
        'm² quebrado': textoDe(q.quebrado),
        'Observação': textoDe(q.observacao),
      },
    }
  }

  const [a] = await db
    .select({
      base: base.nome,
      data: abastecimento.data,
      placa: veiculo.placa,
      motorista: colaborador.nome,
      rota: rota.nome,
    })
    .from(abastecimento)
    .innerJoin(base, eq(base.id, abastecimento.baseId))
    .innerJoin(veiculo, eq(veiculo.id, abastecimento.veiculoId))
    .leftJoin(colaborador, eq(colaborador.id, abastecimento.motoristaId))
    .leftJoin(rota, eq(rota.id, abastecimento.rotaId))
    .where(eq(abastecimento.id, id))
  if (!a) return null
  const paradas = await paradasDe(db, [id])
  return {
    base: a.base,
    resumo: `Abastecimento ${a.placa} · ${diaMesDe(a.data)}`,
    campos: {
      Data: textoDe(a.data),
      Placa: textoDe(a.placa),
      Motorista: textoDe(a.motorista),
      Rota: textoDe(a.rota),
      Abastecimentos: frasesDasParadas(paradas),
    },
  }
}

type NovaAtividade = {
  usuarioId: string
  acao: AcaoDeAtividade
  tipo: TipoDeAtividade
  base: string | null
  registroId: string | null
  resumo: string
  mudancas?: Mudanca[] | null
}

export async function registrarAtividade(tx: Escritor, dados: NovaAtividade): Promise<void> {
  await tx.insert(atividade).values({
    usuarioId: dados.usuarioId,
    acao: dados.acao,
    tipo: dados.tipo,
    base: dados.base,
    registroId: dados.registroId,
    resumo: dados.resumo,
    mudancas: dados.mudancas ?? null,
  })
}

/** O lancamento recem gravado: uma linha "criou", sem o antes e o depois. */
export async function registrarCriacao(
  tx: Escritor,
  usuarioId: string,
  tipo: Exclude<TipoDeAtividade, 'km_atual'>,
  id: string,
): Promise<void> {
  const retrato = await descreverRegistro(tx, tipo, id)
  if (!retrato) return
  await registrarAtividade(tx, {
    usuarioId,
    acao: 'criou',
    tipo,
    base: retrato.base,
    registroId: id,
    resumo: retrato.resumo,
  })
}

/**
 * A alteracao: compara o retrato de antes com o de depois e guarda so o que mudou. Gravar
 * sem mudar nada nao deixa linha, porque "alterou" sem nada alterado so enche a lista.
 */
export async function registrarAlteracao(
  tx: Escritor,
  usuarioId: string,
  tipo: Exclude<TipoDeAtividade, 'km_atual'>,
  id: string,
  antes: RetratoDoRegistro | null,
): Promise<void> {
  const depois = await descreverRegistro(tx, tipo, id)
  if (!antes || !depois) return
  const mudancas = diferencas(antes.campos, depois.campos)
  if (mudancas.length === 0) return
  await registrarAtividade(tx, {
    usuarioId,
    acao: 'alterou',
    tipo,
    base: depois.base,
    registroId: id,
    // O resumo e o de depois: e como o lancamento passou a se chamar.
    resumo: depois.resumo,
    mudancas,
  })
}

/** A exclusao: o retrato tirado antes de apagar, para a linha dizer o que sumiu. */
export async function registrarExclusao(
  tx: Escritor,
  usuarioId: string,
  tipo: Exclude<TipoDeAtividade, 'km_atual'>,
  id: string,
  antes: RetratoDoRegistro | null,
): Promise<void> {
  if (!antes) return
  await registrarAtividade(tx, {
    usuarioId,
    acao: 'apagou',
    tipo,
    base: antes.base,
    registroId: id,
    resumo: antes.resumo,
  })
}

export type AtividadeListada = {
  id: string
  quando: string
  usuario: string
  acao: AcaoDeAtividade
  tipo: TipoDeAtividade
  base: string | null
  resumo: string
  mudancas: Mudanca[]
}

export type FiltroDeAtividades = {
  base?: string | undefined
  tipo?: TipoDeAtividade | undefined
  /** Quantas linhas pular: a paginacao do "carregar mais". */
  deslocamento?: number | undefined
  limite?: number | undefined
}

/**
 * As atividades, da mais recente para a mais antiga. Pede uma a mais do que o limite para
 * saber se ha pagina seguinte (`temMais`). A pagina e por deslocamento, e nao pelo horario
 * da ultima linha: uma importacao grava dezenas de linhas no mesmo instante (a transacao
 * inteira tem um `now()` so), e o horario como cursor pularia as que empatam.
 */
export async function listarAtividades(
  db: Leitor,
  filtro: FiltroDeAtividades = {},
): Promise<{ atividades: AtividadeListada[]; temMais: boolean }> {
  const limite = Math.min(Math.max(filtro.limite ?? 50, 1), 200)
  const deslocamento = Math.max(filtro.deslocamento ?? 0, 0)
  const condicoes = [
    filtro.base ? eq(atividade.base, filtro.base) : undefined,
    filtro.tipo ? eq(atividade.tipo, filtro.tipo) : undefined,
  ].filter((c) => c !== undefined)
  const linhas = await db
    .select({
      id: atividade.id,
      quando: atividade.quando,
      usuario: user.name,
      acao: atividade.acao,
      tipo: atividade.tipo,
      base: atividade.base,
      resumo: atividade.resumo,
      mudancas: atividade.mudancas,
    })
    .from(atividade)
    .leftJoin(user, eq(user.id, atividade.usuarioId))
    .where(condicoes.length > 0 ? and(...condicoes) : undefined)
    .orderBy(desc(atividade.quando), desc(atividade.id))
    .limit(limite + 1)
    .offset(deslocamento)

  const pagina = linhas.slice(0, limite)
  return {
    atividades: pagina.map((l) => ({
      id: l.id,
      quando: l.quando.toISOString(),
      usuario: l.usuario ?? 'Sistema',
      acao: l.acao as AcaoDeAtividade,
      tipo: l.tipo as TipoDeAtividade,
      base: l.base,
      resumo: l.resumo,
      mudancas: l.mudancas ?? [],
    })),
    temMais: linhas.length > limite,
  }
}
