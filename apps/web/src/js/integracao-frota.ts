import {
  listarIntegracoes,
  obterCatalogoIntegracoes,
  salvarIntegracao,
  type CatalogoIntegracao,
  type EntradaIntegracao,
  type FuncaoIntegracao,
  type IntegracaoSalva,
} from './integracoes-api.ts'

type Progresso = Record<string, { feito: boolean; data: string | null }>

let catalogo: CatalogoIntegracao = { colaboradores: [], programas: [] }
let historico: IntegracaoSalva[] = []
let funcaoAtual: FuncaoIntegracao = 'motorista'
let progresso: Progresso = {}
let registroAtualId: string | null = null

const elemento = <T extends HTMLElement>(id: string): T => {
  const encontrado = document.getElementById(id)
  if (!encontrado) throw new Error(`elemento '${id}' nao existe`)
  return encontrado as T
}

const valor = (id: string): string => elemento<HTMLInputElement>(id).value
const programaAtual = () => catalogo.programas.find((programa) => programa.funcao === funcaoAtual)

document.addEventListener('DOMContentLoaded', async () => {
  const hoje = new Date().toISOString().split('T')[0] ?? ''
  elemento<HTMLInputElement>('f_admissao').value = hoje
  elemento<HTMLInputElement>('f_inicio').value = hoje

  try {
    ;[catalogo, historico] = await Promise.all([obterCatalogoIntegracoes(), listarIntegracoes()])
    popularSelectColaborador(funcaoAtual)
    renderFuncao(funcaoAtual)
    renderHistorico()
  } catch (falha) {
    elemento('listaHistorico').textContent = 'Não foi possível carregar as integrações.'
    alert(falha instanceof Error ? falha.message : 'Não foi possível carregar as integrações.')
  }
})

function popularSelectColaborador(funcao: FuncaoIntegracao) {
  const select = elemento<HTMLSelectElement>('f_select_colab')
  select.innerHTML = '<option value="">— Selecione ou preencha manualmente —</option>'
  for (const colaborador of catalogo.colaboradores.filter((pessoa) => pessoa.funcao === funcao)) {
    const opcao = document.createElement('option')
    opcao.value = colaborador.id
    opcao.textContent = `${colaborador.nome} — ${colaborador.cargo ?? ''}`
    select.appendChild(opcao)
  }
}

function selecionarColaborador(id: string) {
  if (!id) return
  const colaborador = catalogo.colaboradores.find((pessoa) => pessoa.id === id)
  if (!colaborador) return
  elemento<HTMLInputElement>('f_nome').value = colaborador.nome
  elemento<HTMLInputElement>('f_cargo').value = colaborador.cargo ?? ''
  elemento<HTMLInputElement>('f_admissao').value = colaborador.admissao ?? ''
}

function selecionarFuncao(funcao: FuncaoIntegracao) {
  funcaoAtual = funcao
  registroAtualId = null
  progresso = {}
  elemento('btnMotorista').classList.toggle('ativo', funcao === 'motorista')
  elemento('btnAjudante').classList.toggle('ativo', funcao === 'ajudante')
  popularSelectColaborador(funcao)
  elemento<HTMLInputElement>('f_select_colab').value = ''
  elemento<HTMLInputElement>('f_nome').value = ''
  elemento<HTMLInputElement>('f_cargo').value = ''
  renderFuncao(funcao)
}

function renderFuncao(funcao: FuncaoIntegracao) {
  const programa = catalogo.programas.find((item) => item.funcao === funcao)
  if (!programa) return
  renderSemanas(programa)
  renderMatriz(programa)
}

function renderSemanas(programa: CatalogoIntegracao['programas'][number]) {
  const recipiente = elemento('semanasContainer')
  recipiente.innerHTML = ''
  programa.semanas.forEach((semana, indiceSemana) => {
    const feitas = semana.atividades.filter((atividade) => progresso[atividade.codigo]?.feito).length
    const bloco = document.createElement('div')
    bloco.className = 'semana no-print'
    bloco.innerHTML = `
      <div class="semana-header">
        <div class="semana-num">${semana.numero}</div>
        <div class="semana-titulo">${semana.titulo}</div>
        <div class="semana-prog">${feitas}/${semana.atividades.length}</div>
      </div>
      <div class="semana-body" id="sem_body_${indiceSemana}">
        ${semana.atividades
          .map(
            (atividade) => `
          <div class="atividade ${progresso[atividade.codigo]?.feito ? 'feita' : ''}" id="atv_${atividade.codigo}">
            <input type="checkbox" id="chk_${atividade.codigo}" ${progresso[atividade.codigo]?.feito ? 'checked' : ''} onchange="toggleAtividade('${atividade.codigo}', ${indiceSemana})">
            <div class="atividade-texto">
              <span class="atividade-titulo">${atividade.titulo}</span>
              ${atividade.descricao}
            </div>
            <div class="atividade-data">
              <input type="date" id="dt_${atividade.codigo}" value="${progresso[atividade.codigo]?.data ?? ''}" placeholder="Data">
            </div>
          </div>`,
          )
          .join('')}
      </div>`
    recipiente.appendChild(bloco)
  })
}

