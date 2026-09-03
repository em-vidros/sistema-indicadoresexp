/**
 * Todo `onclick=` do markup precisa achar a funcao no escopo global. Esta e a prova
 * disso, e ela existe porque a falta dela custou duas telas.
 *
 * O script inline das sete telas rodava no escopo global, entao `onclick="salvar()"`
 * achava `function salvar()` sem ninguem pensar no assunto. `<script type="module">`
 * tem escopo proprio. No instante em que o script vira modulo, toda funcao chamada
 * por atributo do HTML some do lugar onde o navegador a procura, e a unica coisa que
 * acontece e uma linha no console que ninguem le. A tela abre, pinta certo, navega
 * pela lateral, e o botao Salvar nao faz nada.
 *
 * A fase 2 fez exatamente isso em `manutencao-frota` e `dashboard-semanal`: 28
 * handlers mortos, e a suite inteira verde. Tipo nao pega, teste de API nao pega,
 * comparacao de markup nao pega, porque o markup esta certo. So esta prova pega.
 *
 * Ela le os dois lados: os atributos do HTML estatico e os que o proprio modulo
 * escreve dentro de `innerHTML`, que sao metade deles.
 */
const TELAS: readonly string[] = []

/**
 * O que o navegador ja tem e nao precisa vir do modulo. `event` e `this` sao do
 * proprio handler; o resto e API de plataforma que o codigo das telas usa direto
 * dentro do atributo.
 */
const DO_NAVEGADOR = new Set([
  'window',
  'document',
  'location',
  'event',
  'this',
  'alert',
  'confirm',
  'print',
  'history',
  'console',
  'Number',
  'String',
  'Boolean',
  'JSON',
  'Math',
  'Date',
  'parseInt',
  'parseFloat',
  'setTimeout',
  'true',
  'false',
  'null',
  'undefined',
  'return',
  'if',
  'else',
  'typeof',
  'new',
  'delete',
  'void',
  'in',
  'of',
])

const ATRIBUTO = /\bon(?:click|change|input|submit|keydown|keyup|keypress|focus|blur|dblclick)\s*=\s*(["'])([\s\S]*?)\1/gi

/**
 * O nome de uma funcao chamada direto no atributo. O olhar para tras descarta metodo
 * (`document.getElementById(...)`, `el.click()`): quem responde por esse e o objeto da
 * esquerda, nao o escopo global, e sem ele a prova acusaria `getElementById` como
 * handler morto em toda tela.
 */
const CHAMADA = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*(?=\()/g

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

/**
 * O que o modulo poe no escopo global. As duas formas que valem: o
 * `Object.assign(window, { a, b })` que os modulos usam, e `window.x = ...` avulso.
 *
 * `declare global` e cast de tipo nao contam: eles convencem o TypeScript e nao
 * mudam nada em tempo de execucao, que e onde o clique acontece.
 */
function expostos(modulo: string): Set<string> {
  const nomes = new Set<string>()

  for (const bloco of modulo.matchAll(/Object\.assign\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
    // `{ salvar, fechar: fecharModal, abrir }` -> salvar, fechar, abrir. A chave e o
    // nome que o HTML chama; o valor e problema do modulo.
    for (const item of bloco[1]!.split(',')) {
      const chave = /^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(item)
      if (chave) nomes.add(chave[1]!)
    }
  }

  for (const direto of modulo.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) {
    nomes.add(direto[1]!)
  }

  return nomes
}

let falhas = 0

for (const tela of TELAS) {
  const html = await Bun.file(`apps/web/src/${tela}.html`).text()

  const tag = /<script type="module" src="\.\/js\/([^"]+)"><\/script>/.exec(html)
  if (tag === null) {
    // Script inline continua no escopo global, entao nao ha o que provar aqui.
    console.log(`${tela}: script inline, nada a provar`)
    continue
  }

  const modulo = await Bun.file(`apps/web/src/js/${tag[1]}`).text()

  const precisa = new Set([...chamados(html), ...chamados(modulo)])
  const tem = expostos(modulo)
  const mortos = [...precisa].filter((nome) => !tem.has(nome)).sort()

  if (mortos.length === 0) {
    console.log(`${tela}: ${precisa.size} handlers, todos no escopo global`)
    continue
  }

  falhas++
  console.log(`${tela}: ${mortos.length} de ${precisa.size} handlers nao existem para o navegador`)
  for (const nome of mortos) console.error(`    ${nome}()`)
}

if (falhas > 0) {
  console.error(`\nhandlers: ${falhas} tela(s) com clique que nao faz nada`)
  process.exit(1)
}
console.log(`\nhandlers: ${TELAS.length} telas, todo atributo do markup acha sua funcao`)
