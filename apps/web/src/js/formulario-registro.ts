import { apagarRegistrosDoDia, listarRegistros, salvarRegistros } from './registros-api.ts';


// ===================== ESTADO =====================
let tipoAtual = 'viagem';
let baseAtual = 'Raposa';
let tipoManutencaoAtual = 'preventiva';
let sessaoAtual = null; // o que /api/sessao devolve: usuario, nome, admin, baseFixa, bases, tipos

// ===================== SESSÃO =====================
function fazerLogout() {
  if (!confirm('Sair do sistema?')) return;
  // O cookie e httpOnly: quem apaga e o servidor. O `finally` existe porque a tela
  // tem que sair mesmo se a chamada falhar, senao o usuario fica preso no lugar.
  fetch('/api/sair', { method: 'POST' }).finally(() => { location.href = '/entrar.html'; });
}

async function aplicarSessao(sessao) {
  sessaoAtual = sessao;
  // Atualizar chip de usuário na sidebar
  document.getElementById('userAvatar').textContent = sessao.nome.charAt(0).toUpperCase();
  document.getElementById('userNome').textContent = sessao.nome;
  document.getElementById('userBaseLabel').textContent = sessao.baseFixa;
  // Definir e travar base
  baseAtual = sessao.baseFixa;
  const isAdmin = !!sessao.admin;
  // Sem `||` de reserva: lista vazia aqui e permissao de verdade, e um padrao
  // generoso transformaria erro de consulta em acesso a base que nao e sua.
  const basesPermitidas = sessao.bases;
  const tiposPermitidos = sessao.tipos;
  const selector = document.getElementById('baseSelector');
  selector.classList.remove('base-locked');
  // Mostrar/ocultar botões de base conforme permissão
  document.getElementById('btnRaposa').style.display     = basesPermitidas.includes('Raposa')     ? '' : 'none';
  document.getElementById('btnImperatriz').style.display = basesPermitidas.includes('Imperatriz') ? '' : 'none';
  document.getElementById('btnBelem').style.display      = basesPermitidas.includes('Belém')      ? '' : 'none';
  // Mostrar/ocultar botões de tipo conforme permissão
  const tipoMap = { viagem:0, abastecimento:1, manutencao:2, quebra:3 };
  document.querySelectorAll('.tipo-btn').forEach((btn, i) => {
    const tipo = Object.keys(tipoMap)[i];
    btn.style.display = tiposPermitidos.includes(tipo) ? '' : 'none';
  });
  if (!isAdmin) {
    selector.classList.add('base-locked');
    document.getElementById('formArea').style.display = 'block';
    document.getElementById('btnRaposa').classList.toggle('ativo', sessao.baseFixa==='Raposa');
    document.getElementById('btnImperatriz').classList.toggle('ativo', sessao.baseFixa==='Imperatriz');
    document.getElementById('btnBelem').classList.toggle('ativo', sessao.baseFixa==='Belém');
  } else {
    // Admin: nenhuma base pré-selecionada — usuário escolhe antes de preencher
    document.getElementById('labelBase').innerHTML = 'Base <span style="font-size:.68rem;color:var(--accent);font-weight:600;">● Admin</span>';
    baseAtual = null;
    document.getElementById('formArea').style.display = 'none';
    document.getElementById('adminAviso').style.display = 'block';
    document.getElementById('chipBase').textContent = '—';
    document.getElementById('menuAdmin').style.display = 'block';
  }
  if (baseAtual) {
    await recarregarDaApi();
    document.getElementById('chipBase').textContent = baseAtual;
    setDataHoje();
    atualizarDataAtual();
    popularAutocompletistas();
    renderizarHistorico();
    verificarN8n();
    atualizarContador();
  } else {
    verificarN8n();
  }
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  // Quem nao tem cookie valido nao recebe este HTML: o servidor manda para o login
  // antes. O 401 aqui e a sessao que expirou entre a pagina carregar e esta chamada.
  fetch('/api/sessao')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    // O tratamento de erro e o segundo argumento do `then`, e nao um `.catch`
    // encadeado, porque encadeado ele pegaria tambem o que `aplicarSessao` lancar.
    // Ai a tela iria para o login, o portao veria sessao valida e a devolveria, e o
    // laco correria sem mensagem nenhuma.
    .then(aplicarSessao, () => {
      location.href = '/entrar.html?destino=' + encodeURIComponent(location.pathname + location.search);
    })
    .catch(erro => { console.error('falhou ao montar a tela', erro); });
});

function setDataHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  ['v_data_saida','v_data_chegada','a_data','m_data_entrada','q_data'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = hoje;
  });
}

