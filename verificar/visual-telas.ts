/**
 * A restricao da Livia e que o visual nao muda. Esta e a prova disso, para as seis
 * telas que a fase 2 reescreve por dentro.
 *
 * Ate a fase 1 dava para provar byte a byte: o `<script>` era inline, entao o arquivo
 * de hoje e o de `ca90d06` eram o mesmo texto. A fase 2 tira o script para um modulo
 * TypeScript, e a comparacao byte a byte deixa de existir. Trocar ela por nada seria
 * perder a unica prova que segura a restricao, justo na fase que mais mexe no codigo.
 *
 * Entao sao duas comparacoes por tela, e a segunda e a que importa.
 *
 * A primeira compara o HTML fora do `<script>`: CSS, markup estatico, texto visivel.
 * As mudancas declaradas na tabela abaixo sao aplicadas na origem antes de comparar.
 * Qualquer diferenca nao declarada reprova.
 *
 * A segunda compara o markup que o codigo gera. Metade do que aparece na tela nasce
 * de `innerHTML` dentro do script, e a primeira comparacao e cega para isso. Uma
 * revisao provou a cegueira trocando `gap:5px` por `gap:50px` num template do modal:
 * a prova passou. Aqui as tags sao extraidas do `<script>` da origem e do modulo de
 * hoje, com toda interpolacao apagada (`${esc(u.nome)}` vira `${}`), e as duas listas
 * tem que bater. Pixel vem da tag e do atributo `style`, nao de qual variavel enche o
 * buraco, entao essa e a granularidade certa.
 */
type Tela = {
  nome: string
  /** Onde o arquivo estava no commit de origem. A raiz mudou na fase 1. */
  origem: string
  /** O modulo que recebeu o `<script>`, ou null enquanto ele for inline. */
  modulo: string | null
  /** Mudancas fora do `<script>`, aplicadas na origem antes de comparar. */
  estaticas: Array<[string, string]>
  /** Mudancas no markup gerado, ja com a interpolacao apagada. */
  noScript: Array<[string, string]>
}

/**
 * O overlay de login e o CSS dele sairam do formulario na fase 1 e viraram
 * `entrar.html`. Sao tres mudancas, e elas continuam declaradas aqui porque a origem
 * de comparacao continua sendo `ca90d06`: comparar contra a fase 1 esconderia uma
 * regressao que desfizesse o que a fase 1 fez.
 */
const CSS_LOGIN = `/* LOGIN */
.login-overlay{position:fixed;inset:0;background:var(--bg-side);display:flex;align-items:center;justify-content:center;z-index:9999;}
.login-box{background:#fff;border-radius:16px;padding:36px 40px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3);}
.login-logo{background:var(--bg-side);border-radius:10px;padding:12px 20px;margin-bottom:8px;text-align:center;}
.login-sub{font-size:.82rem;color:var(--txt-dim);margin-bottom:28px;}
.login-box label{font-size:.75rem;font-weight:700;color:var(--txt-dim);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px;}
.login-box input{width:100%;background:var(--bg-app);border:1.5px solid var(--border);border-radius:8px;padding:11px 14px;font-size:.95rem;color:var(--txt-main);font-family:inherit;margin-bottom:16px;}
.login-box input:focus{outline:none;border-color:var(--accent);background:#fff;}
.btn-login{width:100%;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:inherit;}
.btn-login:hover{background:#1d4ed8;}
.login-erro{background:var(--red-soft);color:#991b1b;border-radius:8px;padding:10px 14px;font-size:.84rem;margin-top:12px;display:none;}
.user-chip`

