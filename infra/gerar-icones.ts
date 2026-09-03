/**
 * Escreve `apps/web/src/geist/icones.tsx` a partir de `var/design-dashboard/geist-icons.json`.
 *
 *   bun infra/gerar-icones.ts
 *
 * O JSON tem os 461 icones do Geist como `{ nome: { viewBox, body } }`, e `body` e o
 * miolo do `<svg>` em HTML. Sai daqui so o que a lista `USADOS` pede: um arquivo com as
 * 461 exportacoes seriam ~280 KB de fonte gerada que todo `tsc` e todo diff carregam
 * para poupar uma linha de manutencao. Importar um icone que nao foi gerado quebra o
 * `tsc`, entao a lista se cobra sozinha.
 *
 * O que este arquivo arranca, e por que.
 *
 * 249 dos 461 icones vem embrulhados num `<g clip-path="url(#nome_svg__a)">` com o
 * `<clipPath>` correspondente num `<defs>`. Em todos eles o `d` do clip e exatamente o
 * retangulo do proprio viewBox, e o `<svg>` ja recorta nesse retangulo sozinho: o clip
 * nao desenha nada. O que ele faz e carregar um `id` fixo, e o mesmo icone repetido dez
 * vezes numa tabela produz dez elementos com o mesmo `id`, que e DOM invalido e faz o
 * recorte de uma copia depender de qual definicao o navegador resolveu por ultimo.
 *
 * Entao o clip sai, e a invariante fica provada aqui e nao num comentario: se algum dia
 * chegar um clip cujo `d` nao seja o retangulo do viewBox, `semClip` estoura e o arquivo
 * nao e escrito. Nada de `useId()` em runtime para um recorte que nao recorta.
 */
const RAIZ = new URL('../', import.meta.url).pathname
const FONTE = `${RAIZ}var/design-dashboard/geist-icons.json`
const DESTINO = `${RAIZ}apps/web/src/geist/icones.tsx`

/**
 * Os icones que o codigo importa hoje, em ordem alfabetica. Acrescente o nome aqui e
 * rode de novo; tirar daqui um que ainda e importado quebra o `tsc`, que e a checagem.
 */
const USADOS = [
  'ArrowDownRight',
  'ArrowLeftRight',
  'ArrowRight',
  'ArrowUpDown',
  'ArrowUpRight',
  'CheckCircle',
  'ChevronDown',
  'FileText',
  'Gauge',
  'Home',
  'Information',
  'Layers',
  'MagnifyingGlass',
  'MoreHorizontal',
  'Notes',
  'PencilEdit',
  'Plus',
  'Route',
  'Warning',
  'Wrench',
] as const

type Icone = { readonly viewBox: string; readonly body: string }

type No = {
  readonly tag: string
  readonly atributos: ReadonlyArray<readonly [string, string]>
  readonly filhos: readonly No[]
}

/**
 * As tags e os atributos que o set inteiro usa. Qualquer coisa fora daqui estoura em vez
 * de sair no arquivo com o nome errado: `fill-rule` como prop do React e ignorado em
 * silencio pelo DOM, e o icone desenharia preenchido pelo lado de dentro.
 */
const TAGS = new Set(['circle', 'clipPath', 'defs', 'ellipse', 'g', 'line', 'path', 'polygon', 'polyline', 'rect'])

const ATRIBUTOS: Readonly<Record<string, string>> = {
  cx: 'cx',
  cy: 'cy',
  d: 'd',
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  height: 'height',
  id: 'id',
  opacity: 'opacity',
  points: 'points',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  stroke: 'stroke',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  transform: 'transform',
  width: 'width',
  x: 'x',
  x1: 'x1',
  x2: 'x2',
  y: 'y',
  y1: 'y1',
  y2: 'y2',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
}

class ErroDeIcone extends Error {
  constructor(nome: string, motivo: string) {
    super(`${nome}: ${motivo}`)
    this.name = 'ErroDeIcone'
  }
}

