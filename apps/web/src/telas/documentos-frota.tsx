/**
 * A tela de documentos da frota. As regras do porte estao em `entrar.tsx`; aqui ficam
 * as tres coisas que esta tela tem e aquela nao tinha.
 *
 * O modal fechado nao esvazia. O `fecharModalDoc` de antes so tirava a classe `aberto`,
 * e o corpo continuava com o ultimo veiculo ou motorista aberto ate alguem abrir outro.
 * Por isso `alvo` e `aberto` sao dois estados: fechar mexe so no segundo.
 *
 * O nome do PDF escolhido tambem sobrevive ao salvar. O `_docPdfs` de antes era zerado
 * depois do envio, mas o `<span>` que mostra o nome era DOM cru e ninguem o reescrevia,
 * entao o "✅ arquivo.pdf" ficava na tela. Aqui sao duas coisas separadas: `pdfs` guarda
 * o que ainda falta enviar, `nomesPdf` guarda o que a tela mostra, e so abrir outro
 * modal apaga o segundo, que e quando o `innerHTML` de antes era regerado.
 *
 * Os campos do modal ficam sem `value` e sao lidos por ref na hora de salvar, como no
 * `entrar`. O `#filtroBase` do topo e a excecao: a tela inteira se redesenha quando ele
 * muda, entao ele e estado de verdade, e `<select>` nao ganha atributo `value`.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'
import {
  atualizarDocumento,
  caminhoArquivoDocumento,
  enviarDocumento,
  listarDocumentos,
  obterCatalogoDocumentos,
  salvarDadosDocumento,
} from '../js/documentos-api.ts'
import type {
  CatalogoDocumentos,
  DocumentoSalvo,
  EntradaDocumento,
  TipoDocumento,
} from '../js/documentos-api.ts'
import './documentos-frota.css'

// ===================== CONFIG =====================

const VEICULOS_INFO: Record<string, { modelo: string; marca: string; ano: string }> = {
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
}

const MOTORISTAS_RAPOSA = ['Anderson Penha Dos Anjos','Gabriel Reis Costa','Leandro do Nascimento Brito','Raimundo Correia Ferreira','Raimundo Nonato da Silva Divino','Saturnino Assumpção Dias Filho','Silio Vinicius Cruz Castro','Victor Gonçalves Vasconcelos']
const MOTORISTAS_IMPERATRIZ = ['Nataniel Pereira Rocha','Francisco Pereira dos Santos','Evandro de Oliveira Cardim','Francisco de Sousa Cabral','Adriel da Silva Santos','Sebastiao de Brito Matos','Italo Melo Sales','Railton da Silva Batista']
const MOTORISTAS_BELEM = ['Severino Manoel Barata do Nascimento']

const VEICULOS_RAPOSA     = ['PTV0006','PTT0004','ROW3A87','SMW0B96','SM02J13','SMP6F86','SMQ2I80']
const VEICULOS_IMPERATRIZ = ['DMG9D41','NXD4H26','NXB2H55','ROW4J37','SMR2H61','SND9C34','SMM4A02']
const VEICULOS_BELEM      = ['SMP2F01']

// Manuais dos fabricantes da base Raposa
const MANUAIS_RAPOSA = [
  { titulo:'Manual ATEGO 2429 / 3030 CE',        marca:'Mercedes-Benz', modelos:'ATEGO 2429 · ATEGO 3030 CE',        placas:'SM02J13, SMP6F86, SMW0B96, PTV0006', url:'docs/manual-atego.pdf' },
  { titulo:'Manual ACCELO 1316 (Euro V)',         marca:'Mercedes-Benz', modelos:'ACCELO 1316 (Euro V)',              placas:'PTT0004',                             url:'docs/manual-accelo-euro-v.pdf' },
  { titulo:'Manual ACCELO 1017 (Euro VI)',        marca:'Mercedes-Benz', modelos:'ACCELO 1017 (Euro VI)',             placas:'SMQ2I80',                             url:'docs/manual-accelo-euro-vi.pdf' },
  { titulo:'Manual 26.260 CRM 6x2',              marca:'Volkswagen',    modelos:'26.260 CRM 6x2',                    placas:'ROW3A87',                             url:'docs/manual-volks.pdf' },
]

// Planos de manutencao
const PLANOS = [
  { titulo:'PGQ MAN — Programa de Manutenção Preventiva 2026', descricao:'Cronograma anual assinado — todos os veículos Raposa', url:'docs/pgq-manutencao-2026.pdf', tipo:'plano' },
]

const SEGURADORAS = ['Bradesco','MAPFRE','Porto Seguro','Allianz','Tokio Marine','Zurich','Sompo','HDI','Outra']
const CATEGORIAS_CNH = ['A','AB','AC','AD','AE','B','C','D','E']

// ===================== ESTADO =====================

/** Os tres documentos que o card de um veiculo mostra, com o nome que a tela usa. */
type TipoVeiculo = 'seguro' | 'crlv' | 'tacografo'

