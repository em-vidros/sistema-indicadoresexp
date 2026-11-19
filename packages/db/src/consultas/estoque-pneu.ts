/**
 * O estoque de pneus do almoxarifado: o saldo por base x medida x marca x condicao
 * (nao recapado, ou recapado 1x a 3x) e o historico de cada movimentacao.
 *
 * O saldo so muda por movimentacao, na mesma transacao que grava a linha do historico, e a
 * linha do saldo e travada (`for update`) enquanto isso: duas saidas ao mesmo tempo nao
 * passam do saldo. Ninguem digita o saldo direto; o inventario (contagem fisica) e um tipo
 * de movimentacao, o `ajuste`, e deixa registrado quem contou e quando.
 *
 * Autorizacao pela base: quem alcanca a base mexe no estoque dela, e o resto e 403. As
 * recusas usam `CadastroInvalido`, com o status que a rota devolve.
 */
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { user } from '../schema/auth.ts'
import { base, veiculo } from '../schema/cadastro.ts'
import { estoquePneu, movimentoEstoquePneu } from '../schema/estoque-pneu.ts'
import { CadastroInvalido } from './cadastro.ts'
import {
  MAXIMO_DE_RECAPAGENS,
  type TipoDeMovimento,
  motivoValido,
  normalizarMarca,
  normalizarMedida,
  novoSaldo,
} from './estoque-pneu-regras.ts'
import { lerPermissao } from './permissao.ts'

type Leitor = Pick<Db, 'select'>

export type LinhaDeEstoque = {
  id: string
  base: string
  medida: string
  marca: string
  recapagens: number
  quantidade: number
}

export type MovimentoListado = {
  id: string
  quando: string
  usuario: string
  base: string
  medida: string
  marca: string
  recapagens: number
  tipo: TipoDeMovimento
  delta: number
  saldoDepois: number
  motivo: string
  placa: string | null
  observacao: string | null
}

async function basesDoUsuario(db: Leitor, usuarioId: string) {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new CadastroInvalido('usuário inexistente')
  return permissao.bases
}

/** As bases do usuario, ou so a pedida; base que ele nao alcanca e 403, e nao lista vazia. */
async function basesDaConsulta(db: Leitor, usuarioId: string, nomeBase: string | undefined) {
  const bases = await basesDoUsuario(db, usuarioId)
  if (nomeBase === undefined) return bases
  const alvo = bases.filter((item) => item.nome === nomeBase)
  if (alvo.length === 0) throw new CadastroInvalido('base fora das suas bases')
  return alvo
}

export async function listarEstoquePneu(
  db: Leitor,
  usuarioId: string,
  nomeBase?: string,
): Promise<LinhaDeEstoque[]> {
  const bases = await basesDaConsulta(db, usuarioId, nomeBase)
  if (bases.length === 0) return []
  return await db
    .select({
      id: estoquePneu.id,
      base: base.nome,
      medida: estoquePneu.medida,
      marca: estoquePneu.marca,
      recapagens: estoquePneu.recapagens,
      quantidade: estoquePneu.quantidade,
    })
    .from(estoquePneu)
    .innerJoin(base, eq(base.id, estoquePneu.baseId))
    .where(inArray(estoquePneu.baseId, bases.map((item) => item.id)))
    .orderBy(estoquePneu.medida, estoquePneu.marca, estoquePneu.recapagens)
}

export type EntradaDeMovimento = {
  base: string
  medida: string
  marca: string
  recapagens: number
  tipo: TipoDeMovimento
  quantidade: number
  motivo: string
  placa: string | null
  observacao: string | null
}

/**
 * Registra uma entrada, saida ou ajuste e devolve a linha do estoque ja com o saldo novo.
 * Ajuste igual ao saldo atual nao grava nada (contou e deu o mesmo numero). Saida maior que
 * o saldo e recusada com 400 e nao deixa rastro, nem a linha vazia que ela teria criado.
 */
