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

export const Calendar: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M5.5.5V2h5V.5H12V2h3.5v11.5A2.5 2.5 0 0 1 13 16H3a2.5 2.5 0 0 1-2.5-2.5V2H4V.5zM2 3.5h12V6H2zm0 4v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6z" clipRule="evenodd" />
  ),
}

export const Check: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m15.56 4-.53.53-8.793 8.793a1.75 1.75 0 0 1-2.474 0L.97 10.53.44 10 1.5 8.94l.53.53 2.793 2.793a.25.25 0 0 0 .354 0L13.97 3.47l.53-.53z" clipRule="evenodd" />
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

export const Clock: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0M16 8A8 8 0 1 1-.001 8 8 8 0 0 1 16 8M8.75 4.75V4h-1.5v3.875a1 1 0 0 0 .4.8l1.9 1.425.6.45.9-1.2-.6-.45-1.7-1.275z" clipRule="evenodd" />
  ),
}

export const ClockRewind: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M7.965 2.5c3.06 0 5.535 2.466 5.535 5.5s-2.474 5.5-5.535 5.5a5.54 5.54 0 0 1-4.483-2.273l-.443-.605-1.211.885.442.605A7.04 7.04 0 0 0 7.965 15C11.846 15 15 11.87 15 8s-3.154-7-7.035-7A7.04 7.04 0 0 0 1.5 5.233V3H0v4.25c0 .414.336.75.75.75H4.5V6.5H2.637a5.53 5.53 0 0 1 5.328-4m.785 2.75V4.5h-1.5v3.366a1 1 0 0 0 .445.832l1.389.926.624.416.832-1.248-.624-.416-1.166-.777z" clipRule="evenodd" />
  ),
}

export const CloudUpload: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M1.5 4.875a3.375 3.375 0 0 1 6.401-1.497c.29.584.894 1.122 1.7 1.122h2.649a2.25 2.25 0 0 1 1.478 3.947l-.566.493.986 1.13.565-.492A3.75 3.75 0 0 0 12.25 3H9.601c-.09 0-.248-.07-.356-.288A4.875 4.875 0 0 0 0 4.875v1.529a4.09 4.09 0 0 0 1.53 3.193l.584.47.94-1.169-.584-.47a2.59 2.59 0 0 1-.97-2.024zm5.793 2.521a1 1 0 0 1 1.414 0l3.073 3.074.53.53-1.06 1.06-.53-.53-1.97-1.97V16h-1.5V9.56l-1.97 1.97-.53.53L3.69 11l.53-.53z" clipRule="evenodd" />
  ),
}

export const Database: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M3.302.786C4.542.29 6.203 0 8 0s3.458.29 4.698.786c.618.247 1.168.56 1.576.946.41.387.726.9.726 1.518v9.5c0 .618-.316 1.13-.726 1.518-.408.386-.958.699-1.576.946C11.458 15.71 9.797 16 8 16s-3.458-.29-4.698-.786c-.618-.247-1.168-.56-1.576-.946-.41-.387-.726-.9-.726-1.518v-9.5c0-.618.316-1.13.726-1.518.408-.386.958-.699 1.576-.946M2.5 5.33V8c0 .072.034.217.256.428.225.212.59.438 1.103.643 1.022.41 2.486.679 4.141.679s3.119-.27 4.14-.679c.514-.205.88-.43 1.103-.643.223-.21.257-.356.257-.428V5.33c-.248.143-.518.27-.802.384C11.458 6.21 9.797 6.5 8 6.5s-3.458-.29-4.698-.786A6.4 6.4 0 0 1 2.5 5.33m11-2.081c0 .072-.034.217-.257.428-.224.212-.589.438-1.102.643C11.119 4.731 9.655 5 8 5s-3.119-.27-4.14-.679c-.514-.205-.88-.43-1.104-.643-.222-.21-.256-.356-.256-.428s.034-.217.256-.428c.225-.212.59-.438 1.103-.643C4.881 1.769 6.345 1.5 8 1.5s3.119.27 4.14.679c.514.205.88.43 1.103.643.223.21.257.355.257.427m0 6.83c-.248.143-.518.27-.802.384-1.24.496-2.901.786-4.698.786s-3.458-.29-4.698-.786a6.4 6.4 0 0 1-.802-.383v2.669c0 .072.034.217.256.428.225.212.59.438 1.103.643 1.022.41 2.486.679 4.141.679s3.119-.27 4.14-.679c.514-.205.88-.43 1.103-.643.223-.21.257-.356.257-.428z" clipRule="evenodd" />
  ),
}

