import { listarRegistros } from './registros-api.ts';

// Minutos de tolerancia antes de a chegada contar como atraso. E o parametro
// `pontualidade_tolerancia_min`, semeado em 15. Nenhuma rota da API entrega
// parametro ainda, entao o numero esta repetido aqui; quando houver, ele sai daqui.
const TOLERANCIA_PONTUALIDADE_MIN = 15;
let chartCustoRota = null, chartPont = null;
let telaAtiva = 'kpis';
let _dadosCache = [];

// ===================== DADOS =====================
// A `pontualidade` que esta tela le era a escolha de um campo do formulario antigo,
// gravada junto com a viagem. O banco nao guarda mais a escolha: guarda `atraso_min`,
// a diferenca em minutos entre a chegada prevista e a real, e nula quando nao houve
// previsao. Viagem sem previsao continua sem pontualidade, que e o mesmo que o campo
// em branco fazia aqui. A classificacao repete `classificarPontualidade` do dominio.
function comPontualidade(registro) {
  if (registro.tipo !== 'viagem') return registro;
  const atraso = registro.atraso_min;
  if (atraso === null || atraso === undefined) return registro;
  const tol = Math.abs(TOLERANCIA_PONTUALIDADE_MIN);
  return {...registro, pontualidade: atraso > tol ? 'atrasado' : atraso < -tol ? 'adiantado' : 'no_prazo'};
}

async function carregarDadosRemoto() {
  const statusEl = document.getElementById('statusSync');
  if (statusEl) { statusEl.textContent = 'Atualizando...'; statusEl.style.color = '#6b7280'; }
  try {
    _dadosCache = (await listarRegistros()).map(comPontualidade);
    if (statusEl) { statusEl.textContent = 'Sincronizado · ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); statusEl.style.color = '#16a34a'; }
  } catch {
    // O que sobrava aqui era a copia guardada no navegador, que nao existe mais. O
    // que sobra e a copia ja carregada nesta aba, entao ela fica de pe em vez de ser
    // trocada por vazio. A frase e a mesma porque o fato e o mesmo para quem le a
    // tela: o numero continua ali, e nao veio de agora.
    if (statusEl) { statusEl.textContent = 'Dados locais (sem conexão)'; statusEl.style.color = '#ea580c'; }
  }
}

function carregarDados() {
  return _dadosCache;
}

function filtrarDados(dados) {
  const base = document.getElementById('filtroBase').value;
  const periodo = document.getElementById('filtroPeriodo').value;
  const agora = new Date();

  let inicio;
  if (periodo === 'semana') {
    inicio = new Date(agora);
    inicio.setDate(agora.getDate() - agora.getDay() + (agora.getDay()===0 ? -6 : 1));
    inicio.setHours(0,0,0,0);
  } else if (periodo === 'ultima_semana') {
    inicio = new Date(agora);
    inicio.setDate(agora.getDate() - agora.getDay() + (agora.getDay()===0 ? -13 : -6));
    inicio.setHours(0,0,0,0);
    const fim = new Date(inicio); fim.setDate(fim.getDate()+7);
    return dados.filter(d => {
      if (base !== 'todas' && d.base !== base) return false;
      const dt = new Date(d.data_saida || d.data || d.registrado_em);
      return dt >= inicio && dt < fim;
    });
  } else if (periodo === 'mes') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  } else {
    inicio = new Date('2020-01-01');
  }

  return dados.filter(d => {
    if (base !== 'todas' && d.base !== base) return false;
    const dt = new Date(d.data_saida || d.data || d.registrado_em);
    return dt >= inicio;
  });
}

