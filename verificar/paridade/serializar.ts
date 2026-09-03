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

/**
 * Uma linha por no, dois espacos por profundidade, `document.body` na raiz.
 *
 * `recortes` sao os seletores de `fora-da-prova.ts`: o elemento que casa continua com
 * todos os atributos dele e o conteudo vira uma linha so. Le o porque la, nao aqui.
 */
export async function serializarDom(page: Page, recortes: readonly string[]): Promise<string> {
  return await page.evaluate((recortes: readonly string[]) => {
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

        // `selected` no `<option>` e a escolha inicial escrita no markup, e quem desenha
        // e a propriedade, que sai adiante como `@selected`. Sao a mesma informacao em
        // dois lugares, e so um deles sobrevive ao porte: o React escreve a propriedade
        // e nunca o atributo. Guardar o atributo seria cobrar a forma de escrever.
        if (attr.name === 'selected' && el instanceof HTMLOptionElement) continue

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

      if (recortes.some((seletor) => no.matches(seletor))) {
        linhas.push(`${'  '.repeat(nivel + 1)}<fora da prova>`)
        return
      }

      for (const filho of Array.from(no.childNodes)) visitar(filho, nivel + 1)
    }

    visitar(document.body, 0)
    return `${linhas.join('\n')}\n`
  }, recortes)
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
 * O que o CSS de hoje desenha, comparado com o que o CSS congelado desenhava.
 *
 * `estilo.css` compara o texto da folha, e texto igual e prova forte enquanto ninguem
 * mexe na folha de proposito. A fase 3 mexe: o mesmo desenho passa a sair de arquivos
 * compartilhados, e o texto muda em toda tela. A pergunta deixa de ser "a folha e a
 * mesma" e passa a ser "a folha nova pinta o que a velha pintava", que so o navegador
 * responde.
 *
 * O percurso e este. Le o estilo computado de cada elemento com a folha de hoje, troca
 * as folhas pela referencia congelada, le de novo, e devolve o que divergiu. As duas
 * leituras e as duas trocas acontecem dentro de um `evaluate` so, sem `await` no meio:
 * o navegador nao pinta quadro nenhum entre elas, entao nenhuma transicao dispara e a
 * pagina volta ao estado exato em que estava para o proximo passo do roteiro.
 *
 * Propriedade custom fica de fora. Ela nao desenha por si, e a fase 3 poe a uniao das
 * variaveis em toda tela de proposito: uma tela que ganha `--yellow` sem usar em lugar
 * nenhum pinta igual, e reprovar por isso seria reprovar a consolidacao que a fase
 * pede. Quando a variavel e usada, quem muda e a propriedade que a consome, e essa
 * esta na comparacao.
 *
 * `::before` e `::after` entram porque desenham, e uma tela daqui usa `::after` para a
 * barra do titulo de secao.
 */
export async function diferencasDeDesenho(
  page: Page,
  referencia: string,
): Promise<{ readonly elementos: number; readonly achados: readonly string[] }> {
  return await page.evaluate((referencia: string) => {
    const PULADAS = new Set(['SCRIPT', 'LINK', 'STYLE', 'NOSCRIPT'])
    const PSEUDOS: readonly (string | null)[] = [null, '::before', '::after']
    // Enraizado no `body`, como o percurso do DOM, e pelo mesmo motivo: nada dentro do
    // `<head>` desenha. E ha um motivo a mais aqui. Desligar as folhas para ler a
    // referencia faz o Chromium reserializar a fonte padrao do navegador, que sai
    // `Times` com folha e `"Times New Roman"` sem nenhuma. Isso alcanca exatamente os
    // elementos que nenhuma regra veste, `html`, `head`, `meta` e `title`, e apareceria
    // como 15 divergencias que nao desenham pixel nenhum. `:root` esta fora junto, e
    // nao custa nada: o bloco dele so declara variavel, e variavel ja esta fora.
    const alvos = [document.body, ...Array.from(document.body.querySelectorAll('*'))].filter(
      (el) => !PULADAS.has(el.tagName),
    )

    const ler = (): string[][] =>
      alvos.flatMap((el) =>
        PSEUDOS.map((pseudo) => {
          const cs = getComputedStyle(el, pseudo)
          const valores: string[] = []
          for (let i = 0; i < cs.length; i++) {
            const prop = cs[i]!
            if (prop.startsWith('--')) continue
            valores.push(`${prop}:${cs.getPropertyValue(prop)}`)
          }
          return valores
        }),
      )

    const agora = ler()
    const folhas = Array.from(document.styleSheets).filter((f) => !f.disabled)
    for (const folha of folhas) folha.disabled = true
    const injetada = document.createElement('style')
    injetada.textContent = referencia
    document.head.append(injetada)
    const antes = ler()
    injetada.remove()
    for (const folha of folhas) folha.disabled = false

    const ondeEsta = (indice: number): string => {
      const el = alvos[Math.floor(indice / PSEUDOS.length)]!
      const pseudo = PSEUDOS[indice % PSEUDOS.length] ?? ''
      const classe = typeof el.className === 'string' && el.className !== '' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''
      return `${Math.floor(indice / PSEUDOS.length)} ${el.tagName.toLowerCase()}${classe}${pseudo}`
    }

    const achados: string[] = []
    for (let i = 0; i < Math.max(agora.length, antes.length); i++) {
      const a = antes[i] ?? []
      const b = agora[i] ?? []
      for (let j = 0; j < Math.max(a.length, b.length); j++) {
        if (a[j] === b[j]) continue
        achados.push(`${ondeEsta(i)}: referencia ${a[j] ?? '<sem a propriedade>'}, agora ${b[j] ?? '<sem a propriedade>'}`)
      }
    }
    return { elementos: alvos.length, achados }
  }, referencia)
}
