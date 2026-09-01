/**
 * "Quais bases este usuario alcanca" — a leitura, uma vez so.
 *
 * A fase 2 escreveu esta mesma consulta em tres lugares (`registros.ts`,
 * `atas.ts`, `integracoes.ts`), porque cada dominio precisava dela e a original
 * era privada. Regra de autorizacao copiada e o pior tipo de duplicacao: quando
 * a regra muda, a copia esquecida nao quebra teste nenhum, ela vaza dado em
 * silencio.
 *
 * Aqui mora **so a leitura**. O que cada dominio faz com a resposta continua
 * sendo do dominio: qual coluna carrega a base (`ata.base_id`,
 * `colaborador.base_id` pelo join, `coalesce` de tres no documento), o que uma
 * base nula significa (ata da empresa, ficha de nome livre, documento sem dono)
 * e se a recusa e 403 ou 404 nao sao a mesma pergunta e nao cabem numa funcao
 * so sem virar um punhado de flags — e a flag errada e exatamente por onde o
 * vazamento entra.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '../index.ts'
import { user, usuarioBase } from '../schema/auth.ts'
import { base } from '../schema/cadastro.ts'

type Leitor = Pick<Db, 'select'>

export type BasePermitida = { id: string; nome: string }

export type PermissaoBases = {
  admin: boolean
  /**
   * A base que o usuario tem travada no formulario. Sempre `null` no admin: o
   * CHECK `user_admin_sem_base_ck` nao deixa admin ter `base_id`.
   */
  baseFixa: string | null
  /** As bases que ele alcanca, com nome, porque o registro casa base por nome. */
  bases: BasePermitida[]
  /** A mesma lista, so os ids, que e o formato que o `inArray` pede. */
  ids: string[]
}

/**
 * Admin enxerga toda base ativa; o resto enxerga o que `usuario_base` lista,
 * ativa ou nao — quem perdeu a base perde a lista inteira, e nao meia lista.
 *
 * Usuario que nao existe volta `null`, e nao erro: cada dominio tem o proprio
 * vocabulario de recusa (`RegistroInvalido` com booleano, `AtaInvalida` e
 * `IntegracaoInvalida` com status, `DocumentoInvalido` com status) e quem
 * escolhe a palavra e ele, nao esta funcao.
 */
export async function lerPermissao(
  db: Leitor,
  usuarioId: string,
): Promise<PermissaoBases | null> {
  const [pessoa] = await db
    .select({ admin: user.admin, baseFixa: user.baseId })
    .from(user)
    .where(eq(user.id, usuarioId))
  if (!pessoa) return null

  const bases = pessoa.admin
    ? await db.select({ id: base.id, nome: base.nome }).from(base).where(eq(base.ativo, true))
    : await db
        .select({ id: base.id, nome: base.nome })
        .from(usuarioBase)
        .innerJoin(base, eq(base.id, usuarioBase.baseId))
        .where(eq(usuarioBase.usuarioId, usuarioId))

  return {
    admin: pessoa.admin,
    baseFixa: pessoa.baseFixa,
    bases,
    ids: bases.map((item) => item.id),
  }
}
