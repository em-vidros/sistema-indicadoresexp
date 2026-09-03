/**
 * A ata de reuniao. As regras do porte estao em `entrar.tsx`; aqui ficam as quatro
 * coisas que esta tela tem e as anteriores nao tinham.
 *
 * O historico da tela e uma foto, e nao o array. `renderHistorico` era chamado em
 * quatro pontos e so neles, entao `#listaHistorico` fica vazio na carga mesmo com uma
 * ata ja na memoria, e continua vazio depois de gerar o PDF. Derivar a lista do array
 * encheria a tela onde a baseline a tem vazia. Por isso `historico` e uma ref mutada
 * como a variavel de modulo de antes, `visiveis` e a foto que a tela desenha, e o
 * numero da aba e uma terceira coisa, porque `atualizarBadge` era chamado noutros
 * pontos que `renderHistorico`: o passo `pdf-anexado` redesenha os cartoes sem mexer
 * no badge, e o `pdf-gerado` faz o contrario.
 *
 * O colaborador marcado e propriedade de um lado e estado do outro. O `<input>` nasceu
 * uma vez por `innerHTML` e nunca ganhou o atributo `checked`, nem no clique nem no
 * "marcar todos", entao ele continua nao controlado e `marcarTodos` escreve
 * `check.checked` no DOM como antes. O que o React guarda e so a classe `marcado` do
 * rotulo, que e o que muda de desenho.
 *
 * Os campos sao lidos por id, e nao por ref. Metade deles nasce dentro de um `map`
 * (quatro por topico, tres por linha de importacao) e so o id chega ate la; ler os
 * fixos por ref e os dinamicos por id daria dois jeitos de ler o mesmo formulario. O
 * id ja e obrigatorio, porque a baseline o cobra em cada campo.
 *
 * O que a tela imprime tambem e uma foto. `preencherImpressao` escrevia nos `p_*` e
 * so entao `window.print()` levava o documento pronto na mesma volta, entao o estado
 * entra por `flushSync` antes da impressao, como em `integracao-frota.tsx`.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
  apagarAta as apagarAtaNaApi,
  caminhoPdfAta,
  enviarPdfAta,
  listarAtas,
  obterCatalogoAtas,
  salvarAta as salvarAtaNaApi,
} from '../js/atas-api.ts'
import type { AtaSalva, ColaboradorAta, EntradaAta } from '../js/atas-api.ts'
import './ata-reuniao.css'

type Aba = 'ata' | 'hist'

type LinhaImport = {
  readonly id: string
  readonly data: string
  readonly titulo: string
  readonly numero: string
  /** O rotulo do mes que nasce acima da linha. Vazio na linha adicionada a mao. */
  readonly mes: string
}

type TopicoImpresso = {
  readonly discussao: string
  readonly conclusao: string
  readonly responsavel: string
  readonly prazo: string
}

type Impressao = {
  readonly numAta: string
  readonly titulo: string
  readonly data: string
  readonly horario: string
  readonly local: string
  readonly convocada: string
  readonly facilitadores: string
  readonly participantesGeral: string
  readonly g1Nome: string
  readonly g1Cargo: string
  readonly g2Nome: string
  readonly g2Cargo: string
  readonly topicos: readonly TopicoImpresso[]
  readonly participantes: readonly string[]
}

const IMPRESSAO_VAZIA: Impressao = {
  numAta: '', titulo: '', data: '', horario: '', local: '', convocada: '',
  facilitadores: '', participantesGeral: '', g1Nome: '', g1Cargo: '', g2Nome: '',
  g2Cargo: '', topicos: [], participantes: [],
}

const MESES_IMPORT = [
  { mes: 'Janeiro', data: '2026-01-31' },
  { mes: 'Fevereiro', data: '2026-02-28' },
  { mes: 'Março', data: '2026-03-31' },
  { mes: 'Abril', data: '2026-04-30' },
  { mes: 'Maio', data: '2026-05-31' },
  { mes: 'Junho', data: '2026-06-30' },
  { mes: 'Julho', data: '2026-07-31' },
  { mes: 'Agosto', data: '2026-08-31' },
]

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const TETO_PDF = 4 * 1024 * 1024

