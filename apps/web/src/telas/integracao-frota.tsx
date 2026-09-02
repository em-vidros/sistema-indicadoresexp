/**
 * A ficha de integracao de 45 dias. As regras do porte estao em `entrar.tsx`; aqui
 * ficam as tres coisas que esta tela tem e as duas anteriores nao tinham.
 *
 * O atributo `checked` separa clique de reconstrucao, e a baseline cobra os dois. Um
 * clique em `#chk_m1a` mexe so na propriedade e o atributo continua ausente; o
 * `carregarRegistro`, que antes reescrevia a subarvore inteira com `innerHTML`, deixa
 * `checked=""` escrito no markup. Por isso o checkbox e nao controlado com
 * `defaultChecked`, e a subarvore das semanas remonta por `key` nos mesmos tres pontos
 * em que o modulo velho chamava `renderFuncao`: carga inicial, `selecionarFuncao` e
 * `carregarRegistro`. `salvarProgresso` nao remontava nada e continua sem remontar.
 *
 * As escritas por ref vem depois de um `flushSync`, e a ordem importa. O
 * `carregarRegistro` de antes repopulava o `<select>` de colaboradores e so entao fazia
 * `select.value = colaboradorId`. Sem o `flushSync` o valor cairia no `<select>` do
 * programa anterior, onde aquele id nao existe, e o navegador o descartaria.
 *
 * O documento de impressao continua sendo string. `window.print()` precisa do DOM
 * pronto na mesma volta, e reescrever as 14 KB em JSX mudaria os nos de texto de uma
 * subarvore que a baseline cobra inteira, porque `.print-doc` e `display:none` e o
 * serializador percorre `display:none` como percorre o resto.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX, ReactNode, RefObject } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { listarIntegracoes, obterCatalogoIntegracoes, salvarIntegracao } from '../js/integracoes-api.ts'
import type {
  CatalogoIntegracao,
  EntradaIntegracao,
  FuncaoIntegracao,
  IntegracaoSalva,
} from '../js/integracoes-api.ts'
import './integracao-frota.css'

type Progresso = Record<string, { feito: boolean; data: string | null }>

type Programa = CatalogoIntegracao['programas'][number]

const CATALOGO_VAZIO: CatalogoIntegracao = { colaboradores: [], programas: [] }

/** O `elemento()` do modulo velho, com ref no lugar do id. */
function campo<T extends HTMLElement>(ref: RefObject<T | null>): T {
  if (ref.current === null) throw new Error('o campo do formulario nao esta na tela')
  return ref.current
}