function atualizarDataAtual() {
  const agora = new Date();
  const opts = {weekday:'long',year:'numeric',month:'long',day:'numeric'};
  document.getElementById('diaAtual').textContent = agora.toLocaleDateString('pt-BR', opts);
  document.getElementById('labelHoje').textContent = agora.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
}

// ===================== TIPO / BASE =====================
function selecionarTipo(tipo, btn) {
  tipoAtual = tipo;
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  ['formViagem','formAbastecimento','formManutencao','formQuebra'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  const mapa = {viagem:'formViagem',abastecimento:'formAbastecimento',manutencao:'formManutencao',quebra:'formQuebra'};
  document.getElementById(mapa[tipo]).style.display = 'block';
  esconderFeedback();
}

function calcularCustoViagem() {
  const comb = parseFloat(document.getElementById('v_combustivel').value) || 0;
  const diar = parseFloat(document.getElementById('v_diarias').value) || 0;
  document.getElementById('v_custo_viagem').value = (comb + diar).toFixed(2);
}

async function selecionarBase(base, btn) {
  baseAtual = base;
  document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  document.getElementById('chipBase').textContent = base;
  // Admin: revelar formulário ao escolher base
  if (sessaoAtual && sessaoAtual.admin) {
    document.getElementById('adminAviso').style.display = 'none';
    document.getElementById('formArea').style.display = 'block';
    popularAutocompletistas();
    setDataHoje();
  }
  await recarregarDaApi();
  renderizarHistorico();
  atualizarContador();
}

// ===================== COLETA DE DADOS =====================
function coletarDados() {
  const base = baseAtual;
  const agora = new Date().toISOString();

  if (tipoAtual === 'viagem') {
    const ds = document.getElementById('v_data_saida').value;
    const mot = document.getElementById('v_motorista').value.trim();
    const vei = document.getElementById('v_veiculo').value.trim().toUpperCase();
    const rot = document.getElementById('v_rota').value.trim();
    const vc   = parseFloat(document.getElementById('v_valor_carga').value) || 0;
    const comb = parseFloat(document.getElementById('v_combustivel').value) || 0;
    const diar = parseFloat(document.getElementById('v_diarias').value) || 0;
    const cv   = comb + diar;
    if (!ds || !mot || !vei || !rot || !vc || !cv) return {erro:'Preencha os campos obrigatórios: Data Saída, Motorista, Veículo, Rota, Valor da Carga, Combustível e Diárias.'};
    const kms = parseInt(document.getElementById('v_km_saida').value) || 0;
    const kmc = parseInt(document.getElementById('v_km_chegada').value) || 0;
    return {
      tipo:'viagem', base, registrado_em: agora,
      data_saida: ds,
      hora_saida: document.getElementById('v_hora_saida').value,
      data_chegada: document.getElementById('v_data_chegada').value,
      hora_prevista: document.getElementById('v_hora_prevista').value,
      hora_chegada: document.getElementById('v_hora_chegada').value,
      pontualidade: document.getElementById('v_pontualidade').value,
      motorista: mot, veiculo: vei, rota: rot,
      km_saida: kms, km_chegada: kmc,
      km_rodados: kmc > kms ? kmc - kms : 0,
      valor_carga: vc, combustivel: comb, diarias: diar, custo_viagem: cv,
      m2: parseFloat(document.getElementById('v_m2').value) || 0,
      peso_kg: parseFloat(document.getElementById('v_peso').value) || 0,
      observacao: document.getElementById('v_obs').value.trim(),
      pct_custo: vc > 0 ? Math.round(cv/vc*10000)/100 : 0
    };
  }
  if (tipoAtual === 'abastecimento') {
    const dt = document.getElementById('a_data').value;
    const pl = document.getElementById('a_placa').value.trim().toUpperCase();
    const rota = document.getElementById('a_rota').value;
    const viagemLonga = document.getElementById('a_viagem_longa').checked;
    if (!dt || !pl) return {erro:'Preencha: Data e Placa.'};

    if (!viagemLonga) {
      // Abastecimento simples
      const lt = parseFloat(document.getElementById('a_litros_1').value) || 0;
      const vl = parseFloat(document.getElementById('a_vl_litro_1').value) || 0;
      if (!lt || !vl) return {erro:'Preencha: Litros e Valor/Litro.'};
      return [{
        tipo:'abastecimento', base, registrado_em: agora,
        data: dt, placa: pl, rota: rota || null,
        litros: lt, vl_litro: vl,
        valor_total: Math.round(lt*vl*100)/100,
        km: parseInt(document.getElementById('a_km_1').value) || null,
        posto: document.getElementById('a_posto_1').value.trim(),
        slot: null, viagem_longa: false
      }];
    }

    // Múltiplos abastecimentos
    const slots = [];
    const labels = ['Saída','Interior','Chegada'];
    let kmInicial = null, kmFinal = null;
    for (let i = 1; i <= 3; i++) {
      const lt = parseFloat(document.getElementById('a_litros_' + i)?.value) || 0;
      const vl = parseFloat(document.getElementById('a_vl_litro_' + i)?.value) || 0;
      if (lt === 0) continue;
      const km = parseInt(document.getElementById('a_km_' + i)?.value) || null;
      if (km) { if (kmInicial === null) kmInicial = km; kmFinal = km; }
      slots.push({
        tipo:'abastecimento', base, registrado_em: agora,
        data: dt, placa: pl, rota: rota || null,
        litros: lt, vl_litro: vl,
        valor_total: Math.round(lt*vl*100)/100,
        km: km,
        posto: document.getElementById('a_posto_' + i)?.value.trim() || '',
        slot: labels[i-1], viagem_longa: true
      });
    }
    if (slots.length === 0) return {erro:'Preencha pelo menos um abastecimento.'};
    const totalLt = slots.reduce((s,r)=>s+r.litros,0);
    const totalR = slots.reduce((s,r)=>s+r.valor_total,0);
    const kmRodados = (kmInicial&&kmFinal&&kmFinal>kmInicial) ? kmFinal-kmInicial : null;
    const media = (totalLt>0&&kmRodados) ? Math.round(kmRodados/totalLt*100)/100 : null;
    slots.forEach(s => { s.total_litros_viagem=totalLt; s.total_valor_viagem=Math.round(totalR*100)/100; s.km_rodados_viagem=kmRodados; s.media_kmL=media; });
    return slots;
  }
  if (tipoAtual === 'manutencao') {
    const de = document.getElementById('m_data_entrada').value;
    const pl = document.getElementById('m_placa').value.trim().toUpperCase();
    const sv = document.getElementById('m_servico').value.trim();
    const vl = parseFloat(document.getElementById('m_valor').value) || 0;
    if (!de || !pl || !sv || !vl) return {erro:'Preencha: Data de Entrada, Placa, Serviço e Valor.'};
    const ds = document.getElementById('m_data_saida').value;
    let diasOficina = null;
    if (de && ds) {
      diasOficina = Math.round((new Date(ds) - new Date(de)) / 86400000);
    }
    const temOrcamento  = !!document.getElementById('m_doc_orcamento')?.files?.length;
    const temOS         = !!document.getElementById('m_doc_os')?.files?.length;
    return [{
      tipo:'manutencao', base, registrado_em: agora,
      tipo_manutencao: tipoManutencaoAtual,
      data: de,
      data_programada: document.getElementById('m_data_programada').value || null,
      data_entrada: de,
      hora_entrada: document.getElementById('m_hora_entrada').value,
      data_saida: ds,
      hora_saida: document.getElementById('m_hora_saida').value,
      dias_oficina: diasOficina,
      placa: pl, servico: sv, valor: vl,
      km_odometro: parseInt(document.getElementById('m_km').value) || null,
      fornecedor: document.getElementById('m_fornecedor').value.trim(),
      status_documental: (temOrcamento && temOS) ? 'concluido' : 'pendente',
      link_orcamento: null,
      link_os: null
    }];
  }
  if (tipoAtual === 'quebra') {
    const dt = document.getElementById('q_data').value;
    const me = parseFloat(document.getElementById('q_m2_expedido').value) || 0;
    const mq = parseFloat(document.getElementById('q_m2_quebrado').value) || 0;
    if (!dt || !me) return {erro:'Preencha: Data e m² Expedido.'};
    return {
      tipo:'quebra', base, registrado_em: agora,
      data: dt, m2_expedido: me, m2_quebrado: mq,
      pct_quebra: me > 0 ? Math.round(mq/me*10000)/100 : 0,
      observacao: document.getElementById('q_obs').value.trim()
    };
  }
}

// ===================== REGISTRAR =====================
async function registrar() {
  const resultado = coletarDados();
  if (!resultado) return;
  if (resultado.erro) { mostrarFeedback(resultado.erro, 'erro'); return; }

  // coletarDados sempre retorna array
  const lista = Array.isArray(resultado) ? resultado : [resultado];

  const btn = document.querySelector('.btn-registrar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    await salvarRegistros(lista);
  } catch(e) {
    // A tela sempre avisou quando estava sem conexão. Só que antes o registro ficava
    // salvo no aparelho e o aviso era verde; agora não fica, então o aviso é vermelho
    // e o formulário continua preenchido, para a pessoa tentar de novo sem redigitar.
    // Falha de rede não tem resposta e vira TypeError; com resposta, o texto é da API.
    const msg = e instanceof TypeError
      ? '⚠️ Sem conexão. O registro não foi salvo, tente de novo.'
      : `⚠️ ${e instanceof Error ? e.message : 'Não foi possível salvar.'}`;
    mostrarFeedback(msg, 'erro');
    btn.disabled = false;
    btn.textContent = '✅ Registrar';
    return;
  }

  // A releitura da lista fica fora do `try` da gravacao de proposito. As duas juntas
  // faziam a tela dizer "nao foi salvo" depois de ter salvado, quando so a segunda
  // falhava: a pessoa clicava de novo e a mesma quebra entrava duas vezes no numero
  // que alimenta o dashboard.
  await recarregarDaApi();

  limparFormulario();
  renderizarHistorico();
  atualizarContador();
  popularAutocompletistas();

  const n = lista.length;
  const msg = _erroLeitura
    ? '✅ Registrado no sistema. Não consegui atualizar a lista abaixo; recarregue a página para vê-la.'
    : `✅ ${n > 1 ? n + ' abastecimentos registrados' : 'Registrado'} no sistema!`;
  mostrarFeedback(msg, 'ok');

  btn.disabled = false;
  btn.textContent = '✅ Registrar';
  setTimeout(() => esconderFeedback(), 5000);
}

// ===================== DADOS DA TELA =====================
let _dadosMemoria = [];
// Leitura que falhou nao e dia sem registro. Sem esta marca a tela mostra "Nenhum
// registro hoje para Raposa." para uma base cheia, e a pessoa lanca tudo de novo.
let _erroLeitura = null;

/**
 * A leitura da lista, no unico lugar. Ela e chamada de tres lugares que antes tinham
 * `await listarRegistros(...)` solto: um deles sem `try`, dentro de um `onclick`, onde
 * a falha virava rejeicao nao tratada e a tela parava de montar no meio, sem uma
 * palavra na tela.
 */
async function recarregarDaApi() {
  try {
    _dadosMemoria = await listarRegistros(baseAtual);
    _erroLeitura = null;
  } catch(e) {
    _dadosMemoria = [];
    _erroLeitura = e instanceof Error ? e.message : 'falha ao ler os registros';
  }
}

function carregarDados() {
  return _dadosMemoria;
}

function dadosDeHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  return carregarDados().filter(d => {
    const data = d.data_saida || d.data || d.registrado_em?.split('T')[0];
    return data === hoje && d.base === baseAtual;
  });
}

