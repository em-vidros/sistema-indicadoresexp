import {
  apagarAta as apagarAtaNaApi,
  caminhoPdfAta,
  enviarPdfAta,
  listarAtas,
  obterCatalogoAtas,
  salvarAta as salvarAtaNaApi,
  type AtaSalva,
  type ColaboradorAta,
  type EntradaAta,
} from './atas-api.ts'

let topicoCount = 0
let catalogo: ColaboradorAta[] = []
let historico: AtaSalva[] = []
let ataAtualId: string | null = null
let anexarParaId: string | null = null
let importRowId: string | null = null
let rowCounter = 0
const importPdfs = new Map<string, File>()

const mesesImport = [
  { mes: 'Janeiro', data: '2026-01-31' },
  { mes: 'Fevereiro', data: '2026-02-28' },
  { mes: 'Março', data: '2026-03-31' },
  { mes: 'Abril', data: '2026-04-30' },
  { mes: 'Maio', data: '2026-05-31' },
  { mes: 'Junho', data: '2026-06-30' },
  { mes: 'Julho', data: '2026-07-31' },
  { mes: 'Agosto', data: '2026-08-31' },
]

const elemento = <T extends HTMLElement>(id: string): T => {
  const encontrado = document.getElementById(id)
  if (!encontrado) throw new Error(`elemento '${id}' nao existe`)
  return encontrado as T
}

const valor = (id: string) => elemento<HTMLInputElement>(id).value
const nulo = (texto: string) => texto.trim() || null

document.addEventListener('DOMContentLoaded', async () => {
  const agora = new Date()
  elemento<HTMLInputElement>('f_data').value = agora.toISOString().split('T')[0] ?? ''
  elemento<HTMLInputElement>('f_horario').value = agora.toTimeString().slice(0, 5)
  adicionarTopico()
  adicionarTopico()
  adicionarTopico()

  try {
    ;[catalogo, historico] = await Promise.all([obterCatalogoAtas(), listarAtas()])
    renderCheckboxes('checkMotoristas', 'motorista')
    renderCheckboxes('checkAjudantes', 'ajudante')
    renderCheckboxes('checkAtendimento', 'atendimento')
    renderCheckboxes('checkLogistica', 'logistica')
    atualizarBadge()
  } catch (falha) {
    alert(mensagemFalha(falha, 'Não foi possível carregar as atas.'))
  }
})

function adicionarTopico(discussao = '', conclusao = '', responsavel = '', prazo = '') {
  const numero = ++topicoCount
  const div = document.createElement('div')
  div.className = 'topico no-print'
  div.id = `topico_${numero}`
  div.innerHTML = `<div class="topico-header">
    <div class="topico-num">${numero}</div><div class="topico-titulo">Tópico ${numero}</div>
    <button class="btn-remover" onclick="removerTopico(${numero})" title="Remover tópico">✕</button>
    </div><div class="form-grid">
    <div class="form-group full"><label>Discussão</label><input type="text" id="t${numero}_disc" placeholder="Assunto discutido..." value="${esc(discussao)}"></div>
    <div class="form-group full"><label>Conclusões / Encaminhamentos</label><textarea id="t${numero}_concl" rows="3" placeholder="Deliberações e encaminhamentos...">${htmlEsc(conclusao)}</textarea></div>
    <div class="form-group"><label>Responsável</label><input type="text" id="t${numero}_resp" placeholder="Nome ou função" value="${esc(responsavel)}"></div>
    <div class="form-group"><label>Prazo</label><input type="text" id="t${numero}_prazo" placeholder="Ex: Imediato / 30/09/2026" value="${esc(prazo)}"></div>
    </div>`
  elemento('topicosContainer').appendChild(div)
}

function removerTopico(numero: number) {
  document.getElementById(`topico_${numero}`)?.remove()
}

