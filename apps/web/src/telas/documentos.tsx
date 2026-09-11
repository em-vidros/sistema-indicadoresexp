/**
 * Documentos da frota. O artboard e o `Documentos` de `var/design-dashboard/build.mjs`.
 *
 * A tela velha desenhava um cartao por veiculo e um por motorista, e cada cartao repetia
 * as tres linhas de vencimento. O artboard troca os cartoes por duas tabelas, e a troca
 * muda o que da para ver: com uma linha por veiculo, as sete apolices ficam na mesma
 * coluna e a que vence antes salta aos olhos. O que era botao dentro do cartao virou uma
 * coisa so por celula, o envio rapido do PDF, e o resto foi para o dialogo de edicao.
 *
 * O vencimento e a unica regra de dominio aqui, e ela e uma tabela: cada documento tem a
 * sua janela de alerta (tacografo 30 dias, apolice e CRLV 60, CNH 60), e `PENDENCIAS`
 * transforma base, veiculos e motoristas numa lista chapada de vencimentos. O resumo do
 * topo, a cor da data e o selo da linha saem todos dessa lista, e nao de tres contagens
 * paralelas que podem discordar entre si.
 *
 * As listas de veiculo, motorista e base vem de `GET /api/cadastro`, e nao dos literais
 * que a tela velha carregava: o servidor ja recorta o cadastro pelas bases do usuario,
 * entao quem so ve Raposa nao recebe placa de Imperatriz para filtrar no navegador.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { invalidar, useRecurso } from '../app/dados.ts'
import {
  Campo,
  CampoDeArquivo,
  Chips,
  Dialogo,
  GradeDeCampos,
  LinhaDeArquivo,
  TituloDeSecao,
  useAvisos,
} from '../geist/formulario.tsx'
import { CloudUpload, Download, FileText, Icone, Information, PencilEdit } from '../geist/icones.tsx'
import { ComPrevia } from '../geist/previa.tsx'
import type { Previa } from '../geist/previa.tsx'
import {
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  COR_DO_TOM,
  Esqueleto,
  Estatistica,
  Grade,
  Tabela,
  Td,
  Th,
  Vazio,
  classes,
} from '../geist/primitivos.tsx'
import type { Celula, Opcao, Tom } from '../geist/primitivos.tsx'
import { obterCadastro } from '../js/cadastro-api.ts'
import type { CatalogoCadastro, ColaboradorCadastro, VeiculoCadastro } from '../js/cadastro-api.ts'
import {
  atualizarDocumento,
  caminhoArquivoDocumento,
  enviarDocumento,
  listarDocumentos,
  salvarDadosDocumento,
} from '../js/documentos-api.ts'
import type { DocumentoSalvo, EntradaDocumento } from '../js/documentos-api.ts'

/** O teto do upload, o mesmo da tela velha e o mesmo que o servidor recusa. */
const LIMITE_DO_PDF = 6 * 1024 * 1024

type TipoDeVeiculo = 'apolice' | 'crlv' | 'tacografo'

/**
 * Os tres documentos de um veiculo, na ordem em que a tabela os mostra. `alerta` e a
 * janela em que o vencimento deixa de ser "em dia": o tacografo avisa antes porque a
 * recalibracao depende de agenda de oficina.
 */
const DOCUMENTOS_DO_VEICULO = [
  { chave: 'crlv', rotulo: 'CRLV', alerta: 60 },
  { chave: 'apolice', rotulo: 'Apólice', alerta: 60 },
  { chave: 'tacografo', rotulo: 'Tacógrafo', alerta: 30 },
] as const satisfies readonly { chave: TipoDeVeiculo; rotulo: string; alerta: number }[]

const ALERTA_DA_CNH = 60

const SEGURADORAS = [
  'Bradesco',
  'MAPFRE',
  'Porto Seguro',
  'Allianz',
  'Tokio Marine',
  'Zurich',
  'Sompo',
  'HDI',
  'Outra',
] as const

const CATEGORIAS_DE_CNH = ['A', 'AB', 'AC', 'AD', 'AE', 'B', 'C', 'D', 'E'] as const

function opcoesDe(valores: readonly string[]): readonly Opcao[] {
  return valores.map((valor) => ({ valor, rotulo: valor }))
}

/**
 * Os arquivos fixos da base Raposa. `titulo` e a chave com que eles estao gravados no
 * banco e nao pode mudar sem migracao; `rotulo` e o que a tela mostra.
 */
const ARQUIVOS_FIXOS = [
  {
    titulo: 'PGQ MAN — Programa de Manutenção Preventiva 2026',
    rotulo: 'PGQ MAN · Programa de manutenção preventiva 2026',
    subtitulo: 'Cronograma anual assinado · todos os veículos Raposa',
  },
  {
    titulo: 'Manual ATEGO 2429 / 3030 CE',
    rotulo: 'Manual ATEGO 2429 / 3030 CE',
    subtitulo: 'Mercedes-Benz · SM02J13, SMP6F86, SMW0B96, PTV0006',
  },
  {
    titulo: 'Manual ACCELO 1316 (Euro V)',
    rotulo: 'Manual ACCELO 1316 (Euro V)',
    subtitulo: 'Mercedes-Benz · PTT0004',
  },
  {
    titulo: 'Manual ACCELO 1017 (Euro VI)',
    rotulo: 'Manual ACCELO 1017 (Euro VI)',
    subtitulo: 'Mercedes-Benz · SMQ2I80',
  },
  {
    titulo: 'Manual 26.260 CRM 6x2',
    rotulo: 'Manual 26.260 CRM 6x2',
    subtitulo: 'Volkswagen · ROW3A87',
  },
] as const

