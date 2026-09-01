import { ArquivoId, criarId, type ArmazenamentoArquivo } from '@ind/core'
import {
  DocumentoInvalido,
  type Db,
  arquivoDoDocumento,
  catalogoDocumentos,
  gravarDocumento,
  listarDocumentos,
} from '@ind/db'
import { Hono } from 'hono'
import { DataOuNula, mensagemDaEntrada } from './entrada.ts'
import { z } from 'zod'
import type { Ambiente } from './portao.ts'

/** O que o CHECK `documento_fonte_ck` chama de link absoluto. */
const LINK_ABSOLUTO = /^https?:\/\/\S+$/
/** E de caminho: sem espaco e sem esquema. Passa 'docs/manual.pdf', barra 'javascript:...'. */
const CAMINHO_RELATIVO = /^[^\s:]+$/
/**
 * As duas formas de cima nao bastam. A tela interpola o link cru dentro de um
 * `href="..."`, e o HTML deixa a aspa fechar o atributo mesmo colada no proximo
 * nome (`href="x"onmouseover=...` vira atributo novo, sem espaco no meio), entao
 * `https://a.b/x"onmouseover=alert(1)` passava pelas duas regex e virava script na
 * origem do app. Aspa, sinal de maior/menor e crase nao aparecem em link de
 * documento, e e aqui, no boundary, que eles param.
 */
const PERIGOSO = /["'`<>\\]/

const Link = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (valor) =>
      valor === '' || (!PERIGOSO.test(valor) && (LINK_ABSOLUTO.test(valor) || CAMINHO_RELATIVO.test(valor))),
    'link deve ser URL http(s) ou nome de arquivo, sem espaço e sem aspas',
  )
  // A tela manda '' quando o campo ficou em branco, e vazio e ausencia.
  .transform((valor) => (valor === '' ? null : valor))
  .nullable()
  .optional()
  .default(null)

const Dados = z
  .object({
    tipo: z.enum(['apolice', 'crlv', 'tacografo', 'cnh', 'manual', 'plano_pgq']),
    titulo: z.string().trim().max(240).nullable().optional().default(null),
    descricao: z.string().trim().max(500).nullable().optional().default(null),
    // `DataOuNula` e nao regex de forma: `2026-02-31` casa com o formato, nao existe
    // no calendario, e o Postgres devolvia 22008 que virava 500 no cliente.
    vencimento: DataOuNula.optional().default(null),
    linkExterno: Link,
    veiculoId: z.string().uuid().nullable().optional().default(null),
    colaboradorId: z.string().uuid().nullable().optional().default(null),
    baseId: z.string().uuid().nullable().optional().default(null),
    seguradora: z.string().trim().max(160).nullable().optional().default(null),
    contatoEmergencia: z.string().trim().max(240).nullable().optional().default(null),
    cnhNumero: z.string().trim().max(80).nullable().optional().default(null),
    cnhCategoria: z.string().trim().max(10).nullable().optional().default(null),
  })
  /**
   * O mesmo que os CHECK de `schema/documento.ts` dizem, dito onde da para
   * responder 400. Sem isto `{ tipo: 'cnh', veiculoId: <uuid> }` era entrada valida
   * para o zod, o Postgres recusava no `documento_veiculo_ck` e o erro subia cru
   * como 500.
   */
  .superRefine((entrada, contexto) => {
    const exigir = (campo: 'veiculoId' | 'colaboradorId' | 'baseId', tipos: readonly string[]) => {
      const precisa = tipos.includes(entrada.tipo)
      if (precisa && !entrada[campo]) {
        contexto.addIssue({ code: 'custom', message: `${entrada.tipo} exige ${campo}`, path: [campo] })
      }
      if (!precisa && entrada[campo]) {
        contexto.addIssue({ code: 'custom', message: `${entrada.tipo} não tem ${campo}`, path: [campo] })
      }
    }
    const proibir = (campo: keyof typeof entrada, tipos: readonly string[]) => {
      if (entrada[campo] && !tipos.includes(entrada.tipo)) {
        contexto.addIssue({ code: 'custom', message: `${entrada.tipo} não tem ${campo}`, path: [campo] })
      }
    }
    exigir('veiculoId', ['apolice', 'crlv', 'tacografo'])
    exigir('colaboradorId', ['cnh'])
    exigir('baseId', ['plano_pgq'])
    proibir('vencimento', ['apolice', 'crlv', 'tacografo', 'cnh'])
    proibir('cnhNumero', ['cnh'])
    proibir('cnhCategoria', ['cnh'])
    proibir('seguradora', ['apolice'])
    proibir('contatoEmergencia', ['apolice'])
  })

/** 6 MB de PDF. */
const LIMITE = 6 * 1024 * 1024
/** Fronteiras, cabecalhos de parte e o campo `dados` do multipart. */
const ENVELOPE = 64 * 1024
/** '%PDF-', que e como todo PDF comeca. */
const ASSINATURA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]

function copiarBuffer(conteudo: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(new ArrayBuffer(conteudo.byteLength))
  copia.set(conteudo)
  return copia.buffer
}

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')

/** O `type` do multipart e o que o cliente declarou. Os primeiros bytes, nao. */
async function ehPdf(arquivo: File): Promise<boolean> {
  const inicio = new Uint8Array(await arquivo.slice(0, ASSINATURA_PDF.length).arrayBuffer())
  return ASSINATURA_PDF.every((byte, indice) => inicio[indice] === byte)
}

