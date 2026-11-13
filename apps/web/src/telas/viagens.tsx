/**
 * Viagens, a segunda das quatro telas do painel. O artboard e o `Viagens` de
 * `var/design-dashboard/build.mjs`, e ele manda no desenho.
 *
 * Dois mecanismos de estado, e a fronteira entre eles e uma pergunta so: isto atravessa a
 * navegacao? Base e periodo atravessam, porque as quatro telas do painel dividem os dois,
 * entao eles moram na query string pelo `useFiltros` do nuqs e trocar qualquer um
 * escreve a query nova. Busca,
 * pontualidade e numero da pagina nao atravessam: sao o jeito de olhar esta tabela, nao
 * existem nas outras tres, e por isso ficam em `useState`. Poe-los na query obrigaria
 * `consultaDe` a carregar tres campos que so uma tela le, e a sidebar levaria os tres
 * para Rotas e Frota, onde nao significam nada.
 *
 * O preco disso e visivel e foi aceito: trocar base ou periodo escreve a query nova, e
 * a busca e a pontualidade voltam ao padrao junto porque o componente da tela e
 * remontado. E o mesmo preco que a Visao geral paga na janela do grafico.
 *
 * A vista e um objeto so, e nao tres `useState`, porque mudar busca ou pontualidade
 * obriga a pagina a voltar para 1. Com estados separados esse retorno e uma linha que
 * alguem esquece no proximo filtro; com um objeto, `restringir` e o unico caminho e ele
 * ja leva a pagina junto.
 *
 * O botao quadrado de filtro do artboard nao tem comportamento desenhado. Ele ficou, com
 * um trabalho de verdade, que e voltar a tela ao padrao: limpa busca, pontualidade, base
 * e periodo de uma vez, navegando para a query padrao, o que zera tudo pelo mesmo
 * caminho. Botao desenhado que nao faz nada e pior que botao ausente.
 *
 * O "Exportar Excel" gera um .xlsx com as mesmas colunas e a mesma ordem da tabela, mas com
 * numero como numero e data como data (o texto "R$ 1.234,00" nao somava no Excel). Leva
 * todas as linhas que os filtros deixaram passar, mes incluido, nao so as dez da pagina
 * aberta. A paginacao e a janela por onde se olha a tabela, e nao a tabela.
 *
 * O seletor "Mes" e da vista, e nao da query: so existe aqui, e lista os meses que tem
 * viagem no recorte de base e periodo. Ele filtra por cima do periodo, entao para ver um
 * mes antigo o periodo precisa ser "Todo o periodo".
 */
import { useState } from 'react'
import type { JSX } from 'react'
import { invalidar } from '../app/dados.ts'
import { useRegistros } from '../dashboard/carregar.ts'
import { EstadoDosRegistros } from '../dashboard/estado-dos-registros.tsx'
import { PONTUALIDADES, brl, calcularKPIs, diaMes, filtrarDados, porcento, texto } from '../dashboard/dominio.ts'
import { COLUNAS_DO_EXCEL, linhaDoExcel } from '../dashboard/excel-viagens.ts'
import type { Item, Pontualidade } from '../dashboard/dominio.ts'
import {
  BASES,
  FILTROS_PADRAO,
  OPCOES_DE_BASE,
  OPCOES_DE_PERIODO,
  rotuloDoPeriodo,
  useFiltros,
} from '../dashboard/filtros.ts'
import type { Filtros } from '../dashboard/filtros.ts'
import { baixarXlsx } from '../dashboard/relatorio.ts'
import { Dialogo, useAvisos } from '../geist/formulario.tsx'
import { ChevronLeft, ChevronRight, Download, Filter, PencilEdit, Plus, Trash } from '../geist/icones.tsx'
import { apagarRegistro } from '../js/registros-api.ts'
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
  /** `todos`, ou o mes escolhido como `AAAA-MM`. */
  readonly mes: string
  readonly pagina: number
}

const VISTA_INICIAL: Vista = { busca: '', pontualidade: 'todas', mes: 'todos', pagina: 1 }

const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

/** `AAAA-MM` da viagem, que e o que o seletor de mes compara. */
function mesDa(viagem: Viagem): string {
  return dataDa(viagem).slice(0, 7)
}

/** `2026-10` vira `Outubro/2026`. */
function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split('-')
  return `${NOMES_DOS_MESES[Number(numero) - 1] ?? mes}/${ano}`
}

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
// A ultima coluna, sem titulo, e a das acoes (Editar e Apagar).
const COLUNAS = ['Data', 'Motorista', 'Veículo', 'Rota', 'Km', 'Carga', 'Custo', '% custo', 'Pontualidade', '']

/** O texto de cada celula da linha, que e o mesmo que a tabela mostra e o que o CSV leva. */
function celulasDa(viagem: Viagem): readonly string[] {
  return [
    diaMes(dataDa(viagem)),
    viagem.motorista || '·',
    viagem.veiculo || '·',
    viagem.rota || '·',
    viagem.km === null ? '·' : viagem.km.toLocaleString('pt-BR'),
    brl(viagem.valorCarga),
    brl(viagem.custoViagem),
    porcento(viagem.pctCusto),
    viagem.pontualidade === null ? '·' : PONTUALIDADES[viagem.pontualidade].rotulo,
  ]
}

