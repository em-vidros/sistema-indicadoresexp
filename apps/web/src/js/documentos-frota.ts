import {
  atualizarDocumento,
  caminhoArquivoDocumento,
  enviarDocumento,
  listarDocumentos,
  obterCatalogoDocumentos,
  salvarDadosDocumento,
} from './documentos-api.ts'

// ===================== CONFIG =====================

const VEICULOS_INFO = {
  'PTV0006': { modelo:'ATEGO 3030 CE',  marca:'Mercedes-Benz', ano:'2019/2020' },
  'PTT0004': { modelo:'ACCELO 1316',    marca:'Mercedes-Benz', ano:'2019/2020' },
  'ROW3A87': { modelo:'26.260 CRM 6x2', marca:'Volkswagen',    ano:'2023/2024' },
  'SM02J13': { modelo:'ATEGO 2429',     marca:'Mercedes-Benz', ano:'2024/2025' },
  'SMP6F86': { modelo:'ATEGO 2429',     marca:'Mercedes-Benz', ano:'2024/2025' },
  'SMW0B96': { modelo:'ATEGO 2429',     marca:'Mercedes-Benz', ano:'2024/2025' },
  'SMQ2I80': { modelo:'ACCELO 1017',    marca:'Mercedes-Benz', ano:'2024/2024' },
  'DMG9D41': { modelo:'—', marca:'—', ano:'—' },
  'NXD4H26': { modelo:'—', marca:'—', ano:'—' },
  'NXB2H55': { modelo:'—', marca:'—', ano:'—' },
  'ROW4J37': { modelo:'—', marca:'—', ano:'—' },
  'SMR2H61': { modelo:'—', marca:'—', ano:'—' },
  'SND9C34': { modelo:'—', marca:'—', ano:'—' },
  'SMM4A02': { modelo:'—', marca:'—', ano:'—' },
  'SMP2F01': { modelo:'—', marca:'—', ano:'—' },
};

const MOTORISTAS_RAPOSA = ['Anderson Penha Dos Anjos','Gabriel Reis Costa','Leandro do Nascimento Brito','Raimundo Correia Ferreira','Raimundo Nonato da Silva Divino','Saturnino Assumpção Dias Filho','Silio Vinicius Cruz Castro','Victor Gonçalves Vasconcelos'];
const MOTORISTAS_IMPERATRIZ = ['Nataniel Pereira Rocha','Francisco Pereira dos Santos','Evandro de Oliveira Cardim','Francisco de Sousa Cabral','Adriel da Silva Santos','Sebastiao de Brito Matos','Italo Melo Sales','Railton da Silva Batista'];
const MOTORISTAS_BELEM = ['Severino Manoel Barata do Nascimento'];

const VEICULOS_RAPOSA     = ['PTV0006','PTT0004','ROW3A87','SMW0B96','SM02J13','SMP6F86','SMQ2I80'];
const VEICULOS_IMPERATRIZ = ['DMG9D41','NXD4H26','NXB2H55','ROW4J37','SMR2H61','SND9C34','SMM4A02'];
const VEICULOS_BELEM      = ['SMP2F01'];

// Manuais dos fabricantes — Raposa
const MANUAIS_RAPOSA = [
  { titulo:'Manual ATEGO 2429 / 3030 CE',        marca:'Mercedes-Benz', modelos:'ATEGO 2429 · ATEGO 3030 CE',        placas:'SM02J13, SMP6F86, SMW0B96, PTV0006', url:'docs/manual-atego.pdf' },
  { titulo:'Manual ACCELO 1316 (Euro V)',         marca:'Mercedes-Benz', modelos:'ACCELO 1316 (Euro V)',              placas:'PTT0004',                             url:'docs/manual-accelo-euro-v.pdf' },
  { titulo:'Manual ACCELO 1017 (Euro VI)',        marca:'Mercedes-Benz', modelos:'ACCELO 1017 (Euro VI)',             placas:'SMQ2I80',                             url:'docs/manual-accelo-euro-vi.pdf' },
  { titulo:'Manual 26.260 CRM 6x2',              marca:'Volkswagen',    modelos:'26.260 CRM 6x2',                    placas:'ROW3A87',                             url:'docs/manual-volks.pdf' },
];