function toggleAtividade(codigo: string, indiceSemana: number) {
  const marcado = elemento<HTMLInputElement>(`chk_${codigo}`)
  const data = elemento<HTMLInputElement>(`dt_${codigo}`)
  const linha = elemento(`atv_${codigo}`)
  if (marcado.checked && !data.value) data.value = new Date().toISOString().split('T')[0] ?? ''
  linha.classList.toggle('feita', marcado.checked)
  progresso[codigo] = { feito: marcado.checked, data: data.value || null }

  const semana = programaAtual()?.semanas[indiceSemana]
  if (!semana) return
  const feitas = semana.atividades.filter((atividade) => progresso[atividade.codigo]?.feito).length
  const corpo = elemento(`sem_body_${indiceSemana}`)
  corpo.previousElementSibling?.querySelector('.semana-prog')?.replaceChildren(`${feitas}/${semana.atividades.length}`)
}

function renderMatriz(programa: CatalogoIntegracao['programas'][number]) {
  elemento('tabelaMatriz').innerHTML = `<thead><tr><th>Critério</th><th>Padrão Esperado</th><th>Frequência</th></tr></thead>
    <tbody>${programa.criterios
      .map(
        (item) =>
          `<tr><td><b>${item.criterio}</b></td><td>${item.padrao}</td><td><span class="badge-freq">${item.frequencia}</span></td></tr>`,
      )
      .join('')}</tbody>`
}

function coletarProgresso() {
  for (const atividade of programaAtual()?.semanas.flatMap((semana) => semana.atividades) ?? []) {
    const marcado = document.getElementById(`chk_${atividade.codigo}`) as HTMLInputElement | null
    const data = document.getElementById(`dt_${atividade.codigo}`) as HTMLInputElement | null
    if (marcado) progresso[atividade.codigo] = { feito: marcado.checked, data: data?.value || null }
  }
}

async function salvarProgresso() {
  coletarProgresso()
  const programa = programaAtual()
  if (!programa) return

  const corpo: EntradaIntegracao = {
    colaboradorId: valor('f_select_colab') || null,
    nome: valor('f_nome').trim(),
    cargo: valor('f_cargo') || null,
    admissao: valor('f_admissao') || null,
    programaId: programa.id,
    inicio: valor('f_inicio') || null,
    coord: valor('f_coord') || null,
    gerente: valor('f_gerente') || null,
    rh: valor('f_rh') || null,
    atividades: programa.semanas.flatMap((semana) =>
      semana.atividades.map((atividade) => ({
        atividadeId: atividade.id,
        feito: progresso[atividade.codigo]?.feito ?? false,
        data: progresso[atividade.codigo]?.data ?? null,
      })),
    ),
  }

  try {
    const salva = await salvarIntegracao(registroAtualId, corpo)
    registroAtualId = salva.id
    const indice = historico.findIndex((item) => item.id === salva.id)
    if (indice === -1) historico.unshift(salva)
    else historico[indice] = salva
    renderHistorico()
    alert('Progresso salvo com sucesso!')
  } catch (falha) {
    alert(falha instanceof Error ? falha.message : 'Não foi possível salvar o progresso.')
  }
}

function renderHistorico() {
  const recipiente = elemento('listaHistorico')
  if (historico.length === 0) {
    recipiente.innerHTML = '<div style="color:var(--txt-muted);font-size:.85rem;">Nenhuma integração salva ainda.</div>'
    return
  }
  recipiente.innerHTML = historico
    // Mais recente primeiro, como no original. Sem isto a ordem vira a que a API
    // devolver, e a ficha que a pessoa acabou de salvar some do topo da lista.
    .slice()
    .sort((a, b) => b.salvoEm.localeCompare(a.salvoEm))
    .map((registro) => {
      const feitas = registro.atividades.filter((atividade) => atividade.feito).length
      const total = registro.atividades.length
      const percentual = total === 0 ? 0 : Math.round((feitas / total) * 100)
      return `<div class="hist-item">
        <div class="hist-ico">${registro.funcao === 'motorista' ? '🚛' : '📦'}</div>
        <div class="hist-info">
          <div class="hist-nome">${e(registro.nome)}</div>
          <div class="hist-sub">${registro.funcao === 'motorista' ? 'Motorista' : 'Ajudante'} · Início: ${fmtData(registro.inicio)} · Coord: ${e(registro.coord || '—')}</div>
        </div>
        <div class="hist-prog ${percentual === 100 ? 'completo' : 'parcial'}">${percentual}% (${feitas}/${total})</div>
        <button class="btn-carregar" onclick="carregarRegistro('${registro.id}')">Carregar</button>
      </div>`
    })
    .join('')
}

