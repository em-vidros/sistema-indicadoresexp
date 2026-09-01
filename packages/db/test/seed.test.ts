/**
 * O seed roda duas vezes e o banco fica igual.
 *
 * Isso nao e zelo: a primeira versao deste seed gravou as 3 bases, estourou na
 * tabela seguinte e deixou o banco pela metade. A segunda tentativa nao conseguiu
 * se recuperar sozinha, porque `ON CONFLICT (id)` nao ve a linha velha quando o id
 * derivado muda, e o UNIQUE de `base.nome` recusa a nova. Daí as duas decisoes que
 * este teste guarda: transacao unica em volta de tudo, e `onConflictDoUpdate` em vez
 * de TRUNCATE, que apagaria registro de viagem junto com o cadastro.
 *
 * Roda dentro de uma transacao que ele mesmo desfaz, entao nao encosta no banco de
 * verdade nem depende de ordem entre os arquivos de teste. O hasher e falso de
 * proposito: o que esta sob teste sao as nove contagens, e scrypt de 8 senhas
 * custaria segundos para nao provar nada a mais.
 */
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError, sql } from 'drizzle-orm'
import { criarDb } from '../src/index.ts'
import { type Contagens, type DepsSeed, carregarConstantes, semearEm } from '../src/seed.ts'

const { db, sql: conexao } = criarDb(undefined, { max: 1 })

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const DEPS: DepsSeed = {
  hashSenha: async (senha) => `falso:${senha}`,
  provedorSenha: 'credential',
  issuerSenha: 'local:credential',
  senhaDe: (chave) => `senha-de-teste-${chave}`,
  agora: new Date('2026-08-31T12:00:00Z'),
}

// As contagens saem do banco, e nao do que `semear` devolve: o retorno mede o que o
// seed quis gravar, e a pergunta aqui e o que ficou gravado.
async function doBanco(tx: Tx): Promise<Contagens> {
  const [linha] = await tx.execute<Record<keyof Contagens, string>>(sql`
    select
      (select count(*) from base)                as bases,
      (select count(*) from veiculo)             as veiculos,
      (select count(*) from colaborador)         as colaboradores,
      (select count(*) from rota)                as rotas,
      (select count(*) from tipo_preventivo)     as "tiposPreventiva",
      (select count(*) from "user")              as usuarios,
      (select count(*) from meta)                as metas,
      (select count(*) from programa_integracao) as programas,
      (select count(*) from programa_atividade)  as atividades
  `)
  const n = (v: string | undefined) => Number(v ?? -1)
  return {
    bases: n(linha?.bases),
    veiculos: n(linha?.veiculos),
    colaboradores: n(linha?.colaboradores),
    rotas: n(linha?.rotas),
    tiposPreventiva: n(linha?.tiposPreventiva),
    usuarios: n(linha?.usuarios),
    metas: n(linha?.metas),
    programas: n(linha?.programas),
    atividades: n(linha?.atividades),
  }
}

/**
 * Partir do zero dentro da transacao. Sem isto o teste passaria de graca num banco
 * ja semeado, que e justamente o estado em que ele mais precisa provar alguma coisa.
 * O TRUNCATE e do teste, e nao do seed: aqui ele morre no rollback.
 */
async function zerar(tx: Tx) {
  // O CASCADE avisa em NOTICE cada tabela filha que ele alcanca, e sao dezenas.
  await tx.execute(sql`set local client_min_messages = warning`)
  await tx.execute(sql`
    truncate base, veiculo, colaborador, rota, tipo_preventivo, item_preventivo,
             meta, parametro, programa_integracao, programa_semana,
             programa_atividade, programa_criterio, "user", account, session,
             usuario_base, usuario_tipo
    restart identity cascade
  `)
}

const ESPERADO: Contagens = {
  bases: 3,
  veiculos: 15,
  colaboradores: 31,
  rotas: 22,
  tiposPreventiva: 8,
  usuarios: 4,
  metas: 4,
  programas: 2,
  atividades: 47,
}

test('rodar o seed duas vezes nao muda as nove contagens', async () => {
  const c = carregarConstantes()
  let saida: { primeira: Contagens; segunda: Contagens } | undefined

  try {
    await db.transaction(async (tx) => {
      await zerar(tx)

      await semearEm(tx, DEPS, c)
      const primeira = await doBanco(tx)
      await semearEm(tx, DEPS, c)
      const segunda = await doBanco(tx)

      saida = { primeira, segunda }
      tx.rollback()
    })
  } catch (erro) {
    if (!(erro instanceof TransactionRollbackError)) throw erro
  }

  expect(saida?.primeira).toEqual(ESPERADO)
  expect(saida?.segunda).toEqual(ESPERADO)
})

test('a segunda passada atualiza a linha em vez de criar outra', async () => {
  const c = carregarConstantes()
  let placas: { antes: number; depois: number } | undefined

  try {
    await db.transaction(async (tx) => {
      await zerar(tx)
      await semearEm(tx, DEPS, c)
      // 15 veiculos para 15 placas distintas, e 22 rotas para 20 nomes: BELEM e
      // SALINOPOLIS existem em duas bases. Se a segunda passada duplicasse, os dois
      // numeros subiriam juntos.
      const [a] = await tx.execute<{ placas: string; rotas: string }>(sql`
        select (select count(distinct placa) from veiculo) as placas,
               (select count(distinct nome) from rota) as rotas
      `)
      await semearEm(tx, DEPS, c)
      const [d] = await tx.execute<{ placas: string; rotas: string }>(sql`
        select (select count(distinct placa) from veiculo) as placas,
               (select count(distinct nome) from rota) as rotas
      `)
      expect(Number(a?.placas)).toBe(15)
      expect(Number(a?.rotas)).toBe(20)
      placas = { antes: Number(a?.placas), depois: Number(d?.placas) }
      expect(Number(d?.rotas)).toBe(20)
      tx.rollback()
    })
  } catch (erro) {
    if (!(erro instanceof TransactionRollbackError)) throw erro
  }

  expect(placas?.depois).toBe(placas?.antes)
})

afterAll(async () => {
  await conexao.end()
})
