/**
 * Os CHECK do documento contra o Postgres de verdade. Eles repetiam a exigencia que
 * o dominio fazia e que a origem nao cumpre: `grep -c tacografo_venc
 * documentos-frota.html` devolve 0, e os 7 tacografos que o sistema ja entrega nao
 * tem data nenhuma. Com o CHECK antigo, nenhum deles poderia ser semeado.
 */
import { afterAll, expect, test } from 'bun:test'
import { TransactionRollbackError } from 'drizzle-orm'
import { criarDb } from '../src/index.ts'
import { base, colaborador, veiculo } from '../src/schema/cadastro.ts'
import { arquivo, documento } from '../src/schema/documento.ts'

const { db, sql } = criarDb(undefined, { max: 1 })

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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

async function cenario(tx: Tx) {
  const [b] = await tx.insert(base).values({ nome: 'Teste documento' }).returning()
  const baseId = b!.id
  const [v] = await tx.insert(veiculo).values({ placa: 'DOC0001', baseId }).returning()
  const [c] = await tx
    .insert(colaborador)
    .values({ nome: 'Motorista Documento', funcao: 'motorista', baseId })
    .returning()
  return { baseId, veiculoId: v!.id, colaboradorId: c!.id }
}

test('tacografo sem vencimento entra, e a CNH sem numero e sem categoria tambem', async () => {
  const linhas = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return tx
      .insert(documento)
      .values([
        {
          tipo: 'tacografo',
          veiculoId: ids.veiculoId,
          linkExterno: 'docs/tacografo-PTV0006.pdf',
        },
        {
          tipo: 'cnh',
          colaboradorId: ids.colaboradorId,
          linkExterno: 'https://drive.google.com/file/d/abc',
        },
      ])
      .returning()
  })

  expect(linhas[0]!.vencimento).toBeNull()
  expect(linhas[1]!.cnhNumero).toBeNull()
  expect(linhas[1]!.cnhCategoria).toBeNull()
})

test('quem nao vence continua sem poder ter vencimento, e numero de CNH so na CNH', async () => {
  const planoComVencimento = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(documento).values({
        tipo: 'plano_pgq',
        baseId: ids.baseId,
        vencimento: '2026-12-01',
        linkExterno: 'docs/pgq-manutencao-2026.pdf',
      }),
    )
  })
  const cnhForaDaCnh = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(
      tx.insert(documento).values({
        tipo: 'crlv',
        veiculoId: ids.veiculoId,
        cnhNumero: '01234567890',
        linkExterno: 'docs/crlv.pdf',
      }),
    )
  })

  expect(planoComVencimento?.cause?.constraint_name).toBe('documento_vencimento_ck')
  expect(cnhForaDaCnh?.cause?.constraint_name).toBe('documento_cnh_ck')
})

test('arquivo e link convivem, e a linha sem os dois nao entra', async () => {
  const semFonte = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return erroDe(tx.insert(documento).values({ tipo: 'crlv', veiculoId: ids.veiculoId }))
  })

  expect(semFonte?.cause?.constraint_name).toBe('documento_fonte_ck')
})

/**
 * O CHECK antigo era `arquivo_id IS NOT NULL OR link_externo IS NOT NULL`, e testava
 * so a ausencia: `link_externo = ''` entrava como documento sem fonte, e
 * `'javascript:alert(document.cookie)'` entrava inteiro. O dominio barra os dois com
 * regex, mas quem entra pelo seed ou por importador nao passa pelo zod, e a tela da
 * fase 2 renderiza esse valor num `<a href>`.
 */
test('link vazio ou com esquema estranho nao e fonte', async () => {
  const recusados = [
    '',
    ' ',
    'javascript:alert(document.cookie)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'docs/manual atego.pdf',
  ]
  const erros = []
  for (const linkExterno of recusados) {
    erros.push(
      await emTransacao(async (tx) => {
        const ids = await cenario(tx)
        return erroDe(
          tx.insert(documento).values({ tipo: 'crlv', veiculoId: ids.veiculoId, linkExterno }),
        )
      }),
    )
  }

  expect(erros.map((e) => e?.cause?.constraint_name)).toEqual(recusados.map(() => 'documento_fonte_ck'))
})

// O mesmo conjunto que o `link` de `dominio/documento.ts` aceita. O caminho relativo
// tem que continuar valendo: e o formato dos literais MANUAIS_RAPOSA e PLANOS.
test('http, https e caminho relativo continuam entrando', async () => {
  const linhas = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    return tx
      .insert(documento)
      .values([
        { tipo: 'crlv', veiculoId: ids.veiculoId, linkExterno: 'docs/manual-atego.pdf' },
        { tipo: 'plano_pgq', baseId: ids.baseId, linkExterno: 'docs/pgq-manutencao-2026.pdf' },
        { tipo: 'tacografo', veiculoId: ids.veiculoId, linkExterno: 'http://intranet/doc.pdf' },
        {
          tipo: 'apolice',
          veiculoId: ids.veiculoId,
          linkExterno: 'https://drive.google.com/file/d/abc',
        },
      ])
      .returning()
  })

  expect(linhas).toHaveLength(4)
})

// Arquivo presente e fonte de verdade, e o link segue livre para ser nulo.
test('arquivo sem link nenhum e fonte suficiente', async () => {
  const linha = await emTransacao(async (tx) => {
    const ids = await cenario(tx)
    const [a] = await tx
      .insert(arquivo)
      .values({
        nomeOriginal: 'crlv.pdf',
        mime: 'application/pdf',
        tamanho: 10,
        caminho: 'doc/1',
        sha256: 'a',
      })
      .returning()
    const [d] = await tx
      .insert(documento)
      .values({ tipo: 'crlv', veiculoId: ids.veiculoId, arquivoId: a!.id })
      .returning()
    return d!
  })

  expect(linha.linkExterno).toBeNull()
})

afterAll(async () => {
  await sql.end()
})
