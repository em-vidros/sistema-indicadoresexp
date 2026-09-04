/**
 * Viagens, a segunda das quatro telas do painel. O artboard e o `Viagens` de
 * `var/design-dashboard/build.mjs`, e ele manda no desenho.
 *
 * Dois mecanismos de estado, e a fronteira entre eles e uma pergunta so: isto atravessa a
 * navegacao? Base e periodo atravessam, porque as quatro telas do painel dividem os dois,
 * entao eles moram na query string e trocar qualquer um recarrega a pagina. Busca,
 * pontualidade e numero da pagina nao atravessam: sao o jeito de olhar esta tabela, nao
 * existem nas outras tres, e por isso ficam em `useState`. Poe-los na query obrigaria
 * `consultaDe` a carregar tres campos que so uma tela le, e a sidebar levaria os tres
 * para Rotas e Frota, onde nao significam nada.
 *
 * O preco disso e visivel e foi aceito: trocar base ou periodo recarrega, e a busca e a
 * pontualidade voltam ao padrao junto. E o mesmo preco que a Visao geral paga na janela
 * do grafico.
 *
 * A vista e um objeto so, e nao tres `useState`, porque mudar busca ou pontualidade
 * obriga a pagina a voltar para 1. Com estados separados esse retorno e uma linha que
 * alguem esquece no proximo filtro; com um objeto, `restringir` e o unico caminho e ele
 * ja leva a pagina junto.
 *
 * O botao quadrado de filtro do artboard nao tem comportamento desenhado. Ele ficou, com
 * um trabalho de verdade, que e voltar a tela ao padrao: limpa busca, pontualidade, base
 * e periodo de uma vez, escrevendo a query padrao, o que recarrega e zera tudo pelo mesmo
 * caminho. Botao desenhado que nao faz nada e pior que botao ausente.
 *
 * O CSV do "Exportar" leva as mesmas colunas, o mesmo texto de cada celula e a mesma
 * ordem da tabela, e leva todas as linhas que os filtros deixaram passar, nao so as dez
 * da pagina aberta. A paginacao e a janela por onde se olha a tabela, e nao a tabela.
 */
import { useState } from 'react'
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegistros } from '../dashboard/carregar.ts'
import { PONTUALIDADES, brl, calcularKPIs, diaMes, filtrarDados, porcento } from '../dashboard/dominio.ts'
import type { Item, Pontualidade } from '../dashboard/dominio.ts'
import {
  BASES,
  FILTROS_PADRAO,
  OPCOES_DE_BASE,
  OPCOES_DE_PERIODO,
  PERIODOS,
  consultaDe,
  lerFiltros,
} from '../dashboard/filtros.ts'
import type { Filtros } from '../dashboard/filtros.ts'
import { baixarCsv } from '../dashboard/relatorio.ts'
import { Casca, ativaDe } from '../geist/casca.tsx'
import { ChevronLeft, ChevronRight, Download, Filter, Plus } from '../geist/icones.tsx'
import {
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Entrada,
  Grade,
  Seletor,
  Tabela,
  Td,
  Th,
} from '../geist/primitivos.tsx'
import type { CorDeBadge, Opcao } from '../geist/primitivos.tsx'

type Viagem = Extract<Item, { tipo: 'viagem' }>

/** As dez linhas por pagina do artboard, que desenhou "1-10 de 33" e "Pagina 1 de 4". */
const POR_PAGINA = 10

const BADGE_DA_PONTUALIDADE: Readonly<Record<Pontualidade, CorDeBadge>> = {
  adiantado: 'teal',
  no_prazo: 'verde',
  atrasado: 'vermelho',
}

/** O filtro de pontualidade, com o "Todas" que nao e uma classificacao, na frente. */
type FiltroDePontualidade = Pontualidade | 'todas'

