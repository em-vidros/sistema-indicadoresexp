import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { usuarioTipo } from '../schema/auth.ts'
import { base, colaborador, rota, veiculo } from '../schema/cadastro.ts'
import { abastecimento, abastecimentoParada, manutencao, quebra, viagem } from '../schema/registro.ts'
import { lerPermissao } from './permissao.ts'

export class RegistroInvalido extends Error {
  constructor(message: string, readonly proibido = false) {
    super(message)
  }
}

export type EntradaViagem = {
  tipo: 'viagem'
  base: string
  data_saida: string
  hora_saida: string | null
  data_chegada: string | null
  hora_prevista: string | null
  hora_chegada: string | null
  motorista: string
  veiculo: string
  rota: string
  km_saida: number
  km_chegada: number | null
  valor_carga: number
  combustivel: number
  diarias: number
  m2: number
  peso_kg: number
  observacao: string
}

export type EntradaAbastecimento = {
  tipo: 'abastecimento'
  base: string
  data: string
  placa: string
  rota: string | null
  litros: number
  vl_litro: number
  km: number | null
  posto: string
  slot: string | null
  viagem_longa: boolean
}

export type EntradaManutencao = {
  tipo: 'manutencao'
  base: string
  tipo_manutencao: 'preventiva' | 'corretiva'
  data_programada: string | null
  data_entrada: string
  hora_entrada: string | null
  data_saida: string | null
  hora_saida: string | null
  placa: string
  servico: string
  valor: number
  km_odometro: number | null
  fornecedor: string
}

export type EntradaQuebra = {
  tipo: 'quebra'
  base: string
  data: string
  m2_expedido: number
  m2_quebrado: number
  observacao: string
}

export type EntradaRegistro = EntradaViagem | EntradaAbastecimento | EntradaManutencao | EntradaQuebra

export async function salvarViagem(db: Db, usuarioId: string, entrada: EntradaViagem) {
  return db.transaction((tx) => salvarViagemEm(tx, usuarioId, entrada))
}

type Escritor = Parameters<Parameters<Db['transaction']>[0]>[0]

async function salvarViagemEm(tx: Escritor, usuarioId: string, entrada: EntradaViagem) {
    const contexto = await contextoPermitido(tx, usuarioId, entrada.base, 'viagem')
    const [cadastros] = await Promise.all([
      Promise.all([
        tx
          .select({ id: veiculo.id })
          .from(veiculo)
          .where(and(eq(veiculo.placa, entrada.veiculo), eq(veiculo.baseId, contexto.baseId))),
        tx
          .select({ id: colaborador.id })
          .from(colaborador)
          .where(and(eq(colaborador.nome, entrada.motorista), eq(colaborador.baseId, contexto.baseId))),
        tx
          .select({ id: rota.id })
          .from(rota)
          .where(and(eq(rota.nome, entrada.rota), eq(rota.baseId, contexto.baseId))),
      ]),
    ])
    const [veiculos, motoristas, rotas] = cadastros
    const veiculoId = veiculos[0]?.id
    const motoristaId = motoristas[0]?.id
    const rotaId = rotas[0]?.id
    if (!veiculoId || !motoristaId || !rotaId) throw new RegistroInvalido('cadastro inexistente')

    const chegadaCompleta = Boolean(entrada.data_chegada && entrada.hora_chegada && entrada.km_chegada !== null)
    const [salva] = await tx
      .insert(viagem)
      .values({
        baseId: contexto.baseId,
        veiculoId,
        motoristaId,
        rotaId,
        dataSaida: entrada.data_saida,
        horaSaida: entrada.hora_saida,
        dataPrevista: entrada.hora_prevista ? entrada.data_chegada : null,
        horaPrevista: entrada.hora_prevista,
        dataChegada: chegadaCompleta ? entrada.data_chegada : null,
        horaChegada: chegadaCompleta ? entrada.hora_chegada : null,
        kmSaida: entrada.km_saida,
        kmChegada: chegadaCompleta ? entrada.km_chegada : null,
        valorCarga: String(entrada.valor_carga),
        combustivel: String(entrada.combustivel),
        diarias: String(entrada.diarias),
        m2: String(entrada.m2),
        pesoKg: String(entrada.peso_kg),
        observacao: entrada.observacao,
        criadoPor: usuarioId,
        atualizadoPor: usuarioId,
      })
      .returning({ id: viagem.id })
    if (!salva) throw new RegistroInvalido('viagem não foi salva')
    return { ...salva, tipo: 'viagem' as const }
}

