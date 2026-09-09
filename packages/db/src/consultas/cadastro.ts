/**
 * O cadastro que o formulario lia de literais dentro dele, agora editavel.
 *
 * Tres telas repetiam as mesmas listas de placa, motorista e rota em literais
 * (`formulario-registro`, `documentos-frota`, `manutencao-frota`), e trocar uma
 * placa significava editar os tres arquivos e torcer. O banco ja tem as tres
 * tabelas desde a fase 0, e o seed as enche dos mesmos literais; faltava servi-las
 * e, depois, deixar a tela escrever nelas sem migracao.
 *
 * O filtro de visibilidade nao e unificado de proposito: cada dominio filtra pela
 * sua coluna de base (`documento` pelo coalesce de tres, preventiva pela base do
 * veiculo), e uma funcao so com flags e por onde o vazamento entra. Aqui a base
 * vem direto das tabelas de cadastro, entao a regra e a de `permissao.ts`: admin
 * ve toda base ativa, o resto ve o que `usuario_base` lista.
 */
import { and, eq, inArray, type SQL } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { base, colaborador, rota, veiculo } from '../schema/cadastro.ts'
import { type BasePermitida, lerPermissao } from './permissao.ts'

/**
 * O `status` viaja junto com a mensagem porque a rota nao tem como adivinha-lo.
 * Sessao sem usuario no banco e 403; base que o usuario nao tem so esvazia as
 * listas, porque o formulario desenha o que recebe e lista vazia e outro desenho.
 * Na escrita entram 404 (linha que ele nem enxerga) e 409 (unique do banco).
 */
export class CadastroInvalido extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 403,
  ) {
    super(message)
  }
}

type Leitor = Pick<Db, 'select'>

type Alcance = { admin: boolean; bases: BasePermitida[]; ids: string[] }

/**
 * As bases que este usuario alcanca **no cadastro**, que nao sao as mesmas de
 * `lerPermissao`: la o admin recebe so base ativa, e o cadastro e justamente a
 * tela onde ele desativa uma. Com a lista de la, a base recem-desativada sairia
 * do `?todos=1` e ele nao teria como reativa-la, levando junto o veiculo, o
 * colaborador e a rota dela. Para quem nao e admin nada muda: `usuario_base` ja
 * lista base inativa.
 */
async function alcanceDoCadastro(db: Leitor, usuarioId: string): Promise<Alcance> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new CadastroInvalido('usuário inexistente')
  const bases = permissao.admin
    ? await db.select({ id: base.id, nome: base.nome }).from(base)
    : permissao.bases
  return { admin: permissao.admin, bases, ids: bases.map((item) => item.id) }
}

function exigirAdmin(alcance: Alcance): void {
  if (!alcance.admin) throw new CadastroInvalido('só administrador altera base')
}

/**
 * Autoriza a base e devolve o nome dela na mesma passada. As duas perguntas tem
 * uma resposta so: o alcance ja traz id e nome do que o usuario enxerga,
 * entao base que nao esta ali e recusa, e base que esta dispensa reler o nome do
 * banco para devolver a linha no formato do catalogo.
 */
function nomeDaBase(alcance: Alcance, baseId: string): string {
  const achada = alcance.bases.find((item) => item.id === baseId)
  if (!achada) throw new CadastroInvalido('base fora das suas bases')
  return achada.nome
}

type ComBase = typeof veiculo | typeof colaborador | typeof rota

/**
 * 404 e nao 403 de proposito: quem nao alcanca a base nao enxerga a linha na
 * lista, e 403 confirmaria que aquele id existe. A mesma palavra volta se o
 * `returning` do update vier vazio, que e a linha apagada entre uma consulta e
 * a outra: 200 com um corpo pela metade seria pior que 404.
 */
async function exigirAlvo(
  db: Leitor,
  tabela: ComBase,
  id: string,
  alcance: Alcance,
  palavra: string,
): Promise<void> {
  const [alvo] = await db.select({ baseId: tabela.baseId }).from(tabela).where(eq(tabela.id, id))
  if (!alvo || !alcance.ids.includes(alvo.baseId)) throw new CadastroInvalido(palavra, 404)
}

// Um Map, e nao um literal de objeto: `constraint_name` vem do banco, e uma
// constraint chamada `constructor` acharia o membro herdado do prototipo.
const CONFLITOS = new Map([
  ['veiculo_placa_unique', 'já existe um veículo com essa placa'],
  ['rota_nome_base_uk', 'já existe uma rota com esse nome nessa base'],
  ['base_nome_unique', 'já existe uma base com esse nome'],
])

/**
 * A falha chega embrulhada pelo drizzle; o `PostgresError` fica no `cause`.
 * Unique fora da tabela continua subindo, porque 409 com mensagem inventada
 * mente sobre o que o usuario precisa mudar.
 */