// Planos de manutenção
const PLANOS = [
  { titulo:'PGQ MAN — Programa de Manutenção Preventiva 2026', descricao:'Cronograma anual assinado — todos os veículos Raposa', url:'docs/pgq-manutencao-2026.pdf', tipo:'plano' },
];

// Arquivos disponíveis por placa (vencimento pré-setado para cálculo de alerta)
const DOCS_ESTATICOS = {
  'PTV0006': { seguradora:'Bradesco', apolice_url:'docs/apolice-PTV0006.pdf', apolice_venc:'2026-12-26', tacografo_url:'docs/tacografo-PTV0006.pdf' },
  'PTT0004': { seguradora:'MAPFRE',   apolice_url:'docs/apolice-PTT0004.pdf', apolice_venc:'2026-08-31', tacografo_url:'docs/tacografo-PTT0004.pdf' },
  'ROW3A87': { seguradora:'Bradesco', apolice_url:'docs/apolice-ROW3A87.pdf', apolice_venc:'2026-09-11', tacografo_url:'docs/tacografo-ROW3A87.pdf' },
  'SM02J13': { seguradora:'MAPFRE',   apolice_url:'docs/apolice-SM02J13.pdf', apolice_venc:'2026-06-14', tacografo_url:'docs/tacografo-SM02J13.pdf' },
  'SMP6F86': { seguradora:'MAPFRE',   apolice_url:'docs/apolice-SMP6F86.pdf', apolice_venc:'2026-06-12', tacografo_url:'docs/tacografo-SMP6F86.pdf' },
  'SMW0B96': { seguradora:'Bradesco', apolice_url:'docs/apolice-SMW0B96.pdf', apolice_venc:'2026-12-11', tacografo_url:'docs/tacografo-SMW0B96.pdf' },
  'SMQ2I80': { seguradora:'Bradesco', apolice_url:'docs/apolice-SMQ2I80.pdf', apolice_venc:'2027-07-17', tacografo_url:'docs/tacografo-SMQ2I80.pdf' },
};

// ===================== ESTADO =====================
let docsCfg = {};
let catalogoDb = { bases: [], veiculos: [], colaboradores: [] };
let documentosDb = [];

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('dataAtual').textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  try {
    await carregarDocs();
    renderTudo();
  } catch (falha) {
    alert(falha instanceof Error ? falha.message : 'Não foi possível carregar os documentos.');
  }
});

async function carregarDocs() {
  [catalogoDb, documentosDb] = await Promise.all([obterCatalogoDocumentos(), listarDocumentos()]);
  docsCfg = {};
  documentosDb.forEach(doc => {
    const fonte = doc.temArquivo ? caminhoArquivoDocumento(doc.id) : doc.linkExterno || '';
    if (doc.veiculoId) {
      const placa = catalogoDb.veiculos.find(v => v.id === doc.veiculoId)?.placa;
      if (!placa) return;
      docsCfg[placa] ||= {};
      const tipo = doc.tipo === 'apolice' ? 'seguro' : doc.tipo;
      docsCfg[placa][tipo] = {
        id: doc.id, vencimento: doc.vencimento || '', link: fonte,
        linkExterno: doc.linkExterno || '', nomeArq: doc.nomeArquivo || '', temArquivo: doc.temArquivo,
      };
      if (doc.tipo === 'apolice') {
        docsCfg[placa].seguradora = doc.seguradora || '';
        docsCfg[placa].emergencia = doc.contatoEmergencia || '';
      }
    }
    if (doc.colaboradorId) {
      const nome = catalogoDb.colaboradores.find(p => p.id === doc.colaboradorId)?.nome;
      if (!nome) return;
      docsCfg['moto_' + nome] = { cnh: {
        id: doc.id, vencimento: doc.vencimento || '', numero: doc.cnhNumero || '',
        categoria: doc.cnhCategoria || '', link: fonte,
      }};
    }
  });
}