function renderCheckboxes(containerId: string, funcao: string) {
  const recipiente = elemento(containerId)
  recipiente.innerHTML = ''
  for (const pessoa of catalogo.filter((item) => item.funcao === funcao)) {
    const label = document.createElement('label')
    label.className = 'colab-chk'
    label.innerHTML = `<input type="checkbox" data-colaborador-id="${pessoa.id}" onchange="atualizarMarcado(this)"> ${htmlEsc(pessoa.nome)}`
    recipiente.appendChild(label)
  }
}

function atualizarMarcado(check: HTMLInputElement) {
  check.closest('.colab-chk')?.classList.toggle('marcado', check.checked)
}

function marcarTodos(estado: boolean) {
  document.querySelectorAll<HTMLInputElement>('.colab-chk input[type=checkbox]').forEach((check) => {
    check.checked = estado
    check.closest('.colab-chk')?.classList.toggle('marcado', estado)
  })
}

function adicionarParticipanteExtra() {
  const linha = document.createElement('div')
  linha.className = 'part-row'
  linha.innerHTML = '<input type="text" placeholder="Nome completo (externo / convidado)"><button class="btn-remover" onclick="this.parentElement.remove()" title="Remover">✕</button>'
  elemento('listaPart').appendChild(linha)
}

function preencherImpressao() {
  const numero = valor('f_num').trim()
  elemento('p_num_ata').textContent = numero ? `Ata nº ${numero}` : ''
  elemento('p_titulo').textContent = valor('f_titulo')
  elemento('p_data').textContent = formatarData(valor('f_data'))
  elemento('p_horario').textContent = valor('f_horario')
  elemento('p_local').textContent = valor('f_local')
  elemento('p_convocada').textContent = valor('f_convocada')
  elemento('p_facilitadores').textContent = valor('f_facilitadores')
  elemento('p_participantes_geral').textContent = valor('f_participantes_geral')
  elemento('p_g1_nome').textContent = valor('g1_nome')
  elemento('p_g1_cargo').textContent = valor('g1_cargo')
  elemento('p_g2_nome').textContent = valor('g2_nome')
  elemento('p_g2_cargo').textContent = valor('g2_cargo')

  const topicos = elemento('printTopicos')
  topicos.innerHTML = ''
  coletarTopicos().forEach((topico, indice) => {
    const div = document.createElement('div')
    div.className = 'print-topico'
    div.innerHTML = `<div class="top-num">Tópico ${indice + 1}</div><div class="top-row">
      <div class="top-col"><div class="f-label">Discussão</div><div class="f-value">${htmlEsc(topico.discussao ?? '')}</div></div>
      <div class="top-col"><div class="f-label">Conclusões / Encaminhamentos</div><div class="f-value">${htmlEsc(topico.conclusao ?? '').replace(/\n/g, '<br>')}</div></div>
      </div><div class="top-resp"><div><div class="f-label">Responsável:</div><div class="f-value"><b>${htmlEsc(topico.responsavel ?? '') || '—'}</b></div></div>
      <div style="margin-left:24pt;"><div class="f-label">Prazo:</div><div class="f-value"><b>${htmlEsc(topico.prazo ?? '') || '—'}</b></div></div></div>`
    topicos.appendChild(div)
  })

  const participantes = elemento('printPart')
  participantes.innerHTML = ''
  nomesParticipantes().forEach((nome) => {
    const item = document.createElement('div')
    item.className = 'print-part-item'
    item.innerHTML = `<div class="print-part-name">${htmlEsc(nome)}</div><div class="print-part-assinatura">Assinatura</div>`
    participantes.appendChild(item)
  })
}

async function gerarPDF() {
  preencherImpressao()
  await salvarAta()
  window.print()
}

function coletarTopicos(): EntradaAta['topicos'] {
  return Array.from(document.querySelectorAll<HTMLElement>('[id^="topico_"]')).flatMap((topico) => {
    const numero = topico.id.replace('topico_', '')
    const discussao = valor(`t${numero}_disc`).trim()
    const conclusao = elemento<HTMLTextAreaElement>(`t${numero}_concl`).value.trim()
    if (!discussao && !conclusao) return []
    return [{
      discussao: discussao || null,
      conclusao: conclusao || null,
      responsavel: nulo(valor(`t${numero}_resp`)),
      prazo: nulo(valor(`t${numero}_prazo`)),
    }]
  })
}

