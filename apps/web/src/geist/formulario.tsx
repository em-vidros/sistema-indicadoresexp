/**
 * Os primitivos de formulario do Geist com a paleta EM Vidros. O desenho de cada um esta
 * na secao "Formulario" de `var/design-dashboard/build.mjs`, que e a especificacao; aqui
 * eles viram componente e as medidas viram classe em `geist.css`.
 *
 * Eles vivem fora de `primitivos.tsx` por tamanho, e nao por natureza: sao o mesmo sistema
 * visual, e as duas folhas sao a mesma.
 *
 * `Campo` e um componente so com um `tipo`, e nao sete componentes. Os sete desenham a
 * mesma caixa de 40 px com o mesmo rotulo e o mesmo ring; o que muda e o que entra dentro
 * dela. Com sete componentes, mudar a altura da caixa seria mudar sete arquivos, e o
 * setimo ficaria para tras.
 *
 * As props sao controladas: quem tem o valor e quem chama. Um campo com estado proprio
 * teria duas verdades sobre o mesmo dado, e a que aparece na tela seria a errada sempre
 * que o formulario recalculasse alguma coisa.
 */
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, JSX, ReactNode, RefObject } from 'react'
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CloudUpload,
  Cross,
  FileText,
  Icone,
  LockClosed,
} from './icones.tsx'
import type { Desenho } from './icones.tsx'
import { Botao, classes } from './primitivos.tsx'
import type { Opcao } from './primitivos.tsx'

/** Quantas das 12 colunas o campo ocupa. O tipo recusa o 13 que estoura a grade. */
export type Vao = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type TipoDeCampo = 'texto' | 'numero' | 'select' | 'data' | 'hora' | 'dinheiro' | 'calculado'

type Comum = {
  readonly rotulo: string
  readonly valor: string
  readonly span?: Vao
  /** Placa, odometro, dinheiro: o que se compara coluna a coluna. */
  readonly mono?: boolean
  readonly dica?: string
  readonly obrigatorio?: boolean
  /** A mensagem embaixo do campo. Pinta o ring de vermelho enquanto existir. */
  readonly erro?: string
}

type Editavel = Comum & { readonly aoMudar: (valor: string) => void }

/**
 * O `select` exige `opcoes` e o `calculado` recusa `aoMudar`, e as duas coisas sao do
 * tipo, nao de uma checagem em runtime: campo calculado com `onChange` e um valor que a
 * pessoa pode editar e o formulario vai sobrescrever no proximo render.
 */
export type CampoProps =
  | (Editavel & { readonly tipo?: 'texto' | 'numero' | 'data' | 'hora' | 'dinheiro' })
  | (Editavel & { readonly tipo: 'select'; readonly opcoes: readonly Opcao[] })
  | (Comum & { readonly tipo: 'calculado' })

const ENTRADA_DO_TIPO: Readonly<Record<'texto' | 'numero' | 'data' | 'hora' | 'dinheiro', string>> = {
  texto: 'text',
  numero: 'number',
  data: 'date',
  hora: 'time',
  dinheiro: 'text',
}

/**
 * O icone que abre o calendario ou o relogio nativo.
 *
 * O indicador que o navegador desenha sozinho fica escondido no CSS, porque o desenho poe
 * o icone a esquerda e dois icones de calendario na mesma caixa e desenho errado. Sem este
 * botao, esconder o indicador tiraria o unico jeito de abrir o seletor com o mouse.
 */
function Gatilho({ de, campo, nome }: {
  readonly de: Desenho
  readonly campo: RefObject<HTMLInputElement | null>
  readonly nome: string
}): JSX.Element {
  return (
    <button
      type="button"
      className="g-caixa-gatilho"
      aria-label={nome}
      tabIndex={-1}
      onClick={() => {
        const entrada = campo.current
        if (entrada === null) return
        if (typeof entrada.showPicker === 'function') entrada.showPicker()
        else entrada.focus()
      }}
    >
      <Icone de={de} />
    </button>
  )
}

