import { describe, expect, test } from 'bun:test'
import { Documento, venceEm } from '../../src/dominio/documento.ts'
import { ArquivoId, criarId } from '../../src/dominio/ids.ts'
import { dataISO } from '../../src/dominio/tempo.ts'
import { statusVencimento } from '../../src/dominio/vencimento.ts'

const fonteArquivo = { arquivo: 'arq-1', link: null }
const fonteLink = { arquivo: null, link: 'https://drive.google.com/file/d/abc' }

// Sem `seguradora`: e chave so da apolice, e nos outros dois tipos de veiculo o
// `strictObject` a recusa, igual ao `documento_seguradora_ck` do banco.
const doVeiculo = {
  id: 'doc-1',
  fonte: fonteArquivo,
  atualizadoEm: '2026-08-31',
  veiculo: 'PTV0006',
  vencimento: '2026-12-01',
}

const apolice = { ...doVeiculo, tipo: 'apolice', seguradora: 'Porto Seguro' }

describe('Fonte', () => {
  test('arquivo, link, ou os dois', () => {
    expect(Documento.safeParse({ ...apolice, fonte: fonteLink }).success).toBe(true)
    expect(Documento.safeParse({ ...apolice, fonte: fonteArquivo }).success).toBe(true)
  })

  // `salvarDoc` grava link e pdfB64 juntos (documentos-frota.html, linhas 673 a 689),
  // e a uniao exclusiva descartava o link do Drive em silencio.
  test('arquivo e link ao mesmo tempo preserva os dois', () => {
    const d = Documento.parse({
      ...apolice,
      fonte: { arquivo: 'arq-1', link: 'https://drive.google.com/file/d/abc' },
    })
    expect(d.fonte.arquivo).toBe(criarId(ArquivoId, 'arq-1'))
    expect(d.fonte.link).toBe('https://drive.google.com/file/d/abc')
  })

  test('sem arquivo e sem link nao e documento', () => {
    expect(Documento.safeParse({ ...apolice, fonte: { arquivo: null, link: null } }).success).toBe(false)
  })

  // MANUAIS_RAPOSA (linhas 234 a 237) e PLANOS (242) guardam caminho relativo.
  test('caminho relativo dos literais de origem e link valido', () => {
    const manual = Documento.parse({
      id: 'doc-5',
      tipo: 'manual',
      fonte: { arquivo: null, link: 'docs/manual-atego.pdf' },
      atualizadoEm: '2026-08-31',
      veiculos: ['SM02J13'],
    })
    expect(manual.fonte.link).toBe('docs/manual-atego.pdf')
    const plano = Documento.parse({
      id: 'doc-6',
      tipo: 'plano_pgq',
      fonte: { arquivo: null, link: 'docs/pgq-manutencao-2026.pdf' },
      atualizadoEm: '2026-08-31',
      base: 'raposa',
    })
    expect(plano.fonte.link).toBe('docs/pgq-manutencao-2026.pdf')
  })

  test('link com esquema estranho, com espaco ou vazio nao passa', () => {
    const comEspaco = { arquivo: null, link: 'docs/manual atego.pdf' }
    expect(Documento.safeParse({ ...apolice, fonte: comEspaco }).success).toBe(false)
    const script = { arquivo: null, link: 'javascript:alert(document.cookie)' }
    expect(Documento.safeParse({ ...apolice, fonte: script }).success).toBe(false)
    // String vazia nao e nulo, entao o `refine` da Fonte a deixaria passar como se
    // fosse fonte. E o mesmo par que o `documento_fonte_ck` recusa no banco.
    const vazio = { arquivo: null, link: '' }
    expect(Documento.safeParse({ ...apolice, fonte: vazio }).success).toBe(false)
  })
})