function hojeISO(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

/** Os campos das atividades nascem dentro do `map`, entao id continua sendo o caminho ate eles. */
function inputPorId(id: string): HTMLInputElement | null {
  const achado = document.getElementById(id)
  return achado instanceof HTMLInputElement ? achado : null
}

function fmtData(data: string | null) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function e(texto: string) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ===================== SEMANAS =====================

/**
 * Uma montagem deste componente e uma chamada de `renderSemanas`.
 *
 * `renderSemanas` lia o `progresso` global uma vez e congelava o que leu no markup. A
 * copia abaixo reproduz esse instante. O `progresso` do pai e mutado no lugar, entao
 * guardar a referencia faria `defaultChecked` acompanhar o clique e o React escreveria
 * o atributo `checked` que a baseline de `atividade-marcada` nao tem.
 */
function Semanas({
  programa,
  progressoInicial,
  aoMarcar,
}: {
  programa: Programa
  progressoInicial: Progresso
  aoMarcar: (codigo: string, feito: boolean, data: string | null) => void
}): JSX.Element {
  const montagem = useRef<Progresso>({ ...progressoInicial }).current
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(
    () => new Set(Object.keys(montagem).filter((codigo) => montagem[codigo]?.feito === true)),
  )

  function alternar(codigo: string, marcado: boolean): void {
    const data = inputPorId(`dt_${codigo}`)
    if (data === null) return
    if (marcado && !data.value) data.value = hojeISO()
    aoMarcar(codigo, marcado, data.value || null)
    setMarcados((antes) => {
      const proximo = new Set(antes)
      if (marcado) proximo.add(codigo)
      else proximo.delete(codigo)
      return proximo
    })
  }

  return (
    <>
      {programa.semanas.map((semana, indiceSemana) => (
        <div className="semana no-print" key={semana.numero}>
          <div className="semana-header">
            <div className="semana-num">{semana.numero}</div>
            <div className="semana-titulo">{semana.titulo}</div>
            <div className="semana-prog">
              {`${semana.atividades.filter((atividade) => marcados.has(atividade.codigo)).length}/${semana.atividades.length}`}
            </div>
          </div>
          <div className="semana-body" id={`sem_body_${indiceSemana}`}>
            {semana.atividades.map((atividade) => (
              <div
                className={marcados.has(atividade.codigo) ? 'atividade feita' : 'atividade'}
                id={`atv_${atividade.codigo}`}
                key={atividade.codigo}
              >
                <input
                  type="checkbox"
                  id={`chk_${atividade.codigo}`}
                  defaultChecked={montagem[atividade.codigo]?.feito === true}
                  onChange={(evento) => alternar(atividade.codigo, evento.currentTarget.checked)}
                />
                <div className="atividade-texto">
                  <span className="atividade-titulo">{atividade.titulo}</span>
                  {` ${atividade.descricao} `}
                </div>
                {/*
                  Os dois `{' '}` sao os unicos da tela. `.atividade-data` e um bloco
                  comum e o `<input>` fica `inline-block`, entao o espaco em volta dele
                  desenha. Em todo o resto o pai e flex, o navegador blocifica os filhos
                  e o mesmo espaco nao desenha nada.
                */}
                <div className="atividade-data">
                  {' '}
                  <input
                    type="date"
                    id={`dt_${atividade.codigo}`}
                    defaultValue={montagem[atividade.codigo]?.data ?? ''}
                    placeholder="Data"
                  />
                  {' '}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

// ===================== TELA =====================

function IntegracaoFrota(): JSX.Element {
  const [catalogo, setCatalogo] = useState<CatalogoIntegracao>(CATALOGO_VAZIO)
  // `null` enquanto a carga nao volta. O modulo velho so chamava `renderHistorico`
  // depois do `await`, entao "Nenhuma integração salva ainda." nunca piscava antes.
  const [historico, setHistorico] = useState<IntegracaoSalva[] | null>(null)
  const [falhaCarga, setFalhaCarga] = useState<string | null>(null)
  const [funcao, setFuncao] = useState<FuncaoIntegracao>('motorista')
  /**
   * O contador nao e enfeite, ele e a distincao "a subarvore foi reconstruida" virando
   * dado. `funcao + registroAtualId` como `key` nao serve, porque `salvarProgresso`
   * muda o id de `null` para um valor e remontaria as semanas, escrevendo o atributo
   * `checked` que `progresso-salvo` nao tem.
   */
  const [geracao, setGeracao] = useState(0)

  const progresso = useRef<Progresso>({})
  const registroAtualId = useRef<string | null>(null)

  const selectColab = useRef<HTMLSelectElement>(null)
  const fNome = useRef<HTMLInputElement>(null)
  const fCargo = useRef<HTMLInputElement>(null)
  const fAdmissao = useRef<HTMLInputElement>(null)
  const fInicio = useRef<HTMLInputElement>(null)
  const fCoord = useRef<HTMLInputElement>(null)
  const fGerente = useRef<HTMLInputElement>(null)
  const fRh = useRef<HTMLInputElement>(null)
  const printDoc = useRef<HTMLDivElement>(null)

  const programa = catalogo.programas.find((item) => item.funcao === funcao)
  const colaboradores = catalogo.colaboradores.filter((pessoa) => pessoa.funcao === funcao)

  useEffect(() => {
    campo(fAdmissao).value = hojeISO()
    campo(fInicio).value = hojeISO()
    void (async () => {
      try {
        const [cat, hist] = await Promise.all([obterCatalogoIntegracoes(), listarIntegracoes()])
        setCatalogo(cat)
        setHistorico(hist)
      } catch (falha) {
        setFalhaCarga('Não foi possível carregar as integrações.')
        alert(falha instanceof Error ? falha.message : 'Não foi possível carregar as integrações.')
      }
    })()
  }, [])

  function selecionarColaborador(id: string): void {
    if (!id) return
    const colaborador = catalogo.colaboradores.find((pessoa) => pessoa.id === id)
    if (!colaborador) return
    campo(fNome).value = colaborador.nome
    campo(fCargo).value = colaborador.cargo ?? ''
    campo(fAdmissao).value = colaborador.admissao ?? ''
  }

  function selecionarFuncao(escolhida: FuncaoIntegracao): void {
    registroAtualId.current = null
    progresso.current = {}
    flushSync(() => {
      setFuncao(escolhida)
      setGeracao((n) => n + 1)
    })
    campo(selectColab).value = ''
    campo(fNome).value = ''
    campo(fCargo).value = ''
  }

  function carregarRegistro(id: string): void {
    const registro = (historico ?? []).find((item) => item.id === id)
    if (!registro) return
    registroAtualId.current = registro.id
    progresso.current = Object.fromEntries(
      registro.atividades.map((atividade) => [atividade.codigo, { feito: atividade.feito, data: atividade.data }]),
    )
    flushSync(() => {
      setFuncao(registro.funcao)
      setGeracao((n) => n + 1)
    })
    campo(selectColab).value = registro.colaboradorId ?? ''
    campo(fNome).value = registro.nome
    campo(fCargo).value = registro.cargo ?? ''
    campo(fAdmissao).value = registro.admissao ?? ''
    campo(fInicio).value = registro.inicio ?? ''
    campo(fCoord).value = registro.coord ?? ''
    campo(fGerente).value = registro.gerente ?? ''
    campo(fRh).value = registro.rh ?? ''
  }

  /**
   * Le o DOM, e nao o estado do React, de proposito. Os campos de data das atividades
   * nunca tiveram handler: a pessoa digita a data e so o DOM sabe o que ela digitou.
   * Trocar por estado aqui perderia o que foi digitado sem marcar a atividade.
   */
  function coletarProgresso(): void {
    for (const atividade of programa?.semanas.flatMap((semana) => semana.atividades) ?? []) {
      const marcado = inputPorId(`chk_${atividade.codigo}`)
      if (marcado === null) continue
      progresso.current[atividade.codigo] = {
        feito: marcado.checked,
        data: inputPorId(`dt_${atividade.codigo}`)?.value || null,
      }
    }
  }

  async function salvarProgresso(): Promise<void> {
    coletarProgresso()
    if (programa === undefined) return

    const corpo: EntradaIntegracao = {
      colaboradorId: campo(selectColab).value || null,
      nome: campo(fNome).value.trim(),
      cargo: campo(fCargo).value || null,
      admissao: campo(fAdmissao).value || null,
      programaId: programa.id,
      inicio: campo(fInicio).value || null,
      coord: campo(fCoord).value || null,
      gerente: campo(fGerente).value || null,
      rh: campo(fRh).value || null,
      atividades: programa.semanas.flatMap((semana) =>
        semana.atividades.map((atividade) => ({
          atividadeId: atividade.id,
          feito: progresso.current[atividade.codigo]?.feito ?? false,
          data: progresso.current[atividade.codigo]?.data ?? null,
        })),
      ),
    }

    try {
      const salva = await salvarIntegracao(registroAtualId.current, corpo)
      registroAtualId.current = salva.id
      setHistorico((antes) => {
        const lista = antes ?? []
        const indice = lista.findIndex((item) => item.id === salva.id)
        if (indice === -1) return [salva, ...lista]
        return lista.map((item, posicao) => (posicao === indice ? salva : item))
      })
      alert('Progresso salvo com sucesso!')
    } catch (falha) {
      alert(falha instanceof Error ? falha.message : 'Não foi possível salvar o progresso.')
    }
  }

  function gerarPDF(): void {
    coletarProgresso()
    if (programa === undefined) return
    const nome = campo(fNome).value || '___________________________'
    const cargo = campo(fCargo).value || programa.titulo
    const coord = campo(fCoord).value
    const gerente = campo(fGerente).value
    const rh = campo(fRh).value || '___________________________'

    let html = `<div class="ph"><div class="empresa">EM Vidros Indústria e Comércio de Vidros Ltda</div><div class="doc-tipo">Programa de Integração e Período de Experiência — 45 Dias</div><div class="doc-sub">${e(programa.titulo)}</div></div>
    <div class="pd"><div class="pd-row"><div class="pd-field"><div class="lbl">Colaborador</div><div class="val">${e(nome)}</div></div><div class="pd-field"><div class="lbl">Cargo</div><div class="val">${e(cargo)}</div></div></div>
    <div class="pd-row"><div class="pd-field"><div class="lbl">Data de Admissão</div><div class="val">${fmtData(campo(fAdmissao).value)}</div></div><div class="pd-field"><div class="lbl">Início da Integração</div><div class="val">${fmtData(campo(fInicio).value)}</div></div></div>
    <div class="pd-row"><div class="pd-field"><div class="lbl">Coordenador Responsável</div><div class="val">${e(coord)}</div></div><div class="pd-field"><div class="lbl">Gerente de Logística</div><div class="val">${e(gerente)}</div></div><div class="pd-field"><div class="lbl">Responsável RH</div><div class="val">${e(rh)}</div></div></div></div>`

    programa.semanas.forEach((semana) => {
      html += `<div class="ps"><div class="ps-header"><span>Semana ${semana.numero} — ${e(semana.titulo.split('—')[1]?.trim() || semana.titulo)}</span></div>`
      for (const atividade of semana.atividades) {
        const estado = progresso.current[atividade.codigo]
        html += `<div class="ps-item"><div class="ps-check">${estado?.feito ? '✓' : ''}</div><div class="ps-texto"><span class="ps-titulo">${e(atividade.titulo)}</span>${e(atividade.descricao)}</div><div class="ps-data">${estado?.feito ? fmtData(estado.data) : ''}</div></div>`
      }
      html += '</div>'
    })

    html += `<div class="pm"><div class="pm-titulo">Matriz de Avaliação Contínua</div><table class="pm-table"><thead><tr><th>Critério</th><th>Padrão Esperado</th><th>Frequência</th></tr></thead><tbody>${programa.criterios.map((item) => `<tr><td><b>${e(item.criterio)}</b></td><td>${e(item.padrao)}</td><td>${e(item.frequencia)}</td></tr>`).join('')}</tbody></table></div>
    <div class="passin"><div class="passin-titulo">Termo de Ciente e Assinaturas</div><div style="font-size:9pt;margin-bottom:16pt;line-height:1.5;">Declaro que recebi o plano de integração para o período de experiência de 45 dias e estou ciente das atividades, treinamentos e responsabilidades descritas.<br><br>Data: ______ / ______ / __________</div><div class="passin-grid">
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(nome)}</div><div class="passin-cargo">Colaborador (${funcao === 'motorista' ? 'Motorista' : 'Ajudante'})</div></div></div>
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(coord)}</div><div class="passin-cargo">Coordenação Logística</div></div></div>
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(gerente)}</div><div class="passin-cargo">Gerência Logística</div></div></div>
    <div class="passin-item"><div class="passin-linha"><div class="passin-nome">${e(rh)}</div><div class="passin-cargo">Recursos Humanos (RH)</div></div></div></div></div>`

    campo(printDoc).innerHTML = html
    window.print()
  }

  function listaDoHistorico(): ReactNode {
    if (falhaCarga !== null) return falhaCarga
    if (historico === null) return null
    if (historico.length === 0) {
      return <div style={{ color: 'var(--txt-muted)', fontSize: '.85rem' }}>Nenhuma integração salva ainda.</div>
    }
    return (
      historico
        .slice()
        // Mais recente primeiro, como no original. Sem isto a ordem vira a que a API
        // devolver, e a ficha que a pessoa acabou de salvar some do topo da lista.
        .sort((a, b) => b.salvoEm.localeCompare(a.salvoEm))
        .map((registro) => {
          const feitas = registro.atividades.filter((atividade) => atividade.feito).length
          const total = registro.atividades.length
          const percentual = total === 0 ? 0 : Math.round((feitas / total) * 100)
          return (
            <div className="hist-item" key={registro.id}>
              <div className="hist-ico">{registro.funcao === 'motorista' ? '🚛' : '📦'}</div>
              <div className="hist-info">
                <div className="hist-nome">{registro.nome}</div>
                <div className="hist-sub">
                  {`${registro.funcao === 'motorista' ? 'Motorista' : 'Ajudante'} · Início: ${fmtData(registro.inicio)} · Coord: ${registro.coord || '—'}`}
                </div>
              </div>
              <div className={`hist-prog ${percentual === 100 ? 'completo' : 'parcial'}`}>
                {`${percentual}% (${feitas}/${total})`}
              </div>
              <button className="btn-carregar" onClick={() => carregarRegistro(registro.id)}>
                Carregar
              </button>
            </div>
          )
        })
    )
  }

  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-name"><img src="docs/logo-emvidros.svg" alt="EM Vidros" style={{ height: '56px', width: 'auto', display: 'block' }} /></div>
          <div className="brand-sub">Integração de Frota</div>
        </div>
        <div className="nav">
          <div className="nav-label">Módulos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'formulario-registro.html' }}>✏️ Registro Diário</div>
          <div className="nav-item" onClick={() => { window.location.href = 'dashboard-semanal.html' }}>📊 Dashboard</div>
          <div className="nav-item" onClick={() => { window.location.href = 'manutencao-frota.html' }}>🔧 Manutenção Frota</div>
          <div className="nav-item" onClick={() => { window.location.href = 'documentos-frota.html' }}>📂 Documentos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'ata-reuniao.html' }}>📝 Ata de Reunião</div>
          <div className="nav-item ativo">🧑‍🏫 Integração</div>
        </div>
        <div className="sidebar-bottom">v1.0 · Ago 2026</div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div><h1>Ficha de Integração — 45 dias</h1></div>
          <div className="acoes no-print">
            <button className="btn-salvar" onClick={() => void salvarProgresso()}>💾 Salvar Progresso</button>
            <button className="btn-gerar" onClick={gerarPDF}>🖨️ Imprimir para Assinatura</button>
          </div>
        </div>

        <div className="content">
          <div className="no-print" style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '.82rem', fontWeight: '700', color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '10px' }}>Função</div>
            <div className="funcao-tabs">
              <button className={funcao === 'motorista' ? 'funcao-btn ativo' : 'funcao-btn'} id="btnMotorista" onClick={() => selecionarFuncao('motorista')}>🚛 Motorista</button>
              <button className={funcao === 'ajudante' ? 'funcao-btn ativo' : 'funcao-btn'} id="btnAjudante" onClick={() => selecionarFuncao('ajudante')}>📦 Ajudante</button>
            </div>
          </div>

          <div className="card no-print">
            <div className="card-titulo">👤 Dados do Colaborador</div>
            <div className="form-grid-3">
              <div className="form-group full">
                <label>Selecionar Colaborador</label>
                <select id="f_select_colab" ref={selectColab} onChange={(evento) => selecionarColaborador(evento.currentTarget.value)}>
                  <option value="">— Selecione ou preencha manualmente —</option>
                  {colaboradores.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.id}>{`${colaborador.nome} — ${colaborador.cargo ?? ''}`}</option>
                  ))}
                </select>
              </div>
              <div className="form-group full"><label>Nome Completo</label><input type="text" id="f_nome" placeholder="Nome completo do colaborador" ref={fNome} /></div>
              <div className="form-group"><label>Cargo</label><input type="text" id="f_cargo" placeholder="Cargo" ref={fCargo} /></div>
              <div className="form-group"><label>Data de Admissão</label><input type="date" id="f_admissao" ref={fAdmissao} /></div>
              <div className="form-group"><label>Data de Início da Integração</label><input type="date" id="f_inicio" ref={fInicio} /></div>
              <div className="form-group"><label>Coordenador Responsável</label><input type="text" id="f_coord" defaultValue="Raimundo Pontes Pereira" ref={fCoord} /></div>
              <div className="form-group"><label>Gerente de Logística</label><input type="text" id="f_gerente" defaultValue="Lívia Maria de Castro Cutrim Lima" ref={fGerente} /></div>
              <div className="form-group"><label>Responsável RH</label><input type="text" id="f_rh" placeholder="Nome do responsável RH" ref={fRh} /></div>
            </div>
          </div>

          <div id="semanasContainer">
            {programa === undefined ? null : (
              <Semanas
                key={geracao}
                programa={programa}
                progressoInicial={progresso.current}
                aoMarcar={(codigo, feito, data) => { progresso.current[codigo] = { feito, data } }}
              />
            )}
          </div>

          <div className="card no-print">
            <div className="card-titulo">📊 Matriz de Avaliação Contínua</div>
            <table className="matriz-table" id="tabelaMatriz">
              {programa === undefined ? null : (
                <>
                  <thead><tr><th>Critério</th><th>Padrão Esperado</th><th>Frequência</th></tr></thead>
                  <tbody>
                    {programa.criterios.map((item) => (
                      <tr key={item.criterio}><td><b>{item.criterio}</b></td><td>{item.padrao}</td><td><span className="badge-freq">{item.frequencia}</span></td></tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>

          <div className="card no-print" id="historico" style={{ marginTop: '24px' }}>
            <div className="card-titulo">📁 Histórico de Integrações</div>
            <div id="listaHistorico">{listaDoHistorico()}</div>
          </div>
        </div>
      </main>

      <div className="print-doc" id="printDoc" ref={printDoc} />
    </>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<IntegracaoFrota />)
