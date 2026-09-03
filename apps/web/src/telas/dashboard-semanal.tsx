/**
 * O dashboard semanal. As regras do porte estao em `entrar.tsx`; aqui ficam as quatro
 * coisas que esta tela tem e as tres anteriores nao tinham.
 *
 * A navegacao entre KPIs, Viagens e Frota tem tres estados e nao dois. Antes do primeiro
 * clique `#telaKpis` nao tem atributo `style` nenhum, e quem o mostra e o fluxo normal do
 * documento; depois de qualquer clique ele passa a ter `display` inline, mesmo quando o
 * clique foi em "KPIs da Semana". Por isso `ativa` comeca em `null` em vez de `'kpis'`, e
 * o `style` do `#telaKpis` sai `undefined` enquanto ninguem navegou. Prop `undefined` nao
 * vira atributo, que e o que a baseline cobra. `#telaViagens` e `#telaFrota` nascem
 * escondidos no markup e nao precisam do terceiro estado.
 *
 * O botao do WhatsApp e escrito por ref, e nao por estado. O `copiarWhatsApp` de antes
 * desfazia o destaque com `btn.style = ''`, que deixa o atributo `style` no elemento,
 * presente e vazio. `style={{}}` do React nao produz isso: ou o atributo existe com
 * conteudo, ou nao existe. Entao as tres cores entram por `btn.style.<prop>` e saem por
 * `btn.style.cssText = ''`, como em `integracao-frota.tsx` com o `printDoc`. So o rotulo
 * e estado, porque so ele e texto.
 *
 * Os oito nos de espaco dos filtros da lateral sao os `{' '}` da tela, e nao ha outros.
 * `.filtro-group` e bloco comum e o `<select>` fica `inline-block`, entao o espaco em
 * volta dele desenha. Entre as `<option>` nao entra nada: `option` computa como bloco.
 *
 * Os dois graficos trocaram Chart.js por Recharts e sao a unica parte da tela que desenha
 * diferente. A decisao, o preco e o recorte estao em `verificar/paridade/fora-da-prova.ts`.
 * O que continua cobrado e o `.chart-wrap` em volta, que por isso sai com a classe e mais
 * nada: todo o Recharts mora dentro dele, inclusive o `<span>` com que a biblioteca mede
 * texto, que sozinha ela penduraria no `document.body`.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Area,
  AreaChart,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { listarRegistros } from '../js/registros-api.ts'
import {
  brl,
  calcularKPIs,
  faixaDe,
  filtrarDados,
  fmtPct,
  lerItem,
  parcela,
  porRota,
  semanasDoGrafico,
} from '../dashboard/dominio.ts'
import type { Item, Pontualidade, Tom } from '../dashboard/dominio.ts'
import { PERIODOS } from '../dashboard/filtros.ts'
import type { Periodo } from '../dashboard/filtros.ts'
import './dashboard-semanal.css'

const TITULOS = { kpis: 'KPIs da Semana', viagens: 'Viagens', frota: 'Frota' } as const

type TelaAtiva = keyof typeof TITULOS

function ehPeriodo(valor: string): valor is Periodo {
  return valor in PERIODOS
}

/**
 * A classe que a faixa vira nesta tela. O calculo mudou de casa para `dashboard/dominio.ts`
 * junto com o resto do dominio, e a folha desta tela continua falando `ok`, `warn` e
 * `crit`. As duas escritas se encontram aqui, e o encontro morre com a view velha.
 */
const CLASSE_DA_FAIXA: Readonly<Record<Tom, string>> = { ok: 'ok', atencao: 'warn', critico: 'crit' }

/** O `'kpi-card ' + cls` do modulo velho, sem o espaco solto quando nao ha faixa. */
function comFaixa(classe: string, faixa: Tom | null): string {
  return faixa === null ? classe : `${classe} ${CLASSE_DA_FAIXA[faixa]}`
}

