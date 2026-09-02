/**
 * O DOM montado da tela vira texto, e esse texto e comparado byte a byte contra uma
 * baseline congelada.
 *
 * Comparar screenshot seria mais direto e nao serve. Antialiasing, fonte que chega
 * tarde, largura de scrollbar do sistema, nada disso muda a tela para quem usa, e
 * tudo isso muda o pixel. A prova passaria a reprovar por coisa que ninguem corrige.
 *
 * Entao a prova e de estrutura. Cada normalizacao daqui apaga uma coisa que varia
 * entre duas execucoes sem desenhar diferente, e nada alem disso. O que sobra e o
 * que desenha.
 *
 * O percurso roda dentro da pagina, entao nada aqui pode vir de fora do `evaluate`.
 */
import type { Page } from 'playwright'

/** Uma linha por no, dois espacos por profundidade, `document.body` na raiz. */
export async function serializarDom(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // As quatro nao desenham nada por si, e o que elas mandam na tela ja chega ao
    // resto da serializacao pelo estilo computado.
    const PULADAS = new Set(['script', 'link', 'style', 'noscript'])
    const INLINE = new Set(['inline', 'inline-block', 'inline-flex'])
    const COM_SRC = new Set(['iframe', 'video', 'img'])

    // O hash do asset muda a cada build sem mudar um pixel. O trecho antes do hash e
    // guloso de proposito, para o hifen escolhido ser o ultimo do nome do arquivo.
    const ASSET = /(\/assets\/[^?#]*?)([^/?#]*)-[A-Za-z0-9_-]{8,}(\.[^./?#]+)(?=$|[?#])/

    const escapar = (texto: string): string =>
      texto
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')

    const ehInline = (ref: Node | null): boolean => {
      if (ref instanceof Text) return true
      if (ref instanceof Element) return INLINE.has(getComputedStyle(ref).display)
      return false
    }

    /**
     * A ordem em que o atributo foi escrito nao desenha, e o markup gerado pelo codigo
     * de hoje nasce noutra ordem que o da origem. `on*` sai porque e comportamento.
     */
    const atributos = (el: Element): Array<[string, string]> => {
      const lista: Array<[string, string]> = []
      const tag = el.tagName.toLowerCase()

      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('on')) continue

        // Espaco e ponto e virgula dentro do `style` nao desenham, e `cssText` devolve
        // a forma que o navegador guardou, igual para os dois lados da comparacao.
        if (attr.name === 'style' && (el instanceof HTMLElement || el instanceof SVGElement)) {
          lista.push(['style', el.style.cssText])
          continue
        }

        // A ordem das classes nao desenha, e a lista nasce de concatenacao.
        if (attr.name === 'class') {
          const tokens = attr.value.split(/\s+/).filter((t) => t !== '')
          lista.push(['class', tokens.sort().join(' ')])
          continue
        }

        if (attr.name === 'src' && COM_SRC.has(tag)) {
          lista.push(['src', attr.value.replace(ASSET, '$1$2-*$3')])
          continue
        }

        lista.push([attr.name, attr.value])
      }

      // A tela mostra a propriedade, e o atributo congela no valor inicial enquanto o
      // campo muda por baixo. O `@` ordena antes de qualquer letra, que basta.
      if (el instanceof HTMLInputElement) {
        lista.push(['@value', el.value])
        if (el.type === 'checkbox' || el.type === 'radio') {
          lista.push(['@checked', String(el.checked)])
        }
      }
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        lista.push(['@value', el.value])
      }
      if (el instanceof HTMLOptionElement) lista.push(['@selected', String(el.selected)])
      if ('disabled' in el && el.disabled === true) lista.push(['@disabled', 'true'])

      return lista.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    }

    const linhas: string[] = []

    const visitar = (no: Node, nivel: number): void => {
      const recuo = '  '.repeat(nivel)

      if (no instanceof Text) {
        if (no.data.trim() === '') {
          // Espaco entre duas tags de bloco nao desenha nada, e entre inline desenha um
          // espaco so, que e o que o navegador faz com ele.
          const anterior = no.previousSibling ?? no.parentElement
          const seguinte = no.nextSibling ?? no.parentElement
          if (ehInline(anterior) || ehInline(seguinte)) linhas.push(`${recuo}" "`)
          return
        }
        // Corrida de espaco vira um espaco porque a indentacao do arquivo e a do
        // template mudam sem mudar o que se le na tela.
        linhas.push(`${recuo}"${escapar(no.data.replace(/\s+/g, ' '))}"`)
        return
      }

      // Comentario de HTML nao chega na tela, e reprovar por uma nota que alguem deixou
      // no markup seria reprovar por nada.
      if (!(no instanceof Element)) return

      const tag = no.tagName.toLowerCase()
      if (PULADAS.has(tag)) return

      // `display:contents` nao gera caixa nenhuma, entao dar linha a ele seria inventar
      // um nivel que a tela nao tem.
      if (getComputedStyle(no).display === 'contents') {
        for (const filho of Array.from(no.childNodes)) visitar(filho, nivel)
        return
      }

      const escritos = atributos(no).map(([nome, valor]) => ` ${nome}="${escapar(valor)}"`)
      linhas.push(recuo + tag + escritos.join(''))

      // O filho do `<canvas>` e o fallback de quem nao tem contexto 2d, e o desenho de
      // verdade sai por outro caminho, no `.canvas.json`.
      if (tag === 'canvas') return

      for (const filho of Array.from(no.childNodes)) visitar(filho, nivel + 1)
    }

    visitar(document.body, 0)
    return `${linhas.join('\n')}\n`
  })
}

