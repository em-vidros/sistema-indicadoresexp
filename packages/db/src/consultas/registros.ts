import { and, desc, eq, inArray, isNull, lt, max, or, sql } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { usuarioTipo } from '../schema/auth.ts'
import { base, colaborador, rota, veiculo } from '../schema/cadastro.ts'
import { itemPreventivo, tipoPreventivo } from '../schema/preventiva.ts'
import { abastecimento, abastecimentoParada, manutencao, quebra, viagem } from '../schema/registro.ts'
import { mesEstaFechado } from './fechamento.ts'
import { lerPermissao } from './permissao.ts'

export class RegistroInvalido extends Error {
  constructor(message: string, readonly proibido = false) {
    super(message)
  }
}

/** O registro que a tela quer editar nao existe mais, ou ja foi apagado. */
export class RegistroAusente extends RegistroInvalido {
  constructor() {
    super('registro não encontrado')
  }
}

export type EntradaViagem = {
  tipo: 'viagem'
  base: string
  data_saida: string
  hora_saida: string | null
  data_chegada: string | null
  hora_prevista: string | null
  data_prevista: string | null
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
  /**
   * O abastecimento embutido no lancamento de viagem -- litros/vl_litro/posto
   * digitados ali mesmo, sem passar pela aba Abastecimento. `litros` e `vl_litro`
   * vem juntos ou nenhum dos dois; so com os dois presentes um `abastecimento`
   * nasce (ou se atualiza) vinculado a esta viagem por `viagemId`.
   */
  litros: number | null
  vl_litro: number | null
  posto: string | null
}

