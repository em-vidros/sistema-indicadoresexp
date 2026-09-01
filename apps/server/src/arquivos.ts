/**
 * O pouco que servir arquivo do disco precisa: descobrir o Content-Type e provar
 * que o caminho pedido nao saiu da pasta que o chamador abriu.
 *
 * Existe separado porque as duas rotas que leem disco (`paginas.ts` e
 * `documentos.ts`) precisam da mesma prova de contencao, e uma copia dela em cada
 * uma seria uma copia para esquecer de corrigir.
 */
import { resolve, sep } from 'node:path'

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
}

export function tipoDe(extensao: string): string {
  return TIPOS[extensao] ?? 'application/octet-stream'
}

/**
 * O caminho absoluto de `relativo` dentro de `raiz`, ou null se ele escapou.
 *
 * O `./` na frente e o que neutraliza caminho absoluto: sem ele, `/etc/passwd`
 * venceria `resolve` e sairia da raiz sem precisar de um unico `..`. Depois disso
 * so passa quem, ja normalizado, ainda comeca por `raiz + sep`.
 */
export function dentroDe(raiz: string, relativo: string): string | null {
  const alvo = resolve(raiz, `./${relativo.replace(/^\/+/, '')}`)
  if (alvo !== raiz && !alvo.startsWith(raiz + sep)) return null
  return alvo
}

/**
 * O caminho pedido, decodificado uma vez so.
 *
 * Vem de `new URL(...).pathname` e nao do parametro da rota: o roteador ja
 * decodifica, e decodificar de novo em cima disso transforma `%252e%252e` em `..`
 * depois que a checagem de contencao ja passou. Uma decodificacao, uma checagem.
 */
export function caminhoPedido(url: string): string | null {
  try {
    const caminho = decodeURIComponent(new URL(url).pathname)
    // `%00` decodifica para um byte nulo que atravessa tudo o que ha depois daqui:
    // `app-funcional.md%00.pdf` ainda termina em `.pdf` para a lista de extensoes e
    // ainda cabe na pasta para a contencao, e quem reclama e o `Bun.file`, com 500 em
    // entrada que quem pede escolhe. 404 e a resposta, e ela sai daqui.
    if (caminho.includes('\0')) return null
    return caminho
  } catch {
    return null
  }
}

export function extensaoDe(caminho: string): string {
  const ponto = caminho.lastIndexOf('.')
  const barra = caminho.lastIndexOf('/')
  if (ponto <= barra + 1) return ''
  return caminho.slice(ponto).toLowerCase()
}