export async function registrarMovimentoDePneu(
  db: Db,
  usuarioId: string,
  entrada: EntradaDeMovimento,
): Promise<LinhaDeEstoque> {
  const bases = await basesDoUsuario(db, usuarioId)
  const alvo = bases.find((item) => item.nome === entrada.base)
  if (!alvo) throw new CadastroInvalido('operação não permitida')

  const medida = normalizarMedida(entrada.medida)
  const marca = normalizarMarca(entrada.marca)
  if (medida === '') throw new CadastroInvalido('Informe a medida do pneu.', 400)
  if (
    !Number.isInteger(entrada.recapagens) || entrada.recapagens < 0 || entrada.recapagens > MAXIMO_DE_RECAPAGENS
  ) {
    throw new CadastroInvalido(`A condição vai de não recapado a recapado ${MAXIMO_DE_RECAPAGENS}×.`, 400)
  }
  if (!motivoValido(entrada.tipo, entrada.motivo)) {
    throw new CadastroInvalido('Motivo inválido para esta movimentação.', 400)
  }

  const placa = entrada.placa?.trim().toUpperCase() || null
  if (entrada.motivo === 'instalado_veiculo' && placa === null) {
    throw new CadastroInvalido('Informe a placa do veículo onde o pneu foi instalado.', 400)
  }
  if (placa !== null) {
    const [achado] = await db
      .select({ id: veiculo.id })
      .from(veiculo)
      .where(and(eq(veiculo.placa, placa), eq(veiculo.baseId, alvo.id)))
    if (!achado) throw new CadastroInvalido('Placa não encontrada nesta base.', 400)
  }
  const observacao = entrada.observacao?.trim() || null

  return await db.transaction(async (tx) => {
    // A linha nasce zerada se ainda nao existia; se a transacao for recusada, ela volta junto.
    await tx
      .insert(estoquePneu)
      .values({ baseId: alvo.id, medida, marca, recapagens: entrada.recapagens })
      .onConflictDoNothing()
    const [linha] = await tx
      .select()
      .from(estoquePneu)
      .where(and(
        eq(estoquePneu.baseId, alvo.id),
        eq(estoquePneu.medida, medida),
        eq(estoquePneu.marca, marca),
        eq(estoquePneu.recapagens, entrada.recapagens),
      ))
      .for('update')
    if (!linha) throw new CadastroInvalido('Estoque indisponível, tente de novo.', 409)

    const resultado = novoSaldo(entrada.tipo, linha.quantidade, entrada.quantidade)
    if ('erro' in resultado) throw new CadastroInvalido(resultado.erro, 400)
    const delta = resultado.saldo - linha.quantidade
    const linhaDepois = {
      id: linha.id,
      base: alvo.nome,
      medida,
      marca,
      recapagens: entrada.recapagens,
      quantidade: resultado.saldo,
    }
    if (delta === 0) return linhaDepois

    await tx
      .update(estoquePneu)
      .set({ quantidade: resultado.saldo, atualizadoEm: new Date() })
      .where(eq(estoquePneu.id, linha.id))
    await tx.insert(movimentoEstoquePneu).values({
      usuarioId,
      estoqueId: linha.id,
      tipo: entrada.tipo,
      delta,
      saldoDepois: resultado.saldo,
      motivo: entrada.motivo,
      placa,
      observacao,
    })
    return linhaDepois
  })
}

export type FiltroDeMovimentos = {
  base?: string | undefined
  deslocamento?: number | undefined
  limite?: number | undefined
}

/**
 * O historico, do mais recente para o mais antigo. Pagina por deslocamento: varias
 * movimentacoes gravadas na mesma transacao tem o mesmo horario, e o horario como cursor
 * pularia as que empatam. Pede uma a mais para saber se ha pagina seguinte.
 */
export async function listarMovimentosDePneu(
  db: Leitor,
  usuarioId: string,
  filtro: FiltroDeMovimentos = {},
): Promise<{ movimentos: MovimentoListado[]; temMais: boolean }> {
  const bases = await basesDaConsulta(db, usuarioId, filtro.base)
  if (bases.length === 0) return { movimentos: [], temMais: false }
  const limite = Math.min(Math.max(filtro.limite ?? 30, 1), 200)
  const deslocamento = Math.max(filtro.deslocamento ?? 0, 0)

  const linhas = await db
    .select({
      id: movimentoEstoquePneu.id,
      quando: movimentoEstoquePneu.quando,
      usuario: user.name,
      base: base.nome,
      medida: estoquePneu.medida,
      marca: estoquePneu.marca,
      recapagens: estoquePneu.recapagens,
      tipo: movimentoEstoquePneu.tipo,
      delta: movimentoEstoquePneu.delta,
      saldoDepois: movimentoEstoquePneu.saldoDepois,
      motivo: movimentoEstoquePneu.motivo,
      placa: movimentoEstoquePneu.placa,
      observacao: movimentoEstoquePneu.observacao,
    })
    .from(movimentoEstoquePneu)
    .innerJoin(estoquePneu, eq(estoquePneu.id, movimentoEstoquePneu.estoqueId))
    .innerJoin(base, eq(base.id, estoquePneu.baseId))
    .leftJoin(user, eq(user.id, movimentoEstoquePneu.usuarioId))
    .where(inArray(estoquePneu.baseId, bases.map((item) => item.id)))
    .orderBy(desc(movimentoEstoquePneu.quando), desc(movimentoEstoquePneu.id))
    .limit(limite + 1)
    .offset(deslocamento)

  return {
    movimentos: linhas.slice(0, limite).map((linha) => ({
      ...linha,
      quando: linha.quando.toISOString(),
      usuario: linha.usuario ?? 'Sistema',
      tipo: linha.tipo as TipoDeMovimento,
    })),
    temMais: linhas.length > limite,
  }
}
