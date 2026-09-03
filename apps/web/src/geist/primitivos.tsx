/**
 * Os primitivos do Geist vestidos com a paleta EM Vidros. O desenho de cada um esta em
 * `var/design-dashboard/build.mjs`, que e a especificacao; aqui eles viram componente e
 * as medidas viram classe em `geist.css`.
 *
 * Nada neste diretorio conhece viagem, rota, base ou registro. O `Tom` e a unica palavra
 * de dominio que atravessa, e ela e visual: e a faixa em que um numero caiu, e nao o que
 * o numero mede. Quem traduz indicador em tom e `dashboard/dominio.ts`.
 *
 * A `Grade` recebe as celulas como dado e nao como filhos porque a guia da direita e a
 * cruz da interseccao dependem de saber onde a celula termina nas 12 colunas. Com filhos
 * seria preciso ler `grid-column` de volta do JSX, e o tipo `Coluna` deixa de conseguir
 * recusar o `"1/14"` que estoura o grid em silencio.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { ArrowRight, CheckCircle, ChevronDown, Icone, Information, MagnifyingGlass, Warning } from './icones.tsx'
import type { Desenho } from './icones.tsx'

/** A faixa em que um numero caiu. Vira cor de ponto, de texto e de selo. */
export type Tom = 'ok' | 'atencao' | 'critico'

export type CorDeBadge = 'cinza' | 'teal' | 'verde' | 'ambar' | 'vermelho'

const CLASSE_DO_TOM: Readonly<Record<Tom, string>> = {
  ok: 'g-tom-ok',
  atencao: 'g-tom-atencao',
  critico: 'g-tom-critico',
}

const PONTO_DO_TOM: Readonly<Record<Tom, string>> = {
  ok: 'g-ponto-ok',
  atencao: 'g-ponto-atencao',
  critico: 'g-ponto-critico',
}

const ICONE_DO_BADGE: Readonly<Record<CorDeBadge, Desenho | null>> = {
  cinza: null,
  teal: Information,
  verde: CheckCircle,
  ambar: Warning,
  vermelho: Warning,
}

/** Junta o que sobrou depois dos falsos. Devolve `undefined` para nao escrever `class=""`. */
function classes(...partes: ReadonlyArray<string | false | null | undefined>): string | undefined {
  const juntas = partes.filter((p): p is string => typeof p === 'string' && p !== '').join(' ')
  return juntas === '' ? undefined : juntas
}

// ---------- botao, badge, link ----------

type Aparencia = {
  readonly rotulo?: ReactNode
  readonly tipo?: 'primario' | 'secundario' | 'terciario'
  readonly antes?: Desenho
  readonly depois?: Desenho
  readonly tamanho?: 'pequeno' | 'medio'
  /** Obrigatorio no botao so de icone, que nao tem texto para o leitor de tela ler. */
  readonly nome?: string
}

/**
 * `href` ou `aoClicar`, nunca os dois. Um botao que navega e um `<a>` de verdade, com
 * menu de contexto e botao do meio funcionando; um que age e um `<button>`.
 */
export type BotaoProps = Aparencia & ({ readonly href: string } | { readonly aoClicar: () => void })

function classeDoBotao({ tipo = 'secundario', tamanho = 'pequeno', rotulo }: Aparencia): string | undefined {
  return classes(
    'g-botao',
    `g-botao-${tipo}`,
    tamanho === 'medio' && 'g-botao-medio',
    rotulo === undefined && 'g-botao-quadrado',
  )
}

function miolo({ rotulo, antes, depois }: Aparencia): ReactNode {
  return (
    <>
      {antes === undefined ? null : <Icone de={antes} />}
      {rotulo === undefined ? null : <span>{rotulo}</span>}
      {depois === undefined ? null : <Icone de={depois} />}
    </>
  )
}

export function Botao(props: BotaoProps): JSX.Element {
  const conteudo = miolo(props)
  const classe = classeDoBotao(props)
  if ('href' in props) {
    return <a className={classe} href={props.href} aria-label={props.nome}>{conteudo}</a>
  }
  return (
    <button type="button" className={classe} onClick={props.aoClicar} aria-label={props.nome}>
      {conteudo}
    </button>
  )
}

export function Badge({ rotulo, cor = 'cinza', comIcone = true }: {
  readonly rotulo: ReactNode
  readonly cor?: CorDeBadge
  readonly comIcone?: boolean
}): JSX.Element {
  const icone = ICONE_DO_BADGE[cor]
  return (
    <span className={`g-badge g-badge-${cor}`}>
      {comIcone && icone !== null ? <Icone de={icone} tamanho={12} /> : null}
      <span>{rotulo}</span>
    </span>
  )
}

export function Link({ href, children }: { readonly href: string; readonly children: ReactNode }): JSX.Element {
  return (
    <a className="g-link" href={href}>
      {children}
      <Icone de={ArrowRight} tamanho={14} />
    </a>
  )
}

// ---------- menu, seletor, abas, entrada ----------

