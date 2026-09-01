import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { base, colaborador, veiculo } from '../schema/cadastro.ts'
import { arquivo, documento, documentoVeiculo } from '../schema/documento.ts'
import { lerPermissao } from './permissao.ts'

export type TipoDocumento = typeof documento.$inferInsert.tipo

export type EntradaDocumento = {
  tipo: TipoDocumento
  titulo: string | null
  descricao: string | null
  vencimento: string | null
  linkExterno: string | null
  veiculoId: string | null
  colaboradorId: string | null
  baseId: string | null
  seguradora: string | null
  contatoEmergencia: string | null
  cnhNumero: string | null
  cnhCategoria: string | null
}

export type ArquivoNovo = {
  id: string
  nomeOriginal: string
  mime: string
  tamanho: number
  caminho: string
  sha256: string
}

/**
 * O `status` viaja junto com a mensagem porque a rota nao tem como adivinha-lo.
 * Corpo malformado e 400; base que o usuario nao tem e 403; documento de outra
 * base, endereçado por id, e 404, para a resposta nao confirmar que o id existe.
 */
export class DocumentoInvalido extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message)
  }
}

type Leitor = Pick<Db, 'select'>

/**
 * Quais bases este usuario enxerga. A regra mora em `permissao.ts`: admin ve
 * toda base ativa, o resto ve o que `usuario_base` lista. Aqui so o vocabulario
 * do erro muda, para a rota de documento tratar um tipo so.
 */
async function basesPermitidas(db: Leitor, usuarioId: string): Promise<string[]> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new DocumentoInvalido('usuário inexistente', 403)
  return permissao.ids
}

/**
 * De quem o documento e. `documento.base_id` sozinho nao responde: o CHECK
 * `documento_base_ck` so o deixa preenchido no plano_pgq e obriga NULL nos outros
 * cinco tipos. A base real vem do veiculo (apolice, crlv, tacografo) ou do
 * colaborador (cnh), e por isso a filtragem depende dos LEFT JOIN das duas tabelas
 * estarem na consulta.
 *
 * Manual nao tem base nenhuma: ele vale para veiculos de bases diferentes, e o
 * CHECK proibe `veiculo_id` e `base_id` nele. Documento sem base fica visivel a
 * todo mundo, que e o mesmo que a escrita ja permite - nao ha base no corpo de um
 * manual para negar - e o que a tela de frota espera.
 */
const baseDoDocumento = sql`coalesce(${documento.baseId}, ${veiculo.baseId}, ${colaborador.baseId})`

function daBase(permitidas: string[]) {
  if (permitidas.length === 0) return isNull(baseDoDocumento)
  return or(isNull(baseDoDocumento), inArray(baseDoDocumento, permitidas))
}

/**
 * O cadastro que a tela usa para desenhar os selects e para resolver nome de veiculo
 * e de colaborador.
 *
 * Ele filtra pelas mesmas bases que `listarDocumentos`. Sem isso a Andreina nao veria
 * documento de Imperatriz, mas veria a placa dos 7 veiculos de la e o nome dos
 * colaboradores das tres bases no proprio select: o vazamento entra pelo catalogo, e
 * nao pela lista que ele acompanha.
 */
export async function catalogoDocumentos(db: Db, usuarioId: string) {
  const permitidas = await basesPermitidas(db, usuarioId)
  const [bases, veiculos, colaboradores] = await Promise.all([
    db
      .select()
      .from(base)
      .where(and(eq(base.ativo, true), inArray(base.id, permitidas)))
      .orderBy(base.nome),
    db
      .select()
      .from(veiculo)
      .where(and(eq(veiculo.ativo, true), inArray(veiculo.baseId, permitidas)))
      .orderBy(veiculo.placa),
    db
      .select({
        id: colaborador.id,
        nome: colaborador.nome,
        cargo: colaborador.cargo,
        funcao: colaborador.funcao,
        baseId: colaborador.baseId,
      })
      .from(colaborador)
      .where(and(eq(colaborador.ativo, true), inArray(colaborador.baseId, permitidas)))
      .orderBy(colaborador.nome),
  ])
  return { bases, veiculos, colaboradores }
}

