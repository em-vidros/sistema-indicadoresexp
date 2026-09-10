/**
 * Previa de documento em hover, no espirito do Quick Look do macOS.
 *
 * A tabela de Documentos mostrava a data de vencimento e mais nada: para descobrir se
 * havia PDF anexado era preciso abrir o dialogo de edicao e clicar em "Ver". O painel
 * daqui tira esse trajeto do caminho de quem so quer conferir o arquivo.
 *
 * O visualizador e o do proprio navegador, dentro de um iframe. Nao ha pdf.js nem
 * servico de miniatura, e nao ha previa de imagem ou de video enquanto nao existir
 * imagem ou video no sistema.
 *
 * O painel vai para um portal porque os dialogos da casa usam `<dialog>` com
 * `showModal()`, que sobe o elemento para a top layer. Montado em `document.body` o
 * painel ficaria embaixo do dialogo, invisivel; montado dentro do proprio `<dialog>`
 * ele aparece. Por isso a raiz e `closest('dialog')` e so cai no `body` fora dele.
 *
 * O painel nao leva `role`. Ele nao e dialogo, que se entra e do qual se sai, nem
 * tooltip, que nao carrega botao dentro. Um `div` sem papel, alcancado pelo
 * `aria-describedby` do gatilho, e lido pelo texto que tem e nao anuncia uma interacao
 * que nao existe.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { JSX, ReactNode } from 'react'
import { FileText, Icone } from './icones.tsx'
import { Botao } from './primitivos.tsx'

export type Previa = {
  /** 'pdf' embute o arquivo num iframe. 'link' so mostra o destino: outra origem nao entra em iframe. */
  readonly tipo: 'pdf' | 'link'
  readonly endereco: string
  readonly titulo: string
  readonly subtitulo?: string
}

type Posicao = { readonly x: number; readonly y: number }
type Aberta = { readonly posicao: Posicao; readonly fixada: boolean }

/** Espelham `.g-previa` e `.g-previa-quadro` de `geist.css`. Mexeu la, mexa aqui. */
const LARGURA = 340
const ALTURA = 360
/** Entre o gatilho e o painel. */
const FOLGA = 8
/** Entre o painel e a borda da janela. O mesmo 12 do `calc(100vw - 24px)` da folha. */
const MARGEM = 12
/** Hover curto de quem so esta atravessando a celula nao abre nada. */
const ESPERA = 400
/** O bastante para o ponteiro viajar do gatilho ate o painel sem o painel sumir. */
const CARENCIA = 120

/** O painel inteiro dentro da janela, mesmo com o gatilho colado numa borda. */
function grudar(valor: number, tamanho: number, janela: number): number {
  return Math.min(Math.max(valor, MARGEM), Math.max(MARGEM, janela - tamanho - MARGEM))
}

function posicaoPara(rect: DOMRect): Posicao {
  const abaixo = rect.bottom + FOLGA
  const acima = rect.top - FOLGA - ALTURA
  // A segunda condicao e o que impede o painel de virar para cima e sair da tela quando
  // nao cabe de nenhum dos dois lados. Nesse caso ele fica embaixo e o `grudar` o traz
  // de volta para dentro da janela, ainda que por cima da linha que o abriu.
  const y = abaixo + ALTURA > window.innerHeight && acima >= MARGEM ? acima : abaixo
  // A folha encolhe o painel em tela estreita, e grudar pela largura cheia empurraria
  // para a esquerda um painel que ja cabia onde estava.
  const largura = Math.min(LARGURA, window.innerWidth - MARGEM * 2)
  return {
    x: grudar(rect.left, largura, window.innerWidth),
    y: grudar(y, ALTURA, window.innerHeight),
  }
}

/** O tipo nao promete URL absoluta, e `new URL` de caminho relativo lanca. */
function hostDe(endereco: string): string {
  try {
    return new URL(endereco).host
  } catch {
    return endereco
  }
}