/** O `elemento(id)` do modulo velho. Estoura igual, porque campo que sumiu e defeito. */
function campo(id: string): HTMLInputElement | HTMLTextAreaElement {
  const achado = document.getElementById(id)
  if (achado === null) throw new Error(`elemento '${id}' nao existe`)
  return achado as HTMLInputElement | HTMLTextAreaElement
}

function valor(id: string): string {
  return campo(id).value
}

function nulo(texto: string): string | null {
  return texto.trim() || null
}

function formatarData(data: string): string {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function mensagemFalha(falha: unknown, padrao: string): string {
  return falha instanceof Error ? falha.message : padrao
}

/** As quebras de linha da conclusao viravam `<br>` no documento de impressao. */
function comQuebras(texto: string): JSX.Element[] {
  return texto.split('\n').map((linha, indice) => (
    <Fragment key={indice}>
      {indice > 0 ? <br /> : null}
      {linha}
    </Fragment>
  ))
}

function AtaReuniao(): JSX.Element {
  const [topicos, setTopicos] = useState<readonly number[]>([])
  const [catalogo, setCatalogo] = useState<readonly ColaboradorAta[]>([])
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => new Set())
  const [extras, setExtras] = useState<readonly number[]>([])
  const [aba, setAba] = useState<Aba>('ata')
  const [badge, setBadge] = useState(0)
  // `null` e "nunca desenhado", que nao e a mesma coisa que "desenhado e vazio": o
  // primeiro deixa `#listaHistorico` sem filho nenhum, o segundo mostra o `hist-empty`.
  const [visiveis, setVisiveis] = useState<readonly AtaSalva[] | null>(null)
  const [anexarVisivel, setAnexarVisivel] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [linhasImport, setLinhasImport] = useState<readonly LinhaImport[]>([])
  const [nomesPdfImport, setNomesPdfImport] = useState<Readonly<Record<string, string>>>({})
  const [impressao, setImpressao] = useState<Impressao>(IMPRESSAO_VAZIA)

  const historico = useRef<AtaSalva[]>([])
  const ataAtualId = useRef<string | null>(null)
  const anexarParaId = useRef<string | null>(null)
  const importRowId = useRef<string | null>(null)
  const importPdfs = useRef(new Map<string, File>())
  const contadorTopico = useRef(0)
  const contadorExtra = useRef(0)
  const contadorLinha = useRef(0)
  const inputPdf = useRef<HTMLInputElement>(null)
  const inputPdfImport = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const agora = new Date()
    // Data e horario chegam pela propriedade, e nao por `defaultValue`: a baseline nao
    // tem atributo `value` nos dois, porque quem os preenchia era o script.
    campo('f_data').value = agora.toISOString().split('T')[0] ?? ''
    campo('f_horario').value = agora.toTimeString().slice(0, 5)
    adicionarTopico()
    adicionarTopico()
    adicionarTopico()

    void (async () => {
      try {
        const [pessoas, atas] = await Promise.all([obterCatalogoAtas(), listarAtas()])
        historico.current = atas
        setCatalogo(pessoas)
        setBadge(atas.length)
      } catch (falha) {
        alert(mensagemFalha(falha, 'Não foi possível carregar as atas.'))
      }
    })()
  }, [])

  function adicionarTopico(): void {
    const numero = ++contadorTopico.current
    setTopicos((antes) => [...antes, numero])
  }

  function removerTopico(numero: number): void {
    setTopicos((antes) => antes.filter((n) => n !== numero))
  }

  function atualizarMarcado(id: string, ligado: boolean): void {
    setMarcados((antes) => {
      const proximo = new Set(antes)
      if (ligado) proximo.add(id)
      else proximo.delete(id)
      return proximo
    })
  }

  function marcarTodos(estado: boolean): void {
    const ids: string[] = []
    document.querySelectorAll<HTMLInputElement>('.colab-chk input[type=checkbox]').forEach((check) => {
      check.checked = estado
      const id = check.dataset['colaboradorId']
      if (id !== undefined) ids.push(id)
    })
    setMarcados(estado ? new Set(ids) : new Set())
  }

  function adicionarParticipanteExtra(): void {
    const numero = ++contadorExtra.current
    setExtras((antes) => [...antes, numero])
  }

  function coletarTopicos(): EntradaAta['topicos'] {
    return topicos.flatMap((numero) => {
      const discussao = valor(`t${numero}_disc`).trim()
      const conclusao = valor(`t${numero}_concl`).trim()
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
    const externos = Array.from(
      document.querySelectorAll<HTMLInputElement>('#listaPart .part-row input'),
    ).flatMap((entrada) => entrada.value.trim() ? [{ colaboradorId: null, nomeExterno: entrada.value.trim(), presente: true }] : [])
    return [...cadastrados, ...externos]
  }

  function nomesParticipantes(): string[] {
    const nomes = Array.from(
      document.querySelectorAll<HTMLInputElement>('.colab-chk input[type=checkbox]:checked'),
      (check) => check.closest('.colab-chk')?.textContent?.trim() ?? '',
    )
    nomes.push(...Array.from(
      document.querySelectorAll<HTMLInputElement>('#listaPart .part-row input'),
      (entrada) => entrada.value.trim(),
    ))
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

  function montarImpressao(): Impressao {
    const numero = valor('f_num').trim()
    return {
      numAta: numero ? `Ata nº ${numero}` : '',
      titulo: valor('f_titulo'),
      data: formatarData(valor('f_data')),
      horario: valor('f_horario'),
      local: valor('f_local'),
      convocada: valor('f_convocada'),
      facilitadores: valor('f_facilitadores'),
      participantesGeral: valor('f_participantes_geral'),
      g1Nome: valor('g1_nome'),
      g1Cargo: valor('g1_cargo'),
      g2Nome: valor('g2_nome'),
      g2Cargo: valor('g2_cargo'),
      topicos: coletarTopicos().map((topico) => ({
        discussao: topico.discussao ?? '',
        conclusao: topico.conclusao ?? '',
        responsavel: topico.responsavel ?? '',
        prazo: topico.prazo ?? '',
      })),
      participantes: nomesParticipantes(),
    }
  }

  async function salvarAta(): Promise<boolean> {
    const dados = coletarDados()
    // Sem título ou sem data a API recusa a ata, então nem chega a pedir. Em silêncio,
    // porque imprimir é imprimir: a tela nunca cobrou campo de quem só queria o PDF.
    if (!dados.titulo || !dados.data) return false
    try {
      const salva = await salvarAtaNaApi(ataAtualId.current, dados)
      ataAtualId.current = salva.id
      const indice = historico.current.findIndex((item) => item.id === salva.id)
      if (indice === -1) historico.current.unshift(salva)
      else historico.current[indice] = salva
      setAnexarVisivel(true)
      setBadge(historico.current.length)
      return true
    } catch (falha) {
      alert(mensagemFalha(falha, 'Não foi possível salvar a ata.'))
      return false
    }
  }

  async function gerarPDF(): Promise<void> {
    flushSync(() => setImpressao(montarImpressao()))
    await salvarAta()
    window.print()
  }

  function mostrarHistorico(): void {
    setVisiveis(historico.current.map((ata) => ({ ...ata })))
  }

  function switchTab(destino: Aba): void {
    setAba(destino)
    if (destino !== 'ata') mostrarHistorico()
  }

  async function anexarPDF(entrada: HTMLInputElement): Promise<void> {
    const arquivo = entrada.files?.[0]
    if (!arquivo) return
    const id = anexarParaId.current ?? ataAtualId.current
    if (!id) return
    if (arquivo.size > TETO_PDF) {
      alert('PDF muito grande (máx 4 MB). Reduza o tamanho antes de anexar.')
      entrada.value = ''
      return
    }
    try {
      await enviarPdfAta(id, arquivo)
      const ata = historico.current.find((item) => item.id === id)
      if (ata) ata.temPdf = true
      mostrarHistorico()
      alert('PDF anexado com sucesso!')
    } catch (falha) {
      alert(mensagemFalha(falha, 'Não foi possível anexar o PDF.'))
    } finally {
      anexarParaId.current = null
      entrada.value = ''
    }
  }

  function anexarParaAta(id: string): void {
    anexarParaId.current = id
    inputPdf.current?.click()
  }

  function downloadPDF(id: string): void {
    const ata = historico.current.find((item) => item.id === id)
    const nome = [ata?.numero ? `ata-${ata.numero.replace('/', '')}` : 'ata', ata?.data, ata?.titulo]
      .filter(Boolean)
      .join('-')
    const link = document.createElement('a')
    link.href = caminhoPdfAta(id)
    link.download = `${nome.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`
    link.click()
  }

  async function deletarAta(id: string): Promise<void> {
    if (!confirm('Excluir esta ata do histórico?')) return
    try {
      await apagarAtaNaApi(id)
      historico.current = historico.current.filter((ata) => ata.id !== id)
      if (id === ataAtualId.current) {
        ataAtualId.current = null
        setAnexarVisivel(false)
      }
      setBadge(historico.current.length)
      mostrarHistorico()
    } catch (falha) {
      alert(mensagemFalha(falha, 'Não foi possível excluir a ata.'))
    }
  }

  function novaLinha(data = '', titulo = '', numero = '', mes = ''): LinhaImport {
    return { id: `imp_${++contadorLinha.current}`, data, titulo, numero, mes }
  }

  function abrirModalImportar(): void {
    importPdfs.current.clear()
    importRowId.current = null
    setNomesPdfImport({})
    setLinhasImport(MESES_IMPORT.map((mes) => novaLinha(mes.data, 'Alinhamento Equipe Expedição', '', mes.mes)))
    setModalAberto(true)
  }

  function fecharModalImportar(): void {
    setModalAberto(false)
  }

  function addImportRow(): void {
    setLinhasImport((antes) => [...antes, novaLinha()])
  }

  function escolherPDFImport(id: string): void {
    importRowId.current = id
    const entrada = inputPdfImport.current
    if (entrada === null) return
    entrada.value = ''
    entrada.click()
  }

  function onPDFImportSelecionado(entrada: HTMLInputElement): void {
    const arquivo = entrada.files?.[0]
    const id = importRowId.current
    if (!arquivo || id === null) return
    if (arquivo.size > TETO_PDF) {
      alert('PDF muito grande (máx 4 MB).')
      return
    }
    importPdfs.current.set(id, arquivo)
    setNomesPdfImport((antes) => ({ ...antes, [id]: arquivo.name }))
    importRowId.current = null
  }

  async function salvarImportadas(): Promise<void> {
    let adicionadas = 0
    let recusadas = 0
    for (const linha of linhasImport) {
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
        const pdf = importPdfs.current.get(linha.id)
        if (pdf) {
          await enviarPdfAta(nova.id, pdf)
          nova.temPdf = true
        }
        historico.current.push(nova)
        adicionadas++
      } catch {
        // Linha recusada nao derruba o lote. O importador antigo gravava tudo de uma
        // vez e nunca parava no meio; parar deixaria as anteriores salvas em silencio.
        recusadas++
      }
    }
    historico.current.sort((a, b) => b.data.localeCompare(a.data))
    fecharModalImportar()
    setBadge(historico.current.length)
    mostrarHistorico()
    const sobra = recusadas ? `\n${recusadas} ata(s) não foram importadas. Confira a data.` : ''
    alert(`${adicionadas} ata(s) importada(s) com sucesso!${sobra}`)
  }

  const grupo = (funcao: string): JSX.Element[] =>
    catalogo.filter((pessoa) => pessoa.funcao === funcao).map((pessoa) => (
      <label className={marcados.has(pessoa.id) ? 'colab-chk marcado' : 'colab-chk'} key={pessoa.id}>
        <input
          type="checkbox"
          data-colaborador-id={pessoa.id}
          onChange={(evento) => atualizarMarcado(pessoa.id, evento.currentTarget.checked)}
        />
        {` ${pessoa.nome}`}
      </label>
    ))

  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-name">
            <img src="docs/logo-emvidros.svg" alt="EM Vidros" style={{ height: '56px', width: 'auto', display: 'block' }} />
          </div>
          <div className="brand-sub">Ata de Reunião</div>
        </div>
        <div className="nav">
          <div className="nav-label">Módulos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'formulario-registro.html' }}>✏️ Registro Diário</div>
          <div className="nav-item" onClick={() => { window.location.href = 'dashboard-semanal.html' }}>📊 Dashboard</div>
          <div className="nav-item" onClick={() => { window.location.href = 'manutencao-frota.html' }}>🔧 Manutenção Frota</div>
          <div className="nav-item" onClick={() => { window.location.href = 'documentos-frota.html' }}>📂 Documentos</div>
          <div className="nav-item ativo">📝 Ata de Reunião</div>
          <div className="nav-item" onClick={() => { window.location.href = 'integracao-frota.html' }}>🧑‍🏫 Integração</div>
        </div>
        <div className="sidebar-bottom">v1.0 · Ago 2026</div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div><h1>Ata de Reunião</h1></div>
          <div className="acoes no-print" style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-gerar" onClick={() => void gerarPDF()}>🖨️ Gerar PDF para Assinatura</button>
            <button
              className="btn-gerar"
              id="btnAnexar"
              onClick={() => inputPdf.current?.click()}
              style={anexarVisivel ? { background: 'var(--green)' } : { background: 'var(--green)', display: 'none' }}
            >
              📎 Anexar PDF Assinado
            </button>
            <input
              ref={inputPdf}
              type="file"
              id="inputPDF"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(evento) => void anexarPDF(evento.currentTarget)}
            />
          </div>
        </div>

        <div className="tabs-bar no-print">
          <button
            className={aba === 'ata' ? 'tab-btn ativa' : 'tab-btn'}
            id="tabBtnAta"
            onClick={() => switchTab('ata')}
          >
            📋 Nova Ata
          </button>
          <button
            className={aba === 'hist' ? 'tab-btn ativa' : 'tab-btn'}
            id="tabBtnHist"
            onClick={() => switchTab('hist')}
          >
            {'📁 Histórico '}
            <span className="tab-badge" id="badgeHist">{String(badge)}</span>
          </button>
        </div>

        <div className={aba === 'ata' ? 'content panel ativa' : 'content panel'} id="panelAta">
          <div className="card no-print">
            <div className="card-titulo">📋 Identificação da Reunião</div>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Nº da Ata</label>
                <input type="text" id="f_num" placeholder="Ex: 001/2026" />
              </div>
              <div className="form-group">
                <label>Data</label>
                <input type="date" id="f_data" />
              </div>
              <div className="form-group">
                <label>Horário</label>
                <input type="time" id="f_horario" />
              </div>
              <div className="form-group full">
                <label>Título da Reunião</label>
                <input type="text" id="f_titulo" placeholder="Ex: Alinhamento Equipe Expedição" />
              </div>
              <div className="form-group">
                <label>Local</label>
                <input type="text" id="f_local" placeholder="Ex: Raposa - MA" />
              </div>
              <div className="form-group">
                <label>Reunião convocada por</label>
                <input type="text" id="f_convocada" defaultValue="Lívia Lima, Raimundo Pontes" />
              </div>
              <div className="form-group">
                <label>Facilitadores</label>
                <input type="text" id="f_facilitadores" defaultValue="Gestores de Expedição – EM Vidros" />
              </div>
              <div className="form-group full">
                <label>Participantes (descrição geral)</label>
                <input type="text" id="f_participantes_geral" defaultValue="Equipe Expedição (Motoristas e Assist frota)" />
              </div>
            </div>
          </div>

          <div id="topicosContainer">
            {topicos.map((numero) => (
              <div className="topico no-print" id={`topico_${numero}`} key={numero}>
                <div className="topico-header">
                  <div className="topico-num">{String(numero)}</div>
                  <div className="topico-titulo">{`Tópico ${numero}`}</div>
                  <button className="btn-remover" onClick={() => removerTopico(numero)} title="Remover tópico">✕</button>
                </div>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Discussão</label>
                    <input type="text" id={`t${numero}_disc`} placeholder="Assunto discutido..." defaultValue="" />
                  </div>
                  <div className="form-group full">
                    <label>Conclusões / Encaminhamentos</label>
                    <textarea id={`t${numero}_concl`} rows={3} placeholder="Deliberações e encaminhamentos..." defaultValue="" />
                  </div>
                  <div className="form-group">
                    <label>Responsável</label>
                    <input type="text" id={`t${numero}_resp`} placeholder="Nome ou função" defaultValue="" />
                  </div>
                  <div className="form-group">
                    <label>Prazo</label>
                    <input type="text" id={`t${numero}_prazo`} placeholder="Ex: Imediato / 30/09/2026" defaultValue="" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="no-print" style={{ marginBottom: '16px' }}>
            <button className="btn-add-topico" onClick={adicionarTopico}>+ Adicionar Tópico</button>
          </div>

          <div className="card no-print">
            <div className="card-titulo">✍️ Participantes</div>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Selecione quem esteve presente na reunião.</div>

            <div style={{ marginBottom: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Motoristas</div>
            <div className="colab-grid" id="checkMotoristas">{grupo('motorista')}</div>

            <div style={{ margin: '14px 0 4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Ajudantes de Entrega</div>
            <div className="colab-grid" id="checkAjudantes">{grupo('ajudante')}</div>

            <div style={{ margin: '14px 0 4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Atendimento ao Cliente</div>
            <div className="colab-grid" id="checkAtendimento">{grupo('atendimento')}</div>

            <div style={{ margin: '14px 0 4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Assistente de Logística</div>
            <div className="colab-grid" id="checkLogistica">{grupo('logistica')}</div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px', alignItems: 'center' }}>
              <button className="btn-add" onClick={() => marcarTodos(true)}>✔ Marcar todos</button>
              <button className="btn-add" onClick={() => marcarTodos(false)}>✕ Desmarcar todos</button>
              <button className="btn-add" onClick={adicionarParticipanteExtra}>+ Adicionar externo</button>
            </div>

            <div className="part-lista" id="listaPart" style={{ marginTop: '10px' }}>
              {extras.map((numero) => (
                <div className="part-row" key={numero}>
                  <input type="text" placeholder="Nome completo (externo / convidado)" />
                  <button
                    className="btn-remover"
                    onClick={() => setExtras((antes) => antes.filter((n) => n !== numero))}
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card no-print">
            <div className="card-titulo">🏷️ Gestores</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Nome do Gestor 1</label>
                <input type="text" id="g1_nome" defaultValue="Lívia Maria de Castro Cutrim Lima" />
              </div>
              <div className="form-group">
                <label>Cargo do Gestor 1</label>
                <input type="text" id="g1_cargo" defaultValue="Gerente de Logística" />
              </div>
              <div className="form-group">
                <label>Nome do Gestor 2</label>
                <input type="text" id="g2_nome" defaultValue="Raimundo Pontes Pereira" />
              </div>
              <div className="form-group">
                <label>Cargo do Gestor 2</label>
                <input type="text" id="g2_cargo" defaultValue="Coordenador de Expedição" />
              </div>
            </div>
          </div>
        </div>

        <div className={aba === 'hist' ? 'content panel ativa' : 'content panel'} id="panelHist">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '.82rem', color: 'var(--txt-dim)' }}>Atas salvas com segurança no sistema.</div>
            <button className="btn-gerar" style={{ fontSize: '.82rem', padding: '8px 16px' }} onClick={abrirModalImportar}>📥 Importar Atas Passadas</button>
          </div>
          <div id="listaHistorico">
            {visiveis !== null && visiveis.length === 0
              ? <div className="hist-empty">📋 Nenhuma ata registrada ainda.<br /><small>Gere o PDF de uma ata para ela aparecer aqui.</small></div>
              : null}
            {(visiveis ?? []).map((ata, indice) => {
              const [ano = '', mes = '', dia = '--'] = ata.data.split('-')
              return (
                // O historico e uma foto de um array com repetido: a fixture de `POST
                // /api/atas` devolve o mesmo id duas vezes no passo `importadas-salvas`.
                <div className="hist-card" key={indice}>
                  <div className="hist-date">
                    <div className="hd-dia">{dia}</div>
                    <div className="hd-mes">{`${MESES_CURTOS[Number(mes)] || '—'} ${ano.slice(2)}`}</div>
                  </div>
                  <div className="hist-info">
                    <div className="hist-num">{`${ata.numero ? `Ata nº ${ata.numero} · ` : ''}${ata.horario ?? ''}`}</div>
                    <div className="hist-titulo">{ata.titulo || 'Sem título'}</div>
                    <div className="hist-meta">{`${ata.local ? `${ata.local} · ` : ''}${ata.participantes.length} participante(s) · ${ata.topicos.length} tópico(s)`}</div>
                    <div style={{ marginTop: '8px' }}>
                      {ata.temPdf
                        ? <span className="badge-pdf badge-ok">✅ PDF anexado</span>
                        : <span className="badge-pdf badge-pendente">📎 PDF pendente</span>}
                    </div>
                    <div className="hist-acoes">
                      {ata.temPdf ? <button className="btn-hist primary" onClick={() => downloadPDF(ata.id)}>⬇️ Baixar PDF</button> : null}
                      <button className="btn-hist" onClick={() => anexarParaAta(ata.id)}>{`📎 ${ata.temPdf ? 'Substituir PDF' : 'Anexar PDF'}`}</button>
                      <button className="btn-hist danger" onClick={() => void deletarAta(ata.id)}>🗑 Excluir</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={modalAberto ? 'modal-overlay' : 'modal-overlay hidden'} id="modalImportar">
          <div className="modal-box">
            <div className="modal-titulo">📥 Importar Atas — Jan a Ago 2026</div>
            <div style={{ fontSize: '.8rem', color: 'var(--txt-dim)', marginBottom: '16px' }}>Para cada reunião realizada: informe a data, o título e o número. Se tiver o PDF assinado, clique em 📎 para já anexar.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 32px', gap: '6px', marginBottom: '6px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt-dim)' }}>Data</div>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt-dim)' }}>Título da Reunião</div>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt-dim)' }}>Nº da Ata</div>
              <div />
            </div>
            <div id="importRows">
              {linhasImport.map((linha) => (
                <Fragment key={linha.id}>
                  {linha.mes
                    ? <div style={{ fontSize: '.68rem', color: 'var(--txt-dim)', margin: '2px 0 4px', gridColumn: '1/-1' }}>{`${linha.mes} 2026`}</div>
                    : null}
                  <div className="import-row" id={linha.id}>
                    <input type="date" id={`${linha.id}_data`} defaultValue={linha.data} />
                    <input type="text" id={`${linha.id}_titulo`} placeholder="Título da reunião" defaultValue={linha.titulo} />
                    <input type="text" id={`${linha.id}_num`} placeholder="001/2026" defaultValue={linha.numero} />
                    <button
                      className={nomesPdfImport[linha.id] ? 'btn-import-pdf ok' : 'btn-import-pdf'}
                      id={`${linha.id}_pdfbtn`}
                      onClick={() => escolherPDFImport(linha.id)}
                      title={nomesPdfImport[linha.id] ?? 'Anexar PDF assinado'}
                    >
                      {nomesPdfImport[linha.id] ? '✅' : '📎'}
                    </button>
                  </div>
                </Fragment>
              ))}
            </div>{' '}
            <button className="btn-add" style={{ marginTop: '10px' }} onClick={addImportRow}>+ Adicionar linha</button>{' '}
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={fecharModalImportar}>Cancelar</button>
              <button className="btn-modal-save" onClick={() => void salvarImportadas()}>✔ Salvar no Histórico</button>
            </div>
          </div>
        </div>
        <input
          ref={inputPdfImport}
          type="file"
          id="inputPDFImport"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(evento) => onPDFImportSelecionado(evento.currentTarget)}
        />
      </main>

      <div className="print-header">
        <div className="empresa">EM Vidros Indústria e Comércio de Vidros Ltda</div>
        <div className="doc-tipo">Ata de Reunião — Expedição Raposa</div>
        <div className="doc-num" id="p_num_ata">{impressao.numAta}</div>
      </div>

      <div className="print-fields">
        <div className="print-field-row">
          <div className="print-field"><div className="f-label">Título da Reunião</div><div className="f-value" id="p_titulo">{impressao.titulo}</div></div>
        </div>
        <div className="print-field-row">
          <div className="print-field"><div className="f-label">Data</div><div className="f-value" id="p_data">{impressao.data}</div></div>
          <div className="print-field"><div className="f-label">Horário</div><div className="f-value" id="p_horario">{impressao.horario}</div></div>
          <div className="print-field"><div className="f-label">Local</div><div className="f-value" id="p_local">{impressao.local}</div></div>
        </div>
        <div className="print-field-row">
          <div className="print-field"><div className="f-label">Reunião convocada por</div><div className="f-value" id="p_convocada">{impressao.convocada}</div></div>
          <div className="print-field"><div className="f-label">Facilitadores</div><div className="f-value" id="p_facilitadores">{impressao.facilitadores}</div></div>
          <div className="print-field"><div className="f-label">Participantes</div><div className="f-value" id="p_participantes_geral">{impressao.participantesGeral}</div></div>
        </div>
      </div>

      <div className="print-topicos" id="printTopicos">
        {impressao.topicos.map((topico, indice) => (
          <div className="print-topico" key={indice}>
            <div className="top-num">{`Tópico ${indice + 1}`}</div>
            <div className="top-row">
              <div className="top-col"><div className="f-label">Discussão</div><div className="f-value">{topico.discussao}</div></div>
              <div className="top-col"><div className="f-label">Conclusões / Encaminhamentos</div><div className="f-value">{comQuebras(topico.conclusao)}</div></div>
            </div>
            <div className="top-resp">
              <div><div className="f-label">Responsável:</div><div className="f-value"><b>{topico.responsavel || '—'}</b></div></div>
              <div style={{ marginLeft: '24pt' }}><div className="f-label">Prazo:</div><div className="f-value"><b>{topico.prazo || '—'}</b></div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="print-participantes">
        <div className="print-part-titulo">Participantes</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: '8pt' }}>
          <span>Nome</span><span>Assinatura</span>
        </div>
        <div className="print-part-grid" id="printPart">
          {impressao.participantes.map((nome, indice) => (
            <div className="print-part-item" key={indice}>
              <div className="print-part-name">{nome}</div>
              <div className="print-part-assinatura">Assinatura</div>
            </div>
          ))}
        </div>

        <div className="print-gestores">
          <div className="f-label">Gestores Responsáveis</div>
          <div className="print-gestor-row">
            <div className="print-gestor">
              <div className="g-nome" id="p_g1_nome">{impressao.g1Nome}</div>
              <div className="g-cargo" id="p_g1_cargo">{impressao.g1Cargo}</div>
            </div>
            <div className="print-gestor">
              <div className="g-nome" id="p_g2_nome">{impressao.g2Nome}</div>
              <div className="g-cargo" id="p_g2_cargo">{impressao.g2Cargo}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<AtaReuniao />)
