import { gravarPreventiva, obterPreventiva } from './preventiva-api.ts';
import { listarRegistros, salvarRegistros } from './registros-api.ts';

// ===================== CONFIG =====================
const VEICULOS_RAPOSA     = ['PTV0006','PTT0004','ROW3A87','SMW0B96','SM02J13','SMP6F86','SMQ2I80'];
const VEICULOS_IMPERATRIZ = ['DMG9D41','NXD4H26','NXB2H55','ROW4J37','SMR2H61','SND9C34','SMM4A02'];
const VEICULOS_BELEM      = ['SMP2F01'];

// Informações dos veículos por placa
const VEICULOS_INFO = {
  'PTV0006': { modelo:'ATEGO 3030 CE', marca:'Mercedes-Benz', ano:'2019/2020', intervalo_preventiva:20000 },
  'PTT0004': { modelo:'ACCELO 1316',   marca:'Mercedes-Benz', ano:'2019/2020', intervalo_preventiva:20000 },
  'ROW3A87': { modelo:'26.260 CRM 6x2',marca:'Volkswagen',    ano:'2023/2024', intervalo_preventiva:30000 },
  'SM02J13': { modelo:'ATEGO 2429',    marca:'Mercedes-Benz', ano:'2024/2025', intervalo_preventiva:30000 },
  'SMP6F86': { modelo:'ATEGO 2429',    marca:'Mercedes-Benz', ano:'2024/2025', intervalo_preventiva:30000 },
  'SMW0B96': { modelo:'ATEGO 2429',    marca:'Mercedes-Benz', ano:'2024/2025', intervalo_preventiva:30000 },
  'SMQ2I80': { modelo:'ACCELO 1017',   marca:'Mercedes-Benz', ano:'2024/2024', intervalo_preventiva:30000 },
};

// Último km registrado no PGQ Manutenção Preventiva 2026
const ULTIMO_KM_PGQ = {
  'PTV0006': 408413,
  'PTT0004': 354277,
  'ROW3A87': 176585,
  'SMP6F86': 136720,
  'SMQ2I80': 40000,
};

// A ordem em que os itens aparecem no card e no select "Adicionar item". A API
// devolve os dois em ordem alfabética de tipo, e a tela nunca mostrou assim: o PGQ
// lista a preventiva geral antes da lavagem, e "Lavagem" vem antes de "Manutenção"
// no alfabeto. Este catálogo é a ordem de exibição; o plano de cada veículo e os
// intervalos vêm do banco.
const TIPOS_PREVENTIVA_PADRAO = [
  { tipo:'Manutenção Preventiva Geral', intervalo_km:30000, alerta_km:3000 },
  { tipo:'Troca de óleo',              intervalo_km:10000, alerta_km:500 },
  { tipo:'Filtro de ar',               intervalo_km:30000, alerta_km:1000 },
  { tipo:'Filtro de combustível',      intervalo_km:30000, alerta_km:1000 },
  { tipo:'Lavagem',                    intervalo_km:3000,  alerta_km:200 },
  { tipo:'Revisão de freios',          intervalo_km:20000, alerta_km:1000 },
  { tipo:'Alinhamento/Balanceamento',  intervalo_km:15000, alerta_km:500 },
  { tipo:'Tacógrafo (calibração)',     intervalo_km:30000, alerta_km:1000 },
];

const ORDEM_CATALOGO = TIPOS_PREVENTIVA_PADRAO.map(t => t.tipo);