// ===================== KPIs =====================
function calcularKPIs(dados) {
  const viagens    = dados.filter(d => d.tipo === 'viagem');
  const abasts     = dados.filter(d => d.tipo === 'abastecimento');
  const manuts     = dados.filter(d => d.tipo === 'manutencao');
  const quebras    = dados.filter(d => d.tipo === 'quebra');

  const totalCarga   = viagens.reduce((s,d) => s + (d.valor_carga||0), 0);
  const totalCustoV  = viagens.reduce((s,d) => s + (d.custo_viagem||0), 0);
  const totalManut   = manuts.reduce((s,d) => s + (d.valor||0), 0);
  const totalAbast   = abasts.reduce((s,d) => s + (d.valor_total||0), 0);
  const m2Expedido   = quebras.reduce((s,d) => s + (d.m2_expedido||0), 0);
  const m2Quebrado   = quebras.reduce((s,d) => s + (d.m2_quebrado||0), 0);

  const pctCustoRota = totalCarga > 0 ? totalCustoV / totalCarga * 100 : null;
  const pctQuebra    = m2Expedido > 0 ? m2Quebrado / m2Expedido * 100 : null;
  const pctManutProd = totalCarga > 0 ? totalManut / totalCarga * 100 : null;

  const pont = {adiantado:0, no_prazo:0, atrasado:0, total: viagens.filter(v=>v.pontualidade).length};
  viagens.forEach(v => { if(v.pontualidade) pont[v.pontualidade] = (pont[v.pontualidade]||0) + 1; });

  return { viagens, abasts, manuts, quebras, totalCarga, totalCustoV, totalManut, totalAbast, pctCustoRota, pctQuebra, pctManutProd, pont };
}