function participantesSelecionados(): EntradaAta['participantes'] {
  const cadastrados = Array.from(
    document.querySelectorAll<HTMLInputElement>('.colab-chk input[type=checkbox]:checked'),
    (check) => ({ colaboradorId: check.dataset['colaboradorId'] ?? null, nomeExterno: null, presente: true }),
  )
  const externos = Array.from(document.querySelectorAll<HTMLInputElement>('#listaPart .part-row input')).flatMap(
    (input) => input.value.trim() ? [{ colaboradorId: null, nomeExterno: input.value.trim(), presente: true }] : [],
  )
  return [...cadastrados, ...externos]
}

function nomesParticipantes(): string[] {
  const nomes = Array.from(
    document.querySelectorAll<HTMLInputElement>('.colab-chk input[type=checkbox]:checked'),
    (check) => check.closest('.colab-chk')?.textContent?.trim() ?? '',
  )
  nomes.push(...Array.from(document.querySelectorAll<HTMLInputElement>('#listaPart .part-row input'), (input) => input.value.trim()))
  return nomes.filter(Boolean)
}

function coletarDados(importada = false): EntradaAta {
  return {
    numero: nulo(valor('f_num')),
    titulo: valor('f_titulo').trim(),
    data: valor('f_data'),
    horario: nulo(valor('f_horario')),
    local: nulo(valor('f_local')),
    convocada: nulo(valor('f_convocada')),
    facilitadores: nulo(valor('f_facilitadores')),
    participantesGeral: nulo(valor('f_participantes_geral')),
    gestor1Nome: nulo(valor('g1_nome')),
    gestor1Cargo: nulo(valor('g1_cargo')),
    gestor2Nome: nulo(valor('g2_nome')),
    gestor2Cargo: nulo(valor('g2_cargo')),
    importada,
    topicos: coletarTopicos(),
    participantes: participantesSelecionados(),
  }
}

async function salvarAta(): Promise<boolean> {
  const dados = coletarDados()
  // Sem título ou sem data a API recusa a ata, então nem chega a pedir. Em silêncio,
  // porque imprimir é imprimir: a tela nunca cobrou campo de quem só queria o PDF.
  if (!dados.titulo || !dados.data) return false
  try {
    const salva = await salvarAtaNaApi(ataAtualId, dados)
    ataAtualId = salva.id
    const indice = historico.findIndex((item) => item.id === salva.id)
    if (indice === -1) historico.unshift(salva)
    else historico[indice] = salva
    elemento('btnAnexar').style.display = ''
    atualizarBadge()
    return true
  } catch (falha) {
    alert(mensagemFalha(falha, 'Não foi possível salvar a ata.'))
    return false
  }
}

function atualizarBadge() {
  elemento('badgeHist').textContent = String(historico.length)
}