export function salvarRegistros(db: Db, usuarioId: string, entradas: EntradaRegistro[]) {
  return db.transaction(async (tx) => {
    const salvas: Array<{ id: string; tipo: EntradaRegistro['tipo'] }> = []
    const consumidas = new Set<number>()
    for (const [indice, entrada] of entradas.entries()) {
      if (consumidas.has(indice)) continue
      if (entrada.tipo === 'viagem') salvas.push(await salvarViagemEm(tx, usuarioId, entrada))
      if (entrada.tipo === 'manutencao') salvas.push(await salvarManutencaoEm(tx, usuarioId, entrada))
      if (entrada.tipo === 'quebra') salvas.push(await salvarQuebraEm(tx, usuarioId, entrada))
      if (entrada.tipo === 'abastecimento') {
        const grupo = entrada.viagem_longa
          ? entradas.flatMap((item, outroIndice) => {
              if (
                item.tipo === 'abastecimento' && item.viagem_longa && item.base === entrada.base &&
                item.data === entrada.data && item.placa === entrada.placa && item.rota === entrada.rota
              ) {
                consumidas.add(outroIndice)
                return [item]
              }
              return []
            })
          : [entrada]
        salvas.push(await salvarAbastecimentoEm(tx, usuarioId, grupo))
      }
    }
    return salvas
  })
}