// ===================== ESTADO =====================
let baseAtual = 'Raposa';
let abaAtual  = 'preventivas';
let configAtual = {}; // placa → [{tipo, intervalo_km, ultimo_km, alerta_km}]
let placaConfigurando = null;
let dadosImport = [];
// A placa é o que a tela mostra; o PUT do plano precisa do id do veículo. Este mapa
// é a tradução entre os dois, e vem do mesmo GET que traz o plano.
let idPorPlaca = {};
// O catálogo de tipos que o select "Adicionar item" oferece.
let tiposDoCatalogo = [];
// Os registros da base escolhida. Era o `emvidros_indicadores` do navegador, que
// cada render lia de novo; agora é uma leitura por base, guardada aqui.
let registros = [];
// Leitura que falhou não é leitura vazia. Sem esta marca as três abas mostrariam
// "nenhum registro" para uma base cheia, e ninguém saberia que faltou dado.
let erroRegistros = false;
// O mesmo para o plano preventivo. Plano que nao carregou nao e frota em dia: sem esta
// marca, o chip do topo diz "0 Manutencoes Vencidas" com a mesma cara de quando de
// fato nao ha nenhuma.
let erroConfig = false;

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('dataAtual').textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  await Promise.all([carregarConfig(), carregarRegistros()]);
  renderTudo();
});

// ===================== CONFIG PERSISTIDA =====================
// O plano padrão da Raposa não é mais pré-carregado aqui: ele está semeado no banco,
// e duas cópias da mesma tabela divergiriam na primeira edição.
async function carregarConfig() {
  try {
    const plano = await obterPreventiva();
    tiposDoCatalogo = naOrdemDoCatalogo(plano.tipos, ORDEM_CATALOGO);
    configAtual = Object.fromEntries(plano.veiculos.map(v => [v.placa, naOrdemDoCatalogo(v.itens, ORDEM_CATALOGO)]));
    idPorPlaca  = Object.fromEntries(plano.veiculos.map(v => [v.placa, v.id]));
    erroConfig = false;
  } catch { configAtual = {}; idPorPlaca = {}; tiposDoCatalogo = []; erroConfig = true; }
}

/**
 * A lista na ordem de `tipos`, com o que não estiver nela depois, como veio. A API
 * ordena por nome, e a tela nunca mostrou assim: o card da Raposa abre com a
 * preventiva geral e depois a lavagem, que é a ordem do PGQ.
 *
 * Depois de gravar, `tipos` é a ordem que estava na tela, e não o catálogo: o item
 * que a pessoa acabou de adicionar continua no fim da lista onde ela o viu entrar.
 */
function naOrdemDoCatalogo(itens, tipos) {
  const posicao = new Map(tipos.map((tipo, i) => [tipo, i]));
  return [...itens].sort((a, b) => (posicao.get(a.tipo) ?? tipos.length) - (posicao.get(b.tipo) ?? tipos.length));
}

/**
 * Grava o plano inteiro da placa, que é o que o PUT recebe. Lista vazia é pedido
 * legítimo e quer dizer "removi tudo".
 *
 * Recusa desfaz: `anterior` volta para `configAtual`, senão a tela ficaria mostrando
 * um item que o banco não tem. Quem chama sempre redesenha depois, com o que sobrou.
 */
async function salvarPlano(placa, anterior) {
  const veiculoId = idPorPlaca[placa];
  if (!veiculoId) {
    configAtual[placa] = anterior;
    alert(`⚠️ ${placa} não está no cadastro desta conta. O plano não foi salvo.`);
    return false;
  }
  const itens = (configAtual[placa] || []).map(it => ({
    tipo: it.tipo,
    intervalo_km: it.intervalo_km,
    alerta_km: it.alerta_km,
    ultimo_km: it.ultimo_km ?? null,
    obs: it.obs ?? null,
  }));
  try {
    const salvo = await gravarPreventiva(veiculoId, itens);
    configAtual[placa] = naOrdemDoCatalogo(salvo.itens, itens.map(it => it.tipo));
    return true;
  } catch (e) {
    configAtual[placa] = anterior;
    alert(`⚠️ ${motivoDaFalha(e, 'Não foi possível salvar.')}`);
    return false;
  }
}

/** Falha de rede não tem resposta e vira TypeError; com resposta, o texto é da API. */
function motivoDaFalha(e, padrao) {
  if (e instanceof TypeError) return 'Sem conexão. Tente de novo.';
  return e instanceof Error ? e.message : padrao;
}