export async function listarDocumentos(db: Db, usuarioId: string) {
  const permitidas = await basesPermitidas(db, usuarioId)
  const linhas = await db
    .select({
      id: documento.id,
      tipo: documento.tipo,
      titulo: documento.titulo,
      descricao: documento.descricao,
      vencimento: documento.vencimento,
      linkExterno: documento.linkExterno,
      veiculoId: documento.veiculoId,
      colaboradorId: documento.colaboradorId,
      baseId: documento.baseId,
      seguradora: documento.seguradora,
      contatoEmergencia: documento.contatoEmergencia,
      cnhNumero: documento.cnhNumero,
      cnhCategoria: documento.cnhCategoria,
      arquivoId: documento.arquivoId,
      nomeArquivo: arquivo.nomeOriginal,
    })
    .from(documento)
    .leftJoin(arquivo, eq(arquivo.id, documento.arquivoId))
    .leftJoin(veiculo, eq(veiculo.id, documento.veiculoId))
    .leftJoin(colaborador, eq(colaborador.id, documento.colaboradorId))
    .where(and(isNull(documento.apagadoEm), daBase(permitidas)))
    .orderBy(asc(documento.tipo), asc(documento.titulo))

  const manuais = linhas.filter((linha) => linha.tipo === 'manual').map((linha) => linha.id)
  // O manual e visivel a todos de proposito, porque ele nao tem base. A lista de
  // veiculos dentro dele tem: sem o filtro, um operador de Imperatriz recebia os
  // uuid dos veiculos de Raposa vinculados ao mesmo manual. Sao so identificadores,
  // e escrever neles continua barrado, mas `gravarDocumento` separa 400 de veiculo
  // inexistente de 403 de veiculo de outra base, entao com o uuid na mao da para
  // contar o parque alheio. `veiculo.base_id` e NOT NULL, e por isso o `inArray`
  // aqui nao precisa do `isNull` que `daBase` carrega.
  const vinculos = manuais.length
    ? await db
        .select({ documentoId: documentoVeiculo.documentoId, veiculoId: documentoVeiculo.veiculoId })
        .from(documentoVeiculo)
        .innerJoin(veiculo, eq(veiculo.id, documentoVeiculo.veiculoId))
        .where(and(inArray(documentoVeiculo.documentoId, manuais), inArray(veiculo.baseId, permitidas)))
    : []
  return linhas.map(({ arquivoId, ...linha }) => ({
    ...linha,
    arquivoId,
    temArquivo: arquivoId !== null,
    veiculos: vinculos.filter((v) => v.documentoId === linha.id).map((v) => v.veiculoId),
  }))
}

/**
 * O dono que o corpo pede tem que estar entre as bases do usuario. Sem esta
 * conferencia o `veiculoId`, o `colaboradorId` e o `baseId` chegavam do cliente e
 * ninguem os confrontava com nada: um operador de Raposa sobrescrevia a apolice de
 * um veiculo de Imperatriz mandando o uuid dele no corpo.
 *
 * Cadastro que nao existe tambem para aqui, e nao no erro de chave estrangeira do
 * Postgres, que subiria como 500.
 */
async function exigirDonoPermitido(db: Leitor, permitidas: string[], entrada: EntradaDocumento) {
  const alvos: string[] = []
  if (entrada.baseId) alvos.push(entrada.baseId)
  if (entrada.veiculoId) {
    const [linha] = await db
      .select({ baseId: veiculo.baseId })
      .from(veiculo)
      .where(eq(veiculo.id, entrada.veiculoId))
    if (!linha) throw new DocumentoInvalido('operação não permitida', 403)
    alvos.push(linha.baseId)
  }
  if (entrada.colaboradorId) {
    const [linha] = await db
      .select({ baseId: colaborador.baseId })
      .from(colaborador)
      .where(eq(colaborador.id, entrada.colaboradorId))
    if (!linha) throw new DocumentoInvalido('operação não permitida', 403)
    alvos.push(linha.baseId)
  }
  if (alvos.some((id) => !permitidas.includes(id))) {
    throw new DocumentoInvalido('operação não permitida', 403)
  }
}

