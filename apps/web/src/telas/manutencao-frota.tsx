/**
 * A manutencao da frota. As regras do porte estao em `entrar.tsx`; aqui ficam as tres
 * coisas que esta tela tem e as anteriores nao tinham.
 *
 * O painel que nao esta na aba escolhida guarda o desenho velho. `renderTudo` so
 * redesenhava o painel ativo, entao trocar de base com o Historico aberto deixava a
 * grade de veiculos com os cartoes da base anterior, e ela so se atualizava no clique
 * que voltava para a aba Preventivas. Derivar os tres paineis do mesmo estado encheria
 * a tela onde a baseline a tem velha. Por isso a grade, a lista de corretivas e a de
 * historico sao tres fotos separadas, e o plano, os registros e as marcas de erro sao
 * refs mutadas como as variaveis de modulo de antes.
 *
 * O atributo `style` do painel tem tres formas e nao duas. `#painelPreventivas` nasce
 * sem atributo nenhum, quem o mostra e a ausencia de regra; depois do primeiro
 * `mudarAba` ele volta com `style=""`, porque `el.style.display = ''` cria o atributo
 * vazio em vez de apaga-lo. `{}` e `{ display: 'none' }` dao exatamente esses tres
 * estados na ordem certa: nada na montagem, o valor quando esconde, e o vazio quando
 * mostra de novo.
 *
 * O corpo do modal de configuracao e uma foto que remonta. Cada `abrirConfig` reescrevia
 * o `innerHTML` inteiro, e com ele voltavam os quatro campos vazios e o grupo "Outro"
 * escondido. `geracao` e a chave do componente: adicionar ou remover um item o remonta,
 * e os campos zeram como zeravam. Fechar o modal nao mexe na foto, porque o
 * `fecharModalConfig` de antes so tirava a classe `aberto`.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { gravarPreventiva, obterPreventiva } from '../js/preventiva-api.ts'
import type { TipoPreventivo } from '../js/preventiva-api.ts'
import { listarRegistros, salvarRegistros } from '../js/registros-api.ts'
import type { Registro } from '../js/registros-api.ts'
import './manutencao-frota.css'

// ===================== CONFIG =====================

type Base = 'Raposa' | 'Imperatriz' | 'Belém'
type Aba = 'preventivas' | 'corretivas' | 'historico'

const VEICULOS_DA_BASE: Readonly<Record<Base, readonly string[]>> = {
  'Raposa':     ['PTV0006','PTT0004','ROW3A87','SMW0B96','SM02J13','SMP6F86','SMQ2I80'],
  'Imperatriz': ['DMG9D41','NXD4H26','NXB2H55','ROW4J37','SMR2H61','SND9C34','SMM4A02'],
  'Belém':      ['SMP2F01'],
}

// Informações dos veículos por placa
const VEICULOS_INFO: Readonly<Record<string, { modelo: string; marca: string; ano: string }>> = {
  'PTV0006': { modelo:'ATEGO 3030 CE', marca:'Mercedes-Benz', ano:'2019/2020' },
  'PTT0004': { modelo:'ACCELO 1316',   marca:'Mercedes-Benz', ano:'2019/2020' },
  'ROW3A87': { modelo:'26.260 CRM 6x2',marca:'Volkswagen',    ano:'2023/2024' },
  'SM02J13': { modelo:'ATEGO 2429',    marca:'Mercedes-Benz', ano:'2024/2025' },
  'SMP6F86': { modelo:'ATEGO 2429',    marca:'Mercedes-Benz', ano:'2024/2025' },
  'SMW0B96': { modelo:'ATEGO 2429',    marca:'Mercedes-Benz', ano:'2024/2025' },
  'SMQ2I80': { modelo:'ACCELO 1017',   marca:'Mercedes-Benz', ano:'2024/2024' },
}

// Último km registrado no PGQ Manutenção Preventiva 2026
const ULTIMO_KM_PGQ: Readonly<Record<string, number>> = {
  'PTV0006': 408413,
  'PTT0004': 354277,
  'ROW3A87': 176585,
  'SMP6F86': 136720,
  'SMQ2I80': 40000,
}

/**
 * A ordem em que os itens aparecem no card e no select "Adicionar item". A API devolve
 * os dois em ordem alfabética de tipo, e a tela nunca mostrou assim: o PGQ lista a
 * preventiva geral antes da lavagem, e "Lavagem" vem antes de "Manutenção" no alfabeto.
 * Aqui só a ordem: o plano de cada veículo e os intervalos vêm do banco.
 */
const ORDEM_CATALOGO: readonly string[] = [
  'Manutenção Preventiva Geral',
  'Troca de óleo',
  'Filtro de ar',
  'Filtro de combustível',
  'Lavagem',
  'Revisão de freios',
  'Alinhamento/Balanceamento',
  'Tacógrafo (calibração)',
]

// O POST aceita 100 registros por vez, e a planilha que se importa costuma passar
// disso. O lote é a única coisa que o arquivo grande muda: cada um deles entra inteiro
// ou não entra, e o que a pessoa vê no fim continua sendo uma frase só.
const LOTE_IMPORT = 100

// ===================== FORMAS =====================

