/**
 * A Visao geral, a primeira das quatro telas do painel redesenhado. O artboard e o `Main`
 * de `var/design-dashboard/build.mjs`, e ele manda no desenho.
 *
 * O nome do arquivo fica. As seis telas congeladas linkam para `dashboard-semanal.html`, e
 * renomear a casca obrigaria a mexer nas seis, que a paridade compara byte a byte contra
 * uma baseline gravada antes deste trabalho existir.
 *
 * Nao ha estado de filtro. Base e periodo saem de `lerFiltros(location.search)`, e trocar
 * qualquer um dos dois escreve `location.search`, o que recarrega a pagina. E o mesmo
 * mecanismo que leva o filtro para Viagens, Rotas e Frota pelo href da sidebar, sem uma
 * linha de sincronia entre as quatro telas, e ele e idempotente porque o que a tela mostra
 * depende so da URL.
 *
 * A janela do grafico e a unica coisa que fica em `useState`. Ela nao e filtro: nao muda
 * numero nenhum fora do proprio grafico e nao tem por que sobreviver a navegacao.
 *
 * Esta tela saiu da prova de paridade no mesmo commit em que a view velha morreu. O motivo
 * esta em `verificar/paridade/roteiros/todos.ts`, e o que entrou no lugar e
 * `verificar/olhar-dashboard.ts`, que fotografa a tela para alguem olhar.
 */
import { useState } from 'react'
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegistros } from '../dashboard/carregar.ts'
import type { Sincronia } from '../dashboard/carregar.ts'
import {
  brl,
  calcularKPIs,
  faixaDe,
  filtrarDados,
  porRota,
  porcento,
  semanasDoGrafico,
} from '../dashboard/dominio.ts'
import type { Indicadores, Rota } from '../dashboard/dominio.ts'
import {
  BASES,
  OPCOES_DE_BASE,
  OPCOES_DE_PERIODO,
  PERIODOS,
  consultaDe,
  lerFiltros,
  periodoAnterior,
} from '../dashboard/filtros.ts'
import type { Filtros } from '../dashboard/filtros.ts'
import { GraficoCustoCarga, Sparkline } from '../dashboard/graficos.tsx'
import type { Semana } from '../dashboard/graficos.tsx'
import { baixarTexto, copiar, textoDoRelatorio, textoDoWhatsApp } from '../dashboard/relatorio.ts'
import { Casca, ativaDe } from '../geist/casca.tsx'
import { ArrowDownRight, ArrowUpRight, Icone, MoreHorizontal, Plus } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
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
import type { Celula, CorDeBadge, Delta, Tom } from '../geist/primitivos.tsx'

/** As tres janelas da aba do grafico, na ordem em que o canvas as desenhou. */
const JANELAS = [8, 12, 26] as const
const ROTULOS_DA_JANELA = ['8 semanas', '12', '26']

const BADGE_DO_TOM: Readonly<Record<Tom, CorDeBadge>> = {
  ok: 'verde',
  atencao: 'ambar',
  critico: 'vermelho',
}

const ROTULO_DO_TOM: Readonly<Record<Tom, string>> = {
  ok: 'Dentro da meta',
  atencao: 'Atenção',
  critico: 'Crítico',
}

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
        subtitulo="5 rotas com mais custo · ordenadas pelo % de custo"
        direita={<Link href={`rotas.html${consulta}`}>Ver todas as rotas</Link>}
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
                <Td><Badge rotulo={ROTULO_DO_TOM[tom]} cor={BADGE_DO_TOM[tom]} /></Td>
              </tr>
            )
          })}
      </Tabela>
    </>
  )
}

function celulasDe({ kpis, anteriores, semanas, rotas, filtros, consulta, grafico }: {
  readonly kpis: Indicadores
  readonly anteriores: Indicadores | null
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
  const anterior = periodoAnterior(filtros.periodo)

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
            : `vs. ${PERIODOS[anterior].rotulo.toLowerCase()}`}
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
          valor={kpis.pont.total === 0 ? '—' : `${Math.round((noPrazo / kpis.pont.total) * 100)}%`}
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
    { col: [1, 9], linha: 2, conteudo: grafico },
    { col: [9, 13], linha: 2, conteudo: <Resumo kpis={kpis} /> },
    { col: [1, 13], linha: 3, rente: true, conteudo: <TabelaDeRotas rotas={rotas} consulta={consulta} /> },
  ]
}

function VisaoGeral(): JSX.Element {
  const filtros = lerFiltros(window.location.search)
  const consulta = consultaDe(filtros)
  const { itens, sincronia } = useRegistros()
  const [janela, setJanela] = useState(0)
  const [copiado, setCopiado] = useState(false)

  const dados = filtrarDados(itens, filtros.base, filtros.periodo)
  const kpis = calcularKPIs(dados)
  const rotas = porRota(kpis.viagens)
  const anterior = periodoAnterior(filtros.periodo)
  const anteriores = anterior === null ? null : calcularKPIs(filtrarDados(itens, filtros.base, anterior))
  // A serie semanal ignora o filtro de periodo de proposito: a janela dela sao as proprias
  // 8, 12 ou 26 semanas, e cruzar as duas coisas deixava sete oitavos do grafico em branco
  // sempre que o filtro estava em "Esta semana", que e o padrao. So a base filtra aqui.
  const janelaEmSemanas = JANELAS[janela] ?? JANELAS[0]
  const semanas = semanasDoGrafico(filtrarDados(itens, filtros.base, 'tudo'), janelaEmSemanas)

  const irPara = (novos: Filtros): void => {
    window.location.search = consultaDe(novos)
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
    <Casca
      ativa={ativaDe(window.location.pathname)}
      consulta={consulta}
      base={{
        valor: filtros.base,
        rotulo: BASES[filtros.base].naCasca,
        opcoes: OPCOES_DE_BASE,
        aoEscolher: (base) => irPara({ ...filtros, base }),
      }}
      selos={{ viagens: String(kpis.viagens.length) }}
    >
      <CabecalhoDePagina
        titulo="Visão geral"
        subtitulo={`${PERIODOS[filtros.periodo].rotulo} · ${BASES[filtros.base].naCasca} · ${comoSincronizou(sincronia)}`}
        acoes={
          <>
            {copiado ? <Badge rotulo="Copiado" cor="verde" /> : null}
            <Seletor
              rotulo="Período"
              valor={filtros.periodo}
              opcoes={OPCOES_DE_PERIODO}
              aoEscolher={(periodo) => irPara({ ...filtros, periodo })}
            />
            <Botao rotulo="Registrar rota" tipo="primario" antes={Plus} href="formulario-registro.html" />
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
      <Grade celulas={celulasDe({ kpis, anteriores, semanas, rotas, filtros, consulta, grafico })} />
    </Casca>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<VisaoGeral />)
