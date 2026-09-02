/**
 * A tela de login pinta antes de existir sessao, entao tudo que ela carrega passa pelo
 * portao sem cookie nenhum. Esta prova amarra as duas pontas dessa excecao.
 *
 * Do lado de fora: cada arquivo que `dist/entrar.html` pede tem que estar liberado. Um
 * que falte nao quebra o build nem o teste; o portao devolve 302 para a propria tela de
 * login, o navegador recebe HTML onde esperava JavaScript, e o login para de funcionar
 * so em producao, para quem ainda nao entrou. Ninguem que ja tem sessao ve o defeito.
 *
 * Do lado de dentro: cada nome liberado tem que ser pedido. Nome que sobra e um arquivo
 * do `dist/` servido a qualquer um sem que ninguem lembre por que, e e assim que a
 * excecao de uma tela vira um `/assets/` inteiro aberto.
 *
 * A prova le o `dist/`, entao ela cobra o que a build produziu, e nao o que a config
 * pretendia produzir.
 */
import { PUBLICOS_DE_ASSET } from '../apps/server/src/portao.ts'

const RAIZ = new URL('../', import.meta.url).pathname
const CASCA = `${RAIZ}apps/web/dist/entrar.html`

/** `src` e `href` de script, link e img. O `dist/` nao tem outra forma de pedir. */
const REFERENCIA = /(?:src|href)="([^"]+)"/g

const html = await Bun.file(CASCA).text()

const pedidos = new Set<string>()
for (const [, alvo] of html.matchAll(REFERENCIA)) {
  if (alvo === undefined) continue
  if (!alvo.startsWith('/assets/')) continue
  pedidos.add(alvo)
}

if (pedidos.size === 0) {
  console.error('publicos: `dist/entrar.html` nao pede nenhum asset')
  console.error('  ou a casca perdeu o script, ou o build nao rodou')
  process.exit(1)
}

const liberados = new Set(PUBLICOS_DE_ASSET)
const faltando = [...pedidos].filter((p) => !liberados.has(p)).sort()
const sobrando = [...liberados].filter((p) => !pedidos.has(p)).sort()

if (faltando.length > 0 || sobrando.length > 0) {
  console.error('publicos: o portao e a tela de login discordam')
  for (const p of faltando) console.error(`  a login pede e o portao nao libera: ${p}`)
  for (const p of sobrando) console.error(`  o portao libera e a login nao pede: ${p}`)
  console.error('  a lista do portao esta em `apps/server/src/portao.ts`, em PUBLICOS')
  console.error('  se o nome ganhou hash, quem resolve e SEM_HASH em `apps/web/vite.config.ts`')
  process.exit(1)
}

console.log(`publicos: ${pedidos.size} assets da login, liberados e nenhum a mais`)