const OPCOES_DE_PONTUALIDADE: ReadonlyArray<Opcao<FiltroDePontualidade>> = [
  { valor: 'todas', rotulo: 'Todas' },
  ...(Object.keys(PONTUALIDADES) as Pontualidade[]).map((valor) => ({
    valor,
    rotulo: PONTUALIDADES[valor].rotulo,
  })),
]

type Vista = {
  readonly busca: string
  readonly pontualidade: FiltroDePontualidade
  readonly pagina: number
}

const VISTA_INICIAL: Vista = { busca: '', pontualidade: 'todas', pagina: 1 }

/** Toda mudanca de recorte volta para a primeira pagina, senao a tabela abre vazia. */
function restringir(vista: Vista, mudanca: Partial<Omit<Vista, 'pagina'>>): Vista {
  return { ...vista, ...mudanca, pagina: 1 }
}

/**
 * A ordem da tabela: a saida mais recente em cima. Comparacao de texto porque as datas
 * chegam em `AAAA-MM-DD`, onde a ordem alfabetica ja e a cronologica.
 */
function dataDa(viagem: Viagem): string {
  return viagem.dataSaida || viagem.quando
}

function combina(viagem: Viagem, busca: string): boolean {
  const alvo = busca.trim().toLowerCase()
  if (alvo === '') return true
  return `${viagem.motorista} ${viagem.veiculo} ${viagem.rota}`.toLowerCase().includes(alvo)
}

/** As colunas da tabela, na ordem em que o artboard as desenhou. */
const COLUNAS = ['Data', 'Motorista', 'Veículo', 'Rota', 'Km', 'Carga', 'Custo', '% custo', 'Pontualidade']

/** O texto de cada celula da linha, que e o mesmo que a tabela mostra e o que o CSV leva. */
function celulasDa(viagem: Viagem): readonly string[] {
  return [
    diaMes(dataDa(viagem)),
    viagem.motorista || '—',
    viagem.veiculo || '—',
    viagem.rota || '—',
    viagem.km === null ? '—' : viagem.km.toLocaleString('pt-BR'),
    brl(viagem.valorCarga),
    brl(viagem.custoViagem),
    porcento(viagem.pctCusto),
    viagem.pontualidade === null ? '—' : PONTUALIDADES[viagem.pontualidade].rotulo,
  ]
}

function Linha({ viagem }: { readonly viagem: Viagem }): JSX.Element {
  const [data, motorista, veiculo, rota, km, carga, custo, pct, pontualidade] = celulasDa(viagem)
  // Os 9% sao do artboard, e nao os limites do KPI. `faixaDe` diria "atencao" em 7%, e
  // numa semana ruim a coluna inteira ficaria ambar, onde nada salta.
  const critico = viagem.pctCusto >= 9
  return (
    <tr>
      <Td><span className="g-l13m g-fraco">{data}</span></Td>
      <Td><span className="g-forte">{motorista}</span></Td>
      <Td><span className="g-l13m">{veiculo}</span></Td>
      <Td>{rota}</Td>
      <Td direita>{km}</Td>
      <Td direita>{carga}</Td>
      <Td direita>{custo}</Td>
      <Td direita><span className={critico ? 'g-forte g-tom-critico' : 'g-forte'}>{pct}</span></Td>
      <Td>
        {viagem.pontualidade === null
          ? '—'
          : <Badge rotulo={pontualidade} cor={BADGE_DA_PONTUALIDADE[viagem.pontualidade]} />}
      </Td>
    </tr>
  )
}