function copiaDoPlano(placa) {
  return (configAtual[placa] || []).map(it => ({...it}));
}

// ===================== REGISTROS =====================
async function carregarRegistros() {
  try { registros = await listarRegistros(baseAtual); erroRegistros = false; }
  catch { registros = []; erroRegistros = true; }
}

// ===================== KM ATUAL POR PLACA =====================
function kmAtualPorPlaca(placa) {
  let max = null;
  registros.forEach(d => {
    const p = (d.veiculo || d.placa || '').toUpperCase();
    if (p !== placa.toUpperCase()) return;
    const candidates = [d.km_chegada, d.km, d.km_odometro].filter(v => v && v > 0);
    candidates.forEach(v => { if (max === null || v > max) max = v; });
  });
  return max;
}

// ===================== STATUS PREVENTIVA =====================
function calcularStatus(item, kmAtual) {
  if (!item.ultimo_km) return { status:'sem_dado', restante:null };
  const proximo = item.ultimo_km + item.intervalo_km;
  const restante = proximo - (kmAtual || item.ultimo_km);
  if (restante <= 0) return { status:'vencida', restante };
  if (restante <= item.alerta_km) return { status:'alerta', restante };
  return { status:'ok', restante };
}

// ===================== RESUMO =====================
function renderResumo() {
  const veiculos = veiculosDaBase(baseAtual);
  let nVencidas = 0, nAlertas = 0, nOk = 0, nSemDados = 0, nPendenteDoc = 0;

  veiculos.forEach(pl => {
    const itens = configAtual[pl] || [];
    const km = kmAtualPorPlaca(pl);
    itens.forEach(it => {
      const { status } = calcularStatus(it, km);
      if (status === 'vencida') nVencidas++;
      else if (status === 'alerta') nAlertas++;
      else if (status === 'ok') nOk++;
      else nSemDados++;
    });
  });

  // Pendências documentais
  nPendenteDoc = registros.filter(d => d.tipo==='manutencao' && d.base===baseAtual && d.status_documental==='pendente').length;

  // Numero que nao foi possivel calcular sai como travessao, nao como zero. Zero e uma
  // afirmacao sobre a frota; o travessao diz que nao deu para ler.
  const num = (valor, falhou) => falhou ? '—' : valor;

  const el = document.getElementById('summaryChips');
  el.innerHTML = `
    <div class="summary-chip chip-vencida"><span class="chip-num">${num(nVencidas, erroConfig)}</span><span class="chip-label">Manutenções<br>Vencidas</span></div>
    <div class="summary-chip chip-alerta"><span class="chip-num">${num(nAlertas, erroConfig)}</span><span class="chip-label">Em<br>Alerta</span></div>
    <div class="summary-chip chip-ok"><span class="chip-num">${num(nOk, erroConfig)}</span><span class="chip-label">Em<br>Dia</span></div>
    <div class="summary-chip chip-pendente-doc"><span class="chip-num">${num(nPendenteDoc, erroRegistros)}</span><span class="chip-label">Pendente<br>de Documento</span></div>
  `;
}

// ===================== VEÍCULOS POR BASE =====================
function veiculosDaBase(base) {
  return base==='Raposa' ? VEICULOS_RAPOSA : base==='Imperatriz' ? VEICULOS_IMPERATRIZ : VEICULOS_BELEM;
}

// ===================== GRADE DE VEÍCULOS =====================
function renderGradeVeiculos() {
  const grade = document.getElementById('gradeVeiculos');
  const veiculos = veiculosDaBase(baseAtual);
  grade.innerHTML = veiculos.map(placa => renderCardVeiculo(placa)).join('');
}

