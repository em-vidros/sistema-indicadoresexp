import { EstadoDosRegistros } from '../dashboard/estado-dos-registros.tsx'
/**
 * A Visao geral, a primeira das quatro telas do painel redesenhado. O artboard e o `Main`
 * de `var/design-dashboard/build.mjs`, e ele manda no desenho.
 *
 * O nome do arquivo fica. As seis telas congeladas linkam para `dashboard-semanal.html`, e
 * o servidor redireciona esse caminho velho para `/visao-geral`.
 *
 * Nao ha estado de filtro. Base e periodo saem da query pelo `useFiltros` do nuqs, e
 * trocar qualquer um dos dois escreve a query nova no historico. E o mesmo mecanismo
 * que leva o filtro para Viagens, Rotas e Frota pelo href da sidebar, sem uma linha de
 * sincronia entre as quatro telas, e ele e idempotente porque o que a tela mostra
 * depende so da URL.
 *
 * A janela do grafico e a unica coisa que fica em `useState`. Ela nao e filtro: nao muda
 * numero nenhum fora do proprio grafico e nao tem por que sobreviver a navegacao.
 *
 * Nao ha prova de pixel para esta tela: `verificar/olhar-dashboard.ts` fotografa o painel
 * para alguem olhar, e e isso.
 */
import { useState } from 'react'
import type { JSX } from 'react'
import { useRegistros } from '../dashboard/carregar.ts'
import type { Sincronia } from '../dashboard/carregar.ts'
import {
  ROTULO_DA_FAIXA,
  brl,
  brlCentavos,
  calcularKPIs,
  faixaDe,
  filtrarDados,
  indicadoresDeCusto,
  porRota,
  porcento,
  semanasDoGrafico,
} from '../dashboard/dominio.ts'
import type { CustoDaPlaca, Indicadores, Rota } from '../dashboard/dominio.ts'
import {
  BASES,
  OPCOES_DE_PERIODO,
  PERIODOS,
  consultaDe,
  mesAnterior,
  periodoAnterior,
  rotuloDoMes,
  rotuloDoPeriodo,
  useFiltros,
} from '../dashboard/filtros.ts'
import type { Filtros } from '../dashboard/filtros.ts'
import { SeletorDeMes } from '../dashboard/seletor-de-mes.tsx'
import { GraficoCustoCarga, Sparkline } from '../dashboard/graficos.tsx'
import type { Semana } from '../dashboard/graficos.tsx'
import { baixarTexto, copiar, textoDoRelatorio, textoDoWhatsApp } from '../dashboard/relatorio.ts'
import { ArrowDownRight, ArrowUpRight, Icone, MoreHorizontal, Plus } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
  COR_DO_TOM,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Grade,
  Kpi,
  Link,
  Menu,
  Seletor,
  Tabela,
  Td,
  Th,
} from '../geist/primitivos.tsx'
import type { Celula, Delta } from '../geist/primitivos.tsx'

/** As tres janelas da aba do grafico, na ordem em que o canvas as desenhou. */
const JANELAS = [8, 12, 26] as const
const ROTULOS_DA_JANELA = ['8 semanas', '12', '26']

function comoSincronizou(sincronia: Sincronia): string {
  if (sincronia.estado === 'carregando') return 'carregando'
  if (sincronia.estado === 'offline') return 'sem conexão'
  return `sincronizado às ${sincronia.quando}`
}

/**
 * A variacao do custo por carga contra a janela anterior, em pontos percentuais. Cair e
 * bom, entao a seta para baixo e verde. Diferenca zero nao vira delta: uma seta apontando
 * para "0,00 pt" diz menos do que a ausencia dela.
 */
function deltaDoCusto(agora: number | null, antes: number | null): Delta | undefined {
  if (agora === null || antes === null) return undefined
  const diferenca = agora - antes
  if (diferenca === 0) return undefined
  const magnitude = `${Math.abs(diferenca).toFixed(2).replace('.', ',')} pt`
  return diferenca < 0
    ? { icone: ArrowDownRight, texto: `−${magnitude}`, tom: 'ok' }
    : { icone: ArrowUpRight, texto: `+${magnitude}`, tom: 'critico' }
}