export function Campo(props: CampoProps): JSX.Element {
  const { rotulo, valor, span = 4, mono = false, dica, obrigatorio = false, erro } = props
  const id = useId()
  const campo = useRef<HTMLInputElement>(null)
  const idDoErro = `${id}-erro`

  // A narracao e sobre `props.tipo` e nao sobre a variavel `tipo`: o TypeScript so estreita
  // a uniao pela propria propriedade discriminante, e por uma copia dela ele nao estreita.
  const dentro = ((): ReactNode => {
    if (props.tipo === 'select') {
      return (
        <>
          <select
            id={id}
            className={classes('g-campo-entrada', 'g-campo-select', mono && 'g-l14m')}
            value={valor}
            required={obrigatorio}
            aria-invalid={erro === undefined ? undefined : true}
            aria-describedby={erro === undefined ? undefined : idDoErro}
            onChange={(e) => props.aoMudar(e.currentTarget.value)}
          >
            {dica === undefined ? null : <option value="">{dica}</option>}
            {props.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          <Icone de={ChevronDown} />
        </>
      )
    }

    if (props.tipo === 'calculado') {
      return (
        <>
          <input
            id={id}
            className={classes('g-campo-entrada', mono && 'g-l14m')}
            type="text"
            value={valor}
            placeholder={dica}
            readOnly
            tabIndex={-1}
          />
          <span className="g-campo-cadeado"><Icone de={LockClosed} /></span>
        </>
      )
    }

    const entrada = (
      <input
        id={id}
        ref={campo}
        className={classes('g-campo-entrada', mono && 'g-l14m')}
        type={ENTRADA_DO_TIPO[props.tipo ?? 'texto']}
        value={valor}
        placeholder={dica}
        required={obrigatorio}
        aria-invalid={erro === undefined ? undefined : true}
        aria-describedby={erro === undefined ? undefined : idDoErro}
        onChange={(e) => props.aoMudar(e.currentTarget.value)}
      />
    )

    if (props.tipo === 'data') return <><Gatilho de={Calendar} campo={campo} nome="Escolher data" />{entrada}</>
    if (props.tipo === 'hora') return <><Gatilho de={Clock} campo={campo} nome="Escolher hora" />{entrada}</>
    if (props.tipo === 'dinheiro') return <><span className="g-campo-prefixo">R$</span>{entrada}</>
    return entrada
  })()

  return (
    <div className="g-campo [grid-column:var(--campo-coluna)]!" style={{ '--campo-coluna': `span ${span}` } as CSSProperties}>
      <label className="g-campo-rotulo" htmlFor={id}>
        {rotulo}
        {obrigatorio ? <span className="g-campo-marca" aria-hidden="true">*</span> : null}
      </label>
      <div
        className={classes(
          'g-caixa',
          props.tipo === 'calculado' && 'g-caixa-calculada',
          erro !== undefined && 'g-caixa-errada',
        )}
      >
        {dentro}
      </div>
      {erro === undefined ? null : <div className="g-campo-erro" id={idDoErro}>{erro}</div>}
    </div>
  )
}

const TEXTO_PADRAO = 'Arraste o PDF ou clique · máx 6 MB'

/**
 * A caixa tracejada de 48 px que recebe um arquivo, por clique ou por arraste.
 *
 * O `<input type=file>` fica escondido e e disparado pelo botao, porque a caixa desenhada
 * nao e um input e nao ha como estilizar o nativo ate esta forma.
 */
export function CampoDeArquivo({ rotulo, span = 6, texto = TEXTO_PADRAO, aceita, arquivo, aoEscolher }: {
  readonly rotulo: string
  readonly span?: Vao
  /** O texto de dentro quando nao ha arquivo. */
  readonly texto?: string
  /** O `accept` do input, por exemplo `application/pdf`. */
  readonly aceita?: string
  /** O nome do arquivo ja escolhido, quando ha um. */
  readonly arquivo?: string
  readonly aoEscolher: (arquivo: File) => void
}): JSX.Element {
  const id = useId()
  const entrada = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)

  const receber = (lista: FileList | null): void => {
    const primeiro = lista?.[0]
    if (primeiro !== undefined) aoEscolher(primeiro)
  }

  return (
    <div className="g-campo [grid-column:var(--campo-coluna)]!" style={{ '--campo-coluna': `span ${span}` } as CSSProperties}>
      <span className="g-campo-rotulo">{rotulo}</span>
      <div
        className={classes('g-arquivo', sobre && 'g-arquivo-sobre')}
        onDragOver={(e) => {
          e.preventDefault()
          setSobre(true)
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSobre(false)
          receber(e.dataTransfer.files)
        }}
      >
        <Icone de={CloudUpload} />
        <span className="g-arquivo-texto">{arquivo ?? texto}</span>
        <Botao rotulo="Escolher" aoClicar={() => entrada.current?.click()} />
        <input
          id={id}
          ref={entrada}
          className="g-escondido"
          type="file"
          accept={aceita}
          onChange={(e) => receber(e.currentTarget.files)}
        />
      </div>
    </div>
  )
}

