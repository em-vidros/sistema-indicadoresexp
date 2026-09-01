import { and, asc, desc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { ata, ataParticipante, ataTopico } from '../schema/ata.ts'
import { colaborador } from '../schema/cadastro.ts'
import { arquivo } from '../schema/documento.ts'
import { type PermissaoBases, lerPermissao } from './permissao.ts'

export type EntradaAta = {
  numero: string | null
  titulo: string
  data: string
  horario: string | null
  local: string | null
  convocada: string | null
  facilitadores: string | null
  participantesGeral: string | null
  gestor1Nome: string | null
  gestor1Cargo: string | null
  gestor2Nome: string | null
  gestor2Cargo: string | null
  importada: boolean
  topicos: Array<{
    discussao: string | null
    conclusao: string | null
    responsavel: string | null
    prazo: string | null
  }>
  participantes: Array<{
    colaboradorId: string | null
    nomeExterno: string | null
    presente: boolean
  }>
}

export type AtaCompleta = EntradaAta & {
  id: string
  salvoEm: string
  temPdf: boolean
}

/**
 * O erro carrega a resposta que a rota deve dar. `RegistroInvalido` usa um
 * booleano `proibido` porque la so existem 400 e 403; aqui a recusa tem tres
 * formas, e a terceira e 404: ata de outra base a operadora nem enxerga, e
 * responder 403 nela ja confirmaria que aquele id existe.
 */
export class AtaInvalida extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message)
  }
}

export type MetadadoPdfAta = {
  id: string
  nomeOriginal: string
  mime: string
  tamanho: number
  caminho: string
  sha256: string
}

type LeitorAtas = Pick<Db, 'select'>

/**
 * Quem esta pedindo, em termos de base. A leitura mora em `permissao.ts`, uma
 * so para os quatro dominios; aqui fica apenas a palavra que a ata usa para
 * recusar quem nao existe.
 */
async function permissaoDoUsuario(db: LeitorAtas, usuarioId: string): Promise<PermissaoBases> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new AtaInvalida('usuário inexistente', 403)
  return permissao
}

/**
 * O que o usuário enxerga: as atas das bases dele mais as de base nula, que sao
 * as da empresa inteira. Admin nao filtra nada.
 */
function filtroVisivel(permissao: PermissaoBases): SQL | undefined {
  if (permissao.admin) return undefined
  if (permissao.ids.length === 0) return isNull(ata.baseId)
  return or(isNull(ata.baseId), inArray(ata.baseId, permissao.ids))
}

/**
 * Enxergar nao e poder escrever. Ata da empresa (base nula) a operadora le, mas
 * quem altera e o admin; ata de outra base ela nem enxerga, e por isso a recusa
 * ali e 404, nao 403.
 */
function exigirEscrita(permissao: PermissaoBases, baseDaAta: string | null): void {
  if (permissao.admin) return
  if (baseDaAta === null) throw new AtaInvalida('ata da empresa: só o administrador altera', 403)
  if (!permissao.ids.includes(baseDaAta)) throw new AtaInvalida('ata inexistente', 404)
}

export async function catalogoAta(db: Db, usuarioId: string) {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  // O catalogo e o cadastro de pessoal, e o operador so precisa do da base dele.
  // Sem este filtro a tela de ata entregava os 31 colaboradores das tres bases a
  // qualquer sessao.
  if (!permissao.admin && permissao.ids.length === 0) return []
  const daBase = permissao.admin ? undefined : inArray(colaborador.baseId, permissao.ids)
  return await db
    .select({
      id: colaborador.id,
      nome: colaborador.nome,
      cargo: colaborador.cargo,
      funcao: colaborador.funcao,
    })
    .from(colaborador)
    .where(and(eq(colaborador.ativo, true), daBase))
    .orderBy(colaborador.nome)
}

