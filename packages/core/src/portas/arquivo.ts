import type { ArquivoId } from '../dominio/ids.ts'
import type { Instante } from '../dominio/tempo.ts'

export type MetadadoArquivo = {
  id: ArquivoId
  nomeOriginal: string
  mime: string
  tamanho: number
  sha256: string
  caminho: string
  enviadoEm: Instante
}

export type NovoArquivo = {
  id: ArquivoId
  nomeOriginal: string
  mime: string
  conteudo: Uint8Array
}

export type ArquivoLido = {
  metadado: MetadadoArquivo
  conteudo: Uint8Array
}

/**
 * A unica porta com segundo adaptador ja anunciado: a fase 4 deixa em aberto se o
 * app publica no servidor, com volume em disco, ou no padrao Cloudflare da casa,
 * com objeto remoto. As duas APIs nao se parecem, e tres telas sobem PDF.
 */
export interface ArmazenamentoArquivo {
  guardar(novo: NovoArquivo): Promise<MetadadoArquivo>
  ler(id: ArquivoId): Promise<ArquivoLido | null>
  apagar(id: ArquivoId): Promise<void>
}