function renderHistorico() {
  const recipiente = elemento('listaHistorico')
  if (historico.length === 0) {
    recipiente.innerHTML = '<div class="hist-empty">📋 Nenhuma ata registrada ainda.<br><small>Gere o PDF de uma ata para ela aparecer aqui.</small></div>'
    return
  }
  recipiente.innerHTML = ''
  for (const ata of historico) {
    const [ano = '', mes = '', dia = '--'] = ata.data.split('-')
    const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const badge = ata.temPdf
      ? '<span class="badge-pdf badge-ok">✅ PDF anexado</span>'
      : '<span class="badge-pdf badge-pendente">📎 PDF pendente</span>'
    const card = document.createElement('div')
    card.className = 'hist-card'
    card.innerHTML = `<div class="hist-date"><div class="hd-dia">${dia}</div><div class="hd-mes">${meses[Number(mes)] || '—'} ${ano.slice(2)}</div></div>
      <div class="hist-info"><div class="hist-num">${ata.numero ? `Ata nº ${htmlEsc(ata.numero)} · ` : ''}${ata.horario ?? ''}</div>
      <div class="hist-titulo">${htmlEsc(ata.titulo || 'Sem título')}</div>
      <div class="hist-meta">${ata.local ? `${htmlEsc(ata.local)} · ` : ''}${ata.participantes.length} participante(s) · ${ata.topicos.length} tópico(s)</div>
      <div style="margin-top:8px;">${badge}</div><div class="hist-acoes">
      ${ata.temPdf ? `<button class="btn-hist primary" onclick="downloadPDF('${ata.id}')">⬇️ Baixar PDF</button>` : ''}
      <button class="btn-hist" onclick="anexarParaAta('${ata.id}')">📎 ${ata.temPdf ? 'Substituir PDF' : 'Anexar PDF'}</button>
      <button class="btn-hist danger" onclick="deletarAta('${ata.id}')">🗑 Excluir</button></div></div>`
    recipiente.appendChild(card)
  }
}

function switchTab(tab: string) {
  const abaAta = tab === 'ata'
  elemento('panelAta').classList.toggle('ativa', abaAta)
  elemento('panelHist').classList.toggle('ativa', !abaAta)
  elemento('tabBtnAta').classList.toggle('ativa', abaAta)
  elemento('tabBtnHist').classList.toggle('ativa', !abaAta)
  if (!abaAta) renderHistorico()
}

async function anexarPDF(input: HTMLInputElement) {
  const arquivo = input.files?.[0]
  if (!arquivo) return
  const id = anexarParaId ?? ataAtualId
  if (!id) return
  if (arquivo.size > 4 * 1024 * 1024) {
    alert('PDF muito grande (máx 4 MB). Reduza o tamanho antes de anexar.')
    input.value = ''
    return
  }
  try {
    await enviarPdfAta(id, arquivo)
    const ata = historico.find((item) => item.id === id)
    if (ata) ata.temPdf = true
    renderHistorico()
    alert('PDF anexado com sucesso!')
  } catch (falha) {
    alert(mensagemFalha(falha, 'Não foi possível anexar o PDF.'))
  } finally {
    anexarParaId = null
    input.value = ''
  }
}

function anexarParaAta(id: string) {
  anexarParaId = id
  elemento<HTMLInputElement>('inputPDF').click()
}

function downloadPDF(id: string) {
  const ata = historico.find((item) => item.id === id)
  const nome = [ata?.numero ? `ata-${ata.numero.replace('/', '')}` : 'ata', ata?.data, ata?.titulo]
    .filter(Boolean)
    .join('-')
  const link = document.createElement('a')
  link.href = caminhoPdfAta(id)
  link.download = `${nome.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`
  link.click()
}

async function deletarAta(id: string) {
  if (!confirm('Excluir esta ata do histórico?')) return
  try {
    await apagarAtaNaApi(id)
    historico = historico.filter((ata) => ata.id !== id)
    if (id === ataAtualId) {
      ataAtualId = null
      elemento('btnAnexar').style.display = 'none'
    }
    atualizarBadge()
    renderHistorico()
  } catch (falha) {
    alert(mensagemFalha(falha, 'Não foi possível excluir a ata.'))
  }
}

function abrirModalImportar() {
  importPdfs.clear()
  importRowId = null
  elemento('importRows').innerHTML = ''
  mesesImport.forEach((mes) => addImportRow(mes.data, 'Alinhamento Equipe Expedição', '', mes.mes))
  elemento('modalImportar').classList.remove('hidden')
}

function fecharModalImportar() {
  elemento('modalImportar').classList.add('hidden')
}