function renderCardVeiculo(placa) {
  const km = kmAtualPorPlaca(placa) || ULTIMO_KM_PGQ[placa] || null;
  const itens = configAtual[placa] || [];
  const info = VEICULOS_INFO[placa];
  const kmStr = km ? km.toLocaleString('pt-BR') + ' km' : 'km não registrado';
  const modeloStr = info ? `${info.modelo} · ${info.marca} · ${info.ano}` : '';

  const itensHTML = itens.length === 0
    ? `<div style="padding:14px 16px;font-size:.82rem;color:var(--txt-muted);text-align:center;">Nenhum item configurado</div>`
    : itens.map(it => {
        const { status, restante } = calcularStatus(it, km);
        const dotClass = status==='vencida' ? 'status-vencida' : status==='alerta' ? 'status-alerta' : 'status-ok';
        const restTxt = restante === null ? '—'
          : restante <= 0 ? `${Math.abs(restante).toLocaleString('pt-BR')} km vencida`
          : `${restante.toLocaleString('pt-BR')} km restantes`;
        return `<div class="manut-item">
          <div class="status-dot ${dotClass}"></div>
          <div class="manut-nome">${it.tipo}</div>
          <div class="manut-restante" style="color:${status==='vencida'?'var(--red)':status==='alerta'?'var(--yellow)':'var(--green)'}">${restTxt}</div>
        </div>`;
      }).join('');

  return `<div class="veiculo-card">
    <div class="veiculo-header">
      <div class="placa-badge">${placa}</div>
      <div style="flex:1;min-width:0;margin-left:8px;"><div style="font-size:.72rem;color:var(--txt-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${modeloStr}</div><div class="veiculo-km" style="margin-left:0;">📏 ${kmStr}</div></div>
    </div>
    <div class="veiculo-items">${itensHTML}</div>
    <div class="manut-actions">
      <button class="btn-sm btn-config-sm" onclick="abrirConfig('${placa}')">⚙️ Configurar</button>
      <button class="btn-sm btn-registrar-sm" onclick="irParaRegistro('${placa}')">+ Registrar</button>
    </div>
  </div>`;
}

// ===================== CORRETIVAS =====================
function renderCorretivas() {
  const lista = document.getElementById('listaCorretivas');
  const total = document.getElementById('totalCorretivas');
  // A leitura falha no carregamento, e não mais dentro de cada render. O aviso é o
  // mesmo de antes, porque para quem lê a tela o fato é o mesmo: não deu para ler.
  if (!erroRegistros) {
    const corretivas = registros.filter(d => d.tipo==='manutencao' && d.tipo_manutencao==='corretiva' && d.base===baseAtual)
      .sort((a,b)=>new Date(b.registrado_em)-new Date(a.registrado_em));
    total.textContent = `${corretivas.length} registro${corretivas.length!==1?'s':''}`;
    if (corretivas.length === 0) {
      lista.innerHTML = '<div style="padding:30px;text-align:center;color:var(--txt-muted);">Nenhuma corretiva registrada para esta base.</div>';
      return;
    }
    lista.innerHTML = corretivas.map(d => rowManutencao(d)).join('');
    return;
  }
  lista.innerHTML = '<div style="padding:20px;color:var(--txt-muted);">Erro ao carregar dados.</div>';
}

// ===================== HISTÓRICO =====================
function renderHistorico() {
  const lista = document.getElementById('listaHistorico');
  const filtroTipo = document.getElementById('filtroTipoHistorico').value;
  const filtroDoc  = document.getElementById('filtroDocHistorico').value;
  if (!erroRegistros) {
    let manutencoes = registros.filter(d => d.tipo==='manutencao' && d.base===baseAtual);
    if (filtroTipo) manutencoes = manutencoes.filter(d => d.tipo_manutencao===filtroTipo);
    if (filtroDoc)  manutencoes = manutencoes.filter(d => d.status_documental===filtroDoc);
    manutencoes.sort((a,b)=>new Date(b.registrado_em)-new Date(a.registrado_em));
    if (manutencoes.length === 0) {
      lista.innerHTML = '<div style="padding:30px;text-align:center;color:var(--txt-muted);">Nenhum registro com esses filtros.</div>';
      return;
    }
    lista.innerHTML = manutencoes.map(d => rowManutencao(d)).join('');
    return;
  }
  lista.innerHTML = '<div style="padding:20px;color:var(--txt-muted);">Erro ao carregar dados.</div>';
}