export type ItemDeMenu = { readonly rotulo: string; readonly aoEscolher: () => void }

/**
 * O painel fecha no clique de fora e no Escape. O ouvinte so existe enquanto o menu esta
 * aberto, e ele escuta na fase de captura porque o clique no proprio gatilho tem que
 * chegar como alternancia, e nao como fechar seguido de abrir.
 */
export function Menu({ gatilho, itens, nome, aparencia = 'botao', direcao = 'abaixo' }: {
  readonly gatilho: ReactNode
  readonly itens: readonly ItemDeMenu[]
  readonly nome: string
  /** `switcher` e a linha de 48 px da sidebar; as outras duas sao o botao de 32. */
  readonly aparencia?: 'botao' | 'quadrado' | 'switcher'
  readonly direcao?: 'abaixo' | 'acima'
}): JSX.Element {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const foraDaqui = (evento: MouseEvent): void => {
      const alvo = evento.target
      if (alvo instanceof Node && caixa.current?.contains(alvo) === true) return
      setAberto(false)
    }
    const noEscape = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', foraDaqui, true)
    document.addEventListener('keydown', noEscape)
    return () => {
      document.removeEventListener('mousedown', foraDaqui, true)
      document.removeEventListener('keydown', noEscape)
    }
  }, [aberto])

  const naSidebar = aparencia === 'switcher'
  return (
    <div className={classes('g-menu', naSidebar && 'g-menu-largo')} ref={caixa}>
      <button
        type="button"
        className={naSidebar
          ? 'g-switcher'
          : classes('g-botao', 'g-botao-secundario', aparencia === 'quadrado' && 'g-botao-quadrado')}
        aria-label={nome}
        aria-expanded={aberto}
        aria-haspopup="menu"
        onClick={() => setAberto((estava) => !estava)}
      >
        {gatilho}
      </button>
      {aberto
        ? (
          <div
            className={classes(
              'g-menu-painel',
              naSidebar && 'g-menu-painel-largo',
              direcao === 'acima' && 'g-menu-painel-acima',
            )}
            role="menu"
          >
            {itens.map((item) => (
              <button
                key={item.rotulo}
                type="button"
                role="menuitem"
                className="g-menu-item"
                onClick={() => {
                  setAberto(false)
                  item.aoEscolher()
                }}
              >
                {item.rotulo}
              </button>
            ))}
          </div>
        )
        : null}
    </div>
  )
}

export type Opcao = { readonly valor: string; readonly rotulo: string }

export function Seletor({ rotulo, valor, opcoes, aoEscolher }: {
  readonly rotulo: string
  readonly valor: string
  readonly opcoes: readonly Opcao[]
  readonly aoEscolher: (valor: string) => void
}): JSX.Element {
  const escolhida = opcoes.find((o) => o.valor === valor)
  return (
    <Menu
      nome={rotulo}
      gatilho={
        <>
          <span className="g-seletor-rotulo">{rotulo}</span>
          <span>{escolhida?.rotulo ?? valor}</span>
          <Icone de={ChevronDown} />
        </>
      }
      itens={opcoes.map((o) => ({ rotulo: o.rotulo, aoEscolher: () => aoEscolher(o.valor) }))}
    />
  )
}

export function Abas({ itens, ativa, aoTrocar }: {
  readonly itens: readonly string[]
  readonly ativa: number
  readonly aoTrocar: (indice: number) => void
}): JSX.Element {
  return (
    <div className="g-abas" role="tablist">
      {itens.map((item, i) => (
        <button
          key={item}
          type="button"
          role="tab"
          className="g-aba"
          aria-selected={i === ativa}
          onClick={() => aoTrocar(i)}
        >
          {item}
          {i === ativa ? <span className="g-aba-linha" /> : null}
        </button>
      ))}
    </div>
  )
}

export function Entrada({ marcador, valor, aoDigitar, largura }: {
  readonly marcador: string
  readonly valor: string
  readonly aoDigitar: (valor: string) => void
  /** A largura e do lugar onde a entrada esta, e nao do primitivo. */
  readonly largura?: number
}): JSX.Element {
  return (
    <div className="g-entrada" style={largura === undefined ? undefined : { width: `${largura}px` }}>
      <Icone de={MagnifyingGlass} />
      <input
        className="g-entrada-campo"
        type="search"
        placeholder={marcador}
        value={valor}
        onChange={(e) => aoDigitar(e.currentTarget.value)}
      />
    </div>
  )
}

// ---------- grid de 12 colunas ----------

/**
 * A borda de uma coluna do grid de 12: comeca em 1 e termina em 13, que e o fim da
 * decima segunda. Este tipo existe para `[1, 14]` nao compilar; um span que passa das 12
 * nao desenha erro nenhum, so empurra a celula para uma linha implicita que ninguem pediu.
 */
export type Coluna = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export type Celula = {
  /** Inicio e fim exclusivo, como o `grid-column` escreve. */
  readonly col: readonly [Coluna, Coluna]
  readonly linha: number
  /** Zero na celula que traz cabecalho e tabela proprios. */
  readonly rente?: boolean
  readonly conteudo: ReactNode
}