/** A base que tem manual e plano cadastrados. As outras duas ainda nao mandaram os PDFs. */
const BASE_COM_ARQUIVOS_FIXOS = 'Raposa'

// ---------- vencimento ----------

type Faixa = 'sem-data' | 'vencido' | 'alerta' | 'ok'

const TOM_DA_FAIXA: Readonly<Record<Faixa, Tom | null>> = {
  'sem-data': null,
  vencido: 'critico',
  alerta: 'atencao',
  ok: 'ok',
}

const CLASSE_DA_FAIXA: Readonly<Record<Faixa, string | null>> = {
  'sem-data': 'g-fraco',
  vencido: 'g-tom-critico',
  alerta: 'g-tom-atencao',
  ok: null,
}

/** A pior faixa na frente: e ela que a linha veste. */
const GRAVIDADE: readonly Faixa[] = ['vencido', 'alerta', 'sem-data', 'ok']

function diasAteVencer(data: string): number | null {
  if (data === '') return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${data}T00:00:00`).getTime() - hoje.getTime()) / 86_400_000)
}

function faixaDe(data: string, alerta: number): Faixa {
  const dias = diasAteVencer(data)
  if (dias === null) return 'sem-data'
  if (dias < 0) return 'vencido'
  if (dias <= alerta) return 'alerta'
  return 'ok'
}

function rotuloDaFaixa(data: string, alerta: number): string {
  const dias = diasAteVencer(data)
  if (dias === null) return 'Sem data'
  if (dias < 0) return `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'Vence hoje'
  if (dias <= alerta) return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return 'Em dia'
}

