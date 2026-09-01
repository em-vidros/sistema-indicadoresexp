/**
 * O que o servidor precisa saber sobre quem acabou de entrar, numa consulta so.
 *
 * Devolve NOME de base, e nao id. Os ids sao uuid e a tela compara por nome
 * (`basesPermitidas.includes('Raposa')`, `base === 'Belém'`): traduzir aqui evita
 * que cada rota que monta a sessao refaca o mesmo join.
 *
 * A consulta e SQL cru, e nao query builder, porque sao dois `array_agg` ordenados
 * dentro de subselect, que em SQL cabem em cinco linhas legiveis. O parametro e
 * `Leitor`, com o unico metodo usado, e nao `Db`: a transacao tambem satisfaz esse
 * tipo, e por isso o teste roda a consulta dentro do proprio rollback que semeia o
 * banco.
 */
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export type DadosSessao = {
  usuarioId: string
  /** A parte local do e-mail: 'livia', 'andreina'. E a chave do objeto USUARIOS. */
  usuario: string
  nome: string
  admin: boolean
  /** Nome da base travada. Nulo so no admin, e o CHECK `user_admin_sem_base_ck` garante. */
  baseFixa: string | null
  bases: string[]
  tipos: string[]
}

type Leitor = { execute: (consulta: SQL) => Promise<unknown[]> }

type Linha = {
  id: string
  email: string
  name: string
  admin: boolean
  base_fixa: string | null
  bases: string[]
  tipos: string[]
}

export async function sessaoDoUsuario(db: Leitor, usuarioId: string): Promise<DadosSessao | null> {
  const linhas = await db.execute(sql`
    select
      u.id,
      u.email,
      u.name,
      u.admin,
      b.nome as base_fixa,
      coalesce(
        (select array_agg(bb.nome order by bb.nome)
           from usuario_base ub
           join base bb on bb.id = ub.base_id
          where ub.usuario_id = u.id),
        '{}'::text[]
      ) as bases,
      coalesce(
        (select array_agg(ut.tipo::text order by ut.tipo::text)
           from usuario_tipo ut
          where ut.usuario_id = u.id),
        '{}'::text[]
      ) as tipos
    from "user" u
    left join base b on b.id = u.base_id
    where u.id = ${usuarioId}
  `)

  const linha = linhas[0] as Linha | undefined
  if (!linha) return null

  return {
    usuarioId: linha.id,
    usuario: linha.email.split('@')[0] ?? linha.email,
    nome: linha.name,
    admin: linha.admin,
    baseFixa: linha.base_fixa,
    bases: linha.bases,
    tipos: linha.tipos,
  }
}