function rowManutencao(d) {
  const tipo = d.tipo_manutencao || '—';
  const badgeClass = tipo==='preventiva' ? 'badge-preventiva' : 'badge-corretiva';
  const data = d.data_entrada || d.data || d.registrado_em?.split('T')[0] || '—';
  const docStatus = d.status_documental === 'concluido'
    ? `<span class="doc-ok">✅ Doc OK</span>`
    : `<span class="doc-pendente">📎 Pendente</span>`;
  return `<div class="reg-row">
    <span class="reg-tipo-badge ${badgeClass}">${tipo==='preventiva'?'🛡️ Preventiva':'🔨 Corretiva'}</span>
    <div class="reg-info">
      <div class="reg-titulo">${d.placa||'—'} · ${d.servico||'—'}</div>
      <div class="reg-detalhe">R$ ${(d.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})} · ${d.fornecedor||'—'}${d.km_odometro?' · '+d.km_odometro.toLocaleString('pt-BR')+' km':''}</div>
      <div class="reg-docs" style="margin-top:4px;">${docStatus}${d.data_programada ? ` · Programada: ${d.data_programada}` : ''}</div>
    </div>
    <div class="reg-data">${data}</div>
  </div>`;
}

// ===================== MODAL CONFIG PREVENTIVA =====================
function abrirConfig(placa) {
  placaConfigurando = placa;
  const itens = configAtual[placa] || [];
  const km = kmAtualPorPlaca(placa);
  document.getElementById('modalConfigTitulo').textContent = `⚙️ Preventivas — ${placa}`;
  const body = document.getElementById('modalConfigBody');

  const itensHTML = itens.map((it,i) => `
    <div class="item-linha" id="il_${i}">
      <div>
        <div class="item-nome">${it.tipo}</div>
        <div class="item-detalhe">A cada ${it.intervalo_km.toLocaleString('pt-BR')} km · Alerta ${it.alerta_km.toLocaleString('pt-BR')} km antes · Último: ${it.ultimo_km ? it.ultimo_km.toLocaleString('pt-BR')+' km' : 'não informado'}</div>
      </div>
      <button class="btn-del" onclick="removerItem(${i})">✕</button>
    </div>`).join('');

  body.innerHTML = `
    <div style="font-size:.78rem;color:var(--txt-dim);margin-bottom:12px;">km atual registrado: <strong>${km ? km.toLocaleString('pt-BR')+' km' : 'não disponível'}</strong></div>
    <div id="listaItensConfig">${itensHTML || '<div style="color:var(--txt-muted);font-size:.83rem;margin-bottom:12px;">Nenhum item configurado ainda.</div>'}</div>
    <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px;">
      <div style="font-size:.8rem;font-weight:700;color:var(--txt-dim);margin-bottom:10px;">Adicionar item:</div>
      <div class="form-group">
        <label class="lbl">Tipo de manutenção</label>
        <select id="novoTipo" class="inp">
          ${tiposDoCatalogo.map(t=>`<option value="${t.tipo}">${t.tipo}</option>`).join('')}
          <option value="__outro__">Outro (digitar abaixo)</option>
        </select>
      </div>
      <div class="form-group" id="grupoOutroTipo" style="display:none;">
        <label class="lbl">Descrição</label>
        <input type="text" id="novoTipoCustom" class="inp" placeholder="Ex: Troca de correia dentada">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="lbl">Intervalo (km)</label>
          <input type="number" id="novoIntervalo" class="inp" placeholder="10000">
        </div>
        <div class="form-group">
          <label class="lbl">Alerta (km antes)</label>
          <input type="number" id="novoAlerta" class="inp" placeholder="500">
        </div>
        <div class="form-group">
          <label class="lbl">Último km realizado</label>
          <input type="number" id="novoUltimoKm" class="inp" placeholder="${km||''}">
        </div>
      </div>
      <button type="button" class="btn-sm btn-registrar-sm" style="width:100%;margin-top:4px;" onclick="adicionarItemConfig()">+ Adicionar item</button>
    </div>`;

  document.getElementById('novoTipo').addEventListener('change', e => {
    document.getElementById('grupoOutroTipo').style.display = e.target.value==='__outro__' ? 'block' : 'none';
  });

  document.getElementById('modalConfig').classList.add('aberto');
}

