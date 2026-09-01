import {
  AtaInvalida,
  type Db,
  apagarAta,
  anexarPdfAta,
  atualizarAta,
  catalogoAta,
  criarAta,
  listarAtas,
  pdfDaAta,
} from '@ind/db'
import { ArquivoId, criarId, type ArmazenamentoArquivo } from '@ind/core'
import { Hono } from 'hono'
import { z } from 'zod'
import { Data, Hora, mensagemDaEntrada } from './entrada.ts'
import type { Ambiente } from './portao.ts'

const Texto = z.string().trim().max(500).nullable().optional().default(null)
const Participante = z
  .object({
    colaboradorId: z.string().uuid().nullable(),
    nomeExterno: z.string().trim().min(1).max(160).nullable(),
    presente: z.boolean(),
  })
  .refine((p) => (p.colaboradorId === null) !== (p.nomeExterno === null), 'participante ambiguo')
const Corpo = z.object({
  numero: z.string().trim().min(1).max(60).nullable(),
  titulo: z.string().trim().min(1).max(240),
  data: Data,
  horario: Hora.nullable().optional().default(null),
  local: Texto,
  convocada: Texto,
  facilitadores: Texto,
  participantesGeral: Texto,
  gestor1Nome: Texto,
  gestor1Cargo: Texto,
  gestor2Nome: Texto,
  gestor2Cargo: Texto,
  importada: z.boolean().optional().default(false),
  topicos: z.array(
    z.object({
      discussao: Texto,
      conclusao: Texto,
      responsavel: Texto,
      prazo: z.string().trim().max(160).nullable().optional().default(null),
    }),
  ).max(100),
  participantes: z.array(Participante).max(100),
})

/**
 * O limite do PDF assinado. Ele e conferido duas vezes: no `Content-Length`,
 * antes de ler o corpo, e no tamanho real do arquivo depois. A primeira e a que
 * importa, porque `formData()` poe o corpo inteiro na memoria do processo.
 */
const LIMITE_PDF = 4 * 1024 * 1024

/** `%PDF-`. E o que faz de um arquivo um PDF; `arquivo.type` e so o que o cliente disse. */
const ASSINATURA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]

function ehPdf(conteudo: Uint8Array): boolean {
  return ASSINATURA_PDF.every((byte, indice) => conteudo[indice] === byte)
}

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')

function copiarBuffer(conteudo: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(new ArrayBuffer(conteudo.byteLength))
  copia.set(conteudo)
  return copia.buffer
}

/**
 * O `numero` da ata e unico dentro da base, e os dois indices que cobram isso
 * (`ata_numero_base_uk` para a ata de base, `ata_numero_empresa_uk` para a da
 * empresa) recusam a repeticao com 23505. Sem esta rede o erro subia cru como
 * `Internal Server Error`: a tela nao tinha o que dizer, e a diferenca entre 201
 * e 500 virava um oraculo -- dava para descobrir a numeracao de outra base pela
 * resposta, deixando uma ata de verdade no banco a cada tentativa.
 *
 * E o mesmo desenho do `checkViolado` de `rotas-registros.ts`: numero repetido e
 * dado que veio de fora e o banco recusou, entao quem corrige e o cliente. So
 * estes dois indices mudam de tratamento; qualquer outro 23505 continua subindo
 * como 500, porque nada mais o cliente resolve reescrevendo o corpo.
 */
const INDICES_DE_NUMERO = new Set(['ata_numero_base_uk', 'ata_numero_empresa_uk'])

function numeroRepetido(falha: unknown): boolean {
  // A falha chega embrulhada pelo drizzle; o `PostgresError` fica no `cause`.
  let atual: unknown = falha
  while (atual instanceof Error) {
    const erro = atual as Error & { code?: string; constraint_name?: string }
    if (erro.code === '23505' && INDICES_DE_NUMERO.has(erro.constraint_name ?? '')) return true
    atual = erro.cause
  }
  return false
}

const NUMERO_REPETIDO = 'já existe uma ata com esse número; escolha outro'

