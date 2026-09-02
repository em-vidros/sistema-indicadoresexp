/**
 * A tela desenha igual depois do porte. Esta e a prova disso, e ela e a unica das
 * provas de tela que nao sabe se a tela e HTML velho ou React.
 *
 * `visual-telas.ts` compara texto de arquivo com texto de arquivo, entao ela morre
 * no instante em que o markup deixa de ser string dentro de um `<script>`. Aqui o
 * que se compara e o que o navegador montou depois de uma pessoa usar a tela: o DOM
 * normalizado, o CSS, os efeitos que cada clique disparou. Um `.tsx` que produza a
 * mesma arvore passa; um que mude um `gap` nao passa.
 *
 * Sao tres modos. Sem flag, confere `apps/web/dist/` contra `verificar/baseline/`.
 * `--capturar` grava a baseline, e roda a tela duas vezes antes de gravar porque uma
 * baseline nao deterministica reprova a proxima pessoa por nada. `--mutar` prova a
 * prova: estraga a tela de proposito numa copia e exige vermelho.
 *
 * Tela sem roteiro nao reprova nada. As sete chegam uma a uma, e uma prova que fica
 * vermelha esperando trabalho futuro treina quem a le a ignorar o vermelho.
 */
import { cp, mkdir, readdir, rm, symlink } from 'node:fs/promises'
import {
  abrirNavegador,
  montarPalco,
  ORIGEM,
  RAIZ,
  TELAS,
  type Fixtures,
  type Roteiro,
  type Tela,
} from './paridade/palco.ts'
import { MUTACOES, type Mutacao } from './paridade/mutacoes.ts'
import { ROTEIROS } from './paridade/roteiros/todos.ts'
import { canvas, estilo, serializarDom } from './paridade/serializar.ts'
import type { Browser } from 'playwright'

const BASELINE = `${RAIZ}verificar/baseline`
const FOTOS = `${RAIZ}var/paridade-fotos`
const DIST = `${RAIZ}apps/web/dist`
const FONTE_JS = `${RAIZ}apps/web/src/js`

// ===================== handlers =====================