function dataBr(data: string): string {
  if (data === '') return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function pior(faixas: readonly Faixa[]): Faixa {
  return GRAVIDADE.find((faixa) => faixas.includes(faixa)) ?? 'ok'
}

function Selo({ data, alerta }: { readonly data: string; readonly alerta: number }): JSX.Element {
  const tom = TOM_DA_FAIXA[faixaDe(data, alerta)]
  return <Badge rotulo={rotuloDaFaixa(data, alerta)} cor={tom === null ? 'cinza' : COR_DO_TOM[tom]} />
}

// ---------- o que a API guardou, na forma em que a tela le ----------

type Arquivo = {
  readonly id: string
  readonly vencimento: string
  readonly linkExterno: string
  readonly nomeArquivo: string
  readonly temArquivo: boolean
}

type DocsDoVeiculo = {
  readonly apolice: Arquivo | null
  readonly crlv: Arquivo | null
  readonly tacografo: Arquivo | null
  readonly seguradora: string
  readonly emergencia: string
}

type Cnh = Arquivo & { readonly numero: string; readonly categoria: string }

const VEICULO_SEM_DOCUMENTO: DocsDoVeiculo = {
  apolice: null,
  crlv: null,
  tacografo: null,
  seguradora: '',
  emergencia: '',
}

type Indice = {
  readonly veiculos: ReadonlyMap<string, DocsDoVeiculo>
  readonly cnhs: ReadonlyMap<string, Cnh>
  /** Manual e plano, achados pelo titulo com que foram gravados. */
  readonly fixos: ReadonlyMap<string, Arquivo>
}

function arquivoDe(doc: DocumentoSalvo): Arquivo {
  return {
    id: doc.id,
    vencimento: doc.vencimento ?? '',
    linkExterno: doc.linkExterno ?? '',
    nomeArquivo: doc.nomeArquivo ?? '',
    temArquivo: doc.temArquivo,
  }
}

function enderecoDe(arquivo: Arquivo | null): string {
  if (arquivo === null) return ''
  return arquivo.temArquivo ? caminhoArquivoDocumento(arquivo.id) : arquivo.linkExterno
}

/** A mesma divisao que o zod do servidor faz em `LINK_ABSOLUTO` e `CAMINHO_RELATIVO`. */
const OUTRA_ORIGEM = /^https?:\/\//

/**
 * `enderecoDe` devolve uma string so, e a previa precisa dos dois lados que ela colapsa:
 * o endereco e se aquele endereco entra num iframe.
 */
function previaDe(arquivo: Arquivo | null, titulo: string, subtitulo?: string): Previa | null {
  if (arquivo === null || enderecoDe(arquivo) === '') return null
  const legenda = subtitulo ?? arquivo.nomeArquivo
  const rotulos = { titulo, ...(legenda === '' ? {} : { subtitulo: legenda }) }
  if (arquivo.temArquivo) {
    return { tipo: 'pdf', endereco: caminhoArquivoDocumento(arquivo.id), ...rotulos }
  }
  const link = arquivo.linkExterno
  if (OUTRA_ORIGEM.test(link)) return { tipo: 'link', endereco: link, ...rotulos }
  // Sem a barra na frente o navegador resolve o caminho a partir da rota atual da SPA,
  // e isso so acerta enquanto a rota tem um segmento so.
  const caminho = link.startsWith('/') ? link : `/${link}`
  // A rota `/docs/*` so serve `.pdf` e `.svg`, e o iframe nao tem o que fazer com um
  // 404: o esqueleto ficaria girando para sempre porque `onLoad` nunca resolve.
  return { tipo: caminho.toLowerCase().endsWith('.pdf') ? 'pdf' : 'link', endereco: caminho, ...rotulos }
}

function indexar(documentos: readonly DocumentoSalvo[]): Indice {
  const veiculos = new Map<string, DocsDoVeiculo>()
  const cnhs = new Map<string, Cnh>()
  const fixos = new Map<string, Arquivo>()
  for (const doc of documentos) {
    if (doc.tipo === 'manual' || doc.tipo === 'plano_pgq') {
      if (doc.titulo !== null && doc.titulo !== '') fixos.set(doc.titulo, arquivoDe(doc))
      continue
    }
    if (doc.tipo === 'cnh' && doc.colaboradorId !== null) {
      cnhs.set(doc.colaboradorId, {
        ...arquivoDe(doc),
        numero: doc.cnhNumero ?? '',
        categoria: doc.cnhCategoria ?? '',
      })
      continue
    }
    if (doc.veiculoId === null) continue
    const atual = veiculos.get(doc.veiculoId) ?? VEICULO_SEM_DOCUMENTO
    veiculos.set(doc.veiculoId, {
      ...atual,
      [doc.tipo]: arquivoDe(doc),
      seguradora: doc.tipo === 'apolice' ? doc.seguradora ?? '' : atual.seguradora,
      emergencia: doc.tipo === 'apolice' ? doc.contatoEmergencia ?? '' : atual.emergencia,
    })
  }
  return { veiculos, cnhs, fixos }
}

// ---------- resumo ----------

type Pendencia = { readonly faixa: Faixa; readonly descricao: string }

function pendenciasDe(
  veiculos: readonly VeiculoCadastro[],
  motoristas: readonly ColaboradorCadastro[],
  indice: Indice,
): readonly Pendencia[] {
  const doVeiculo = veiculos.flatMap((veiculo) => {
    const docs = indice.veiculos.get(veiculo.id) ?? VEICULO_SEM_DOCUMENTO
    return DOCUMENTOS_DO_VEICULO.map(({ chave, rotulo, alerta }) => ({
      faixa: faixaDe(docs[chave]?.vencimento ?? '', alerta),
      descricao: `${rotulo.toLowerCase()} ${veiculo.placa}`,
    }))
  })
  const doMotorista = motoristas.map((pessoa) => ({
    faixa: faixaDe(indice.cnhs.get(pessoa.id)?.vencimento ?? '', ALERTA_DA_CNH),
    descricao: `CNH de ${pessoa.nome.split(' ')[0]}`,
  }))
  return [...doVeiculo, ...doMotorista]
}

function contar(pendencias: readonly Pendencia[], faixa: Faixa): number {
  return pendencias.filter((p) => p.faixa === faixa).length
}

/** Os dois primeiros vencidos por extenso, que e o que cabe embaixo do numero. */
function citarVencidos(pendencias: readonly Pendencia[]): string {
  const vencidos = pendencias.filter((p) => p.faixa === 'vencido').map((p) => p.descricao)
  if (vencidos.length === 0) return 'nada vencido nesta base'
  if (vencidos.length <= 2) return vencidos.join(' e ')
  return `${vencidos.slice(0, 2).join(', ')} e mais ${vencidos.length - 2}`
}

// ---------- envio e download ----------

function baixar(endereco: string, nome: string): void {
  const elo = document.createElement('a')
  elo.href = endereco
  elo.download = nome
  document.body.appendChild(elo)
  elo.click()
  document.body.removeChild(elo)
}

/** O botao quadrado que abre o seletor de arquivo da propria celula. */
function BotaoDeEnvio({ nome, aoEscolher }: {
  readonly nome: string
  readonly aoEscolher: (arquivo: File) => void
}): JSX.Element {
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <>
      <Botao antes={CloudUpload} nome={nome} aoClicar={() => entrada.current?.click()} />
      <input
        ref={entrada}
        className="g-escondido"
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const escolhido = e.currentTarget.files?.[0]
          // Zerar o campo deixa a pessoa reenviar o mesmo arquivo depois de uma recusa.
          e.currentTarget.value = ''
          if (escolhido !== undefined) aoEscolher(escolhido)
        }}
      />
    </>
  )
}

// ---------- formulario do dialogo ----------

type FormularioDeVeiculo = {
  readonly seguradora: string
  readonly emergencia: string
  readonly vencimentos: Readonly<Record<TipoDeVeiculo, string>>
  readonly arquivos: Readonly<Partial<Record<TipoDeVeiculo, File>>>
}

type FormularioDeCnh = {
  readonly numero: string
  readonly categoria: string
  readonly vencimento: string
  readonly link: string
  readonly arquivo?: File
}

type Edicao =
  | { readonly tipo: 'veiculo'; readonly veiculo: VeiculoCadastro; readonly form: FormularioDeVeiculo }
  | { readonly tipo: 'cnh'; readonly pessoa: ColaboradorCadastro; readonly form: FormularioDeCnh }