const TELAS: Tela[] = [
  {
    nome: 'formulario-registro',
    origem: 'formulario-registro.html',
    modulo: 'apps/web/src/js/formulario-registro.ts',
    estaticas: [
      [CSS_LOGIN, '/* USUÁRIO NA SIDEBAR */\n.user-chip'],
      ['<div id="formArea">', '<div id="formArea" style="display:none;">'],
    ],
    noScript: [
      // O campo de senha do modal de administracao era `type="text"` com a senha em
      // claro no `value`. Depois da fase 0 so existe hash, entao ele nasce vazio, e
      // vazio quer dizer "nao muda".
      [
        '<input type="text" id="edit_senha_${}" value="${}" placeholder="Nova senha">',
        '<input type="password" id="edit_senha_${}" value="" placeholder="Nova senha">',
      ],
    ],
  },
  {
    nome: 'ata-reuniao',
    origem: 'ata-reuniao.html',
    modulo: 'apps/web/src/js/ata-reuniao.ts',
    estaticas: [
      // A frase dizia onde a ata ficava, e a fase 2 muda onde ela fica. Manter o
      // texto antigo seria manter uma tela que mente para quem a le.
      [
        '<div style="font-size:.82rem;color:var(--txt-dim);">Atas salvas neste dispositivo.</div>',
        '<div style="font-size:.82rem;color:var(--txt-dim);">Atas salvas com segurança no sistema.</div>',
      ],
    ],
    noScript: [
      // O checkbox de participante passou a carregar o id do colaborador. O nome
      // deixou de identificar pessoa quando o cadastro virou tabela: ha homonimo
      // entre bases, e o nome muda. Atributo `data-` nao desenha nada.
      [
        '<input type="checkbox" onchange="atualizarMarcado(this)">',
        '<input type="checkbox" data-colaborador-id="${}" onchange="atualizarMarcado(this)">',
      ],
    ],
  },
  {
    nome: 'dashboard-semanal',
    origem: 'dashboard-semanal.html',
    modulo: 'apps/web/src/js/dashboard-semanal.ts',
    estaticas: [],
    noScript: [],
  },
  {
    nome: 'documentos-frota',
    origem: 'documentos-frota.html',
    modulo: 'apps/web/src/js/documentos-frota.ts',
    estaticas: [],
    noScript: [
      // `verDocCard` abria o PDF de dois jeitos: `data:` em base64 ia para uma janela
      // com iframe de 100vh, o resto ia direto. Depois da fase 2 nenhum src e `data:`,
      // porque o PDF vive no servidor e chega por URL. O ramo do iframe virou codigo
      // que nunca roda, e as cinco tags dele saem junto.
      [
        '\n<html>\n<body style="margin:0">\n<iframe src="${}" style="width:100%;height:100vh;border:none;">\n</iframe>\n</body>\n</html>',
        '',
      ],
      // `abrirModalManual` e `abrirModalPlano` ja eram codigo morto em `ca90d06`:
      // nenhum `on*=` as chamava, e `renderManuais` e `renderPlanos` desenham link
      // direto. As duas carregavam template de `innerHTML`, entao apaga-las tira 14
      // tags da lista sem tirar um pixel da tela.
      ['\n<p style="font-size:.85rem;color:var(--txt-dim);margin-bottom:14px;">\n</p>\n<div class="form-group">\n<label>\n</label>\n<input type="url" id="docLink" class="inp" placeholder="https://drive.google.com/..." value="${}">\n</div>\n<p style="font-size:.75rem;color:var(--txt-muted);">\n</p>\n<div class="form-group">\n<label>\n</label>\n<input type="url" id="docLink" class="inp" placeholder="https://drive.google.com/..." value="${}">\n</div>', ''],
    ],
  },
  {
    nome: 'integracao-frota',
    origem: 'integracao-frota.html',
    modulo: 'apps/web/src/js/integracao-frota.ts',
    estaticas: [],
    noScript: [],
  },
  {
    nome: 'manutencao-frota',
    origem: 'manutencao-frota.html',
    modulo: 'apps/web/src/js/manutencao-frota.ts',
    estaticas: [],
    noScript: [],
  },
]

const ORIGEM = 'ca90d06'

/**
 * O `<script>` sai da comparacao estatica de um jeito so, seja ele inline na origem
 * ou a tag de modulo de hoje. Sem isso a troca de um pelo outro apareceria como
 * diferenca em toda tela, e a prova nao diria mais nada.
 */
