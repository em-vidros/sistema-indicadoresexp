import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { colaborador } from '../schema/cadastro.ts'
import {
  integracao,
  integracaoAtividade,
  programaAtividade,
  programaCriterio,
  programaIntegracao,
  programaSemana,
} from '../schema/integracao.ts'
import { type PermissaoBases, lerPermissao } from './permissao.ts'

type Funcao = (typeof programaIntegracao.$inferSelect)['funcao']

export type CatalogoIntegracao = {
  colaboradores: Array<{
    id: string
    nome: string
    cargo: string | null
    admissao: string | null
    funcao: Funcao
  }>
  programas: Array<{
    id: string
    funcao: Funcao
    titulo: string
    semanas: Array<{
      numero: number
      titulo: string
      atividades: Array<{ id: string; codigo: string; titulo: string; descricao: string }>
    }>
    criterios: Array<{ criterio: string; padrao: string; frequencia: string }>
  }>
}

export type EntradaIntegracao = {
  colaboradorId: string | null
  nome: string
  cargo: string | null
  admissao: string | null
  programaId: string
  inicio: string | null
  coord: string | null
  gerente: string | null
  rh: string | null
  atividades: Array<{ atividadeId: string; feito: boolean; data: string | null }>
}

export type IntegracaoCompleta = {
  id: string
  colaboradorId: string | null
  programaId: string
  funcao: Funcao
  nome: string
  cargo: string | null
  admissao: string | null
  inicio: string | null
  coord: string | null
  gerente: string | null
  rh: string | null
  salvoEm: string
  atividades: Array<{
    atividadeId: string
    codigo: string
    feito: boolean
    data: string | null
  }>
}

/**
 * O erro carrega a resposta da rota, como em `atas.ts`: 400 para corpo errado,
 * 403 para recusa que nao revela nada e 404 para ficha de colaborador de outra
 * base, que o operador nem enxerga na lista. Dizer 403 nessa ultima confirmaria
 * que o id existe.
 */
export class IntegracaoInvalida extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message)
  }
}

/**
 * A ficha de integracao nao tem base propria: ela herda a do colaborador, que
 * `colaborador.base_id` ja guarda. Autorizar por join evita coluna nova e evita
 * que as duas se contradigam.
 *
 * A leitura das bases mora em `permissao.ts`, uma so para os quatro dominios;
 * aqui fica apenas a palavra que a integracao usa para recusar quem nao existe.
 */
async function permissaoDoUsuario(
  db: LeitorIntegracoes,
  usuarioId: string,
): Promise<PermissaoBases> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new IntegracaoInvalida('usuário inexistente', 403)
  return permissao
}

/**
 * Ficha sem colaborador vinculado existe: a tela deixa digitar o nome de quem
 * ainda nao esta no cadastro. Sem colaborador nao ha base, e essa ficha vale
 * como da empresa, igual a ata de base nula: todo mundo le, e escreve quem a
 * criou (ou o admin).
 */
function filtroVisivel(permissao: PermissaoBases): SQL | undefined {
  if (permissao.admin) return undefined
  if (permissao.ids.length === 0) return isNull(integracao.colaboradorId)
  return or(isNull(integracao.colaboradorId), inArray(colaborador.baseId, permissao.ids))
}