export async function listarAtas(db: LeitorAtas, usuarioId: string): Promise<AtaCompleta[]> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  const atas = await db
    .select({
      id: ata.id,
      numero: ata.numero,
      titulo: ata.titulo,
      data: ata.data,
      horario: ata.horario,
      local: ata.local,
      convocada: ata.convocada,
      facilitadores: ata.facilitadores,
      participantesGeral: ata.participantesGeral,
      gestor1Nome: ata.gestor1Nome,
      gestor1Cargo: ata.gestor1Cargo,
      gestor2Nome: ata.gestor2Nome,
      gestor2Cargo: ata.gestor2Cargo,
      importada: ata.importada,
      pdfArquivoId: ata.pdfArquivoId,
      salvoEm: ata.atualizadoEm,
    })
    .from(ata)
    .where(and(isNull(ata.apagadoEm), filtroVisivel(permissao)))
    .orderBy(desc(ata.data), desc(ata.atualizadoEm))

  const ids = atas.map((item) => item.id)
  const [topicos, participantes] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              ataId: ataTopico.ataId,
              discussao: ataTopico.discussao,
              conclusao: ataTopico.conclusao,
              responsavel: ataTopico.responsavel,
              prazo: ataTopico.prazo,
            })
            .from(ataTopico)
            .where(inArray(ataTopico.ataId, ids))
            .orderBy(asc(ataTopico.ordem)),
          db
            .select({
              ataId: ataParticipante.ataId,
              colaboradorId: ataParticipante.colaboradorId,
              nomeExterno: ataParticipante.nomeExterno,
              presente: ataParticipante.presente,
            })
            .from(ataParticipante)
            .where(inArray(ataParticipante.ataId, ids)),
        ])

  return atas.map(({ pdfArquivoId, salvoEm, ...item }) => ({
    ...item,
    salvoEm: salvoEm.toISOString(),
    temPdf: pdfArquivoId !== null,
    topicos: topicos
      .filter((topico) => topico.ataId === item.id)
      .map(({ ataId: _, ...topico }) => topico),
    participantes: participantes
      .filter((participante) => participante.ataId === item.id)
      .map(({ ataId: _, ...participante }) => participante),
  }))
}

export async function criarAta(
  db: Db,
  usuarioId: string,
  entrada: EntradaAta,
): Promise<AtaCompleta> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  return await gravarAta(db, usuarioId, permissao, entrada, null)
}

export async function atualizarAta(
  db: Db,
  usuarioId: string,
  id: string,
  entrada: EntradaAta,
): Promise<AtaCompleta> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  return await gravarAta(db, usuarioId, permissao, entrada, id)
}

export async function apagarAta(db: Db, usuarioId: string, id: string): Promise<boolean> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  return await db.transaction(async (tx) => {
    await ataParaEscrita(tx, permissao, id)
    // `apagadoEm IS NULL` no WHERE, e nao so o id: sem ele apagar a mesma ata
    // duas vezes devolvia 204 nas duas, porque o UPDATE encontrava a linha ja
    // apagada e reescrevia a data. A segunda vez agora nao acha nada.
    const apagadas = await tx
      .update(ata)
      .set({ apagadoEm: new Date(), atualizadoPor: usuarioId, atualizadoEm: new Date() })
      .where(and(eq(ata.id, id), isNull(ata.apagadoEm)))
      .returning({ id: ata.id })
    return apagadas.length === 1
  })
}

/** A ata que o usuário pode escrever, ou o erro que a rota devolve no lugar. */
async function ataParaEscrita(db: LeitorAtas, permissao: PermissaoBases, id: string) {
  const [alvo] = await db
    .select({ baseId: ata.baseId, arquivoId: ata.pdfArquivoId, caminho: arquivo.caminho })
    .from(ata)
    .leftJoin(arquivo, eq(arquivo.id, ata.pdfArquivoId))
    .where(and(eq(ata.id, id), isNull(ata.apagadoEm)))
  if (!alvo) throw new AtaInvalida('ata inexistente', 404)
  exigirEscrita(permissao, alvo.baseId)
  return alvo
}

export async function anexarPdfAta(
  db: Db,
  usuarioId: string,
  ataId: string,
  metadado: MetadadoPdfAta,
): Promise<string | null> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  return await db.transaction(async (tx) => {
    const atual = await ataParaEscrita(tx, permissao, ataId)

    await tx.insert(arquivo).values({
      ...metadado,
      criadoPor: usuarioId,
      atualizadoPor: usuarioId,
    })
    await tx
      .update(ata)
      .set({ pdfArquivoId: metadado.id, atualizadoPor: usuarioId, atualizadoEm: new Date() })
      .where(eq(ata.id, ataId))
    if (atual.arquivoId) {
      await tx
        .update(arquivo)
        .set({ apagadoEm: new Date(), atualizadoPor: usuarioId, atualizadoEm: new Date() })
        .where(eq(arquivo.id, atual.arquivoId))
    }
    return atual.caminho
  })
}

export async function pdfDaAta(
  db: Db,
  usuarioId: string,
  ataId: string,
): Promise<MetadadoPdfAta | null> {
  const permissao = await permissaoDoUsuario(db, usuarioId)
  const [linha] = await db
    .select({
      id: arquivo.id,
      nomeOriginal: arquivo.nomeOriginal,
      mime: arquivo.mime,
      tamanho: arquivo.tamanho,
      caminho: arquivo.caminho,
      sha256: arquivo.sha256,
    })
    .from(ata)
    .innerJoin(arquivo, eq(arquivo.id, ata.pdfArquivoId))
    .where(
      and(
        eq(ata.id, ataId),
        isNull(ata.apagadoEm),
        isNull(arquivo.apagadoEm),
        // Sem este filtro qualquer sessao baixava o PDF assinado de qualquer
        // base. Ata que o usuário nao enxerga responde como PDF inexistente.
        filtroVisivel(permissao),
      ),
    )
  return linha ?? null
}

