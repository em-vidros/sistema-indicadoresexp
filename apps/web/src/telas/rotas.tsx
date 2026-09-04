/**
 * Rotas, a terceira das quatro telas do painel. O artboard e o `Rotas` de
 * `var/design-dashboard/build.mjs`, e ele manda no desenho.
 *
 * A tela nao tem estado nenhum. Tudo que ela mostra sai de `porRota` sobre os registros
 * que base e periodo deixaram passar, e os dois moram na query string, entao trocar
 * qualquer um recarrega. Nao ha busca, nao ha paginacao e a ordem e a do dominio, do
 * maior percentual de custo para o menor, que e o que o cabecalho do bloco promete.
 *
 * Os limites de faixa sao os mesmos da tabela de rotas da Visao geral, 7 e 10, para as
 * duas telas nao chamarem a mesma rota de coisas diferentes. O artboard escreveu "acima
 * de 8%" no cartao de atencao porque era o numero daqueles dados; aqui o texto sai da
 * meta, que e 7%.
 *
 * O CSV do "Exportar" leva as sete colunas da tabela, com o mesmo texto de cada celula.
 */
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegistros } from '../dashboard/carregar.ts'
import {
  ROTULO_DA_FAIXA,
  brl,
  calcularKPIs,
  diaMes,
  faixaDe,
  filtrarDados,
  porRota,
  porcento,
} from '../dashboard/dominio.ts'
import type { Rota, Tom } from '../dashboard/dominio.ts'
import {
  BASES,
  OPCOES_DE_BASE,
  OPCOES_DE_PERIODO,
  PERIODOS,
  consultaDe,
  lerFiltros,
} from '../dashboard/filtros.ts'
import type { Filtros } from '../dashboard/filtros.ts'
import { baixarCsv } from '../dashboard/relatorio.ts'
import { Casca, ativaDe } from '../geist/casca.tsx'
import { Download } from '../geist/icones.tsx'
import {
  Badge,
  Botao,
  COR_DO_TOM,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Estatistica,
  Grade,
  Seletor,
  Tabela,
  Td,
  Th,
} from '../geist/primitivos.tsx'
import type { Celula } from '../geist/primitivos.tsx'

/** A meta de custo sobre carga, e o limite a partir do qual a rota vira caso critico. */
const META_PCT = 7
const CRITICO_PCT = 10

const COLUNAS = ['Rota', 'Viagens', 'Carga', 'Custo', '% custo', 'Status', 'Última viagem']
/** As colunas numericas, alinhadas a direita como o artboard as desenhou. */
const A_DIREITA = new Set([1, 2, 3, 4, 6])

function tomDa(rota: Rota): Tom {
  return faixaDe(rota.pct, META_PCT, CRITICO_PCT) ?? 'ok'
}

function celulasDa(rota: Rota): readonly string[] {
  return [
    rota.rota,
    String(rota.n),
    brl(rota.carga),
    brl(rota.custo),
    porcento(rota.pct),
    ROTULO_DA_FAIXA[tomDa(rota)],
    rota.ultima === '' ? '—' : diaMes(rota.ultima),
  ]
}

/**
 * O destino de uma rota, para o cartao de atencao caber numa linha. Os nomes chegam em
 * duas escritas, "Raposa → Belem" no canvas e "Raposa-Belem" no cadastro, entao o corte e
 * no primeiro separador que existir. Rota sem separador aparece inteira.
 */
function destinoDe(rota: string): string {
  const corte = rota.search(/[→-]/)
  return corte === -1 ? rota : rota.slice(corte + 1).trim()
}

function quaisEmAtencao(rotas: readonly Rota[]): string {
  const nomes = rotas.filter((r) => tomDa(r) !== 'ok').map((r) => destinoDe(r.rota))
  if (nomes.length === 0) return `todas abaixo de ${META_PCT}%`
  const resto = nomes.length - 2
  const mostradas = resto > 0
    ? `${nomes.slice(0, 2).join(', ')} e mais ${resto}`
    : nomes.join(' e ')
  return `${mostradas} acima de ${META_PCT}%`
}