type DocDaTela = {
  id: string
  vencimento: string
  link: string
  linkExterno: string
  nomeArq: string
  temArquivo: boolean
}

type CfgVeiculo = {
  seguro?: DocDaTela
  crlv?: DocDaTela
  tacografo?: DocDaTela
  seguradora?: string
  emergencia?: string
}

type CfgCnh = {
  id: string
  vencimento: string
  numero: string
  categoria: string
  link: string
}

/**
 * As duas chaveadas separadas. O modulo antigo guardava as duas no mesmo objeto e
 * prefixava o motorista com `moto_` para os nomes nao baterem numa placa.
 */
type DocsCfg = {
  veiculos: Record<string, CfgVeiculo>
  motoristas: Record<string, CfgCnh>
}

type Alvo = { tipo: 'veiculo'; placa: string } | { tipo: 'motorista'; nome: string }

const CATALOGO_VAZIO: CatalogoDocumentos = { bases: [], veiculos: [], colaboradores: [] }

function montarDocsCfg(catalogo: CatalogoDocumentos, documentos: DocumentoSalvo[]): DocsCfg {
  const cfg: DocsCfg = { veiculos: {}, motoristas: {} }
  for (const doc of documentos) {
    const fonte = doc.temArquivo ? caminhoArquivoDocumento(doc.id) : doc.linkExterno || ''
    if (doc.veiculoId) {
      const placa = catalogo.veiculos.find((v) => v.id === doc.veiculoId)?.placa
      if (placa === undefined) continue
      const atual = (cfg.veiculos[placa] ??= {})
      const tipo = doc.tipo === 'apolice' ? 'seguro' : doc.tipo
      const dado: DocDaTela = {
        id: doc.id, vencimento: doc.vencimento || '', link: fonte,
        linkExterno: doc.linkExterno || '', nomeArq: doc.nomeArquivo || '', temArquivo: doc.temArquivo,
      }
      if (tipo === 'seguro' || tipo === 'crlv' || tipo === 'tacografo') atual[tipo] = dado
      if (doc.tipo === 'apolice') {
        atual.seguradora = doc.seguradora || ''
        atual.emergencia = doc.contatoEmergencia || ''
      }
    }
    if (doc.colaboradorId) {
      const nome = catalogo.colaboradores.find((p) => p.id === doc.colaboradorId)?.nome
      if (nome === undefined) continue
      cfg.motoristas[nome] = {
        id: doc.id, vencimento: doc.vencimento || '', numero: doc.cnhNumero || '',
        categoria: doc.cnhCategoria || '', link: fonte,
      }
    }
  }
  return cfg
}

// ===================== UTILITARIOS =====================

function veiculosDaBase(base: string): string[] {
  return base === 'Raposa' ? VEICULOS_RAPOSA : base === 'Imperatriz' ? VEICULOS_IMPERATRIZ : VEICULOS_BELEM
}

function motoristasBase(base: string): string[] {
  return base === 'Raposa' ? MOTORISTAS_RAPOSA : base === 'Imperatriz' ? MOTORISTAS_IMPERATRIZ : MOTORISTAS_BELEM
}

function diasAteVencer(dataStr: string | undefined): number | null {
  if (!dataStr) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataStr + 'T00:00:00')
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000)
}

function statusVencimento(dataStr: string | undefined, alertaDias: number): string {
  const dias = diasAteVencer(dataStr)
  if (dias === null) return 'sem-data'
  if (dias < 0) return 'vencido'
  if (dias <= alertaDias) return 'alerta'
  return 'ok'
}

