import type { ArquivoId } from '../dominio/ids.ts'
export type NovoArquivo = {
  id: ArquivoId
  nomeOriginal: string
  mime: string
  conteudo: Uint8Array
}

export type ArquivoGuardado = { caminho: string }

/**
 * A unica porta com segundo adaptador ja anunciado: a fase 4 deixa em aberto se o
 * app publica no servidor, com volume em disco, ou no padrao Cloudflare da casa,
 * com objeto remoto. As duas APIs nao se parecem, e tres telas sobem PDF.
 */
export interface ArmazenamentoArquivo {
  guardar(novo: NovoArquivo): Promise<ArquivoGuardado>
  ler(caminho: string): Promise<Uint8Array | null>
  apagar(caminho: string): Promise<void>
}