function addImportRow(data = '', titulo = '', numero = '', mesLabel = '') {
  const id = `imp_${++rowCounter}`
  const linha = document.createElement('div')
  linha.className = 'import-row'
  linha.id = id
  linha.innerHTML = `<input type="date" id="${id}_data" value="${esc(data)}"><input type="text" id="${id}_titulo" placeholder="Título da reunião" value="${esc(titulo)}">
    <input type="text" id="${id}_num" placeholder="001/2026" value="${esc(numero)}"><button class="btn-import-pdf" id="${id}_pdfbtn" onclick="escolherPDFImport('${id}')" title="Anexar PDF assinado">📎</button>`
  const recipiente = elemento('importRows')
  recipiente.appendChild(linha)
  if (mesLabel) {
    const rotulo = document.createElement('div')
    rotulo.style.cssText = 'font-size:.68rem;color:var(--txt-dim);margin:2px 0 4px;grid-column:1/-1;'
    rotulo.textContent = `${mesLabel} 2026`
    recipiente.insertBefore(rotulo, linha)
  }
}

function escolherPDFImport(id: string) {
  importRowId = id
  const input = elemento<HTMLInputElement>('inputPDFImport')
  input.value = ''
  input.click()
}

function onPDFImportSelecionado(input: HTMLInputElement) {
  const arquivo = input.files?.[0]
  if (!arquivo || !importRowId) return
  if (arquivo.size > 4 * 1024 * 1024) {
    alert('PDF muito grande (máx 4 MB).')
    return
  }
  importPdfs.set(importRowId, arquivo)
  const botao = document.getElementById(`${importRowId}_pdfbtn`)
  if (botao) {
    botao.textContent = '✅'
    botao.classList.add('ok')
    botao.title = arquivo.name
  }
  importRowId = null
}

async function salvarImportadas() {
  const linhas = Array.from(document.querySelectorAll<HTMLElement>('#importRows .import-row'))
  let adicionadas = 0
  let recusadas = 0
  for (const linha of linhas) {
    const data = valor(`${linha.id}_data`)
    const titulo = valor(`${linha.id}_titulo`).trim()
    if (!data && !titulo) continue
    try {
      const nova = await salvarAtaNaApi(null, {
        numero: nulo(valor(`${linha.id}_num`)), titulo: titulo || 'Ata de Reunião', data,
        horario: null, local: 'Raposa - MA', convocada: 'Lívia Lima, Raimundo Pontes',
        facilitadores: null, participantesGeral: null, gestor1Nome: null, gestor1Cargo: null,
        gestor2Nome: null, gestor2Cargo: null, importada: true, topicos: [], participantes: [],
      })
      const pdf = importPdfs.get(linha.id)
      if (pdf) {
        await enviarPdfAta(nova.id, pdf)
        nova.temPdf = true
      }
      historico.push(nova)
      adicionadas++
    } catch {
      // Linha recusada nao derruba o lote. O importador antigo gravava tudo de uma
      // vez e nunca parava no meio; parar deixaria as anteriores salvas em silencio.
      recusadas++
    }
  }
  historico.sort((a, b) => b.data.localeCompare(a.data))
  fecharModalImportar()
  atualizarBadge()
  renderHistorico()
  const sobra = recusadas ? `\n${recusadas} ata(s) não foram importadas. Confira a data.` : ''
  alert(`${adicionadas} ata(s) importada(s) com sucesso!${sobra}`)
}

function esc(texto: string) {
  return htmlEsc(texto).replace(/"/g, '&quot;')
}

function htmlEsc(texto: string) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatarData(data: string) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function mensagemFalha(falha: unknown, padrao: string) {
  return falha instanceof Error ? falha.message : padrao
}

Object.assign(window, {
  adicionarTopico,
  removerTopico,
  atualizarMarcado,
  marcarTodos,
  adicionarParticipanteExtra,
  gerarPDF,
  switchTab,
  anexarPDF,
  anexarParaAta,
  downloadPDF,
  deletarAta,
  abrirModalImportar,
  fecharModalImportar,
  addImportRow,
  escolherPDFImport,
  onPDFImportSelecionado,
  salvarImportadas,
})
