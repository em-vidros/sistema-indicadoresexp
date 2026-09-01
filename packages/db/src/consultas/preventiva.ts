/**
 * O plano de manutencao preventiva por veiculo, que a tela guardava em
 * `localStorage['emvidros_preventiva']` num objeto indexado por placa.
 *
 * As duas tabelas ja existiam e ninguem as servia. O formato de saida segue o que
 * `manutencao-frota` le hoje (`tipo`, `intervalo_km`, `alerta_km`, `ultimo_km`,
 * `obs`), para que a tela troque a fonte sem trocar o que aparece.
 *
 * Autorizacao pela base do veiculo, pela mesma leitura de `permissao.ts` que as
 * outras consultas usam: operador enxerga e grava so a base que e sua, e o
 * resto e 403.
 */
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { base, veiculo } from '../schema/cadastro.ts'
import { itemPreventivo, tipoPreventivo } from '../schema/preventiva.ts'
import { lerPermissao } from './permissao.ts'
import { RegistroInvalido } from './registros.ts'

export type ItemPreventivo = {
  tipo_preventivo_id: string
  tipo: string
  intervalo_km: number
  alerta_km: number
  ultimo_km: number | null
  obs: string | null
}

export type EntradaItemPreventivo = {
  tipo: string
  intervalo_km: number
  alerta_km: number
  ultimo_km: number | null
  obs: string | null
}

export type VeiculoPreventivo = {
  id: string
  placa: string
  base: string
  itens: ItemPreventivo[]
}

export type TipoPreventivo = {
  id: string
  tipo: string
  intervalo_km: number
  alerta_km: number
}

export type PlanoPreventivo = {
  tipos: TipoPreventivo[]
  veiculos: VeiculoPreventivo[]
}

type Leitor = Pick<Db, 'select'>

/**
 * As bases do usuario no vocabulario do registro, que e o erro que as rotas de
 * preventiva ja traduzem. A leitura em si mora em `permissao.ts`.
 */
async function basesDoUsuario(db: Leitor, usuarioId: string): Promise<string[]> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new RegistroInvalido('usuário inexistente', true)
  return permissao.ids
}

async function catalogo(db: Leitor): Promise<TipoPreventivo[]> {
  const linhas = await db
    .select({
      id: tipoPreventivo.id,
      tipo: tipoPreventivo.nome,
      intervalo_km: tipoPreventivo.intervaloKm,
      alerta_km: tipoPreventivo.alertaKm,
    })
    .from(tipoPreventivo)
    .orderBy(tipoPreventivo.nome)
  return linhas
}

/**
 * Os veiculos das bases que o usuario tem, cada um com o seu plano. Sem base
 * permitida a lista sai vazia; o catalogo de tipos sai sempre, porque ele e o
 * mesmo para todo mundo e a tela precisa dele para oferecer o que adicionar.
 */
export async function listarPreventiva(db: Db, usuarioId: string): Promise<PlanoPreventivo> {
  const idsBase = await basesDoUsuario(db, usuarioId)
  const tipos = await catalogo(db)
  if (idsBase.length === 0) return { tipos, veiculos: [] }

  const veiculos = await db
    .select({ id: veiculo.id, placa: veiculo.placa, base: base.nome })
    .from(veiculo)
    .innerJoin(base, eq(base.id, veiculo.baseId))
    .where(inArray(veiculo.baseId, idsBase))
    .orderBy(veiculo.placa)
  if (veiculos.length === 0) return { tipos, veiculos: [] }

  const itens = await itensDe(db, veiculos.map((item) => item.id))
  return {
    tipos,
    veiculos: veiculos.map((item) => ({
      ...item,
      itens: itens.filter((linha) => linha.veiculoId === item.id).map(semVeiculo),
    })),
  }
}

async function itensDe(db: Leitor, veiculoIds: string[]) {
  if (veiculoIds.length === 0) return []
  return await db
    .select({
      veiculoId: itemPreventivo.veiculoId,
      tipo_preventivo_id: itemPreventivo.tipoPreventivoId,
      tipo: tipoPreventivo.nome,
      intervalo_km: itemPreventivo.intervaloKm,
      alerta_km: itemPreventivo.alertaKm,
      ultimo_km: itemPreventivo.ultimoKm,
      obs: itemPreventivo.obs,
    })
    .from(itemPreventivo)
    .innerJoin(tipoPreventivo, eq(tipoPreventivo.id, itemPreventivo.tipoPreventivoId))
    .where(and(inArray(itemPreventivo.veiculoId, veiculoIds), isNull(itemPreventivo.apagadoEm)))
    .orderBy(tipoPreventivo.nome)
}

function semVeiculo(linha: ItemPreventivo & { veiculoId: string }): ItemPreventivo {
  const { veiculoId: _ignorado, ...resto } = linha
  return resto
}