// ===================== UTILITÁRIOS =====================
function getBase() { return document.getElementById('filtroBase').value; }

function veiculosDaBase(base) {
  return base==='Raposa' ? VEICULOS_RAPOSA : base==='Imperatriz' ? VEICULOS_IMPERATRIZ : VEICULOS_BELEM;
}

function motoristasBase(base) {
  return base==='Raposa' ? MOTORISTAS_RAPOSA : base==='Imperatriz' ? MOTORISTAS_IMPERATRIZ : MOTORISTAS_BELEM;
}

function diasAteVencer(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(dataStr + 'T00:00:00');
  return Math.round((venc - hoje) / 86400000);
}

function statusVencimento(dataStr, alertaDias) {
  const dias = diasAteVencer(dataStr);
  if (dias === null) return 'sem-data';
  if (dias < 0)           return 'vencido';
  if (dias <= alertaDias) return 'alerta';
  return 'ok';
}

function statusLabel(dataStr, alertaDias) {
  const dias = diasAteVencer(dataStr);
  if (dias === null) return { cls:'status-sem-data', txt:'Sem data' };
  if (dias < 0)     return { cls:'status-vencido',  txt:`Vencido há ${Math.abs(dias)} dias` };
  if (dias <= alertaDias) return { cls:'status-alerta', txt:`Vence em ${dias} dias` };
  return { cls:'status-ok', txt:`${dias} dias restantes` };
}

// ===================== RESUMO =====================
function renderResumo() {
  const base = getBase();
  const veiculos = veiculosDaBase(base);
  const motoristas = motoristasBase(base);
  let vencidos = 0, alertas = 0, ok = 0;

  const tiposVeiculo = ['tacografo','seguro','crlv'];
  veiculos.forEach(pl => {
    tiposVeiculo.forEach(t => {
      const d = docsCfg[pl]?.[t];
      const alerta = t==='tacografo' ? 30 : 60;
      const s = statusVencimento(d?.vencimento, alerta);
      if (s==='vencido') vencidos++;
      else if (s==='alerta') alertas++;
      else if (s==='ok') ok++;
    });
  });
  motoristas.forEach(m => {
    const d = docsCfg['moto_'+m]?.cnh;
    const s = statusVencimento(d?.vencimento, 60);
    if (s==='vencido') vencidos++;
    else if (s==='alerta') alertas++;
    else if (s==='ok') ok++;
  });

  document.getElementById('resumoChips').innerHTML = `
    <div class="chip chip-red"><span class="chip-num">${vencidos}</span><span class="chip-label">Vencidos</span></div>
    <div class="chip chip-yellow"><span class="chip-num">${alertas}</span><span class="chip-label">Próximos<br>do vencimento</span></div>
    <div class="chip chip-green"><span class="chip-num">${ok}</span><span class="chip-label">Em dia</span></div>
  `;
}

// ===================== MANUAIS =====================
function renderManuais() {
  const base = getBase();
  const manuais = base === 'Raposa' ? MANUAIS_RAPOSA : [];
  const el = document.getElementById('listaManuals');
  if (manuais.length === 0) {
    el.innerHTML = '<div style="color:var(--txt-muted);font-size:.85rem;padding:8px 0;">Manuais não configurados para esta base ainda.</div>';
    return;
  }
  el.innerHTML = manuais.map((m) => {
    const documento = documentosDb.find(doc => doc.tipo === 'manual' && doc.titulo === m.titulo);
    const url = documento ? (documento.temArquivo ? caminhoArquivoDocumento(documento.id) : documento.linkExterno || '') : '';
    return `<div class="manual-item">
      <div style="font-size:1.8rem;">📖</div>
      <div class="manual-info">
        <div class="manual-titulo">${m.titulo}</div>
        <div class="manual-sub">${m.marca} · ${m.modelos}</div>
        <div style="font-size:.72rem;color:var(--txt-muted);margin-top:2px;">Placas: ${m.placas}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <a href="${url}" target="_blank" class="btn-sm btn-ver">📄 Visualizar</a>
        <a href="${url}" download class="btn-sm btn-upload">⬇️ Baixar</a>
      </div>
    </div>
  `}).join('');
}

