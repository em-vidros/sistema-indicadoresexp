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

/**
 * O leitor de .env do projeto mora aqui porque `db` e a camada mais baixa que a
 * cerca deixa `auth` e `apps/server` enxergarem. Nao ha um pacote `env`: seriam
 * tres linhas com cerimonia de publicacao, e o `arquitetura.md` recusa pacote com
 * um consumidor so.
 */
export function exigir(chave: string): string {
  const valor = process.env[chave] ?? doArquivoRaiz(chave)
  if (!valor) throw new Error(`${chave} ausente: defina no ambiente ou no .env da raiz do projeto.`)
  return valor
}

export const URL_BANCO = exigir('DATABASE_URL')

export function opcional(chave: string, padrao: string): string {
  return process.env[chave] ?? doArquivoRaiz(chave) ?? padrao
}

/**
 * A conexao que as migracoes usam. Na Neon sao duas strings: a pooled passa por
 * PgBouncer em modo transacao, que troca de conexao a cada statement e por isso nao
 * sustenta o DDL em transacao que o migrador emite. Fora da Neon existe uma so, e
 * `DATABASE_URL` responde pelas duas.
 *
 * E funcao, e nao `const`, porque isto lanca: uma constante de modulo derrubaria o
 * servidor no import, e quem tem que falhar aqui e o comando de migracao.
 */
export function urlMigracao(): string {
  const url = opcional('DATABASE_URL_DIRETA', '').trim() || URL_BANCO
  if (/-pooler\./.test(url)) {
    throw new Error(
      'migracao apontada para a conexao pooled: defina DATABASE_URL_DIRETA com a string direta da Neon.',
    )
  }
  return url
}