// ===================== HISTÓRICO =====================
function renderizarHistorico() {
  const lista = document.getElementById('historicoLista');
  // Sem `.reverse()`. Ele existia porque o armazenamento do navegador guardava na ordem
  // de digitacao e o mais novo ficava por ultimo; a consulta ja devolve decrescente,
  // entao inverter de novo punha o mais velho no topo.
  const dados = dadosDeHoje();
  if (dados.length === 0) {
    lista.innerHTML = '<div class="hist-vazio">' + (_erroLeitura
      ? '⚠️ Não consegui carregar os registros: ' + esc(_erroLeitura) + '. Recarregue a página.'
      : 'Nenhum registro hoje para ' + baseAtual + '.') + '</div>';
    return;
  }
  const icos = {viagem:'🚛',abastecimento:'⛽',manutencao:'🔧',quebra:'📦'};
  lista.innerHTML = dados.map(d => {
    const hora = new Date(d.registrado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    let titulo = '', detalhe = '';
    if (d.tipo==='viagem') { titulo=`${d.rota} · ${d.motorista}`; const detCusto = d.combustivel!=null ? `⛽R$${d.combustivel?.toLocaleString('pt-BR',{minimumFractionDigits:0})} + 🏨R$${d.diarias?.toLocaleString('pt-BR',{minimumFractionDigits:0})}` : `R$${d.custo_viagem?.toLocaleString('pt-BR',{minimumFractionDigits:0})}`; detalhe=`${d.veiculo} · R$${d.valor_carga?.toLocaleString('pt-BR',{minimumFractionDigits:0})} carga · ${detCusto} · ${d.pct_custo}%`; }
    else if (d.tipo==='abastecimento') { titulo=`${d.placa} · ${d.litros}L`; detalhe=`R$${d.vl_litro?.toFixed(3)}/L · Total R$${d.valor_total?.toFixed(2)}`; }
    else if (d.tipo==='manutencao') { titulo=`${d.placa} · ${d.servico}`; detalhe=`R$${d.valor?.toLocaleString('pt-BR',{minimumFractionDigits:2})} · ${d.fornecedor||'—'}${d.dias_oficina!==null&&d.dias_oficina!==undefined?' · '+d.dias_oficina+'d oficina':''}`; }
    else if (d.tipo==='quebra') { titulo=`${d.m2_expedido} m² expedido · ${d.m2_quebrado} m² quebrado`; detalhe=`${d.pct_quebra}% quebra`; }
    return `<div class="hist-item">
      <div class="hist-tipo ${d.tipo}">${icos[d.tipo]||'📝'}</div>
      <div class="hist-info"><div class="hist-titulo">${titulo}</div><div class="hist-detalhe">${detalhe}</div></div>
      <div class="hist-hora">${hora}</div>
    </div>`;
  }).join('');
}

function atualizarContador() {
  const total = carregarDados().filter(d => d.base === baseAtual);
  const hoje = dadosDeHoje().length;
  document.getElementById('contadorHoje').textContent = `${hoje} registro${hoje!==1?'s':''} hoje · ${total.length} total`;
}

// ===================== FROTAS PRÉ-CADASTRADAS =====================
const VEICULOS_RAPOSA = ['PTV0006','PTT0004','ROW3A87','SMW0B96','SM02J13','SMP6F86','SMQ2I80'];
const VEICULOS_IMPERATRIZ = ['DMG9D41','NXD4H26','NXB2H55','ROW4J37','SMR2H61','SND9C34','SMM4A02'];
const VEICULOS_BELEM = ['SMP2F01'];

// ===================== MOTORISTAS PRÉ-CADASTRADOS =====================
const MOTORISTAS_RAPOSA = [
  'Anderson Penha Dos Anjos',
  'Gabriel Reis Costa',
  'Leandro do Nascimento Brito',
  'Raimundo Correia Ferreira',
  'Raimundo Nonato da Silva Divino',
  'Saturnino Assumpção Dias Filho',
  'Silio Vinicius Cruz Castro',
  'Victor Gonçalves Vasconcelos',
];
const MOTORISTAS_IMPERATRIZ = [
  'Nataniel Pereira Rocha',
  'Francisco Pereira dos Santos',
  'Evandro de Oliveira Cardim',
  'Francisco de Sousa Cabral',
  'Adriel da Silva Santos',
  'Sebastiao de Brito Matos',
  'Italo Melo Sales',
  'Railton da Silva Batista',
];
const MOTORISTAS_BELEM = ['Severino Manoel Barata do Nascimento'];

// ===================== ROTAS PRÉ-CADASTRADAS =====================
const ROTAS_RAPOSA = [
  'PINHEIRO',
  'SANTA INÊS / BACABAL - EXTRA PINHEIRO',
  'CAXIAS / TERESINA',
  'SANTA INÊS / BACABAL - EXTRA CAXIAS',
  'ITAPECURU',
  'PARNAÍBA / TERESINA',
  'PARNAÍBA',
  'SÃO LUÍS',
  'LOJA GUAJAJARAS',
  'LOJA ANGELIM',
];
const ROTAS_IMPERATRIZ = [
  'PARAUAPEBAS',
  'BURITICUPU',
  'BALSAS',
  'BELÉM',
  'LOJA BELÉM',
  'FLORIANO',
  'IMPERATRIZ',
  'SALINÓPOLIS',
  'LOJA SANTA INÊS',
];
const ROTAS_BELEM = ['BARCARENA', 'BELÉM', 'SALINÓPOLIS'];

// Rotas locais/curtas: não exibem toggle de viagem longa
const ROTAS_LOCAIS = ['IMPERATRIZ', 'SÃO LUÍS', 'LOJA GUAJAJARAS', 'LOJA ANGELIM', 'LOJA BELÉM', 'LOJA SANTA INÊS', 'BARCARENA'];

// ===================== AUTOCOMPLETE =====================
function popularAutocompletistas() {
  const dados = carregarDados();
  const base = sessaoAtual ? sessaoAtual.baseFixa : baseAtual;
  const isAdmin = sessaoAtual && sessaoAtual.admin;
  const motoresPre  = isAdmin ? [...MOTORISTAS_RAPOSA,...MOTORISTAS_IMPERATRIZ,...MOTORISTAS_BELEM]
                              : base==='Raposa' ? MOTORISTAS_RAPOSA : base==='Imperatriz' ? MOTORISTAS_IMPERATRIZ : MOTORISTAS_BELEM;
  const veiculosPre = isAdmin ? [...VEICULOS_RAPOSA,...VEICULOS_IMPERATRIZ,...VEICULOS_BELEM]
                              : base==='Raposa' ? VEICULOS_RAPOSA   : base==='Imperatriz' ? VEICULOS_IMPERATRIZ   : VEICULOS_BELEM;
  const rotasPre    = isAdmin ? [...ROTAS_RAPOSA,...ROTAS_IMPERATRIZ,...ROTAS_BELEM]
                              : base==='Raposa' ? ROTAS_RAPOSA : base==='Imperatriz' ? ROTAS_IMPERATRIZ : ROTAS_BELEM;
  const motoresHistorico  = dados.filter(d=>d.motorista).map(d=>d.motorista);
  const veiculosHistorico = dados.filter(d=>d.veiculo||d.placa).map(d=>d.veiculo||d.placa);
  const rotasHistorico    = dados.filter(d=>d.rota).map(d=>d.rota);
  const motoristas = [...new Set([...motoresPre, ...motoresHistorico])].sort();
  const veiculos   = [...new Set([...veiculosPre, ...veiculosHistorico])].sort();
  const rotas      = [...new Set([...rotasPre, ...rotasHistorico])].sort();

  ['lista-motoristas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = motoristas.map(m=>`<option value="${m}">`).join('');
  });
  ['lista-veiculos','lista-veiculos2','lista-veiculos3'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = veiculos.map(v=>`<option value="${v}">`).join('');
  });
  const lr = document.getElementById('lista-rotas');
  if(lr) lr.innerHTML = rotas.map(r=>`<option value="${r}">`).join('');
  // Select de rota no abastecimento
  const ar = document.getElementById('a_rota');
  if (ar) {
    const rotasAb = isAdmin ? [...ROTAS_RAPOSA,...ROTAS_IMPERATRIZ,...ROTAS_BELEM] : rotasPre;
    ar.innerHTML = '<option value="">-- Sem rota --</option>' + [...new Set(rotasAb)].sort().map(r=>`<option value="${r}">${r}</option>`).join('');
  }
}