export async function catalogoIntegracao(
  db: Db,
  usuarioId: string,
): Promise<CatalogoIntegracao> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  // O catalogo entregava o cadastro de pessoal das tres bases a qualquer sessao.
  // O operador so precisa de quem trabalha nas bases dele.
  const daBase = permissao.admin
    ? undefined
    : permissao.ids.length === 0
      ? sql`false`
      : inArray(colaborador.baseId, permissao.ids)
  const [colaboradores, programas, semanas, atividades, criterios] = await Promise.all([
    db
      .select({
        id: colaborador.id,
        nome: colaborador.nome,
        cargo: colaborador.cargo,
        admissao: colaborador.admissao,
        funcao: colaborador.funcao,
      })
      .from(colaborador)
      .where(
        and(
          eq(colaborador.ativo, true),
          inArray(colaborador.funcao, ['motorista', 'ajudante']),
          daBase,
        ),
      )
      .orderBy(colaborador.nome),
    db
      .select({ id: programaIntegracao.id, funcao: programaIntegracao.funcao, titulo: programaIntegracao.titulo })
      .from(programaIntegracao)
      .where(eq(programaIntegracao.ativo, true))
      .orderBy(sql`${programaIntegracao.funcao}::text`),
    db
      .select({
        id: programaSemana.id,
        programaId: programaSemana.programaId,
        numero: programaSemana.numero,
        titulo: programaSemana.titulo,
      })
      .from(programaSemana)
      .orderBy(programaSemana.numero),
    db
      .select({
        id: programaAtividade.id,
        semanaId: programaAtividade.semanaId,
        codigo: programaAtividade.codigo,
        titulo: programaAtividade.titulo,
        descricao: programaAtividade.descricao,
      })
      .from(programaAtividade)
      .orderBy(programaAtividade.ordem),
    db
      .select({
        programaId: programaCriterio.programaId,
        criterio: programaCriterio.criterio,
        padrao: programaCriterio.padrao,
        frequencia: programaCriterio.frequencia,
      })
      .from(programaCriterio)
      .orderBy(programaCriterio.ordem),
  ])

  return {
    colaboradores,
    programas: programas.map((programa) => ({
      ...programa,
      semanas: semanas
        .filter((semana) => semana.programaId === programa.id)
        .map((semana) => ({
          numero: semana.numero,
          titulo: semana.titulo,
          atividades: atividades
            .filter((atividade) => atividade.semanaId === semana.id)
            .map(({ semanaId: _, ...atividade }) => atividade),
        })),
      criterios: criterios
        .filter((criterio) => criterio.programaId === programa.id)
        .map(({ programaId: _, ...criterio }) => criterio),
    })),
  }
}

type LeitorIntegracoes = Pick<Db, 'select'>

export async function listarIntegracoes(
  db: LeitorIntegracoes,
  usuarioId: string,
): Promise<IntegracaoCompleta[]> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  const linhas = await db
    .select({
      id: integracao.id,
      colaboradorId: integracao.colaboradorId,
      programaId: integracao.programaId,
      funcao: programaIntegracao.funcao,
      nome: integracao.nomeLivre,
      cargo: integracao.cargo,
      admissao: integracao.admissao,
      inicio: integracao.inicio,
      coord: integracao.coord,
      gerente: integracao.gerente,
      rh: integracao.rh,
      salvoEm: integracao.atualizadoEm,
    })
    .from(integracao)
    .innerJoin(programaIntegracao, eq(programaIntegracao.id, integracao.programaId))
    // `leftJoin`, e nao `innerJoin`: a ficha de nome livre nao tem colaborador e
    // sumiria da lista de todo mundo, inclusive da do admin.
    .leftJoin(colaborador, eq(colaborador.id, integracao.colaboradorId))
    .where(and(isNull(integracao.apagadoEm), filtroVisivel(permissao)))
    .orderBy(desc(integracao.atualizadoEm))

  const ids = linhas.map((linha) => linha.id)
  const progresso =
    ids.length === 0
      ? []
      : await db
          .select({
            integracaoId: integracaoAtividade.integracaoId,
            atividadeId: integracaoAtividade.atividadeId,
            codigo: programaAtividade.codigo,
            feito: integracaoAtividade.feito,
            data: integracaoAtividade.data,
          })
          .from(integracaoAtividade)
          .innerJoin(programaAtividade, eq(programaAtividade.id, integracaoAtividade.atividadeId))
          .innerJoin(programaSemana, eq(programaSemana.id, programaAtividade.semanaId))
          .where(inArray(integracaoAtividade.integracaoId, ids))
          .orderBy(programaSemana.numero, programaAtividade.ordem)

  return linhas.map((linha) => ({
    ...linha,
    salvoEm: linha.salvoEm.toISOString(),
    atividades: progresso
      .filter((atividade) => atividade.integracaoId === linha.id)
      .map(({ integracaoId: _, ...atividade }) => atividade),
  }))
}

export async function criarIntegracao(
  db: Db,
  usuarioId: string,
  entrada: EntradaIntegracao,
): Promise<IntegracaoCompleta> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  return await gravarIntegracao(db, usuarioId, permissao, entrada, null)
}

export async function atualizarIntegracao(
  db: Db,
  usuarioId: string,
  id: string,
  entrada: EntradaIntegracao,
): Promise<IntegracaoCompleta> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  return await gravarIntegracao(db, usuarioId, permissao, entrada, id)
}