function formularioDoVeiculo(docs: DocsDoVeiculo): FormularioDeVeiculo {
  return {
    seguradora: docs.seguradora,
    emergencia: docs.emergencia,
    vencimentos: {
      apolice: docs.apolice?.vencimento ?? '',
      crlv: docs.crlv?.vencimento ?? '',
      tacografo: docs.tacografo?.vencimento ?? '',
    },
    arquivos: {},
  }
}

function formularioDaCnh(cnh: Cnh | undefined): FormularioDeCnh {
  return {
    numero: cnh?.numero ?? '',
    categoria: cnh?.categoria ?? '',
    vencimento: cnh?.vencimento ?? '',
    link: cnh?.linkExterno ?? '',
  }
}

/**
 * A base que a tela abre quando ninguem escolheu: a que tem mais documento cadastrado.
 * Quem so enxerga uma base cai nela de qualquer jeito; para quem enxerga as tres, abrir
 * na que esta vazia seria abrir numa tela sem nada para ler. Empate fica com a primeira.
 */
function basePadrao(catalogo: CatalogoCadastro, indice: Indice): string {
  const peso = (baseId: string): number =>
    catalogo.veiculos.filter((v) => v.baseId === baseId && indice.veiculos.has(v.id)).length
    + catalogo.colaboradores.filter((p) => p.baseId === baseId && indice.cnhs.has(p.id)).length
  return [...catalogo.bases].sort((a, b) => peso(b.id) - peso(a.id))[0]?.id ?? ''
}

// ---------- tela ----------