function QuadroDePdf({ endereco, titulo }: {
  readonly endereco: string
  readonly titulo: string
}): JSX.Element {
  const [carregado, setCarregado] = useState(false)
  return (
    <>
      {carregado ? null : <div className="g-previa-esqueleto g-falso" />}
      {/* Sem `sandbox`: o PDF e da mesma origem, entao nao ha o que isolar. Os
          parametros depois do `#` sao contrato do visualizador de PDF da plataforma, e
          enxugam a barra e o painel lateral que nao cabem em 340 px. */}
      <iframe
        className="g-previa-iframe"
        title={titulo}
        src={`${endereco}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        onLoad={() => setCarregado(true)}
      />
    </>
  )
}

function CartaoDeLink({ endereco }: { readonly endereco: string }): JSX.Element {
  return (
    <div className="g-previa-link">
      <Icone de={FileText} tamanho={20} />
      <span className="g-l13 g-forte">Documento fora do sistema</span>
      <span className="g-l12 g-fraco">{hostDe(endereco)}</span>
      <Botao rotulo="Abrir" aoClicar={() => window.open(endereco, '_blank')} />
    </div>
  )
}

function Gatilho({ previa, children }: {
  readonly previa: Previa
  readonly children: ReactNode
}): JSX.Element {
  const [aberta, setAberta] = useState<Aberta | null>(null)
  const gatilho = useRef<HTMLSpanElement>(null)
  const abertura = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fechamento = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  const cancelarAbertura = (): void => {
    if (abertura.current !== null) clearTimeout(abertura.current)
    abertura.current = null
  }
  const cancelarFechamento = (): void => {
    if (fechamento.current !== null) clearTimeout(fechamento.current)
    fechamento.current = null
  }
  const abrir = (fixada: boolean): void => {
    const alvo = gatilho.current
    if (alvo !== null) setAberta({ posicao: posicaoPara(alvo.getBoundingClientRect()), fixada })
  }

  // `scroll` nao borbulha, e por isso o listener e de captura: sem ele a rolagem de uma
  // caixa interna moveria o gatilho sem o painel ficar sabendo.
  useEffect(() => {
    if (aberta === null) return
    const fechar = (): void => setAberta(null)
    const tecla = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', fechar, { capture: true, passive: true })
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', fechar, { capture: true })
      window.removeEventListener('resize', fechar)
    }
  }, [aberta])

  // A espera de 400 ms sobrevive ao desmonte se ninguem a cancelar.
  useEffect(() => () => {
    cancelarAbertura()
    cancelarFechamento()
  }, [])

  const painel = aberta === null ? null : createPortal(
    <div
      id={id}
      className="g-previa"
      style={{ left: `${aberta.posicao.x}px`, top: `${aberta.posicao.y}px` }}
      onPointerEnter={cancelarFechamento}
      onPointerLeave={() => {
        if (!aberta.fixada) fechamento.current = setTimeout(() => setAberta(null), CARENCIA)
      }}
    >
      <div className="g-previa-cabecalho">
        <Icone de={FileText} />
        <span className="g-previa-titulo">
          <span className="g-l13 g-forte">{previa.titulo}</span>
          {previa.subtitulo === undefined || previa.subtitulo === ''
            ? null
            : <span className="g-previa-sub g-l12 g-fraco">{previa.subtitulo}</span>}
        </span>
      </div>
      <div className="g-previa-quadro">
        {previa.tipo === 'pdf'
          ? <QuadroDePdf endereco={previa.endereco} titulo={previa.titulo} />
          : <CartaoDeLink endereco={previa.endereco} />}
      </div>
    </div>,
    gatilho.current?.closest('dialog') ?? document.body,
  )

  return (
    <span
      ref={gatilho}
      className="g-previa-gatilho"
      aria-describedby={aberta === null ? undefined : id}
      // Um toque tambem dispara `pointerenter`, e ali a previa so atrapalharia o clique
      // que ja existe na celula. So o mouse abre.
      onPointerEnter={(evento) => {
        if (evento.pointerType !== 'mouse') return
        cancelarFechamento()
        abertura.current = setTimeout(() => abrir(false), ESPERA)
      }}
      onPointerLeave={() => {
        cancelarAbertura()
        if (aberta !== null && !aberta.fixada) {
          fechamento.current = setTimeout(() => setAberta(null), CARENCIA)
        }
      }}
      onFocus={() => {
        cancelarAbertura()
        cancelarFechamento()
        abrir(true)
      }}
      onBlur={() => {
        cancelarAbertura()
        cancelarFechamento()
        setAberta(null)
      }}
    >
      {children}
      {painel}
    </span>
  )
}

export function ComPrevia({ previa, children }: {
  /** null desliga a previa. */
  readonly previa: Previa | null
  readonly children: ReactNode
}): JSX.Element {
  // Os hooks moram no `Gatilho` porque sem previa nao ha wrapper nem listener nenhum,
  // e um `return` cedo antes deles seria ordem de hook variavel.
  if (previa === null) return <>{children}</>
  return <Gatilho previa={previa}>{children}</Gatilho>
}