function semScript(html: string): string {
  return html
    // O inline sai inteiro, com a quebra de linha, pelo mesmo motivo que a tag do
    // modulo abaixo: os dois lados da comparacao tem que ficar sem script nenhum, ou
    // a assimetria vira falsa diferenca.
    .replace(/\n?[ \t]*<script>[\s\S]*?<\/script>/g, '')
    // A tag do modulo sai inteira, com a quebra de linha e a indentacao, em vez de
    // virar marcador. O Vite nao so troca `./js/x.ts` pelo asset com hash: ele move a
    // tag do fim do body para o `<head>` e acrescenta o `modulepreload`. Marcador no
    // lugar acusaria diferenca de posicao em toda tela, que nao e diferenca de pixel.
    // O `<script src>` do Chart.js fica de fora de proposito: trocar o CDN dele e
    // mudanca de verdade e tem que reprovar.
    .replace(/\n?[ \t]*<script[^>]*\bsrc="(?:\.\/js\/|\/assets\/)[^"]*"[^>]*><\/script>/g, '')
    .replace(/\n?[ \t]*<link rel="modulepreload"[^>]*>/g, '')
}

/** `${qualquer coisa}` vira `${}`. Repete porque ha interpolacao dentro de outra. */
function semInterpolacao(texto: string): string {
  let antes = texto
  for (let i = 0; i < 10; i++) {
    const depois = antes.replace(/\$\{[^{}]*\}/g, '${}')
    if (depois === antes) return depois
    antes = depois
  }
  return antes
}

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])[^>]*>/g

/**
 * As tags do markup que o codigo gera, em ordem, sem o codigo em volta.
 *
 * O filtro por nome existe porque o modulo de hoje e TypeScript, e generico se
 * parece com tag: `Map<string, File>` e `Promise<Response>` casariam com qualquer
 * regex de tag. A lista de nomes validos sai do proprio arquivo de origem, que e
 * HTML puro e anterior ao TypeScript, entao ela nao pode ser envenenada pelo que
 * esta sendo verificado.
 */
function tags(codigo: string, nomes: Set<string>): string[] {
  const achadas: string[] = []
  for (const m of semInterpolacao(codigo).matchAll(TAG)) {
    // Espaco entre atributos nao desenha nada, e o original tem varios duplos. Cobrar
    // fidelidade neles transformaria a prova num verificador de formatacao, que
    // reprova por motivo errado e treina quem a le a ignorar o vermelho.
    if (nomes.has(m[1]!.toLowerCase())) achadas.push(m[0].replace(/\s+/g, ' '))
  }
  return achadas
}

function nomesDeTag(origem: string): Set<string> {
  return new Set([...origem.matchAll(TAG)].map((m) => m[1]!.toLowerCase()))
}

function scriptInline(html: string): string {
  return /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
}

/**
 * O bloco do overlay de login, do comentario ate o inicio da sidebar. Ele sai
 * inteiro, e nao vira linha vazia: `''` no lugar do comentario deixaria uma linha a
 * mais e a comparacao acusaria diferenca que nao existe na tela.
 */
function semOverlay(html: string): string {
  const inicio = html.indexOf('<!-- LOGIN OVERLAY -->')
  if (inicio === -1) throw new Error('nao achei o overlay no arquivo de origem')
  const fim = html.indexOf('<!-- SIDEBAR -->', inicio)
  if (fim === -1) throw new Error('nao achei o inicio da sidebar depois do overlay')
  return html.slice(0, inicio) + html.slice(fim)
}

function daOrigem(caminho: string): string {
  const proc = Bun.spawnSync(['git', 'show', `${ORIGEM}:${caminho}`])
  if (proc.exitCode !== 0) throw new Error(`git show ${ORIGEM}:${caminho} falhou`)
  return proc.stdout.toString()
}

function aplicar(texto: string, mudancas: Array<[string, string]>, onde: string): string {
  let saida = texto
  for (const [velho, novo] of mudancas) {
    if (!saida.includes(velho)) {
      throw new Error(`mudanca declarada nao casa na origem (${onde}): ${velho.slice(0, 60)}`)
    }
    saida = saida.replace(velho, novo)
  }
  return saida
}