export function AreaDeTexto({ rotulo, valor, aoMudar, span = 12, dica, obrigatorio = false, erro }: {
  readonly rotulo: string
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  readonly span?: Vao
  readonly dica?: string
  readonly obrigatorio?: boolean
  readonly erro?: string
}): JSX.Element {
  const id = useId()
  const idDoErro = `${id}-erro`
  return (
    <div className="g-campo [grid-column:var(--campo-coluna)]!" style={{ '--campo-coluna': `span ${span}` } as CSSProperties}>
      <label className="g-campo-rotulo" htmlFor={id}>{rotulo}</label>
      <textarea
        id={id}
        className={classes('g-area', erro !== undefined && 'g-caixa-errada')}
        value={valor}
        placeholder={dica}
        required={obrigatorio}
        aria-invalid={erro === undefined ? undefined : true}
        aria-describedby={erro === undefined ? undefined : idDoErro}
        onChange={(e) => aoMudar(e.currentTarget.value)}
      />
      {erro === undefined ? null : <div className="g-campo-erro" id={idDoErro}>{erro}</div>}
    </div>
  )
}

export function GradeDeCampos({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div className="g-campos">{children}</div>
}

export function TituloDeSecao({ titulo, subtitulo, direita }: {
  readonly titulo: string
  readonly subtitulo?: string
  readonly direita?: ReactNode
}): JSX.Element {
  return (
    <div className="g-secao">
      <div>
        <div className="g-secao-titulo g-h16">{titulo}</div>
        {subtitulo === undefined ? null : <div className="g-secao-sub g-l13">{subtitulo}</div>}
      </div>
      {direita}
    </div>
  )
}

export function Chip({ rotulo, ativo = false, aoClicar }: {
  readonly rotulo: string
  readonly ativo?: boolean
  readonly aoClicar: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={classes('g-chip', ativo && 'g-chip-ativo')}
      aria-pressed={ativo}
      onClick={aoClicar}
    >
      {rotulo}
    </button>
  )
}

/** Escolha unica: sempre ha uma opcao ativa, e clicar em outra troca. */
export function Chips<V extends string>({ valor, opcoes, aoEscolher }: {
  readonly valor: V
  readonly opcoes: readonly Opcao<V>[]
  readonly aoEscolher: (valor: V) => void
}): JSX.Element {
  return (
    <div className="g-chips">
      {opcoes.map((o) => (
        <Chip key={o.valor} rotulo={o.rotulo} ativo={o.valor === valor} aoClicar={() => aoEscolher(o.valor)} />
      ))}
    </div>
  )
}

export function Caixa({ marcado, aoMudar, rotulo }: {
  readonly marcado: boolean
  readonly aoMudar: (marcado: boolean) => void
  readonly rotulo?: ReactNode
}): JSX.Element {
  return (
    <label className="g-caixinha">
      <input
        className="g-escondido"
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.currentTarget.checked)}
      />
      <span className={classes('g-caixinha-marca', marcado && 'g-caixinha-marcada')}>
        {marcado ? <Icone de={Check} tamanho={12} /> : null}
      </span>
      {rotulo === undefined ? null : <span className="g-caixinha-rotulo g-l13">{rotulo}</span>}
    </label>
  )
}

/** Uma linha da lista de conferencia: o que foi feito, e quando. */
export function LinhaDeCheck({ texto, feito, data, aoMudar }: {
  readonly texto: string
  readonly feito: boolean
  /** A data em `DD/MM`, ou nada quando ainda nao aconteceu. */
  readonly data?: string
  readonly aoMudar?: (feito: boolean) => void
}): JSX.Element {
  return (
    <div className="g-check">
      {aoMudar === undefined
        ? (
          <span className={classes('g-caixinha-marca', feito && 'g-caixinha-marcada')}>
            {feito ? <Icone de={Check} tamanho={12} /> : null}
          </span>
        )
        : <Caixa marcado={feito} aoMudar={aoMudar} />}
      <span className={classes('g-check-texto', !feito && 'g-fraco')}>{texto}</span>
      <span className="g-check-data g-l12m">{data ?? '·'}</span>
    </div>
  )
}

export function Barra({ pct, tom = 'teal' }: {
  readonly pct: number
  readonly tom?: 'teal' | 'verde' | 'ambar' | 'vermelho'
}): JSX.Element {
  const preso = Math.max(0, Math.min(100, pct))
  return (
    <div className="g-barra-trilho" role="progressbar" aria-valuenow={Math.round(preso)}>
      <div className={`g-barra-cheia g-barra-${tom} [width:var(--barra-largura)]!`} style={{ '--barra-largura': `${preso}%` } as CSSProperties} />
    </div>
  )
}

export function Assinatura({ nome, cargo }: { readonly nome: string; readonly cargo: string }): JSX.Element {
  return (
    <div className="g-assinatura">
      <div className="g-assinatura-vao" />
      <div className="g-assinatura-linha" />
      <div className="g-assinatura-nome g-l14 g-forte">{nome}</div>
      <div className="g-assinatura-cargo g-l13">{cargo}</div>
    </div>
  )
}