export const Download: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8.75 1v7.69l1.97-1.97.53-.53 1.06 1.06-.53.53-3.073 3.074a1 1 0 0 1-1.414 0L4.22 7.78l-.53-.53 1.06-1.06.53.53 1.97 1.97V1zm4.75 8.25v4.25h-11v-5H1V14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5h-1.5z" clipRule="evenodd" />
  ),
}

export const Eye: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M4.022 4.77a5.25 5.25 0 0 1 7.956 0L14.76 8l-2.782 3.23a5.25 5.25 0 0 1-7.956 0L1.24 8zm9.093-.98C10.422.664 5.578.664 2.885 3.79L-.318 7.51v.98l3.203 3.72c2.693 3.127 7.537 3.127 10.23 0l3.203-3.72v-.98zM6.5 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6" clipRule="evenodd" />
  ),
}

export const EyeOff: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m.191 2.062.56.499 13.5 12 .561.498.997-1.121-.56-.499-1.81-1.607 2.88-3.343v-.978l-3.204-3.72C10.645.92 6.365.685 3.594 3.08L1.748 1.44l-.56-.5zM14.761 8l-2.442 2.835-1.65-1.465a3 3 0 0 0-4.342-3.86l-1.6-1.422a5.253 5.253 0 0 1 7.251.681zM7.526 6.576l1.942 1.727a1.499 1.499 0 0 0-1.942-1.727m-7.845.935 1.722-2 1.137.978L1.24 8l2.782 3.23A5.25 5.25 0 0 0 9.9 12.703l.54 1.399a6.75 6.75 0 0 1-7.555-1.892L-.318 8.49v-.978z" clipRule="evenodd" />
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

export const LockClosed: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M10 4.5V6H6V4.5a2 2 0 1 1 4 0M4.5 6V4.5a3.5 3.5 0 1 1 7 0V6H14v6.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 12.5V6zm7 1.5h-8v5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-5z" clipRule="evenodd" />
  ),
}

export const LogoWhatsApp: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="#25D366" fillRule="evenodd" d="M13.638 2.323A7.87 7.87 0 0 0 8.034 0C3.667 0 .112 3.554.11 7.922c0 1.396.364 2.76 1.058 3.96L.044 15.989l4.2-1.101a7.9 7.9 0 0 0 3.786.964h.004c4.366 0 7.92-3.554 7.922-7.923a7.87 7.87 0 0 0-2.318-5.604zm-5.604 12.19H8.03a6.6 6.6 0 0 1-3.352-.918l-.24-.143-2.493.654.666-2.43-.157-.25a6.57 6.57 0 0 1-1.007-3.504 6.595 6.595 0 0 1 9.11-6.085 6.5 6.5 0 0 1 2.134 1.432 6.55 6.55 0 0 1 1.926 4.659c-.001 3.63-2.955 6.584-6.584 6.584zm3.611-4.932c-.197-.099-1.17-.578-1.352-.644s-.314-.099-.445.1c-.132.198-.512.644-.627.776-.116.132-.231.148-.43.049-.197-.1-.835-.308-1.591-.982a6 6 0 0 1-1.101-1.372c-.116-.198-.013-.305.086-.404.09-.088.198-.23.297-.346.1-.116.132-.199.198-.33.066-.133.033-.248-.016-.347-.05-.1-.445-1.074-.61-1.47-.161-.386-.325-.334-.446-.34a8 8 0 0 0-.38-.007.73.73 0 0 0-.527.248c-.182.198-.693.677-.693 1.651s.709 1.916.808 2.048 1.396 2.132 3.382 2.99c.472.203.84.325 1.128.416.474.151.906.13 1.247.08.38-.058 1.171-.48 1.336-.942.165-.463.165-.86.116-.942-.05-.082-.182-.132-.38-.23z" clipRule="evenodd" />
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

