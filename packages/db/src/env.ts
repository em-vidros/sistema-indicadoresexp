import { readFileSync } from 'node:fs'

// O `bun --filter` roda com cwd no pacote, e o .env do projeto fica na raiz.
function doArquivoRaiz(chave: string): string | undefined {
  let texto: string
  try {
    texto = readFileSync(new URL('../../../.env', import.meta.url), 'utf8')
  } catch {
    return undefined
  }
  for (const linha of texto.split('\n')) {
    const casa = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (casa?.[1] === chave) return casa[2]?.replace(/^["']|["']$/g, '')
  }
  return undefined
}

function exigir(chave: string): string {
  const valor = process.env[chave] ?? doArquivoRaiz(chave)
  if (!valor) throw new Error(`${chave} ausente: defina no ambiente ou no .env da raiz do projeto.`)
  return valor
}

export const URL_BANCO = exigir('DATABASE_URL')
