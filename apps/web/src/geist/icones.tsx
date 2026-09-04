/**
 * GERADO por `bun infra/gerar-icones.ts` a partir de `var/design-dashboard/geist-icons.json`.
 * Nao edite a mao: a proxima geracao desfaz. Para acrescentar um icone, ponha o nome na
 * lista `USADOS` do gerador e rode de novo.
 *
 * O `<g clip-path>` e o `<defs>` do set original nao estao aqui. O gerador confere que o
 * clip era o retangulo do proprio viewBox, que o `<svg>` ja recorta, e o arranca; sem
 * ele nao ha `id` fixo, e o mesmo icone repetido numa tabela nao colide consigo mesmo.
 *
 * Nao ha prop de cor. O `fill` dos caminhos e `currentColor`, entao quem manda na cor e
 * o `color` de quem monta o icone.
 */
import type { ReactNode } from 'react'
import type { JSX } from 'react'

export type Desenho = { readonly viewBox: string; readonly corpo: ReactNode }

export const ArrowDownRight: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M12.5 11.44V5H14v8a1 1 0 0 1-1 1H5v-1.5h6.438L2.219 3.28l-.53-.53 1.06-1.06.53.53z" clipRule="evenodd" />
  ),
}

export const ArrowLeftRight: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m3.47 11.78.53.53 1.06-1.06-.53-.53-1.97-1.97h10.88l-1.97 1.97-.53.53L12 12.31l.53-.53 3.074-3.073a1 1 0 0 0 0-1.414L12.53 4.22 12 3.69l-1.06 1.06.53.53 1.97 1.97H2.56l1.97-1.97.53-.53L4 3.69l-.53.53L.397 7.293a1 1 0 0 0 0 1.414z" clipRule="evenodd" />
  ),
}

export const ArrowRight: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M9.53 2.22 9 1.69 7.94 2.75l.53.53 3.97 3.97H1v1.5h11.44l-3.97 3.97-.53.53L9 14.31l.53-.53 5.074-5.073a1 1 0 0 0 0-1.414z" clipRule="evenodd" />
  ),
}

export const ArrowUpDown: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M4.22 3.47 3.69 4l1.06 1.06.53-.53 1.97-1.97v10.88l-1.97-1.97-.53-.53L3.69 12l.53.53 3.073 3.074a1 1 0 0 0 1.414 0l3.073-3.074.53-.53-1.06-1.06-.53.53-1.97 1.97V2.56l1.97 1.97.53.53L12.31 4l-.53-.53L8.707.397a1 1 0 0 0-1.414 0z" clipRule="evenodd" />
  ),
}

export const ArrowUpRight: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M5.75 2H5v1.5h6.44l-9.22 9.22-.53.53 1.06 1.06.53-.53 9.22-9.218V11H14V3a1 1 0 0 0-1-1z" clipRule="evenodd" />
  ),
}

export const CheckCircle: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0M16 8A8 8 0 1 1-.001 8 8 8 0 0 1 16 8m-4.47-1.47.53-.53L11 4.94l-.53.53L6.5 9.44l-.97-.97L5 7.94 3.94 9l.53.53 1.5 1.5a.75.75 0 0 0 1.06 0z" clipRule="evenodd" />
  ),
}

export const ChevronDown: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m14.06 5.5-.53.53-4.823 4.824a1 1 0 0 1-1.414 0L2.47 6.03l-.53-.53L3 4.44l.53.53L8 9.44l4.47-4.47.53-.53z" clipRule="evenodd" />
  ),
}

export const ChevronLeft: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m10.5 14.06-.53-.53-4.824-4.823a1 1 0 0 1 0-1.414L9.97 2.47l.53-.53L11.56 3l-.53.53L6.56 8l4.47 4.47.53.53z" clipRule="evenodd" />
  ),
}

export const ChevronRight: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m5.5 1.94.53.53 4.824 4.823a1 1 0 0 1 0 1.414L6.03 13.53l-.53.53L4.44 13l.53-.53L9.44 8 4.97 3.53 4.44 3z" clipRule="evenodd" />
  ),
}