// ===================== LIMPAR FORMULÁRIO =====================
function limparFormulario() {
  document.querySelectorAll('input[type=text],input[type=number],textarea').forEach(el => el.value='');
  document.querySelectorAll('select').forEach(el => el.value='');
  document.querySelectorAll('input[type=time]').forEach(el => el.value='');
  // Resetar tipo de manutenção
  tipoManutencaoAtual = 'preventiva';
  const btnP = document.getElementById('btnPreventiva');
  const btnC = document.getElementById('btnCorretiva');
  if (btnP) { btnP.style.borderColor='var(--green)'; btnP.style.background='var(--green-soft)'; btnP.style.color='var(--green)'; }
  if (btnC) { btnC.style.borderColor='var(--border)'; btnC.style.background='var(--bg-card)'; btnC.style.color='var(--txt-dim)'; }
  // Resetar slots de abastecimento
  document.getElementById('a_viagem_longa').checked = false;
  document.getElementById('a_slot_1_titulo').style.display = 'none';
  document.getElementById('a_slot_2').style.display = 'none';
  document.getElementById('a_slot_3').style.display = 'none';
  document.getElementById('a_btn_adicionar_container').style.display = 'none';
  document.getElementById('a_totais').style.display = 'none';
  slotsAtivos = 1;
  setDataHoje();
}