export default function Documentos(): JSX.Element {
  const { avisar } = useAvisos()
  const cadastro = useRecurso('cadastro', () => obterCadastro())
  const documentos = useRecurso('documentos', () => listarDocumentos())
  const [baseEscolhida, setBaseEscolhida] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [salvando, setSalvando] = useState(false)

  const falhou = cadastro.estado === 'erro' || documentos.estado === 'erro'
  useEffect(() => {
    if (falhou) avisar('Não foi possível atualizar os documentos. O que está na tela é o último que chegou.', 'erro')
  }, [falhou])

  if (cadastro.dados === null || documentos.dados === null) return <Esqueleto />

  const catalogo: CatalogoCadastro = cadastro.dados
  const indice = indexar(documentos.dados)
  const bases = catalogo.bases
  const baseId = baseEscolhida ?? basePadrao(catalogo, indice)
  const base = bases.find((b) => b.id === baseId)
  const veiculos = catalogo.veiculos.filter((v) => v.baseId === baseId)
  const motoristas = catalogo.colaboradores.filter((p) => p.baseId === baseId && p.funcao === 'motorista')
  const pendencias = pendenciasDe(veiculos, motoristas, indice)

  const recarregar = (): void => {
    invalidar('documentos')
  }

  const relatar = (falha: unknown, padrao: string): void => {
    avisar(falha instanceof Error ? falha.message : padrao, 'erro')
  }

  const enviarDoVeiculo = async (veiculo: VeiculoCadastro, chave: TipoDeVeiculo, arquivo: File): Promise<void> => {
    if (arquivo.size > LIMITE_DO_PDF) {
      avisar('O arquivo passa de 6 MB.', 'erro')
      return
    }
    const docs = indice.veiculos.get(veiculo.id) ?? VEICULO_SEM_DOCUMENTO
    const { rotulo } = DOCUMENTOS_DO_VEICULO.find((d) => d.chave === chave) ?? DOCUMENTOS_DO_VEICULO[0]
    try {
      await enviarDocumento({
        tipo: chave,
        titulo: `${rotulo} ${veiculo.placa}`,
        vencimento: docs[chave]?.vencimento ?? null,
        linkExterno: docs[chave]?.linkExterno ?? null,
        veiculoId: veiculo.id,
        seguradora: chave === 'apolice' ? docs.seguradora || null : null,
        contatoEmergencia: chave === 'apolice' ? docs.emergencia || null : null,
      }, arquivo)
      recarregar()
      avisar(`${rotulo} ${veiculo.placa}: PDF salvo.`)
    } catch (falha) {
      relatar(falha, 'Não foi possível enviar o arquivo.')
    }
  }

  const enviarCnh = async (pessoa: ColaboradorCadastro, arquivo: File): Promise<void> => {
    if (arquivo.size > LIMITE_DO_PDF) {
      avisar('O arquivo passa de 6 MB.', 'erro')
      return
    }
    const cnh = indice.cnhs.get(pessoa.id)
    try {
      await enviarDocumento({
        tipo: 'cnh',
        titulo: `CNH ${pessoa.nome}`,
        vencimento: cnh?.vencimento ?? null,
        linkExterno: cnh?.linkExterno ?? null,
        colaboradorId: pessoa.id,
        cnhNumero: cnh?.numero ?? null,
        cnhCategoria: cnh?.categoria ?? null,
      }, arquivo)
      recarregar()
      avisar(`CNH de ${pessoa.nome.split(' ')[0]}: PDF salvo.`)
    } catch (falha) {
      relatar(falha, 'Não foi possível enviar o arquivo.')
    }
  }

  const salvarVeiculo = async (veiculo: VeiculoCadastro, form: FormularioDeVeiculo): Promise<boolean> => {
    const docs = indice.veiculos.get(veiculo.id) ?? VEICULO_SEM_DOCUMENTO
    const gravaveis = DOCUMENTOS_DO_VEICULO.map(({ chave, rotulo }) => {
      const atual = docs[chave]
      const dados: EntradaDocumento = {
        tipo: chave,
        titulo: `${rotulo} ${veiculo.placa}`,
        vencimento: form.vencimentos[chave] || null,
        linkExterno: atual?.linkExterno || null,
        veiculoId: veiculo.id,
        seguradora: chave === 'apolice' ? form.seguradora || null : null,
        contatoEmergencia: chave === 'apolice' ? form.emergencia.trim() || null : null,
      }
      // Documento que ainda nao existe so nasce quando ha o que gravar nele; senao um
      // "Salvar" com o dialogo em branco deixaria tres documentos vazios para tras.
      const temDado = dados.vencimento !== null || dados.seguradora !== null || dados.contatoEmergencia !== null
      return { rotulo, atual, dados, arquivo: form.arquivos[chave], temDado }
    })

    const semArquivo = gravaveis.filter((g) => g.atual === null && g.arquivo === undefined && g.temDado)
    if (semArquivo.length > 0) {
      avisar(`Anexe o PDF de ${semArquivo.map((g) => g.rotulo).join(' e ')}: documento que ainda não existe não é gravado só com a data.`, 'erro')
      return false
    }

    for (const { atual, dados, arquivo, temDado } of gravaveis) {
      if (arquivo !== undefined) await enviarDocumento(dados, arquivo)
      else if (atual !== null) await atualizarDocumento(atual.id, dados)
      else if (temDado) await salvarDadosDocumento(dados)
    }
    return true
  }

  const salvarCnh = async (pessoa: ColaboradorCadastro, form: FormularioDeCnh): Promise<boolean> => {
    const atual = indice.cnhs.get(pessoa.id)
    const dados: EntradaDocumento = {
      tipo: 'cnh',
      titulo: `CNH ${pessoa.nome}`,
      vencimento: form.vencimento || null,
      linkExterno: form.link.trim() || null,
      colaboradorId: pessoa.id,
      cnhNumero: form.numero.trim() || null,
      cnhCategoria: form.categoria || null,
    }
    if (form.arquivo !== undefined) await enviarDocumento(dados, form.arquivo)
    else if (atual !== undefined) await atualizarDocumento(atual.id, dados)
    else if (dados.linkExterno !== null) await salvarDadosDocumento(dados)
    else {
      avisar('Anexe a CNH em PDF ou informe o link: o servidor não guarda um documento sem nenhum dos dois.', 'erro')
      return false
    }
    return true
  }

  const salvar = async (): Promise<void> => {
    if (edicao === null) return
    setSalvando(true)
    try {
      const gravou = edicao.tipo === 'veiculo'
        ? await salvarVeiculo(edicao.veiculo, edicao.form)
        : await salvarCnh(edicao.pessoa, edicao.form)
      if (!gravou) return
      recarregar()
      avisar('Documentos salvos.')
      setEdicao(null)
    } catch (falha) {
      relatar(falha, 'Não foi possível salvar os documentos.')
    } finally {
      setSalvando(false)
    }
  }

  const celulaDoDocumento = (veiculo: VeiculoCadastro, chave: TipoDeVeiculo, rotulo: string, alerta: number): JSX.Element => {
    const arquivo = (indice.veiculos.get(veiculo.id) ?? VEICULO_SEM_DOCUMENTO)[chave]
    const data = arquivo?.vencimento ?? ''
    const classe = CLASSE_DA_FAIXA[faixaDe(data, alerta)]
    const previa = previaDe(arquivo, `${rotulo} · ${veiculo.placa}`)
    return (
      <div className="g-doc-celula">
        <ComPrevia previa={previa}>
          {previa === null ? null : <Icone de={FileText} tamanho={12} />}
          <span className={classes('g-l13m', classe, data !== '' && classe !== null && 'g-forte')}>
            {data === '' ? '·' : dataBr(data)}
          </span>
        </ComPrevia>
        <BotaoDeEnvio
          nome={`Enviar ${rotulo} de ${veiculo.placa}`}
          aoEscolher={(arq) => void enviarDoVeiculo(veiculo, chave, arq)}
        />
      </div>
    )
  }

  const tabelaDeVeiculos = (
    <>
      <CabecalhoDeBloco titulo="Documentos dos veículos" subtitulo="CRLV, apólice e certificado de tacógrafo" />
      <Tabela
        cabecalho={
          <>
            <Th>Placa</Th>
            <Th>Modelo</Th>
            {DOCUMENTOS_DO_VEICULO.map((d) => <Th key={d.chave} direita>{d.rotulo}</Th>)}
            <Th>Seguradora</Th>
            <Th>Status</Th>
            <Th><span className="g-escondido">Ações</span></Th>
          </>
        }
      >
        {veiculos.length === 0
          ? <tr><Td colunas={8} vazio>Nenhum veículo nesta base</Td></tr>
          : veiculos.map((veiculo) => {
            const docs = indice.veiculos.get(veiculo.id) ?? VEICULO_SEM_DOCUMENTO
            const faixas = DOCUMENTOS_DO_VEICULO.map((d) => faixaDe(docs[d.chave]?.vencimento ?? '', d.alerta))
            const critico = DOCUMENTOS_DO_VEICULO[faixas.indexOf(pior(faixas))] ?? DOCUMENTOS_DO_VEICULO[0]
            return (
              <tr key={veiculo.id}>
                <Td><span className="g-l13m g-forte">{veiculo.placa}</span></Td>
                <Td><span className="g-fraco">{veiculo.modelo ?? '·'}</span></Td>
                {DOCUMENTOS_DO_VEICULO.map((d) => (
                  <Td key={d.chave} direita>{celulaDoDocumento(veiculo, d.chave, d.rotulo, d.alerta)}</Td>
                ))}
                <Td>{docs.seguradora === '' ? <span className="g-fraco">·</span> : docs.seguradora}</Td>
                <Td><Selo data={docs[critico.chave]?.vencimento ?? ''} alerta={critico.alerta} /></Td>
                <Td direita>
                  <Botao
                    antes={PencilEdit}
                    nome={`Editar documentos de ${veiculo.placa}`}
                    aoClicar={() => setEdicao({ tipo: 'veiculo', veiculo, form: formularioDoVeiculo(docs) })}
                  />
                </Td>
              </tr>
            )
          })}
      </Tabela>
    </>
  )

  const tabelaDeCnhs = (
    <>
      <CabecalhoDeBloco titulo="CNH dos motoristas" subtitulo="Número, categoria e vencimento" />
      <Tabela
        cabecalho={
          <>
            <Th>Motorista</Th>
            <Th direita>Número da CNH</Th>
            <Th>Cat.</Th>
            <Th direita>Vencimento</Th>
            <Th>Status</Th>
            <Th><span className="g-escondido">Ações</span></Th>
          </>
        }
      >
        {motoristas.length === 0
          ? <tr><Td colunas={6} vazio>Nenhum motorista nesta base</Td></tr>
          : motoristas.map((pessoa) => {
            const cnh = indice.cnhs.get(pessoa.id)
            const data = cnh?.vencimento ?? ''
            const classe = CLASSE_DA_FAIXA[faixaDe(data, ALERTA_DA_CNH)]
            const previa = previaDe(cnh ?? null, `CNH · ${pessoa.nome}`)
            return (
              <tr key={pessoa.id}>
                <Td><span className="g-forte">{pessoa.nome}</span></Td>
                <Td direita>{cnh?.numero === undefined || cnh.numero === '' ? <span className="g-fraco">·</span> : cnh.numero}</Td>
                <Td>{cnh?.categoria === undefined || cnh.categoria === '' ? <span className="g-fraco">·</span> : cnh.categoria}</Td>
                <Td direita>
                  <div className="g-doc-celula">
                    <ComPrevia previa={previa}>
                      {previa === null ? null : <Icone de={FileText} tamanho={12} />}
                      <span className={classes('g-l13m', classe, data !== '' && classe !== null && 'g-forte')}>
                        {data === '' ? '·' : dataBr(data)}
                      </span>
                    </ComPrevia>
                    <BotaoDeEnvio
                      nome={`Enviar CNH de ${pessoa.nome}`}
                      aoEscolher={(arq) => void enviarCnh(pessoa, arq)}
                    />
                  </div>
                </Td>
                <Td><Selo data={data} alerta={ALERTA_DA_CNH} /></Td>
                <Td direita>
                  <Botao
                    antes={PencilEdit}
                    nome={`Editar CNH de ${pessoa.nome}`}
                    aoClicar={() => setEdicao({ tipo: 'cnh', pessoa, form: formularioDaCnh(cnh) })}
                  />
                </Td>
              </tr>
            )
          })}
      </Tabela>
    </>
  )

  const temArquivosFixos = base?.nome === BASE_COM_ARQUIVOS_FIXOS
  const emergencias = [...new Set(veiculos
    .map((v) => indice.veiculos.get(v.id)?.emergencia ?? '')
    .filter((contato) => contato !== ''))]

  const blocoDeArquivos = (
    <>
      <CabecalhoDeBloco titulo="Manuais e planos" subtitulo="Arquivos fixos, iguais para toda a base" />
      {temArquivosFixos
        ? (
          <div className="g-arqs">
            {ARQUIVOS_FIXOS.map((fixo) => {
              const arquivo = indice.fixos.get(fixo.titulo) ?? null
              const endereco = enderecoDe(arquivo)
              return (
                <ComPrevia key={fixo.titulo} previa={previaDe(arquivo, fixo.rotulo, fixo.subtitulo)}>
                  <LinhaDeArquivo
                    titulo={fixo.rotulo}
                    subtitulo={fixo.subtitulo}
                    aoAbrir={() => {
                      if (endereco === '') avisar('Este arquivo ainda não foi enviado.', 'erro')
                      else window.open(endereco, '_blank')
                    }}
                  />
                </ComPrevia>
              )
            })}
          </div>
        )
        : (
          <Vazio
            icone={FileText}
            titulo="Sem arquivos fixos nesta base"
            texto="Manual de fabricante e plano de manutenção estão cadastrados só na base Raposa."
          />
        )}
      <div className="g-doc-rodape">
        <Icone de={Information} />
        <span className="g-l13">
          {emergencias.length === 0
            ? 'Nenhum canal de sinistro cadastrado nas apólices desta base.'
            : `Sinistro ou emergência: ${emergencias.join(' · ')}`}
        </span>
      </div>
    </>
  )

  const celulas: readonly Celula[] = [
    {
      col: [1, 5],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Em dia"
          valor={String(contar(pendencias, 'ok'))}
          apoio={contar(pendencias, 'sem-data') === 0
            ? 'todo documento desta base tem data'
            : `${contar(pendencias, 'sem-data')} ainda sem data de vencimento`}
        />
      ),
    },
    {
      col: [5, 9],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Próximos"
          valor={String(contar(pendencias, 'alerta'))}
          apoio="tacógrafo avisa 30 dias antes, os outros 60"
        />
      ),
    },
    {
      col: [9, 13],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Vencidos"
          valor={String(contar(pendencias, 'vencido'))}
          apoio={citarVencidos(pendencias)}
        />
      ),
    },
    { col: [1, 13], linha: 2, rente: true, conteudo: tabelaDeVeiculos },
    { col: [1, 13], linha: 3, rente: true, conteudo: tabelaDeCnhs },
    { col: [1, 13], linha: 4, rente: true, conteudo: blocoDeArquivos },
  ]

  return (
    <>
      <CabecalhoDePagina
        titulo="Documentos da frota"
        subtitulo={`${veiculos.length} ${veiculos.length === 1 ? 'veículo' : 'veículos'} · ${motoristas.length} ${motoristas.length === 1 ? 'motorista' : 'motoristas'} · Base ${base?.nome ?? '·'}`}
        acoes={
          <Chips
            valor={baseId}
            opcoes={bases.map((b) => ({ valor: b.id, rotulo: b.nome }))}
            aoEscolher={setBaseEscolhida}
          />
        }
      />
      <Grade celulas={celulas} />
      <DialogoDeEdicao
        edicao={edicao}
        indice={indice}
        salvando={salvando}
        aoMudar={setEdicao}
        aoFechar={() => setEdicao(null)}
        aoSalvar={() => void salvar()}
      />
    </>
  )
}