export async function listarRegistros(db: Db, usuarioId: string, nomeBase?: string) {
  const basesPermitidas = await basesDoUsuario(db, usuarioId)
  const basesFiltradas = nomeBase ? basesPermitidas.filter((item) => item.nome === nomeBase) : basesPermitidas
  if (nomeBase && basesFiltradas.length === 0) throw new RegistroInvalido('base não permitida', true)
  const ids = basesFiltradas.map((item) => item.id)
  if (ids.length === 0) return []

  const [viagens, abastecimentos, manutencoes, quebras] = await Promise.all([
    db
      .select({
        id: viagem.id,
        base: base.nome,
        data_saida: viagem.dataSaida,
        hora_saida: viagem.horaSaida,
        data_chegada: viagem.dataChegada,
        hora_prevista: viagem.horaPrevista,
        hora_chegada: viagem.horaChegada,
        motorista: colaborador.nome,
        veiculo: veiculo.placa,
        rota: rota.nome,
        km_saida: viagem.kmSaida,
        km_chegada: viagem.kmChegada,
        km_rodados: viagem.kmRodados,
        valor_carga: viagem.valorCarga,
        combustivel: viagem.combustivel,
        diarias: viagem.diarias,
        custo_viagem: viagem.custoViagem,
        pct_custo: viagem.pctCusto,
        m2: viagem.m2,
        peso_kg: viagem.pesoKg,
        observacao: viagem.observacao,
        atraso_min: viagem.atrasoMin,
        registrado_em: viagem.criadoEm,
      })
      .from(viagem)
      .innerJoin(base, eq(base.id, viagem.baseId))
      .innerJoin(veiculo, eq(veiculo.id, viagem.veiculoId))
      .innerJoin(colaborador, eq(colaborador.id, viagem.motoristaId))
      .innerJoin(rota, eq(rota.id, viagem.rotaId))
      .where(and(inArray(viagem.baseId, ids), isNull(viagem.apagadoEm)))
      .orderBy(desc(viagem.criadoEm)),
    db
      .select({
        abastecimento_id: abastecimento.id,
        id: abastecimentoParada.id,
        base: base.nome,
        data: abastecimento.data,
        placa: veiculo.placa,
        rota: rota.nome,
        ordem: abastecimentoParada.ordem,
        litros: abastecimentoParada.litros,
        vl_litro: abastecimentoParada.vlLitro,
        valor_total: abastecimentoParada.valorTotal,
        km: abastecimentoParada.km,
        posto: abastecimentoParada.posto,
        registrado_em: abastecimento.criadoEm,
      })
      .from(abastecimento)
      .innerJoin(base, eq(base.id, abastecimento.baseId))
      .innerJoin(veiculo, eq(veiculo.id, abastecimento.veiculoId))
      .leftJoin(rota, eq(rota.id, abastecimento.rotaId))
      .innerJoin(abastecimentoParada, eq(abastecimentoParada.abastecimentoId, abastecimento.id))
      .where(and(inArray(abastecimento.baseId, ids), isNull(abastecimento.apagadoEm))),
    db
      .select({
        id: manutencao.id,
        base: base.nome,
        tipo_manutencao: manutencao.tipoManutencao,
        data_programada: manutencao.dataProgramada,
        data: manutencao.dataEntrada,
        data_entrada: manutencao.dataEntrada,
        hora_entrada: manutencao.horaEntrada,
        data_saida: manutencao.dataSaida,
        hora_saida: manutencao.horaSaida,
        placa: veiculo.placa,
        servico: manutencao.servico,
        valor: manutencao.valor,
        km_odometro: manutencao.kmOdometro,
        fornecedor: manutencao.fornecedor,
        dias_oficina: manutencao.diasOficina,
        status_documental: manutencao.statusDocumental,
        registrado_em: manutencao.criadoEm,
      })
      .from(manutencao)
      .innerJoin(base, eq(base.id, manutencao.baseId))
      .innerJoin(veiculo, eq(veiculo.id, manutencao.veiculoId))
      .where(and(inArray(manutencao.baseId, ids), isNull(manutencao.apagadoEm))),
    db
      .select({
        id: quebra.id,
        base: base.nome,
        data: quebra.data,
        m2_expedido: quebra.m2Expedido,
        m2_quebrado: quebra.m2Quebrado,
        pct_quebra: quebra.pctQuebra,
        observacao: quebra.observacao,
        registrado_em: quebra.criadoEm,
      })
      .from(quebra)
      .innerJoin(base, eq(base.id, quebra.baseId))
      .where(and(inArray(quebra.baseId, ids), isNull(quebra.apagadoEm))),
  ])

  const saida = viagens.map((linha) => ({
    ...linha,
    tipo: 'viagem' as const,
    registrado_em: linha.registrado_em.toISOString(),
    valor_carga: Number(linha.valor_carga),
    combustivel: Number(linha.combustivel),
    diarias: Number(linha.diarias),
    custo_viagem: Number(linha.custo_viagem),
    pct_custo: linha.pct_custo === null ? null : Number(linha.pct_custo),
    m2: linha.m2 === null ? 0 : Number(linha.m2),
    peso_kg: linha.peso_kg === null ? 0 : Number(linha.peso_kg),
  })) as Array<Record<string, unknown> & { registrado_em: string }>
  saida.push(...abastecimentos.map((linha) => ({
    ...linha,
    tipo: 'abastecimento',
    slot: linha.ordem === 1 ? 'Saída' : linha.ordem === 2 ? 'Interior' : 'Chegada',
    viagem_longa: abastecimentos.filter((item) => item.abastecimento_id === linha.abastecimento_id).length > 1,
    litros: Number(linha.litros),
    vl_litro: Number(linha.vl_litro),
    valor_total: Number(linha.valor_total),
    registrado_em: linha.registrado_em.toISOString(),
  })))
  saida.push(...manutencoes.map((linha) => ({
    ...linha,
    tipo: 'manutencao',
    valor: Number(linha.valor),
    status_documental: linha.status_documental ? 'concluido' : 'pendente',
    registrado_em: linha.registrado_em.toISOString(),
  })))
  saida.push(...quebras.map((linha) => ({
    ...linha,
    tipo: 'quebra',
    m2_expedido: Number(linha.m2_expedido),
    m2_quebrado: Number(linha.m2_quebrado),
    pct_quebra: Number(linha.pct_quebra),
    registrado_em: linha.registrado_em.toISOString(),
  })))
  return saida.sort((a, b) => b.registrado_em.localeCompare(a.registrado_em))
}