// ===================== RENDERIZAR =====================
function atualizar() {
  const dados = filtrarDados(carregarDados());
  const kpis  = calcularKPIs(dados);
  atualizarSubtitulo(dados);

  // Totais
  document.getElementById('kTotalReg').textContent = dados.length;
  document.getElementById('kTotalCarga').textContent = kpis.totalCarga > 0 ? 'R$ ' + kpis.totalCarga.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
  document.getElementById('kViagens').textContent = kpis.viagens.length + ' viagem' + (kpis.viagens.length!==1?'s':'');
  document.getElementById('kCustoViagens').textContent = kpis.totalCustoV > 0 ? 'R$ ' + kpis.totalCustoV.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
  document.getElementById('kManutTotal').textContent = kpis.totalManut > 0 ? 'R$ ' + kpis.totalManut.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
  document.getElementById('kAbTotal').textContent = kpis.totalAbast > 0 ? 'R$ ' + kpis.totalAbast.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';

  // Custo Rota
  const cr = document.getElementById('kCustoRota');
  const cardCR = document.getElementById('cardCustoRota');
  if (kpis.pctCustoRota !== null) {
    cr.textContent = kpis.pctCustoRota.toFixed(2) + '%';
    const cls = kpis.pctCustoRota < 7 ? 'ok' : kpis.pctCustoRota < 9 ? 'warn' : 'crit';
    cr.className = 'kpi-valor ' + cls;
    cardCR.className = 'kpi-card ' + cls;
  } else { cr.textContent = '—'; cr.className = 'kpi-valor'; }

  // Quebra
  const qb = document.getElementById('kQuebra');
  const cardQ = document.getElementById('cardQuebra');
  if (kpis.pctQuebra !== null) {
    qb.textContent = kpis.pctQuebra.toFixed(2) + '%';
    const cls = kpis.pctQuebra < 1 ? 'ok' : kpis.pctQuebra < 2 ? 'warn' : 'crit';
    qb.className = 'kpi-valor ' + cls;
    cardQ.className = 'kpi-card ' + cls;
  } else { qb.textContent = '—'; qb.className = 'kpi-valor'; }

  // Manut/Produção
  const mp = document.getElementById('kManutProd');
  const cardMP = document.getElementById('cardManutProd');
  if (kpis.pctManutProd !== null) {
    mp.textContent = kpis.pctManutProd.toFixed(2) + '%';
    const cls = kpis.pctManutProd < 2 ? 'ok' : kpis.pctManutProd < 3 ? 'warn' : 'crit';
    mp.className = 'kpi-valor ' + cls;
    cardMP.className = 'kpi-card ' + cls;
  } else { mp.textContent = '—'; mp.className = 'kpi-valor'; }

  // Pontualidade
  const pt = kpis.pont;
  const cardPt = document.getElementById('cardPontualidade');
  const row = document.getElementById('pontRow');
  if (pt.total > 0) {
    const pAdiant = Math.round(pt.adiantado/pt.total*100);
    const pPrazo  = Math.round(pt.no_prazo/pt.total*100);
    const pAtraso = Math.round(pt.atrasado/pt.total*100);
    row.innerHTML = `
      <span class="pont-pill adiantado">✅ ${pAdiant}% Adiant.</span>
      <span class="pont-pill prazo">🟡 ${pPrazo}% Prazo</span>
      <span class="pont-pill atrasado">🔴 ${pAtraso}% Atraso</span>`;
    cardPt.className = 'kpi-card ' + (pAtraso <= 5 ? 'ok' : 'warn');
  } else {
    row.innerHTML = '<span style="color:var(--txt-muted)">Sem dados</span>';
    cardPt.className = 'kpi-card';
  }

  // Tabela rotas
  const rotas = {};
  kpis.viagens.forEach(v => {
    if (!v.rota) return;
    if (!rotas[v.rota]) rotas[v.rota] = {n:0,carga:0,custo:0};
    rotas[v.rota].n++;
    rotas[v.rota].carga += v.valor_carga||0;
    rotas[v.rota].custo += v.custo_viagem||0;
  });
  const rotaArr = Object.entries(rotas).map(([r,d]) => ({rota:r,...d,pct:d.carga>0?d.custo/d.carga*100:0})).sort((a,b)=>b.pct-a.pct);
  const tbRotas = document.getElementById('tabelaRotas');
  tbRotas.innerHTML = rotaArr.length === 0 ? '<tr><td colspan="6" class="vazio">Sem viagens no período</td></tr>' :
    rotaArr.map(r => {
      const cls = r.pct < 7 ? 'ok' : r.pct < 10 ? 'warn' : 'crit';
      const lbl = r.pct < 7 ? '✓ OK' : r.pct < 10 ? 'Atenção' : 'Crítico';
      return `<tr>
        <td><strong>${r.rota}</strong></td>
        <td style="text-align:right">${r.n}</td>
        <td style="text-align:right">R$ ${r.carga.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td style="text-align:right">R$ ${r.custo.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td style="text-align:right"><strong>${r.pct.toFixed(2)}%</strong></td>
        <td><span class="badge ${cls}">${lbl}</span></td>
      </tr>`;
    }).join('');

  // Tabela viagens
  const tbVi = document.getElementById('tabelaViagens');
  document.getElementById('countViagens').textContent = kpis.viagens.length + ' viagem(ns)';
  tbVi.innerHTML = kpis.viagens.length === 0 ? '<tr><td colspan="9" class="vazio">Sem viagens no período</td></tr>' :
    [...kpis.viagens].sort((a,b)=>new Date(b.data_saida)-new Date(a.data_saida)).map(v => {
      const km = v.km_rodados || (v.km_chegada && v.km_saida ? v.km_chegada-v.km_saida : '—');
      const cls = (v.pct_custo||0) < 7 ? 'ok' : (v.pct_custo||0) < 10 ? 'warn' : 'crit';
      const ptCls = {adiantado:'ok',no_prazo:'info',atrasado:'crit'}[v.pontualidade]||'';
      const ptLbl = {adiantado:'Adiantado',no_prazo:'No Prazo',atrasado:'Atrasado'}[v.pontualidade]||'—';
      return `<tr>
        <td>${v.data_saida||'—'}</td>
        <td>${v.motorista||'—'}</td>
        <td><code style="font-size:.78rem;background:var(--bg-app);padding:2px 6px;border-radius:4px;">${v.veiculo||'—'}</code></td>
        <td>${v.rota||'—'}</td>
        <td style="text-align:right">${typeof km==='number' ? km.toLocaleString('pt-BR') : km}</td>
        <td style="text-align:right">R$ ${(v.valor_carga||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td style="text-align:right">R$ ${(v.custo_viagem||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td style="text-align:right"><span class="badge ${cls}">${(v.pct_custo||0).toFixed(1)}%</span></td>
        <td>${v.pontualidade ? '<span class="badge '+ptCls+'">'+ptLbl+'</span>' : '—'}</td>
      </tr>`;
    }).join('');

  // Tabela manutenções
  const tbMn = document.getElementById('tabelaManut');
  tbMn.innerHTML = kpis.manuts.length === 0 ? '<tr><td colspan="6" class="vazio">Sem manutenções</td></tr>' :
    [...kpis.manuts].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(m =>
      `<tr><td>${m.data||'—'}</td><td><code style="font-size:.78rem;background:var(--bg-app);padding:2px 6px;border-radius:4px;">${m.placa||'—'}</code></td><td>${m.base||'—'}</td><td>${m.servico||'—'}</td><td style="text-align:right">R$ ${(m.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${m.fornecedor||'—'}</td></tr>`
    ).join('');

  // Tabela abastecimentos
  const tbAb = document.getElementById('tabelaAbast');
  tbAb.innerHTML = kpis.abasts.length === 0 ? '<tr><td colspan="7" class="vazio">Sem abastecimentos</td></tr>' :
    [...kpis.abasts].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(a =>
      `<tr><td>${a.data||'—'}</td><td><code style="font-size:.78rem;background:var(--bg-app);padding:2px 6px;border-radius:4px;">${a.placa||'—'}</code></td><td>${a.base||'—'}</td><td style="text-align:right">${(a.litros||0).toFixed(1)} L</td><td style="text-align:right">R$ ${(a.vl_litro||0).toFixed(3)}</td><td style="text-align:right">R$ ${(a.valor_total||0).toFixed(2)}</td><td style="text-align:right">${a.km ? a.km.toLocaleString('pt-BR') : '—'}</td></tr>`
    ).join('');

  // Gráficos
  renderizarGraficos(dados);
}