export const Download: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8.75 1v7.69l1.97-1.97.53-.53 1.06 1.06-.53.53-3.073 3.074a1 1 0 0 1-1.414 0L4.22 7.78l-.53-.53 1.06-1.06.53.53 1.97 1.97V1zm4.75 8.25v4.25h-11v-5H1V14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5h-1.5z" clipRule="evenodd" />
  ),
}

export const FileText: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M14.5 13.5V5.414a1 1 0 0 0-.293-.707L9.793.293A1 1 0 0 0 9.086 0H1.5v13.5A2.5 2.5 0 0 0 4 16h8a2.5 2.5 0 0 0 2.5-2.5m-1.5 0v-7H8v-5H3v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1M9.5 5V2.121L12.379 5zM5.13 5h-.625v1.25h2.12V5zm-.625 3h7.12v1.25h-7.12zm.625 3h-.625v1.25h7.12V11z" clipRule="evenodd" />
  ),
}

export const Filter: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M1 0h14v3.31l-.22.22-4.28 4.28V16H8.782l-.185-.117-2.75-1.75-.347-.221V7.81L1.22 3.53 1 3.31zm1.5 1.5v1.19l4.28 4.28.22.22v5.898l2 1.273V7.19l.22-.22 4.28-4.28V1.5z" clipRule="evenodd" />
  ),
}

export const Gauge: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8.991 1.576a6.5 6.5 0 0 0-5.587 11.02l.53.53-1.06 1.061-.53-.53A8 8 0 0 1 9.966.244zm4.84 3.547a6.5 6.5 0 0 1-1.235 7.473l-.53.53 1.06 1.061.53-.53a8 8 0 0 0 1.15-9.865l-.976 1.33zM8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 1.5a2.5 2.5 0 0 0 1.98-4.025l3.467-4.334a8 8 0 0 0-1.188-.915l-3.51 4.388A2.5 2.5 0 1 0 8 10.5" clipRule="evenodd" />
  ),
}

export const Home: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M12.5 6.56 8 2.06l-4.5 4.5v6.94H6V11a2 2 0 0 1 4 0v2.5h2.5zm1.28-.84L8.707.645a1 1 0 0 0-1.414 0L2.22 5.72.47 7.47-.06 8 1 9.06l.53-.53.47-.47V15h12V8.06l.47.47.53.53L16.06 8l-.53-.53zM8.5 11v2.5h-1V11a.5.5 0 1 1 1 0" clipRule="evenodd" />
  ),
}

export const Information: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M8 16A8 8 0 1 0 8-.001 8 8 0 0 0 8 16M6.25 7h1.5a1 1 0 0 1 1 1v4.25h-1.5V8.5h-1zM8 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2" clipRule="evenodd" />
  ),
}

export const Layers: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M0 5.251V4.25l.463-.192 7.25-3L8 .938l.287.119 7.25 3 .463.192V5.25l-.463.192-7.25 3-.287.12-.287-.119-7.25-3zm0 3.207V6.835l.537.222L8 10.145l7.463-3.088.537-.222v1.623L8.287 11.65 8 11.769l-.287-.12L0 8.46zm0 3.25v-1.623l.537.222L8 13.395l7.463-3.088.537-.222v1.623L8.287 14.9 8 15.019l-.287-.12L0 11.71zm8-4.77L2.712 4.75 8 2.562l5.289 2.188z" clipRule="evenodd" />
  ),
}

export const MagnifyingGlass: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M1.5 6.5a5 5 0 1 1 10 0 5 5 0 0 1-10 0m5-6.5a6.5 6.5 0 1 0 4.035 11.596l3.435 3.434.53.53 1.06-1.06-.53-.53-3.434-3.435A6.5 6.5 0 0 0 6.5 0" clipRule="evenodd" />
  ),
}

export const MoreHorizontal: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M4 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m5.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" clipRule="evenodd" />
  ),
}

export const Notes: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M13 2.5H3v2h10zm-10 5V5.75h1.75V7.5zm1.75 1.25H3v1.75h1.75zM6 10.5V8.75h7v1.75zm-1.25 1.25H3v.75a1 1 0 0 0 1 1h.75zM6 13.5v-1.75h7v.75a1 1 0 0 1-1 1zm0-6V5.75h7V7.5zM3 1H1.5v11.5A2.5 2.5 0 0 0 4 15h8a2.5 2.5 0 0 0 2.5-2.5V1z" clipRule="evenodd" />
  ),
}