export function LinhaDeArquivo({ titulo, subtitulo, extensao = 'PDF', aoAbrir }: {
  readonly titulo: string
  readonly subtitulo: string
  readonly extensao?: string
  readonly aoAbrir: () => void
}): JSX.Element {
  return (
    <button type="button" className="g-arq" onClick={aoAbrir}>
      <span className="g-arq-icone"><Icone de={FileText} /></span>
      <span className="g-arq-texto">
        <span className="g-arq-titulo g-l14 g-forte">{titulo}</span>
        <span className="g-arq-sub g-l12">{subtitulo}</span>
      </span>
      <span className="g-arq-ext g-l12m">{extensao}</span>
      <Icone de={ArrowRight} />
    </button>
  )
}

export function RodapeDeFormulario({ apoio, acoes }: {
  readonly apoio: string
  readonly acoes: ReactNode
}): JSX.Element {
  return (
    <div className="g-rodape">
      <span className="g-rodape-apoio g-l13">{apoio}</span>
      <div className="g-rodape-acoes">{acoes}</div>
    </div>
  )
}

// ---------- avisos ----------

export type TomDeAviso = 'ok' | 'erro'

type Nota = { readonly id: number; readonly texto: string; readonly tom: TomDeAviso }

/** Quanto tempo o aviso fica na tela antes de sair sozinho. */
const DURACAO = 4000

const Contexto = createContext<((texto: string, tom?: TomDeAviso) => void) | null>(null)

/**
 * Sem provedor, `avisar` cai no console em vez de estourar. Um formulario que salvou
 * direito nao pode falhar por causa da confirmacao do salvamento.
 */
export function useAvisos(): { readonly avisar: (texto: string, tom?: TomDeAviso) => void } {
  const avisar = useContext(Contexto)
  return {
    avisar: avisar ?? ((texto) => {
      console.warn(`aviso sem <Avisos> montado: ${texto}`)
    }),
  }
}

export function Avisos({ children }: { readonly children: ReactNode }): JSX.Element {
  const [notas, setNotas] = useState<readonly Nota[]>([])
  const proximo = useRef(0)

  // O relogio e marcado no proprio `avisar`, e nao num efeito dentro do aviso: com efeito,
  // qualquer render do pai reiniciaria a contagem e o aviso ficaria na tela sem sair.
  const avisar = (texto: string, tom: TomDeAviso = 'ok'): void => {
    proximo.current += 1
    const id = proximo.current
    setNotas((atuais) => [...atuais, { id, texto, tom }])
    setTimeout(() => setNotas((atuais) => atuais.filter((n) => n.id !== id)), DURACAO)
  }

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="g-avisos">
        {notas.map((nota) => (
          <div className={`g-aviso g-aviso-${nota.tom}`} role="status" key={nota.id}>
            {nota.texto}
          </div>
        ))}
      </div>
    </Contexto.Provider>
  )
}

// ---------- dialogo ----------

/**
 * O `<dialog>` nativo com `showModal()`: foco preso, Escape fecha, fundo escurecido
 * pelo navegador. O componente so liga `aberto` ao elemento e veste a caixa. Quem tem
 * o estado e quem chama, como nos campos.
 */
export function Dialogo({ aberto, titulo, subtitulo, aoFechar, largura = 560, children, acoes }: {
  readonly aberto: boolean
  readonly titulo: string
  readonly subtitulo?: string
  readonly aoFechar: () => void
  readonly largura?: number
  readonly children: ReactNode
  /** O rodape com os botoes. Sem ele o dialogo termina no conteudo. */
  readonly acoes?: ReactNode
}): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    if (aberto && !el.open) el.showModal()
    if (!aberto && el.open) el.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      className="g-dialogo [width:var(--dialogo-largura)]!"
      style={{ '--dialogo-largura': `min(${largura}px, calc(100vw - 32px))` } as CSSProperties}
      onClose={aoFechar}
      onClick={(e) => {
        // Clique no proprio <dialog> e clique no fundo; dentro da caixa o alvo e um filho.
        if (e.target === ref.current) aoFechar()
      }}
    >
      <div className="g-dialogo-caixa">
        <div className="g-dialogo-cabecalho">
          <div>
            <div className="g-h16">{titulo}</div>
            {subtitulo === undefined ? null : <div className="g-l13 g-fraco g-dialogo-sub">{subtitulo}</div>}
          </div>
          <button type="button" className="g-botao g-botao-terciario g-botao-quadrado" aria-label="Fechar" onClick={aoFechar}>
            <Icone de={Cross} />
          </button>
        </div>
        <div className="g-dialogo-corpo">{children}</div>
        {acoes === undefined ? null : <div className="g-dialogo-acoes">{acoes}</div>}
      </div>
    </dialog>
  )
}