type ItemPlano = {
  readonly tipo: string
  readonly intervalo_km: number
  readonly alerta_km: number
  readonly ultimo_km: number | null
  readonly obs: string | null
}

type StatusItem = 'sem_dado' | 'vencida' | 'alerta' | 'ok'

type LinhaItem = {
  readonly tipo: string
  readonly classeBolinha: string
  readonly cor: string
  readonly restante: string
}

type Cartao = {
  readonly placa: string
  readonly modelo: string
  readonly km: string
  /** Lista vazia é "Nenhum item configurado", que é outro desenho. */
  readonly itens: readonly LinhaItem[]
}

type LinhaRegistro = {
  readonly preventiva: boolean
  readonly titulo: string
  readonly detalhe: string
  readonly docOk: boolean
  readonly programada: string | null
  readonly data: string
}

/** O que `#listaCorretivas` e `#listaHistorico` mostram. O aviso do markup é o inicial. */
type Lista =
  | { readonly tipo: 'aviso'; readonly texto: string; readonly centro: boolean }
  | { readonly tipo: 'linhas'; readonly linhas: readonly LinhaRegistro[] }

const ERRO_DE_LEITURA: Lista = { tipo: 'aviso', texto: 'Erro ao carregar dados.', centro: false }

type Resumo = {
  readonly vencidas: string
  readonly alertas: string
  readonly emDia: string
  readonly pendenteDoc: string
}

type CorpoConfig = {
  /** Muda a cada `abrirConfig` e remonta o corpo, como o `innerHTML` de antes. */
  readonly geracao: number
  readonly placa: string
  readonly km: string
  readonly placeholderUltimoKm: string
  readonly itens: readonly ItemPlano[]
  readonly tipos: readonly TipoPreventivo[]
}

type Preview =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'resumo'; readonly total: number; readonly erros: readonly string[] }

// ===================== LEITURA DO REGISTRO =====================

// O registro chega do servidor como saco de campos, e cada tela lê os seus. Ler com
// `typeof` aqui é o que impede um campo que mudou de forma no banco de virar
// `undefined.toLocaleString()` no meio do desenho.
function texto(r: Registro, campo: string): string | null {
  const valor = r[campo]
  return typeof valor === 'string' ? valor : null
}

function numero(r: Registro, campo: string): number | null {
  const valor = r[campo]
  return typeof valor === 'number' ? valor : null
}

// ===================== CONTAS =====================

/**
 * A lista na ordem de `tipos`, com o que não estiver nela depois, como veio. A API
 * ordena por nome, e a tela nunca mostrou assim.
 *
 * Depois de gravar, `tipos` é a ordem que estava na tela, e não o catálogo: o item que
 * a pessoa acabou de adicionar continua no fim da lista onde ela o viu entrar.
 */
function naOrdemDoCatalogo<T extends { tipo: string }>(itens: readonly T[], tipos: readonly string[]): T[] {
  const posicao = new Map(tipos.map((tipo, i) => [tipo, i]))
  return [...itens].sort((a, b) => (posicao.get(a.tipo) ?? tipos.length) - (posicao.get(b.tipo) ?? tipos.length))
}

function calcularStatus(item: ItemPlano, kmAtual: number | null): { status: StatusItem; restante: number | null } {
  if (!item.ultimo_km) return { status: 'sem_dado', restante: null }
  const proximo = item.ultimo_km + item.intervalo_km
  const restante = proximo - (kmAtual ?? item.ultimo_km)
  if (restante <= 0) return { status: 'vencida', restante }
  if (restante <= item.alerta_km) return { status: 'alerta', restante }
  return { status: 'ok', restante }
}

function kmAtualPorPlaca(registros: readonly Registro[], placa: string): number | null {
  let max: number | null = null
  for (const d of registros) {
    const p = (texto(d, 'veiculo') ?? texto(d, 'placa') ?? '').toUpperCase()
    if (p !== placa.toUpperCase()) continue
    for (const campo of ['km_chegada', 'km', 'km_odometro']) {
      const v = numero(d, campo)
      if (v === null || v <= 0) continue
      if (max === null || v > max) max = v
    }
  }
  return max
}

/** Falha de rede não tem resposta e vira TypeError; com resposta, o texto é da API. */
function motivoDaFalha(e: unknown, padrao: string): string {
  if (e instanceof TypeError) return 'Sem conexão. Tente de novo.'
  return e instanceof Error ? e.message : padrao
}

function comoData(d: Registro): number {
  return Date.parse(texto(d, 'registrado_em') ?? '')
}

function linhaDoRegistro(d: Registro): LinhaRegistro {
  const preventiva = texto(d, 'tipo_manutencao') === 'preventiva'
  const km = numero(d, 'km_odometro')
  return {
    preventiva,
    titulo: `${texto(d, 'placa') || '—'} · ${texto(d, 'servico') || '—'}`,
    detalhe:
      `R$ ${(numero(d, 'valor') ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` +
      ` · ${texto(d, 'fornecedor') || '—'}` +
      (km ? ` · ${km.toLocaleString('pt-BR')} km` : ''),
    docOk: texto(d, 'status_documental') === 'concluido',
    programada: texto(d, 'data_programada'),
    data: texto(d, 'data_entrada') || texto(d, 'data') || texto(d, 'registrado_em')?.split('T')[0] || '—',
  }
}