export const Percentage: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m11.475 1.332-.279.697-5 12.5-.278.696-1.393-.557.279-.697 5-12.5.278-.696zM4 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M7 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0m6.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6" clipRule="evenodd" />
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

export const Trash: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M6.75 2.75a1.25 1.25 0 0 1 2.5 0V3h-2.5zM5.25 3v-.25a2.75 2.75 0 1 1 5.5 0V3H15v1.5h-1.115l-.707 9.192A2.5 2.5 0 0 1 10.685 16h-5.37a2.5 2.5 0 0 1-2.493-2.308L2.115 4.5H1V3zm-.932 10.577L3.62 4.5h8.76l-.698 9.077a1 1 0 0 1-.997.923h-5.37a1 1 0 0 1-.997-.923" clipRule="evenodd" />
  ),
}

export const UserCheck: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M5.75 0A3.25 3.25 0 0 0 2.5 3.25v.5A3.25 3.25 0 0 0 5.75 7h.5A3.25 3.25 0 0 0 9.5 3.75v-.5A3.25 3.25 0 0 0 6.25 0zM4 3.25c0-.966.784-1.75 1.75-1.75h.5C7.216 1.5 8 2.284 8 3.25v.5A1.75 1.75 0 0 1 6.25 5.5h-.5A1.75 1.75 0 0 1 4 3.75zm11.81 2.5-.53.53-2.75 2.75a.75.75 0 0 1-1.06 0l-1-1-.53-.53L11 6.44l.53.53.47.47 2.22-2.22.53-.53zM1.5 13.17v1.33h9v-1.33a4.84 4.84 0 0 0-4.33-2.67h-.34a4.84 4.84 0 0 0-4.33 2.67m-1.431-.484A6.34 6.34 0 0 1 5.829 9h.342a6.34 6.34 0 0 1 5.76 3.686l.069.15V16H0v-3.165z" clipRule="evenodd" />
  ),
}

export const Users: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M2.5 3.25A3.25 3.25 0 0 1 5.75 0h.5A3.25 3.25 0 0 1 9.5 3.25v.5A3.25 3.25 0 0 1 6.25 7h-.5A3.25 3.25 0 0 1 2.5 3.75zM5.75 1.5A1.75 1.75 0 0 0 4 3.25v.5c0 .966.784 1.75 1.75 1.75h.5A1.75 1.75 0 0 0 8 3.75v-.5A1.75 1.75 0 0 0 6.25 1.5zm-4.25 13v-1.33a4.84 4.84 0 0 1 4.33-2.67h.34a4.84 4.84 0 0 1 4.33 2.67v1.33zM5.83 9a6.34 6.34 0 0 0-5.761 3.686l-.069.15V16h12v-3.165l-.069-.15A6.35 6.35 0 0 0 6.171 9zm10.101 3.686a6.34 6.34 0 0 0-2.587-2.835l-.75 1.298a4.84 4.84 0 0 1 1.906 2.022V14.5h-1V16H16v-3.165zM11.25 0h-.75v1.5h.75c.966 0 1.75.784 1.75 1.75v.5a1.75 1.75 0 0 1-1.75 1.75h-.75V7h.75a3.25 3.25 0 0 0 3.25-3.25v-.5A3.25 3.25 0 0 0 11.25 0" clipRule="evenodd" />
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