// ---------- dialogo ----------

function DialogoDeEdicao({ edicao, indice, salvando, aoMudar, aoFechar, aoSalvar }: {
  readonly edicao: Edicao | null
  readonly indice: Indice
  readonly salvando: boolean
  readonly aoMudar: (edicao: Edicao) => void
  readonly aoFechar: () => void
  readonly aoSalvar: () => void
}): JSX.Element {
  const acoes = (
    <>
      <Botao rotulo="Cancelar" tipo="terciario" aoClicar={aoFechar} />
      <Botao rotulo="Salvar" tipo="primario" tamanho="medio" carregando={salvando} aoClicar={aoSalvar} />
    </>
  )
  return (
    <Dialogo
      aberto={edicao !== null}
      titulo={edicao === null ? 'Documentos' : edicao.tipo === 'veiculo' ? edicao.veiculo.placa : edicao.pessoa.nome}
      subtitulo={edicao === null
        ? ''
        : edicao.tipo === 'veiculo'
          ? `${edicao.veiculo.modelo ?? 'Sem modelo'} · ${edicao.veiculo.base}`
          : 'Carteira nacional de habilitação'}
      largura={edicao?.tipo === 'cnh' ? 560 : 640}
      aoFechar={aoFechar}
      acoes={acoes}
    >
      {edicao === null
        ? null
        : edicao.tipo === 'veiculo'
          ? <CamposDoVeiculo edicao={edicao} indice={indice} aoMudar={aoMudar} />
          : <CamposDaCnh edicao={edicao} indice={indice} aoMudar={aoMudar} />}
    </Dialogo>
  )
}