// ===================== GRÁFICOS =====================
function renderizarGraficos(dados) {
  // Custo/carga por semana (últimas 8 semanas)
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i*7);
    const ini = new Date(d); ini.setDate(d.getDate() - d.getDay() + (d.getDay()===0?-6:1)); ini.setHours(0,0,0,0);
    const fim = new Date(ini); fim.setDate(ini.getDate()+7);
    const semVi = dados.filter(x => x.tipo==='viagem' && new Date(x.data_saida||x.registrado_em)>=ini && new Date(x.data_saida||x.registrado_em)<fim);
    const sTotalCarga = semVi.reduce((s,v)=>s+(v.valor_carga||0),0);
    const sTotalCusto = semVi.reduce((s,v)=>s+(v.custo_viagem||0),0);
    const label = ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    semanas.push({label, pct: sTotalCarga>0 ? sTotalCusto/sTotalCarga*100 : null});
  }

  if (chartCustoRota) chartCustoRota.destroy();
  const ctx1 = document.getElementById('chartCustoRota').getContext('2d');
  chartCustoRota = new Chart(ctx1, {
    type:'line',
    data:{
      labels: semanas.map(s=>s.label),
      datasets:[{
        label:'% Custo/Carga',
        data: semanas.map(s=>s.pct),
        borderColor:'#2563eb',fill:true,
        backgroundColor:'rgba(37,99,235,.08)',
        tension:.3,pointRadius:4,pointBackgroundColor:'#2563eb'
      },{
        label:'Meta 7%',
        data: semanas.map(()=>7),
        borderColor:'#dc2626',borderDash:[5,5],borderWidth:1.5,
        pointRadius:0,fill:false
      }]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>v+'%'}}}}
  });

  // Pontualidade
  const base = document.getElementById('filtroBase').value;
  const vi = dados.filter(d=>d.tipo==='viagem'&&d.pontualidade);
  const pt = {adiantado:0,no_prazo:0,atrasado:0};
  vi.forEach(v => { if(v.pontualidade) pt[v.pontualidade]=(pt[v.pontualidade]||0)+1; });

  if (chartPont) chartPont.destroy();
  const ctx2 = document.getElementById('chartPontualidade').getContext('2d');
  chartPont = new Chart(ctx2, {
    type:'doughnut',
    data:{
      labels:['Adiantado','No Prazo','Atrasado'],
      datasets:[{data:[pt.adiantado,pt.no_prazo,pt.atrasado],backgroundColor:['#16a34a','#ca8a04','#dc2626'],borderWidth:2,borderColor:'#fff'}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}
  });
}