const FAIXA_PONTUALIDADE: Record<Pontualidade, string> = { adiantado: 'ok', no_prazo: 'info', atrasado: 'crit' }
const ROTULO_PONTUALIDADE: Record<Pontualidade, string> = { adiantado: 'Adiantado', no_prazo: 'No Prazo', atrasado: 'Atrasado' }

// ===================== TELA =====================

function DashboardSemanal(): JSX.Element {
  const [cache, setCache] = useState<readonly Item[]>([])
  const [sync, setSync] = useState<{ texto: string; cor: string | undefined }>({
    texto: 'Carregando...',
    cor: undefined,
  })
  const [base, setBase] = useState('todas')
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  // `null` e "ninguem navegou ainda", e nao e o mesmo que `'kpis'`: ver o cabecalho.
  const [ativa, setAtiva] = useState<TelaAtiva | null>(null)
  const [copiado, setCopiado] = useState(false)

  const btnWpp = useRef<HTMLButtonElement>(null)

  const tela: TelaAtiva = ativa ?? 'kpis'

  const dados = filtrarDados(cache, base, periodo)
  const kpis = calcularKPIs(dados)
  const rotas = porRota(kpis.viagens)
  const semanas = semanasDoGrafico(dados)

  async function atualizarDados(): Promise<void> {
    setSync({ texto: 'Atualizando...', cor: '#6b7280' })
    try {
      setCache((await listarRegistros()).map(lerItem))
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setSync({ texto: `Sincronizado · ${hora}`, cor: '#16a34a' })
    } catch {
      // O que sobrava aqui era a copia guardada no navegador, que nao existe mais. O
      // que sobra e a copia ja carregada nesta aba, entao ela fica de pe em vez de ser
      // trocada por vazio. A frase e a mesma porque o fato e o mesmo para quem le a
      // tela: o numero continua ali, e nao veio de agora.
      setSync({ texto: 'Dados locais (sem conexão)', cor: '#ea580c' })
    }
  }

  useEffect(() => {
    void atualizarDados()
  }, [])

  // ===================== RELATÓRIO TEXTO =====================

  function gerarRelatorio(): void {
    const txt = [
      `📊 RELATÓRIO LOGÍSTICO — EM VIDROS`,
      `${PERIODOS[periodo].noRelatorio} · ${base === 'todas' ? 'Todas as Bases' : base} · ${new Date().toLocaleDateString('pt-BR')}`,
      ``,
      `🚛 VIAGENS: ${kpis.viagens.length} | Carga: R$ ${kpis.totalCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Custo: R$ ${kpis.totalCustoV.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      kpis.pctCustoRota !== null ? `   % Custo/Carga: ${kpis.pctCustoRota.toFixed(2)}% ${kpis.pctCustoRota < 7 ? '✅' : '⚠️'} (meta < 7%)` : '',
      ``,
      `🔧 MANUTENÇÕES: R$ ${kpis.totalManut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      kpis.pctManutProd !== null ? `   % Manut/Produção: ${kpis.pctManutProd.toFixed(2)}% ${kpis.pctManutProd < 2 ? '✅' : '⚠️'} (meta < 2%)` : '',
      ``,
      `⛽ ABASTECIMENTO: R$ ${kpis.totalAbast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ``,
      kpis.pctQuebra !== null ? `📦 QUEBRA: ${kpis.pctQuebra.toFixed(2)}% ${kpis.pctQuebra < 1 ? '✅' : '⚠️'} (meta < 1%)` : '📦 QUEBRA: sem registros',
      ``,
      kpis.pont.total > 0 ? `⏱️ PONTUALIDADE (${kpis.pont.total} viagens com status):` : '⏱️ PONTUALIDADE: sem dados',
      kpis.pont.total > 0 ? `   Adiantado: ${parcela(kpis.pont.adiantado, kpis.pont.total)}% | No Prazo: ${parcela(kpis.pont.no_prazo, kpis.pont.total)}% | Atrasado: ${parcela(kpis.pont.atrasado, kpis.pont.total)}% (meta ≤ 5%)` : '',
    ].join('\n')

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ===================== COPIAR WHATSAPP =====================

  function copiarWhatsApp(): void {
    const data = new Date().toLocaleDateString('pt-BR')

    const semaforo = (val: number | null, meta: number): string => {
      if (val === null) return '⚪'
      return val < meta ? '🟢' : val < meta * 1.3 ? '🟡' : '🔴'
    }

    const pt = kpis.pont
    const ptTxt = pt.total > 0
      ? `✅ ${parcela(pt.adiantado, pt.total)}% adiant. | 🟡 ${parcela(pt.no_prazo, pt.total)}% prazo | 🔴 ${parcela(pt.atrasado, pt.total)}% atraso`
      : 'Sem dados'

    const rotasCrit = rotas.filter((r) => r.pct >= 7).slice(0, 3)
    const linhasRotas = rotasCrit.length > 0
      ? rotasCrit.map((r) => `   • ${r.rota}: ${r.pct.toFixed(1)}% ${r.pct < 10 ? '⚠️' : '🔴'}`).join('\n')
      : '   ✅ Todas as rotas dentro da meta'

    const txt = [
      `📊 *LOGÍSTICA EM VIDROS — ${base === 'todas' ? 'TODAS AS BASES' : base.toUpperCase()}*`,
      `_${PERIODOS[periodo].noRelatorio} · ${data}_`,
      ``,
      `🚛 *VIAGENS*: ${kpis.viagens.length} viagem(ns)`,
      `   Carga: ${brl(kpis.totalCarga)}`,
      `   Custo: ${brl(kpis.totalCustoV)}`,
      kpis.pctCustoRota !== null ? `   ${semaforo(kpis.pctCustoRota, 7)} % Custo/Carga: *${fmtPct(kpis.pctCustoRota)}* (meta < 7%)` : `   ⚪ % Custo/Carga: —`,
      ``,
      `📍 *ROTAS ACIMA DA META:*`,
      linhasRotas,
      ``,
      `⏱️ *PONTUALIDADE*:`,
      `   ${ptTxt}`,
      `   Meta: ≤ 5% atraso`,
      ``,
      `🔧 *MANUTENÇÃO*: ${brl(kpis.totalManut)}`,
      kpis.pctManutProd !== null ? `   ${semaforo(kpis.pctManutProd, 2)} % Manut/Produção: *${fmtPct(kpis.pctManutProd)}* (meta < 2%)` : `   ⚪ % Manut/Produção: —`,
      ``,
      `⛽ *ABASTECIMENTO*: ${brl(kpis.totalAbast)}`,
      ``,
      kpis.pctQuebra !== null
        ? `📦 *QUEBRA EXPEDIÇÃO*: ${semaforo(kpis.pctQuebra, 1)} *${fmtPct(kpis.pctQuebra)}* (meta < 1%)`
        : `📦 *QUEBRA EXPEDIÇÃO*: ⚪ sem registros`,
      ``,
      `_Gerado pelo Sistema de Indicadores EM Vidros_`,
    ].join('\n')

    navigator.clipboard.writeText(txt).then(() => {
      const btn = btnWpp.current
      if (btn === null) return
      setCopiado(true)
      btn.style.background = '#dcfce7'
      btn.style.borderColor = '#16a34a'
      btn.style.color = '#166534'
      setTimeout(() => {
        setCopiado(false)
        btn.style.cssText = ''
      }, 3000)
    }).catch(() => {
      alert(txt)
    })
  }

  // ===================== KPIs DA SEMANA =====================

  const faixaCustoRota = faixaDe(kpis.pctCustoRota, 7, 9)
  const faixaQuebra = faixaDe(kpis.pctQuebra, 1, 2)
  const faixaManutProd = faixaDe(kpis.pctManutProd, 2, 3)
  const atrasoPct = kpis.pont.total > 0 ? parcela(kpis.pont.atrasado, kpis.pont.total) : 0
  const faixaPont: Tom | null = kpis.pont.total > 0 ? (atrasoPct <= 5 ? 'ok' : 'atencao') : null

  // `fill` no proprio dado, e nao um `<Cell>` por fatia: o `Cell` esta depreciado e sai
  // no Recharts 4.
  const fatias = [
    { nome: 'Adiantado', valor: kpis.pont.adiantado, fill: '#16a34a' },
    { nome: 'No Prazo', valor: kpis.pont.no_prazo, fill: '#ca8a04' },
    { nome: 'Atrasado', valor: kpis.pont.atrasado, fill: '#dc2626' },
  ]

  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-name"><img src="docs/logo-emvidros.svg" alt="EM Vidros" style={{ height: '56px', width: 'auto', display: 'block' }} /></div>
          <div className="brand-sub">Dashboard Logístico</div>
        </div>
        <div className="nav">
          <div className="nav-label">Visualização</div>
          <div className={tela === 'kpis' ? 'nav-item ativo' : 'nav-item'} onClick={() => setAtiva('kpis')}><span>📈</span> KPIs da Semana</div>
          <div className={tela === 'viagens' ? 'nav-item ativo' : 'nav-item'} onClick={() => setAtiva('viagens')}><span>🚛</span> Viagens</div>
          <div className={tela === 'frota' ? 'nav-item ativo' : 'nav-item'} onClick={() => setAtiva('frota')}><span>🔧</span> Frota</div>
          <div className="nav-label" style={{ marginTop: '8px' }}>Ações</div>
          <div className="nav-item" onClick={() => { window.location.href = 'formulario-registro.html' }}><span>✏️</span> Registrar Rota</div>
          <div className="nav-item" onClick={() => void atualizarDados()}><span>🔄</span> Atualizar</div>
        </div>
        <div style={{ padding: '8px 16px', fontSize: '.75rem', color: sync.cor }} id="statusSync">{sync.texto}</div>
        <div className="filtros-box">
          <h4>Filtros</h4>
          <div className="filtro-group">
            <label>Base</label>
            {' '}
            <select id="filtroBase" value={base} onChange={(e) => setBase(e.currentTarget.value)}>
              {' '}
              <option value="todas">Todas as Bases</option>
              <option value="Raposa">Raposa</option>
              <option value="Imperatriz">Imperatriz</option>
              {' '}
            </select>
            {' '}
          </div>
          <div className="filtro-group">
            <label>Período</label>
            {' '}
            <select
              id="filtroPeriodo"
              value={periodo}
              onChange={(e) => { const escolhido = e.currentTarget.value; if (ehPeriodo(escolhido)) setPeriodo(escolhido) }}
            >
              {' '}
              <option value="semana">Esta Semana</option>
              <option value="ultima_semana">Semana Passada</option>
              <option value="mes">Este Mês</option>
              <option value="tudo">Todo o Período</option>
              {' '}
            </select>
            {' '}
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div>
            <h1 id="topbarTitulo">{TITULOS[tela]}</h1>
            <div className="sub" id="topbarSub">{`${PERIODOS[periodo].noRelatorio} · ${base === 'todas' ? 'Todas as Bases' : base} · ${dados.length} registro(s)`}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-top" onClick={copiarWhatsApp} id="btnWpp" ref={btnWpp}>{copiado ? '✅ Copiado!' : '📱 Copiar p/ WhatsApp'}</button>
            <button className="btn-top" onClick={gerarRelatorio}>📄 Relatório .txt</button>
            <button className="btn-top primario" onClick={() => { window.location.href = 'formulario-registro.html' }}>+ Registrar Rota</button>
          </div>
        </div>

        <div className="content">

          <div id="telaKpis" style={ativa === null ? undefined : { display: ativa === 'kpis' ? 'block' : 'none' }}>
            <div className="sec-title">Indicadores da Semana</div>
            <div className="kpi-grid" id="kpiGrid">
              <div className="kpi-card info"><div className="kpi-label">Total de Registros</div><div className="kpi-valor info" id="kTotalReg">{dados.length}</div><div className="kpi-meta">no período</div></div>
              <div className={comFaixa('kpi-card', faixaPont)} id="cardPontualidade">
                <div className="kpi-label">Pontualidade</div>
                {/*
                  As duas pontas levam `key` porque o `row.innerHTML = ...` de antes
                  trocava a subarvore inteira. Sem elas o React casa o primeiro `<span>`
                  da lista com o "Sem dados" que estava ali e reaproveita o no, e o
                  `style` que ele tinha fica no elemento, presente e vazio.
                */}
                <div className="pont-row" id="pontRow">
                  {kpis.pont.total > 0
                    ? (
                      <Fragment key="pilulas">
                        <span className="pont-pill adiantado">{`✅ ${parcela(kpis.pont.adiantado, kpis.pont.total)}% Adiant.`}</span>
                        <span className="pont-pill prazo">{`🟡 ${parcela(kpis.pont.no_prazo, kpis.pont.total)}% Prazo`}</span>
                        <span className="pont-pill atrasado">{`🔴 ${atrasoPct}% Atraso`}</span>
                      </Fragment>
                    )
                    : <span key="vazio" style={{ color: 'var(--txt-muted)' }}>Sem dados</span>}
                </div>
                <div className="kpi-meta">Meta: ≤ 5% atraso</div>
              </div>
              <div className={comFaixa('kpi-card', faixaCustoRota)} id="cardCustoRota">
                <div className="kpi-label">Custo / Carga (Rotas)</div>
                <div className={comFaixa('kpi-valor', faixaCustoRota)} id="kCustoRota">{fmtPct(kpis.pctCustoRota)}</div>
                <div className="kpi-meta">Meta: &lt; 7,00%</div>
              </div>
              <div className={comFaixa('kpi-card', faixaQuebra)} id="cardQuebra">
                <div className="kpi-label">% Quebra Expedição</div>
                <div className={comFaixa('kpi-valor', faixaQuebra)} id="kQuebra">{fmtPct(kpis.pctQuebra)}</div>
                <div className="kpi-meta">Meta: &lt; 1,00%</div>
              </div>
              <div className={comFaixa('kpi-card', faixaManutProd)} id="cardManutProd">
                <div className="kpi-label">Manutenção / Produção</div>
                <div className={comFaixa('kpi-valor', faixaManutProd)} id="kManutProd">{fmtPct(kpis.pctManutProd)}</div>
                <div className="kpi-meta">Meta: &lt; 2,00%</div>
              </div>
            </div>

            <div className="kpi-grid" style={{ marginTop: '10px', gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi-card info"><div className="kpi-label">Total Carga (R$)</div><div className="kpi-valor info" id="kTotalCarga">{brl(kpis.totalCarga)}</div><div className="kpi-sub" id="kViagens">{`${kpis.viagens.length} viagem${kpis.viagens.length !== 1 ? 's' : ''}`}</div></div>
              <div className="kpi-card"><div className="kpi-label">Total Custo Viagens</div><div className="kpi-valor" id="kCustoViagens">{brl(kpis.totalCustoV)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Total Manutenções</div><div className="kpi-valor" id="kManutTotal">{brl(kpis.totalManut)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Total Abastecimento</div><div className="kpi-valor" id="kAbTotal">{brl(kpis.totalAbast)}</div></div>
            </div>

            <div className="sec-title">Evolução Semanal</div>
            <div className="charts-grid">
              <div className="chart-card">
                <h3>% Custo / Carga por Semana</h3>
                <div className="chart-wrap">
                  {/*
                    O `<span>` com que o Recharts mede texto. O `getStringSize` dele
                    procura este id e, se nao achar, cria um e o pendura em
                    `document.body`: um no solto no fim do body, fora do `.chart-wrap` e
                    portanto fora do recorte, nos sete passos da baseline. Criado aqui,
                    ele e adotado em vez de duplicado. O estilo e o mesmo que o Recharts
                    aplicaria; ele o reescreve a cada medida.
                  */}
                  <span id="recharts_measurement_span" aria-hidden="true" style={{ position: 'absolute', top: '-20000px', left: 0, padding: 0, margin: 0, border: 'none', whiteSpace: 'pre' }} />
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={semanas}>
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(valor: number) => `${valor}%`} />
                      <ReferenceLine y={7} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={1.5} />
                      {/*
                        O numero do balao passa pelo mesmo `fmtPct` dos cartoes acima, e nao
                        pelo padrao do Recharts, que imprimiria `6.785714285714286`.

                        `filterNull={false}` porque a semana sem carga tem `pct` nulo, e o
                        padrao do Recharts tira a linha e deixa a caixa so com a data, em
                        branco por baixo. Com a linha, o `fmtPct` escreve o mesmo `—` que a
                        tabela usa para "nao houve".
                      */}
                      <Tooltip filterNull={false} formatter={(valor) => fmtPct(typeof valor === 'number' ? valor : null)} />
                      <Area name="% Custo/Carga" type="monotone" dataKey="pct" stroke="#2563eb" strokeWidth={2} fill="rgba(37,99,235,.08)" dot={{ r: 4, fill: '#2563eb' }} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-card">
                <h3>Pontualidade — Distribuição</h3>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="50%" outerRadius="80%" stroke="#fff" strokeWidth={2} isAnimationActive={false} />
                      {/*
                        `itemSorter={null}` porque o padrao do Recharts ordena a legenda
                        por valor, e a ordem daqui e a do adiantado ao atrasado, que e a
                        que se le. O Chart.js nao reordenava.
                      */}
                      <Tooltip />
                      <Legend position="bottom" itemSorter={null} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="sec-title">Rotas — % Custo / Carga</div>
            <div className="table-card">
              <div className="table-card-header"><h3>Por Rota</h3></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Rota</th><th>Viagens</th><th>Carga (R$)</th><th>Custo (R$)</th><th>% Custo</th><th>Status</th></tr></thead>
                  <tbody id="tabelaRotas">
                    {rotas.length === 0
                      ? <tr><td colSpan={6} className="vazio">Sem viagens no período</td></tr>
                      : rotas.map((r) => {
                        const faixa = r.pct < 7 ? 'ok' : r.pct < 10 ? 'warn' : 'crit'
                        const rotulo = r.pct < 7 ? '✓ OK' : r.pct < 10 ? 'Atenção' : 'Crítico'
                        return (
                          <tr key={r.rota}>
                            <td><strong>{r.rota}</strong></td>
                            <td style={{ textAlign: 'right' }}>{r.n}</td>
                            <td style={{ textAlign: 'right' }}>{`R$ ${r.carga.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</td>
                            <td style={{ textAlign: 'right' }}>{`R$ ${r.custo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</td>
                            <td style={{ textAlign: 'right' }}><strong>{`${r.pct.toFixed(2)}%`}</strong></td>
                            <td><span className={`badge ${faixa}`}>{rotulo}</span></td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div id="telaViagens" style={{ display: ativa === 'viagens' ? 'block' : 'none' }}>
            <div className="sec-title">Registro de Viagens</div>
            <div className="table-card">
              <div className="table-card-header"><h3>Viagens do Período</h3><span id="countViagens" style={{ fontSize: '.8rem', color: 'var(--txt-dim)' }}>{`${kpis.viagens.length} viagem(ns)`}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Motorista</th><th>Veículo</th><th>Rota</th><th>km</th><th>Carga (R$)</th><th>Custo (R$)</th><th>% Custo</th><th>Pontualidade</th></tr></thead>
                  <tbody id="tabelaViagens">
                    {kpis.viagens.length === 0
                      ? <tr><td colSpan={9} className="vazio">Sem viagens no período</td></tr>
                      : [...kpis.viagens]
                        .sort((a, b) => new Date(b.dataSaida).getTime() - new Date(a.dataSaida).getTime())
                        .map((v, i) => {
                          const faixa = v.pctCusto < 7 ? 'ok' : v.pctCusto < 10 ? 'warn' : 'crit'
                          return (
                            <tr key={i}>
                              <td>{v.dataSaida || '—'}</td>
                              <td>{v.motorista || '—'}</td>
                              <td><code style={{ fontSize: '.78rem', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px' }}>{v.veiculo || '—'}</code></td>
                              <td>{v.rota || '—'}</td>
                              <td style={{ textAlign: 'right' }}>{v.km === null ? '—' : v.km.toLocaleString('pt-BR')}</td>
                              <td style={{ textAlign: 'right' }}>{`R$ ${v.valorCarga.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</td>
                              <td style={{ textAlign: 'right' }}>{`R$ ${v.custoViagem.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</td>
                              <td style={{ textAlign: 'right' }}><span className={`badge ${faixa}`}>{`${v.pctCusto.toFixed(1)}%`}</span></td>
                              <td>{v.pontualidade === null ? '—' : <span className={`badge ${FAIXA_PONTUALIDADE[v.pontualidade]}`}>{ROTULO_PONTUALIDADE[v.pontualidade]}</span>}</td>
                            </tr>
                          )
                        })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div id="telaFrota" style={{ display: ativa === 'frota' ? 'block' : 'none' }}>
            <div className="sec-title">Manutenções do Período</div>
            <div className="table-card">
              <div className="table-card-header"><h3>Manutenções</h3></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Placa</th><th>Base</th><th>Serviço</th><th>Valor (R$)</th><th>Fornecedor</th></tr></thead>
                  <tbody id="tabelaManut">
                    {kpis.manuts.length === 0
                      ? <tr><td colSpan={6} className="vazio">Sem manutenções</td></tr>
                      : [...kpis.manuts]
                        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                        .map((m, i) => (
                          <tr key={i}>
                            <td>{m.data || '—'}</td>
                            <td><code style={{ fontSize: '.78rem', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px' }}>{m.placa || '—'}</code></td>
                            <td>{m.base || '—'}</td>
                            <td>{m.servico || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{`R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
                            <td>{m.fornecedor || '—'}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="sec-title" style={{ marginTop: '20px' }}>Abastecimentos</div>
            <div className="table-card">
              <div className="table-card-header"><h3>Abastecimentos</h3></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Placa</th><th>Base</th><th>Litros</th><th>R$/L</th><th>Total (R$)</th><th>km</th></tr></thead>
                  <tbody id="tabelaAbast">
                    {kpis.abasts.length === 0
                      ? <tr><td colSpan={7} className="vazio">Sem abastecimentos</td></tr>
                      : [...kpis.abasts]
                        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                        .map((a, i) => (
                          <tr key={i}>
                            <td>{a.data || '—'}</td>
                            <td><code style={{ fontSize: '.78rem', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px' }}>{a.placa || '—'}</code></td>
                            <td>{a.base || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{`${a.litros.toFixed(1)} L`}</td>
                            <td style={{ textAlign: 'right' }}>{`R$ ${a.vlLitro.toFixed(3)}`}</td>
                            <td style={{ textAlign: 'right' }}>{`R$ ${a.valorTotal.toFixed(2)}`}</td>
                            <td style={{ textAlign: 'right' }}>{a.km === 0 ? '—' : a.km.toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<DashboardSemanal />)