// Copiadas de verificar/handlers.ts, nao importadas: aquele arquivo sai no commit 9
// e a baseline precisa continuar sendo extraida do mesmo jeito depois disso.
const ATRIBUTO =
  /\bon(?:click|change|input|submit|keydown|keyup|keypress|focus|blur|dblclick)\s*=\s*(["'])([\s\S]*?)\1/gi

const CHAMADA = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*(?=\()/g

const DO_NAVEGADOR = new Set([
  'window', 'document', 'location', 'event', 'this', 'alert', 'confirm', 'print',
  'history', 'console', 'Number', 'String', 'Boolean', 'JSON', 'Math', 'Date',
  'parseInt', 'parseFloat', 'setTimeout', 'true', 'false', 'null', 'undefined',
  'return', 'if', 'else', 'typeof', 'new', 'delete', 'void', 'in', 'of',
])

function chamados(texto: string): Set<string> {
  const nomes = new Set<string>()
  for (const attr of texto.matchAll(ATRIBUTO)) {
    for (const chamada of attr[2]!.matchAll(CHAMADA)) {
      const nome = chamada[1]!
      if (!DO_NAVEGADOR.has(nome)) nomes.add(nome)
    }
  }
  return nomes
}

async function handlersDaTela(tela: Tela, dist: string, fonteJs: string): Promise<string[]> {
  const nomes = chamados(await Bun.file(`${dist}/${tela}.html`).text())
  const modulo = Bun.file(`${fonteJs}/${tela}.ts`)
  if (await modulo.exists()) {
    for (const nome of chamados(await modulo.text())) nomes.add(nome)
  }
  return [...nomes].sort()
}

/**
 * A uniao dos `cobre` tem que ser exatamente o conjunto do handlers.txt. Sobra quer
 * dizer que a tela faz algo que nenhum passo olha, e falta quer dizer que o roteiro
 * fala de um handler que nao existe mais. Os dois reprovam a prova, nao a tela.
 */
function furosDaProva(roteiro: Roteiro, handlers: readonly string[]): string[] {
  const cobertos = new Set(roteiro.passos.flatMap((p) => [...p.cobre]))
  const existem = new Set(handlers)
  return [
    ...handlers.filter((n) => !cobertos.has(n)).map((n) => `  handler sem passo: ${n}`),
    ...[...cobertos].filter((n) => !existem.has(n)).sort()
      .map((n) => `  passo cobre handler que nao existe: ${n}`),
  ]
}

// ===================== rodar uma tela =====================

type Artefatos = {
  readonly texto: Map<string, string>
  readonly imagens: Map<string, Uint8Array>
}

async function rodarTela(
  navegador: Browser,
  roteiro: Roteiro,
  dist: string,
  fonteJs: string,
  comImagem: boolean,
): Promise<Artefatos> {
  const palco = await montarPalco(navegador, roteiro, dist)
  const texto = new Map<string, string>()
  const imagens = new Map<string, Uint8Array>()
  try {
    await palco.page.goto(ORIGEM + roteiro.url)
    await palco.assentar(`${roteiro.tela} antes do primeiro passo`)

    let fixtures: Fixtures = roteiro.fixtures
    for (const passo of roteiro.passos) {
      if (passo.fixtures !== undefined) {
        fixtures = { ...fixtures, ...passo.fixtures }
        palco.usarFixtures(fixtures)
      }
      const onde = `${roteiro.tela}/${passo.nome}`
      palco.limparEfeitos()

      // Passo que nao consegue agir e divergencia, nao erro do programa. O clique num
      // botao cujo handler sumiu nao acha o que abrir e estoura o teto do Playwright,
      // e esse e exatamente o defeito que a prova existe para pegar: deixar a excecao
      // subir mataria a execucao no lugar de reprovar a tela. Os passos seguintes
      // dependem deste estado, entao o roteiro para aqui, e a baseline dos que faltam
      // vira "o roteiro nao produz mais", que ja e reportado.
      try {
        await passo.agir(palco.page)
      } catch (falha) {
        const motivo = falha instanceof Error ? falha.message.split('\n')[0] : String(falha)
        texto.set(`${passo.nome}.html`, `<o passo nao conseguiu agir: ${motivo}>\n`)
        break
      }
      await palco.assentar(onde)
      await palco.page.clock.runFor(passo.esperaMs ?? 3500)
      await palco.assentar(onde)

      texto.set(`${passo.nome}.html`, await serializarDom(palco.page))
      texto.set(`${passo.nome}.efeitos.txt`, palco.efeitos().map((e) => `${e}\n`).join(''))
      texto.set(`${passo.nome}.canvas.json`, `${JSON.stringify(await canvas(palco.page), null, 2)}\n`)
      // `caret: 'initial'` porque o default esconde o cursor mexendo no `style` do
      // elemento com foco e devolve um `style=""` que nao estava la. O PNG nunca e
      // comparado, mas o proximo passo serializa o residuo e a captura deixa de bater
      // consigo mesma.
      //
      // A foto vai para `var/`, fora do git, e nao para a baseline. Ela nunca e
      // comparada, e em PNG as sete telas dariam uns 10 MB de binario que muda a cada
      // recaptura, num repositorio que ja carrega 11 MB de PDF no historico para
      // sempre. Quem investiga uma divergencia tem a linha exata do DOM e o `dist` na
      // maquina, que dizem mais que a imagem.
      if (comImagem) {
        imagens.set(
          `${passo.nome}.jpg`,
          await palco.page.screenshot({ fullPage: true, caret: 'initial', type: 'jpeg', quality: 72 }),
        )
      }

      // O CSS e da tela, e o ultimo passo pode ter saido dela. O estado inicial e o
      // unico ponto em que a pagina e com certeza a que o roteiro abriu.
      if (texto.get('estilo.css') === undefined) texto.set('estilo.css', await estilo(palco.page))
    }

    const faltando = palco.faltando()
    if (faltando.length > 0) {
      throw new Error(`fixture faltando em ${roteiro.tela}: ${faltando.join(', ')}`)
    }
  } finally {
    await palco.fechar()
  }

  texto.set('handlers.txt', (await handlersDaTela(roteiro.tela, dist, fonteJs)).map((n) => `${n}\n`).join(''))
  return { texto, imagens }
}

// ===================== comparar =====================

function primeiraDiferenca(esperado: string, obtido: string): string {
  const a = esperado.split('\n')
  const b = obtido.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    return [
      `    primeira diferenca na linha ${i + 1}`,
      `    baseline: ${a[i] ?? '<nao existe mais>'}`,
      `    agora:    ${b[i] ?? '<nao existe mais>'}`,
    ].join('\n')
  }
  return '    as linhas sao iguais uma a uma mas o texto difere no fim'
}

async function divergencias(tela: Tela, artefatos: Artefatos): Promise<string[]> {
  const pasta = `${BASELINE}/${tela}`
  const achados: string[] = []
  for (const [nome, agora] of [...artefatos.texto].sort()) {
    const arquivo = Bun.file(`${pasta}/${nome}`)
    if (!(await arquivo.exists())) {
      achados.push(`  ${nome}: nao existe na baseline`)
      continue
    }
    const baseline = await arquivo.text()
    if (baseline === agora) continue
    achados.push(`  ${nome}: DIFERENTE\n${primeiraDiferenca(baseline, agora)}`)
  }
  for (const nome of (await readdir(pasta)).sort()) {
    if (nome.endsWith('.jpg')) continue
    if (artefatos.texto.has(nome)) continue
    achados.push(`  ${nome}: existe na baseline e o roteiro nao produz mais`)
  }
  return achados
}

// ===================== os tres modos =====================

function roteiroDe(tela: Tela): Roteiro | null {
  return ROTEIROS.find((r) => r.tela === tela) ?? null
}

function telasPedidas(filtro: string | null): Tela[] {
  return TELAS.filter((t) => filtro === null || t === filtro)
}

async function conferirTelas(navegador: Browser, filtro: string | null): Promise<number> {
  let falhas = 0
  for (const tela of telasPedidas(filtro)) {
    const roteiro = roteiroDe(tela)
    if (roteiro === null) {
      console.log(`${tela}: sem roteiro ainda`)
      continue
    }
    // Roteiro sem baseline nao e "ainda nao chegou", e prova pela metade: alguem
    // escreveu os passos e nao congelou a tela. Reprova dizendo o comando que falta.
    if (!(await Bun.file(`${BASELINE}/${tela}/handlers.txt`).exists())) {
      falhas++
      console.log(`${tela}: tem roteiro e nao tem baseline`)
      console.error(`  rode: bun verificar/paridade.ts --capturar --tela ${tela}`)
      continue
    }

    const artefatos = await rodarTela(navegador, roteiro, DIST, FONTE_JS, false)

    const furos = furosDaProva(roteiro, (artefatos.texto.get('handlers.txt') ?? '').trim().split('\n').filter(Boolean))
    if (furos.length > 0) {
      falhas++
      console.log(`${tela}: a prova nao fecha com o handlers.txt`)
      console.error(furos.join('\n'))
      continue
    }

    const achados = await divergencias(tela, artefatos)
    if (achados.length === 0) {
      console.log(`${tela}: ${roteiro.passos.length} passos iguais a baseline`)
      continue
    }
    falhas++
    console.log(`${tela}: ${achados.length} divergencia(s)`)
    console.error(achados.join('\n'))
  }
  return falhas
}

async function capturarTelas(
  navegador: Browser,
  filtro: string | null,
  forcar: boolean,
): Promise<number> {
  let falhas = 0
  for (const tela of telasPedidas(filtro)) {
    const roteiro = roteiroDe(tela)
    if (roteiro === null) {
      console.log(`${tela}: sem roteiro ainda`)
      continue
    }
    const pasta = `${BASELINE}/${tela}`
    if (!forcar && (await Bun.file(`${pasta}/handlers.txt`).exists())) {
      falhas++
      console.log(`${tela}: a baseline ja existe. regravar e decisao declarada, use --forcar`)
      continue
    }

    const primeira = await rodarTela(navegador, roteiro, DIST, FONTE_JS, true)
    const segunda = await rodarTela(navegador, roteiro, DIST, FONTE_JS, false)

    const instaveis: string[] = []
    for (const [nome, valor] of [...primeira.texto].sort()) {
      const outro = segunda.texto.get(nome)
      if (outro === valor) continue
      instaveis.push(`  ${nome}: as duas passadas diferem\n${primeiraDiferenca(valor, outro ?? '')}`)
    }
    if (instaveis.length > 0) {
      falhas++
      console.log(`${tela}: a tela nao e deterministica, nada foi gravado`)
      console.error(instaveis.join('\n'))
      continue
    }

    await rm(pasta, { recursive: true, force: true })
    await mkdir(pasta, { recursive: true })
    for (const [nome, valor] of primeira.texto) await Bun.write(`${pasta}/${nome}`, valor)
    for (const [nome, valor] of primeira.imagens) await Bun.write(`${FOTOS}/${tela}/${nome}`, valor)
    console.log(`${tela}: baseline gravada, ${roteiro.passos.length} passos, as duas passadas bateram`)
    console.log(`  as fotos ficaram em ${FOTOS}/${tela}`)
  }
  return falhas
}

async function prepararCopia(indice: number, mutacao: Mutacao): Promise<string> {
  const base = `${RAIZ}var/paridade-mutacao`
  const copia = `${base}/${indice}/web`
  await rm(`${base}/${indice}`, { recursive: true, force: true })
  await mkdir(copia, { recursive: true })

  // `apps/web/tsconfig.json` estende `../../tsconfig.base.json`, e quem resolve isso
  // e o transformador do build, a partir da copia. Sem o atalho o build para dizendo
  // que nao achou o arquivo. `node_modules` vem por ligacao pelo mesmo motivo, e
  // porque copiar as dependencias custaria mais que o build inteiro.
  await ligar(`${RAIZ}tsconfig.base.json`, `${base}/tsconfig.base.json`)
  // `test` fica de fora junto com os dois obvios. O build nao o usa, e uma copia dele
  // em `var/` faz o `bun test` da raiz descobrir e rodar os mesmos arquivos de novo,
  // uma vez por mutacao, contra o mesmo banco.
  for (const nome of await readdir(`${RAIZ}apps/web`)) {
    if (nome === 'node_modules' || nome === 'dist' || nome === 'test') continue
    await cp(`${RAIZ}apps/web/${nome}`, `${copia}/${nome}`, { recursive: true })
  }
  await ligar(`${RAIZ}apps/web/node_modules`, `${copia}/node_modules`)

  const dentro = `${copia}/${mutacao.arquivo.replace(/^apps\/web\//, '')}`
  const antes = await Bun.file(dentro).text()
  const quantas = antes.split(mutacao.de).length - 1
  if (quantas !== 1) {
    throw new Error(`a mutacao ${indice} achou ${quantas} vezes "${mutacao.de.slice(0, 40)}" em ${mutacao.arquivo}, esperava 1`)
  }
  await Bun.write(dentro, antes.replace(mutacao.de, mutacao.para))

  const build = Bun.spawnSync([`${RAIZ}apps/web/node_modules/.bin/vp`, 'build'], {
    cwd: copia,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (!(await Bun.file(`${copia}/dist/${mutacao.tela}.html`).exists())) {
    throw new Error(`o build da mutacao ${indice} nao produziu dist:\n${build.stderr.toString()}`)
  }
  return copia
}

async function ligar(alvo: string, atalho: string): Promise<void> {
  try {
    await symlink(alvo, atalho)
  } catch (falha) {
    if ((falha as NodeJS.ErrnoException).code !== 'EEXIST') throw falha
  }
}

async function provarMutacoes(navegador: Browser, filtro: string | null): Promise<number> {
  let falhas = 0
  let rodadas = 0
  for (const [indice, mutacao] of MUTACOES.entries()) {
    if (filtro !== null && mutacao.tela !== filtro) continue
    const roteiro = roteiroDe(mutacao.tela)
    if (roteiro === null) {
      console.log(`${mutacao.tela}: sem roteiro ainda`)
      continue
    }
    rodadas++
    const copia = await prepararCopia(indice, mutacao)
    const artefatos = await rodarTela(navegador, roteiro, `${copia}/dist`, `${copia}/src/js`, false)
    const achados = await divergencias(mutacao.tela, artefatos)
    if (achados.length === 0) {
      falhas++
      console.log(`mutacao ${indice} (${mutacao.tela}): PASSOU DESPERCEBIDA`)
      console.error(`  ${mutacao.motivo}`)
      continue
    }
    console.log(`mutacao ${indice} (${mutacao.tela}): pegou, ${achados.length} divergencia(s)`)
    console.log(achados[0])
  }
  if (rodadas === 0) console.log('nenhuma mutacao tem roteiro ainda')
  return falhas
}

// ===================== entrada =====================

const args = Bun.argv.slice(2)
const capturar = args.includes('--capturar')
const mutar = args.includes('--mutar')
const forcar = args.includes('--forcar')
const posicao = args.indexOf('--tela')
const filtro = posicao === -1 ? null : (args[posicao + 1] ?? null)

if (filtro !== null && !TELAS.some((t) => t === filtro)) {
  console.error(`nao existe a tela "${filtro}". as telas sao: ${TELAS.join(', ')}`)
  process.exit(1)
}

const navegador = await abrirNavegador()
let falhas = 0
try {
  if (mutar) falhas = await provarMutacoes(navegador, filtro)
  else if (capturar) falhas = await capturarTelas(navegador, filtro, forcar)
  else falhas = await conferirTelas(navegador, filtro)
} finally {
  await navegador.close()
}

if (falhas > 0) {
  console.error(`\nparidade: ${falhas} problema(s)`)
  process.exit(1)
}
console.log(`\nparidade: ${mutar ? 'toda mutacao foi pega' : 'nenhuma divergencia'}`)