/**
 * A variacao de um custo em reais contra a janela anterior. Cair e bom: seta para baixo e
 * verde. Diferenca de menos de um centavo nao vira delta, pelo mesmo motivo de `deltaDoCusto`.
 */
function deltaEmReais(agora: number | null, antes: number | null): Delta | undefined {
  if (agora === null || antes === null) return undefined
  const diferenca = agora - antes
  if (Math.abs(diferenca) < 0.005) return undefined
  const magnitude = brlCentavos(Math.abs(diferenca))
  return diferenca < 0
    ? { icone: ArrowDownRight, texto: `−${magnitude}`, tom: 'ok' }
    : { icone: ArrowUpRight, texto: `+${magnitude}`, tom: 'critico' }
}

/** Com um mes escolhido o anterior e o mes de antes; sem, e o periodo anterior de sempre. */
function rotuloDoAnterior(filtros: Filtros): string | null {
  if (filtros.mes !== null) return rotuloDoMes(mesAnterior(filtros.mes))
  const anterior = periodoAnterior(filtros.periodo)
  return anterior === null ? null : PERIODOS[anterior].rotulo.toLowerCase()
}

function TabelaDePlacas({ placas }: { readonly placas: readonly CustoDaPlaca[] }): JSX.Element {
  const cabecalho = (
    <>
      <Th>Placa</Th>
      <Th direita>Viagens</Th>
      <Th direita>km rodados</Th>
      <Th direita>Combustível</Th>
      <Th direita>Manutenção</Th>
      <Th direita>Custo total</Th>
      <Th direita>Custo / km</Th>
    </>
  )
  return (
    <>
      <CabecalhoDeBloco
        titulo="Custo por placa"
        subtitulo="Combustível das viagens + manutenção · ordenadas pelo custo total"
      />
      <Tabela cabecalho={cabecalho}>
        {placas.length === 0
          ? <tr><Td colunas={7} vazio>Sem viagens nem manutenções no período</Td></tr>
          : placas.map((placa) => (
            <tr key={placa.placa}>
              <Td><span className="g-forte">{placa.placa}</span></Td>
              <Td direita>{placa.viagens}</Td>
              <Td direita>{placa.km > 0 ? placa.km.toLocaleString('pt-BR') : '·'}</Td>
              <Td direita>{brl(placa.combustivel)}</Td>
              <Td direita>{brl(placa.manutencao)}</Td>
              <Td direita><span className="g-forte">{brl(placa.custo)}</span></Td>
              <Td direita><span className="g-forte">{brlCentavos(placa.custoKm)}</span></Td>
            </tr>
          ))}
      </Tabela>
    </>
  )
}

function linhasDoResumo(kpis: Indicadores): ReadonlyArray<readonly [string, string, string]> {
  const km = kpis.viagens.reduce((soma, v) => soma + (v.km ?? 0), 0)
  const litros = kpis.abasts.reduce((soma, a) => soma + a.litros, 0)
  const veiculos = new Set(kpis.manuts.map((m) => m.placa).filter((placa) => placa !== '')).size
  return [
    ['Carga transportada', `${kpis.viagens.length} ${kpis.viagens.length === 1 ? 'viagem' : 'viagens'} · ${km.toLocaleString('pt-BR')} km`, brl(kpis.totalCarga)],
    ['Custo de viagens', 'diárias, pedágio e frete', brl(kpis.totalCustoV)],
    ['Abastecimento', `${litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`, brl(kpis.totalAbast)],
    ['Manutenções', `${kpis.manuts.length} ${kpis.manuts.length === 1 ? 'serviço' : 'serviços'} · ${veiculos} ${veiculos === 1 ? 'veículo' : 'veículos'}`, brl(kpis.totalManut)],
  ]
}