export function gravarDocumento(
  db: Db,
  usuarioId: string,
  entrada: EntradaDocumento,
  novoArquivo: ArquivoNovo | null,
  documentoId: string | null = null,
): Promise<{ id: string; arquivoId: string | null; caminhoAntigo: string | null }> {
  return db.transaction(async (tx) => {
    const permitidas = await basesPermitidas(tx, usuarioId)
    await exigirDonoPermitido(tx, permitidas, entrada)

    const condicaoDono = documentoId ? eq(documento.id, documentoId) : dono(entrada)
    const [atual] = condicaoDono
      ? await tx
          .select({ id: documento.id, arquivoId: documento.arquivoId, caminho: arquivo.caminho })
          .from(documento)
          .leftJoin(arquivo, eq(arquivo.id, documento.arquivoId))
          .leftJoin(veiculo, eq(veiculo.id, documento.veiculoId))
          .leftJoin(colaborador, eq(colaborador.id, documento.colaboradorId))
          .where(
            and(
              eq(documento.tipo, entrada.tipo),
              condicaoDono,
              isNull(documento.apagadoEm),
              daBase(permitidas),
            ),
          )
      : []

    // Endereçado por id e nao achou: 404, e nunca o INSERT. Com o tipo do corpo
    // diferente do gravado a busca voltava vazia e o PUT criava um documento novo,
    // respondendo 200 com um id diferente do da URL e deixando o antigo intacto.
    // O mesmo 404 cobre o documento de outra base, sem confirmar que o id existe.
    if (documentoId && !atual) throw new DocumentoInvalido('documento inexistente', 404)

    if (!novoArquivo && !entrada.linkExterno && !atual?.arquivoId) {
      throw new DocumentoInvalido('documento sem arquivo ou link')
    }
    if (novoArquivo) {
      await tx.insert(arquivo).values({ ...novoArquivo, criadoPor: usuarioId, atualizadoPor: usuarioId })
    }
    const valores = {
      ...entrada,
      arquivoId: novoArquivo?.id ?? atual?.arquivoId ?? null,
      atualizadoPor: usuarioId,
      atualizadoEm: new Date(),
    }
    const [salvo] = atual
      ? await tx.update(documento).set(valores).where(eq(documento.id, atual.id)).returning({ id: documento.id })
      : await tx
          .insert(documento)
          .values({ ...valores, criadoPor: usuarioId })
          .returning({ id: documento.id })
    if (!salvo) throw new DocumentoInvalido('documento não foi salvo')
    if (novoArquivo && atual?.arquivoId) {
      await tx
        .update(arquivo)
        .set({ apagadoEm: new Date(), atualizadoPor: usuarioId, atualizadoEm: new Date() })
        .where(eq(arquivo.id, atual.arquivoId))
    }
    return {
      id: salvo.id,
      arquivoId: novoArquivo?.id ?? atual?.arquivoId ?? null,
      caminhoAntigo: novoArquivo ? (atual?.caminho ?? null) : null,
    }
  })
}

/**
 * O download e por id, entao ele e a porta mais fácil de abrir com um uuid alheio.
 * Documento de base que o usuario nao tem volta como inexistente, e quem trata o
 * `null` responde 404.
 */
export async function arquivoDoDocumento(db: Db, usuarioId: string, id: string) {
  const permitidas = await basesPermitidas(db, usuarioId)
  const [linha] = await db
    .select({ caminho: arquivo.caminho, nomeOriginal: arquivo.nomeOriginal })
    .from(documento)
    .innerJoin(arquivo, eq(arquivo.id, documento.arquivoId))
    .leftJoin(veiculo, eq(veiculo.id, documento.veiculoId))
    .leftJoin(colaborador, eq(colaborador.id, documento.colaboradorId))
    .where(
      and(
        eq(documento.id, id),
        isNull(documento.apagadoEm),
        isNull(arquivo.apagadoEm),
        daBase(permitidas),
      ),
    )
  return linha ?? null
}

function dono(entrada: EntradaDocumento) {
  if (entrada.veiculoId) return eq(documento.veiculoId, entrada.veiculoId)
  if (entrada.colaboradorId) return eq(documento.colaboradorId, entrada.colaboradorId)
  if (entrada.baseId) return eq(documento.baseId, entrada.baseId)
  return null
}