// ===================== FEEDBACK =====================
function mostrarFeedback(msg, tipo) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = 'feedback ' + tipo;
}
function esconderFeedback() {
  const el = document.getElementById('feedback');
  el.className = 'feedback';
  el.textContent = '';
}

// ===================== EXPORTAR =====================
function exportarDados() {
  const dados = carregarDados();
  if(dados.length===0){alert('Nenhum dado para exportar.');return;}
  const blob = new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emvidros-indicadores-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function limparHoje() {
  if(!confirm('Apagar registros de hoje de ' + baseAtual + '?')) return;
  const hoje = new Date().toISOString().split('T')[0];
  // Antes isto so tirava da lista em memoria. A tela ficava limpa, a pessoa acreditava
  // ter apagado, e o proximo F5 trazia tudo de volta. Quem apaga agora e o banco, por
  // soft-delete, e a lista e relida de la.
  try {
    await apagarRegistrosDoDia(baseAtual, hoje);
    await recarregarDaApi();
  } catch(e) {
    mostrarFeedback(`⚠️ ${e instanceof Error ? e.message : 'Não foi possível apagar.'}`, 'erro');
    return;
  }
  renderizarHistorico();
  atualizarContador();
}

// ===================== GERENCIAR USUÁRIOS (admin) =====================
// A lista chega do servidor e fica aqui entre abrir o modal e salvar. Guardar so
// os quatro logins, e nao o objeto inteiro, deixaria `salvarUsuarios` sem saber
// quem e admin e reenviaria permissao de quem nao tem permissao editavel.
let usuariosAdmin = [];

// O nome vem do banco e qualquer admin o grava por `PUT /api/usuarios`. Sem passar
// por aqui ele sai como HTML no modal de quem abrir depois.
function esc(texto) {
  const mapa = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(texto).replace(/[&<>"']/g, c => mapa[c]);
}

async function abrirGerenciarUsuarios() {
  const body = document.getElementById('modalUsuariosBody');
  try {
    const r = await fetch('/api/usuarios');
    if (!r.ok) throw new Error(r.status);
    usuariosAdmin = await r.json();
  } catch {
    alert('Não consegui carregar os usuários. Tente de novo.');
    return;
  }
  const baseLabel = { Raposa:'📍 Raposa', Imperatriz:'📍 Imperatriz', 'Belém':'📍 Belém', null:'🔑 Admin' };
  const todasBases = ['Raposa','Imperatriz','Belém'];
  const todosTipos = [
    { id:'viagem',        ico:'🚛', label:'Viagem' },
    { id:'abastecimento', ico:'⛽', label:'Abast.' },
    { id:'manutencao',    ico:'🔧', label:'Manut.' },
    { id:'quebra',        ico:'📦', label:'Quebra' },
  ];
  body.innerHTML = usuariosAdmin.map(u => {
    const login = esc(u.usuario);
    const isAdmin = !!u.admin;
    const basesUser  = u.bases;
    const tiposUser  = u.tipos;
    const basesHtml = todasBases.map(b => `
      <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;font-weight:500;text-transform:none;color:var(--txt-main);cursor:pointer;">
        <input type="checkbox" id="edit_base_${login}_${b.replace(/[^a-z]/gi,'')}"
          style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent);"
          ${basesUser.includes(b)?'checked':''} ${isAdmin?'disabled':''}>
        ${b}
      </label>`).join('');
    const tiposHtml = todosTipos.map(t => `
      <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;font-weight:500;text-transform:none;color:var(--txt-main);cursor:pointer;">
        <input type="checkbox" id="edit_tipo_${login}_${t.id}"
          style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent);"
          ${tiposUser.includes(t.id)?'checked':''} ${isAdmin?'disabled':''}>
        ${t.ico} ${t.label}
      </label>`).join('');
    return `
    <div class="user-card">
      <div class="user-card-header">
        <div class="user-badge">${esc(u.nome.charAt(0).toUpperCase())}</div>
        <div class="info">
          <div class="user-login">${login}</div>
          <div class="user-base-tag">${baseLabel[u.baseFixa] || '🔑 Admin'}</div>
        </div>
      </div>
      <div class="user-fields">
        <div>
          <label>Nome exibido</label>
          <input type="text" id="edit_nome_${login}" value="${esc(u.nome)}">
        </div>
        <div>
          <label>Senha</label>
          <input type="password" id="edit_senha_${login}" value="" placeholder="Nova senha">
        </div>
      </div>
      ${isAdmin ? '' : `
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="font-size:.72rem;font-weight:700;color:var(--txt-dim);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;">Bases liberadas</div>
          <div style="display:flex;flex-direction:column;gap:5px;">${basesHtml}</div>
        </div>
        <div>
          <div style="font-size:.72rem;font-weight:700;color:var(--txt-dim);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;">Tipos liberados</div>
          <div style="display:flex;flex-direction:column;gap:5px;">${tiposHtml}</div>
        </div>
      </div>`}
    </div>`;
  }).join('');
  document.getElementById('modalUsuarios').classList.add('aberto');
}

function fecharModal() {
  document.getElementById('modalUsuarios').classList.remove('aberto');
}

async function salvarUsuarios() {
  const todasBases = ['Raposa','Imperatriz','Belém'];
  const todosTipos = ['viagem','abastecimento','manutencao','quebra'];
  const mudancas = usuariosAdmin.map(u => {
    const login = u.usuario;
    const novoNome  = document.getElementById('edit_nome_' + login)?.value.trim();
    const novaSenha = document.getElementById('edit_senha_' + login)?.value;
    const m = { usuario: login, nome: novoNome || u.nome };
    // Vazio quer dizer "nao muda". Depois da fase 0 so existe hash no banco, entao
    // o campo nunca vem preenchido e mandar vazio apagaria a senha de todo mundo.
    if (novaSenha) m.senha = novaSenha;
    if (!u.admin) {
      m.bases = todasBases.filter(b =>
        document.getElementById('edit_base_' + login + '_' + b.replace(/[^a-z]/gi,''))?.checked);
      m.tipos = todosTipos.filter(t =>
        document.getElementById('edit_tipo_' + login + '_' + t)?.checked);
    }
    return m;
  });
  try {
    const r = await fetch('/api/usuarios', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mudancas),
    });
    if (!r.ok) throw new Error(r.status);
  } catch {
    alert('Não consegui salvar. Nada foi alterado.');
    return;
  }
  fecharModal();
  // Atualizar nome do usuário atual no chip se foi editado
  if (sessaoAtual) {
    const meu = mudancas.find(m => m.usuario === sessaoAtual.usuario);
    if (meu) {
      sessaoAtual.nome = meu.nome;
      document.getElementById('userNome').textContent = meu.nome;
    }
  }
  alert('✅ Usuários atualizados com sucesso!');
}

// ===================== TIPO DE MANUTENÇÃO =====================
function selecionarTipoManutencao(tipo, btn) {
  tipoManutencaoAtual = tipo;
  document.querySelectorAll('.tipo-manut-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = 'var(--bg-card)';
    b.style.color = 'var(--txt-dim)';
  });
  if (tipo === 'preventiva') {
    btn.style.borderColor = 'var(--green)';
    btn.style.background = 'var(--green-soft)';
    btn.style.color = 'var(--green)';
  } else {
    btn.style.borderColor = 'var(--orange)';
    btn.style.background = 'var(--orange-soft)';
    btn.style.color = 'var(--orange)';
  }
}