// ===================== PLANO =====================
function renderPlanos() {
  const base = getBase();
  const el = document.getElementById('gradeplantas');
  const planos = base === 'Raposa' ? PLANOS : [];
  if (planos.length === 0) { el.innerHTML = '<div style="color:var(--txt-muted);font-size:.85rem;">Nenhum plano configurado.</div>'; return; }
  el.innerHTML = planos.map((p) => {
    const documento = documentosDb.find(doc => doc.tipo === 'plano_pgq' && doc.titulo === p.titulo);
    const url = documento ? (documento.temArquivo ? caminhoArquivoDocumento(documento.id) : documento.linkExterno || '') : '';
    return `<div class="doc-card">
      <div class="doc-card-header">
        <div class="doc-ico">📋</div>
        <div><div class="doc-titulo">${p.titulo}</div><div class="doc-sub">${p.descricao}</div></div>
      </div>
      <div class="doc-actions">
        <a href="${url}" target="_blank" class="btn-sm btn-ver">📄 Visualizar</a>
        <a href="${url}" download class="btn-sm btn-upload">⬇️ Baixar</a>
      </div>
    </div>
  `}).join('');
}

// ===================== VEÍCULOS =====================
function renderVeiculos() {
  const base = getBase();
  const veiculos = veiculosDaBase(base);
  const el = document.getElementById('gradeVeiculos');
  el.innerHTML = veiculos.map(pl => {
    const info   = VEICULOS_INFO[pl] || {};
    const cfg    = docsCfg[pl] || {};
    const tac    = cfg.tacografo || {};
    const seg    = cfg.seguro    || {};
    const crlv   = cfg.crlv     || {};
    const segVenc = seg.vencimento || '';
    const sTac   = statusLabel(tac.vencimento, 30);
    const sSeg   = statusLabel(segVenc, 60);
    const sCrlv  = statusLabel(crlv.vencimento, 60);
    const seguradora = cfg.seguradora || '';
    const segEmerg   = cfg.emergencia || '';

    const srcSeg = seg.link || '';
    const srcTac = tac.link || '';
    const srcCrlv = crlv.link || '';

    const linhaDoc = (tipo, label, statusEl, src, extra='') => `
      <div class="doc-linha">
        <div class="doc-linha-label">${label}${extra ? `<span class="doc-linha-seg">${extra}</span>` : ''}</div>
        <div class="doc-linha-btns">
          <span class="doc-status ${statusEl.cls}">${statusEl.txt}</span>
          <button class="btn-doc importar" onclick="importarDocCard('${pl}','${tipo}')" title="Importar PDF">📎 Importar</button>
          ${src ? `<button class="btn-doc tem-arquivo" onclick="verDocCard('${pl}','${tipo}')" title="Visualizar">📄 Ver</button>` : ''}
          ${src ? `<button class="btn-doc tem-arquivo" onclick="baixarDocCard('${pl}','${tipo}')" title="Baixar">⬇️ Baixar</button>` : ''}
        </div>
      </div>`;

    return `<div class="doc-card">
      <div class="doc-card-header">
        <div class="doc-ico">🚛</div>
        <div style="flex:1;">
          <div class="doc-titulo">${pl}</div>
          <div class="doc-sub">${info.modelo||'—'} · ${info.ano||'—'}</div>
        </div>
        ${seguradora ? `<div style="font-size:.72rem;font-weight:700;background:var(--accent-soft);color:var(--accent);border-radius:6px;padding:3px 8px;white-space:nowrap;">${seguradora}</div>` : ''}
      </div>
      ${segEmerg
        ? `<div style="background:#fef9c3;border:1.5px solid #fde047;border-radius:8px;padding:7px 10px;margin:4px 0;display:flex;align-items:center;gap:6px;">
            <span>🚨</span>
            <div>
              <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#854d0e;">Sinistro / Emergência</div>
              <div style="font-size:.88rem;font-weight:700;color:#78350f;">${segEmerg}</div>
            </div>
          </div>`
        : `<div style="background:var(--bg-app);border:1.5px dashed var(--border);border-radius:8px;padding:6px 10px;margin:4px 0;font-size:.75rem;color:var(--txt-muted);cursor:pointer;" onclick="abrirModalVeiculo('${pl}')">🚨 Adicionar contato de emergência</div>`}
      <div style="margin:8px 0;">
        ${linhaDoc('seguro',    'Apólice de Seguro', sSeg,  srcSeg,  seguradora)}
        ${linhaDoc('crlv',      'CRLV',              sCrlv, srcCrlv)}
        ${linhaDoc('tacografo', 'Tacógrafo',         sTac,  srcTac)}
      </div>
      <div class="doc-actions">
        <button class="btn-sm btn-edit" onclick="abrirModalVeiculo('${pl}')">✏️ Vencimentos e contato</button>
      </div>
    </div>`;
  }).join('');
}