export const SettingsGear: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m7.7 1.736.045-.236h.51l.044.236a2.02 2.02 0 0 0 1.334 1.536q.285.1.554.23c.618.301 1.398.29 2.03-.143l.199-.136.36.361-.135.199a2.02 2.02 0 0 0-.143 2.03q.13.269.23.554c.224.65.783 1.192 1.536 1.334l.236.044v.51l-.236.044a2.02 2.02 0 0 0-1.536 1.334q-.098.285-.23.554a2.03 2.03 0 0 0 .143 2.03l.136.199-.361.36-.199-.135a2.02 2.02 0 0 0-2.03-.143q-.27.132-.554.23a2.02 2.02 0 0 0-1.334 1.536l-.044.236h-.51l-.044-.236a2.02 2.02 0 0 0-1.334-1.536 5 5 0 0 1-.554-.23 2.03 2.03 0 0 0-2.03.143l-.199.136-.36-.361.135-.199a2.02 2.02 0 0 0 .143-2.03 5 5 0 0 1-.23-.554 2.02 2.02 0 0 0-1.536-1.334L1.5 8.255v-.51l.236-.044a2.02 2.02 0 0 0 1.536-1.334 5 5 0 0 1 .23-.554 2.02 2.02 0 0 0-.143-2.03l-.136-.199.361-.36.199.135a2.02 2.02 0 0 0 2.03.143q.269-.13.554-.23a2.02 2.02 0 0 0 1.334-1.536zM6.5 0h3l.274 1.46a.52.52 0 0 0 .348.394q.373.129.722.3c.17.082.37.074.526-.033l1.226-.839 2.121 2.122-.838 1.226a.52.52 0 0 0-.033.526q.171.35.3.722c.061.177.21.314.394.348L16 6.5v3l-1.46.274a.52.52 0 0 0-.394.348 7 7 0 0 1-.3.722.52.52 0 0 0 .033.526l.838 1.226-2.12 2.121-1.227-.838a.52.52 0 0 0-.526-.033 7 7 0 0 1-.722.3.52.52 0 0 0-.348.394L9.5 16h-3l-.274-1.46a.52.52 0 0 0-.348-.394 7 7 0 0 1-.722-.3.52.52 0 0 0-.526.033l-1.226.838-2.122-2.12.84-1.227a.52.52 0 0 0 .032-.526 7 7 0 0 1-.3-.722.52.52 0 0 0-.394-.348L0 9.5v-3l1.46-.274a.52.52 0 0 0 .394-.348q.129-.373.3-.722a.52.52 0 0 0-.033-.526l-.839-1.226 2.122-2.122 1.226.84a.52.52 0 0 0 .526.032 7 7 0 0 1 .722-.3.52.52 0 0 0 .348-.394zm3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0" clipRule="evenodd" />
  ),
}

export const Dollar: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M8 16A8 8 0 1 0 8-.001 8 8 0 0 0 8 16m.625-12.625v1H9c1.174 0 2.125.951 2.125 2.125h-1.25A.875.875 0 0 0 9 5.625h-.375v1.75H9a2.125 2.125 0 1 1 0 4.25h-.375v1h-1.25v-1H7A2.125 2.125 0 0 1 4.875 9.5h1.25c0 .483.392.875.875.875h.375v-1.75H7a2.125 2.125 0 1 1 0-4.25h.375v-1zm-1.25 2.25H7a.875.875 0 0 0 0 1.75h.375zm1.25 3v1.75H9a.875.875 0 0 0 0-1.75z" clipRule="evenodd" />
  ),
}

export const Box: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m8 .155.346.18 6.25 3.25.404.21v8.41l-.404.21-6.25 3.25-.346.18-.346-.18-6.25-3.25-.404-.21v-8.41l.404-.21 6.25-3.25zm-5.5 11.14V5.44l4.75 2.375v5.949zm6.25 2.47 4.75-2.47V5.44L8.75 7.816zM8 1.845l4.577 2.38L8 6.514 3.423 4.225z" clipRule="evenodd" />
  ),
}