export type EntradaAbastecimento = {
  tipo: 'abastecimento'
  base: string
  data: string
  placa: string
  motorista: string
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

async function valoresDaViagem(tx: Escritor, usuarioId: string, entrada: EntradaViagem) {
    const contexto = await contextoPermitido(tx, usuarioId, entrada.base, 'viagem', entrada.data_saida)
    const [veiculos, motoristas, rotas] = await Promise.all([
      tx
        .select({ id: veiculo.id })
        .from(veiculo)
        .where(and(eq(veiculo.placa, entrada.veiculo), eq(veiculo.baseId, contexto.baseId))),
      tx
        .select({ id: colaborador.id })
        .from(colaborador)
        .where(and(eq(colaborador.nome, entrada.motorista), eq(colaborador.baseId, contexto.baseId))),
      tx
        .select({ id: rota.id, local: rota.local })
        .from(rota)
        .where(and(eq(rota.nome, entrada.rota), eq(rota.baseId, contexto.baseId))),
    ])
    const veiculoId = veiculos[0]?.id
    const motoristaId = motoristas[0]?.id
    const rotaId = rotas[0]?.id
    if (!veiculoId || !motoristaId || !rotaId) throw new RegistroInvalido('cadastro inexistente')

    // Rota local (SAO LUIS, lojas) nao tem diaria nem abastecimento: o custo da viagem pode ser
    // zero. Nas demais, combustivel mais diarias tem que ser maior que zero, e quem recusa e
    // aqui, porque o banco nao tem mais o CHECK e nao enxerga `rota.local`.
    if (entrada.combustivel + entrada.diarias <= 0 && !rotas[0]?.local) {
      throw new RegistroInvalido('informe combustível ou diárias: a soma dos dois tem que ser maior que zero')
    }

    const chegadaCompleta = Boolean(entrada.data_chegada && entrada.hora_chegada && entrada.km_chegada !== null)
    return {
      baseId: contexto.baseId,
      veiculoId,
      motoristaId,
      rotaId,
      dataSaida: entrada.data_saida,
      horaSaida: entrada.hora_saida,
      dataPrevista: entrada.data_prevista,
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
    }
}

async function salvarViagemEm(tx: Escritor, usuarioId: string, entrada: EntradaViagem) {
    const valores = await valoresDaViagem(tx, usuarioId, entrada)
    const [salva] = await tx
      .insert(viagem)
      .values({ ...valores, criadoPor: usuarioId, atualizadoPor: usuarioId })
      .returning({ id: viagem.id })
    if (!salva) throw new RegistroInvalido('viagem não foi salva')
    await sincronizarAbastecimentoDaViagem(tx, usuarioId, entrada, salva.id, valores)
    return { ...salva, tipo: 'viagem' as const }
}

/**
 * O abastecimento que nasce embutido no lancamento de viagem (litros/vl_litro/posto
 * digitados ali mesmo), vinculado por `abastecimento.viagemId`. Cria quando vieram
 * litros e ainda nao existia, atualiza quando ja existia, e apaga (soft-delete) quando
 * os litros sumiram de uma edicao -- os tres casos do mesmo lado do `atualizarRegistro`
 * e do `salvarViagemEm`, por isso uma funcao so para os dois caminhos.
 *
 * Reaproveita base/veiculo/motorista/rota que `valoresDaViagem` ja resolveu, sem bater
 * no cadastro de novo. A permissao de 'abastecimento' so e cobrada quando litros vem
 * preenchido -- sem isso, quem so tem permissao de 'viagem' nunca precisa dela.
 */
async function sincronizarAbastecimentoDaViagem(
  tx: Escritor,
  usuarioId: string,
  entrada: EntradaViagem,
  viagemId: string,
  valoresViagem: { baseId: string; veiculoId: string; motoristaId: string; rotaId: string },
) {
  const [existente] = await tx
    .select({ id: abastecimento.id })
    .from(abastecimento)
    .where(and(eq(abastecimento.viagemId, viagemId), isNull(abastecimento.apagadoEm)))

  if (entrada.litros === null || entrada.vl_litro === null) {
    if (existente) {
      const agora = new Date()
      await tx
        .update(abastecimento)
        .set({ apagadoEm: agora, atualizadoPor: usuarioId, atualizadoEm: agora })
        .where(eq(abastecimento.id, existente.id))
    }
    return
  }

  await contextoPermitido(tx, usuarioId, entrada.base, 'abastecimento', entrada.data_saida)
  const parada = {
    ordem: 1,
    litros: String(entrada.litros),
    vlLitro: String(entrada.vl_litro),
    // `abastecimento_parada_nao_negativo_ck` recusa km = 0 (so aceita nulo ou positivo),
    // o mesmo tratamento que o abastecimento avulso ja da ao campo.
    km: entrada.km_chegada || null,
    posto: entrada.posto,
  }

  if (existente) {
    const agora = new Date()
    await tx
      .update(abastecimento)
      .set({
        baseId: valoresViagem.baseId,
        veiculoId: valoresViagem.veiculoId,
        rotaId: valoresViagem.rotaId,
        motoristaId: valoresViagem.motoristaId,
        data: entrada.data_saida,
        atualizadoPor: usuarioId,
        atualizadoEm: agora,
      })
      .where(eq(abastecimento.id, existente.id))
    await tx.update(abastecimentoParada).set(parada).where(eq(abastecimentoParada.abastecimentoId, existente.id))
    return
  }

  const [salvo] = await tx
    .insert(abastecimento)
    .values({
      baseId: valoresViagem.baseId,
      veiculoId: valoresViagem.veiculoId,
      rotaId: valoresViagem.rotaId,
      motoristaId: valoresViagem.motoristaId,
      data: entrada.data_saida,
      viagemId,
      criadoPor: usuarioId,
      atualizadoPor: usuarioId,
    })
    .returning({ id: abastecimento.id })
  if (!salvo) throw new RegistroInvalido('abastecimento da viagem não foi salvo')
  await tx.insert(abastecimentoParada).values({ ...parada, abastecimentoId: salvo.id })
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
        data_prevista: viagem.dataPrevista,
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
        litros: abastecimentoParada.litros,
        vl_litro: abastecimentoParada.vlLitro,
      })
      .from(viagem)
      .innerJoin(base, eq(base.id, viagem.baseId))
      .innerJoin(veiculo, eq(veiculo.id, viagem.veiculoId))
      .innerJoin(colaborador, eq(colaborador.id, viagem.motoristaId))
      .innerJoin(rota, eq(rota.id, viagem.rotaId))
      // O abastecimento embutido nesta viagem (se tiver um): so existe 1 por viagem
      // (`abastecimento_viagem_uk`) e so 1 parada (`ordem = 1`), entao o join nunca
      // multiplica linha de viagem.
      .leftJoin(abastecimento, and(eq(abastecimento.viagemId, viagem.id), isNull(abastecimento.apagadoEm)))
      .leftJoin(
        abastecimentoParada,
        and(eq(abastecimentoParada.abastecimentoId, abastecimento.id), eq(abastecimentoParada.ordem, 1)),
      )
      .where(and(inArray(viagem.baseId, ids), isNull(viagem.apagadoEm)))
      .orderBy(desc(viagem.criadoEm)),
    db
      .select({
        abastecimento_id: abastecimento.id,
        id: abastecimentoParada.id,
        base: base.nome,
        data: abastecimento.data,
        placa: veiculo.placa,
        motorista: colaborador.nome,
        rota: rota.nome,
        viagem_id: abastecimento.viagemId,
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
      // Anulavel: abastecimento gravado antes da coluna existir nao tem motorista.
      .leftJoin(colaborador, eq(colaborador.id, abastecimento.motoristaId))
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
    litros: linha.litros === null ? null : Number(linha.litros),
    vl_litro: linha.vl_litro === null ? null : Number(linha.vl_litro),
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
    // Lavagem nao exige orcamento nem OS: sem anexo, nao fica pendente de documento.
    status_documental: linha.status_documental || servicoDispensaDocumento(linha.servico) ? 'concluido' : 'pendente',
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

/**
 * `data` e a data do proprio lancamento (nao a de hoje), porque o fechamento trava pelo
 * mes do registro: lancar ou corrigir um dia de marco so e barrado se marco estiver
 * fechado, mesmo lancado em abril.
 */
async function contextoPermitido(db: Leitor, usuarioId: string, nomeBase: string, tipo: string, data: string) {
  const bases = await basesDoUsuario(db, usuarioId)
  const basePermitida = bases.find((item) => item.nome === nomeBase)
  const [permissao] = await db
    .select({ tipo: usuarioTipo.tipo })
    .from(usuarioTipo)
    .where(and(eq(usuarioTipo.usuarioId, usuarioId), eq(usuarioTipo.tipo, tipo as EntradaRegistro['tipo'])))
  if (!basePermitida || !permissao) throw new RegistroInvalido('operação não permitida', true)
  if (await mesEstaFechado(db, basePermitida.id, data)) {
    throw new RegistroInvalido(`${nomeBase} está com o mês de ${data.slice(0, 7)} fechado para lançamentos`, true)
  }
  return { baseId: basePermitida.id }
}

async function valoresDoAbastecimento(tx: Escritor, usuarioId: string, entradas: EntradaAbastecimento[]) {
  const primeira = entradas[0]
  if (!primeira) throw new RegistroInvalido('abastecimento vazio')
  const contexto = await contextoPermitido(tx, usuarioId, primeira.base, 'abastecimento', primeira.data)
  const [[veiculoAtual], rotas, motoristas] = await Promise.all([
    tx.select({ id: veiculo.id }).from(veiculo).where(and(eq(veiculo.placa, primeira.placa), eq(veiculo.baseId, contexto.baseId))),
    primeira.rota
      ? tx.select({ id: rota.id }).from(rota).where(and(eq(rota.nome, primeira.rota), eq(rota.baseId, contexto.baseId)))
      : Promise.resolve([]),
    tx
      .select({ id: colaborador.id })
      .from(colaborador)
      .where(and(eq(colaborador.nome, primeira.motorista), eq(colaborador.baseId, contexto.baseId))),
  ])
  if (!veiculoAtual || (primeira.rota && !rotas[0]) || !motoristas[0]) throw new RegistroInvalido('cadastro inexistente')
  return {
    cabecalho: {
      baseId: contexto.baseId,
      veiculoId: veiculoAtual.id,
      rotaId: rotas[0]?.id ?? null,
      motoristaId: motoristas[0].id,
      data: primeira.data,
    },
    paradas: entradas.map((item, indice) => ({
      ordem: indice + 1,
      litros: String(item.litros),
      vlLitro: String(item.vl_litro),
      km: item.km,
      posto: item.posto,
    })),
  }
}

async function salvarAbastecimentoEm(
  tx: Escritor,
  usuarioId: string,
  entradas: EntradaAbastecimento[],
) {
  const { cabecalho, paradas } = await valoresDoAbastecimento(tx, usuarioId, entradas)
  const [salvo] = await tx.insert(abastecimento).values({
    ...cabecalho,
    criadoPor: usuarioId,
    atualizadoPor: usuarioId,
  }).returning({ id: abastecimento.id })
  if (!salvo) throw new RegistroInvalido('abastecimento não foi salvo')
  await tx.insert(abastecimentoParada).values(paradas.map((parada) => ({ ...parada, abastecimentoId: salvo.id })))
  return { id: salvo.id, tipo: 'abastecimento' as const }
}

async function valoresDaManutencao(tx: Escritor, usuarioId: string, entrada: EntradaManutencao) {
  const contexto = await contextoPermitido(tx, usuarioId, entrada.base, 'manutencao', entrada.data_entrada)
  const [veiculoAtual] = await tx.select({ id: veiculo.id }).from(veiculo).where(and(eq(veiculo.placa, entrada.placa), eq(veiculo.baseId, contexto.baseId)))
  if (!veiculoAtual) throw new RegistroInvalido('veículo inexistente')
  return {
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
  }
}

async function salvarManutencaoEm(tx: Escritor, usuarioId: string, entrada: EntradaManutencao) {
  const valores = await valoresDaManutencao(tx, usuarioId, entrada)
  const [salva] = await tx.insert(manutencao).values({
    ...valores,
    criadoPor: usuarioId,
    atualizadoPor: usuarioId,
  }).returning({ id: manutencao.id })
  if (!salva) throw new RegistroInvalido('manutenção não foi salva')
  await renovarItemPreventivo(tx, usuarioId, valores.veiculoId, entrada)
  return { ...salva, tipo: 'manutencao' as const }
}

/** Servicos que nao precisam de orcamento nem OS anexados para contar como documentados. */
function servicoDispensaDocumento(servico: unknown): boolean {
  return typeof servico === 'string' && servico.trim().toLowerCase() === 'lavagem'
}

/**
 * Lancar uma preventiva renova a contagem do item do plano: o `ultimo_km` passa a ser o
 * km da manutencao (ou, sem ele, o maior km de chegada ja registrado do veiculo), e o
 * vencimento recalcula a partir dai. So sobe: lancar um servico atrasado, de km menor,
 * nao faz o item andar para tras. Servico fora do catalogo (ou item que o veiculo nao
 * tem no plano) nao muda nada.
 */
async function renovarItemPreventivo(
  tx: Escritor,
  usuarioId: string,
  veiculoId: string,
  entrada: EntradaManutencao,
): Promise<void> {
  if (entrada.tipo_manutencao !== 'preventiva') return
  const [tipo] = await tx
    .select({ id: tipoPreventivo.id })
    .from(tipoPreventivo)
    .where(sql`lower(${tipoPreventivo.nome}) = ${entrada.servico.trim().toLowerCase()}`)
  if (!tipo) return
  let km = entrada.km_odometro
  if (!km) {
    const [ultimo] = await tx
      .select({ km: max(viagem.kmChegada) })
      .from(viagem)
      .where(and(eq(viagem.veiculoId, veiculoId), isNull(viagem.apagadoEm)))
    km = ultimo?.km ?? null
  }
  if (!km || km <= 0) return
  await tx
    .update(itemPreventivo)
    .set({ ultimoKm: km, atualizadoPor: usuarioId, atualizadoEm: new Date() })
    .where(and(
      eq(itemPreventivo.veiculoId, veiculoId),
      eq(itemPreventivo.tipoPreventivoId, tipo.id),
      isNull(itemPreventivo.apagadoEm),
      or(isNull(itemPreventivo.ultimoKm), lt(itemPreventivo.ultimoKm, km)),
    ))
}

async function valoresDaQuebra(tx: Escritor, usuarioId: string, entrada: EntradaQuebra) {
  const contexto = await contextoPermitido(tx, usuarioId, entrada.base, 'quebra', entrada.data)
  return {
    baseId: contexto.baseId,
    data: entrada.data,
    m2Expedido: String(entrada.m2_expedido),
    m2Quebrado: String(entrada.m2_quebrado),
    observacao: entrada.observacao,
  }
}

async function salvarQuebraEm(tx: Escritor, usuarioId: string, entrada: EntradaQuebra) {
  const valores = await valoresDaQuebra(tx, usuarioId, entrada)
  const [salva] = await tx.insert(quebra).values({
    ...valores,
    criadoPor: usuarioId,
    atualizadoPor: usuarioId,
  }).returning({ id: quebra.id })
  if (!salva) throw new RegistroInvalido('quebra não foi salva')
  return { ...salva, tipo: 'quebra' as const }
}

/**
 * A edicao de um lancamento ja gravado, pela tela de registro.
 *
 * Reescreve o registro inteiro com o que a tela mandou, pela mesma montagem do POST, e
 * marca quem mexeu e quando. O abastecimento troca o cabecalho e refaz as paradas: a tela
 * edita o grupo todo, e a ordem das paradas e a posicao dentro dele.
 *
 * A permissao e cobrada duas vezes. Sobre a base onde o registro esta hoje, para quem nao
 * enxerga a base nao conseguir mexer so por saber o id; e sobre a base que chega, porque
 * mudar a base e lancar na nova. Registro apagado e registro inexistente saem iguais.
 */
export async function atualizarRegistro(
  db: Db,
  usuarioId: string,
  id: string,
  entradas: EntradaRegistro[],
): Promise<{ id: string; tipo: EntradaRegistro['tipo'] }> {
  const primeira = entradas[0]
  if (!primeira) throw new RegistroInvalido('registro vazio')
  const agora = new Date()
  const marca = { atualizadoPor: usuarioId, atualizadoEm: agora }

  return await db.transaction(async (tx) => {
    // O mes fechado e cobrado duas vezes: aqui, sobre a data onde o registro esta hoje (quem
    // nao pode editar um marco fechado nao pode so porque mudou a data para abril), e de novo
    // dentro de `valoresDaX`, sobre a data nova que a tela mandou (contextoPermitido la dentro).
    if (primeira.tipo === 'viagem') {
      const [atual] = await tx
        .select({ nome: base.nome, data: viagem.dataSaida })
        .from(viagem)
        .innerJoin(base, eq(base.id, viagem.baseId))
        .where(and(eq(viagem.id, id), isNull(viagem.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'viagem', atual.data)
      const valores = await valoresDaViagem(tx, usuarioId, primeira)
      await tx.update(viagem).set({ ...valores, ...marca }).where(eq(viagem.id, id))
      await sincronizarAbastecimentoDaViagem(tx, usuarioId, primeira, id, valores)
    } else if (primeira.tipo === 'manutencao') {
      const [atual] = await tx
        .select({ nome: base.nome, data: manutencao.dataEntrada })
        .from(manutencao)
        .innerJoin(base, eq(base.id, manutencao.baseId))
        .where(and(eq(manutencao.id, id), isNull(manutencao.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'manutencao', atual.data)
      const valores = await valoresDaManutencao(tx, usuarioId, primeira)
      await tx.update(manutencao).set({ ...valores, ...marca }).where(eq(manutencao.id, id))
    } else if (primeira.tipo === 'quebra') {
      const [atual] = await tx
        .select({ nome: base.nome, data: quebra.data })
        .from(quebra)
        .innerJoin(base, eq(base.id, quebra.baseId))
        .where(and(eq(quebra.id, id), isNull(quebra.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'quebra', atual.data)
      const valores = await valoresDaQuebra(tx, usuarioId, primeira)
      await tx.update(quebra).set({ ...valores, ...marca }).where(eq(quebra.id, id))
    } else {
      const [atual] = await tx
        .select({ nome: base.nome, data: abastecimento.data })
        .from(abastecimento)
        .innerJoin(base, eq(base.id, abastecimento.baseId))
        .where(and(eq(abastecimento.id, id), isNull(abastecimento.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'abastecimento', atual.data)
      const paradasNovas = entradas.filter((e): e is EntradaAbastecimento => e.tipo === 'abastecimento')
      const { cabecalho, paradas } = await valoresDoAbastecimento(tx, usuarioId, paradasNovas)
      await tx.update(abastecimento).set({ ...cabecalho, ...marca }).where(eq(abastecimento.id, id))
      await tx.delete(abastecimentoParada).where(eq(abastecimentoParada.abastecimentoId, id))
      await tx.insert(abastecimentoParada).values(paradas.map((parada) => ({ ...parada, abastecimentoId: id })))
    }
    return { id, tipo: primeira.tipo }
  })
}

/**
 * Apaga um lancamento so, pela mesma dupla tipo+id que a edicao usa -- no abastecimento,
 * o id do cabecalho, e as paradas somem junto porque `listarRegistros` so enxerga o grupo
 * pelo `apagadoEm` do cabecalho. Soft-delete, igual ao resto da casa: quem errou um
 * lancamento o tira do historico, mas a linha continua no banco.
 */
export async function apagarRegistro(
  db: Db,
  usuarioId: string,
  tipo: EntradaRegistro['tipo'],
  id: string,
): Promise<void> {
  const agora = new Date()
  const marca = { apagadoEm: agora, atualizadoPor: usuarioId, atualizadoEm: agora }

  await db.transaction(async (tx) => {
    if (tipo === 'viagem') {
      const [atual] = await tx
        .select({ nome: base.nome, data: viagem.dataSaida })
        .from(viagem)
        .innerJoin(base, eq(base.id, viagem.baseId))
        .where(and(eq(viagem.id, id), isNull(viagem.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'viagem', atual.data)
      await tx.update(viagem).set(marca).where(eq(viagem.id, id))
      // Soft-delete nao aciona o `onDelete: cascade` do FK -- esse so dispara num DELETE
      // fisico, que esta casa nunca faz. O abastecimento embutido precisa ser apagado
      // explicitamente junto, senao sobrevive sozinho no historico sem a viagem dele.
      await tx
        .update(abastecimento)
        .set(marca)
        .where(and(eq(abastecimento.viagemId, id), isNull(abastecimento.apagadoEm)))
    } else if (tipo === 'manutencao') {
      const [atual] = await tx
        .select({ nome: base.nome, data: manutencao.dataEntrada })
        .from(manutencao)
        .innerJoin(base, eq(base.id, manutencao.baseId))
        .where(and(eq(manutencao.id, id), isNull(manutencao.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'manutencao', atual.data)
      await tx.update(manutencao).set(marca).where(eq(manutencao.id, id))
    } else if (tipo === 'quebra') {
      const [atual] = await tx
        .select({ nome: base.nome, data: quebra.data })
        .from(quebra)
        .innerJoin(base, eq(base.id, quebra.baseId))
        .where(and(eq(quebra.id, id), isNull(quebra.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'quebra', atual.data)
      await tx.update(quebra).set(marca).where(eq(quebra.id, id))
    } else {
      const [atual] = await tx
        .select({ nome: base.nome, data: abastecimento.data })
        .from(abastecimento)
        .innerJoin(base, eq(base.id, abastecimento.baseId))
        .where(and(eq(abastecimento.id, id), isNull(abastecimento.apagadoEm)))
      if (!atual) throw new RegistroAusente()
      await contextoPermitido(tx, usuarioId, atual.nome, 'abastecimento', atual.data)
      await tx.update(abastecimento).set(marca).where(eq(abastecimento.id, id))
    }
  })
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
      const contexto = await contextoPermitido(tx, usuarioId, nomeBase, tipo, data)
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