function gravarAta(
  db: Db,
  usuarioId: string,
  permissao: PermissaoBases,
  entrada: EntradaAta,
  idAtual: string | null,
): Promise<AtaCompleta> {
  return db.transaction(async (tx) => {
    if (idAtual) await ataParaEscrita(tx, permissao, idAtual)
    const colaboradores = entrada.participantes.flatMap((p) =>
      p.colaboradorId === null ? [] : [p.colaboradorId],
    )
    if (colaboradores.length > 0) {
      // O participante tem que ser de uma base que quem grava enxerga, e o
      // filtro e o mesmo do `catalogoAta`. So conferir a existencia deixava a
      // andreina montar ata da Raposa com colaborador de Imperatriz e receber
      // 201: chave estrangeira cruzando a fronteira, e um oraculo de existencia
      // -- 400 contra 201 respondia se aquele uuid era de gente de verdade.
      //
      // A recusa usa a palavra que ja existia, 'participante inexistente', e
      // usa de proposito: dizer "de outra base" devolveria o oraculo pela
      // mensagem. Para quem grava, colaborador que ela nao enxerga nao existe.
      //
      // Convidado de outra base entra pelo `nomeExterno`, que nao passa por
      // aqui. Se um dia a ata precisar do vinculo de verdade com pessoa de
      // outra base, a regra vira explicita; hoje ela era so um buraco.
      const daBase = permissao.admin ? undefined : inArray(colaborador.baseId, permissao.ids)
      const visiveis =
        permissao.admin || permissao.ids.length > 0
          ? await tx
              .select({ id: colaborador.id })
              .from(colaborador)
              .where(and(inArray(colaborador.id, colaboradores), daBase))
          : []
      if (visiveis.length !== new Set(colaboradores).size) {
        throw new AtaInvalida('participante inexistente')
      }
    }

    const agora = new Date()
    const valores = {
      numero: entrada.numero,
      titulo: entrada.titulo,
      data: entrada.data,
      horario: entrada.horario,
      local: entrada.local,
      convocada: entrada.convocada,
      facilitadores: entrada.facilitadores,
      participantesGeral: entrada.participantesGeral,
      gestor1Nome: entrada.gestor1Nome,
      gestor1Cargo: entrada.gestor1Cargo,
      gestor2Nome: entrada.gestor2Nome,
      gestor2Cargo: entrada.gestor2Cargo,
      importada: entrada.importada,
      atualizadoPor: usuarioId,
      atualizadoEm: agora,
    }
    // A base nasce de quem grava e nunca do corpo: o admin cria ata da empresa
    // (base nula), o operador cria ata da base fixa dele. No UPDATE a base fica
    // como esta, entao nao ha como mover uma ata de base pela tela.
    if (!permissao.admin && permissao.baseFixa === null) {
      throw new AtaInvalida('usuário sem base fixa', 403)
    }
    const alvos = idAtual
      ? await tx
          .update(ata)
          .set(valores)
          .where(and(eq(ata.id, idAtual), isNull(ata.apagadoEm)))
          .returning({ id: ata.id })
      : await tx
          .insert(ata)
          .values({
            ...valores,
            baseId: permissao.admin ? null : permissao.baseFixa,
            criadoPor: usuarioId,
          })
          .returning({ id: ata.id })
    const gravada = alvos[0]
    if (!gravada) throw new AtaInvalida('ata inexistente')

    if (idAtual) {
      await Promise.all([
        tx.delete(ataTopico).where(eq(ataTopico.ataId, gravada.id)),
        tx.delete(ataParticipante).where(eq(ataParticipante.ataId, gravada.id)),
      ])
    }

    if (entrada.topicos.length > 0) {
      await tx.insert(ataTopico).values(
        entrada.topicos.map((topico, indice) => ({
          ataId: gravada.id,
          ordem: indice + 1,
          ...topico,
        })),
      )
    }
    if (entrada.participantes.length > 0) {
      await tx.insert(ataParticipante).values(
        entrada.participantes.map((participante) => ({ ataId: gravada.id, ...participante })),
      )
    }

    const lista = await listarAtas(tx, usuarioId)
    const completa = lista.find((item) => item.id === gravada.id)
    if (!completa) throw new Error('a ata gravada nao voltou na leitura')
    return completa
  })
}