async function removerItem(idx) {
  if (!confirm('Remover este item?')) return;
  const placa = placaConfigurando;
  const anterior = copiaDoPlano(placa);
  (configAtual[placa] || []).splice(idx, 1);
  await salvarPlano(placa, anterior);
  abrirConfig(placa);
}

async function adicionarItemConfig() {
  const tipoSel = document.getElementById('novoTipo').value;
  const tipo = tipoSel === '__outro__' ? document.getElementById('novoTipoCustom').value.trim() : tipoSel;
  const intervalo = parseInt(document.getElementById('novoIntervalo').value) || 0;
  const alerta    = parseInt(document.getElementById('novoAlerta').value) || 500;
  const ultimoKm  = parseInt(document.getElementById('novoUltimoKm').value) || null;
  if (!tipo || !intervalo) { alert('Preencha o tipo e o intervalo de km.'); return; }
  const placa = placaConfigurando;
  const anterior = copiaDoPlano(placa);
  if (!configAtual[placa]) configAtual[placa] = [];
  configAtual[placa].push({ tipo, intervalo_km: intervalo, alerta_km: alerta, ultimo_km: ultimoKm });
  await salvarPlano(placa, anterior);
  abrirConfig(placa);
}

async function salvarConfig() {
  const placa = placaConfigurando;
  // Fechar com o item ainda não gravado é o que o botão promete não fazer, então a
  // recusa mantém o modal aberto e redesenhado com o que o banco tem.
  if (!await salvarPlano(placa, copiaDoPlano(placa))) { abrirConfig(placa); return; }
  fecharModalConfig();
  renderTudo();
}

function fecharModalConfig() {
  document.getElementById('modalConfig').classList.remove('aberto');
  placaConfigurando = null;
}

// ===================== IMPORT =====================
function abrirImport() { document.getElementById('modalImport').classList.add('aberto'); }
function fecharModalImport() {
  document.getElementById('modalImport').classList.remove('aberto');
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('btnConfirmarImport').style.display = 'none';
  dadosImport = [];
}

function processarImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const texto = e.target.result;
    const linhas = texto.split('\n').map(l=>l.trim()).filter(Boolean);
    if (linhas.length < 2) { document.getElementById('importPreview').innerHTML = '<div style="color:var(--red);">Arquivo inválido ou vazio.</div>'; return; }
    const headers = linhas[0].split(',').map(h=>h.trim().toLowerCase());
    dadosImport = [];
    const erros = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(',');
      const row = {};
      headers.forEach((h,j) => row[h] = (cols[j]||'').trim());
      if (!row.placa || !row.data) { erros.push(`Linha ${i+1}: placa ou data ausente`); continue; }
      dadosImport.push({
        tipo:'manutencao', base: row.base || baseAtual,
        // `registrado_em`, `data` e `status_documental` saíram: quem carimba a hora
        // de registro e o estado documental é o servidor, e mandá-los daqui só
        // repetiria, em outro relógio, o que ele já sabe.
        data_entrada: row.data,
        placa: row.placa.toUpperCase(),
        tipo_manutencao: (row.tipo||'corretiva').toLowerCase().includes('prev') ? 'preventiva' : 'corretiva',
        servico: row.servico || row['serviço'] || '—',
        valor: parseFloat(row.valor) || 0,
        fornecedor: row.fornecedor || '',
        km_odometro: parseInt(row.km) || null,
      });
    }
    const preview = document.getElementById('importPreview');
    preview.innerHTML = `<div style="background:var(--green-soft);border:1px solid var(--green);border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:.85rem;"><strong>${dadosImport.length} registros</strong> encontrados para importar${erros.length?` · <span style="color:var(--red);">${erros.length} com erro</span>`:''}</div>`;
    if (erros.length) preview.innerHTML += `<div style="font-size:.78rem;color:var(--red);">${erros.join('<br>')}</div>`;
    document.getElementById('btnConfirmarImport').style.display = dadosImport.length ? 'block' : 'none';
  };
  reader.readAsText(file, 'UTF-8');
}