async function gravar<T>(escrita: () => Promise<T>): Promise<T> {
  try {
    return await escrita()
  } catch (falha) {
    let atual: unknown = falha
    while (atual instanceof Error) {
      const erro = atual as Error & { code?: string; constraint_name?: string }
      const mensagem =
        erro.code === '23505' ? CONFLITOS.get(erro.constraint_name ?? '') : undefined
      if (mensagem) throw new CadastroInvalido(mensagem, 409)
      atual = erro.cause
    }
    throw falha
  }
}

export type BaseCadastro = {
  id: string
  nome: string
  ativo: boolean
}

export type VeiculoCadastro = {
  id: string
  placa: string
  modelo: string | null
  marca: string | null
  ano: string | null
  baseId: string
  base: string
  ativo: boolean
}

export type ColaboradorCadastro = {
  id: string
  nome: string
  cargo: string | null
  funcao: FuncaoColaborador
  admissao: string | null
  baseId: string
  base: string
  ativo: boolean
}

export type RotaCadastro = {
  id: string
  nome: string
  baseId: string
  base: string
  /** O booleano que decide se o toggle de viagem longa aparece no formulario. */
  local: boolean
  ativo: boolean
}

export type FuncaoColaborador = (typeof colaborador.$inferSelect)['funcao']

export type CatalogoCadastro = {
  bases: BaseCadastro[]
  veiculos: VeiculoCadastro[]
  colaboradores: ColaboradorCadastro[]
  rotas: RotaCadastro[]
}

export type EntradaBase = {
  nome: string
  ativo: boolean
}

export type EntradaVeiculo = {
  placa: string
  marca: string | null
  modelo: string | null
  ano: string | null
  baseId: string
  ativo: boolean
}

export type EntradaColaborador = {
  nome: string
  cargo: string | null
  funcao: FuncaoColaborador
  admissao: string | null
  baseId: string
  ativo: boolean
}

export type EntradaRota = {
  nome: string
  baseId: string
  local: boolean
  ativo: boolean
}

const CAMPOS_BASE = {
  id: base.id,
  nome: base.nome,
  ativo: base.ativo,
}

const CAMPOS_VEICULO = {
  id: veiculo.id,
  placa: veiculo.placa,
  modelo: veiculo.modelo,
  marca: veiculo.marca,
  ano: veiculo.ano,
  baseId: veiculo.baseId,
  ativo: veiculo.ativo,
}

const CAMPOS_COLABORADOR = {
  id: colaborador.id,
  nome: colaborador.nome,
  cargo: colaborador.cargo,
  funcao: colaborador.funcao,
  admissao: colaborador.admissao,
  baseId: colaborador.baseId,
  ativo: colaborador.ativo,
}

const CAMPOS_ROTA = {
  id: rota.id,
  nome: rota.nome,
  baseId: rota.baseId,
  local: rota.local,
  ativo: rota.ativo,
}

/**
 * As listas que o formulario autocompleta e que os cards de documento e
 * manutencao enumeram, filtradas pelas bases da sessao. A ordem e alfabetica
 * por placa, nome e rota: a ordem antiga era a dos literais, que nao era
 * ordenacao nenhuma, e manter aquela ordem exigiria guardar aquela ordem em
 * algum lugar, que e a duplicacao de volta.
 *
 * `todos` e opt-in porque quem chama para desenhar formulario quer so o que
 * esta em uso; quem chama para editar o cadastro precisa ver o inativo para
 * poder reativa-lo.
 */
export async function catalogoCadastro(
  db: Db,
  usuarioId: string,
  todos = false,
): Promise<CatalogoCadastro> {
  const permitidas = (await alcanceDoCadastro(db, usuarioId)).ids
  // O filtro de base vale sempre; as condicoes de `ativo` so quando nao pediram
  // `todos`. Sao mais de uma porque a linha some tambem quando a base dela some:
  // desde que o admin passou a enxergar base inativa, para poder reativa-la, o
  // `ativo` da propria tabela deixava passar o veiculo de uma base desligada, e o
  // formulario o oferecia com uma base que nem aparece na lista.
  const visivel = (daBase: SQL, ...ativas: SQL[]): SQL => (todos ? daBase : and(daBase, ...ativas)!)
  const [bases, veiculos, colaboradores, rotas] = await Promise.all([
    db
      .select(CAMPOS_BASE)
      .from(base)
      .where(visivel(inArray(base.id, permitidas), eq(base.ativo, true)))
      .orderBy(base.nome),
    db
      .select({ ...CAMPOS_VEICULO, base: base.nome })
      .from(veiculo)
      .innerJoin(base, eq(base.id, veiculo.baseId))
      .where(visivel(inArray(veiculo.baseId, permitidas), eq(veiculo.ativo, true), eq(base.ativo, true)))
      .orderBy(veiculo.placa),
    db
      .select({ ...CAMPOS_COLABORADOR, base: base.nome })
      .from(colaborador)
      .innerJoin(base, eq(base.id, colaborador.baseId))
      .where(visivel(inArray(colaborador.baseId, permitidas), eq(colaborador.ativo, true), eq(base.ativo, true)))
      .orderBy(colaborador.nome),
    db
      .select({ ...CAMPOS_ROTA, base: base.nome })
      .from(rota)
      .innerJoin(base, eq(base.id, rota.baseId))
      .where(visivel(inArray(rota.baseId, permitidas), eq(rota.ativo, true), eq(base.ativo, true)))
      .orderBy(rota.nome),
  ])
  return { bases, veiculos, colaboradores, rotas }
}

