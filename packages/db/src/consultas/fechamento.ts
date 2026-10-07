/**
 * O fechamento mensal: por base, trava lancamento novo e edicao de lancamento
 * existente naquele mes. So quem ve todas as bases fecha e reabre -- e o
 * "eu preciso validar ou reabrir" que a Livia pediu, e nao uma capacidade nova:
 * reusa `permissao.todasAsBases`, a mesma que ja separa admin do resto em
 * `atas.ts`.
 *
 * `registros.ts` e quem consulta `mesEstaFechado` antes de gravar; este
 * arquivo so sabe abrir, fechar e listar.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { base } from '../schema/cadastro.ts'
import { fechamentoMensal } from '../schema/fechamento.ts'
import { lerPermissao } from './permissao.ts'

export class FechamentoInvalido extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message)
  }
}

export type FechamentoDaBase = { id: string; mes: string; fechadoEm: string; fechadoPor: string | null }

type Leitor = Pick<Db, 'select'>

/** O primeiro dia do mes de uma data `YYYY-MM-DD`, pro fechamento comparar mes com mes. */
export function primeiroDiaDoMes(data: string): string {
  return `${data.slice(0, 7)}-01`
}

/** Se a base tem aquele mes fechado agora. `data` e qualquer dia dentro do mes. */
export async function mesEstaFechado(db: Leitor, baseId: string, data: string): Promise<boolean> {
  const [linha] = await db
    .select({ id: fechamentoMensal.id })
    .from(fechamentoMensal)
    .where(
      and(
        eq(fechamentoMensal.baseId, baseId),
        eq(fechamentoMensal.mes, primeiroDiaDoMes(data)),
        isNull(fechamentoMensal.apagadoEm),
      ),
    )
  return linha !== undefined
}

/**
 * Os meses fechados das bases que a sessao alcanca, pra tela desenhar o cadeado
 * sem perguntar mes a mes. Quem nao ve todas as bases so recebe a dela mesma,
 * do mesmo jeito que `catalogoAta` faz com colaborador.
 */
export async function listarFechamentos(db: Db, usuarioId: string): Promise<Record<string, FechamentoDaBase[]>> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao) throw new FechamentoInvalido('usuário inexistente', 403)
  if (!permissao.todasAsBases && permissao.ids.length === 0) return {}

  const linhas = await db
    .select({
      id: fechamentoMensal.id,
      baseNome: base.nome,
      mes: fechamentoMensal.mes,
      fechadoEm: fechamentoMensal.criadoEm,
      fechadoPor: fechamentoMensal.criadoPor,
    })
    .from(fechamentoMensal)
    .innerJoin(base, eq(base.id, fechamentoMensal.baseId))
    .where(
      and(
        isNull(fechamentoMensal.apagadoEm),
        permissao.todasAsBases ? undefined : inArray(fechamentoMensal.baseId, permissao.ids),
      ),
    )

  const porBase: Record<string, FechamentoDaBase[]> = {}
  for (const linha of linhas) {
    const lista = porBase[linha.baseNome] ?? []
    lista.push({
      id: linha.id,
      mes: linha.mes,
      fechadoEm: linha.fechadoEm.toISOString(),
      fechadoPor: linha.fechadoPor,
    })
    porBase[linha.baseNome] = lista
  }
  return porBase
}

/**
 * Fecha o mes de uma base. So quem ve todas as bases -- gestor e operador nao
 * fecham nada, nem a propria. `mes` chega como `YYYY-MM-DD` (primeiro dia) ou
 * `YYYY-MM`; os dois viram o mesmo `primeiroDiaDoMes`.
 */
export async function fecharMes(
  db: Db,
  usuarioId: string,
  baseNome: string,
  mes: string,
): Promise<{ id: string }> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao?.todasAsBases) throw new FechamentoInvalido('só o administrador fecha o mês', 403)

  const alvo = permissao.bases.find((b) => b.nome === baseNome)
  if (!alvo) throw new FechamentoInvalido(`base '${baseNome}' inexistente`)

  const primeiroDia = primeiroDiaDoMes(mes)
  if (await mesEstaFechado(db, alvo.id, primeiroDia)) {
    throw new FechamentoInvalido(`${baseNome} já está fechada em ${primeiroDia.slice(0, 7)}`)
  }

  const [linha] = await db
    .insert(fechamentoMensal)
    .values({ baseId: alvo.id, mes: primeiroDia, criadoPor: usuarioId, atualizadoPor: usuarioId })
    .returning({ id: fechamentoMensal.id })
  if (!linha) throw new FechamentoInvalido('não foi possível fechar o mês')
  return linha
}

/** Reabre: soft-delete da linha do fechamento, no mesmo padrao do resto da casa. */
export async function reabrirMes(db: Db, usuarioId: string, id: string): Promise<void> {
  const permissao = await lerPermissao(db, usuarioId)
  if (!permissao?.todasAsBases) throw new FechamentoInvalido('só o administrador reabre o mês', 403)

  const agora = new Date()
  const linhas = await db
    .update(fechamentoMensal)
    .set({ apagadoEm: agora, atualizadoPor: usuarioId, atualizadoEm: agora })
    .where(and(eq(fechamentoMensal.id, id), isNull(fechamentoMensal.apagadoEm)))
    .returning({ id: fechamentoMensal.id })
  if (linhas.length === 0) throw new FechamentoInvalido('fechamento inexistente', 404)
}
