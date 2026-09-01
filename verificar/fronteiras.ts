/**
 * A arquitetura hexagonal so existe se alguem checar a direcao dos imports.
 * Este script e essa checagem. Ele roda no `bun run verificar` e no pre-push.
 *
 * A cerca e uma tabela, nao uma cadeia de if: cada camada declara o que pode
 * importar, e o resto e proibido por omissao.
 */
import { Glob } from 'bun'

type Camada = {
  nome: string
  arquivos: string
  permite: RegExp[]
  motivo: string
}

const RELATIVO = /^[./]/

const CAMADAS: Camada[] = [
  {
    nome: 'core/dominio',
    arquivos: 'packages/core/src/dominio/**/*.ts',
    permite: [/^zod$/],
    motivo: 'regra de negocio pura. sem framework, sem I/O, sem runtime.',
  },
  {
    nome: 'core/portas',
    arquivos: 'packages/core/src/portas/**/*.ts',
    permite: [/^zod$/, /^\.\.\/dominio\//],
    motivo: 'so a forma do que o caso de uso precisa. nenhuma implementacao.',
  },
  {
    nome: 'core/casos',
    arquivos: 'packages/core/src/casos/**/*.ts',
    permite: [/^zod$/, /^\.\.\/dominio\//, /^\.\.\/portas\//],
    motivo: 'orquestra dominio por portas. nao conhece drizzle nem hono.',
  },
  {
    nome: 'db',
    arquivos: 'packages/db/src/**/*.ts',
    permite: [/^drizzle-orm/, /^drizzle-kit$/, /^postgres$/, /^pg$/, /^zod$/, /^@ind\/core/, /^node:/],
    motivo: 'adaptador de persistencia. implementa portas, nao chama caso de uso.',
  },
  {
    nome: 'auth',
    arquivos: 'packages/auth/src/**/*.ts',
    permite: [/^better-auth/, /^@ind\/(core|db)/, /^drizzle-orm/, /^zod$/, /^node:/],
    motivo: 'adaptador de sessao.',
  },
]

const PROIBIDO_GLOBAL = [
  { padrao: /^\.\.\/\.\.\/\.\.\/apps\//, motivo: 'pacote importando app inverte a dependencia' },
  { padrao: /^@ind\/server$/, motivo: 'o servidor e a raiz de composicao, ninguem o importa' },
]

const IMPORT = /(?:^|[\s;{}])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[^\w.])(?:import|require)\s*\(\s*['"]([^'"]+)['"]/gm

type Violacao = { arquivo: string; linha: number; alvo: string; camada: string; motivo: string }

const violacoes: Violacao[] = []
let checados = 0

for (const camada of CAMADAS) {
  for await (const arquivo of new Glob(camada.arquivos).scan('.')) {
    checados++
    const texto = await Bun.file(arquivo).text()
    for (const m of texto.matchAll(IMPORT)) {
      const alvo = m[1] ?? m[2]
      if (!alvo) continue
      const linha = texto.slice(0, m.index).split('\n').length

      const global = PROIBIDO_GLOBAL.find((p) => p.padrao.test(alvo))
      if (global) {
        violacoes.push({ arquivo, linha, alvo, camada: camada.nome, motivo: global.motivo })
        continue
      }
      // Import relativo que nao sobe de pasta fica dentro da propria camada: liberado.
      if (RELATIVO.test(alvo) && !alvo.startsWith('../')) continue
      if (camada.permite.some((p) => p.test(alvo))) continue

      violacoes.push({ arquivo, linha, alvo, camada: camada.nome, motivo: camada.motivo })
    }
  }
}

if (checados === 0) {
  console.error('fronteiras: nenhum arquivo casou com as camadas. a cerca esta desligada.')
  process.exit(1)
}

if (violacoes.length > 0) {
  for (const v of violacoes) {
    console.error(`${v.arquivo}:${v.linha}  ${v.camada} nao pode importar '${v.alvo}'`)
    console.error(`    ${v.motivo}`)
  }
  console.error(`\nfronteiras: ${violacoes.length} violacao(oes) em ${checados} arquivos`)
  process.exit(1)
}

console.log(`fronteiras: ${checados} arquivos, direcao de import correta`)