// ===================== ABASTECIMENTO MULTI-SLOT =====================
let slotsAtivos = 1;

function onRotaAbastecimentoChange() {
  const rota = document.getElementById('a_rota').value;
  const isLocal = ROTAS_LOCAIS.includes(rota);
  const toggleRow = document.getElementById('a_viagem_longa').parentElement;
  if (isLocal) {
    // Rota local: oculta toggle e reseta para single
    toggleRow.style.display = 'none';
    document.getElementById('a_viagem_longa').checked = false;
    onToggleViagemLonga();
  } else {
    toggleRow.style.display = 'flex';
  }
}

function onToggleViagemLonga() {
  const checked = document.getElementById('a_viagem_longa').checked;
  document.getElementById('a_slot_1_titulo').style.display = checked ? 'block' : 'none';
  document.getElementById('a_slot_2').style.display = 'none';
  document.getElementById('a_slot_3').style.display = 'none';
  document.getElementById('a_btn_adicionar_container').style.display = checked ? 'block' : 'none';
  document.getElementById('a_totais').style.display = checked ? 'block' : 'none';
  slotsAtivos = 1;
  calcularTotaisAbastecimento();
}

function adicionarSlotAbastecimento() {
  if (slotsAtivos >= 3) return;
  slotsAtivos++;
  document.getElementById('a_slot_' + slotsAtivos).style.display = 'block';
  if (slotsAtivos >= 3) {
    document.getElementById('a_btn_adicionar_container').style.display = 'none';
  }
}