function statusLabel(dataStr: string | undefined, alertaDias: number): { cls: string; txt: string } {
  const dias = diasAteVencer(dataStr)
  if (dias === null) return { cls: 'status-sem-data', txt: 'Sem data' }
  if (dias < 0) return { cls: 'status-vencido', txt: `Vencido há ${Math.abs(dias)} dias` }
  if (dias <= alertaDias) return { cls: 'status-alerta', txt: `Vence em ${dias} dias` }
  return { cls: 'status-ok', txt: `${dias} dias restantes` }
}

function urlDoDocumento(documentos: DocumentoSalvo[], tipo: TipoDocumento, titulo: string): string {
  const achado = documentos.find((doc) => doc.tipo === tipo && doc.titulo === titulo)
  if (achado === undefined) return ''
  return achado.temArquivo ? caminhoArquivoDocumento(achado.id) : achado.linkExterno || ''
}

// ===================== TELA =====================

function DocumentosFrota(): JSX.Element {
  const [dataAtual] = useState(() =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  )
  const [base, setBase] = useState('Raposa')
  const [catalogo, setCatalogo] = useState<CatalogoDocumentos>(CATALOGO_VAZIO)
  const [documentos, setDocumentos] = useState<DocumentoSalvo[]>([])
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [aberto, setAberto] = useState(false)
  const [nomesPdf, setNomesPdf] = useState<Record<string, string>>({})

  const pdfs = useRef<Record<string, File | undefined>>({})
  const ctxUpload = useRef<{ placa: string; tipo: TipoVeiculo }>({ placa: '', tipo: 'seguro' })
  const inputCard = useRef<HTMLInputElement>(null)

  const segPdf = useRef<HTMLInputElement>(null)
  const tacPdf = useRef<HTMLInputElement>(null)
  const crlvPdf = useRef<HTMLInputElement>(null)

  const seguradoraEl = useRef<HTMLSelectElement>(null)
  const segVencEl = useRef<HTMLInputElement>(null)
  const segEmergEl = useRef<HTMLInputElement>(null)
  const tacVencEl = useRef<HTMLInputElement>(null)
  const crlvVencEl = useRef<HTMLInputElement>(null)
  const cnhNumEl = useRef<HTMLInputElement>(null)
  const cnhCatEl = useRef<HTMLSelectElement>(null)
  const cnhVencEl = useRef<HTMLInputElement>(null)
  const cnhLinkEl = useRef<HTMLInputElement>(null)

  const docsCfg = montarDocsCfg(catalogo, documentos)

  async function carregarDocs(): Promise<void> {
    const [cat, docs] = await Promise.all([obterCatalogoDocumentos(), listarDocumentos()])
    setCatalogo(cat)
    setDocumentos(docs)
  }

  useEffect(() => {
    void (async () => {
      try {
        await carregarDocs()
      } catch (falha) {
        alert(falha instanceof Error ? falha.message : 'Não foi possível carregar os documentos.')
      }
    })()
  }, [])

  // ===================== UPLOAD DE DOCUMENTOS (CARD) =====================

  function importarDocCard(placa: string, tipo: TipoVeiculo): void {
    ctxUpload.current = { placa, tipo }
    const inp = inputCard.current
    if (inp === null) return
    inp.value = ''
    inp.click()
  }

  async function onDocCardChange(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 6 * 1024 * 1024) { alert('Arquivo muito grande (máx 6 MB).'); input.value = ''; return }
    const { placa, tipo } = ctxUpload.current
    const veiculo = catalogo.veiculos.find((v) => v.placa === placa)
    if (!veiculo) return
    const atual = docsCfg.veiculos[placa]?.[tipo]
    try {
      await enviarDocumento({
        tipo: tipo === 'seguro' ? 'apolice' : tipo,
        titulo: `${tipo === 'seguro' ? 'Apólice' : tipo.toUpperCase()} ${placa}`,
        vencimento: atual?.vencimento || null,
        veiculoId: veiculo.id,
        seguradora: tipo === 'seguro' ? docsCfg.veiculos[placa]?.seguradora || null : null,
        contatoEmergencia: tipo === 'seguro' ? docsCfg.veiculos[placa]?.emergencia || null : null,
      }, file)
      await carregarDocs()
    } catch (falha) {
      alert(falha instanceof Error ? falha.message : 'Não foi possível enviar o PDF.')
    } finally { input.value = '' }
  }

  function srcDocCard(placa: string, tipo: TipoVeiculo): string {
    return docsCfg.veiculos[placa]?.[tipo]?.link || ''
  }

  function verDocCard(placa: string, tipo: TipoVeiculo): void {
    const src = srcDocCard(placa, tipo)
    if (!src) return
    window.open(src, '_blank')
  }

  function baixarDocCard(placa: string, tipo: TipoVeiculo): void {
    const src = srcDocCard(placa, tipo)
    if (!src) return
    const nomeBase = docsCfg.veiculos[placa]?.[tipo]?.nomeArq || `${placa}-${tipo}.pdf`
    const a = document.createElement('a')
    a.href = src
    a.download = nomeBase
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function onDocFileChange(input: HTMLInputElement, tipo: string): void {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 6 * 1024 * 1024) { alert('Máx 6 MB.'); return }
    pdfs.current[tipo] = file
    setNomesPdf((antes) => ({ ...antes, [tipo]: file.name }))
  }

  // ===================== MODAIS =====================

  function abrirModalVeiculo(placa: string): void {
    // O template de antes nascia com o `<span>` do nome do PDF vazio, e era so isso que
    // apagava o "✅ arquivo.pdf" da vez anterior.
    setNomesPdf({})
    setAlvo({ tipo: 'veiculo', placa })
    setAberto(true)
  }

  function abrirModalMotorista(nome: string): void {
    setNomesPdf({})
    setAlvo({ tipo: 'motorista', nome })
    setAberto(true)
  }

  function fecharModalDoc(): void {
    setAberto(false)
  }

  async function salvarDocumentosVeiculo(placa: string): Promise<void> {
    const veiculo = catalogo.veiculos.find((v) => v.placa === placa)
    if (!veiculo) throw new Error('Veículo não encontrado.')
    const prev = docsCfg.veiculos[placa]
    const seguradora = seguradoraEl.current?.value || null
    const emergencia = segEmergEl.current?.value.trim() || null
    const itens: Array<{
      tela: TipoVeiculo
      api: TipoDocumento
      titulo: string
      vencimento: string
      arquivo: File | undefined
      seguradora?: string | null
      contatoEmergencia?: string | null
    }> = [
      { tela: 'seguro', api: 'apolice', titulo: `Apólice ${placa}`, vencimento: segVencEl.current?.value ?? '', arquivo: pdfs.current.seg, seguradora, contatoEmergencia: emergencia },
      { tela: 'tacografo', api: 'tacografo', titulo: `Tacógrafo ${placa}`, vencimento: tacVencEl.current?.value ?? '', arquivo: pdfs.current.tac },
      { tela: 'crlv', api: 'crlv', titulo: `CRLV ${placa}`, vencimento: crlvVencEl.current?.value ?? '', arquivo: pdfs.current.crlv },
    ]
    for (const item of itens) {
      const atual = prev?.[item.tela]
      const dados: EntradaDocumento = {
        tipo: item.api, titulo: item.titulo, vencimento: item.vencimento || null,
        linkExterno: atual?.linkExterno || null, veiculoId: veiculo.id,
        seguradora: item.seguradora || null, contatoEmergencia: item.contatoEmergencia || null,
      }
      if (item.arquivo) await enviarDocumento(dados, item.arquivo)
      else if (atual?.id) await atualizarDocumento(atual.id, dados)
      // O documento que ainda nao existe e nao veio com PDF caia neste buraco: a pessoa
      // digitava a data de vencimento da apolice, salvava, e nada era gravado. O `salvarCnh`
      // ja fazia certo; aqui faltava o terceiro caso. So cria quando ha o que gravar, para
      // um "Salvar" com o modal em branco nao deixar documento vazio para tras.
      else if (dados.vencimento || dados.seguradora || dados.contatoEmergencia) await salvarDadosDocumento(dados)
    }
  }

  async function salvarCnh(nome: string): Promise<void> {
    const pessoa = catalogo.colaboradores.find((p) => p.nome === nome)
    if (!pessoa) throw new Error('Motorista não encontrado.')
    const atual = docsCfg.motoristas[nome]
    const dados: EntradaDocumento = {
      tipo: 'cnh', titulo: `CNH ${nome}`,
      vencimento: cnhVencEl.current?.value || null,
      linkExterno: cnhLinkEl.current?.value.trim() || null,
      colaboradorId: pessoa.id,
      cnhNumero: cnhNumEl.current?.value.trim() || null,
      cnhCategoria: cnhCatEl.current?.value || null,
    }
    if (atual?.id) await atualizarDocumento(atual.id, dados)
    else await salvarDadosDocumento(dados)
  }

  async function salvarDoc(): Promise<void> {
    try {
      if (alvo?.tipo === 'veiculo') await salvarDocumentosVeiculo(alvo.placa)
      if (alvo?.tipo === 'motorista') await salvarCnh(alvo.nome)
      pdfs.current = {}
      await carregarDocs()
      fecharModalDoc()
    } catch (falha) {
      alert(falha instanceof Error ? falha.message : 'Não foi possível salvar os documentos.')
    }
  }

  // ===================== RESUMO =====================

  const veiculos = veiculosDaBase(base)
  const motoristas = motoristasBase(base)
  let vencidos = 0
  let alertas = 0
  let emDia = 0
  for (const pl of veiculos) {
    for (const t of ['tacografo', 'seguro', 'crlv'] as const) {
      const d = docsCfg.veiculos[pl]?.[t]
      const s = statusVencimento(d?.vencimento, t === 'tacografo' ? 30 : 60)
      if (s === 'vencido') vencidos++
      else if (s === 'alerta') alertas++
      else if (s === 'ok') emDia++
    }
  }
  for (const m of motoristas) {
    const s = statusVencimento(docsCfg.motoristas[m]?.vencimento, 60)
    if (s === 'vencido') vencidos++
    else if (s === 'alerta') alertas++
    else if (s === 'ok') emDia++
  }

  const manuais = base === 'Raposa' ? MANUAIS_RAPOSA : []
  const planos = base === 'Raposa' ? PLANOS : []

  // ===================== LINHA DE DOCUMENTO =====================

  const linhaDoc = (
    placa: string,
    tipo: TipoVeiculo,
    label: string,
    statusEl: { cls: string; txt: string },
    src: string,
    extra = '',
  ): JSX.Element => (
    <div className="doc-linha" key={tipo}>
      <div className="doc-linha-label">{label}{extra ? <span className="doc-linha-seg">{extra}</span> : null}</div>
      <div className="doc-linha-btns">
        <span className={`doc-status ${statusEl.cls}`}>{statusEl.txt}</span>
        <button className="btn-doc importar" onClick={() => importarDocCard(placa, tipo)} title="Importar PDF">📎 Importar</button>
        {src ? <button className="btn-doc tem-arquivo" onClick={() => verDocCard(placa, tipo)} title="Visualizar">📄 Ver</button> : null}
        {src ? <button className="btn-doc tem-arquivo" onClick={() => baixarDocCard(placa, tipo)} title="Baixar">⬇️ Baixar</button> : null}
      </div>
    </div>
  )

  // ===================== MODAL =====================

  const cfgAlvo = alvo?.tipo === 'veiculo' ? docsCfg.veiculos[alvo.placa] : undefined
  const cnhAlvo = alvo?.tipo === 'motorista' ? docsCfg.motoristas[alvo.nome] : undefined

  const tituloModal =
    alvo === null ? 'Editar Documento'
    : alvo.tipo === 'veiculo' ? `🚛 ${alvo.placa}`
    : `👤 CNH — ${alvo.nome.split(' ')[0]}`

  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-name"><img src="docs/logo-emvidros.svg" alt="EM Vidros" style={{ height: '56px', width: 'auto', display: 'block' }} /></div>
          <div className="brand-sub">Documentos Frota</div>
        </div>
        <div className="nav">
          <div className="nav-label">Módulos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'formulario-registro.html' }}><span className="ico">✏️</span> Registro Diário</div>
          <div className="nav-item" onClick={() => { window.location.href = 'dashboard-semanal.html' }}><span className="ico">📊</span> Dashboard</div>
          <div className="nav-item" onClick={() => { window.location.href = 'manutencao-frota.html' }}><span className="ico">🔧</span> Manutenção Frota</div>
          <div className="nav-item ativo"><span className="ico">📂</span> Documentos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'ata-reuniao.html' }}><span className="ico">📝</span> Ata de Reunião</div>
          <div className="nav-item" onClick={() => { window.location.href = 'integracao-frota.html' }}><span className="ico">🧑‍🏫</span> Integração</div>
        </div>
        <div className="sidebar-bottom">v1.0 · Ago 2026</div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div><h1>Documentos da Frota</h1><div style={{ fontSize: '.8rem', color: 'var(--txt-dim)' }} id="dataAtual">{dataAtual}</div></div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              id="filtroBase"
              style={{ border: '1.5px solid var(--border)', borderRadius: '8px', padding: '7px 12px', fontSize: '.85rem', fontFamily: 'inherit', background: 'var(--bg-card)' }}
              value={base}
              onChange={(e) => setBase(e.currentTarget.value)}
            >
              <option value="Raposa">📍 Raposa</option>
              <option value="Imperatriz">📍 Imperatriz</option>
              <option value="Belém">📍 Belém</option>
            </select>
          </div>
        </div>

        <div className="content">
          <div className="resumo-chips" id="resumoChips">
            <div className="chip chip-red"><span className="chip-num">{vencidos}</span><span className="chip-label">Vencidos</span></div>
            <div className="chip chip-yellow"><span className="chip-num">{alertas}</span><span className="chip-label">Próximos<br />do vencimento</span></div>
            <div className="chip chip-green"><span className="chip-num">{emDia}</span><span className="chip-label">Em dia</span></div>
          </div>

          <div className="secao">
            <div className="secao-titulo">📖 Manuais dos Fabricantes</div>
            <div className="manual-lista" id="listaManuals">
              {manuais.length === 0
                ? <div style={{ color: 'var(--txt-muted)', fontSize: '.85rem', padding: '8px 0' }}>Manuais não configurados para esta base ainda.</div>
                : manuais.map((m) => {
                  const url = urlDoDocumento(documentos, 'manual', m.titulo)
                  return (
                    <div className="manual-item" key={m.titulo}>
                      <div style={{ fontSize: '1.8rem' }}>📖</div>
                      <div className="manual-info">
                        <div className="manual-titulo">{m.titulo}</div>
                        <div className="manual-sub">{`${m.marca} · ${m.modelos}`}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)', marginTop: '2px' }}>{`Placas: ${m.placas}`}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a href={url} target="_blank" className="btn-sm btn-ver">📄 Visualizar</a>
                        <a href={url} download="" className="btn-sm btn-upload">⬇️ Baixar</a>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="secao">
            <div className="secao-titulo">📋 Plano de Manutenção Preventiva</div>
            <div className="docs-grid" id="gradeplantas">
              {planos.length === 0
                ? <div style={{ color: 'var(--txt-muted)', fontSize: '.85rem' }}>Nenhum plano configurado.</div>
                : planos.map((p) => {
                  const url = urlDoDocumento(documentos, 'plano_pgq', p.titulo)
                  return (
                    <div className="doc-card" key={p.titulo}>
                      <div className="doc-card-header">
                        <div className="doc-ico">📋</div>
                        <div><div className="doc-titulo">{p.titulo}</div><div className="doc-sub">{p.descricao}</div></div>
                      </div>
                      <div className="doc-actions">
                        <a href={url} target="_blank" className="btn-sm btn-ver">📄 Visualizar</a>
                        <a href={url} download="" className="btn-sm btn-upload">⬇️ Baixar</a>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="secao">
            <div className="secao-titulo">🚛 Documentos dos Veículos</div>
            <div className="docs-grid" id="gradeVeiculos">
              {veiculos.map((pl) => {
                const info = VEICULOS_INFO[pl]
                const cfg = docsCfg.veiculos[pl]
                const seguradora = cfg?.seguradora || ''
                const segEmerg = cfg?.emergencia || ''
                return (
                  <div className="doc-card" key={pl}>
                    <div className="doc-card-header">
                      <div className="doc-ico">🚛</div>
                      <div style={{ flex: '1' }}>
                        <div className="doc-titulo">{pl}</div>
                        <div className="doc-sub">{`${info?.modelo || '—'} · ${info?.ano || '—'}`}</div>
                      </div>
                      {seguradora ? <div style={{ fontSize: '.72rem', fontWeight: '700', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' }}>{seguradora}</div> : null}
                    </div>
                    {segEmerg
                      ? (
                        <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '8px', padding: '7px 10px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🚨</span>
                          <div>
                            <div style={{ fontSize: '.68rem', fontWeight: '700', textTransform: 'uppercase', color: '#854d0e' }}>Sinistro / Emergência</div>
                            <div style={{ fontSize: '.88rem', fontWeight: '700', color: '#78350f' }}>{segEmerg}</div>
                          </div>
                        </div>
                      )
                      : <div style={{ background: 'var(--bg-app)', border: '1.5px dashed var(--border)', borderRadius: '8px', padding: '6px 10px', margin: '4px 0', fontSize: '.75rem', color: 'var(--txt-muted)', cursor: 'pointer' }} onClick={() => abrirModalVeiculo(pl)}>🚨 Adicionar contato de emergência</div>}
                    <div style={{ margin: '8px 0' }}>
                      {linhaDoc(pl, 'seguro', 'Apólice de Seguro', statusLabel(cfg?.seguro?.vencimento, 60), cfg?.seguro?.link || '', seguradora)}
                      {linhaDoc(pl, 'crlv', 'CRLV', statusLabel(cfg?.crlv?.vencimento, 60), cfg?.crlv?.link || '')}
                      {linhaDoc(pl, 'tacografo', 'Tacógrafo', statusLabel(cfg?.tacografo?.vencimento, 30), cfg?.tacografo?.link || '')}
                    </div>
                    <div className="doc-actions">
                      <button className="btn-sm btn-edit" onClick={() => abrirModalVeiculo(pl)}>✏️ Vencimentos e contato</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="secao">
            <div className="secao-titulo">👤 CNH dos Motoristas</div>
            <div className="docs-grid" id="gradeMotoristas">
              {motoristas.map((m) => {
                const cnh = docsCfg.motoristas[m]
                const s = statusLabel(cnh?.vencimento, 60)
                return (
                  <div className="doc-card" key={m}>
                    <div className="doc-card-header">
                      <div className="doc-ico">👤</div>
                      <div>
                        <div className="doc-titulo">{m}</div>
                        <div className="doc-sub">{`CNH ${cnh?.categoria || '—'} · ${cnh?.numero || '—'}`}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '4px 0' }}>
                      <span className={`doc-status ${s.cls}`}>{s.txt}</span>
                      {cnh?.link ? <a href={cnh.link} target="_blank" className="btn-sm btn-ver" style={{ padding: '3px 8px' }}>📄 CNH</a> : null}
                    </div>
                    <div className="doc-actions">
                      <button className="btn-sm btn-edit" onClick={() => abrirModalMotorista(m)}>✏️ Editar</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      <input
        type="file"
        id="inputDocCard"
        accept=".pdf,image/*"
        style={{ display: 'none' }}
        ref={inputCard}
        onChange={(e) => { void onDocCardChange(e.currentTarget) }}
      />

      <div className={aberto ? 'modal-overlay aberto' : 'modal-overlay'} id="modalDoc">
        <div className="modal">
          <div className="modal-header">
            <h3 id="modalDocTitulo">{tituloModal}</h3>
            <button className="modal-close" onClick={fecharModalDoc}>✕</button>
          </div>
          <div className="modal-body" id="modalDocBody">
            {alvo === null ? null : alvo.tipo === 'veiculo' ? (
              <Fragment key="veiculo">
                <div className="modal-sec-titulo">🏢 SEGURO</div>
                <div className="form-grid-2">
                  <div className="form-group full"><label>Seguradora</label>
                    <select id="seguradora" className="inp" ref={seguradoraEl} defaultValue={cfgAlvo?.seguradora || ''}>
                      <option value="">— Selecione —</option>
                      {SEGURADORAS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Vencimento da Apólice</label><input type="date" id="segVenc" className="inp" ref={segVencEl} defaultValue={cfgAlvo?.seguro?.vencimento || ''} /></div>
                  <div className="form-group"><label>Telefone / Canal de sinistro</label><input type="text" id="segEmerg" className="inp" placeholder="Ex: 0800 726 8000 — 24h" ref={segEmergEl} defaultValue={cfgAlvo?.emergencia || ''} /></div>
                </div>
                <div className="modal-upload-row">
                  <span style={{ fontSize: '.78rem', fontWeight: '600' }}>Arquivo da Apólice</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {cfgAlvo?.seguro?.link ? <a href={cfgAlvo.seguro.link} target="_blank" className="btn-sm btn-ver" style={{ padding: '4px 10px' }}>📄 Ver atual</a> : null}
                    <button className="btn-upload-doc" onClick={() => segPdf.current?.click()}>{`📎 ${cfgAlvo?.seguro?.temArquivo ? 'Substituir' : 'Enviar PDF'}`}</button>
                    <input type="file" id="segPdf" accept=".pdf" style={{ display: 'none' }} ref={segPdf} onChange={(e) => onDocFileChange(e.currentTarget, 'seg')} />
                    <span id="segPdfNome" style={{ fontSize: '.72rem', color: 'var(--green)' }}>{nomesPdf.seg === undefined ? null : `✅ ${nomesPdf.seg}`}</span>
                  </div>
                </div>

                <div className="modal-sec-titulo" style={{ marginTop: '16px' }}>📡 TACÓGRAFO <span style={{ fontSize: '.7rem', fontWeight: '400' }}>(alerta 30 dias)</span></div>
                <div className="form-grid-2">
                  <div className="form-group"><label>Vencimento</label><input type="date" id="tacVenc" className="inp" ref={tacVencEl} defaultValue={cfgAlvo?.tacografo?.vencimento || ''} /></div>
                </div>
                <div className="modal-upload-row">
                  <span style={{ fontSize: '.78rem', fontWeight: '600' }}>Certificado do Tacógrafo</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {cfgAlvo?.tacografo?.link ? <a href={cfgAlvo.tacografo.link} target="_blank" className="btn-sm btn-ver" style={{ padding: '4px 10px' }}>📄 Ver atual</a> : null}
                    <button className="btn-upload-doc" onClick={() => tacPdf.current?.click()}>{`📎 ${cfgAlvo?.tacografo?.temArquivo ? 'Substituir' : 'Enviar PDF'}`}</button>
                    <input type="file" id="tacPdf" accept=".pdf" style={{ display: 'none' }} ref={tacPdf} onChange={(e) => onDocFileChange(e.currentTarget, 'tac')} />
                    <span id="tacPdfNome" style={{ fontSize: '.72rem', color: 'var(--green)' }}>{nomesPdf.tac === undefined ? null : `✅ ${nomesPdf.tac}`}</span>
                  </div>
                </div>

                <div className="modal-sec-titulo" style={{ marginTop: '16px' }}>📋 CRLV <span style={{ fontSize: '.7rem', fontWeight: '400' }}>(alerta 60 dias)</span></div>
                <div className="form-grid-2">
                  <div className="form-group"><label>Vencimento</label><input type="date" id="crlvVenc" className="inp" ref={crlvVencEl} defaultValue={cfgAlvo?.crlv?.vencimento || ''} /></div>
                </div>
                <div className="modal-upload-row">
                  <span style={{ fontSize: '.78rem', fontWeight: '600' }}>Arquivo do CRLV</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {cfgAlvo?.crlv?.link ? <a href={cfgAlvo.crlv.link} target="_blank" className="btn-sm btn-ver" style={{ padding: '4px 10px' }}>📄 Ver atual</a> : null}
                    <button className="btn-upload-doc" onClick={() => crlvPdf.current?.click()}>{`📎 ${cfgAlvo?.crlv?.temArquivo ? 'Substituir' : 'Enviar PDF'}`}</button>
                    <input type="file" id="crlvPdf" accept=".pdf" style={{ display: 'none' }} ref={crlvPdf} onChange={(e) => onDocFileChange(e.currentTarget, 'crlv')} />
                    <span id="crlvPdfNome" style={{ fontSize: '.72rem', color: 'var(--green)' }}>{nomesPdf.crlv === undefined ? null : `✅ ${nomesPdf.crlv}`}</span>
                  </div>
                </div>
              </Fragment>
            ) : (
              <div key="motorista" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group"><label>Nº da CNH</label><input type="text" id="cnhNum" ref={cnhNumEl} defaultValue={cnhAlvo?.numero || ''} /></div>
                <div className="form-group"><label>Categoria</label><select id="cnhCat" ref={cnhCatEl} defaultValue={cnhAlvo?.categoria || ''}><option value="">—</option>{CATEGORIAS_CNH.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-group"><label>Vencimento</label><input type="date" id="cnhVenc" ref={cnhVencEl} defaultValue={cnhAlvo?.vencimento || ''} /></div>
                <div className="form-group"><label>Link Google Drive</label><input type="url" id="cnhLink" placeholder="https://..." ref={cnhLinkEl} defaultValue={cnhAlvo?.link || ''} /></div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-cancelar" onClick={fecharModalDoc}>Cancelar</button>
            <button className="btn-salvar" onClick={() => void salvarDoc()}>💾 Salvar</button>
          </div>
        </div>
      </div>
    </>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<DocumentosFrota />)
