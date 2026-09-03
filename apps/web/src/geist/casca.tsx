/**
 * A casca das telas novas: sidebar inset sobre a pagina, e o conteudo num painel com
 * margem, raio 12 e ring. O desenho esta em `var/design-dashboard/build.mjs`.
 *
 * Os nove itens sao uma tabela e nao uma sequencia de `if`. Cada um tem rotulo, icone,
 * href e grupo, e o item ativo sai de `ativaDe(location.pathname)`: uma linha nova na
 * tabela ja nasce navegavel, destacavel e no grupo certo, sem tocar em nada abaixo.
 *
 * Cada item e um `<a href>` de verdade, sem `onClick`. As quatro telas do Painel dividem
 * os mesmos filtros, entao elas levam a query junto no href e o filtro sobrevive a
 * navegacao sem uma linha de sincronia. As cinco de fora apontam para as telas legadas,
 * que nao leem filtro nenhum.
 *
 * O que o canvas desenha e nao esta aqui, por decisao registrada na sintese: a linha de
 * busca ⌘K, porque caixa de busca que nao busca e mentira desenhada, e o ponto ambar de
 * Documentos, porque nao ha fonte de dado para ele.
 *
 * O rodape e a linha de usuario do canvas, com nome e area fixos. O app tem
 * `GET /api/sessao`, mas nenhuma das quatro telas do painel pede sessao hoje, e o
 * switcher de baixo entrega o unico gesto que ele precisa entregar: sair.
 */
import type { JSX, ReactNode } from 'react'
import simbolo from './em-simbolo.svg'
import {
  ArrowLeftRight,
  ArrowUpDown,
  FileText,
  Gauge,
  Home,
  Icone,
  Layers,
  Notes,
  PencilEdit,
  Route,
  Wrench,
} from './icones.tsx'
import type { Desenho } from './icones.tsx'
import { Menu } from './primitivos.tsx'
import type { Opcao } from './primitivos.tsx'
import './geist.css'

export type IdDeItem =
  | 'geral'
  | 'viagens'
  | 'rotas'
  | 'frota'
  | 'registrar'
  | 'manutencao'
  | 'documentos'
  | 'atas'
  | 'integracoes'

type Grupo = 'Painel' | 'Registros' | 'Gestão'

type Item = {
  readonly id: IdDeItem
  readonly rotulo: string
  readonly icone: Desenho
  readonly href: string
  readonly grupo: Grupo
  /** Só as do Painel dividem os filtros, e só elas levam a query no href. */
  readonly comFiltros: boolean
}

const SIDEBAR: readonly Item[] = [
  { id: 'geral', rotulo: 'Visão geral', icone: Home, href: 'dashboard-semanal.html', grupo: 'Painel', comFiltros: true },
  { id: 'viagens', rotulo: 'Viagens', icone: Route, href: 'viagens.html', grupo: 'Painel', comFiltros: true },
  { id: 'rotas', rotulo: 'Rotas', icone: ArrowLeftRight, href: 'rotas.html', grupo: 'Painel', comFiltros: true },
  { id: 'frota', rotulo: 'Frota', icone: Gauge, href: 'frota.html', grupo: 'Painel', comFiltros: true },
  { id: 'registrar', rotulo: 'Registrar rota', icone: PencilEdit, href: 'formulario-registro.html', grupo: 'Registros', comFiltros: false },
  { id: 'manutencao', rotulo: 'Manutenção', icone: Wrench, href: 'manutencao-frota.html', grupo: 'Registros', comFiltros: false },
  { id: 'documentos', rotulo: 'Documentos', icone: FileText, href: 'documentos-frota.html', grupo: 'Registros', comFiltros: false },
  { id: 'atas', rotulo: 'Atas de reunião', icone: Notes, href: 'ata-reuniao.html', grupo: 'Gestão', comFiltros: false },
  { id: 'integracoes', rotulo: 'Integrações', icone: Layers, href: 'integracao-frota.html', grupo: 'Gestão', comFiltros: false },
]

const GRUPOS: readonly Grupo[] = ['Painel', 'Registros', 'Gestão']

/** Qual item da tabela responde por este caminho. `null` numa tela que nao esta na lista. */
export function ativaDe(caminho: string): IdDeItem | null {
  const arquivo = caminho.slice(caminho.lastIndexOf('/') + 1)
  return SIDEBAR.find((item) => item.href === arquivo)?.id ?? null
}

function sair(): void {
  // Tem que sair mesmo se a chamada falhar, senao quem clicou fica preso na tela.
  void fetch('/api/sair', { method: 'POST' }).finally(() => {
    window.location.href = '/entrar.html'
  })
}

export function Casca({ ativa, consulta, base, selos = {}, children }: {
  readonly ativa: IdDeItem | null
  /** A query dos filtros, com `?`, ou vazia. */
  readonly consulta: string
  readonly base: {
    readonly valor: string
    readonly rotulo: string
    readonly opcoes: readonly Opcao[]
    readonly aoEscolher: (valor: string) => void
  }
  /** Contagem ao lado do item, quando a pagina souber uma. */
  readonly selos?: Readonly<Partial<Record<IdDeItem, string>>>
  readonly children: ReactNode
}): JSX.Element {
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
                <span className="g-identidade-apoio">{base.rotulo}</span>
              </span>
              <Icone de={ArrowUpDown} />
            </>
          }
          itens={base.opcoes.map((o) => ({ rotulo: o.rotulo, aoEscolher: () => base.aoEscolher(o.valor) }))}
          aparencia="switcher"
        />

        <nav className="g-nav">
          {GRUPOS.map((grupo) => (
            <div className="g-grupo" key={grupo}>
              <div className="g-grupo-rotulo">{grupo}</div>
              {SIDEBAR.filter((item) => item.grupo === grupo).map((item) => {
                const selo = selos[item.id]
                return (
                  <a
                    key={item.id}
                    className="g-item"
                    href={item.comFiltros ? item.href + consulta : item.href}
                    aria-current={item.id === ativa ? 'page' : undefined}
                  >
                    <Icone de={item.icone} />
                    <span className="g-item-rotulo">{item.rotulo}</span>
                    {selo === undefined ? null : <span className="g-item-badge">{selo}</span>}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        <Menu
          nome="Conta"
          gatilho={
            <>
              <span className="g-avatar">HM</span>
              <span className="g-identidade">
                <span className="g-identidade-nome">Henrique Martins</span>
                <span className="g-identidade-apoio">Logística</span>
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