// O POST aceita 100 registros por vez, e a planilha que se importa costuma passar
// disso. O lote é a única coisa que o arquivo grande muda: cada um deles entra
// inteiro ou não entra, e o que a pessoa vê no fim continua sendo uma frase só.
const LOTE_IMPORT = 100;

async function confirmarImport() {
  if (!dadosImport.length) return;
  const total = dadosImport.length;
  let gravados = 0;
  try {
    for (let i = 0; i < total; i += LOTE_IMPORT) {
      const lote = dadosImport.slice(i, i + LOTE_IMPORT);
      await salvarRegistros(lote);
      gravados += lote.length;
    }
  } catch (e) {
    // O armazenamento do navegador nunca recusava, então esta frase não tem original
    // a preservar. Ela diz quanto entrou porque o lote que passou não volta, e tira os
    // gravados da fila para o botão repetir só o que faltou, sem duplicar nada.
    dadosImport = dadosImport.slice(gravados);
    alert(`⚠️ ${gravados} de ${total} registros importados. ${motivoDaFalha(e, 'Não foi possível importar.')}`);
    return;
  }
  alert(`✅ ${total} registros importados com sucesso!`);
  fecharModalImport();
  await carregarRegistros();
  renderTudo();
}

// ===================== NAVEGAÇÃO =====================
async function selecionarBase(base) {
  baseAtual = base;
  ['Raposa','Imperatriz','Belém'].forEach(b => {
    const el = document.getElementById('chip' + b.replace('é','e').replace('ê','e'));
    if (!el) return;
    el.className = 'base-chip';
    if (b===base) el.className += ' ativo-' + b.toLowerCase().replace('é','e').replace('ê','e');
  });
  // Os registros vêm por base, então trocar de base é uma leitura nova. O chip já
  // mudou acima: a marca de qual base está escolhida não espera a rede.
  await carregarRegistros();
  renderTudo();
}

function mudarAba(aba) {
  abaAtual = aba;
  ['preventivas','corretivas','historico'].forEach(a => {
    document.getElementById('tab' + a.charAt(0).toUpperCase()+a.slice(1)).classList.toggle('ativo', a===aba);
    document.getElementById('painel' + a.charAt(0).toUpperCase()+a.slice(1)).style.display = a===aba ? '' : 'none';
  });
  renderTudo();
}

function irParaRegistro(placa) {
  window.location = 'formulario-registro.html?placa=' + placa + '&tipo=manutencao';
}

// ===================== RENDER TUDO =====================
function renderTudo() {
  renderResumo();
  if (abaAtual === 'preventivas') renderGradeVeiculos();
  if (abaAtual === 'corretivas')  renderCorretivas();
  if (abaAtual === 'historico')   renderHistorico();
}

// O código desta tela era inline e rodava no escopo global, onde todo `onclick=` do
// markup vai procurar a função. Como módulo ele tem escopo próprio, e sem esta ponte
// os 13 botões abrem, pintam e não fazem nada, sem erro visível na tela.
Object.assign(window, {
  abrirConfig,
  abrirImport,
  adicionarItemConfig,
  confirmarImport,
  fecharModalConfig,
  fecharModalImport,
  irParaRegistro,
  mudarAba,
  processarImport,
  removerItem,
  renderHistorico,
  salvarConfig,
  selecionarBase,
});