/** Os dois botoes que so existem quando o documento ja tem arquivo ou link. */
function AcoesDoArquivo({ arquivo, titulo, nomeReserva }: {
  readonly arquivo: Arquivo | null
  readonly titulo: string
  readonly nomeReserva: string
}): JSX.Element | null {
  const endereco = enderecoDe(arquivo)
  if (endereco === '') return null
  const nome = arquivo?.nomeArquivo === undefined || arquivo.nomeArquivo === '' ? nomeReserva : arquivo.nomeArquivo
  return (
    <div className="g-rodape-acoes">
      <ComPrevia previa={previaDe(arquivo, titulo)}>
        <Botao rotulo="Ver" antes={FileText} aoClicar={() => window.open(endereco, '_blank')} />
      </ComPrevia>
      <Botao rotulo="Baixar" antes={Download} aoClicar={() => baixar(endereco, nome)} />
    </div>
  )
}

function CamposDoVeiculo({ edicao, indice, aoMudar }: {
  readonly edicao: Extract<Edicao, { tipo: 'veiculo' }>
  readonly indice: Indice
  readonly aoMudar: (edicao: Edicao) => void
}): JSX.Element {
  const { veiculo, form } = edicao
  const docs = indice.veiculos.get(veiculo.id) ?? VEICULO_SEM_DOCUMENTO
  const mudar = (mudanca: Partial<FormularioDeVeiculo>): void => {
    aoMudar({ ...edicao, form: { ...form, ...mudanca } })
  }
  const escolher = (chave: TipoDeVeiculo, arquivo: File): void => {
    mudar({ arquivos: { ...form.arquivos, [chave]: arquivo } })
  }
  return (
    <>
      <TituloDeSecao
        titulo="Seguro"
        subtitulo="Alerta 60 dias antes do vencimento"
        direita={<AcoesDoArquivo arquivo={docs.apolice} titulo={`Apólice · ${veiculo.placa}`} nomeReserva={`${veiculo.placa}-apolice.pdf`} />}
      />
      <GradeDeCampos>
        <Campo
          rotulo="Seguradora"
          tipo="select"
          dica="Selecione"
          valor={form.seguradora}
          opcoes={opcoesDe(SEGURADORAS)}
          aoMudar={(seguradora) => mudar({ seguradora })}
        />
        <Campo
          rotulo="Vencimento da apólice"
          tipo="data"
          valor={form.vencimentos.apolice}
          aoMudar={(valor) => mudar({ vencimentos: { ...form.vencimentos, apolice: valor } })}
        />
        <Campo
          rotulo="Telefone ou canal de sinistro"
          valor={form.emergencia}
          dica="0800 726 8000 · 24h"
          aoMudar={(emergencia) => mudar({ emergencia })}
        />
        <CampoDeArquivo
          rotulo="Arquivo da apólice"
          span={12}
          aceita="application/pdf"
          {...(form.arquivos.apolice === undefined ? {} : { arquivo: form.arquivos.apolice.name })}
          aoEscolher={(arquivo) => escolher('apolice', arquivo)}
        />
      </GradeDeCampos>

      <TituloDeSecao
        titulo="Tacógrafo"
        subtitulo="Alerta 30 dias antes do vencimento"
        direita={<AcoesDoArquivo arquivo={docs.tacografo} titulo={`Tacógrafo · ${veiculo.placa}`} nomeReserva={`${veiculo.placa}-tacografo.pdf`} />}
      />
      <GradeDeCampos>
        <Campo
          rotulo="Vencimento"
          tipo="data"
          valor={form.vencimentos.tacografo}
          aoMudar={(valor) => mudar({ vencimentos: { ...form.vencimentos, tacografo: valor } })}
        />
        <CampoDeArquivo
          rotulo="Certificado do tacógrafo"
          span={8}
          aceita="application/pdf"
          {...(form.arquivos.tacografo === undefined ? {} : { arquivo: form.arquivos.tacografo.name })}
          aoEscolher={(arquivo) => escolher('tacografo', arquivo)}
        />
      </GradeDeCampos>

      <TituloDeSecao
        titulo="CRLV"
        subtitulo="Alerta 60 dias antes do vencimento"
        direita={<AcoesDoArquivo arquivo={docs.crlv} titulo={`CRLV · ${veiculo.placa}`} nomeReserva={`${veiculo.placa}-crlv.pdf`} />}
      />
      <GradeDeCampos>
        <Campo
          rotulo="Vencimento"
          tipo="data"
          valor={form.vencimentos.crlv}
          aoMudar={(valor) => mudar({ vencimentos: { ...form.vencimentos, crlv: valor } })}
        />
        <CampoDeArquivo
          rotulo="Arquivo do CRLV"
          span={8}
          aceita="application/pdf"
          {...(form.arquivos.crlv === undefined ? {} : { arquivo: form.arquivos.crlv.name })}
          aoEscolher={(arquivo) => escolher('crlv', arquivo)}
        />
      </GradeDeCampos>
    </>
  )
}