function Linha({ viagem, aoApagar }: {
  readonly viagem: Viagem
  readonly aoApagar: (viagem: Viagem) => void
}): JSX.Element {
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
          ? '·'
          : <Badge rotulo={pontualidade} cor={BADGE_DA_PONTUALIDADE[viagem.pontualidade]} />}
      </Td>
      <Td direita>
        <span className="g-rodape-acoes">
          {/* Editar abre a viagem no formulario do Registrar, que ja valida e grava. */}
          <Botao
            tipo="terciario"
            antes={PencilEdit}
            rotulo="Editar"
            href={`/registrar?tipo=viagem&editar=${encodeURIComponent(texto(viagem.bruto, 'id'))}`}
          />
          <Botao tipo="terciario" antes={Trash} nome="Apagar" aoClicar={() => aoApagar(viagem)} />
        </span>
      </Td>
    </tr>
  )
}

export default function Viagens(): JSX.Element {
  const [filtros, definirFiltros] = useFiltros()
  const registros = useRegistros()
  const { itens } = registros
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)
  const { avisar } = useAvisos()
  /** A viagem esperando confirmacao para apagar, ou nulo com o dialogo fechado. */
  const [apagando, setApagando] = useState<Viagem | null>(null)
  const [apagandoEmProgresso, setApagandoEmProgresso] = useState(false)

  async function confirmarApagar(): Promise<void> {
    const id = apagando === null ? '' : texto(apagando.bruto, 'id')
    if (id === '') return
    setApagandoEmProgresso(true)
    try {
      await apagarRegistro('viagem', id)
      invalidar('registros')
      setApagando(null)
      avisar('Viagem apagada.', 'ok')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não foi possível apagar.', 'erro')
    } finally {
      setApagandoEmProgresso(false)
    }
  }

  const todas = calcularKPIs(filtrarDados(itens, filtros.base, filtros.periodo, filtros.mes)).viagens
  // So os meses que tem viagem no recorte de base e periodo: escolher um mes vazio so
  // mostraria uma tabela vazia. O mais recente primeiro.
  const mesesComViagem = [...new Set(todas.map(mesDa).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse()
  const OPCOES_DE_MES: ReadonlyArray<Opcao<string>> = [
    { valor: 'todos', rotulo: 'Todos' },
    ...mesesComViagem.map((valor) => ({ valor, rotulo: rotuloDoMes(valor) })),
  ]
  const achadas = [...todas]
    .filter((v) => vista.mes === 'todos' || mesDa(v) === vista.mes)
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
    void definirFiltros(novos)
  }

  /**
   * O Excel recebe numero como numero e data como data, e nao o texto da tabela: "R$ 1.234,00"
   * entrava como texto e nao somava. Leva todas as linhas que os filtros deixaram, incluindo o
   * mes escolhido, e nao so as dez da pagina.
   */
  const exportar = async (): Promise<void> => {
    if (achadas.length === 0) {
      avisar('Não há viagens neste recorte para exportar.', 'erro')
      return
    }
    const cabecalho = COLUNAS_DO_EXCEL.map(([value]) => ({ value, fontWeight: 'bold' as const }))
    try {
      await baixarXlsx(
        `viagens-${filtros.base}-${vista.mes === 'todos' ? filtros.mes ?? filtros.periodo : vista.mes}.xlsx`,
        [cabecalho, ...achadas.map(linhaDoExcel)],
        COLUNAS_DO_EXCEL.map(([, largura]) => largura),
      )
    } catch {
      avisar('Não foi possível gerar o Excel. Tente de novo.', 'erro')
    }
  }

  const tabela = (
    <>
      <CabecalhoDeBloco
        titulo="Viagens do período"
        subtitulo={achadas.length === 0
          ? 'Nenhuma viagem com este recorte'
          : `${primeira + 1}–${primeira + naPagina.length} de ${achadas.length}`}
      />
      <Tabela cabecalho={COLUNAS.map((coluna, i) => <Th key={coluna || 'acoes'} direita={(i >= 4 && i <= 7) || coluna === ''}>{coluna === '' ? <span className="g-escondido">Ações</span> : coluna}</Th>)}>
        {naPagina.length === 0
          ? <tr><Td colunas={COLUNAS.length} vazio>Sem viagens no período</Td></tr>
          : naPagina.map((viagem, i) => <Linha key={primeira + i} viagem={viagem} aoApagar={setApagando} />)}
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
    <EstadoDosRegistros registros={registros} titulo="Viagens">
      <CabecalhoDePagina
        titulo="Viagens"
        subtitulo={`${todas.length} ${todas.length === 1 ? 'viagem' : 'viagens'} · ${rotuloDoPeriodo(filtros)} · ${BASES[filtros.base].naCasca}`}
        acoes={
          <>
            <Botao rotulo="Exportar Excel" antes={Download} aoClicar={() => void exportar()} />
            <Botao rotulo="Registrar rota" tipo="primario" antes={Plus} href="/registrar" />
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
          aoEscolher={(periodo) => irPara({ ...filtros, periodo, mes: null })}
        />
        <Seletor
          rotulo="Mês"
          valor={vista.mes}
          opcoes={OPCOES_DE_MES}
          aoEscolher={(mes) => setVista((atual) => restringir(atual, { mes }))}
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

      <Dialogo
        aberto={apagando !== null}
        titulo="Apagar viagem"
        subtitulo="Viagens"
        aoFechar={() => setApagando(null)}
        acoes={
          <>
            <Botao tipo="terciario" rotulo="Cancelar" aoClicar={() => setApagando(null)} />
            <Botao
              tipo="primario"
              rotulo="Apagar viagem"
              carregando={apagandoEmProgresso}
              aoClicar={() => void confirmarApagar()}
            />
          </>
        }
      >
        <div className="g-l14">
          {apagando === null
            ? null
            : `Isto apaga a viagem de ${diaMes(apagando.dataSaida || apagando.quando)}, ${apagando.veiculo} · ${apagando.rota}, e os abastecimentos lançados nela. Não tem como desfazer pela tela.`}
        </div>
      </Dialogo>
    </EstadoDosRegistros>
  )
}