// ===================== MOTORISTAS =====================
function renderMotoristas() {
  const base = getBase();
  const motoristas = motoristasBase(base);
  const el = document.getElementById('gradeMotoristas');
  el.innerHTML = motoristas.map(m => {
    const key = 'moto_' + m;
    const cnh = docsCfg[key]?.cnh || {};
    const s = statusLabel(cnh.vencimento, 60);
    const primeiroNome = m.split(' ')[0];
    return `<div class="doc-card">
      <div class="doc-card-header">
        <div class="doc-ico">👤</div>
        <div>
          <div class="doc-titulo">${m}</div>
          <div class="doc-sub">CNH ${cnh.categoria||'—'} · ${cnh.numero||'—'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0;">
        <span class="doc-status ${s.cls}">${s.txt}</span>
        ${cnh.link ? `<a href="${cnh.link}" target="_blank" class="btn-sm btn-ver" style="padding:3px 8px;">📄 CNH</a>` : ''}
      </div>
      <div class="doc-actions">
        <button class="btn-sm btn-edit" onclick="abrirModalMotorista('${m.replace(/'/g,"\\'")}')">✏️ Editar</button>
      </div>
    </div>`;
  }).join('');
}

// ===================== UPLOAD DE DOCUMENTOS (CARD) =====================
let _docPdfs  = {};
let _uploadCtx = { placa: null, tipo: null };

function importarDocCard(placa, tipo) {
  _uploadCtx = { placa, tipo };
  const inp = document.getElementById('inputDocCard');
  inp.value = '';
  inp.click();
}

async function onDocCardChange(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) { alert('Arquivo muito grande (máx 6 MB).'); input.value=''; return; }
  const { placa, tipo } = _uploadCtx;
  const veiculo = catalogoDb.veiculos.find(v => v.placa === placa);
  if (!veiculo) return;
  const atual = docsCfg[placa]?.[tipo] || {};
  try {
    await enviarDocumento({
      tipo: tipo === 'seguro' ? 'apolice' : tipo,
      titulo: `${tipo === 'seguro' ? 'Apólice' : tipo.toUpperCase()} ${placa}`,
      vencimento: atual.vencimento || null,
      veiculoId: veiculo.id,
      seguradora: tipo === 'seguro' ? docsCfg[placa]?.seguradora || null : null,
      contatoEmergencia: tipo === 'seguro' ? docsCfg[placa]?.emergencia || null : null,
    }, file);
    await carregarDocs();
    renderTudo();
  } catch (falha) {
    alert(falha instanceof Error ? falha.message : 'Não foi possível enviar o PDF.');
  } finally { input.value = ''; }
}