/**
 * Grava o plano inteiro de um veiculo, que e como a tela edita: ela abre a lista
 * da placa, mexe nela e manda de volta.
 *
 * Upsert pelo par (veiculo, tipo), nunca apaga-e-insere. A unique
 * `item_preventivo_veiculo_tipo_uk` nao ignora linha apagada, entao o par que ja
 * existiu continua ocupado; o `onConflictDoUpdate` reaproveita a linha e zera o
 * `apagado_em`, que e o que ressuscita um item removido antes.
 *
 * O que nao veio no corpo e apagado por `apagado_em`, nunca por DELETE fisico:
 * o item guarda o `ultimo_km` de uma manutencao que aconteceu de verdade.
 */
export async function gravarPreventiva(
  db: Db,
  usuarioId: string,
  veiculoId: string,
  itens: EntradaItemPreventivo[],
): Promise<VeiculoPreventivo> {
  return await db.transaction(async (tx) => {
    const [alvo] = await tx
      .select({ id: veiculo.id, placa: veiculo.placa, baseId: veiculo.baseId, base: base.nome })
      .from(veiculo)
      .innerJoin(base, eq(base.id, veiculo.baseId))
      .where(eq(veiculo.id, veiculoId))
    // Id que nao existe e 400. Id que existe em base que nao e do usuario e 403,
    // logo abaixo: quem manda o uuid ja o tem, e esconder o veredito aqui so
    // trocaria uma recusa clara por uma mentira.
    if (!alvo) throw new RegistroInvalido('veículo inexistente')

    const bases = await basesDoUsuario(tx, usuarioId)
    if (!bases.includes(alvo.baseId)) {
      throw new RegistroInvalido('operação não permitida', true)
    }

    const agora = new Date()
    const idsTipo = await tiposPorNome(tx, itens)
    if (itens.length > 0) {
      await tx
        .insert(itemPreventivo)
        .values(
          itens.map((item) => ({
            veiculoId: alvo.id,
            tipoPreventivoId: idsTipo.get(item.tipo)!,
            intervaloKm: item.intervalo_km,
            alertaKm: item.alerta_km,
            ultimoKm: item.ultimo_km,
            obs: item.obs,
            criadoPor: usuarioId,
            atualizadoPor: usuarioId,
          })),
        )
        .onConflictDoUpdate({
          target: [itemPreventivo.veiculoId, itemPreventivo.tipoPreventivoId],
          set: {
            intervaloKm: sqlDoInsert('intervalo_km'),
            alertaKm: sqlDoInsert('alerta_km'),
            ultimoKm: sqlDoInsert('ultimo_km'),
            obs: sqlDoInsert('obs'),
            apagadoEm: null,
            atualizadoPor: usuarioId,
            atualizadoEm: agora,
          },
        })
    }

    const mantidos = [...idsTipo.values()]
    await tx
      .update(itemPreventivo)
      .set({ apagadoEm: agora, atualizadoPor: usuarioId, atualizadoEm: agora })
      .where(
        and(
          eq(itemPreventivo.veiculoId, alvo.id),
          isNull(itemPreventivo.apagadoEm),
          ...(mantidos.length > 0
            ? [notInArray(itemPreventivo.tipoPreventivoId, mantidos)]
            : []),
        ),
      )

    const gravados = await itensDe(tx, [alvo.id])
    return { id: alvo.id, placa: alvo.placa, base: alvo.base, itens: gravados.map(semVeiculo) }
  })
}

/**
 * O `EXCLUDED` do upsert, com o nome da coluna no banco e nao o do campo no
 * TypeScript. O seed tem o mesmo ajudante, pela mesma razao.
 */
const sqlDoInsert = (coluna: string) => sql.raw(`excluded."${coluna}"`)

type Escritor = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * A tela deixa digitar um tipo que nao esta no catalogo ("Outro (digitar abaixo)",
 * em `adicionarItemConfig`). O item aponta para `tipo_preventivo` por chave
 * estrangeira, entao o nome novo vira uma linha do catalogo, com o intervalo e o
 * alerta que o proprio item trouxe. Sem isso esse caminho da tela voltaria 400 e o
 * usuario perderia o que digitou, que e o defeito que esta fase esta consertando.
 */
async function tiposPorNome(
  tx: Escritor,
  itens: EntradaItemPreventivo[],
): Promise<Map<string, string>> {
  const nomes = [...new Set(itens.map((item) => item.tipo))]
  if (nomes.length === 0) return new Map()

  const novos = itens.filter(
    (item, indice) => itens.findIndex((outro) => outro.tipo === item.tipo) === indice,
  )
  await tx
    .insert(tipoPreventivo)
    .values(
      novos.map((item) => ({
        nome: item.tipo,
        intervaloKm: item.intervalo_km,
        alertaKm: item.alerta_km,
      })),
    )
    .onConflictDoNothing({ target: tipoPreventivo.nome })

  const linhas = await tx
    .select({ id: tipoPreventivo.id, nome: tipoPreventivo.nome })
    .from(tipoPreventivo)
    .where(inArray(tipoPreventivo.nome, nomes))
  const mapa = new Map(linhas.map((linha) => [linha.nome, linha.id]))
  for (const nome of nomes) {
    if (!mapa.has(nome)) throw new RegistroInvalido('tipo de preventiva não foi gravado')
  }
  return mapa
}
