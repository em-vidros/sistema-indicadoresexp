/**
 * O estoque de pneus no banco: o saldo por medida e condição, e o histórico de cada
 * movimentação. Os testes usam medidas com o prefixo `ZZ-TESTE`, que a limpeza apaga, e a
 * placa PTV0006, da Raposa no seed.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cookieDaLivia, cookieDe, pedir, sql } from './ajuda.ts'

let livia = ''
let andreina = ''

beforeAll(async () => {
  ;[livia, andreina] = await Promise.all([cookieDaLivia(), cookieDe('andreina', 'SENHA_ANDREINA')])
})

afterAll(async () => {
  await sql`delete from estoque_pneu_movimento where estoque_id in (select id from estoque_pneu where medida like 'ZZ-TESTE%')`
  await sql`delete from estoque_pneu where medida like 'ZZ-TESTE%'`
})

type Linha = { id: string; base: string; medida: string; marca: string; recapagens: number; quantidade: number }
type Movimento = { tipo: string; delta: number; saldoDepois: number; motivo: string; placa: string | null; medida: string }

const base = {
  base: 'Raposa', medida: 'ZZ-TESTE 295/80 R22.5', marca: '', recapagens: 0,
  placa: null, observacao: null,
}

const mover = (cookie: string, corpo: Record<string, unknown>) =>
  pedir('/api/estoque-pneus/movimentos', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ ...base, ...corpo }),
  })

const saldoDe = async (medida: string, recapagens = 0): Promise<number> => {
  const resposta = await pedir('/api/estoque-pneus?base=Raposa', { headers: { cookie: livia } })
  const { linhas } = (await resposta.json()) as { linhas: Linha[] }
  return linhas.find((l) => l.medida === medida && l.recapagens === recapagens)?.quantidade ?? -1
}

describe('movimentar o estoque de pneus', () => {
  test('entrada, saída e ajuste mudam o saldo e deixam uma linha de histórico cada', async () => {
    const medida = 'ZZ-TESTE 11.00 R22'
    const entrada = await mover(livia, { medida, tipo: 'entrada', quantidade: 5, motivo: 'compra' })
    expect(entrada.status).toBe(201)
    expect(((await entrada.json()) as Linha).quantidade).toBe(5)

    expect((await mover(livia, { medida, tipo: 'saida', quantidade: 2, motivo: 'sucata' })).status).toBe(201)
    expect(await saldoDe(medida)).toBe(3)

    // O ajuste é a contagem: o saldo passa a ser 10, e a variação (+7) é o que fica no histórico.
    expect((await mover(livia, { medida, tipo: 'ajuste', quantidade: 10, motivo: 'inventario' })).status).toBe(201)
    expect(await saldoDe(medida)).toBe(10)

    const historico = await pedir('/api/estoque-pneus/movimentos?base=Raposa&limite=200', { headers: { cookie: livia } })
    const { movimentos } = (await historico.json()) as { movimentos: Movimento[] }
    const deste = movimentos.filter((m) => m.medida === medida).reverse()
    expect(deste.map((m) => [m.tipo, m.delta, m.saldoDepois])).toEqual([
      ['entrada', 5, 5],
      ['saida', -2, 3],
      ['ajuste', 7, 10],
    ])
  })

  test('recapados guardam o número de recapagens como condição à parte', async () => {
    const medida = 'ZZ-TESTE 275/80 R22.5'
    await mover(livia, { medida, tipo: 'entrada', quantidade: 4, motivo: 'compra' })
    await mover(livia, { medida, recapagens: 1, tipo: 'entrada', quantidade: 3, motivo: 'retorno_recapadora' })
    await mover(livia, { medida, recapagens: 2, tipo: 'entrada', quantidade: 1, motivo: 'retorno_recapadora' })
    expect(await saldoDe(medida, 0)).toBe(4)
    expect(await saldoDe(medida, 1)).toBe(3)
    expect(await saldoDe(medida, 2)).toBe(1)
    expect(await saldoDe(medida, 3)).toBe(-1)
  })

  test('a mesma medida escrita de outro jeito cai na mesma linha', async () => {
    const medida = 'ZZ-TESTE 215/75 R17.5'
    await mover(livia, { medida, tipo: 'entrada', quantidade: 2, motivo: 'compra' })
    await mover(livia, { medida: '  zz-teste 215/75   r17.5 ', tipo: 'entrada', quantidade: 3, motivo: 'compra' })
    expect(await saldoDe(medida)).toBe(5)
  })

  test('saída maior que o saldo é 400, e uma medida que nunca existiu não deixa linha vazia', async () => {
    const medida = 'ZZ-TESTE 235/75 R17.5'
    await mover(livia, { medida, tipo: 'entrada', quantidade: 2, motivo: 'compra' })
    const recusada = await mover(livia, { medida, tipo: 'saida', quantidade: 3, motivo: 'sucata' })
    expect(recusada.status).toBe(400)
    expect(((await recusada.json()) as { erro: string }).erro).toContain('Só há 2')
    expect(await saldoDe(medida)).toBe(2)

    const inexistente = 'ZZ-TESTE NUNCA EXISTIU'
    expect((await mover(livia, { medida: inexistente, tipo: 'saida', quantidade: 1, motivo: 'sucata' })).status).toBe(400)
    const [linha] = await sql<Array<{ n: number }>>`select count(*)::int as n from estoque_pneu where medida = ${inexistente}`
    expect(linha!.n).toBe(0)
  })

  test('duas saídas ao mesmo tempo com saldo 1: uma passa e a outra é recusada', async () => {
    const medida = 'ZZ-TESTE 385/65 R22.5'
    await mover(livia, { medida, tipo: 'entrada', quantidade: 1, motivo: 'compra' })
    const respostas = await Promise.all([
      mover(livia, { medida, tipo: 'saida', quantidade: 1, motivo: 'sucata' }),
      mover(livia, { medida, tipo: 'saida', quantidade: 1, motivo: 'enviado_recapadora' }),
    ])
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 400])
    expect(await saldoDe(medida)).toBe(0)
  })

  test('ajuste igual ao saldo não grava movimento', async () => {
    const medida = 'ZZ-TESTE AJUSTE IGUAL'
    await mover(livia, { medida, tipo: 'entrada', quantidade: 4, motivo: 'compra' })
    expect((await mover(livia, { medida, tipo: 'ajuste', quantidade: 4, motivo: 'inventario' })).status).toBe(201)
    const [linha] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from estoque_pneu_movimento m join estoque_pneu e on e.id = m.estoque_id
      where e.medida = ${medida}`
    expect(linha!.n).toBe(1)
  })

  test('instalado em veículo pede a placa, que tem de existir na base, e a placa fica no histórico', async () => {
    const medida = 'ZZ-TESTE PLACA'
    await mover(livia, { medida, tipo: 'entrada', quantidade: 3, motivo: 'compra' })
    const semPlaca = await mover(livia, { medida, tipo: 'saida', quantidade: 1, motivo: 'instalado_veiculo' })
    expect(semPlaca.status).toBe(400)
    const alheia = await mover(livia, { medida, tipo: 'saida', quantidade: 1, motivo: 'instalado_veiculo', placa: 'DMG9D41' })
    expect(alheia.status).toBe(400)
    const certa = await mover(livia, { medida, tipo: 'saida', quantidade: 1, motivo: 'instalado_veiculo', placa: 'ptv0006' })
    expect(certa.status).toBe(201)
    const [linha] = await sql<Array<{ placa: string | null }>>`
      select m.placa from estoque_pneu_movimento m join estoque_pneu e on e.id = m.estoque_id
      where e.medida = ${medida} and m.tipo = 'saida'`
    expect(linha!.placa).toBe('PTV0006')
  })

  test('motivo de outro tipo, condição acima de 3× e medida vazia são 400', async () => {
    expect((await mover(livia, { tipo: 'entrada', quantidade: 1, motivo: 'instalado_veiculo' })).status).toBe(400)
    expect((await mover(livia, { tipo: 'entrada', quantidade: 1, motivo: 'compra', recapagens: 4 })).status).toBe(400)
    expect((await mover(livia, { medida: '   ', tipo: 'entrada', quantidade: 1, motivo: 'compra' })).status).toBe(400)
    expect((await mover(livia, { tipo: 'entrada', quantidade: 0, motivo: 'compra' })).status).toBe(400)
    expect((await mover(livia, { tipo: 'entrada', quantidade: 1.5, motivo: 'compra' })).status).toBe(400)
  })
})

describe('quem mexe no estoque de pneus', () => {
  test('a Andreina mexe na Raposa, e leva 403 em Imperatriz, na escrita e na leitura', async () => {
    const dela = await mover(andreina, { medida: 'ZZ-TESTE ANDREINA', tipo: 'entrada', quantidade: 1, motivo: 'compra' })
    expect(dela.status).toBe(201)

    const alheia = await mover(andreina, { base: 'Imperatriz', medida: 'ZZ-TESTE ANDREINA', tipo: 'entrada', quantidade: 1, motivo: 'compra' })
    expect(alheia.status).toBe(403)
    const leitura = await pedir('/api/estoque-pneus?base=Imperatriz', { headers: { cookie: andreina } })
    expect(leitura.status).toBe(403)
    const historico = await pedir('/api/estoque-pneus/movimentos?base=Imperatriz', { headers: { cookie: andreina } })
    expect(historico.status).toBe(403)
  })

  test('sem sessão é 401', async () => {
    expect((await pedir('/api/estoque-pneus?base=Raposa')).status).toBe(401)
    expect((await pedir('/api/estoque-pneus/movimentos', { method: 'POST' })).status).toBe(401)
  })
})