function srcDocCard(placa, tipo) {
  const d   = docsCfg[placa] || {};
  if (tipo === 'seguro')    return d.seguro?.link || '';
  if (tipo === 'tacografo') return d.tacografo?.link || '';
  if (tipo === 'crlv')      return d.crlv?.link || '';
  return '';
}

function verDocCard(placa, tipo) {
  const src = srcDocCard(placa, tipo);
  if (!src) return;
  window.open(src, '_blank');
}

function baixarDocCard(placa, tipo) {
  const src = srcDocCard(placa, tipo);
  if (!src) return;
  const d = docsCfg[placa] || {};
  const nomeBase = d[tipo]?.nomeArq || `${placa}-${tipo}.pdf`;
  const a = document.createElement('a');
  a.href = src;
  a.download = nomeBase;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Funções do modal (upload dentro do modal — mantido por retrocompatibilidade)
function escolherArquivoDoc(inputId) { document.getElementById(inputId)?.click(); }
function onDocFileChange(input, tipo) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) { alert('Máx 6 MB.'); return; }
  _docPdfs[tipo] = file;
  const el = document.getElementById(tipo + 'PdfNome');
  if (el) el.textContent = '✅ ' + file.name;
}

// ===================== MODAIS =====================
let modalTipo = null;
let modalIdx  = null;
let modalPlaca = null;
let modalMotorista = null;