export async function criarVeiculo(
  db: Db,
  usuarioId: string,
  entrada: EntradaVeiculo,
): Promise<VeiculoCadastro> {
  const alcance = await alcanceDoCadastro(db, usuarioId)
  const nome = nomeDaBase(alcance, entrada.baseId)
  const [criado] = await gravar(() =>
    db.insert(veiculo).values(entrada).returning(CAMPOS_VEICULO),
  )
  return { ...criado!, base: nome }
}

export async function atualizarVeiculo(
  db: Db,
  usuarioId: string,
  id: string,
  entrada: EntradaVeiculo,
): Promise<VeiculoCadastro> {
  const alcance = await alcanceDoCadastro(db, usuarioId)
  await exigirAlvo(db, veiculo, id, alcance, 'veículo inexistente')
  const nome = nomeDaBase(alcance, entrada.baseId)
  const [salvo] = await gravar(() =>
    db.update(veiculo).set(entrada).where(eq(veiculo.id, id)).returning(CAMPOS_VEICULO),
  )
  if (!salvo) throw new CadastroInvalido('veículo inexistente', 404)
  return { ...salvo, base: nome }
}

export async function criarColaborador(
  db: Db,
  usuarioId: string,
  entrada: EntradaColaborador,
): Promise<ColaboradorCadastro> {
  const alcance = await alcanceDoCadastro(db, usuarioId)
  const nome = nomeDaBase(alcance, entrada.baseId)
  const [criado] = await gravar(() =>
    db.insert(colaborador).values(entrada).returning(CAMPOS_COLABORADOR),
  )
  return { ...criado!, base: nome }
}

export async function atualizarColaborador(
  db: Db,
  usuarioId: string,
  id: string,
  entrada: EntradaColaborador,
): Promise<ColaboradorCadastro> {
  const alcance = await alcanceDoCadastro(db, usuarioId)
  await exigirAlvo(db, colaborador, id, alcance, 'colaborador inexistente')
  const nome = nomeDaBase(alcance, entrada.baseId)
  const [salvo] = await gravar(() =>
    db.update(colaborador).set(entrada).where(eq(colaborador.id, id)).returning(CAMPOS_COLABORADOR),
  )
  if (!salvo) throw new CadastroInvalido('colaborador inexistente', 404)
  return { ...salvo, base: nome }
}

export async function criarRota(
  db: Db,
  usuarioId: string,
  entrada: EntradaRota,
): Promise<RotaCadastro> {
  const alcance = await alcanceDoCadastro(db, usuarioId)
  const nome = nomeDaBase(alcance, entrada.baseId)
  const [criada] = await gravar(() => db.insert(rota).values(entrada).returning(CAMPOS_ROTA))
  return { ...criada!, base: nome }
}

export async function atualizarRota(
  db: Db,
  usuarioId: string,
  id: string,
  entrada: EntradaRota,
): Promise<RotaCadastro> {
  const alcance = await alcanceDoCadastro(db, usuarioId)
  await exigirAlvo(db, rota, id, alcance, 'rota inexistente')
  const nome = nomeDaBase(alcance, entrada.baseId)
  const [salva] = await gravar(() =>
    db.update(rota).set(entrada).where(eq(rota.id, id)).returning(CAMPOS_ROTA),
  )
  if (!salva) throw new CadastroInvalido('rota inexistente', 404)
  return { ...salva, base: nome }
}

export async function criarBase(
  db: Db,
  usuarioId: string,
  entrada: EntradaBase,
): Promise<BaseCadastro> {
  exigirAdmin(await alcanceDoCadastro(db, usuarioId))
  const [criada] = await gravar(() => db.insert(base).values(entrada).returning(CAMPOS_BASE))
  return criada!
}

export async function atualizarBase(
  db: Db,
  usuarioId: string,
  id: string,
  entrada: EntradaBase,
): Promise<BaseCadastro> {
  exigirAdmin(await alcanceDoCadastro(db, usuarioId))
  const [salva] = await gravar(() =>
    db.update(base).set(entrada).where(eq(base.id, id)).returning(CAMPOS_BASE),
  )
  // O update sem linha e a resposta da existencia: quem chega aqui ja e admin,
  // entao nao ha id que ele enxergue e nao possa mudar.
  if (!salva) throw new CadastroInvalido('base inexistente', 404)
  return salva
}
