import type { ArmazenamentoArquivo, NovoArquivo } from '@ind/core'
import { del, get, put } from '@vercel/blob'
import { mkdir, unlink } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

function copiarBuffer(conteudo: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(new ArrayBuffer(conteudo.byteLength))
  copia.set(conteudo)
  return copia.buffer
}

class ArquivosVercel implements ArmazenamentoArquivo {
  async guardar(novo: NovoArquivo) {
    const guardado = await put(`arquivos/${novo.id}`, new Blob([copiarBuffer(novo.conteudo)]), {
      access: 'private',
      addRandomSuffix: false,
      contentType: novo.mime,
    })
    return { caminho: guardado.pathname }
  }

  async ler(caminho: string) {
    const resultado = await get(caminho, { access: 'private' })
    if (!resultado || resultado.statusCode !== 200) return null
    return new Uint8Array(await new Response(resultado.stream).arrayBuffer())
  }

  async apagar(caminho: string) {
    await del(caminho)
  }
}

class ArquivosLocais implements ArmazenamentoArquivo {
  constructor(private readonly raiz: string) {}

  private alvo(caminho: string) {
    const alvo = resolve(this.raiz, `./${caminho.replace(/^\/+/, '')}`)
    if (alvo !== this.raiz && !alvo.startsWith(this.raiz + sep)) {
      throw new Error('caminho de arquivo fora da raiz')
    }
    return alvo
  }

  async guardar(novo: NovoArquivo) {
    const caminho = `${novo.id}.bin`
    await mkdir(this.raiz, { recursive: true })
    await Bun.write(this.alvo(caminho), novo.conteudo)
    return { caminho }
  }

  async ler(caminho: string) {
    const arquivo = Bun.file(this.alvo(caminho))
    if (!(await arquivo.exists())) return null
    return new Uint8Array(await arquivo.arrayBuffer())
  }

  async apagar(caminho: string) {
    await unlink(this.alvo(caminho)).catch((falha: NodeJS.ErrnoException) => {
      if (falha.code !== 'ENOENT') throw falha
    })
  }
}

export function armazenamentoDoAmbiente(): ArmazenamentoArquivo {
  if (process.env['VERCEL']) return new ArquivosVercel()
  const padrao = new URL('../../../var/arquivos/', import.meta.url).pathname
  return new ArquivosLocais(resolve(process.env['ARQUIVOS_DIR']?.trim() || padrao))
}
