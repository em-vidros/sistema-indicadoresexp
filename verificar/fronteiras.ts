/**
 * A arquitetura hexagonal so existe se alguem checar a direcao dos imports.
 * Este script e essa checagem. Ele roda no `bun run verificar` e no pre-push.
 *
 * A cerca e uma tabela, nao uma cadeia de if: cada camada declara o que pode
 * importar, e o resto e proibido por omissao.
 */
import { Glob } from 'bun'
import { dirname, relative, resolve } from 'node:path'

type Camada = {
  nome: string
  arquivos: string
  permite: RegExp[]
  motivo: string
}

const RELATIVO = /^[./]/

/**
 * A raiz de cada camada, tirada do proprio glob. Import relativo que cai dentro
 * dela e movimento interno e nao diz nada sobre direcao entre camadas.
 */
function raizDe(glob: string): string {
  return resolve(glob.split('*')[0]!)
}

function ficaDentro(arquivo: string, alvo: string, raiz: string): boolean {
  const destino = resolve(dirname(resolve(arquivo)), alvo)
  const passo = relative(raiz, destino)
  return passo !== '' && !passo.startsWith('..')
}

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
  {
    nome: 'server',
    arquivos: 'apps/server/src/**/*.ts',
    permite: [/^hono(\/|$)/, /^@ind\/(core|db|auth)/, /^zod$/, /^node:/, /^@vercel\/blob$/],
    // `@vercel/blob` esta nomeado, nao coberto por um curinga de `@vercel/*`. E o
    // adaptador de arquivo remoto que a publicacao na Vercel exige, e adaptador e
    // exatamente o que a raiz de composicao pode conhecer. A porta que ele
    // implementa vive em `core/portas`, que continua sem saber que ele existe.
    motivo: 'raiz de composicao. web, pacotes da casa, stdlib e adaptador de saida.',
  },
]

const PROIBIDO_GLOBAL = [
  // Quantos `../` forem precisos, e nao tres. A distancia ate a raiz muda com a
  // profundidade da pasta: de `packages/core/src/dominio/` sao quatro, e a regra
  // fixa em tres deixava justo a camada mais protegida de fora.
  { padrao: /^(?:\.\.\/)+apps\//, motivo: 'pacote importando app inverte a dependencia' },
  { padrao: /^@ind\/server$/, motivo: 'o servidor e a raiz de composicao, ninguem o importa' },
]

/**
 * Tres formas de import, e a terceira e a que faltava. `import 'x'` nao tem `from`
 * nem parenteses, entao passava inteiro pela cerca. E a forma mais perigosa de
 * deixar passar: ela nao traz nome nenhum, existe so pelo efeito colateral, e e
 * exatamente assim que uma camada pura acaba puxando o runtime de outra.
 */
const IMPORT = new RegExp(
  [
    // import ... from 'x'  e  export ... from 'x'
    String.raw`(?:^|[\s;{}])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]`,
    // import('x')  e  require('x')
    String.raw`(?:^|[^\w.])(?:import|require)\s*\(\s*['"]([^'"]+)['"]`,
    // import 'x', so pelo efeito colateral
    String.raw`(?:^|[\s;{}])import\s*['"]([^'"]+)['"]`,
  ].join('|'),
  'gm',
)

type Violacao = { arquivo: string; linha: number; alvo: string; camada: string; motivo: string }

const violacoes: Violacao[] = []
let checados = 0

for (const camada of CAMADAS) {
  for await (const arquivo of new Glob(camada.arquivos).scan('.')) {
    checados++
    const texto = await Bun.file(arquivo).text()
    for (const m of texto.matchAll(IMPORT)) {
      const alvo = m[1] ?? m[2] ?? m[3]
      if (!alvo) continue
      // O casamento comeca no espaco antes da palavra-chave, e esse espaco costuma
      // ser a quebra de linha anterior: contar a partir de `m.index` apontava a
      // linha de cima. Conta-se a partir da palavra-chave.
      const inicio = m.index + m[0].search(/import|export|require/)
      const linha = texto.slice(0, inicio).split('\n').length

      const global = PROIBIDO_GLOBAL.find((p) => p.padrao.test(alvo))
      if (global) {
        violacoes.push({ arquivo, linha, alvo, camada: camada.nome, motivo: global.motivo })
        continue
      }
      // Import relativo que resolve para dentro da propria camada e movimento
      // interno, nao direcao entre camadas. A regra antiga era "nao comeca com
      // ../", e ela proibia `consultas/x.ts` de alcancar `../schema/`, que e o
      // mesmo pacote. Regra de cerca que torce o codigo dentro da camada nao esta
      // guardando fronteira nenhuma.
      if (RELATIVO.test(alvo) && ficaDentro(arquivo, alvo, raizDe(camada.arquivos))) continue
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