export const Buildings: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M2.5 2.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75V14.5h-5zM7.5 16H1V2.25A2.25 2.25 0 0 1 3.25 0h3.5A2.25 2.25 0 0 1 9 2.25V6.5h3.25a2.25 2.25 0 0 1 2.25 2.25V16zM9 14.5h4V8.75a.75.75 0 0 0-.75-.75H9zm-4.25-11H4V5h2V3.5zM4 6.5h2V8H4zm6.75 3H10V11h2V9.5zM4 9.5h2V11H4z" clipRule="evenodd" />
  ),
}

export const RefreshClockwise: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M8 1.25a7 7 0 0 0-6.16 3.672l-.357.66 1.32.713.357-.66a5.503 5.503 0 0 1 10.112 1.039h-2.198v1.5h4.175a.75.75 0 0 0 .75-.75V3.25h-1.5v2.395A7 7 0 0 0 8 1.25m-6.499 9.605v2.395h-1.5V9.075a.75.75 0 0 1 .75-.75h4.175v1.5H2.729a5.503 5.503 0 0 0 10.098 1.065l.36-.658 1.316.72-.361.659a7.002 7.002 0 0 1-12.64-.755z" clipRule="evenodd" />
  ),
}

export const Copy: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M2.75.5A1.75 1.75 0 0 0 1 2.25v7.5c0 .966.784 1.75 1.75 1.75H4.5V10H2.75a.25.25 0 0 1-.25-.25v-7.5A.25.25 0 0 1 2.75 2h5.5a.25.25 0 0 1 .25.25V3H10v-.75A1.75 1.75 0 0 0 8.25.5zm5 4A1.75 1.75 0 0 0 6 6.25v7.5c0 .966.784 1.75 1.75 1.75h5.5A1.75 1.75 0 0 0 15 13.75v-7.5a1.75 1.75 0 0 0-1.75-1.75zM7.5 6.25A.25.25 0 0 1 7.75 6h5.5a.25.25 0 0 1 .25.25v7.5a.25.25 0 0 1-.25.25h-5.5a.25.25 0 0 1-.25-.25z" clipRule="evenodd" />
  ),
}

export const User: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M7.75 0A3.25 3.25 0 0 0 4.5 3.25v.5A3.25 3.25 0 0 0 7.75 7h.5a3.25 3.25 0 0 0 3.25-3.25v-.5A3.25 3.25 0 0 0 8.25 0zM6 3.25c0-.966.784-1.75 1.75-1.75h.5c.966 0 1.75.784 1.75 1.75v.5A1.75 1.75 0 0 1 8.25 5.5h-.5A1.75 1.75 0 0 1 6 3.75zM2.5 14.5v-1.33a4.84 4.84 0 0 1 4.33-2.67h2.34a4.85 4.85 0 0 1 4.33 2.67v1.33zM6.83 9a6.34 6.34 0 0 0-5.761 3.686l-.069.15V16h14v-3.165l-.069-.15A6.35 6.35 0 0 0 9.171 9z" clipRule="evenodd" />
  ),
}

export const Logout: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="M2.5 13.5h4.25V15H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h4.75v1.5H2.5zm9.94-6.25-1.97-1.97-.53-.53L11 3.69l.53.53 3.074 3.073a1 1 0 0 1 0 1.414L11.53 11.78l-.53.53-1.06-1.06.53-.53 1.97-1.97H5v-1.5z" clipRule="evenodd" />
  ),
}

export const Cross: Desenho = {
  viewBox: '0 0 16 16',
  corpo: (
    <path fill="currentColor" fillRule="evenodd" d="m12.47 13.53.53.53L14.06 13l-.53-.53L9.06 8l4.47-4.47.53-.53L13 1.94l-.53.53L8 6.94 3.53 2.47 3 1.94 1.94 3l.53.53L6.94 8l-4.47 4.47-.53.53L3 14.06l.53-.53L8 9.06z" clipRule="evenodd" />
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