/** Le `<tag a="b">filhos</tag>` e `<tag a="b"/>` do texto, do inicio ao fim. */
function analisar(nome: string, fonte: string): No[] {
  let i = 0

  const pular = (): void => {
    while (i < fonte.length && /\s/.test(fonte[i] ?? '')) i++
  }

  const lerNos = (ate: string | null): No[] => {
    const nos: No[] = []
    for (;;) {
      pular()
      if (i >= fonte.length) {
        if (ate !== null) throw new ErroDeIcone(nome, `<${ate}> nao fecha`)
        return nos
      }
      if (fonte.startsWith('</', i)) {
        const fim = fonte.indexOf('>', i)
        const fechada = fonte.slice(i + 2, fim).trim()
        if (fechada !== ate) throw new ErroDeIcone(nome, `</${fechada}> fecha <${ate ?? 'nada'}>`)
        i = fim + 1
        return nos
      }
      if (fonte[i] !== '<') throw new ErroDeIcone(nome, `texto solto em "${fonte.slice(i, i + 30)}"`)
      i++
      const inicioDaTag = i
      while (i < fonte.length && /[A-Za-z]/.test(fonte[i] ?? '')) i++
      const tag = fonte.slice(inicioDaTag, i)
      if (!TAGS.has(tag)) throw new ErroDeIcone(nome, `tag <${tag}> fora da lista`)

      const atributos: Array<readonly [string, string]> = []
      for (;;) {
        pular()
        if (fonte.startsWith('/>', i)) {
          i += 2
          nos.push({ tag, atributos, filhos: [] })
          break
        }
        if (fonte[i] === '>') {
          i++
          nos.push({ tag, atributos, filhos: lerNos(tag) })
          break
        }
        const inicioDoAtributo = i
        while (i < fonte.length && /[-A-Za-z:]/.test(fonte[i] ?? '')) i++
        const atributo = fonte.slice(inicioDoAtributo, i)
        if (atributo === '') throw new ErroDeIcone(nome, `atributo vazio em "${fonte.slice(i, i + 30)}"`)
        pular()
        if (fonte[i] !== '=') throw new ErroDeIcone(nome, `${atributo} sem valor`)
        i++
        pular()
        const aspa = fonte[i]
        if (aspa !== '"' && aspa !== "'") throw new ErroDeIcone(nome, `${atributo} sem aspas`)
        i++
        const fim = fonte.indexOf(aspa, i)
        if (fim === -1) throw new ErroDeIcone(nome, `${atributo} nao fecha as aspas`)
        atributos.push([atributo, fonte.slice(i, fim)])
        i = fim + 1
      }
    }
  }

  return lerNos(null)
}

function pegar(no: No, atributo: string): string | null {
  return no.atributos.find(([n]) => n === atributo)?.[1] ?? null
}

/** O `d` do retangulo que o proprio `<svg>` ja recorta, para o viewBox dado. */
function retanguloDo(nome: string, viewBox: string): string {
  const partes = viewBox.split(/\s+/).map(Number)
  const [x, y, largura, altura] = partes
  if (partes.length !== 4 || partes.some((n) => Number.isNaN(n))) {
    throw new ErroDeIcone(nome, `viewBox "${viewBox}" nao tem quatro numeros`)
  }
  if (x !== 0 || y !== 0) throw new ErroDeIcone(nome, `viewBox "${viewBox}" nao comeca em 0 0`)
  return `M0 0h${largura}v${altura}H0z`
}

/**
 * Tira o `<defs>` com os clips e desembrulha os `<g clip-path>` que apontam para eles.
 * Estoura se o clip recortar qualquer coisa diferente do retangulo do viewBox, que e a
 * unica forma em que arrancar o recorte nao muda o desenho.
 */
