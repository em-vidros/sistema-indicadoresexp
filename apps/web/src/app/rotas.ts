/**
 * As dez telas do app, numa tabela.
 *
 * A tabela e a unica fonte: a sidebar sai dela, o roteador sai dela, o titulo da aba sai
 * dela e o pedaco de JavaScript de cada tela sai do `carregar` dela. Uma linha nova aqui
 * ja nasce navegavel, no grupo certo e com o chunk proprio, sem tocar em nada abaixo.
 *
 * `comFiltros` marca as quatro telas do Painel, as unicas que dividem base e periodo pela
 * query string. Nas outras a casca mostra a base da sessao, que nao filtra nada.
 *
 * Cada `carregar` e um `import()` literal de proposito. O Rollup so sabe fatiar o bundle
 * quando o caminho esta escrito na chamada; montado com template ele empacota a pasta
 * inteira e as dez telas voltam a viajar juntas.
 */
import type { ComponentType } from 'react'
import {
  ArrowLeftRight,
  Database,
  FileText,
  Gauge,
  Home,
  Layers,
  Notes,
  PencilEdit,
  Route,
  Wrench,
} from '../geist/icones.tsx'
import type { Desenho } from '../geist/icones.tsx'
import { CAMINHOS } from './caminhos.ts'
import type { Caminho } from './caminhos.ts'

export type Grupo = 'Painel' | 'Registros' | 'Gestão'

export const GRUPOS: readonly Grupo[] = ['Painel', 'Registros', 'Gestão']

export type Rota = {
  readonly id: string
  readonly caminho: Caminho
  readonly titulo: string
  readonly grupo: Grupo
  readonly icone: Desenho
  /** So as do Painel dividem base e periodo, e so elas levam a query no href. */
  readonly comFiltros: boolean
  readonly carregar: () => Promise<{ readonly default: ComponentType }>
}

export const ROTAS: readonly Rota[] = [
  {
    id: 'visao-geral',
    caminho: '/visao-geral',
    titulo: 'Visão geral',
    grupo: 'Painel',
    icone: Home,
    comFiltros: true,
    carregar: () => import('../telas/dashboard-semanal.tsx'),
  },
  {
    id: 'viagens',
    caminho: '/viagens',
    titulo: 'Viagens',
    grupo: 'Painel',
    icone: Route,
    comFiltros: true,
    carregar: () => import('../telas/viagens.tsx'),
  },
  {
    id: 'rotas',
    caminho: '/rotas',
    titulo: 'Rotas',
    grupo: 'Painel',
    icone: ArrowLeftRight,
    comFiltros: true,
    carregar: () => import('../telas/rotas.tsx'),
  },
  {
    id: 'frota',
    caminho: '/frota',
    titulo: 'Frota',
    grupo: 'Painel',
    icone: Gauge,
    comFiltros: true,
    carregar: () => import('../telas/frota.tsx'),
  },
  {
    id: 'registrar',
    caminho: '/registrar',
    titulo: 'Registrar rota',
    grupo: 'Registros',
    icone: PencilEdit,
    comFiltros: false,
    carregar: () => import('../telas/em-construcao.tsx'),
  },
  {
    id: 'manutencao',
    caminho: '/manutencao',
    titulo: 'Manutenção',
    grupo: 'Registros',
    icone: Wrench,
    comFiltros: false,
    carregar: () => import('../telas/manutencao.tsx'),
  },
  {
    id: 'documentos',
    caminho: '/documentos',
    titulo: 'Documentos',
    grupo: 'Registros',
    icone: FileText,
    comFiltros: false,
    carregar: () => import('../telas/documentos.tsx'),
  },
  {
    id: 'atas',
    caminho: '/atas',
    titulo: 'Atas de reunião',
    grupo: 'Gestão',
    icone: Notes,
    comFiltros: false,
    carregar: () => import('../telas/atas.tsx'),
  },
  {
    id: 'integracoes',
    caminho: '/integracoes',
    titulo: 'Integrações',
    grupo: 'Gestão',
    icone: Layers,
    comFiltros: false,
    carregar: () => import('../telas/integracoes.tsx'),
  },
  {
    id: 'cadastro',
    caminho: '/cadastro',
    titulo: 'Cadastro',
    grupo: 'Gestão',
    icone: Database,
    comFiltros: false,
    carregar: () => import('../telas/cadastro.tsx'),
  },
]

// A lista que o servidor le e esta tabela tem que cobrir os mesmos caminhos. O tipo ja
// recusa um caminho inventado; o que falta e o caminho esquecido, e ele estoura aqui,
// no carregamento do modulo, e nao numa tela que abre em 404 sem ninguem entender.
const cobertos = new Set<string>(ROTAS.map((rota) => rota.caminho))
const semRota = CAMINHOS.filter((caminho) => !cobertos.has(caminho))
if (semRota.length > 0) throw new Error(`caminho sem rota: ${semRota.join(', ')}`)

export function rotaDe(caminho: string): Rota | null {
  return ROTAS.find((rota) => rota.caminho === caminho) ?? null
}