type Leitor = Pick<Db, 'select'>

async function contextoPermitido(db: Leitor, usuarioId: string, nomeBase: string, tipo: string) {
  const bases = await basesDoUsuario(db, usuarioId)
  const basePermitida = bases.find((item) => item.nome === nomeBase)
  const [permissao] = await db
    .select({ tipo: usuarioTipo.tipo })
    .from(usuarioTipo)
    .where(and(eq(usuarioTipo.usuarioId, usuarioId), eq(usuarioTipo.tipo, tipo as EntradaRegistro['tipo'])))
  if (!basePermitida || !permissao) throw new RegistroInvalido('operação não permitida', true)
  return { baseId: basePermitida.id }
}

async function salvarAbastecimentoEm(
  tx: Escritor,
  usuarioId: string,
  entradas: EntradaAbastecimento[],
) {
  const primeira = entradas[0]
  if (!primeira) throw new RegistroInvalido('abastecimento vazio')
  const contexto = await contextoPermitido(tx, usuarioId, primeira.base, 'abastecimento')
  const [[veiculoAtual], rotas] = await Promise.all([
    tx.select({ id: veiculo.id }).from(veiculo).where(and(eq(veiculo.placa, primeira.placa), eq(veiculo.baseId, contexto.baseId))),
    primeira.rota
      ? tx.select({ id: rota.id }).from(rota).where(and(eq(rota.nome, primeira.rota), eq(rota.baseId, contexto.baseId)))
      : Promise.resolve([]),
  ])
  if (!veiculoAtual || (primeira.rota && !rotas[0])) throw new RegistroInvalido('cadastro inexistente')
  const [salvo] = await tx.insert(abastecimento).values({
    baseId: contexto.baseId,
    veiculoId: veiculoAtual.id,
    rotaId: rotas[0]?.id ?? null,
    data: primeira.data,
    criadoPor: usuarioId,
    atualizadoPor: usuarioId,
  }).returning({ id: abastecimento.id })
  if (!salvo) throw new RegistroInvalido('abastecimento não foi salvo')
  await tx.insert(abastecimentoParada).values(entradas.map((item, indice) => ({
    abastecimentoId: salvo.id,
    ordem: indice + 1,
    litros: String(item.litros),
    vlLitro: String(item.vl_litro),
    km: item.km,
    posto: item.posto,
  })))
  return { id: salvo.id, tipo: 'abastecimento' as const }
}

async function salvarManutencaoEm(tx: Escritor, usuarioId: string, entrada: EntradaManutencao) {
  const contexto = await contextoPermitido(tx, usuarioId, entrada.base, 'manutencao')
  const [veiculoAtual] = await tx.select({ id: veiculo.id }).from(veiculo).where(and(eq(veiculo.placa, entrada.placa), eq(veiculo.baseId, contexto.baseId)))
  if (!veiculoAtual) throw new RegistroInvalido('veículo inexistente')
  const [salva] = await tx.insert(manutencao).values({
    baseId: contexto.baseId,
    veiculoId: veiculoAtual.id,
    tipoManutencao: entrada.tipo_manutencao,
    dataProgramada: entrada.data_programada,
    dataEntrada: entrada.data_entrada,
    horaEntrada: entrada.hora_entrada,
    dataSaida: entrada.data_saida,
    horaSaida: entrada.hora_saida,
    servico: entrada.servico,
    valor: String(entrada.valor),
    kmOdometro: entrada.km_odometro,
    fornecedor: entrada.fornecedor,
    criadoPor: usuarioId,
    atualizadoPor: usuarioId,
  }).returning({ id: manutencao.id })
  if (!salva) throw new RegistroInvalido('manutenção não foi salva')
  return { ...salva, tipo: 'manutencao' as const }
}

