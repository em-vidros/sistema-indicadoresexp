/**
 * A casca do app: sidebar inset sobre a pagina, e o conteudo num painel com margem, raio
 * 12 e ring. O desenho esta em `var/design-dashboard/build.mjs`.
 *
 * Ela e montada uma vez, fora do `Suspense`, e nao volta a montar quando a tela troca. E
 * isso que faz a sidebar nao piscar entre Visao geral e Viagens: o mesmo elemento continua
 * ali, so o miolo do painel e substituido.
 *
 * Os dez itens saem de `app/rotas.ts` e nao de uma lista propria. Uma linha nova la ja
 * nasce navegavel, destacavel e no grupo certo, sem tocar em nada aqui.
 *
 * Cada item e um `<a href>` de verdade dentro de `Ligacao`: clique simples navega sem
 * recarregar, e abrir em aba nova, copiar o link e o botao do meio continuam sendo o que o
 * navegador faz com um link. Passar o mouse ou o foco por cima ja traz o pedaco de
 * JavaScript da tela e, nas do Painel, os registros; quando o clique chega, nao ha o que
 * esperar.
 *
 * Este e o unico arquivo de `geist/` que conhece base, e a razao e o switcher: ele tem que
 * dizer qual base a tela esta mostrando. Nas rotas do Painel a base vem da query, porque e
 * ela quem filtra; nas outras vem da sessao, porque ali a base e so onde a pessoa trabalha.
 *
 * O que o canvas desenha e nao esta aqui, por decisao registrada na sintese: a linha de
 * busca ⌘K, porque caixa de busca que nao busca e mentira desenhada, e o ponto ambar de
 * Documentos, porque nao ha fonte de dado para ele.
 */
import type { JSX, ReactNode } from 'react'
import { prefetchar as prefetcharDados, useSessao } from '../app/dados.ts'
import type { Sessao } from '../app/dados.ts'
import { Ligacao, navegar, prefetchar as prefetcharRota, useLocalizacao } from '../app/navegacao.tsx'
import { GRUPOS, ROTAS, rotaDe } from '../app/rotas.ts'
import type { Rota } from '../app/rotas.ts'
import { BASES, OPCOES_DE_BASE, consultaDe, lerFiltros } from '../dashboard/filtros.ts'
import { listarRegistros } from '../js/registros-api.ts'
import simbolo from './em-simbolo.svg'
import { ArrowUpDown, Icone } from './icones.tsx'
import { Menu } from './primitivos.tsx'
import type { ItemDeMenu } from './primitivos.tsx'
import './geist.css'

function sair(): void {
  // Tem que sair mesmo se a chamada falhar, senao quem clicou fica preso na tela.
  void fetch('/api/sair', { method: 'POST' }).finally(() => {
    window.location.href = '/entrar.html'
  })
}

/**
 * Primeira e ultima palavra do nome. Nome de uma palavra so vira as duas primeiras letras.
 *
 * So palavra que comeca por letra conta. O nome da Livia no seed e "Livia (Admin)", e sem
 * este filtro o avatar dela sairia "L(".
 */
function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p))
  const primeira = palavras[0]
  const ultima = palavras[palavras.length - 1]
  if (primeira === undefined || ultima === undefined) return '—'
  if (palavras.length === 1) return primeira.slice(0, 2).toUpperCase()
  return `${primeira[0] ?? ''}${ultima[0] ?? ''}`.toUpperCase()
}

/** A base em que a pessoa trabalha. O admin nao tem uma, e ve todas. */
function areaDe(sessao: Sessao): string {
  return sessao.baseFixa ?? 'Todas as bases'
}

type Switcher = { readonly rotulo: string; readonly itens: readonly ItemDeMenu[] }

/**
 * Nas telas do Painel o switcher e o filtro de base, e escolher reescreve a query. Nas
 * outras ele mostra onde a pessoa trabalha, e escolher leva ao Painel ja filtrado por
 * aquela base; base que o Painel nao conhece cai em "Todas", que e o que `lerFiltros` faz
 * com qualquer valor de fora.
 */
function switcherDe(rota: Rota | null, busca: string, sessao: Sessao | null): Switcher {
  if (rota !== null && rota.comFiltros) {
    const filtros = lerFiltros(busca)
    return {
      rotulo: BASES[filtros.base].naCasca,
      itens: OPCOES_DE_BASE.map((opcao) => ({
        rotulo: opcao.rotulo,
        aoEscolher: () => navegar(rota.caminho + consultaDe({ ...filtros, base: opcao.valor })),
      })),
    }
  }
  return {
    rotulo: sessao === null ? '—' : areaDe(sessao),
    itens: (sessao?.bases ?? []).map((base) => ({
      rotulo: base,
      aoEscolher: () => navegar(`/visao-geral?base=${encodeURIComponent(base)}&periodo=semana`),
    })),
  }
}

function Item({ rota, ativa, consulta }: {
  readonly rota: Rota
  readonly ativa: boolean
  /** A query dos filtros, com `?`. So as telas do Painel a levam no href. */
  readonly consulta: string
}): JSX.Element {
  const aquecer = (): void => {
    prefetcharRota(rota.id)
    if (rota.comFiltros) prefetcharDados('registros', listarRegistros)
  }
  return (
    <Ligacao
      className="g-item"
      para={rota.comFiltros ? rota.caminho + consulta : rota.caminho}
      aria-current={ativa ? 'page' : undefined}
      onMouseEnter={aquecer}
      onFocus={aquecer}
    >
      <Icone de={rota.icone} />
      <span className="g-item-rotulo">{rota.titulo}</span>
    </Ligacao>
  )
}

export function Casca({ children }: { readonly children: ReactNode }): JSX.Element {
  const { caminho, busca } = useLocalizacao()
  const sessao = useSessao()
  const rota = rotaDe(caminho)
  const consulta = consultaDe(lerFiltros(busca))
  const switcher = switcherDe(rota, busca, sessao.dados)

  return (
    <div className="g-app">
      <aside className="g-trilho">
        <Menu
          nome="Base"
          gatilho={
            <>
              <span className="g-marca"><img className="g-marca-simbolo" src={simbolo} alt="EM Vidros" /></span>
              <span className="g-identidade">
                <span className="g-identidade-nome">EM Vidros</span>
                <span className="g-identidade-apoio">{switcher.rotulo}</span>
              </span>
              <Icone de={ArrowUpDown} />
            </>
          }
          itens={switcher.itens}
          aparencia="switcher"
        />

        <nav className="g-nav">
          {GRUPOS.map((grupo) => (
            <div className="g-grupo" key={grupo}>
              <div className="g-grupo-rotulo">{grupo}</div>
              {ROTAS.filter((r) => r.grupo === grupo).map((r) => (
                <Item key={r.id} rota={r} ativa={r.id === rota?.id} consulta={consulta} />
              ))}
            </div>
          ))}
        </nav>

        <Menu
          nome="Conta"
          gatilho={
            <>
              <span className="g-avatar">{sessao.dados === null ? '—' : iniciaisDe(sessao.dados.nome)}</span>
              <span className="g-identidade">
                <span className="g-identidade-nome">{sessao.dados?.nome ?? 'Carregando'}</span>
                <span className="g-identidade-apoio">{sessao.dados === null ? '' : areaDe(sessao.dados)}</span>
              </span>
              <Icone de={ArrowUpDown} />
            </>
          }
          itens={[{ rotulo: 'Sair', aoEscolher: sair }]}
          aparencia="switcher"
          direcao="acima"
        />
      </aside>

      <main className="g-painel">
        <div className="g-painel-corpo">{children}</div>
      </main>
    </div>
  )
}