function CamposDaCnh({ edicao, indice, aoMudar }: {
  readonly edicao: Extract<Edicao, { tipo: 'cnh' }>
  readonly indice: Indice
  readonly aoMudar: (edicao: Edicao) => void
}): JSX.Element {
  const { pessoa, form } = edicao
  const cnh = indice.cnhs.get(pessoa.id) ?? null
  const mudar = (mudanca: Partial<FormularioDeCnh>): void => {
    aoMudar({ ...edicao, form: { ...form, ...mudanca } })
  }
  return (
    <>
      <TituloDeSecao
        titulo="Habilitação"
        subtitulo="Alerta 60 dias antes do vencimento"
        direita={<AcoesDoArquivo arquivo={cnh} titulo={`CNH · ${pessoa.nome}`} nomeReserva={`cnh-${pessoa.nome.split(' ')[0]?.toLowerCase() ?? 'motorista'}.pdf`} />}
      />
      <GradeDeCampos>
        <Campo rotulo="Número da CNH" span={6} mono valor={form.numero} aoMudar={(numero) => mudar({ numero })} />
        <Campo
          rotulo="Categoria"
          span={6}
          tipo="select"
          dica="Selecione"
          valor={form.categoria}
          opcoes={opcoesDe(CATEGORIAS_DE_CNH)}
          aoMudar={(categoria) => mudar({ categoria })}
        />
        <Campo
          rotulo="Vencimento"
          span={6}
          tipo="data"
          valor={form.vencimento}
          aoMudar={(vencimento) => mudar({ vencimento })}
        />
        <Campo
          rotulo="Link do arquivo"
          span={6}
          valor={form.link}
          dica="https://"
          aoMudar={(link) => mudar({ link })}
        />
        <CampoDeArquivo
          rotulo="Arquivo da CNH"
          span={12}
          aceita="application/pdf"
          {...(form.arquivo === undefined ? {} : { arquivo: form.arquivo.name })}
          aoEscolher={(arquivo) => mudar({ arquivo })}
        />
      </GradeDeCampos>
    </>
  )
}
