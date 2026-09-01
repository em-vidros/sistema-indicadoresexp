/**
 * A restricao da Livia e que o visual nao muda. Nas outras seis telas isso e uma
 * comparacao byte a byte com o commit de origem. Em `formulario-registro.html` nao
 * da, porque a fase 1 tira o overlay de login de dentro dela.
 *
 * Entao a comparacao aqui e outra, e sao duas.
 *
 * A primeira aplica no arquivo de origem as tres mudancas que a fase 1 declara ter
 * feito fora do `<script>`, e cobra que o resultado bata byte a byte com o arquivo de
 * hoje. Qualquer quarta diferenca de CSS ou de markup reprova.
 *
 * A segunda existe porque a primeira nao bastava, e isso saiu de uma revisao: metade
 * do markup desta tela nao esta no HTML estatico, ela nasce de `innerHTML` dentro do
 * `<script>`. Sao 8 pontos so neste arquivo. Duas mutacoes passaram batido na
 * primeira versao desta prova, uma delas trocando `gap:5px` por `gap:50px` num
 * template do modal de administracao.
 *
 * A segunda comparacao pega as tags HTML de dentro do `<script>` e compara a lista.
 * Ela apaga toda interpolacao antes: `${u.base}` e `${esc(u.nome)}` viram `${}`, e o
 * que sobra e o esqueleto que desenha a tela. E a granularidade certa, porque pixel
 * vem da tag e do atributo `style`, nao de qual variavel preenche o buraco.
 */
const ORIGEM = 'ca90d06'
const ARQUIVO = 'apps/web/src/formulario-registro.html'

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

const MUDANCAS: Array<[string, string]> = [
  [CSS_LOGIN, '/* USUÁRIO NA SIDEBAR */\n.user-chip'],
  ['<!-- LOGIN OVERLAY -->', ''],
  ['<div id="formArea">', '<div id="formArea" style="display:none;">'],
]

/** O `<script>` sai desta comparacao: aqui e o CSS e o markup estatico. */
function semScript(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>/g, '<script/>')
}

/**
 * As mudancas declaradas dentro do `<script>`, ja com a interpolacao apagada.
 *
 * O campo de senha do modal de administracao era `type="text"` com a senha em claro
 * no `value`. Depois da fase 0 so existe hash, entao ele nasce vazio, e vazio quer
 * dizer "nao muda". `password` e o tipo certo para um campo em que se digita senha.
 */
const MUDANCAS_NO_SCRIPT: Array<[string, string]> = [
  [
    '<input type="text" id="edit_senha_${}" value="${}" placeholder="Nova senha">',
    '<input type="password" id="edit_senha_${}" value="" placeholder="Nova senha">',
  ],
]

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

/** As tags do markup que o `<script>` gera, em ordem, sem o codigo em volta. */
function tagsDoScript(html: string): string[] {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
  return [...semInterpolacao(script).matchAll(/<\/?[a-zA-Z][^>]*>/g)].map((m) => m[0])
}

/** O bloco do overlay: da linha do comentario ate o `</div>` que fecha a raiz dele. */
function semOverlay(html: string): string {
  const inicio = html.indexOf('<!-- LOGIN OVERLAY -->')
  if (inicio === -1) throw new Error('nao achei o overlay no arquivo de origem')
  const fim = html.indexOf('<!-- SIDEBAR -->', inicio)
  if (fim === -1) throw new Error('nao achei o inicio da sidebar depois do overlay')
  return html.slice(0, inicio) + html.slice(fim)
}

const proc = Bun.spawnSync(['git', 'show', `${ORIGEM}:formulario-registro.html`])
if (proc.exitCode !== 0) throw new Error(`git show falhou: ${proc.stderr.toString()}`)

let esperado = semOverlay(proc.stdout.toString())
for (const [velho, novo] of MUDANCAS) {
  if (velho === '<!-- LOGIN OVERLAY -->') continue
  if (!esperado.includes(velho)) throw new Error(`a mudanca declarada nao casa na origem: ${velho.slice(0, 40)}`)
  esperado = esperado.replace(velho, novo)
}

const obtido = await Bun.file(ARQUIVO).text()

let tagsEsperadas = tagsDoScript(esperado).join('\n')
for (const [velho, novo] of MUDANCAS_NO_SCRIPT) {
  if (!tagsEsperadas.includes(velho)) {
    throw new Error(`a mudanca declarada no script nao casa na origem: ${velho.slice(0, 50)}`)
  }
  tagsEsperadas = tagsEsperadas.replace(velho, novo)
}
const tagsObtidas = tagsDoScript(obtido).join('\n')

if (semScript(esperado) === semScript(obtido) && tagsEsperadas === tagsObtidas) {
  console.log('igual')
  process.exit(0)
}

if (tagsEsperadas !== tagsObtidas) {
  const a = tagsEsperadas.split('\n')
  const b = tagsObtidas.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log('DIFERENTE')
      console.error(`  markup gerado pelo script diverge na tag ${i + 1}`)
      console.error(`  esperado: ${a[i] ?? '<nao existe mais>'}`)
      console.error(`  obtido:   ${b[i] ?? '<nao existe mais>'}`)
      break
    }
  }
  process.exit(1)
}

// Reprovou: mostrar onde, senao o script vira um "nao" sem endereco.
const a = semScript(esperado).split('\n')
const b = semScript(obtido).split('\n')
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    console.log('DIFERENTE')
    console.error(`  primeira diferenca na linha ${i + 1}`)
    console.error(`  esperado: ${a[i] ?? '<fim do arquivo>'}`)
    console.error(`  obtido:   ${b[i] ?? '<fim do arquivo>'}`)
    break
  }
}
process.exit(1)
