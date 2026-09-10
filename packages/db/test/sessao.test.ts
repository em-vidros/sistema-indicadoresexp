/**
 * O que a fase 0 tinha perdido, contra o Postgres de verdade.
 *
 * `papel` e `base_id` existiam no objeto USUARIOS do HTML e nao chegaram ao banco.
 * Sem eles o servidor nao monta a sessao: o papel decide as capacidades, `base_id`
 * diz qual base ja vem selecionada e travada.
 *
 * O CHECK e a metade que o seed sozinho nao prova. Ele existe para que o estado
 * que a tela nao sabe desenhar nao caiba no banco, e quem grava por fora do seed
 * (better-auth, importador) tambem esbarra nele.
 */
import { CAPACIDADES } from '@ind/core'
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError, sql } from 'drizzle-orm'
import { sessaoDoUsuario } from '../src/consultas/sessao.ts'
import { criarDb } from '../src/index.ts'
import { base, user, usuarioBase, usuarioTipo } from '../src/schema/index.ts'
import { type DepsSeed, carregarConstantes, semearEm } from '../src/seed.ts'

const { db, sql: conexao } = criarDb(undefined, { max: 1 })

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const DEPS: DepsSeed = {
  provedorSenha: 'credential',
  issuerSenha: 'local:credential',
  agora: new Date('2026-08-31T12:00:00Z'),
}

async function emTransacao<T>(corpo: (tx: Tx) => Promise<T>): Promise<T> {
  let saida: T | undefined
  try {
    await db.transaction(async (tx) => {
      saida = await corpo(tx)
      tx.rollback()
    })
  } catch (erro) {
    if (!(erro instanceof TransactionRollbackError)) throw erro
  }
  return saida as T
}

const erroDe = (p: Promise<unknown>) =>
  p.then(() => null).catch((e: unknown) => e as { cause?: { constraint_name?: string } })

/** Partir do zero: num banco ja semeado o teste passaria sem provar nada. */
async function semear(tx: Tx) {
  await tx.execute(sql`set local client_min_messages = warning`)
  await tx.execute(sql`
    truncate base, veiculo, colaborador, rota, tipo_preventivo, item_preventivo,
             meta, parametro, politica_documento, programa_integracao, programa_semana,
             programa_atividade, programa_criterio, "user", account, session,
             convite_senha, usuario_base, usuario_tipo
    restart identity cascade
  `)
  await semearEm(tx, DEPS, carregarConstantes())
}

test('o seed grava os dois iniciais como admin sem base', async () => {
  const linhas = await emTransacao(async (tx) => {
    await semear(tx)
    const saida = await tx.execute<{ id: string; papel: string; base: string | null }>(sql`
      select u.id, u.papel, b.nome as base
        from "user" u
        left join base b on b.id = u.base_id
       order by u.id
    `)
    return saida.map((l) => ({ id: l.id, papel: l.papel, base: l.base }))
  })

  expect(linhas).toEqual([
    { id: 'usr_henrique', papel: 'admin', base: null },
    { id: 'usr_livia', papel: 'admin', base: null },
  ])
})

/**
 * Uma transacao por tentativa. O Postgres aborta a transacao inteira no primeiro
 * erro, entao o segundo insert falharia por "current transaction is aborted" e o
 * teste passaria pelo motivo errado.
 */
test('admin com base fixa nao entra, e operador sem base tambem nao', async () => {
  const adminComBase = await emTransacao(async (tx) => {
    const [b] = await tx.insert(base).values({ nome: 'Teste sessao' }).returning()
    return erroDe(
      tx.insert(user).values({
        id: 'usr_teste_admin',
        name: 'Admin com base',
        email: 'admin-com-base@teste.local',
        papel: 'admin',
        baseId: b!.id,
      }),
    )
  })

  const operadorSemBase = await emTransacao(async (tx) =>
    erroDe(
      tx.insert(user).values({
        id: 'usr_teste_operador',
        name: 'Operador sem base',
        email: 'operador-sem-base@teste.local',
        papel: 'operador',
      }),
    ),
  )

  expect(adminComBase?.cause?.constraint_name).toBe('user_papel_base_ck')
  expect(operadorSemBase?.cause?.constraint_name).toBe('user_papel_base_ck')
})

// Nome de base, e nao id: a tela compara por nome, e os ids sao uuid derivado.
// As capacidades vem resolvidas junto, para que a tela nao precise da propria copia.
test('sessaoDoUsuario devolve as bases e os tipos por nome, com as capacidades do papel', async () => {
  const sessoes = await emTransacao(async (tx) => {
    await semear(tx)

    const [raposa] = await tx.select().from(base).where(sql`nome = 'Raposa'`)
    await tx.insert(user).values({
      id: 'usr_teste_operador',
      name: 'Operador da Raposa',
      email: 'operador@teste.local',
      papel: 'operador',
      baseId: raposa!.id,
    })
    await tx.insert(usuarioBase).values({ usuarioId: 'usr_teste_operador', baseId: raposa!.id })
    await tx.insert(usuarioTipo).values({ usuarioId: 'usr_teste_operador', tipo: 'viagem' })

    return {
      livia: await sessaoDoUsuario(tx, 'usr_livia'),
      operador: await sessaoDoUsuario(tx, 'usr_teste_operador'),
      fantasma: await sessaoDoUsuario(tx, 'usr_nao_existe'),
    }
  })

  expect(sessoes.livia).toEqual({
    usuarioId: 'usr_livia',
    usuario: 'livia',
    nome: 'Livia',
    papel: 'admin',
    capacidades: CAPACIDADES.admin,
    baseFixa: null,
    bases: ['Belém', 'Imperatriz', 'Raposa'],
    tipos: ['abastecimento', 'manutencao', 'quebra', 'viagem'],
  })

  expect(sessoes.operador).toEqual({
    usuarioId: 'usr_teste_operador',
    usuario: 'operador',
    nome: 'Operador da Raposa',
    papel: 'operador',
    capacidades: CAPACIDADES.operador,
    baseFixa: 'Raposa',
    bases: ['Raposa'],
    tipos: ['viagem'],
  })

  expect(sessoes.fantasma).toBeNull()
})

afterAll(async () => {
  await conexao.end()
})