export function rotasAtas(db: Db, arquivos: ArmazenamentoArquivo): Hono<Ambiente> {
  const rotas = new Hono<Ambiente>()
  rotas.get('/atas/catalogo', async (c) => c.json(await catalogoAta(db, c.get('usuarioId'))))
  rotas.get('/atas', async (c) => c.json(await listarAtas(db, c.get('usuarioId'))))
  rotas.post('/atas', async (c) => {
    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada invalida') }, 400)
    }
    try {
      return c.json(await criarAta(db, c.get('usuarioId'), entrada.data), 201)
    } catch (falha) {
      if (falha instanceof AtaInvalida) return c.json({ erro: falha.message }, falha.status)
      if (numeroRepetido(falha)) return c.json({ erro: NUMERO_REPETIDO }, 409)
      throw falha
    }
  })
  rotas.put('/atas/:id', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    const entrada = Corpo.safeParse(await c.req.json().catch(() => null))
    if (!id.success) return c.json({ erro: 'entrada invalida' }, 400)
    if (!entrada.success) {
      return c.json({ erro: mensagemDaEntrada(entrada.error, 'entrada invalida') }, 400)
    }
    try {
      return c.json(await atualizarAta(db, c.get('usuarioId'), id.data, entrada.data))
    } catch (falha) {
      if (falha instanceof AtaInvalida) return c.json({ erro: falha.message }, falha.status)
      if (numeroRepetido(falha)) return c.json({ erro: NUMERO_REPETIDO }, 409)
      throw falha
    }
  })
  rotas.delete('/atas/:id', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ erro: 'entrada invalida' }, 400)
    try {
      const apagou = await apagarAta(db, c.get('usuarioId'), id.data)
      return apagou ? c.body(null, 204) : c.json({ erro: 'ata inexistente' }, 404)
    } catch (falha) {
      if (falha instanceof AtaInvalida) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })
  rotas.post('/atas/:id/pdf', async (c) => {
    const ataId = z.string().uuid().safeParse(c.req.param('id'))
    if (!ataId.success) return c.json({ erro: 'entrada invalida' }, 400)

    // Antes de `formData()`, que le o corpo inteiro para a memoria. Conferir o
    // tamanho depois disso e conferir quando o estrago ja foi feito: o envio de
    // 500 MB ja passou pelo processo. O envelope multipart e maior que o arquivo
    // por algumas centenas de bytes, e essa folga fica a favor do limite.
    const declarado = Number(c.req.header('content-length') ?? '')
    if (Number.isFinite(declarado) && declarado > LIMITE_PDF) {
      return c.json({ erro: 'PDF invalido ou maior que 4 MB' }, 400)
    }

    const formulario = await c.req.formData().catch(() => null)
    const arquivo = formulario?.get('arquivo')
    if (!(arquivo instanceof File)) return c.json({ erro: 'entrada invalida' }, 400)
    if (arquivo.size > LIMITE_PDF) {
      return c.json({ erro: 'PDF invalido ou maior que 4 MB' }, 400)
    }

    const id = criarId(ArquivoId, crypto.randomUUID())
    const conteudo = new Uint8Array(await arquivo.arrayBuffer())
    // `arquivo.type` e o que o cliente escreveu no multipart, e ele escreve o que
    // quiser. Os primeiros bytes sao do arquivo, entao a pergunta e feita a eles;
    // o mime gravado passa a ser o constante, e nao o declarado.
    if (!ehPdf(conteudo)) return c.json({ erro: 'PDF invalido ou maior que 4 MB' }, 400)
    const mime = 'application/pdf'
    const sha256 = hex(await crypto.subtle.digest('SHA-256', conteudo))
    const guardado = await arquivos.guardar({ id, nomeOriginal: arquivo.name, mime, conteudo })
    try {
      const antigo = await anexarPdfAta(db, c.get('usuarioId'), ataId.data, {
        id,
        nomeOriginal: arquivo.name,
        mime,
        tamanho: arquivo.size,
        caminho: guardado.caminho,
        sha256,
      })
      // A transacao ja fechou e o PDF novo ja e o da ata. Apagar o antigo e
      // faxina: se falhar, sobra um arquivo orfao no armazenamento, e isso e
      // muito mais barato que devolver 500 para um envio que deu certo e ver o
      // cliente reenviar o mesmo PDF.
      if (antigo) {
        await arquivos.apagar(antigo).catch((erro: unknown) => {
          console.error('faxina do PDF anterior falhou', { caminho: antigo, erro })
        })
      }
      return c.json({ id, sha256 }, 201)
    } catch (falha) {
      await arquivos.apagar(guardado.caminho).catch(() => {})
      if (falha instanceof AtaInvalida) return c.json({ erro: falha.message }, falha.status)
      throw falha
    }
  })
  rotas.get('/atas/:id/pdf', async (c) => {
    const id = z.string().uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ erro: 'entrada invalida' }, 400)
    const metadado = await pdfDaAta(db, c.get('usuarioId'), id.data)
    if (!metadado) return c.json({ erro: 'PDF inexistente' }, 404)
    const conteudo = await arquivos.ler(metadado.caminho)
    if (!conteudo) return c.json({ erro: 'PDF inexistente' }, 404)
    return new Response(new Blob([copiarBuffer(conteudo)], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${metadado.nomeOriginal.replace(/["\\\r\n]/g, '')}"`,
      },
    })
  })
  return rotas
}