describe('Documento', () => {
  test('os quatro tipos que vencem', () => {
    const cnh = {
      id: 'doc-2',
      tipo: 'cnh',
      fonte: fonteArquivo,
      atualizadoEm: '2026-08-31',
      colaborador: 'c-3',
      vencimento: '2027-05-10',
      numero: '01234567890',
      categoria: 'E',
    }
    expect(venceEm(Documento.parse(apolice))).toBe(dataISO('2026-12-01'))
    expect(venceEm(Documento.parse({ ...doVeiculo, id: 'doc-3', tipo: 'crlv' }))).toBe(dataISO('2026-12-01'))
    expect(venceEm(Documento.parse({ ...doVeiculo, id: 'doc-4', tipo: 'tacografo' }))).toBe(dataISO('2026-12-01'))
    expect(venceEm(Documento.parse(cnh))).toBe(dataISO('2027-05-10'))
  })

  // `grep -c tacografo_venc documentos-frota.html` devolve 0: os 7 tacografos que o
  // sistema ja entrega nao tem data nenhuma e nao poderiam ser semeados.
  test('tacografo sem vencimento passa, e o status e sem_dado', () => {
    const tacografo = Documento.parse({
      ...doVeiculo,
      id: 'doc-10',
      tipo: 'tacografo',
      vencimento: null,
    })
    expect(venceEm(tacografo)).toBeNull()
    expect(statusVencimento(dataISO('2026-08-31'), venceEm(tacografo), 30)).toBe('sem_dado')
  })

  test('CNH sem numero e sem categoria passa, e vazio vira nulo', () => {
    const base = {
      id: 'doc-8',
      tipo: 'cnh',
      fonte: fonteArquivo,
      atualizadoEm: '2026-08-31',
      colaborador: 'c-3',
      vencimento: null,
      numero: null,
      categoria: null,
    }
    const semNada = Documento.parse(base)
    if (semNada.tipo !== 'cnh') throw new Error('tipo inesperado')
    expect(semNada.numero).toBeNull()
    expect(semNada.categoria).toBeNull()

    const vazio = Documento.parse({ ...base, numero: '', categoria: '' })
    if (vazio.tipo !== 'cnh') throw new Error('tipo inesperado')
    expect(vazio.numero).toBeNull()
    expect(vazio.categoria).toBeNull()
  })

  test('manual pertence a varios veiculos e nao vence', () => {
    const manual = Documento.parse({
      id: 'doc-5',
      tipo: 'manual',
      fonte: fonteLink,
      atualizadoEm: '2026-08-31',
      veiculos: ['SM02J13', 'SMP6F86', 'SMW0B96', 'PTV0006'],
    })
    expect(venceEm(manual)).toBe(null)
    if (manual.tipo !== 'manual') throw new Error('tipo inesperado')
    expect(manual.veiculos).toHaveLength(4)
  })

  test('plano PGQ pertence a uma base e nao vence', () => {
    const plano = Documento.parse({
      id: 'doc-6',
      tipo: 'plano_pgq',
      fonte: fonteArquivo,
      atualizadoEm: '2026-08-31',
      base: 'raposa',
    })
    expect(venceEm(plano)).toBe(null)
  })

  // O exemplo que o ADR cita como razao de existir da uniao. Com `z.object`, o zod
  // fazia `strip`: `vencimento` e `cnhNumero` sumiam e o parse devolvia sucesso, de
  // modo que a uniao nao guardava nada. Agora falha, e a mensagem nomeia as chaves.
  test('vencimento e numero de CNH num plano_pgq fazem o parse falhar, nomeando as chaves', () => {
    const r = Documento.safeParse({
      id: 'doc-7',
      tipo: 'plano_pgq',
      fonte: fonteArquivo,
      atualizadoEm: '2026-08-31',
      base: 'raposa',
      vencimento: '2026-12-01',
      cnhNumero: '123',
    })
    expect(r.success).toBe(false)
    const chaves = r.error?.issues.flatMap((i) => (i.code === 'unrecognized_keys' ? i.keys : []))
    expect(chaves?.sort()).toEqual(['cnhNumero', 'vencimento'])
  })

  // Um campo alheio por tipo, cada um nomeado na mensagem. Sem isso, a uniao e
  // decorativa: o membro certo e escolhido e o resto do objeto e jogado fora.
  test('todo campo fora do tipo e recusado pelo nome', () => {
    const alheios: [Record<string, unknown>, string][] = [
      [{ ...apolice, colaborador: 'c-3' }, 'colaborador'],
      [{ ...doVeiculo, tipo: 'crlv', seguradora: 'Porto Seguro' }, 'seguradora'],
      [{ ...doVeiculo, tipo: 'tacografo', base: 'raposa' }, 'base'],
      [
        {
          id: 'doc-11',
          tipo: 'cnh',
          fonte: fonteArquivo,
          atualizadoEm: '2026-08-31',
          colaborador: 'c-3',
          vencimento: null,
          numero: null,
          categoria: null,
          veiculo: 'PTV0006',
        },
        'veiculo',
      ],
      [
        {
          id: 'doc-12',
          tipo: 'manual',
          fonte: fonteLink,
          atualizadoEm: '2026-08-31',
          veiculos: ['SM02J13'],
          vencimento: '2026-12-01',
        },
        'vencimento',
      ],
      [
        {
          id: 'doc-13',
          tipo: 'plano_pgq',
          fonte: fonteArquivo,
          atualizadoEm: '2026-08-31',
          base: 'raposa',
          veiculo: 'PTV0006',
        },
        'veiculo',
      ],
    ]
    for (const [entrada, campo] of alheios) {
      const r = Documento.safeParse(entrada)
      expect(r.success).toBe(false)
      const chaves = r.error?.issues.flatMap((i) => (i.code === 'unrecognized_keys' ? i.keys : []))
      expect(chaves).toEqual([campo])
    }
  })

  // `seguradora` e coluna real, com CHECK proprio. Antes ela nao era declarada em
  // lugar nenhum e o `strip` a descartava: escrever pelo dominio perdia o valor.
  test('a seguradora da apolice sobrevive ao parse', () => {
    const d = Documento.parse(apolice)
    if (d.tipo !== 'apolice') throw new Error('tipo inesperado')
    expect(d.seguradora).toBe('Porto Seguro')
    expect(Documento.parse({ ...apolice, seguradora: '' })).toMatchObject({ seguradora: null })
  })

  test('manual sem veiculo nao passa', () => {
    const r = Documento.safeParse({
      id: 'doc-9',
      tipo: 'manual',
      fonte: fonteLink,
      atualizadoEm: '2026-08-31',
      veiculos: [],
    })
    expect(r.success).toBe(false)
  })

  test('apolice sem veiculo nao passa', () => {
    const { veiculo: _veiculo, ...semVeiculo } = apolice
    expect(Documento.safeParse(semVeiculo).success).toBe(false)
  })
})