// ===================== SUBTÍTULO =====================
function atualizarSubtitulo(dados) {
  const periodo = document.getElementById('filtroPeriodo');
  const base = document.getElementById('filtroBase');
  const opts = {semana:'Esta Semana',ultima_semana:'Semana Passada',mes:'Este Mês',tudo:'Todo o Período'};
  document.getElementById('topbarSub').textContent = `${opts[periodo.value]} · ${base.value==='todas'?'Todas as Bases':base.value} · ${dados.length} registro(s)`;
}

// ===================== TELAS =====================
function mostrarTela(tela) {
  telaAtiva = tela;
  ['kpis','viagens','frota'].forEach(t => document.getElementById('tela'+t.charAt(0).toUpperCase()+t.slice(1)).style.display = t===tela?'block':'none');
  document.querySelectorAll('.nav-item').forEach((el,i) => el.classList.toggle('ativo', i===['kpis','viagens','frota'].indexOf(tela)));
  const titulos = {kpis:'KPIs da Semana',viagens:'Viagens',frota:'Frota'};
  document.getElementById('topbarTitulo').textContent = titulos[tela];
}

// ===================== RELATÓRIO TEXTO =====================
function gerarRelatorio() {
  const dados = filtrarDados(carregarDados());
  const kpis = calcularKPIs(dados);
  const base = document.getElementById('filtroBase').value;
  const periodo = {semana:'Esta Semana',ultima_semana:'Semana Passada',mes:'Este Mês',tudo:'Todo o Período'}[document.getElementById('filtroPeriodo').value];
  const txt = [
    `📊 RELATÓRIO LOGÍSTICO — EM VIDROS`,
    `${periodo} · ${base==='todas'?'Todas as Bases':base} · ${new Date().toLocaleDateString('pt-BR')}`,
    ``,
    `🚛 VIAGENS: ${kpis.viagens.length} | Carga: R$ ${kpis.totalCarga.toLocaleString('pt-BR',{minimumFractionDigits:2})} | Custo: R$ ${kpis.totalCustoV.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,
    kpis.pctCustoRota!==null ? `   % Custo/Carga: ${kpis.pctCustoRota.toFixed(2)}% ${kpis.pctCustoRota<7?'✅':'⚠️'} (meta < 7%)` : '',
    ``,
    `🔧 MANUTENÇÕES: R$ ${kpis.totalManut.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,
    kpis.pctManutProd!==null ? `   % Manut/Produção: ${kpis.pctManutProd.toFixed(2)}% ${kpis.pctManutProd<2?'✅':'⚠️'} (meta < 2%)` : '',
    ``,
    `⛽ ABASTECIMENTO: R$ ${kpis.totalAbast.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,
    ``,
    kpis.pctQuebra!==null ? `📦 QUEBRA: ${kpis.pctQuebra.toFixed(2)}% ${kpis.pctQuebra<1?'✅':'⚠️'} (meta < 1%)` : '📦 QUEBRA: sem registros',
    ``,
    kpis.pont.total > 0 ? `⏱️ PONTUALIDADE (${kpis.pont.total} viagens com status):` : '⏱️ PONTUALIDADE: sem dados',
    kpis.pont.total > 0 ? `   Adiantado: ${Math.round(kpis.pont.adiantado/kpis.pont.total*100)}% | No Prazo: ${Math.round(kpis.pont.no_prazo/kpis.pont.total*100)}% | Atrasado: ${Math.round(kpis.pont.atrasado/kpis.pont.total*100)}% (meta ≤ 5%)` : '',
  ].filter(l=>l!==undefined).join('\n');

  const blob = new Blob([txt],{type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===================== COPIAR WHATSAPP =====================
function copiarWhatsApp() {
  const dados = filtrarDados(carregarDados());
  const kpis  = calcularKPIs(dados);
  const base  = document.getElementById('filtroBase').value;
  const periodo = {semana:'Esta Semana',ultima_semana:'Semana Passada',mes:'Este Mês',tudo:'Todo o Período'}[document.getElementById('filtroPeriodo').value];
  const data  = new Date().toLocaleDateString('pt-BR');

  const semaforo = (val, meta, inv) => {
    if (val === null) return '⚪';
    return (inv ? val <= meta : val < meta) ? '🟢' : val < meta * 1.3 ? '🟡' : '🔴';
  };

  const fmtBRL = v => v > 0 ? 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
  const fmtPct = v => v !== null ? v.toFixed(2) + '%' : '—';

  const pt = kpis.pont;
  const ptTxt = pt.total > 0
    ? `✅ ${Math.round(pt.adiantado/pt.total*100)}% adiant. | 🟡 ${Math.round(pt.no_prazo/pt.total*100)}% prazo | 🔴 ${Math.round(pt.atrasado/pt.total*100)}% atraso`
    : 'Sem dados';

  // Rotas críticas
  const rotas = {};
  kpis.viagens.forEach(v => {
    if (!v.rota) return;
    if (!rotas[v.rota]) rotas[v.rota] = {n:0,carga:0,custo:0};
    rotas[v.rota].n++; rotas[v.rota].carga += v.valor_carga||0; rotas[v.rota].custo += v.custo_viagem||0;
  });
  const rotasCrit = Object.entries(rotas)
    .map(([r,d]) => ({rota:r, pct: d.carga>0?d.custo/d.carga*100:0}))
    .filter(r => r.pct >= 7)
    .sort((a,b) => b.pct - a.pct)
    .slice(0,3);

  const linhasRotas = rotasCrit.length > 0
    ? rotasCrit.map(r => `   • ${r.rota}: ${r.pct.toFixed(1)}% ${r.pct<10?'⚠️':'🔴'}`).join('\n')
    : '   ✅ Todas as rotas dentro da meta';

  const txt = [
    `📊 *LOGÍSTICA EM VIDROS — ${base==='todas'?'TODAS AS BASES':base.toUpperCase()}*`,
    `_${periodo} · ${data}_`,
    ``,
    `🚛 *VIAGENS*: ${kpis.viagens.length} viagem(ns)`,
    `   Carga: ${fmtBRL(kpis.totalCarga)}`,
    `   Custo: ${fmtBRL(kpis.totalCustoV)}`,
    kpis.pctCustoRota !== null ? `   ${semaforo(kpis.pctCustoRota,7,false)} % Custo/Carga: *${fmtPct(kpis.pctCustoRota)}* (meta < 7%)` : `   ⚪ % Custo/Carga: —`,
    ``,
    `📍 *ROTAS ACIMA DA META:*`,
    linhasRotas,
    ``,
    `⏱️ *PONTUALIDADE*:`,
    `   ${ptTxt}`,
    `   Meta: ≤ 5% atraso`,
    ``,
    `🔧 *MANUTENÇÃO*: ${fmtBRL(kpis.totalManut)}`,
    kpis.pctManutProd !== null ? `   ${semaforo(kpis.pctManutProd,2,false)} % Manut/Produção: *${fmtPct(kpis.pctManutProd)}* (meta < 2%)` : `   ⚪ % Manut/Produção: —`,
    ``,
    `⛽ *ABASTECIMENTO*: ${fmtBRL(kpis.totalAbast)}`,
    ``,
    kpis.pctQuebra !== null
      ? `📦 *QUEBRA EXPEDIÇÃO*: ${semaforo(kpis.pctQuebra,1,false)} *${fmtPct(kpis.pctQuebra)}* (meta < 1%)`
      : `📦 *QUEBRA EXPEDIÇÃO*: ⚪ sem registros`,
    ``,
    `_Gerado pelo Sistema de Indicadores EM Vidros_`,
  ].join('\n');

  navigator.clipboard.writeText(txt).then(() => {
    const btn = document.getElementById('btnWpp');
    btn.textContent = '✅ Copiado!';
    btn.style.background = '#dcfce7';
    btn.style.borderColor = '#16a34a';
    btn.style.color = '#166534';
    setTimeout(() => {
      btn.textContent = '📱 Copiar p/ WhatsApp';
      btn.style = '';
    }, 3000);
  }).catch(() => {
    alert(txt);
  });
}

async function atualizarDados() {
  await carregarDadosRemoto();
  atualizar();
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', atualizarDados);

Object.assign(window, {
  atualizar,
  atualizarDados,
  copiarWhatsApp,
  gerarRelatorio,
  mostrarTela,
});