/** A ficha que o usuário pode reescrever, ou o erro que a rota devolve. */
async function integracaoParaEscrita(
  db: LeitorIntegracoes,
  permissao: PermissaoBases,
  usuarioId: string,
  id: string,
): Promise<void> {
  const [alvo] = await db
    .select({
      colaboradorId: integracao.colaboradorId,
      baseId: colaborador.baseId,
      criadoPor: integracao.criadoPor,
    })
    .from(integracao)
    .leftJoin(colaborador, eq(colaborador.id, integracao.colaboradorId))
    .where(and(eq(integracao.id, id), isNull(integracao.apagadoEm)))
  if (!alvo) throw new IntegracaoInvalida('integracao inexistente', 404)
  if (permissao.admin) return
  if (alvo.colaboradorId === null) {
    if (alvo.criadoPor === usuarioId) return
    throw new IntegracaoInvalida('ficha sem colaborador: só quem a criou altera', 403)
  }
  if (alvo.baseId === null || !permissao.ids.includes(alvo.baseId)) {
    throw new IntegracaoInvalida('integracao inexistente', 404)
  }
}

function gravarIntegracao(
  db: Db,
  usuarioId: string,
  permissao: PermissaoBases,
  entrada: EntradaIntegracao,
  idAtual: string | null,
): Promise<IntegracaoCompleta> {
  return db.transaction(async (tx) => {
    if (idAtual) await integracaoParaEscrita(tx, permissao, usuarioId, idAtual)
    const [programa] = await tx
      .select({ id: programaIntegracao.id, funcao: programaIntegracao.funcao })
      .from(programaIntegracao)
      .where(and(eq(programaIntegracao.id, entrada.programaId), eq(programaIntegracao.ativo, true)))
    if (!programa) throw new IntegracaoInvalida('programa inexistente')

    if (entrada.colaboradorId) {
      const [pessoa] = await tx
        .select({ funcao: colaborador.funcao, baseId: colaborador.baseId })
        .from(colaborador)
        .where(and(eq(colaborador.id, entrada.colaboradorId), eq(colaborador.ativo, true)))
      if (!pessoa || pessoa.funcao !== programa.funcao) {
        throw new IntegracaoInvalida('colaborador fora do programa')
      }
      // A ficha e do colaborador, entao a base dele decide quem pode escrever.
      // 403 e nao 404 aqui: o id do colaborador veio no corpo, quem enviou ja
      // sabe que ele existe, e a recusa nao conta nada novo.
      if (!permissao.admin && !permissao.ids.includes(pessoa.baseId)) {
        throw new IntegracaoInvalida('colaborador fora das suas bases', 403)
      }
    }

    const idsAtividade = entrada.atividades.map((atividade) => atividade.atividadeId)
    if (idsAtividade.length > 0) {
      const validas = await tx
        .select({ id: programaAtividade.id })
        .from(programaAtividade)
        .innerJoin(programaSemana, eq(programaSemana.id, programaAtividade.semanaId))
        .where(
          and(
            eq(programaSemana.programaId, entrada.programaId),
            inArray(programaAtividade.id, idsAtividade),
          ),
        )
      if (validas.length !== idsAtividade.length) {
        throw new IntegracaoInvalida('atividade fora do programa')
      }
    }

    const agora = new Date()
    const valores = {
      colaboradorId: entrada.colaboradorId,
      nomeLivre: entrada.nome,
      cargo: entrada.cargo,
      admissao: entrada.admissao,
      programaId: entrada.programaId,
      inicio: entrada.inicio,
      coord: entrada.coord,
      gerente: entrada.gerente,
      rh: entrada.rh,
      atualizadoPor: usuarioId,
      atualizadoEm: agora,
    }
    const alvo = idAtual
      ? await tx
          .update(integracao)
          .set(valores)
          .where(and(eq(integracao.id, idAtual), isNull(integracao.apagadoEm)))
          .returning({ id: integracao.id })
      : await tx
          .insert(integracao)
          .values({ ...valores, criadoPor: usuarioId })
          .returning({ id: integracao.id })
    const gravada = alvo[0]
    if (!gravada) throw new IntegracaoInvalida('integracao inexistente')

    if (idAtual) {
      await tx.delete(integracaoAtividade).where(eq(integracaoAtividade.integracaoId, gravada.id))
    }

    if (entrada.atividades.length > 0) {
      await tx.insert(integracaoAtividade).values(
        entrada.atividades.map((atividade) => ({
          integracaoId: gravada.id,
          atividadeId: atividade.atividadeId,
          feito: atividade.feito,
          data: atividade.data,
        })),
      )
    }

    const lista = await listarIntegracoes(tx, usuarioId)
    const completa = lista.find((item) => item.id === gravada.id)
    if (!completa) throw new Error('a integracao gravada nao voltou na leitura')
    return completa
  })
}