function carregarRegistro(id: string) {
  const registro = historico.find((item) => item.id === id)
  if (!registro) return
  registroAtualId = registro.id
  funcaoAtual = registro.funcao
  progresso = Object.fromEntries(
    registro.atividades.map((atividade) => [atividade.codigo, { feito: atividade.feito, data: atividade.data }]),
  )
  elemento('btnMotorista').classList.toggle('ativo', registro.funcao === 'motorista')
  elemento('btnAjudante').classList.toggle('ativo', registro.funcao === 'ajudante')
  popularSelectColaborador(registro.funcao)
  elemento<HTMLInputElement>('f_select_colab').value = registro.colaboradorId ?? ''
  elemento<HTMLInputElement>('f_nome').value = registro.nome
  elemento<HTMLInputElement>('f_cargo').value = registro.cargo ?? ''
  elemento<HTMLInputElement>('f_admissao').value = registro.admissao ?? ''
  elemento<HTMLInputElement>('f_inicio').value = registro.inicio ?? ''
  elemento<HTMLInputElement>('f_coord').value = registro.coord ?? ''
  elemento<HTMLInputElement>('f_gerente').value = registro.gerente ?? ''
  elemento<HTMLInputElement>('f_rh').value = registro.rh ?? ''
  renderFuncao(registro.funcao)
}

function gerarPDF() {
  coletarProgresso()
  const programa = programaAtual()
  if (!programa) return
  const nome = valor('f_nome') || '___________________________'
  const cargo = valor('f_cargo') || programa.titulo
  const coord = valor('f_coord')
  const gerente = valor('f_gerente')
  const rh = valor('f_rh') || '___________________________'

  let html = `<div class="ph"><div class="empresa">EM Vidros Indústria e Comércio de Vidros Ltda</div><div class="doc-tipo">Programa de Integração e Período de Experiência — 45 Dias</div><div class="doc-sub">${e(programa.titulo)}</div></div>
    <div class="pd"><div class="pd-row"><div class="pd-field"><div class="lbl">Colaborador</div><div class="val">${e(nome)}</div></div><div class="pd-field"><div class="lbl">Cargo</div><div class="val">${e(cargo)}</div></div></div>
    <div class="pd-row"><div class="pd-field"><div class="lbl">Data de Admissão</div><div class="val">${fmtData(valor('f_admissao'))}</div></div><div class="pd-field"><div class="lbl">Início da Integração</div><div class="val">${fmtData(valor('f_inicio'))}</div></div></div>
    <div class="pd-row"><div class="pd-field"><div class="lbl">Coordenador Responsável</div><div class="val">${e(coord)}</div></div><div class="pd-field"><div class="lbl">Gerente de Logística</div><div class="val">${e(gerente)}</div></div><div class="pd-field"><div class="lbl">Responsável RH</div><div class="val">${e(rh)}</div></div></div></div>`

  programa.semanas.forEach((semana) => {
    html += `<div class="ps"><div class="ps-header"><span>Semana ${semana.numero} — ${e(semana.titulo.split('—')[1]?.trim() || semana.titulo)}</span></div>`
    for (const atividade of semana.atividades) {
      const estado = progresso[atividade.codigo]
      html += `<div class="ps-item"><div class="ps-check">${estado?.feito ? '✓' : ''}</div><div class="ps-texto"><span class="ps-titulo">${e(atividade.titulo)}</span>${e(atividade.descricao)}</div><div class="ps-data">${estado?.feito ? fmtData(estado.data) : ''}</div></div>`
    }
    html += '</div>'
  })

  html += `<div class="pm"><div class="pm-titulo">Matriz de Avaliação Contínua</div><table class="pm-table"><thead><tr><th>Critério</th><th>Padrão Esperado</th><th>Frequência</th></tr></thead><tbody>${programa.criterios.map((item) => `<tr><td><b>${e(item.criterio)}</b></td><td>${e(item.padrao)}</td><td>${e(item.frequencia)}</td></tr>`).join('')}</tbody></table></div>
    <div class="passin"><div class="passin-titulo">Termo de Ciente e Assinaturas</div><div style="font-size:9pt;margin-bottom:16pt;line-height:1.5;">Declaro que recebi o plano de integração para o período de experiência de 45 dias e estou ciente das atividades, treinamentos e responsabilidades descritas.<br><br>Data: ______ / ______ / __________</div><div class="passin-grid">
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(nome)}</div><div class="passin-cargo">Colaborador (${funcaoAtual === 'motorista' ? 'Motorista' : 'Ajudante'})</div></div></div>
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(coord)}</div><div class="passin-cargo">Coordenação Logística</div></div></div>
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(gerente)}</div><div class="passin-cargo">Gerência Logística</div></div></div>
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(rh)}</div><div class="passin-cargo">Recursos Humanos (RH)</div></div></div></div></div>`

  elemento('printDoc').innerHTML = html
  window.print()
}

function fmtData(data: string | null) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function e(texto: string) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

Object.assign(window, {
  selecionarColaborador,
  selecionarFuncao,
  toggleAtividade,
  salvarProgresso,
  carregarRegistro,
  gerarPDF,
})