function TabelaDeRotas({ rotas }: { readonly rotas: readonly Rota[] }): JSX.Element {
  return (
    <>
      <CabecalhoDeBloco titulo="Todas as rotas" subtitulo="Ordenadas pelo % de custo sobre a carga" />
      <Tabela cabecalho={COLUNAS.map((coluna, i) => <Th key={coluna} direita={A_DIREITA.has(i)}>{coluna}</Th>)}>
        {rotas.length === 0
          ? <tr><Td colunas={COLUNAS.length} vazio>Sem viagens no período</Td></tr>
          : rotas.map((rota) => {
            const tom = tomDa(rota)
            const [nome, n, carga, custo, pct, , ultima] = celulasDa(rota)
            return (
              <tr key={rota.rota}>
                <Td><span className="g-forte">{nome}</span></Td>
                <Td direita>{n}</Td>
                <Td direita>{carga}</Td>
                <Td direita>{custo}</Td>
                <Td direita>
                  <span className={tom === 'ok' ? 'g-forte' : `g-forte g-tom-${tom}`}>{pct}</span>
                </Td>
                <Td><Badge rotulo={ROTULO_DA_FAIXA[tom]} cor={COR_DO_TOM[tom]} /></Td>
                <Td direita>{ultima}</Td>
              </tr>
            )
          })}
      </Tabela>
    </>
  )
}

function celulasDe(rotas: readonly Rota[], viagens: number): readonly Celula[] {
  const dentro = rotas.filter((r) => tomDa(r) === 'ok').length
  return [
    {
      col: [1, 5],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Rotas ativas"
          valor={String(rotas.length)}
          apoio={`${viagens} ${viagens === 1 ? 'viagem' : 'viagens'} no período`}
        />
      ),
    },
    {
      col: [5, 9],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Dentro da meta"
          valor={String(dentro)}
          apoio={`custo / carga abaixo de ${META_PCT}%`}
        />
      ),
    },
    {
      col: [9, 13],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Em atenção"
          valor={String(rotas.length - dentro)}
          apoio={quaisEmAtencao(rotas)}
        />
      ),
    },
    { col: [1, 13], linha: 2, rente: true, conteudo: <TabelaDeRotas rotas={rotas} /> },
  ]
}

function Rotas(): JSX.Element {
  const filtros = lerFiltros(window.location.search)
  const consulta = consultaDe(filtros)
  const { itens } = useRegistros()

  const viagens = calcularKPIs(filtrarDados(itens, filtros.base, filtros.periodo)).viagens
  const rotas = porRota(viagens)

  const irPara = (novos: Filtros): void => {
    window.location.search = consultaDe(novos)
  }

  const exportar = (): void => {
    baixarCsv(`rotas-${filtros.base}-${filtros.periodo}.csv`, [COLUNAS, ...rotas.map(celulasDa)])
  }

  return (
    <Casca
      ativa={ativaDe(window.location.pathname)}
      consulta={consulta}
      base={{
        valor: filtros.base,
        rotulo: BASES[filtros.base].naCasca,
        opcoes: OPCOES_DE_BASE,
        aoEscolher: (base) => irPara({ ...filtros, base }),
      }}
      selos={{ viagens: String(viagens.length) }}
    >
      <CabecalhoDePagina
        titulo="Rotas"
        subtitulo={`${rotas.length} ${rotas.length === 1 ? 'rota' : 'rotas'} · ${PERIODOS[filtros.periodo].rotulo} · ${BASES[filtros.base].naCasca}`}
        acoes={
          <>
            <Seletor
              rotulo="Período"
              valor={filtros.periodo}
              opcoes={OPCOES_DE_PERIODO}
              aoEscolher={(periodo) => irPara({ ...filtros, periodo })}
            />
            <Botao rotulo="Exportar" antes={Download} aoClicar={exportar} />
          </>
        }
      />
      <Grade celulas={celulasDe(rotas, viagens.length)} />
    </Casca>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<Rotas />)