function Cruz({ onde }: { readonly onde: 'topo' | 'base' }): JSX.Element {
  return (
    <svg className={`g-cruz g-cruz-${onde}`} width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <path d="M8.5 0v17M0 8.5h17" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function Grade({ celulas }: { readonly celulas: readonly Celula[] }): JSX.Element {
  const ultima = celulas.reduce((maior, c) => Math.max(maior, c.linha), 1)
  return (
    <div className="g-grade">
      {celulas.map(({ col, linha, rente = false, conteudo }) => {
        const [inicio, fim] = col
        return (
          <div
            key={`${linha}:${inicio}`}
            className={classes(
              'g-celula',
              rente && 'g-celula-rente',
              fim <= 12 && 'g-celula-direita',
              linha < ultima && 'g-celula-abaixo',
            )}
            style={{ gridColumn: `${inicio}/${fim}`, gridRow: linha }}
          >
            {inicio > 1 ? <Cruz onde="topo" /> : null}
            {inicio > 1 && linha === ultima ? <Cruz onde="base" /> : null}
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}

// ---------- tabela ----------

export function Tabela({ cabecalho, children }: {
  readonly cabecalho: ReactNode
  readonly children: ReactNode
}): JSX.Element {
  return (
    <table className="g-tabela">
      <thead><tr>{cabecalho}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function Th({ children, direita = false }: {
  readonly children: ReactNode
  readonly direita?: boolean
}): JSX.Element {
  return <th className={direita ? 'g-direita' : undefined}>{children}</th>
}

export function Td({ children, direita = false, colunas, vazio = false }: {
  readonly children: ReactNode
  readonly direita?: boolean
  readonly colunas?: number
  readonly vazio?: boolean
}): JSX.Element {
  return (
    <td className={classes(direita && 'g-direita', vazio && 'g-vazio')} colSpan={colunas}>
      {children}
    </td>
  )
}

// ---------- KPI, estatistica, cabecalhos ----------

export type Delta = { readonly icone: Desenho; readonly texto: string; readonly tom: Tom }

export function Kpi({ rotulo, valor, grande = false, delta, apoio, meta, sparkline }: {
  readonly rotulo: string
  readonly valor: string
  readonly grande?: boolean
  readonly delta?: Delta
  readonly apoio: string
  readonly meta: { readonly texto: string; readonly tom: Tom }
  readonly sparkline?: ReactNode
}): JSX.Element {
  return (
    <div className="g-kpi">
      <div className="g-kpi-rotulo">{rotulo}</div>
      <div className="g-kpi-linha">
        <div className={classes(grande ? 'g-h40' : 'g-h32', 'g-tab')}>{valor}</div>
        {sparkline}
      </div>
      <div className="g-kpi-apoio">
        {delta === undefined
          ? null
          : (
            <>
              <span className={CLASSE_DO_TOM[delta.tom]}><Icone de={delta.icone} tamanho={14} /></span>
              <span className={classes('g-forte', 'g-tab', CLASSE_DO_TOM[delta.tom])}>{delta.texto}</span>
            </>
          )}
        <span>{apoio}</span>
      </div>
      <div className="g-kpi-meta">
        <span className={`g-ponto ${PONTO_DO_TOM[meta.tom]}`} />
        <span>{meta.texto}</span>
      </div>
    </div>
  )
}

export function Estatistica({ rotulo, valor, apoio }: {
  readonly rotulo: string
  readonly valor: string
  readonly apoio: string
}): JSX.Element {
  return (
    <>
      <div className="g-estat-rotulo">{rotulo}</div>
      <div className="g-estat-valor g-h32 g-tab">{valor}</div>
      <div className="g-estat-apoio">{apoio}</div>
    </>
  )
}

export function CabecalhoDePagina({ titulo, subtitulo, acoes }: {
  readonly titulo: string
  readonly subtitulo: string
  readonly acoes: ReactNode
}): JSX.Element {
  return (
    <div className="g-cabecalho-pagina">
      <div>
        <div className="g-cabecalho-titulo g-h24">{titulo}</div>
        <div className="g-cabecalho-sub g-c13">{subtitulo}</div>
      </div>
      <div className="g-cabecalho-acoes">{acoes}</div>
    </div>
  )
}

export function CabecalhoDeBloco({ titulo, subtitulo, direita, rente = false }: {
  readonly titulo: string
  readonly subtitulo?: string
  readonly direita?: ReactNode
  /** Sem recuo proprio, para quando a celula do grid ja recua. */
  readonly rente?: boolean
}): JSX.Element {
  return (
    <div className={classes('g-bloco', rente && 'g-bloco-rente')}>
      <div>
        <div className="g-bloco-titulo g-h16">{titulo}</div>
        {subtitulo === undefined ? null : <div className="g-bloco-sub g-l13">{subtitulo}</div>}
      </div>
      {direita}
    </div>
  )
}