/**
 * O CSS que a tela aplica, que sai do percurso do DOM e desenha tudo.
 *
 * Sai do CSSOM, e nao do texto das tags `<style>`, por dois motivos. Hoje o CSS mora
 * numa `<style>` dentro do HTML; depois do porte ele e importado pelo componente e o
 * build entrega uma `<link>`, e ler so `<style>` daria vazio sem ninguem reprovar. E o
 * build reformata o texto no caminho, entao byte a byte reprovaria por espaco em branco.
 * O navegador reserializa os dois lados na mesma forma, e o que sobra e a regra.
 *
 * `cssRules` de folha de outra origem lanca; aqui tudo vem do mesmo palco, e uma folha
 * que passe a vir de fora tem que aparecer em vez de sumir calada.
 */
export async function estilo(page: Page): Promise<string> {
  return await page.evaluate(() =>
    Array.from(document.styleSheets)
      .map((folha) => {
        try {
          return Array.from(folha.cssRules)
            .map((regra) => regra.cssText)
            .join('\n')
        } catch {
          return `/* folha ilegivel: ${folha.href ?? '<sem href>'} */`
        }
      })
      .join('\n/* --- */\n'),
  )
}

/**
 * O pixel de cada `<canvas>`, que e a unica parte da tela que so existe em bitmap.
 */
export async function canvas(page: Page): Promise<Record<string, string>> {
  return await page.evaluate(() => {
    const caminho = (alvo: Element): string => {
      const degraus: string[] = []
      let no: Element | null = alvo
      while (no !== null && no !== document.body) {
        const atual: Element = no
        const pai: Element | null = atual.parentElement
        const irmaos =
          pai === null ? [atual] : Array.from(pai.children).filter((f) => f.tagName === atual.tagName)
        degraus.unshift(`${atual.tagName.toLowerCase()}:nth-of-type(${irmaos.indexOf(atual) + 1})`)
        no = pai
      }
      return degraus.join(' > ')
    }

    const saida: Record<string, string> = {}
    for (const alvo of Array.from(document.querySelectorAll('canvas'))) {
      const base = alvo.id !== '' ? `#${alvo.id}` : caminho(alvo)
      // Dois ids iguais sao HTML invalido que acontece, e a segunda chave apagaria a
      // primeira sem ninguem perceber que um canvas saiu da prova.
      let chave = base
      for (let n = 2; saida[chave] !== undefined; n++) chave = `${base} (${n})`
      saida[chave] = alvo.toDataURL()
    }
    return saida
  })
}