function semClip(nome: string, viewBox: string, nos: readonly No[]): readonly No[] {
  const retangulo = retanguloDo(nome, viewBox)
  const inertes = new Set<string>()

  const conferir = (defs: No): void => {
    for (const clip of defs.filhos) {
      if (clip.tag !== 'clipPath') throw new ErroDeIcone(nome, `<defs> com <${clip.tag}> dentro`)
      const id = pegar(clip, 'id')
      if (id === null) throw new ErroDeIcone(nome, '<clipPath> sem id')
      const forma = clip.filhos[0]
      if (clip.filhos.length !== 1 || forma === undefined || forma.tag !== 'path') {
        throw new ErroDeIcone(nome, `<clipPath id="${id}"> nao e um unico <path>`)
      }
      const d = pegar(forma, 'd')
      if (d !== retangulo) {
        throw new ErroDeIcone(nome, `<clipPath id="${id}"> recorta "${d ?? ''}" e nao o viewBox "${retangulo}"`)
      }
      inertes.add(`url(#${id})`)
    }
  }

  for (const no of nos) if (no.tag === 'defs') conferir(no)

  const limpar = (lista: readonly No[]): No[] =>
    lista.flatMap((no) => {
      if (no.tag === 'defs') return []
      const filhos = limpar(no.filhos)
      const clip = pegar(no, 'clip-path')
      if (clip !== null) {
        if (!inertes.has(clip)) throw new ErroDeIcone(nome, `clip-path="${clip}" sem <clipPath> conferido`)
        if (no.tag !== 'g' || no.atributos.length !== 1) {
          throw new ErroDeIcone(nome, `clip-path fora de um <g> so com ele: <${no.tag}>`)
        }
        return filhos
      }
      return [{ tag: no.tag, atributos: no.atributos, filhos }]
    })

  const limpos = limpar(nos)
  const sobrou = JSON.stringify(limpos)
  if (sobrou.includes('url(#') || sobrou.includes('"id"')) {
    throw new ErroDeIcone(nome, 'sobrou id ou referencia depois de tirar o clip')
  }
  return limpos
}

function escrever(nome: string, nos: readonly No[], recuo: string): string {
  return nos
    .map((no) => {
      const props = no.atributos
        .map(([atributo, valor]) => {
          const emJsx = ATRIBUTOS[atributo]
          if (emJsx === undefined) throw new ErroDeIcone(nome, `atributo ${atributo} fora da lista`)
          if (valor.includes('"')) throw new ErroDeIcone(nome, `${atributo} tem aspas dentro do valor`)
          return ` ${emJsx}="${valor}"`
        })
        .join('')
      if (no.filhos.length === 0) return `${recuo}<${no.tag}${props} />`
      const dentro = escrever(nome, no.filhos, `${recuo}  `)
      return `${recuo}<${no.tag}${props}>\n${dentro}\n${recuo}</${no.tag}>`
    })
    .join('\n')
}

const icones = (await Bun.file(FONTE).json()) as Record<string, Icone | undefined>

const corpos = USADOS.map((nome) => {
  const icone = icones[nome]
  if (icone === undefined) throw new ErroDeIcone(nome, 'nao existe em geist-icons.json')
  const limpos = semClip(nome, icone.viewBox, analisar(nome, icone.body))
  const corpo = limpos.length === 1
    ? `(\n${escrever(nome, limpos, '    ')}\n  )`
    : `(\n    <>\n${escrever(nome, limpos, '      ')}\n    </>\n  )`
  return `export const ${nome}: Desenho = {\n  viewBox: '${icone.viewBox}',\n  corpo: ${corpo},\n}`
})

const arquivo = `/**
 * GERADO por \`bun infra/gerar-icones.ts\` a partir de \`var/design-dashboard/geist-icons.json\`.
 * Nao edite a mao: a proxima geracao desfaz. Para acrescentar um icone, ponha o nome na
 * lista \`USADOS\` do gerador e rode de novo.
 *
 * O \`<g clip-path>\` e o \`<defs>\` do set original nao estao aqui. O gerador confere que o
 * clip era o retangulo do proprio viewBox, que o \`<svg>\` ja recorta, e o arranca; sem
 * ele nao ha \`id\` fixo, e o mesmo icone repetido numa tabela nao colide consigo mesmo.
 *
 * Nao ha prop de cor. O \`fill\` dos caminhos e \`currentColor\`, entao quem manda na cor e
 * o \`color\` de quem monta o icone.
 */
import type { ReactNode } from 'react'
import type { JSX } from 'react'

export type Desenho = { readonly viewBox: string; readonly corpo: ReactNode }

${corpos.join('\n\n')}

export function Icone({ de, tamanho = 16, classe }: {
  readonly de: Desenho
  readonly tamanho?: number
  readonly classe?: string
}): JSX.Element {
  return (
    <svg
      className={classe === undefined ? 'g-icone' : \`g-icone \${classe}\`}
      width={tamanho}
      height={tamanho}
      viewBox={de.viewBox}
      fill="none"
      aria-hidden="true"
    >
      {de.corpo}
    </svg>
  )
}
`

await Bun.write(DESTINO, arquivo)
console.log(`${USADOS.length} icones em ${DESTINO}`)