// ===================== TELA =====================

function ManutencaoFrota(): JSX.Element {
  const [base, setBase] = useState<Base>('Raposa')
  const [aba, setAba] = useState<Aba>('preventivas')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [cartoes, setCartoes] = useState<readonly Cartao[]>([])
  const [totalCorretivas, setTotalCorretivas] = useState('—')
  const [corretivas, setCorretivas] = useState<Lista>({
    tipo: 'aviso', texto: 'Nenhuma corretiva registrada.', centro: true,
  })
  const [historico, setHistorico] = useState<Lista>({
    tipo: 'aviso', texto: 'Nenhum registro encontrado.', centro: true,
  })
  const [corpoConfig, setCorpoConfig] = useState<CorpoConfig | null>(null)
  const [configAberto, setConfigAberto] = useState(false)
  const [importAberto, setImportAberto] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmarVisivel, setConfirmarVisivel] = useState(false)

  // placa → itens do plano. Era `configAtual`, e continua sendo mutado no lugar: o que
  // a tela desenha sai daqui na hora do `renderTudo`, e não a cada tecla.
  const configAtual = useRef<Record<string, ItemPlano[]>>({})
  // A placa é o que a tela mostra; o PUT do plano precisa do id do veículo.
  const idPorPlaca = useRef<Record<string, string>>({})
  const tiposDoCatalogo = useRef<readonly TipoPreventivo[]>([])
  // Os registros da base escolhida. Era o `emvidros_indicadores` do navegador, que cada
  // render lia de novo; agora é uma leitura por base, guardada aqui.
  const registros = useRef<readonly Registro[]>([])
  // Leitura que falhou não é leitura vazia. Sem esta marca as três abas mostrariam
  // "nenhum registro" para uma base cheia, e ninguém saberia que faltou dado.
  const erroRegistros = useRef(false)
  // O mesmo para o plano preventivo. Plano que não carregou não é frota em dia: sem
  // esta marca, o chip do topo diz "0 Manutenções Vencidas" com a mesma cara de quando
  // de fato não há nenhuma.
  const erroConfig = useRef(false)
  const placaConfigurando = useRef<string | null>(null)
  const dadosImport = useRef<Registro[]>([])
  const geracaoConfig = useRef(0)
  const filtroTipo = useRef<HTMLSelectElement>(null)
  const filtroDoc = useRef<HTMLSelectElement>(null)
  const arquivoImport = useRef<HTMLInputElement>(null)

  // ===================== CARGA =====================

  // O plano padrão da Raposa não é mais pré-carregado aqui: ele está semeado no banco,
  // e duas cópias da mesma tabela divergiriam na primeira edição.
  async function carregarConfig(): Promise<void> {
    try {
      const plano = await obterPreventiva()
      tiposDoCatalogo.current = naOrdemDoCatalogo(plano.tipos, ORDEM_CATALOGO)
      configAtual.current = Object.fromEntries(
        plano.veiculos.map((v) => [v.placa, naOrdemDoCatalogo(v.itens, ORDEM_CATALOGO)]),
      )
      idPorPlaca.current = Object.fromEntries(plano.veiculos.map((v) => [v.placa, v.id]))
      erroConfig.current = false
    } catch {
      configAtual.current = {}
      idPorPlaca.current = {}
      tiposDoCatalogo.current = []
      erroConfig.current = true
    }
  }

  async function carregarRegistros(qual: Base): Promise<void> {
    try {
      registros.current = await listarRegistros(qual)
      erroRegistros.current = false
    } catch {
      registros.current = []
      erroRegistros.current = true
    }
  }

  // ===================== DESENHO =====================

  function montarResumo(qual: Base): Resumo {
    let nVencidas = 0, nAlertas = 0, nOk = 0
    for (const placa of VEICULOS_DA_BASE[qual]) {
      const km = kmAtualPorPlaca(registros.current, placa)
      for (const it of configAtual.current[placa] ?? []) {
        const { status } = calcularStatus(it, km)
        if (status === 'vencida') nVencidas++
        else if (status === 'alerta') nAlertas++
        else if (status === 'ok') nOk++
      }
    }
    const nPendenteDoc = registros.current.filter(
      (d) => d.tipo === 'manutencao' && d.base === qual && texto(d, 'status_documental') === 'pendente',
    ).length

    // Número que não foi possível calcular sai como travessão, não como zero. Zero é
    // uma afirmação sobre a frota; o travessão diz que não deu para ler.
    const num = (valor: number, falhou: boolean): string => (falhou ? '—' : String(valor))
    return {
      vencidas: num(nVencidas, erroConfig.current),
      alertas: num(nAlertas, erroConfig.current),
      emDia: num(nOk, erroConfig.current),
      pendenteDoc: num(nPendenteDoc, erroRegistros.current),
    }
  }

  function montarCartoes(qual: Base): Cartao[] {
    return VEICULOS_DA_BASE[qual].map((placa) => {
      const km = kmAtualPorPlaca(registros.current, placa) || ULTIMO_KM_PGQ[placa] || null
      const info = VEICULOS_INFO[placa]
      return {
        placa,
        modelo: info === undefined ? '' : `${info.modelo} · ${info.marca} · ${info.ano}`,
        km: km ? `${km.toLocaleString('pt-BR')} km` : 'km não registrado',
        itens: (configAtual.current[placa] ?? []).map((it) => {
          const { status, restante } = calcularStatus(it, km)
          return {
            tipo: it.tipo,
            classeBolinha: status === 'vencida' ? 'status-vencida' : status === 'alerta' ? 'status-alerta' : 'status-ok',
            cor: status === 'vencida' ? 'var(--red)' : status === 'alerta' ? 'var(--yellow)' : 'var(--green)',
            restante:
              restante === null ? '—'
              : restante <= 0 ? `${Math.abs(restante).toLocaleString('pt-BR')} km vencida`
              : `${restante.toLocaleString('pt-BR')} km restantes`,
          }
        }),
      }
    })
  }

  function manutencoesDaBase(qual: Base): Registro[] {
    return registros.current.filter((d) => d.tipo === 'manutencao' && d.base === qual)
  }

  /** `total` é `null` quando não houve contagem, e aí `#totalCorretivas` fica como está. */
  function montarCorretivas(qual: Base): { total: string | null; lista: Lista } {
    // A leitura falha no carregamento, e não mais dentro de cada render. O aviso é o
    // mesmo de antes, porque para quem lê a tela o fato é o mesmo: não deu para ler.
    if (erroRegistros.current) return { total: null, lista: ERRO_DE_LEITURA }
    const achadas = manutencoesDaBase(qual)
      .filter((d) => texto(d, 'tipo_manutencao') === 'corretiva')
      .sort((a, b) => comoData(b) - comoData(a))
    const total = `${achadas.length} registro${achadas.length !== 1 ? 's' : ''}`
    if (achadas.length === 0) {
      return { total, lista: { tipo: 'aviso', texto: 'Nenhuma corretiva registrada para esta base.', centro: true } }
    }
    return { total, lista: { tipo: 'linhas', linhas: achadas.map(linhaDoRegistro) } }
  }

  function montarHistorico(qual: Base): Lista {
    if (erroRegistros.current) return ERRO_DE_LEITURA
    const porTipo = filtroTipo.current?.value ?? ''
    const porDoc = filtroDoc.current?.value ?? ''
    const achadas = manutencoesDaBase(qual)
      .filter((d) => porTipo === '' || texto(d, 'tipo_manutencao') === porTipo)
      .filter((d) => porDoc === '' || texto(d, 'status_documental') === porDoc)
      .sort((a, b) => comoData(b) - comoData(a))
    if (achadas.length === 0) {
      return { tipo: 'aviso', texto: 'Nenhum registro com esses filtros.', centro: true }
    }
    return { tipo: 'linhas', linhas: achadas.map(linhaDoRegistro) }
  }

  function renderTudo(qual: Base, quala: Aba): void {
    setResumo(montarResumo(qual))
    if (quala === 'preventivas') setCartoes(montarCartoes(qual))
    if (quala === 'corretivas') {
      const { total, lista } = montarCorretivas(qual)
      if (total !== null) setTotalCorretivas(total)
      setCorretivas(lista)
    }
    if (quala === 'historico') setHistorico(montarHistorico(qual))
  }

  useEffect(() => {
    void (async () => {
      await Promise.all([carregarConfig(), carregarRegistros('Raposa')])
      renderTudo('Raposa', 'preventivas')
    })()
  }, [])

  // ===================== PLANO PREVENTIVO =====================

  function copiaDoPlano(placa: string): ItemPlano[] {
    return (configAtual.current[placa] ?? []).map((it) => ({ ...it }))
  }

  /**
   * Grava o plano inteiro da placa, que é o que o PUT recebe. Lista vazia é pedido
   * legítimo e quer dizer "removi tudo".
   *
   * Recusa desfaz: `anterior` volta para `configAtual`, senão a tela ficaria mostrando
   * um item que o banco não tem. Quem chama sempre redesenha depois, com o que sobrou.
   */
  async function salvarPlano(placa: string, anterior: ItemPlano[]): Promise<boolean> {
    const veiculoId = idPorPlaca.current[placa]
    if (veiculoId === undefined) {
      configAtual.current[placa] = anterior
      alert(`⚠️ ${placa} não está no cadastro desta conta. O plano não foi salvo.`)
      return false
    }
    const itens = (configAtual.current[placa] ?? []).map((it) => ({
      tipo: it.tipo,
      intervalo_km: it.intervalo_km,
      alerta_km: it.alerta_km,
      ultimo_km: it.ultimo_km,
      obs: it.obs,
    }))
    try {
      const salvo = await gravarPreventiva(veiculoId, itens)
      configAtual.current[placa] = naOrdemDoCatalogo(salvo.itens, itens.map((it) => it.tipo))
      return true
    } catch (e) {
      configAtual.current[placa] = anterior
      alert(`⚠️ ${motivoDaFalha(e, 'Não foi possível salvar.')}`)
      return false
    }
  }

  function abrirConfig(placa: string): void {
    placaConfigurando.current = placa
    const km = kmAtualPorPlaca(registros.current, placa)
    geracaoConfig.current += 1
    setCorpoConfig({
      geracao: geracaoConfig.current,
      placa,
      km: km ? `${km.toLocaleString('pt-BR')} km` : 'não disponível',
      placeholderUltimoKm: km ? String(km) : '',
      itens: copiaDoPlano(placa),
      tipos: tiposDoCatalogo.current,
    })
    setConfigAberto(true)
  }

  function fecharModalConfig(): void {
    setConfigAberto(false)
    placaConfigurando.current = null
  }

  async function adicionarItem(novo: ItemPlano): Promise<void> {
    const placa = placaConfigurando.current
    if (placa === null) return
    const anterior = copiaDoPlano(placa)
    configAtual.current[placa] = [...(configAtual.current[placa] ?? []), novo]
    await salvarPlano(placa, anterior)
    abrirConfig(placa)
  }

  async function removerItem(idx: number): Promise<void> {
    if (!confirm('Remover este item?')) return
    const placa = placaConfigurando.current
    if (placa === null) return
    const anterior = copiaDoPlano(placa)
    configAtual.current[placa] = (configAtual.current[placa] ?? []).filter((_, i) => i !== idx)
    await salvarPlano(placa, anterior)
    abrirConfig(placa)
  }

  async function salvarConfig(): Promise<void> {
    const placa = placaConfigurando.current
    if (placa === null) return
    // Fechar com o item ainda não gravado é o que o botão promete não fazer, então a
    // recusa mantém o modal aberto e redesenhado com o que o banco tem.
    if (!(await salvarPlano(placa, copiaDoPlano(placa)))) {
      abrirConfig(placa)
      return
    }
    fecharModalConfig()
    renderTudo(base, aba)
  }

  // ===================== IMPORT =====================

  function fecharModalImport(): void {
    setImportAberto(false)
    setPreview(null)
    setConfirmarVisivel(false)
    dadosImport.current = []
  }

  function processarImport(input: HTMLInputElement): void {
    const arquivo = input.files?.[0]
    if (arquivo === undefined) return
    const leitor = new FileReader()
    leitor.onload = () => {
      const linhas = String(leitor.result).split('\n').map((l) => l.trim()).filter(Boolean)
      if (linhas.length < 2) {
        setPreview({ tipo: 'invalido' })
        return
      }
      const cabecalho = linhas[0]!.split(',').map((h) => h.trim().toLowerCase())
      const achados: Registro[] = []
      const erros: string[] = []
      for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i]!.split(',')
        const linha: Record<string, string> = {}
        cabecalho.forEach((h, j) => { linha[h] = (colunas[j] ?? '').trim() })
        if (!linha.placa || !linha.data) {
          erros.push(`Linha ${i + 1}: placa ou data ausente`)
          continue
        }
        achados.push({
          tipo: 'manutencao',
          base: linha.base || base,
          // `registrado_em`, `data` e `status_documental` saíram: quem carimba a hora de
          // registro e o estado documental é o servidor, e mandá-los daqui só repetiria,
          // em outro relógio, o que ele já sabe.
          data_entrada: linha.data,
          placa: linha.placa.toUpperCase(),
          tipo_manutencao: (linha.tipo || 'corretiva').toLowerCase().includes('prev') ? 'preventiva' : 'corretiva',
          servico: linha.servico || linha['serviço'] || '—',
          valor: parseFloat(linha.valor ?? '') || 0,
          fornecedor: linha.fornecedor || '',
          km_odometro: parseInt(linha.km ?? '') || null,
        })
      }
      dadosImport.current = achados
      setPreview({ tipo: 'resumo', total: achados.length, erros })
      setConfirmarVisivel(achados.length > 0)
    }
    leitor.readAsText(arquivo, 'UTF-8')
  }

  async function confirmarImport(): Promise<void> {
    const total = dadosImport.current.length
    if (total === 0) return
    let gravados = 0
    try {
      for (let i = 0; i < total; i += LOTE_IMPORT) {
        const lote = dadosImport.current.slice(i, i + LOTE_IMPORT)
        await salvarRegistros(lote)
        gravados += lote.length
      }
    } catch (e) {
      // O armazenamento do navegador nunca recusava, então esta frase não tem original a
      // preservar. Ela diz quanto entrou porque o lote que passou não volta, e tira os
      // gravados da fila para o botão repetir só o que faltou, sem duplicar nada.
      dadosImport.current = dadosImport.current.slice(gravados)
      alert(`⚠️ ${gravados} de ${total} registros importados. ${motivoDaFalha(e, 'Não foi possível importar.')}`)
      return
    }
    alert(`✅ ${total} registros importados com sucesso!`)
    fecharModalImport()
    await carregarRegistros(base)
    renderTudo(base, aba)
  }

  // ===================== NAVEGAÇÃO =====================

  async function selecionarBase(qual: Base): Promise<void> {
    // Os registros vêm por base, então trocar de base é uma leitura nova. O chip já
    // mudou: a marca de qual base está escolhida não espera a rede.
    setBase(qual)
    await carregarRegistros(qual)
    renderTudo(qual, aba)
  }

  function mudarAba(qual: Aba): void {
    setAba(qual)
    renderTudo(base, qual)
  }

  function irParaRegistro(placa: string): void {
    window.location.href = `formulario-registro.html?placa=${placa}&tipo=manutencao`
  }

  // Os três estados do atributo, na ordem em que a tela os teve. Leia o porquê no topo.
  const painel = (qual: Aba): CSSProperties => (aba === qual ? {} : { display: 'none' })

  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-name"><img src="docs/logo-emvidros.svg" alt="EM Vidros" style={{ height: '56px', width: 'auto', display: 'block' }} /></div>
          <div className="brand-sub">Manutenção Frota · Logística</div>
        </div>
        <div className="nav">
          <div className="nav-label">Módulos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'formulario-registro.html' }}><span className="ico">✏️</span> Registro Diário</div>
          <div className="nav-item" onClick={() => { window.location.href = 'dashboard-semanal.html' }}><span className="ico">📊</span> Dashboard</div>
          <div className="nav-item ativo"><span className="ico">🔧</span> Manutenção Frota</div>
          <div className="nav-item" onClick={() => { window.location.href = 'documentos-frota.html' }}><span className="ico">📂</span> Documentos</div>
          <div className="nav-item" onClick={() => { window.location.href = 'ata-reuniao.html' }}><span className="ico">📝</span> Ata de Reunião</div>
          <div className="nav-item" onClick={() => { window.location.href = 'integracao-frota.html' }}><span className="ico">🧑‍🏫</span> Integração</div>
        </div>
        <div className="sidebar-bottom">v1.0 · Ago 2026</div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Manutenção da Frota</h1>
            <div style={{ fontSize: '.8rem', color: 'var(--txt-dim)' }} id="dataAtual">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-sm btn-config-sm" onClick={() => setImportAberto(true)}>📥 Importar histórico</button>
            <button className="btn-sm btn-registrar-sm" onClick={() => { window.location.href = 'formulario-registro.html?tipo=manutencao' }}>+ Nova Manutenção</button>
          </div>
        </div>

        <div className="content">
          <div className="summary-chips" id="summaryChips">
            {resumo === null ? null : (
              <>
                <div className="summary-chip chip-vencida"><span className="chip-num">{resumo.vencidas}</span><span className="chip-label">Manutenções<br />Vencidas</span></div>
                <div className="summary-chip chip-alerta"><span className="chip-num">{resumo.alertas}</span><span className="chip-label">Em<br />Alerta</span></div>
                <div className="summary-chip chip-ok"><span className="chip-num">{resumo.emDia}</span><span className="chip-label">Em<br />Dia</span></div>
                <div className="summary-chip chip-pendente-doc"><span className="chip-num">{resumo.pendenteDoc}</span><span className="chip-label">Pendente<br />de Documento</span></div>
              </>
            )}
          </div>

          <div className="tabs">
            <button className={aba === 'preventivas' ? 'tab-btn ativo' : 'tab-btn'} id="tabPreventivas" onClick={() => mudarAba('preventivas')}>🛡️ Preventivas</button>
            <button className={aba === 'corretivas' ? 'tab-btn ativo' : 'tab-btn'} id="tabCorretivas" onClick={() => mudarAba('corretivas')}>🔨 Corretivas</button>
            <button className={aba === 'historico' ? 'tab-btn ativo' : 'tab-btn'} id="tabHistorico" onClick={() => mudarAba('historico')}>📋 Histórico</button>
          </div>

          <div className="filtros" id="filtrosBase">
            <button className={base === 'Raposa' ? 'base-chip ativo-raposa' : 'base-chip'} id="chipRaposa" onClick={() => void selecionarBase('Raposa')}>📍 Raposa</button>
            <button className={base === 'Imperatriz' ? 'base-chip ativo-imperatriz' : 'base-chip'} id="chipImperatriz" onClick={() => void selecionarBase('Imperatriz')}>📍 Imperatriz</button>
            <button className={base === 'Belém' ? 'base-chip ativo-belem' : 'base-chip'} id="chipBelem" onClick={() => void selecionarBase('Belém')}>📍 Belém</button>
          </div>

          <div id="painelPreventivas" style={painel('preventivas')}>
            <div className="veiculos-grid" id="gradeVeiculos">
              {cartoes.map((cartao) => (
                <div className="veiculo-card" key={cartao.placa}>
                  <div className="veiculo-header">
                    <div className="placa-badge">{cartao.placa}</div>
                    <div style={{ flex: '1', minWidth: '0', marginLeft: '8px' }}><div style={{ fontSize: '.72rem', color: 'var(--txt-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cartao.modelo}</div><div className="veiculo-km" style={{ marginLeft: '0' }}>{`📏 ${cartao.km}`}</div></div>
                  </div>
                  <div className="veiculo-items">
                    {cartao.itens.length === 0 ? (
                      <div style={{ padding: '14px 16px', fontSize: '.82rem', color: 'var(--txt-muted)', textAlign: 'center' }}>Nenhum item configurado</div>
                    ) : cartao.itens.map((it, i) => (
                      <div className="manut-item" key={i}>
                        <div className={`status-dot ${it.classeBolinha}`}></div>
                        <div className="manut-nome">{it.tipo}</div>
                        <div className="manut-restante" style={{ color: it.cor }}>{it.restante}</div>
                      </div>
                    ))}
                  </div>
                  <div className="manut-actions">
                    <button className="btn-sm btn-config-sm" onClick={() => abrirConfig(cartao.placa)}>⚙️ Configurar</button>
                    <button className="btn-sm btn-registrar-sm" onClick={() => irParaRegistro(cartao.placa)}>+ Registrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="painelCorretivas" style={painel('corretivas')}>
            <div className="lista-card">
              <div className="lista-header">
                <h2>🔨 Manutenções Corretivas</h2>
                <span style={{ fontSize: '.78rem', color: 'var(--txt-dim)' }} id="totalCorretivas">{totalCorretivas}</span>
              </div>
              <div className="lista-body" id="listaCorretivas"><CorpoLista lista={corretivas} /></div>
            </div>
          </div>

          <div id="painelHistorico" style={painel('historico')}>
            <div className="lista-card">
              <div className="lista-header">
                <h2>📋 Histórico Completo</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select ref={filtroTipo} id="filtroTipoHistorico" className="inp" style={{ width: 'auto', fontSize: '.8rem' }} onChange={() => setHistorico(montarHistorico(base))}>
                    <option value="">Todos</option>
                    <option value="preventiva">Preventivas</option>
                    <option value="corretiva">Corretivas</option>
                  </select>
                  <select ref={filtroDoc} id="filtroDocHistorico" className="inp" style={{ width: 'auto', fontSize: '.8rem' }} onChange={() => setHistorico(montarHistorico(base))}>
                    <option value="">Todos os docs</option>
                    <option value="pendente">Pendente de doc</option>
                    <option value="concluido">Doc OK</option>
                  </select>
                </div>
              </div>
              <div className="lista-body" id="listaHistorico"><CorpoLista lista={historico} /></div>
            </div>
          </div>
        </div>
      </main>

      <div className={configAberto ? 'modal-overlay aberto' : 'modal-overlay'} id="modalConfig">
        <div className="modal">
          <div className="modal-header">
            <h3 id="modalConfigTitulo">{corpoConfig === null ? '⚙️ Configurar Manutenções' : `⚙️ Preventivas — ${corpoConfig.placa}`}</h3>
            <button className="modal-close" onClick={fecharModalConfig}>✕</button>
          </div>
          <div className="modal-body" id="modalConfigBody">
            {corpoConfig === null ? null : (
              <CorpoConfigModal
                key={corpoConfig.geracao}
                corpo={corpoConfig}
                aoAdicionar={(item) => void adicionarItem(item)}
                aoRemover={(idx) => void removerItem(idx)}
              />
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-cancelar" onClick={fecharModalConfig}>Fechar</button>
            <button className="btn-salvar" onClick={() => void salvarConfig()}>💾 Salvar</button>
          </div>
        </div>
      </div>

      <div className={importAberto ? 'modal-overlay aberto' : 'modal-overlay'} id="modalImport">
        <div className="modal">
          <div className="modal-header">
            <h3>📥 Importar Histórico de Manutenções</h3>
            <button className="modal-close" onClick={fecharModalImport}>✕</button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: '.85rem', color: 'var(--txt-dim)', marginBottom: '16px' }}>Importe um arquivo CSV ou Excel com o histórico de manutenções (Jul/Ago). O arquivo deve ter as colunas: <strong>data, placa, base, tipo, servico, valor, fornecedor, km</strong>.</p>
            <div className="import-zone" onClick={() => arquivoImport.current?.click()}>
              <input ref={arquivoImport} type="file" id="importFile" accept=".csv,.xlsx,.xls" onChange={(e) => processarImport(e.currentTarget)} />
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Clique para selecionar o arquivo</div>
              <div style={{ fontSize: '.78rem', color: 'var(--txt-muted)' }}>CSV, Excel (.xlsx, .xls)</div>
            </div>
            <div id="importPreview" style={{ marginTop: '14px' }}><CorpoPreview preview={preview} /></div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancelar" onClick={fecharModalImport}>Cancelar</button>
            <button className="btn-salvar" id="btnConfirmarImport" style={{ display: confirmarVisivel ? 'block' : 'none' }} onClick={() => void confirmarImport()}>✅ Importar registros</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ===================== PEDACOS =====================

function CorpoLista({ lista }: { lista: Lista }): JSX.Element {
  if (lista.tipo === 'aviso') {
    const estilo = lista.centro
      ? { padding: '30px', textAlign: 'center' as const, color: 'var(--txt-muted)' }
      : { padding: '20px', color: 'var(--txt-muted)' }
    return <div style={estilo}>{lista.texto}</div>
  }
  return (
    <>
      {lista.linhas.map((l, i) => (
        <div className="reg-row" key={i}>
          <span className={`reg-tipo-badge ${l.preventiva ? 'badge-preventiva' : 'badge-corretiva'}`}>{l.preventiva ? '🛡️ Preventiva' : '🔨 Corretiva'}</span>
          <div className="reg-info">
            <div className="reg-titulo">{l.titulo}</div>
            <div className="reg-detalhe">{l.detalhe}</div>
            <div className="reg-docs" style={{ marginTop: '4px' }}>{l.docOk ? <span className="doc-ok">✅ Doc OK</span> : <span className="doc-pendente">📎 Pendente</span>}{l.programada === null ? null : ` · Programada: ${l.programada}`}</div>
          </div>
          <div className="reg-data">{l.data}</div>
        </div>
      ))}
    </>
  )
}

function CorpoPreview({ preview }: { preview: Preview | null }): JSX.Element | null {
  if (preview === null) return null
  if (preview.tipo === 'invalido') return <div style={{ color: 'var(--red)' }}>Arquivo inválido ou vazio.</div>
  return (
    <>
      <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '.85rem' }}><strong>{`${preview.total} registros`}</strong> encontrados para importar{preview.erros.length === 0 ? null : <> · <span style={{ color: 'var(--red)' }}>{`${preview.erros.length} com erro`}</span></>}</div>
      {preview.erros.length === 0 ? null : (
        <div style={{ fontSize: '.78rem', color: 'var(--red)' }}>
          {preview.erros.map((erro, i) => <Fragment key={i}>{i === 0 ? null : <br />}{erro}</Fragment>)}
        </div>
      )}
    </>
  )
}

function CorpoConfigModal({
  corpo,
  aoAdicionar,
  aoRemover,
}: {
  corpo: CorpoConfig
  aoAdicionar: (item: ItemPlano) => void
  aoRemover: (idx: number) => void
}): JSX.Element {
  const [outro, setOutro] = useState(false)
  const tipo = useRef<HTMLSelectElement>(null)
  const tipoCustom = useRef<HTMLInputElement>(null)
  const intervalo = useRef<HTMLInputElement>(null)
  const alerta = useRef<HTMLInputElement>(null)
  const ultimoKm = useRef<HTMLInputElement>(null)

  function adicionar(): void {
    const escolhido = tipo.current?.value ?? ''
    const nome = escolhido === '__outro__' ? (tipoCustom.current?.value.trim() ?? '') : escolhido
    const cada = parseInt(intervalo.current?.value ?? '') || 0
    const aviso = parseInt(alerta.current?.value ?? '') || 500
    const ultimo = parseInt(ultimoKm.current?.value ?? '') || null
    if (!nome || !cada) {
      alert('Preencha o tipo e o intervalo de km.')
      return
    }
    aoAdicionar({ tipo: nome, intervalo_km: cada, alerta_km: aviso, ultimo_km: ultimo, obs: null })
  }

  return (
    <>
      <div style={{ fontSize: '.78rem', color: 'var(--txt-dim)', marginBottom: '12px' }}>km atual registrado: <strong>{corpo.km}</strong></div>
      <div id="listaItensConfig">
        {corpo.itens.length === 0 ? (
          <div style={{ color: 'var(--txt-muted)', fontSize: '.83rem', marginBottom: '12px' }}>Nenhum item configurado ainda.</div>
        ) : corpo.itens.map((it, i) => (
          <div className="item-linha" id={`il_${i}`} key={i}>
            <div>
              <div className="item-nome">{it.tipo}</div>
              <div className="item-detalhe">{`A cada ${it.intervalo_km.toLocaleString('pt-BR')} km · Alerta ${it.alerta_km.toLocaleString('pt-BR')} km antes · Último: ${it.ultimo_km ? `${it.ultimo_km.toLocaleString('pt-BR')} km` : 'não informado'}`}</div>
            </div>
            <button className="btn-del" onClick={() => aoRemover(i)}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '4px' }}>
        <div style={{ fontSize: '.8rem', fontWeight: '700', color: 'var(--txt-dim)', marginBottom: '10px' }}>Adicionar item:</div>
        <div className="form-group">
          <label className="lbl">Tipo de manutenção</label>
          <select ref={tipo} id="novoTipo" className="inp" onChange={(e) => setOutro(e.currentTarget.value === '__outro__')}>
            {corpo.tipos.map((t) => <option value={t.tipo} key={t.id}>{t.tipo}</option>)}
            <option value="__outro__">Outro (digitar abaixo)</option>
          </select>
        </div>
        <div className="form-group" id="grupoOutroTipo" style={{ display: outro ? 'block' : 'none' }}>
          {' '}
          <label className="lbl">Descrição</label>
          {' '}
          <input ref={tipoCustom} type="text" id="novoTipoCustom" className="inp" placeholder="Ex: Troca de correia dentada" />
          {' '}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div className="form-group">
            <label className="lbl">Intervalo (km)</label>
            <input ref={intervalo} type="number" id="novoIntervalo" className="inp" placeholder="10000" />
          </div>
          <div className="form-group">
            <label className="lbl">Alerta (km antes)</label>
            <input ref={alerta} type="number" id="novoAlerta" className="inp" placeholder="500" />
          </div>
          <div className="form-group">
            <label className="lbl">Último km realizado</label>
            <input ref={ultimoKm} type="number" id="novoUltimoKm" className="inp" placeholder={corpo.placeholderUltimoKm} />
          </div>
        </div>
        {' '}
        <button type="button" className="btn-sm btn-registrar-sm" style={{ width: '100%', marginTop: '4px' }} onClick={adicionar}>+ Adicionar item</button>
        {' '}
      </div>
    </>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<ManutencaoFrota />)