function abrirModalVeiculo(placa) {
  modalTipo='veiculo'; modalPlaca=placa;
  const d   = docsCfg[placa] || {};
  const seguradoraSalva = d.seguradora || '';
  document.getElementById('modalDocTitulo').textContent = `🚛 ${placa}`;
  document.getElementById('modalDocBody').innerHTML = `
    <div class="modal-sec-titulo">🏢 SEGURO</div>
    <div class="form-grid-2">
      <div class="form-group full"><label>Seguradora</label>
        <select id="seguradora" class="inp">
          <option value="">— Selecione —</option>
          ${['Bradesco','MAPFRE','Porto Seguro','Allianz','Tokio Marine','Zurich','Sompo','HDI','Outra'].map(s=>`<option value="${s}" ${seguradoraSalva===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Vencimento da Apólice</label><input type="date" id="segVenc" class="inp" value="${d.seguro?.vencimento||''}"></div>
      <div class="form-group"><label>Telefone / Canal de sinistro</label><input type="text" id="segEmerg" class="inp" placeholder="Ex: 0800 726 8000 — 24h" value="${d.emergencia||''}"></div>
    </div>
    <div class="modal-upload-row">
      <span style="font-size:.78rem;font-weight:600;">Arquivo da Apólice</span>
      <div style="display:flex;gap:6px;align-items:center;">
        ${d.seguro?.link ? `<a href="${d.seguro.link}" target="_blank" class="btn-sm btn-ver" style="padding:4px 10px;">📄 Ver atual</a>` : ''}
        <button class="btn-upload-doc" onclick="escolherArquivoDoc('segPdf','Apólice')">📎 ${d.seguro?.temArquivo?'Substituir':'Enviar PDF'}</button>
        <input type="file" id="segPdf" accept=".pdf" style="display:none" onchange="onDocFileChange(this,'seg')">
        <span id="segPdfNome" style="font-size:.72rem;color:var(--green);"></span>
      </div>
    </div>

    <div class="modal-sec-titulo" style="margin-top:16px;">📡 TACÓGRAFO <span style="font-size:.7rem;font-weight:400;">(alerta 30 dias)</span></div>
    <div class="form-grid-2">
      <div class="form-group"><label>Vencimento</label><input type="date" id="tacVenc" class="inp" value="${d.tacografo?.vencimento||''}"></div>
    </div>
    <div class="modal-upload-row">
      <span style="font-size:.78rem;font-weight:600;">Certificado do Tacógrafo</span>
      <div style="display:flex;gap:6px;align-items:center;">
        ${d.tacografo?.link ? `<a href="${d.tacografo.link}" target="_blank" class="btn-sm btn-ver" style="padding:4px 10px;">📄 Ver atual</a>` : ''}
        <button class="btn-upload-doc" onclick="escolherArquivoDoc('tacPdf','Tacógrafo')">📎 ${d.tacografo?.temArquivo?'Substituir':'Enviar PDF'}</button>
        <input type="file" id="tacPdf" accept=".pdf" style="display:none" onchange="onDocFileChange(this,'tac')">
        <span id="tacPdfNome" style="font-size:.72rem;color:var(--green);"></span>
      </div>
    </div>

    <div class="modal-sec-titulo" style="margin-top:16px;">📋 CRLV <span style="font-size:.7rem;font-weight:400;">(alerta 60 dias)</span></div>
    <div class="form-grid-2">
      <div class="form-group"><label>Vencimento</label><input type="date" id="crlvVenc" class="inp" value="${d.crlv?.vencimento||''}"></div>
    </div>
    <div class="modal-upload-row">
      <span style="font-size:.78rem;font-weight:600;">Arquivo do CRLV</span>
      <div style="display:flex;gap:6px;align-items:center;">
        ${d.crlv?.link ? `<a href="${d.crlv.link}" target="_blank" class="btn-sm btn-ver" style="padding:4px 10px;">📄 Ver atual</a>` : ''}
        <button class="btn-upload-doc" onclick="escolherArquivoDoc('crlvPdf','CRLV')">📎 ${d.crlv?.temArquivo?'Substituir':'Enviar PDF'}</button>
        <input type="file" id="crlvPdf" accept=".pdf" style="display:none" onchange="onDocFileChange(this,'crlv')">
        <span id="crlvPdfNome" style="font-size:.72rem;color:var(--green);"></span>
      </div>
    </div>`;
  document.getElementById('modalDoc').classList.add('aberto');
}

function abrirModalMotorista(nome) {
  modalTipo='motorista'; modalMotorista=nome;
  const key = 'moto_' + nome;
  const d = docsCfg[key]?.cnh || {};
  document.getElementById('modalDocTitulo').textContent = `👤 CNH — ${nome.split(' ')[0]}`;
  document.getElementById('modalDocBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div class="form-group"><label>Nº da CNH</label><input type="text" id="cnhNum" value="${d.numero||''}"></div>
      <div class="form-group"><label>Categoria</label><select id="cnhCat"><option value="">—</option>${['A','AB','AC','AD','AE','B','C','D','E'].map(c=>`<option value="${c}" ${d.categoria===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Vencimento</label><input type="date" id="cnhVenc" value="${d.vencimento||''}"></div>
      <div class="form-group"><label>Link Google Drive</label><input type="url" id="cnhLink" placeholder="https://..." value="${d.link||''}"></div>
    </div>`;
  document.getElementById('modalDoc').classList.add('aberto');
}

async function salvarDoc() {
  try {
    if (modalTipo === 'manual' || modalTipo === 'plano') {
      const origem = modalTipo === 'manual' ? MANUAIS_RAPOSA[modalIdx] : PLANOS[modalIdx];
      const tipo = modalTipo === 'manual' ? 'manual' : 'plano_pgq';
      const atual = documentosDb.find(doc => doc.tipo === tipo && doc.titulo === origem.titulo);
      if (atual) await atualizarDocumento(atual.id, {
        tipo, titulo: atual.titulo, descricao: atual.descricao,
        linkExterno: document.getElementById('docLink').value.trim() || atual.linkExterno,
        baseId: atual.baseId,
      });
    }
    if (modalTipo === 'veiculo') await salvarDocumentosVeiculo();
    if (modalTipo === 'motorista') await salvarCnh();
    _docPdfs = {};
    await carregarDocs();
    fecharModalDoc();
    renderTudo();
  } catch (falha) {
    alert(falha instanceof Error ? falha.message : 'Não foi possível salvar os documentos.');
  }
}

async function salvarDocumentosVeiculo() {
  const veiculo = catalogoDb.veiculos.find(v => v.placa === modalPlaca);
  if (!veiculo) throw new Error('Veículo não encontrado.');
  const prev = docsCfg[modalPlaca] || {};
  const seguradora = document.getElementById('seguradora').value || null;
  const emergencia = document.getElementById('segEmerg').value.trim() || null;
  const itens = [
    { tela: 'seguro', api: 'apolice', titulo: `Apólice ${modalPlaca}`, vencimento: document.getElementById('segVenc').value, arquivo: _docPdfs.seg, seguradora, contatoEmergencia: emergencia },
    { tela: 'tacografo', api: 'tacografo', titulo: `Tacógrafo ${modalPlaca}`, vencimento: document.getElementById('tacVenc').value, arquivo: _docPdfs.tac },
    { tela: 'crlv', api: 'crlv', titulo: `CRLV ${modalPlaca}`, vencimento: document.getElementById('crlvVenc').value, arquivo: _docPdfs.crlv },
  ];
  for (const item of itens) {
    const atual = prev[item.tela];
    const dados = {
      tipo: item.api, titulo: item.titulo, vencimento: item.vencimento || null,
      linkExterno: atual?.linkExterno || null, veiculoId: veiculo.id,
      seguradora: item.seguradora || null, contatoEmergencia: item.contatoEmergencia || null,
    };
    if (item.arquivo) await enviarDocumento(dados, item.arquivo);
    else if (atual?.id) await atualizarDocumento(atual.id, dados);
    // O documento que ainda nao existe e nao veio com PDF caia neste buraco: a pessoa
    // digitava a data de vencimento da apolice, salvava, e nada era gravado. O `salvarCnh`
    // ja fazia certo; aqui faltava o terceiro caso. So cria quando ha o que gravar, para
    // um "Salvar" com o modal em branco nao deixar documento vazio para tras.
    else if (dados.vencimento || dados.seguradora || dados.contatoEmergencia) await salvarDadosDocumento(dados);
  }
}

async function salvarCnh() {
  const pessoa = catalogoDb.colaboradores.find(p => p.nome === modalMotorista);
  if (!pessoa) throw new Error('Motorista não encontrado.');
  const atual = docsCfg['moto_' + modalMotorista]?.cnh;
  const dados = {
    tipo: 'cnh', titulo: `CNH ${modalMotorista}`,
    vencimento: document.getElementById('cnhVenc').value || null,
    linkExterno: document.getElementById('cnhLink').value.trim() || atual?.linkExterno || null,
    colaboradorId: pessoa.id,
    cnhNumero: document.getElementById('cnhNum').value.trim() || null,
    cnhCategoria: document.getElementById('cnhCat').value || null,
  };
  if (atual?.id) await atualizarDocumento(atual.id, dados);
  else await salvarDadosDocumento(dados);
}

function fecharModalDoc() {
  document.getElementById('modalDoc').classList.remove('aberto');
  modalTipo=modalIdx=modalPlaca=modalMotorista=null;
}

// ===================== RENDER TUDO =====================
function renderTudo() {
  renderResumo();
  renderManuais();
  renderPlanos();
  renderVeiculos();
  renderMotoristas();
}

// Atalho: input de estilo
document.querySelectorAll('.form-group input, .form-group select').forEach(el => {
  el.classList.add('inp');
});

Object.assign(window, {
  renderTudo,
  importarDocCard,
  onDocCardChange,
  verDocCard,
  baixarDocCard,
  escolherArquivoDoc,
  onDocFileChange,
  abrirModalVeiculo,
  abrirModalMotorista,
  salvarDoc,
  fecharModalDoc,
});
