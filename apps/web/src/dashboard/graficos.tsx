/**
 * Os dois desenhos da Visao geral. O canvas os desenhou a mao em
 * `var/design-dashboard/build.mjs`; aqui o grande vira Recharts e o pequeno continua SVG.
 *
 * A sparkline nao entra no Recharts porque sao oito pontos e uma polyline: um
 * `ResponsiveContainer` com eixo, escala e ciclo de medida para desenhar 96 por 36 px
 * custa mais em runtime e em leitura do que a funcao que calcula os oito pares.
 *
 * As cores saem de `var(--g-...)` dentro do proprio atributo SVG, e nao de um hex repetido
 * aqui. Atributo de apresentacao e declaracao de CSS de prioridade minima, entao `var()`
 * resolve nele, e a paleta continua morando so em `geist.css`.
 */
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { JSX } from 'react'
import { fmtPct } from './dominio.ts'

export type Semana = { readonly label: string; readonly pct: number | null }

const ALTURA = 236
const TICKS = [0, 4, 8, 12]

const ROTULO = { fontFamily: 'var(--g-mono)', fontSize: 11, fill: 'var(--g-gray-900)' }

export function GraficoCustoCarga({ semanas, meta = 7 }: {
  readonly semanas: readonly Semana[]
  readonly meta?: number
}): JSX.Element {
  const ultima = [...semanas].reverse().find((s) => s.pct !== null) ?? null

  return (
    <div className="g-grafico">
      <ResponsiveContainer width="100%" height={ALTURA}>
        <AreaChart data={[...semanas]} margin={{ top: 18, right: 36, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="g-area-custo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--g-teal-600)" stopOpacity={0.25} />
              <stop offset="1" stopColor="var(--g-teal-600)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--g-gray-300)" />
          <YAxis
            domain={[0, 12]}
            ticks={TICKS}
            tickFormatter={(valor: number) => `${valor}%`}
            width={36}
            axisLine={false}
            tickLine={false}
            tick={ROTULO}
          />
          <XAxis dataKey="label" height={28} axisLine={false} tickLine={false} tick={ROTULO} />
          <ReferenceLine
            y={meta}
            stroke="var(--g-red-700)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{
              value: `meta ${meta}%`,
              position: 'insideBottomLeft',
              fill: 'var(--g-red-700)',
              fontSize: 11,
              fontWeight: 500,
            }}
          />
          <Area
            type="linear"
            dataKey="pct"
            stroke="var(--g-teal-700)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="url(#g-area-custo)"
            connectNulls
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {ultima === null || ultima.pct === null
            ? null
            : (
              <ReferenceDot
                x={ultima.label}
                y={ultima.pct}
                r={4}
                fill="var(--g-teal-700)"
                stroke="#FFFFFF"
                strokeWidth={2}
                label={{
                  value: fmtPct(ultima.pct),
                  position: 'top',
                  offset: 8,
                  fill: 'var(--g-gray-1000)',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              />
            )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * A escala vertical sai dos proprios pontos, e nao de um minimo e um maximo fixos como no
 * canvas. O canvas escolheu 5,5 e 9 a olho para os oito numeros que ele inventou; com dado
 * de verdade um teto fixo achataria a linha na semana ruim e a estouraria na pior.
 */
export function Sparkline({ pontos, largura = 96, altura = 36 }: {
  readonly pontos: ReadonlyArray<number | null>
  readonly largura?: number
  readonly altura?: number
}): JSX.Element | null {
  const valores = pontos.map((p, i) => ({ i, p })).filter((v): v is { i: number; p: number } => v.p !== null)
  if (valores.length < 2) return null

  const so = valores.map((v) => v.p)
  const menor = Math.min(...so)
  const maior = Math.max(...so)
  // Linha reta no meio quando os oito numeros sao iguais, em vez de divisao por zero.
  const folga = maior === menor ? Math.abs(maior) * 0.1 + 1 : (maior - menor) * 0.15
  const piso = menor - folga
  const teto = maior + folga

  const ultimo = pontos.length - 1
  const px = (i: number): number => (ultimo === 0 ? 0 : (i / ultimo) * largura)
  const py = (v: number): number => altura - ((v - piso) / (teto - piso)) * altura

  const pares = valores.map((v) => `${px(v.i).toFixed(1)},${py(v.p).toFixed(1)}`)
  const linha = `M${pares.join(' L')}`
  const fim = valores[valores.length - 1]
  if (fim === undefined) return null

  return (
    <svg
      className="g-sparkline"
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="g-sparkline-tinta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--g-teal-600)" stopOpacity={0.3} />
          <stop offset="1" stopColor="var(--g-teal-600)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${linha} L${largura},${altura} L0,${altura} Z`} fill="url(#g-sparkline-tinta)" />
      <path
        d={linha}
        fill="none"
        stroke="var(--g-teal-700)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={px(fim.i)} cy={py(fim.p)} r="3.5" fill="var(--g-teal-700)" stroke="#FFFFFF" strokeWidth="2" />
    </svg>
  )
}