function primeiraDiferenca(a: string[], b: string[]): string {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return [
        `  primeira diferenca no item ${i + 1}`,
        `  esperado: ${a[i] ?? '<nao existe mais>'}`,
        `  obtido:   ${b[i] ?? '<nao existe mais>'}`,
      ].join('\n')
    }
  }
  return '  as listas sao iguais item a item mas diferem no tamanho'
}

/**
 * O build tambem nao pode mudar pixel. Ate a fase 1 isso era `cmp` puro entre `src` e
 * `dist`, porque o Vite nao encosta em `<script>` inline classico. Com modulo ele
 * reescreve a tag para o asset com hash, e so ela: fora do script a igualdade byte a
 * byte continua valendo, e continua sendo cobrada.
 */
async function buildFiel(nome: string): Promise<boolean> {
  const fonte = await Bun.file(`apps/web/src/${nome}.html`).text()
  const saida = await Bun.file(`apps/web/dist/${nome}.html`).text()
  return semScript(fonte) === semScript(saida)
}

let falhas = 0

for (const tela of TELAS) {
  const bruta = daOrigem(tela.origem)
  const origem = tela.nome === 'formulario-registro' ? semOverlay(bruta) : bruta
  const hoje = await Bun.file(`apps/web/src/${tela.nome}.html`).text()

  const esperado = semScript(aplicar(origem, tela.estaticas, `${tela.nome}, estatico`))
  if (esperado !== semScript(hoje)) {
    falhas++
    console.log(`${tela.nome}: DIFERENTE fora do script`)
    console.error(primeiraDiferenca(esperado.split('\n'), semScript(hoje).split('\n')))
    continue
  }

  // Enquanto o script for inline, a origem e o arquivo de hoje sao o mesmo texto e a
  // segunda comparacao seria trivial. Ela so passa a valer quando ha modulo.
  if (tela.modulo === null) {
    console.log(`${tela.nome}: igual (script ainda inline)`)
    continue
  }

  const nomes = nomesDeTag(bruta)
  const tagsOrigem = aplicar(
    tags(scriptInline(bruta), nomes).join('\n'),
    tela.noScript,
    `${tela.nome}, no script`,
  )
  const tagsHoje = tags(await Bun.file(tela.modulo).text(), nomes).join('\n')

  if (tagsOrigem === tagsHoje) {
    console.log(`${tela.nome}: igual`)
    continue
  }

  falhas++
  const a = tagsOrigem.split('\n')
  const b = tagsHoje.split('\n')
  // Reordenar funcoes durante a extracao nao muda pixel nenhum; perder ou alterar uma
  // tag muda. Dizer qual dos dois aconteceu e a diferenca entre corrigir e reescrever.
  const mesmoConjunto = [...a].sort().join('\n') === [...b].sort().join('\n')
  console.log(`${tela.nome}: DIFERENTE no markup gerado`)
  console.error(mesmoConjunto ? '  as mesmas tags, em outra ordem' : primeiraDiferenca(a, b))
}

// `GUIA-CONFIGURACAO` entra aqui sem modulo porque nada nela mudou.
//
// `entrar` saiu desta lista no commit em que virou React. Esta prova compara texto de
// arquivo com texto de arquivo, e a casca de uma tela React nao se parece com o que o
// build entrega: o CSS vira `<link>` e o script sobe para o `<head>`. Quem cobra
// `entrar` agora e `verificar/paridade.ts`, que compara o que o navegador montou, e
// cobra mais: DOM, CSS, efeito de cada clique e os cinco estados. A cada tela portada
// some uma linha daqui, e no fim o arquivo inteiro.
for (const nome of [...TELAS.map((t) => t.nome), 'GUIA-CONFIGURACAO']) {
  if (await buildFiel(nome)) continue
  falhas++
  console.log(`${nome}: o build alterou a tela alem da tag de script`)
}

if (falhas > 0) {
  console.error(`\nvisual: ${falhas} divergencia(s)`)
  process.exit(1)
}
console.log(`\nvisual: ${TELAS.length} telas fieis a ${ORIGEM}, e o build nao toca em nenhuma`)