export const PencilEdit: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m11.75.19.53.53 3 3 .53.53-.53.53L5.16 14.902A3.75 3.75 0 0 1 2.507 16H0v-2.507a3.75 3.75 0 0 1 1.098-2.652L11.22.72zm0 2.12L9.81 4.25l1.94 1.94 1.94-1.94zm-9.591 9.592L8.75 5.31l1.94 1.939-6.592 6.591a2.25 2.25 0 0 1-1.59.659H1.5v-1.007c0-.597.237-1.17.659-1.591zM9 16h7v-1.5H9z" clipRule="evenodd" />
  ),
}

export const Plus: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8.75 1.75V1h-1.5v5.75H1.5v1.5h5.75V14h1.5V8.25h5.75v-1.5H8.75z" clipRule="evenodd" />
  ),
}

export const Route: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M7.53.72 7 .19 5.94 1.25l.53.53.22.22H3.374a3.375 3.375 0 1 0 0 6.75h9.25a1.875 1.875 0 0 1 0 3.75h-7.74a2.501 2.501 0 1 0 0 1.5h7.74a3.375 3.375 0 0 0 0-6.75h-9.25a1.875 1.875 0 1 1 0-3.75h3.314l-.22.22-.53.53L7 5.31l.53-.53 1.324-1.323a1 1 0 0 0 0-1.414zM2.5 14.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2m12-11.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0m1.5 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0" clipRule="evenodd" />
  ),
}

export const Warning: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8.558 2H7.441L1.89 13.5h12.22zm1.351-.652A1.5 1.5 0 0 0 8.56.5H7.44a1.5 1.5 0 0 0-1.35.848L.193 13.565a1 1 0 0 0 .9 1.435h13.814a1 1 0 0 0 .9-1.435zM8.75 4.75v4h-1.5v-4zM8 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2" clipRule="evenodd" />
  ),
}

export const Wrench: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" d="m12.798 1.242.53.53.729-.728-.917-.47zm-2.84 2.84-.531-.53zM6.583 6.957l.53.53.354-.353-.19-.462zm2.518 2.481.275-.697-.457-.18-.348.347zm5.684-6.183.672-.333-.464-.936-.739.739zM12.267.712l-2.84 2.84 1.06 1.061 2.841-2.84zM10.75 1.5c.616 0 1.195.148 1.706.41L13.14.574A5.2 5.2 0 0 0 10.75 0zM7 5.25a3.75 3.75 0 0 1 3.75-3.75V0A5.25 5.25 0 0 0 5.5 5.25zm.278 1.421A3.7 3.7 0 0 1 7 5.25H5.5c0 .703.138 1.375.39 1.99zm-1.224-.246L.97 11.51l1.06 1.06 5.085-5.084-1.06-1.06zM.97 11.51a2.52 2.52 0 0 0 0 3.56l1.06-1.06a1.02 1.02 0 0 1 0-1.44zm0 3.56a2.52 2.52 0 0 0 3.56 0l-1.06-1.06a1.02 1.02 0 0 1-1.44 0zm3.56 0 5.102-5.1-1.06-1.06-5.102 5.1zM10.75 9c-.486 0-.95-.092-1.374-.26l-.55 1.396a5.2 5.2 0 0 0 1.924.364zm3.75-3.75A3.75 3.75 0 0 1 10.75 9v1.5c2.9 0 5.25-2.35 5.25-5.25zm-.387-1.662c.247.5.387 1.064.387 1.662H16c0-.834-.195-1.625-.543-2.328zm-1.626 3.025 2.828-2.827-1.06-1.061-2.828 2.828zm-2.475 0a1.75 1.75 0 0 0 2.475 0l-1.06-1.06a.25.25 0 0 1-.354 0zm-.585-.586.585.586 1.061-1.06-.586-.586zm0-2.475a1.75 1.75 0 0 0 0 2.475l1.06-1.06a.25.25 0 0 1 0-.354z" />
  ),
}

export function Icone({ de, tamanho = 16, classe }: {
  readonly de: Desenho
  readonly tamanho?: number
  readonly classe?: string
}): JSX.Element {
  return (
    <svg
      className={classe === undefined ? 'g-icone' : `g-icone ${classe}`}
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
