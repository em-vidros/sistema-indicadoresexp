/**
 * Os dois campos que a fase 0 tinha perdido, contra o Postgres de verdade.
 *
 * `admin` e `base_id` existiam no objeto USUARIOS do HTML e nao chegaram ao banco.
 * Sem eles o servidor nao monta a sessao: `admin` destrava o seletor de base e o
 * menu de administracao, `base_id` diz qual base ja vem selecionada e travada.
 *
 * O CHECK e a metade que o seed sozinho nao prova. Ele existe para que o estado
 * que a tela nao sabe desenhar nao caiba no banco, e quem grava por fora do seed
 * (better-auth, importador) tambem esbarra nele.
 */
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError, sql } from 'drizzle-orm'
import { sessaoDoUsuario } from '../src/consultas/sessao.ts'
import { criarDb } from '../src/index.ts'
import { base, user } from '../src/schema/index.ts'
import { type DepsSeed, carregarConstantes, semearEm } from '../src/seed.ts'

const { db, sql: conexao } = criarDb(undefined, { max: 1 })

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const DEPS: DepsSeed = {
  hashSenha: async (senha) => `falso:${senha}`,
  provedorSenha: 'credential',
  issuerSenha: 'local:credential',
  senhaDe: (chave) => `senha-de-teste-${chave}`,
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
             meta, parametro, programa_integracao, programa_semana,
             programa_atividade, programa_criterio, "user", account, session,
             usuario_base, usuario_tipo
    restart identity cascade
  `)
  await semearEm(tx, DEPS, carregarConstantes())
}

test('o seed grava a livia como admin sem base e trava os outros tres na sua', async () => {
  const linhas = await emTransacao(async (tx) => {
    await semear(tx)
    const saida = await tx.execute<{ id: string; admin: boolean; base: string | null }>(sql`
      select u.id, u.admin, b.nome as base
        from "user" u
        left join base b on b.id = u.base_id
       order by u.id
    `)
    return saida.map((l) => ({ id: l.id, admin: l.admin, base: l.base }))
  })

  expect(linhas).toEqual([
    { id: 'usr_andreina', admin: false, base: 'Raposa' },
    { id: 'usr_belem', admin: false, base: 'Belém' },
    { id: 'usr_livia', admin: true, base: null },
    { id: 'usr_lucascunha', admin: false, base: 'Imperatriz' },
  ])
})

/**
 * Uma transacao por tentativa. O Postgres aborta a transacao inteira no primeiro
 * erro, entao o segundo insert falharia por "current transaction is aborted" e o
 * teste passaria pelo motivo errado.
 */
test('admin com base fixa nao entra, e usuario comum sem base tambem nao', async () => {
  const adminComBase = await emTransacao(async (tx) => {
    const [b] = await tx.insert(base).values({ nome: 'Teste sessao' }).returning()
    return erroDe(
      tx.insert(user).values({
        id: 'usr_teste_admin',
        name: 'Admin com base',
        email: 'admin-com-base@teste.local',
        admin: true,
        baseId: b!.id,
      }),
    )
  })

  const comumSemBase = await emTransacao(async (tx) =>
    erroDe(
      tx.insert(user).values({
        id: 'usr_teste_comum',
        name: 'Comum sem base',
        email: 'comum-sem-base@teste.local',
        admin: false,
      }),
    ),
  )

  expect(adminComBase?.cause?.constraint_name).toBe('user_admin_sem_base_ck')
  expect(comumSemBase?.cause?.constraint_name).toBe('user_admin_sem_base_ck')
})

// Nome de base, e nao id: a tela compara por nome, e os ids sao uuid derivado.
test('sessaoDoUsuario devolve as bases e os tipos por nome', async () => {
  const sessoes = await emTransacao(async (tx) => {
    await semear(tx)
    return {
      livia: await sessaoDoUsuario(tx, 'usr_livia'),
      andreina: await sessaoDoUsuario(tx, 'usr_andreina'),
      fantasma: await sessaoDoUsuario(tx, 'usr_nao_existe'),
    }
  })

  expect(sessoes.livia).toEqual({
    usuarioId: 'usr_livia',
    usuario: 'livia',
    nome: 'Livia (Admin)',
    admin: true,
    baseFixa: null,
    bases: ['Belém', 'Imperatriz', 'Raposa'],
    tipos: ['abastecimento', 'manutencao', 'quebra', 'viagem'],
  })

  expect(sessoes.andreina).toEqual({
    usuarioId: 'usr_andreina',
    usuario: 'andreina',
    nome: 'Andreina',
    admin: false,
    baseFixa: 'Raposa',
    bases: ['Raposa'],
    tipos: ['abastecimento', 'manutencao', 'quebra', 'viagem'],
  })

  expect(sessoes.fantasma).toBeNull()
})

afterAll(async () => {
  await conexao.end()
})