export function rotasDocumentos(db: Db, arquivos: ArmazenamentoArquivo): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()
  rotas.get('/documentos/catalogo', async (c) =>
    c.json(await catalogoDocumentos(db, c.get('usuarioId'))),
  )
  rotas.get('/documentos', async (c) => {
    try {
      return c.json(await listarDocumentos(db, c.get('usuarioId')))
    } catch (falha) {
      if (falha instanceof DocumentoInvalido) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })
  rotas.post('/documentos/dados', async (c) => {
    const entrada = Dados.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada inválida') }, 400)
    }
    try {
      return c.json(await gravarDocumento(db, c.get('usuarioId'), entrada.data, null), 201)
    } catch (falha) {
      if (falha instanceof DocumentoInvalido) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })
  rotas.post('/documentos', async (c) => {
    // Antes do `formData()`, que buferiza o corpo inteiro na memoria: um POST de
    // 500 MB era lido por completo so para ser recusado depois com 400.
    const anunciado = Number(c.req.header('content-length') ?? Number.NaN)
    if (Number.isFinite(anunciado) && anunciado > LIMITE + ENVELOPE) {
      return c.json({ erro: 'arquivo maior que 6 MB' }, 413)
    }
    const formulario = await c.req.formData().catch(() => null)
    const bruto = formulario?.get('dados')
    const arquivo = formulario?.get('arquivo')
    let decodificado: unknown = null
    if (typeof bruto === 'string') {
      try {
        decodificado = JSON.parse(bruto) as unknown
      } catch {
        return c.json({ erro: 'entrada inválida' }, 400)
      }
    }
    const entrada = Dados.safeParse(decodificado)
    if (!entrada.success || !(arquivo instanceof File)) return c.json({ erro: 'entrada inválida' }, 400)
    // Quem nao anunciou o tamanho ainda para aqui, so que depois de ler.
    if (arquivo.size > LIMITE) return c.json({ erro: 'arquivo maior que 6 MB' }, 413)
    if (!(await ehPdf(arquivo))) return c.json({ erro: 'arquivo não é PDF' }, 400)

    const id = criarId(ArquivoId, crypto.randomUUID())
    const conteudo = new Uint8Array(await arquivo.arrayBuffer())
    const guardado = await arquivos.guardar({ id, nomeOriginal: arquivo.name, mime: 'application/pdf', conteudo })
    try {
      const salvo = await gravarDocumento(db, c.get('usuarioId'), entrada.data, {
        id,
        nomeOriginal: arquivo.name,
        mime: 'application/pdf',
        tamanho: arquivo.size,
        caminho: guardado.caminho,
        sha256: hex(await crypto.subtle.digest('SHA-256', conteudo)),
      })
      // A transacao ja fechou e a linha do documento ja aponta para o PDF novo.
      // Apagar o antigo e faxina, e o `catch` abaixo apaga o arquivo NOVO: se a
      // faxina subisse, o rollback varria justamente o arquivo que o banco passou a
      // apontar, e o estrago era silencioso e permanente - a lista anunciando
      // `temArquivo: true` e o download devolvendo 404. Orfao no armazenamento e
      // muito mais barato que isso. `apagar` ja engole ENOENT; o que chega aqui e
      // permissao, disco cheio ou adaptador fora do ar.
      if (salvo.caminhoAntigo) {
        const caminho = salvo.caminhoAntigo
        await arquivos.apagar(caminho).catch((erro: unknown) => {
          console.error('faxina do PDF anterior falhou', { caminho, erro })
        })
      }
      return c.json(salvo, 201)
    } catch (falha) {
      // Aqui a gravacao falhou e o arquivo novo nao e de ninguem, entao apagar e
      // certo. O `.catch` so impede que a falha da limpeza vire 500 por cima do
      // 400 que o cliente precisa ler.
      await arquivos.apagar(guardado.caminho).catch(() => {})
      if (falha instanceof DocumentoInvalido) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })
  rotas.put('/documentos/:id', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    const entrada = Dados.safeParse(await c.req.json().catch(() => null))
    if (!id.success) return c.json({ erro: 'entrada inválida' }, 400)
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada inválida') }, 400)
    }
    try {
      return c.json(await gravarDocumento(db, c.get('usuarioId'), entrada.data, null, id.data))
    } catch (falha) {
      if (falha instanceof DocumentoInvalido) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })
  rotas.get('/documentos/:id/arquivo', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ erro: 'entrada inválida' }, 400)
    let metadado: Awaited<ReturnType<typeof arquivoDoDocumento>>
    try {
      metadado = await arquivoDoDocumento(db, c.get('usuarioId'), id.data)
    } catch (falha) {
      if (falha instanceof DocumentoInvalido) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
    if (!metadado) return c.json({ erro: 'arquivo inexistente' }, 404)
    const conteudo = await arquivos.ler(metadado.caminho)
    if (!conteudo) return c.json({ erro: 'arquivo inexistente' }, 404)
    // O tipo e literal, e nao o `mime` da linha do banco: aquele valor veio do
    // `type` que o cliente declarou no multipart, e ecoar o que o cliente mandou e
    // o que transforma upload em XSS. `nosniff` fecha o palpite do navegador.
    return new Response(new Blob([copiarBuffer(conteudo)], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'x-content-type-options': 'nosniff',
        'content-disposition': `inline; filename="${metadado.nomeOriginal.replace(/["\\\r\n]/g, '')}"`,
      },
    })
  })
  return rotas
}