async function salvarQuebraEm(tx: Escritor, usuarioId: string, entrada: EntradaQuebra) {
  const contexto = await contextoPermitido(tx, usuarioId, entrada.base, 'quebra')
  const [salva] = await tx.insert(quebra).values({
    baseId: contexto.baseId,
    data: entrada.data,
    m2Expedido: String(entrada.m2_expedido),
    m2Quebrado: String(entrada.m2_quebrado),
    observacao: entrada.observacao,
    criadoPor: usuarioId,
    atualizadoPor: usuarioId,
  }).returning({ id: quebra.id })
  if (!salva) throw new RegistroInvalido('quebra não foi salva')
  return { ...salva, tipo: 'quebra' as const }
}

/** Os quatro tipos, na ordem em que a tela os mostra. */
const TIPOS = ['viagem', 'abastecimento', 'manutencao', 'quebra'] as const

export type ApagadosPorTipo = Record<(typeof TIPOS)[number], number>

/**
 * O "Limpar hoje" da tela de registro: tudo que a base lancou naquele dia sai da
 * lista.
 *
 * Soft-delete, nunca DELETE fisico. Sao lancamentos operacionais que alimentam
 * indicador, e o que a fase 2 precisa e que a linha suma da tela, nao do banco.
 *
 * A data comparada e a mesma que a tela usa para agrupar o dia: `data_saida` na
 * viagem, `data_entrada` na manutencao e `data` nas outras duas. O abastecimento
 * apagado leva junto as paradas, porque `listarRegistros` so as alcanca pelo pai.
 *
 * Autorizacao pelo `contextoPermitido`, tipo a tipo: o botao limpa os quatro de
 * uma vez, entao quem nao pode apagar um deles nao pode apagar o dia. Recusa da
 * base ou do tipo sai como 403 pelo mesmo caminho do POST.
 */
export async function apagarRegistrosDoDia(
  db: Db,
  usuarioId: string,
  nomeBase: string,
  data: string,
): Promise<{ apagados: number; por_tipo: ApagadosPorTipo }> {
  return await db.transaction(async (tx) => {
    let baseId = ''
    for (const tipo of TIPOS) {
      const contexto = await contextoPermitido(tx, usuarioId, nomeBase, tipo)
      baseId = contexto.baseId
    }

    const agora = new Date()
    const marca = { apagadoEm: agora, atualizadoPor: usuarioId, atualizadoEm: agora }
    const [viagens, abastecimentos, manutencoes, quebras] = await Promise.all([
      tx
        .update(viagem)
        .set(marca)
        .where(and(eq(viagem.baseId, baseId), eq(viagem.dataSaida, data), isNull(viagem.apagadoEm)))
        .returning({ id: viagem.id }),
      tx
        .update(abastecimento)
        .set(marca)
        .where(and(
          eq(abastecimento.baseId, baseId),
          eq(abastecimento.data, data),
          isNull(abastecimento.apagadoEm),
        ))
        .returning({ id: abastecimento.id }),
      tx
        .update(manutencao)
        .set(marca)
        .where(and(
          eq(manutencao.baseId, baseId),
          eq(manutencao.dataEntrada, data),
          isNull(manutencao.apagadoEm),
        ))
        .returning({ id: manutencao.id }),
      tx
        .update(quebra)
        .set(marca)
        .where(and(eq(quebra.baseId, baseId), eq(quebra.data, data), isNull(quebra.apagadoEm)))
        .returning({ id: quebra.id }),
    ])

    const por_tipo = {
      viagem: viagens.length,
      abastecimento: abastecimentos.length,
      manutencao: manutencoes.length,
      quebra: quebras.length,
    }
    const apagados = Object.values(por_tipo).reduce((soma, item) => soma + item, 0)
    return { apagados, por_tipo }
  })
}

/**
 * As bases do usuario no vocabulario do registro, onde a recusa so tem duas
 * formas e a de 403 e o booleano `proibido`. A leitura em si mora em
 * `permissao.ts`, que e a mesma para os quatro dominios.
 */
async function basesDoUsuario(db: Leitor, usuarioId: string) {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new RegistroInvalido('usuário inexistente', true)
  return permissao.bases
}