function Viagens(): JSX.Element {
  const filtros = lerFiltros(window.location.search)
  const consulta = consultaDe(filtros)
  const { itens } = useRegistros()
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)

  const todas = calcularKPIs(filtrarDados(itens, filtros.base, filtros.periodo)).viagens
  const achadas = [...todas]
    .filter((v) => vista.pontualidade === 'todas' || v.pontualidade === vista.pontualidade)
    .filter((v) => combina(v, vista.busca))
    .sort((a, b) => dataDa(b).localeCompare(dataDa(a)))

  const paginas = Math.max(1, Math.ceil(achadas.length / POR_PAGINA))
  // A pagina guardada pode ter ficado alem do fim quando os registros chegaram ou quando
  // o filtro encolheu a lista. Ler presa ao intervalo e mais barato que sincronizar.
  const pagina = Math.min(vista.pagina, paginas)
  const primeira = (pagina - 1) * POR_PAGINA
  const naPagina = achadas.slice(primeira, primeira + POR_PAGINA)

  const irPara = (novos: Filtros): void => {
    window.location.search = consultaDe(novos)
  }

  const exportar = (): void => {
    baixarCsv(`viagens-${filtros.base}-${filtros.periodo}.csv`, [COLUNAS, ...achadas.map(celulasDa)])
  }

  const tabela = (
    <>
      <CabecalhoDeBloco
        titulo="Viagens do período"
        subtitulo={achadas.length === 0
          ? 'Nenhuma viagem com este recorte'
          : `${primeira + 1}–${primeira + naPagina.length} de ${achadas.length}`}
      />
      <Tabela cabecalho={COLUNAS.map((coluna, i) => <Th key={coluna} direita={i >= 4 && i <= 7}>{coluna}</Th>)}>
        {naPagina.length === 0
          ? <tr><Td colunas={COLUNAS.length} vazio>Sem viagens no período</Td></tr>
          : naPagina.map((viagem, i) => <Linha key={primeira + i} viagem={viagem} />)}
      </Tabela>
      <div className="g-paginacao">
        <span className="g-paginacao-conta g-l13">Página {pagina} de {paginas}</span>
        <div className="g-paginacao-botoes">
          <Botao
            rotulo="Anterior"
            antes={ChevronLeft}
            aoClicar={() => setVista((atual) => ({ ...atual, pagina: Math.max(1, pagina - 1) }))}
          />
          <Botao
            rotulo="Próxima"
            depois={ChevronRight}
            aoClicar={() => setVista((atual) => ({ ...atual, pagina: Math.min(paginas, pagina + 1) }))}
          />
        </div>
      </div>
    </>
  )

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
      selos={{ viagens: String(todas.length) }}
    >
      <CabecalhoDePagina
        titulo="Viagens"
        subtitulo={`${todas.length} ${todas.length === 1 ? 'viagem' : 'viagens'} · ${PERIODOS[filtros.periodo].rotulo} · ${BASES[filtros.base].naCasca}`}
        acoes={
          <>
            <Botao rotulo="Exportar" antes={Download} aoClicar={exportar} />
            <Botao rotulo="Registrar rota" tipo="primario" antes={Plus} href="formulario-registro.html" />
          </>
        }
      />

      <div className="g-barra">
        <Entrada
          marcador="Buscar motorista, placa ou rota"
          largura={300}
          valor={vista.busca}
          aoDigitar={(busca) => setVista((atual) => restringir(atual, { busca }))}
        />
        <Seletor
          rotulo="Base"
          valor={filtros.base}
          opcoes={OPCOES_DE_BASE}
          aoEscolher={(base) => irPara({ ...filtros, base })}
        />
        <Seletor
          rotulo="Período"
          valor={filtros.periodo}
          opcoes={OPCOES_DE_PERIODO}
          aoEscolher={(periodo) => irPara({ ...filtros, periodo })}
        />
        <Seletor
          rotulo="Pontualidade"
          valor={vista.pontualidade}
          opcoes={OPCOES_DE_PONTUALIDADE}
          aoEscolher={(pontualidade) => setVista((atual) => restringir(atual, { pontualidade }))}
        />
        <span className="g-barra-vao" />
        <Botao nome="Limpar filtros" antes={Filter} aoClicar={() => irPara(FILTROS_PADRAO)} />
      </div>

      <Grade celulas={[{ col: [1, 13], linha: 1, rente: true, conteudo: tabela }]} />
    </Casca>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<Viagens />)