function Resumo({ kpis }: { readonly kpis: Indicadores }): JSX.Element {
  return (
    <>
      <CabecalhoDeBloco titulo="Resumo do período" subtitulo="Somas dos registros filtrados" rente />
      <div className="g-linhas">
        {linhasDoResumo(kpis).map(([rotulo, apoio, valor]) => (
          <div className="g-linha" key={rotulo}>
            <div>
              <div className="g-linha-rotulo g-l14">{rotulo}</div>
              <div className="g-linha-apoio g-l12">{apoio}</div>
            </div>
            <div className="g-linha-valor g-tab">{valor}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function TabelaDeRotas({ rotas, consulta }: {
  readonly rotas: readonly Rota[]
  readonly consulta: string
}): JSX.Element {
  const cabecalho = (
    <>
      <Th>Rota</Th>
      <Th direita>Viagens</Th>
      <Th direita>Carga</Th>
      <Th direita>Custo</Th>
      <Th direita>% custo</Th>
      <Th>Status</Th>
    </>
  )
  return (
    <>
      <CabecalhoDeBloco
        titulo="Rotas por custo / carga"
        subtitulo={rotas.length > 5
          ? '5 rotas com mais custo · ordenadas pelo % de custo'
          : 'Ordenadas pelo % de custo'}
        direita={<Link href={`/rotas${consulta}`}>Ver todas as rotas</Link>}
      />
      <Tabela cabecalho={cabecalho}>
        {rotas.length === 0
          ? <tr><Td colunas={6} vazio>Sem viagens no período</Td></tr>
          : rotas.slice(0, 5).map((rota) => {
            const tom = faixaDe(rota.pct, 7, 10) ?? 'ok'
            return (
              <tr key={rota.rota}>
                <Td><span className="g-forte">{rota.rota}</span></Td>
                <Td direita>{rota.n}</Td>
                <Td direita>{brl(rota.carga)}</Td>
                <Td direita>{brl(rota.custo)}</Td>
                <Td direita>
                  <span className={tom === 'ok' ? 'g-forte' : `g-forte g-tom-${tom}`}>{porcento(rota.pct)}</span>
                </Td>
                <Td><Badge rotulo={ROTULO_DA_FAIXA[tom]} cor={COR_DO_TOM[tom]} /></Td>
              </tr>
            )
          })}
      </Tabela>
    </>
  )
}

function celulasDe({ kpis, anteriores, custos, custosAnteriores, semanas, rotas, filtros, consulta, grafico }: {
  readonly kpis: Indicadores
  readonly anteriores: Indicadores | null
  readonly custos: ReturnType<typeof indicadoresDeCusto>
  readonly custosAnteriores: ReturnType<typeof indicadoresDeCusto> | null
  readonly semanas: readonly Semana[]
  readonly rotas: readonly Rota[]
  readonly filtros: Filtros
  readonly consulta: string
  readonly grafico: JSX.Element
}): readonly Celula[] {
  const noPrazo = kpis.pont.adiantado + kpis.pont.no_prazo
  const atrasoPct = kpis.pont.total === 0 ? null : (kpis.pont.atrasado / kpis.pont.total) * 100
  const m2Expedido = kpis.quebras.reduce((soma, q) => soma + q.m2Expedido, 0)
  const m2Quebrado = kpis.quebras.reduce((soma, q) => soma + q.m2Quebrado, 0)
  const anterior = rotuloDoAnterior(filtros)
  const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

  return [
    {
      col: [1, 4],
      linha: 1,
      conteudo: (
        <Kpi
          rotulo="Custo / carga (rotas)"
          valor={porcento(kpis.pctCustoRota)}
          grande
          sparkline={<Sparkline pontos={semanas.map((s) => s.pct)} />}
          delta={deltaDoCusto(kpis.pctCustoRota, anteriores?.pctCustoRota ?? null)}
          apoio={anterior === null
            ? `${kpis.viagens.length} ${kpis.viagens.length === 1 ? 'viagem' : 'viagens'} no período`
            : `vs. ${anterior}`}
          meta={{
            texto: `Meta < 7,00% · ${brl(kpis.totalCustoV)} em ${brl(kpis.totalCarga)}`,
            tom: faixaDe(kpis.pctCustoRota, 7, 9) ?? 'ok',
          }}
        />
      ),
    },
    {
      col: [4, 7],
      linha: 1,
      conteudo: (
        <Kpi
          rotulo="Pontualidade"
          valor={kpis.pont.total === 0 ? '·' : `${Math.round((noPrazo / kpis.pont.total) * 100)}%`}
          apoio={kpis.pont.total === 0
            ? 'nenhuma viagem com previsão de chegada'
            : `${noPrazo} de ${kpis.pont.total} ${kpis.pont.total === 1 ? 'viagem' : 'viagens'} no prazo · ${kpis.pont.atrasado} ${kpis.pont.atrasado === 1 ? 'atrasada' : 'atrasadas'}`}
          meta={{
            texto: atrasoPct === null
              ? 'Meta ≤ 5% de atraso'
              : `Meta ≤ 5% de atraso · hoje ${porcento(atrasoPct, 1)}`,
            tom: faixaDe(atrasoPct, 5, 15) ?? 'ok',
          }}
        />
      ),
    },
    {
      col: [7, 10],
      linha: 1,
      conteudo: (
        <Kpi
          rotulo="Quebra na expedição"
          valor={porcento(kpis.pctQuebra)}
          apoio={m2Expedido === 0
            ? 'sem expedição registrada'
            : `${m2Quebrado.toLocaleString('pt-BR')} m² de ${m2Expedido.toLocaleString('pt-BR')} m²`}
          meta={{ texto: 'Meta < 1%', tom: faixaDe(kpis.pctQuebra, 1, 2) ?? 'ok' }}
        />
      ),
    },
    {
      col: [10, 13],
      linha: 1,
      conteudo: (
        <Kpi
          rotulo="Manutenção / produção"
          valor={porcento(kpis.pctManutProd)}
          apoio={`${brl(kpis.totalManut)} em ${kpis.manuts.length} ${kpis.manuts.length === 1 ? 'serviço' : 'serviços'}`}
          meta={{ texto: 'Meta < 2%', tom: faixaDe(kpis.pctManutProd, 2, 3) ?? 'ok' }}
        />
      ),
    },
    {
      col: [1, 7],
      linha: 2,
      conteudo: (
        <Kpi
          rotulo="Custo por m²"
          valor={brlCentavos(custos.custoPorM2)}
          delta={deltaEmReais(custos.custoPorM2, custosAnteriores?.custoPorM2 ?? null)}
          apoio={custos.m2 === 0
            ? 'nenhuma viagem com m² lançado'
            : `${custos.m2.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m² em ${plural(custos.viagensComM2, 'viagem', 'viagens')}${anterior === null ? '' : ` · vs. ${anterior}`}`}
          meta={custos.viagensSemM2 === 0
            ? undefined
            : { texto: `${plural(custos.viagensSemM2, 'viagem sem m² fica', 'viagens sem m² ficam')} de fora do cálculo`, tom: 'atencao' }}
        />
      ),
    },
    {
      col: [7, 13],
      linha: 2,
      conteudo: (
        <Kpi
          rotulo="Custo por km (com manutenção)"
          valor={brlCentavos(custos.custoPorKm)}
          delta={deltaEmReais(custos.custoPorKm, custosAnteriores?.custoPorKm ?? null)}
          apoio={custos.km === 0
            ? 'nenhuma viagem com km rodado'
            : `${brl(custos.combustivelComKm)} combustível + ${brl(custos.manutencao)} manutenção em ${custos.km.toLocaleString('pt-BR')} km${anterior === null ? '' : ` · vs. ${anterior}`}`}
          meta={custos.viagensSemKm === 0
            ? undefined
            : { texto: `${plural(custos.viagensSemKm, 'viagem sem km fica', 'viagens sem km ficam')} de fora do cálculo`, tom: 'atencao' }}
        />
      ),
    },
    { col: [1, 9], linha: 3, conteudo: grafico },
    { col: [9, 13], linha: 3, conteudo: <Resumo kpis={kpis} /> },
    { col: [1, 13], linha: 4, rente: true, conteudo: <TabelaDeRotas rotas={rotas} consulta={consulta} /> },
    { col: [1, 13], linha: 5, rente: true, conteudo: <TabelaDePlacas placas={custos.porPlaca} /> },
  ]
}

export default function VisaoGeral(): JSX.Element {
  const [filtros, definirFiltros] = useFiltros()
  const consulta = consultaDe(filtros)
  const registros = useRegistros()
  const { itens, sincronia } = registros
  const [janela, setJanela] = useState(0)
  const [copiado, setCopiado] = useState(false)

  const dados = filtrarDados(itens, filtros.base, filtros.periodo, filtros.mes)
  const kpis = calcularKPIs(dados)
  const rotas = porRota(kpis.viagens)
  const custos = indicadoresDeCusto(dados)
  // O recorte anterior: o mes de antes quando um mes esta escolhido, senao o periodo anterior.
  const anterior = periodoAnterior(filtros.periodo)
  const dadosAnteriores = filtros.mes !== null
    ? filtrarDados(itens, filtros.base, 'tudo', mesAnterior(filtros.mes))
    : anterior === null
    ? null
    : filtrarDados(itens, filtros.base, anterior)
  const anteriores = dadosAnteriores === null ? null : calcularKPIs(dadosAnteriores)
  const custosAnteriores = dadosAnteriores === null ? null : indicadoresDeCusto(dadosAnteriores)
  // A serie semanal ignora o filtro de periodo de proposito: a janela dela sao as proprias
  // 8, 12 ou 26 semanas, e cruzar as duas coisas deixava sete oitavos do grafico em branco
  // sempre que o filtro estava em "Esta semana", que e o padrao. So a base filtra aqui.
  const janelaEmSemanas = JANELAS[janela] ?? JANELAS[0]
  const semanas = semanasDoGrafico(filtrarDados(itens, filtros.base, 'tudo'), janelaEmSemanas)

  const irPara = (novos: Filtros): void => {
    void definirFiltros(novos)
  }

  const copiarWhatsApp = (): void => {
    const texto = textoDoWhatsApp(kpis, rotas, filtros, new Date())
    void copiar(texto).then((deu) => {
      // Sem area de transferencia sobra a caixa com o texto, que e o que a tela sempre
      // fez, e de la da para selecionar a mao.
      if (!deu) {
        alert(texto)
        return
      }
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    })
  }

  const baixarRelatorio = (): void => {
    const hoje = new Date()
    baixarTexto(`relatorio-${hoje.toISOString().split('T')[0]}.txt`, textoDoRelatorio(kpis, filtros, hoje))
  }

  const grafico = (
    <>
      <CabecalhoDeBloco
        titulo="Custo / carga por semana"
        subtitulo={`${BASES[filtros.base].naCasca} · últimas ${janelaEmSemanas} semanas · linha tracejada é a meta`}
        direita={<Abas itens={ROTULOS_DA_JANELA} ativa={janela} aoTrocar={setJanela} />}
        rente
      />
      <GraficoCustoCarga semanas={semanas} />
    </>
  )

  return (
    <EstadoDosRegistros registros={registros} titulo="Visão geral">
      <CabecalhoDePagina
        titulo="Visão geral"
        subtitulo={`${rotuloDoPeriodo(filtros)} · ${BASES[filtros.base].naCasca} · ${comoSincronizou(sincronia)}`}
        acoes={
          <>
            {copiado ? <Badge rotulo="Copiado" cor="verde" /> : null}
            <Seletor
              rotulo="Período"
              valor={filtros.periodo}
              opcoes={OPCOES_DE_PERIODO}
              aoEscolher={(periodo) => irPara({ ...filtros, periodo, mes: null })}
            />
            <SeletorDeMes itens={itens} filtros={filtros} aoEscolher={irPara} />
            <Botao rotulo="Registrar rota" tipo="primario" antes={Plus} href="/registrar" />
            <Menu
              nome="Mais ações"
              aparencia="quadrado"
              gatilho={<Icone de={MoreHorizontal} />}
              itens={[
                { rotulo: 'Copiar para WhatsApp', aoEscolher: copiarWhatsApp },
                { rotulo: 'Relatório .txt', aoEscolher: baixarRelatorio },
              ]}
            />
          </>
        }
      />
      <Grade celulas={celulasDe({ kpis, anteriores, custos, custosAnteriores, semanas, rotas, filtros, consulta, grafico })} />
    </EstadoDosRegistros>
  )
}