function calcularTotaisAbastecimento() {
  if (!document.getElementById('a_viagem_longa').checked) return;
  let totalLt = 0, totalVal = 0, kmInicial = null, kmFinal = null;
  for (let i = 1; i <= 3; i++) {
    const lt = parseFloat(document.getElementById('a_litros_' + i)?.value) || 0;
    const vl = parseFloat(document.getElementById('a_vl_litro_' + i)?.value) || 0;
    const km = parseInt(document.getElementById('a_km_' + i)?.value) || 0;
    if (lt > 0) { totalLt += lt; if (vl > 0) totalVal += lt * vl; }
    if (km > 0) { if (kmInicial === null) kmInicial = km; kmFinal = km; }
  }
  const kmRod = (kmInicial && kmFinal && kmFinal > kmInicial) ? kmFinal - kmInicial : null;
  const media = (totalLt > 0 && kmRod) ? (kmRod / totalLt).toFixed(2) : '—';
  document.getElementById('a_total_litros').textContent = totalLt > 0 ? totalLt.toFixed(2) + ' L' : '—';
  document.getElementById('a_total_valor').textContent = totalVal > 0 ? 'R$ ' + totalVal.toFixed(2) : '—';
  document.getElementById('a_media_km').textContent = media !== '—' ? media + ' km/L' : '—';
  document.getElementById('a_km_rodados').textContent = kmRod ? kmRod + ' km' : '—';
}

async function verificarN8n() {
  try {
    const r = await fetch('/saude', {signal: AbortSignal.timeout(3000)});
    return r.ok;
  } catch { return false; }
}

Object.assign(window, {
  abrirGerenciarUsuarios,
  adicionarSlotAbastecimento,
  calcularCustoViagem,
  calcularTotaisAbastecimento,
  exportarDados,
  fazerLogout,
  fecharModal,
  limparHoje,
  onRotaAbastecimentoChange,
  onToggleViagemLonga,
  registrar,
  salvarUsuarios,
  selecionarBase,
  selecionarTipo,
  selecionarTipoManutencao,
});
