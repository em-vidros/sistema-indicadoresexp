/**
 * O formulario de registro, a maior das sete telas e a ultima do porte. As regras
 * gerais estao em `entrar.tsx`; aqui ficam as cinco coisas que so esta tela tem.
 *
 * Tres desenhos sao fotos, e nao derivacoes do estado. O modulo velho so redesenhava
 * quando alguem chamava a funcao, e as funcoes eram chamadas em pontos diferentes:
 * `popularAutocompletistas` nao roda no "Limpar historico", `atualizarDataAtual` so
 * roda na sessao que ja chega com base, e `renderizarHistorico` anda sempre colado em
 * `atualizarContador`. Derivar os tres do estado encheria a tela onde a baseline a tem
 * vazia ou velha. Por isso `historicoFoto`, `autocompleteFoto` e `dataFoto` sao fotos
 * separadas, e os registros lidos da API sao refs mutadas como as variaveis de modulo
 * de antes: `exportarDados` le o valor de agora, e nao a foto.
 *
 * Os dois botoes de tipo de manutencao mudam de cor por ref, e nao por estado. O
 * `style` deles traz o atalho `border: 2px solid var(--green)`, e escrever
 * `borderColor` por cima faz o CSSOM explodir o atalho em longhands vazias que nenhum
 * objeto de estilo do React produz. Entao o objeto de estilo deles e o original e
 * nunca muda entre renders; quem escreve cor e `selecionarTipoManutencao`, na mesma
 * ordem de antes. Ela tambem nunca mexeu em classe, entao `ativo` fica no
 * `#btnPreventiva` para sempre, inclusive depois de clicar em Corretiva.
 *
 * `#formViagem` tem tres formas de `style` e nao duas: ele nasce sem atributo nenhum, e
 * so o primeiro `selecionarTipo` lhe da `display`. `tipoEscolhido` comeca `null`
 * justamente para guardar esse "ainda nao trocou de tipo".
 *
 * O corpo do modal de usuarios nao remonta ao salvar. `salvarUsuarios` so trocava o
 * nome no chip da lateral, entao o campo continua com o atributo `value` antigo e a
 * propriedade nova. Se o corpo remontasse, o `defaultValue` zeraria o que foi digitado.
 *
 * Os campos sao lidos e escritos por id, como no modulo velho. Metade deles nasce
 * dentro de um `map`, e ler os fixos por ref e os dinamicos por id daria dois jeitos de
 * ler o mesmo formulario.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { apagarRegistrosDoDia, listarRegistros, salvarRegistros } from '../js/registros-api.ts'
import type { Registro } from '../js/registros-api.ts'
import './formulario-registro.css'

// ===================== FROTAS PRÉ-CADASTRADAS =====================

const VEICULOS_RAPOSA = ['PTV0006','PTT0004','ROW3A87','SMW0B96','SM02J13','SMP6F86','SMQ2I80']
const VEICULOS_IMPERATRIZ = ['DMG9D41','NXD4H26','NXB2H55','ROW4J37','SMR2H61','SND9C34','SMM4A02']
const VEICULOS_BELEM = ['SMP2F01']

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
]
const MOTORISTAS_IMPERATRIZ = [
  'Nataniel Pereira Rocha',
  'Francisco Pereira dos Santos',
  'Evandro de Oliveira Cardim',
  'Francisco de Sousa Cabral',
  'Adriel da Silva Santos',
  'Sebastiao de Brito Matos',
  'Italo Melo Sales',
  'Railton da Silva Batista',
]
const MOTORISTAS_BELEM = ['Severino Manoel Barata do Nascimento']

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
]
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
]
const ROTAS_BELEM = ['BARCARENA', 'BELÉM', 'SALINÓPOLIS']

// As rotas curtas, que nao mostram o toggle de viagem longa.
const ROTAS_LOCAIS = ['IMPERATRIZ', 'SÃO LUÍS', 'LOJA GUAJAJARAS', 'LOJA ANGELIM', 'LOJA BELÉM', 'LOJA SANTA INÊS', 'BARCARENA']

// ===================== FORMAS =====================

type Tipo = 'viagem' | 'abastecimento' | 'manutencao' | 'quebra'
type TipoManutencao = 'preventiva' | 'corretiva'

const TIPOS_DE_REGISTRO: readonly { readonly id: Tipo; readonly ico: string; readonly nome: string }[] = [
  { id: 'viagem',        ico: '🚛', nome: 'Viagem' },
  { id: 'abastecimento', ico: '⛽', nome: 'Abastecimento' },
  { id: 'manutencao',    ico: '🔧', nome: 'Manutenção' },
  { id: 'quebra',        ico: '📦', nome: 'Quebra' },
]

const BASES: readonly { readonly nome: string; readonly id: string; readonly cor: string }[] = [
  { nome: 'Raposa',     id: 'btnRaposa',     cor: '#2563eb' },
  { nome: 'Imperatriz', id: 'btnImperatriz', cor: '#16a34a' },
  { nome: 'Belém',      id: 'btnBelem',      cor: '#ea580c' },
]

const ICOS_DO_HISTORICO: Readonly<Record<string, string>> = {
  viagem: '🚛', abastecimento: '⛽', manutencao: '🔧', quebra: '📦',
}

const ROTULO_DE_BASE: Readonly<Record<string, string>> = {
  Raposa: '📍 Raposa', Imperatriz: '📍 Imperatriz', 'Belém': '📍 Belém',
}

const TODAS_AS_BASES = ['Raposa', 'Imperatriz', 'Belém']

const TODOS_OS_TIPOS: readonly { readonly id: Tipo; readonly ico: string; readonly label: string }[] = [
  { id: 'viagem',        ico: '🚛', label: 'Viagem' },
  { id: 'abastecimento', ico: '⛽', label: 'Abast.' },
  { id: 'manutencao',    ico: '🔧', label: 'Manut.' },
  { id: 'quebra',        ico: '📦', label: 'Quebra' },
]

const ROTULOS_DE_SLOT = ['Saída', 'Interior', 'Chegada']

/** O que `/api/sessao` devolve, e tambem cada item de `/api/usuarios`: a mesma linha. */
type Usuario = {
  readonly usuario: string
  readonly nome: string
  readonly admin: boolean
  readonly baseFixa: string | null
  readonly bases: readonly string[]
  readonly tipos: readonly string[]
}

/** O que o `PUT /api/usuarios` recebe. Chave que falta quer dizer "nao mexe nisso". */
type MudancaDeUsuario = {
  usuario: string
  nome: string
  senha?: string
  bases?: string[]
  tipos?: string[]
}

/**
 * O que a tela mostra da sessao, em tres desenhos: carregando, escolher a base, e o
 * formulario. Admin cai no do meio ate escolher; quem tem base fixa pula direto.
 */
type Vista = 'carregando' | 'escolher-base' | 'formulario'

/** `#historicoLista` e o texto de `#contadorHoje`, que sempre foram desenhados juntos. */
type HistoricoFoto = {
  /** Os registros de hoje da base. Lista vazia e outro desenho. */
  readonly dados: readonly Registro[]
  /** Leitura que falhou nao e dia sem registro, e o aviso e outro. */
  readonly erro: string | null
  readonly base: string | null
  /** A base inteira, que e o "total" do contador. */
  readonly total: number
}

type AutocompleteFoto = {
  readonly motoristas: readonly string[]
  readonly veiculos: readonly string[]
  readonly rotas: readonly string[]
  /** O `<select>` do abastecimento tem lista propria: admin ve todas as rotas. */
  readonly rotasAb: readonly string[]
}

type DataFoto = { readonly dia: string; readonly hoje: string }

/** Quantos abastecimentos a viagem longa abriu. O botao "+" some no terceiro. */
type Slots = { readonly longa: boolean; readonly ativos: number }

type Totais = { readonly litros: string; readonly valor: string; readonly media: string; readonly km: string }

const TOTAIS_ZERADOS: Totais = { litros: '—', valor: '—', media: '—', km: '—' }

type Feedback = { readonly msg: string; readonly tipo: 'ok' | 'erro' }

type Coleta = { readonly erro: string } | Registro[]

// ===================== LEITURA DO QUE VEM DE FORA =====================

/**
 * A linha de usuario chega do servidor como JSON solto, e a tela le campo a campo. Sem
 * isto um `nome` que mudou de forma no banco vira `undefined.charAt(0)` no meio do
 * desenho, e a tela para de montar sem uma palavra.
 */
function comoUsuario(bruto: unknown): Usuario {
  const u = (bruto ?? {}) as Record<string, unknown>
  const listaDeTexto = (valor: unknown): string[] =>
    Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : []
  return {
    usuario: typeof u.usuario === 'string' ? u.usuario : '',
    nome: typeof u.nome === 'string' ? u.nome : '',
    admin: u.admin === true,
    baseFixa: typeof u.baseFixa === 'string' ? u.baseFixa : null,
    // Sem `||` de reserva: lista vazia aqui e permissao de verdade, e um padrao
    // generoso transformaria erro de consulta em acesso a base que nao e sua.
    bases: listaDeTexto(u.bases),
    tipos: listaDeTexto(u.tipos),
  }
}

function campoTexto(r: Registro, nome: string): string | null {
  const valor = r[nome]
  return typeof valor === 'string' ? valor : null
}

function campoNumero(r: Registro, nome: string): number | null {
  const valor = r[nome]
  return typeof valor === 'number' ? valor : null
}

function ptBr(valor: number | null, casas: number): string {
  return valor === null ? '' : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas })
}

// ===================== LEITURA DO FORMULÁRIO =====================

/** O `getElementById(id)` do modulo velho. Estoura igual, porque campo que sumiu e defeito. */
function campo(id: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const achado = document.getElementById(id)
  if (achado === null) throw new Error(`elemento '${id}' nao existe`)
  return achado as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
}

function caixa(id: string): HTMLInputElement {
  const achado = campo(id)
  if (!(achado instanceof HTMLInputElement)) throw new Error(`elemento '${id}' nao e um input`)
  return achado
}

function valor(id: string): string {
  return campo(id).value
}

function aparado(id: string): string {
  return valor(id).trim()
}

function decimal(id: string): number {
  return parseFloat(valor(id)) || 0
}

function inteiro(id: string): number {
  return parseInt(valor(id)) || 0
}

function escrever(id: string, texto: string): void {
  campo(id).value = texto
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function mensagemDoErro(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : padrao
}

// ===================== TELA =====================

function FormularioRegistro(): JSX.Element {
  const [sessao, setSessao] = useState<Usuario | null>(null)
  const [nomeExibido, setNomeExibido] = useState('—')
  const [vista, setVista] = useState<Vista>('carregando')
  const [chipBase, setChipBase] = useState('Raposa')
  const [baseAtiva, setBaseAtiva] = useState<string | null>(null)
  const [tipoEscolhido, setTipoEscolhido] = useState<Tipo | null>(null)
  const [historicoFoto, setHistoricoFoto] = useState<HistoricoFoto | null>(null)
  const [autocompleteFoto, setAutocompleteFoto] = useState<AutocompleteFoto | null>(null)
  const [dataFoto, setDataFoto] = useState<DataFoto | null>(null)
  const [rotaLocal, setRotaLocal] = useState(false)
  const [slots, setSlots] = useState<Slots>({ longa: false, ativos: 1 })
  const [totais, setTotais] = useState<Totais>(TOTAIS_ZERADOS)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  // A lista chega do servidor e fica aqui entre abrir o modal e salvar. Guardar so os
  // quatro logins, e nao o objeto inteiro, deixaria `salvarUsuarios` sem saber quem e
  // admin e reenviaria permissao de quem nao tem permissao editavel.
  const [usuarios, setUsuarios] = useState<readonly Usuario[] | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  const sessaoAtual = useRef<Usuario | null>(null)
  const baseAtual = useRef<string | null>('Raposa')
  const tipoManutencaoAtual = useRef<TipoManutencao>('preventiva')
  // A verdade dos registros, e nao a foto. `exportarDados` le o valor de agora.
  const dadosMemoria = useRef<readonly Registro[]>([])
  // Leitura que falhou nao e dia sem registro. Sem esta marca a tela mostra "Nenhum
  // registro hoje para Raposa." para uma base cheia, e a pessoa lanca tudo de novo.
  const erroLeitura = useRef<string | null>(null)
  const btnPreventiva = useRef<HTMLButtonElement>(null)
  const btnCorretiva = useRef<HTMLButtonElement>(null)
  const btnRegistrar = useRef<HTMLButtonElement>(null)

  const tipoAtual: Tipo = tipoEscolhido ?? 'viagem'

  // ===================== SESSÃO =====================

  function fazerLogout(): void {
    if (!confirm('Sair do sistema?')) return
    // O cookie e httpOnly: quem apaga e o servidor. O `finally` existe porque a tela
    // tem que sair mesmo se a chamada falhar, senao o usuario fica preso no lugar.
    void fetch('/api/sair', { method: 'POST' }).finally(() => { location.href = '/entrar.html' })
  }

  async function aplicarSessao(bruto: unknown): Promise<void> {
    const nova = comoUsuario(bruto)
    sessaoAtual.current = nova
    setSessao(nova)
    setNomeExibido(nova.nome)
    let base = nova.baseFixa
    if (!nova.admin) {
      setVista('formulario')
      setBaseAtiva(nova.baseFixa)
    } else {
      // Admin nao chega com base escolhida. Quem escolhe e ela, antes de preencher.
      base = null
      setVista('escolher-base')
      setChipBase('—')
    }
    baseAtual.current = base
    if (base) {
      await recarregarDaApi()
      setChipBase(base)
      setDataHoje()
      atualizarDataAtual()
      popularAutocompletistas()
      fotografarHistorico()
      void verificarN8n()
    } else {
      void verificarN8n()
    }
  }

  useEffect(() => {
    // Quem nao tem cookie valido nao recebe este HTML: o servidor manda para o login
    // antes. O 401 aqui e a sessao que expirou entre a pagina carregar e esta chamada.
    fetch('/api/sessao')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      // O tratamento de erro e o segundo argumento do `then`, e nao um `.catch`
      // encadeado, porque encadeado ele pegaria tambem o que `aplicarSessao` lancar.
      // Ai a tela iria para o login, o portao veria sessao valida e a devolveria, e o
      // laco correria sem mensagem nenhuma.
      .then(aplicarSessao, () => {
        location.href = '/entrar.html?destino=' + encodeURIComponent(location.pathname + location.search)
      })
      .catch((erro: unknown) => { console.error('falhou ao montar a tela', erro) })
  }, [])

  function setDataHoje(): void {
    const hoje = hojeISO()
    for (const id of ['v_data_saida', 'v_data_chegada', 'a_data', 'm_data_entrada', 'q_data']) escrever(id, hoje)
  }

  function atualizarDataAtual(): void {
    const agora = new Date()
    setDataFoto({
      dia: agora.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      hoje: agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    })
  }

  // ===================== TIPO / BASE =====================

  function selecionarTipo(tipo: Tipo): void {
    setTipoEscolhido(tipo)
    esconderFeedback()
  }

  function calcularCustoViagem(): void {
    escrever('v_custo_viagem', (decimal('v_combustivel') + decimal('v_diarias')).toFixed(2))
  }

  async function selecionarBase(base: string): Promise<void> {
    baseAtual.current = base
    setBaseAtiva(base)
    setChipBase(base)
    if (sessaoAtual.current?.admin === true) {
      setVista('formulario')
      popularAutocompletistas()
      setDataHoje()
    }
    await recarregarDaApi()
    fotografarHistorico()
  }

  // ===================== COLETA DE DADOS =====================

  function coletarDados(base: string): Coleta {
    const agora = new Date().toISOString()

    if (tipoAtual === 'viagem') {
      const ds = valor('v_data_saida')
      const mot = aparado('v_motorista')
      const vei = aparado('v_veiculo').toUpperCase()
      const rot = aparado('v_rota')
      const vc = decimal('v_valor_carga')
      const comb = decimal('v_combustivel')
      const diar = decimal('v_diarias')
      const cv = comb + diar
      if (!ds || !mot || !vei || !rot || !vc || !cv) {
        return { erro: 'Preencha os campos obrigatórios: Data Saída, Motorista, Veículo, Rota, Valor da Carga, Combustível e Diárias.' }
      }
      const kms = inteiro('v_km_saida')
      const kmc = inteiro('v_km_chegada')
      return [{
        tipo: 'viagem', base, registrado_em: agora,
        data_saida: ds,
        hora_saida: valor('v_hora_saida'),
        data_chegada: valor('v_data_chegada'),
        hora_prevista: valor('v_hora_prevista'),
        hora_chegada: valor('v_hora_chegada'),
        pontualidade: valor('v_pontualidade'),
        motorista: mot, veiculo: vei, rota: rot,
        km_saida: kms, km_chegada: kmc,
        km_rodados: kmc > kms ? kmc - kms : 0,
        valor_carga: vc, combustivel: comb, diarias: diar, custo_viagem: cv,
        m2: decimal('v_m2'),
        peso_kg: decimal('v_peso'),
        observacao: aparado('v_obs'),
        pct_custo: vc > 0 ? Math.round(cv / vc * 10000) / 100 : 0,
      }]
    }

    if (tipoAtual === 'abastecimento') {
      const dt = valor('a_data')
      const pl = aparado('a_placa').toUpperCase()
      const rota = valor('a_rota')
      const viagemLonga = caixa('a_viagem_longa').checked
      if (!dt || !pl) return { erro: 'Preencha: Data e Placa.' }

      if (!viagemLonga) {
        const lt = decimal('a_litros_1')
        const vl = decimal('a_vl_litro_1')
        if (!lt || !vl) return { erro: 'Preencha: Litros e Valor/Litro.' }
        return [{
          tipo: 'abastecimento', base, registrado_em: agora,
          data: dt, placa: pl, rota: rota || null,
          litros: lt, vl_litro: vl,
          valor_total: Math.round(lt * vl * 100) / 100,
          km: inteiro('a_km_1') || null,
          posto: aparado('a_posto_1'),
          slot: null, viagem_longa: false,
        }]
      }

      const slotsCheios: Registro[] = []
      let kmInicial: number | null = null
      let kmFinal: number | null = null
      for (let i = 1; i <= 3; i++) {
        const lt = decimal(`a_litros_${i}`)
        const vl = decimal(`a_vl_litro_${i}`)
        if (lt === 0) continue
        const km = inteiro(`a_km_${i}`) || null
        if (km) { if (kmInicial === null) kmInicial = km; kmFinal = km }
        slotsCheios.push({
          tipo: 'abastecimento', base, registrado_em: agora,
          data: dt, placa: pl, rota: rota || null,
          litros: lt, vl_litro: vl,
          valor_total: Math.round(lt * vl * 100) / 100,
          km,
          posto: aparado(`a_posto_${i}`),
          slot: ROTULOS_DE_SLOT[i - 1] ?? null, viagem_longa: true,
        })
      }
      if (slotsCheios.length === 0) return { erro: 'Preencha pelo menos um abastecimento.' }
      const totalLt = slotsCheios.reduce((s, r) => s + (campoNumero(r, 'litros') ?? 0), 0)
      const totalR = slotsCheios.reduce((s, r) => s + (campoNumero(r, 'valor_total') ?? 0), 0)
      const kmRodados = (kmInicial && kmFinal && kmFinal > kmInicial) ? kmFinal - kmInicial : null
      const media = (totalLt > 0 && kmRodados) ? Math.round(kmRodados / totalLt * 100) / 100 : null
      for (const s of slotsCheios) {
        s.total_litros_viagem = totalLt
        s.total_valor_viagem = Math.round(totalR * 100) / 100
        s.km_rodados_viagem = kmRodados
        s.media_kmL = media
      }
      return slotsCheios
    }

    if (tipoAtual === 'manutencao') {
      const de = valor('m_data_entrada')
      const pl = aparado('m_placa').toUpperCase()
      const sv = aparado('m_servico')
      const vl = decimal('m_valor')
      if (!de || !pl || !sv || !vl) return { erro: 'Preencha: Data de Entrada, Placa, Serviço e Valor.' }
      const ds = valor('m_data_saida')
      let diasOficina: number | null = null
      if (de && ds) {
        diasOficina = Math.round((new Date(ds).getTime() - new Date(de).getTime()) / 86400000)
      }
      const temOrcamento = (caixa('m_doc_orcamento').files?.length ?? 0) > 0
      const temOS = (caixa('m_doc_os').files?.length ?? 0) > 0
      return [{
        tipo: 'manutencao', base, registrado_em: agora,
        tipo_manutencao: tipoManutencaoAtual.current,
        data: de,
        data_programada: valor('m_data_programada') || null,
        data_entrada: de,
        hora_entrada: valor('m_hora_entrada'),
        data_saida: ds,
        hora_saida: valor('m_hora_saida'),
        dias_oficina: diasOficina,
        placa: pl, servico: sv, valor: vl,
        km_odometro: inteiro('m_km') || null,
        fornecedor: aparado('m_fornecedor'),
        status_documental: (temOrcamento && temOS) ? 'concluido' : 'pendente',
        link_orcamento: null,
        link_os: null,
      }]
    }

    const dt = valor('q_data')
    const me = decimal('q_m2_expedido')
    const mq = decimal('q_m2_quebrado')
    if (!dt || !me) return { erro: 'Preencha: Data e m² Expedido.' }
    return [{
      tipo: 'quebra', base, registrado_em: agora,
      data: dt, m2_expedido: me, m2_quebrado: mq,
      pct_quebra: me > 0 ? Math.round(mq / me * 10000) / 100 : 0,
      observacao: aparado('q_obs'),
    }]
  }

  // ===================== REGISTRAR =====================

  async function registrar(): Promise<void> {
    const base = baseAtual.current
    // Sem base o formulario nem esta na tela, e o registro nao teria onde entrar.
    if (base === null) return
    const lista = coletarDados(base)
    if (!Array.isArray(lista)) {
      mostrarFeedback(lista.erro, 'erro')
      return
    }

    const btn = btnRegistrar.current
    if (btn !== null) {
      btn.disabled = true
      btn.textContent = 'Salvando...'
    }

    try {
      await salvarRegistros(lista)
    } catch (e) {
      // A tela sempre avisou quando estava sem conexão. Só que antes o registro ficava
      // salvo no aparelho e o aviso era verde; agora não fica, então o aviso é vermelho
      // e o formulário continua preenchido, para a pessoa tentar de novo sem redigitar.
      // Falha de rede não tem resposta e vira TypeError; com resposta, o texto é da API.
      const msg = e instanceof TypeError
        ? '⚠️ Sem conexão. O registro não foi salvo, tente de novo.'
        : `⚠️ ${mensagemDoErro(e, 'Não foi possível salvar.')}`
      mostrarFeedback(msg, 'erro')
      if (btn !== null) {
        btn.disabled = false
        btn.textContent = '✅ Registrar'
      }
      return
    }

    // A releitura da lista fica fora do `try` da gravacao de proposito. As duas juntas
    // faziam a tela dizer "nao foi salvo" depois de ter salvado, quando so a segunda
    // falhava: a pessoa clicava de novo e a mesma quebra entrava duas vezes no numero
    // que alimenta o dashboard.
    await recarregarDaApi()

    limparFormulario()
    fotografarHistorico()
    popularAutocompletistas()

    const n = lista.length
    const msg = erroLeitura.current
      ? '✅ Registrado no sistema. Não consegui atualizar a lista abaixo; recarregue a página para vê-la.'
      : `✅ ${n > 1 ? n + ' abastecimentos registrados' : 'Registrado'} no sistema!`
    mostrarFeedback(msg, 'ok')

    if (btn !== null) {
      btn.disabled = false
      btn.textContent = '✅ Registrar'
    }
    setTimeout(() => esconderFeedback(), 5000)
  }

  // ===================== DADOS DA TELA =====================

  /**
   * A leitura da lista, no unico lugar. Ela e chamada de tres lugares que antes tinham
   * `await listarRegistros(...)` solto: um deles sem `try`, dentro de um `onclick`, onde
   * a falha virava rejeicao nao tratada e a tela parava de montar no meio, sem uma
   * palavra na tela.
   */
  async function recarregarDaApi(): Promise<void> {
    try {
      dadosMemoria.current = await listarRegistros(baseAtual.current)
      erroLeitura.current = null
    } catch (e) {
      dadosMemoria.current = []
      erroLeitura.current = mensagemDoErro(e, 'falha ao ler os registros')
    }
  }

  function dadosDeHoje(): Registro[] {
    const hoje = hojeISO()
    return dadosMemoria.current.filter((d) => {
      const data = campoTexto(d, 'data_saida') || campoTexto(d, 'data') || campoTexto(d, 'registrado_em')?.slice(0, 10)
      return data === hoje && d.base === baseAtual.current
    })
  }

  /**
   * O `renderizarHistorico` e o `atualizarContador` de antes, que nunca foram chamados
   * um sem o outro. A lista sem `.reverse()`: ele existia porque o armazenamento do
   * navegador guardava na ordem de digitacao e o mais novo ficava por ultimo; a consulta
   * ja devolve decrescente, entao inverter de novo punha o mais velho no topo.
   */
  function fotografarHistorico(): void {
    const base = baseAtual.current
    setHistoricoFoto({
      dados: dadosDeHoje(),
      erro: erroLeitura.current,
      base,
      total: dadosMemoria.current.filter((d) => d.base === base).length,
    })
  }

  // ===================== AUTOCOMPLETE =====================

  function popularAutocompletistas(): void {
    const lidos = dadosMemoria.current
    const sessaoAgora = sessaoAtual.current
    const base = sessaoAgora ? sessaoAgora.baseFixa : baseAtual.current
    const admin = sessaoAgora !== null && sessaoAgora.admin
    const motoresPre = admin ? [...MOTORISTAS_RAPOSA, ...MOTORISTAS_IMPERATRIZ, ...MOTORISTAS_BELEM]
      : base === 'Raposa' ? MOTORISTAS_RAPOSA : base === 'Imperatriz' ? MOTORISTAS_IMPERATRIZ : MOTORISTAS_BELEM
    const veiculosPre = admin ? [...VEICULOS_RAPOSA, ...VEICULOS_IMPERATRIZ, ...VEICULOS_BELEM]
      : base === 'Raposa' ? VEICULOS_RAPOSA : base === 'Imperatriz' ? VEICULOS_IMPERATRIZ : VEICULOS_BELEM
    const rotasPre = admin ? [...ROTAS_RAPOSA, ...ROTAS_IMPERATRIZ, ...ROTAS_BELEM]
      : base === 'Raposa' ? ROTAS_RAPOSA : base === 'Imperatriz' ? ROTAS_IMPERATRIZ : ROTAS_BELEM
    const motoresHistorico = lidos.map((d) => campoTexto(d, 'motorista')).filter((m): m is string => m !== null && m !== '')
    const veiculosHistorico = lidos
      .map((d) => campoTexto(d, 'veiculo') || campoTexto(d, 'placa'))
      .filter((v): v is string => v !== null && v !== '')
    const rotasHistorico = lidos.map((d) => campoTexto(d, 'rota')).filter((r): r is string => r !== null && r !== '')
    const rotasAb = admin ? [...ROTAS_RAPOSA, ...ROTAS_IMPERATRIZ, ...ROTAS_BELEM] : rotasPre
    setAutocompleteFoto({
      motoristas: [...new Set([...motoresPre, ...motoresHistorico])].sort(),
      veiculos: [...new Set([...veiculosPre, ...veiculosHistorico])].sort(),
      rotas: [...new Set([...rotasPre, ...rotasHistorico])].sort(),
      rotasAb: [...new Set(rotasAb)].sort(),
    })
  }

  // ===================== LIMPAR FORMULÁRIO =====================

  function limparFormulario(): void {
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type=text],input[type=number],textarea').forEach((el) => { el.value = '' })
    document.querySelectorAll('select').forEach((el) => { el.value = '' })
    document.querySelectorAll<HTMLInputElement>('input[type=time]').forEach((el) => { el.value = '' })
    tipoManutencaoAtual.current = 'preventiva'
    const btnP = btnPreventiva.current
    const btnC = btnCorretiva.current
    if (btnP) { btnP.style.borderColor = 'var(--green)'; btnP.style.background = 'var(--green-soft)'; btnP.style.color = 'var(--green)' }
    if (btnC) { btnC.style.borderColor = 'var(--border)'; btnC.style.background = 'var(--bg-card)'; btnC.style.color = 'var(--txt-dim)' }
    caixa('a_viagem_longa').checked = false
    setSlots({ longa: false, ativos: 1 })
    setDataHoje()
  }

  // ===================== FEEDBACK =====================

  function mostrarFeedback(msg: string, tipo: 'ok' | 'erro'): void {
    setFeedback({ msg, tipo })
  }

  function esconderFeedback(): void {
    setFeedback(null)
  }

  // ===================== EXPORTAR =====================

  function exportarDados(): void {
    const lidos = dadosMemoria.current
    if (lidos.length === 0) { alert('Nenhum dado para exportar.'); return }
    const blob = new Blob([JSON.stringify(lidos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emvidros-indicadores-${hojeISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function limparHoje(): Promise<void> {
    const base = baseAtual.current
    if (!confirm('Apagar registros de hoje de ' + base + '?')) return
    if (base === null) return
    // Antes isto so tirava da lista em memoria. A tela ficava limpa, a pessoa acreditava
    // ter apagado, e o proximo F5 trazia tudo de volta. Quem apaga agora e o banco, por
    // soft-delete, e a lista e relida de la.
    try {
      await apagarRegistrosDoDia(base, hojeISO())
      await recarregarDaApi()
    } catch (e) {
      mostrarFeedback(`⚠️ ${mensagemDoErro(e, 'Não foi possível apagar.')}`, 'erro')
      return
    }
    fotografarHistorico()
  }

  // ===================== GERENCIAR USUÁRIOS (admin) =====================

  async function abrirGerenciarUsuarios(): Promise<void> {
    let lidos: readonly Usuario[]
    try {
      const r = await fetch('/api/usuarios')
      if (!r.ok) throw new Error(String(r.status))
      lidos = ((await r.json()) as unknown[]).map(comoUsuario)
    } catch {
      alert('Não consegui carregar os usuários. Tente de novo.')
      return
    }
    setUsuarios(lidos)
    setModalAberto(true)
  }

  function fecharModal(): void {
    setModalAberto(false)
  }

  async function salvarUsuarios(): Promise<void> {
    const mudancas: MudancaDeUsuario[] = (usuarios ?? []).map((u) => {
      const login = u.usuario
      const novoNome = aparado('edit_nome_' + login)
      const novaSenha = valor('edit_senha_' + login)
      const m: MudancaDeUsuario = { usuario: login, nome: novoNome || u.nome }
      // Vazio quer dizer "nao muda". Depois da fase 0 so existe hash no banco, entao
      // o campo nunca vem preenchido e mandar vazio apagaria a senha de todo mundo.
      if (novaSenha) m.senha = novaSenha
      if (!u.admin) {
        m.bases = TODAS_AS_BASES.filter((b) => caixa('edit_base_' + login + '_' + b.replace(/[^a-z]/gi, '')).checked)
        m.tipos = TODOS_OS_TIPOS.map((t) => t.id).filter((t) => caixa('edit_tipo_' + login + '_' + t).checked)
      }
      return m
    })
    try {
      const r = await fetch('/api/usuarios', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mudancas),
      })
      if (!r.ok) throw new Error(String(r.status))
    } catch {
      alert('Não consegui salvar. Nada foi alterado.')
      return
    }
    fecharModal()
    const sessaoAgora = sessaoAtual.current
    if (sessaoAgora !== null) {
      const meu = mudancas.find((m) => m.usuario === sessaoAgora.usuario)
      if (meu) setNomeExibido(meu.nome)
    }
    alert('✅ Usuários atualizados com sucesso!')
  }

  // ===================== TIPO DE MANUTENÇÃO =====================

  function selecionarTipoManutencao(tipo: TipoManutencao): void {
    tipoManutencaoAtual.current = tipo
    for (const b of [btnPreventiva.current, btnCorretiva.current]) {
      if (b === null) continue
      b.style.borderColor = 'var(--border)'
      b.style.background = 'var(--bg-card)'
      b.style.color = 'var(--txt-dim)'
    }
    const btn = tipo === 'preventiva' ? btnPreventiva.current : btnCorretiva.current
    if (btn === null) return
    if (tipo === 'preventiva') {
      btn.style.borderColor = 'var(--green)'
      btn.style.background = 'var(--green-soft)'
      btn.style.color = 'var(--green)'
    } else {
      btn.style.borderColor = 'var(--orange)'
      btn.style.background = 'var(--orange-soft)'
      btn.style.color = 'var(--orange)'
    }
  }

  // ===================== ABASTECIMENTO MULTI-SLOT =====================

  function onRotaAbastecimentoChange(): void {
    const local = ROTAS_LOCAIS.includes(valor('a_rota'))
    setRotaLocal(local)
    if (local) {
      caixa('a_viagem_longa').checked = false
      onToggleViagemLonga()
    }
  }

  function onToggleViagemLonga(): void {
    setSlots({ longa: caixa('a_viagem_longa').checked, ativos: 1 })
    calcularTotaisAbastecimento()
  }

  function adicionarSlotAbastecimento(): void {
    setSlots((atual) => (atual.ativos >= 3 ? atual : { ...atual, ativos: atual.ativos + 1 }))
  }

  function calcularTotaisAbastecimento(): void {
    if (!caixa('a_viagem_longa').checked) return
    let totalLt = 0
    let totalVal = 0
    let kmInicial: number | null = null
    let kmFinal: number | null = null
    for (let i = 1; i <= 3; i++) {
      const lt = decimal(`a_litros_${i}`)
      const vl = decimal(`a_vl_litro_${i}`)
      const km = inteiro(`a_km_${i}`)
      if (lt > 0) { totalLt += lt; if (vl > 0) totalVal += lt * vl }
      if (km > 0) { if (kmInicial === null) kmInicial = km; kmFinal = km }
    }
    const kmRod = (kmInicial && kmFinal && kmFinal > kmInicial) ? kmFinal - kmInicial : null
    const media = (totalLt > 0 && kmRod) ? (kmRod / totalLt).toFixed(2) : '—'
    setTotais({
      litros: totalLt > 0 ? totalLt.toFixed(2) + ' L' : '—',
      valor: totalVal > 0 ? 'R$ ' + totalVal.toFixed(2) : '—',
      media: media !== '—' ? media + ' km/L' : '—',
      km: kmRod ? kmRod + ' km' : '—',
    })
  }

  async function verificarN8n(): Promise<void> {
    // O resultado nunca chegou a `#statusN8n`. O que a chamada deixa e o proprio ping.
    try {
      await fetch('/saude', { signal: AbortSignal.timeout(3000) })
    } catch {
      // Portao fora do ar nao tira a tela do ar.
    }
  }

  // ===================== DESENHO =====================

  const admin = sessao !== null && sessao.admin
  const permiteTipo = (tipo: Tipo): boolean => sessao === null || sessao.tipos.includes(tipo)
  const permiteBase = (base: string): boolean => sessao === null || sessao.bases.includes(base)
  // O `display` entra no fim porque foi assim que o CSSOM o acrescentou ao atributo
  // que ja vinha com as cores do markup.
  const estiloDaBase = (base: string, cor: string): CSSProperties =>
    permiteBase(base) ? { borderColor: cor, color: cor } : { borderColor: cor, color: cor, display: 'none' }
  // `#formViagem` nasce sem atributo `style`, e so o primeiro `selecionarTipo` lhe da um.
  const estiloDoForm = (tipo: Tipo): CSSProperties | undefined =>
    tipo === 'viagem' && tipoEscolhido === null ? undefined : { display: tipoAtual === tipo ? 'block' : 'none' }

  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-name"><img src="docs/logo-emvidros.svg" alt="EM Vidros" style={{ height: '56px', width: 'auto', display: 'block' }} /></div>
          <div className="brand-sub">Registro Diário · Logística</div>
        </div>
        <div className="nav">
          <div className="nav-label">Registro</div>
          <div className="nav-item ativo"><span className="ico">✏️</span> Registrar Rota</div>
          <div className="nav-label" style={{ marginTop: '8px' }}>Acesso rápido</div>
          <div className="nav-item" onClick={() => { window.location.href = 'dashboard-semanal.html' }}><span className="ico">📊</span> Ver Dashboard</div>
          <div className="nav-item" onClick={() => { window.location.href = 'manutencao-frota.html' }} style={{ position: 'relative' }}><span className="ico">🔧</span> Manutenção Frota <span id="badgeManutencao" style={{ display: 'none', background: 'var(--red)', color: '#fff', fontSize: '.62rem', fontWeight: '700', padding: '1px 6px', borderRadius: '10px', marginLeft: 'auto' }}>0</span></div>
          <div className="nav-item" onClick={() => { window.location.href = 'documentos-frota.html' }} style={{ position: 'relative' }}><span className="ico">📂</span> Documentos <span id="badgeDocumentos" style={{ display: 'none', background: 'var(--red)', color: '#fff', fontSize: '.62rem', fontWeight: '700', padding: '1px 6px', borderRadius: '10px', marginLeft: 'auto' }}>0</span></div>
          <div className="nav-item" onClick={() => { window.location.href = 'ata-reuniao.html' }}><span className="ico">📝</span> Ata de Reunião</div>
          <div className="nav-item" onClick={() => { window.location.href = 'integracao-frota.html' }}><span className="ico">🧑‍🏫</span> Integração</div>
          <div className="nav-item" onClick={exportarDados}><span className="ico">💾</span> Exportar dados</div>
          <div className="nav-item" onClick={() => void limparHoje()}><span className="ico">🗑️</span> Limpar histórico</div>
          <div className="nav-admin" id="menuAdmin" style={{ display: admin ? 'block' : 'none' }}>
            <div className="nav-label">Administração</div>
            <div className="nav-item" onClick={() => void abrirGerenciarUsuarios()}><span className="ico">👥</span> Gerenciar usuários</div>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div id="statusN8n"></div>
          <div style={{ marginTop: '8px', opacity: '.6' }}>v1.0 · Ago 2026</div>
        </div>
        <div className="user-chip">
          <div className="user-avatar" id="userAvatar">{sessao === null ? '?' : sessao.nome.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <div className="user-nome" id="userNome">{nomeExibido}</div>
            <div className="user-base" id="userBaseLabel">{sessao === null ? '—' : sessao.baseFixa}</div>
          </div>
          <button className="btn-logout" onClick={fazerLogout} title="Sair">↩</button>
        </div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Registrar Rota</h1>
            <div className="dia" id="diaAtual">{dataFoto?.dia}</div>
          </div>
          <div style={{ fontSize: '.8rem', color: 'var(--txt-dim)' }} id="contadorHoje">
            {historicoFoto === null ? null : `${historicoFoto.dados.length} registro${historicoFoto.dados.length !== 1 ? 's' : ''} hoje · ${historicoFoto.total} total`}
          </div>
        </div>

        <div className="content">
          <div className="layout-dois">

            <div>
              <div className="seção-titulo" id="labelBase">
                {admin
                  ? <>Base <span style={{ fontSize: '.68rem', color: 'var(--accent)', fontWeight: '600' }}>● Admin</span></>
                  : <>Base <span className="required">*</span></>}
              </div>
              <div className={sessao !== null && !admin ? 'base-selector base-locked' : 'base-selector'} style={{ marginBottom: '20px' }} id="baseSelector">
                {BASES.map((b) => (
                  <button
                    key={b.nome}
                    className={baseAtiva === b.nome ? 'base-btn ativo' : 'base-btn'}
                    id={b.id}
                    onClick={() => void selecionarBase(b.nome)}
                    style={estiloDaBase(b.nome, b.cor)}
                  >{`📍 ${b.nome}`}</button>
                ))}
              </div>

              <div id="adminAviso" style={{ display: vista === 'escolher-base' ? 'block' : 'none', background: 'var(--accent-soft)', border: '2px solid var(--accent)', borderRadius: '10px', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '.88rem', color: 'var(--txt-dim)' }}>Selecione uma base acima para começar o registro</div>
              </div>

              <div id="formArea" style={{ display: vista === 'formulario' ? 'block' : 'none' }}>
                <div className="seção-titulo">Tipo de Registro <span className="required">*</span></div>
                <div className="tipo-grid">
                  {TIPOS_DE_REGISTRO.map((t) => (
                    <button
                      key={t.id}
                      className={tipoAtual === t.id ? 'tipo-btn ativo' : 'tipo-btn'}
                      onClick={() => selecionarTipo(t.id)}
                      style={permiteTipo(t.id) ? undefined : { display: 'none' }}
                    >
                      <span className="tipo-ico">{t.ico}</span>{' '}
                      <span className="tipo-nome">{t.nome}</span>{' '}
                    </button>
                  ))}
                </div>

                <div id="formViagem" className="card" style={estiloDoForm('viagem')}>
                  <div className="card-header"><h2>🚛 Dados da Viagem</h2></div>
                  <div className="card-body">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Data de Saída <span className="required">*</span></label>
                        <input type="date" id="v_data_saida" required />
                      </div>
                      <div className="form-group">
                        <label>Hora de Saída</label>
                        <input type="time" id="v_hora_saida" />
                      </div>
                      <div className="form-group">
                        <label>Data de Chegada <span className="required">*</span></label>
                        <input type="date" id="v_data_chegada" />
                      </div>
                      <div className="form-group">
                        <label>Hora Prevista Chegada <span className="required">*</span></label>
                        <input type="time" id="v_hora_prevista" placeholder="Para calcular pontualidade" />
                      </div>
                      <div className="form-group">
                        <label>Hora Real de Chegada</label>
                        <input type="time" id="v_hora_chegada" />
                        <div className="hint-field">Preencher quando o veículo retornar</div>
                      </div>
                      <div className="form-group">
                        <label>Status de Pontualidade</label>
                        <select id="v_pontualidade">
                          <option value="">-- Selecionar --</option>
                          <option value="adiantado">✅ Adiantado</option>
                          <option value="no_prazo">🟡 No Prazo</option>
                          <option value="atrasado">🔴 Atrasado</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Motorista <span className="required">*</span></label>
                        <input type="text" id="v_motorista" placeholder="Nome do motorista" list="lista-motoristas" />
                        <datalist id="lista-motoristas">
                          {(autocompleteFoto?.motoristas ?? []).map((m) => <option value={m} key={m} />)}
                        </datalist>
                      </div>
                      <div className="form-group">
                        <label>Veículo / Placa <span className="required">*</span></label>
                        <input type="text" id="v_veiculo" placeholder="Ex: NXB2H55" list="lista-veiculos" style={{ textTransform: 'uppercase' }} />
                        <datalist id="lista-veiculos">
                          {(autocompleteFoto?.veiculos ?? []).map((v) => <option value={v} key={v} />)}
                        </datalist>
                      </div>
                      <div className="form-group full">
                        <label>Rota / Destino <span className="required">*</span></label>
                        <input type="text" id="v_rota" placeholder="Ex: Salinópolis, Balsas, Pres. Dutra..." list="lista-rotas" />
                        <datalist id="lista-rotas">
                          {(autocompleteFoto?.rotas ?? []).map((r) => <option value={r} key={r} />)}
                        </datalist>
                      </div>
                      <div className="form-group">
                        <label>km Saída (odômetro)</label>
                        <input type="number" id="v_km_saida" placeholder="Ex: 48520" />
                      </div>
                      <div className="form-group">
                        <label>km Chegada (odômetro)</label>
                        <input type="number" id="v_km_chegada" placeholder="Ex: 49821" />
                      </div>
                      <div className="form-group">
                        <label>Valor da Carga (R$) <span className="required">*</span></label>
                        <input type="number" id="v_valor_carga" placeholder="0,00" step="0.01" min="0" />
                      </div>
                      <div className="form-group">
                        <label>m² Total da Carga</label>
                        <input type="number" id="v_m2" placeholder="0,00" step="0.01" min="0" />
                      </div>
                      <div className="form-group">
                        <label>Peso da Carga (kg)</label>
                        <input type="number" id="v_peso" placeholder="0,00" step="0.01" min="0" />
                      </div>
                      <div className="form-group full">
                        <label>Observação</label>
                        <textarea id="v_obs" placeholder="Ocorrências, avarias, atrasos, informações adicionais..."></textarea>
                      </div>
                      <div className="form-group">
                        <label>Combustível (R$) <span className="required">*</span></label>
                        <input type="number" id="v_combustivel" placeholder="0,00" step="0.01" min="0" onChange={calcularCustoViagem} />
                      </div>
                      <div className="form-group">
                        <label>Diárias (R$) <span className="required">*</span></label>
                        <input type="number" id="v_diarias" placeholder="0,00" step="0.01" min="0" onChange={calcularCustoViagem} />
                      </div>
                      <div className="form-group full">
                        <label>Total Custo da Viagem (R$)</label>
                        <input type="number" id="v_custo_viagem" placeholder="Calculado automaticamente" step="0.01" min="0" readOnly style={{ background: '#f0f4ff', color: 'var(--accent)', fontWeight: '700', cursor: 'default' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div id="formAbastecimento" className="card" style={estiloDoForm('abastecimento')}>
                  <div className="card-header"><h2>⛽ Dados do Abastecimento</h2></div>
                  <div className="card-body">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Data <span className="required">*</span></label>
                        <input type="date" id="a_data" />
                      </div>
                      <div className="form-group">
                        <label>Placa <span className="required">*</span></label>
                        <input type="text" id="a_placa" placeholder="Ex: NXB2H55" list="lista-veiculos2" style={{ textTransform: 'uppercase' }} />
                        <datalist id="lista-veiculos2">
                          {(autocompleteFoto?.veiculos ?? []).map((v) => <option value={v} key={v} />)}
                        </datalist>
                      </div>
                      <div className="form-group full">
                        <label>Rota Vinculada</label>
                        <select id="a_rota" onChange={onRotaAbastecimentoChange}>
                          <option value="">-- Sem rota --</option>
                          {(autocompleteFoto?.rotasAb ?? []).map((r) => <option value={r} key={r}>{r}</option>)}
                        </select>
                        <div className="hint-field">Vincula o custo ao indicador de rota correto</div>
                      </div>
                    </div>
                    <div style={{ display: rotaLocal ? 'none' : 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 6px', padding: '12px 14px', background: 'var(--bg-app)', borderRadius: '8px', border: '1.5px solid var(--border)' }}>
                      {' '}
                      <input type="checkbox" id="a_viagem_longa" style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: 'var(--accent)' }} onChange={onToggleViagemLonga} />
                      {' '}
                      <label htmlFor="a_viagem_longa" style={{ cursor: 'pointer', fontSize: '.88rem', fontWeight: '600', color: 'var(--txt-main)', margin: '0' }}>Viagem longa (interior) — múltiplos abastecimentos</label>
                      {' '}
                    </div>
                    <div id="a_slot_1">
                      <div className="ab-slot-titulo" id="a_slot_1_titulo" style={{ display: slots.longa ? 'block' : 'none' }}>1º Abastecimento <span style={{ fontSize: '.72rem', fontWeight: '400', color: 'var(--txt-muted)' }}>· saída / início</span></div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Litros <span className="required">*</span></label>
                          <input type="number" id="a_litros_1" placeholder="0,00" step="0.01" min="0" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>Valor R$/Litro <span className="required">*</span></label>
                          <input type="number" id="a_vl_litro_1" placeholder="0,000" step="0.001" min="0" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>km Odômetro</label>
                          <input type="number" id="a_km_1" placeholder="Ex: 48750" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>Posto / Fornecedor</label>
                          <input type="text" id="a_posto_1" placeholder="Nome do posto" />
                        </div>
                      </div>
                    </div>
                    <div id="a_slot_2" style={{ display: slots.ativos >= 2 ? 'block' : 'none' }}>
                      <div className="ab-slot-titulo">2º Abastecimento <span style={{ fontSize: '.72rem', fontWeight: '400', color: 'var(--txt-muted)' }}>· interior</span></div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Litros</label>
                          <input type="number" id="a_litros_2" placeholder="0,00" step="0.01" min="0" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>Valor R$/Litro</label>
                          <input type="number" id="a_vl_litro_2" placeholder="0,000" step="0.001" min="0" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>km Odômetro</label>
                          <input type="number" id="a_km_2" placeholder="Ex: 49300" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>Posto / Fornecedor</label>
                          <input type="text" id="a_posto_2" placeholder="Nome do posto" />
                        </div>
                      </div>
                    </div>
                    <div id="a_slot_3" style={{ display: slots.ativos >= 3 ? 'block' : 'none' }}>
                      <div className="ab-slot-titulo">3º Abastecimento <span style={{ fontSize: '.72rem', fontWeight: '400', color: 'var(--txt-muted)' }}>· chegada</span></div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Litros</label>
                          <input type="number" id="a_litros_3" placeholder="0,00" step="0.01" min="0" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>Valor R$/Litro</label>
                          <input type="number" id="a_vl_litro_3" placeholder="0,000" step="0.001" min="0" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>km Odômetro</label>
                          <input type="number" id="a_km_3" placeholder="Ex: 50100" onChange={calcularTotaisAbastecimento} />
                        </div>
                        <div className="form-group">
                          <label>Posto / Fornecedor</label>
                          <input type="text" id="a_posto_3" placeholder="Nome do posto" />
                        </div>
                      </div>
                    </div>
                    <div id="a_btn_adicionar_container" style={{ display: slots.longa && slots.ativos < 3 ? 'block' : 'none', marginTop: '10px' }}>
                      {' '}
                      <button type="button" onClick={adicionarSlotAbastecimento} id="a_btn_adicionar" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1.5px dashed var(--accent)', borderRadius: '8px', padding: '9px 18px', fontSize: '.85rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>+ Adicionar abastecimento</button>
                      {' '}
                    </div>
                    <div id="a_totais" style={{ display: slots.longa ? 'block' : 'none', marginTop: '14px', background: 'var(--accent-soft)', border: '1.5px solid var(--accent)', borderRadius: '8px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '.72rem', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>Totais da Viagem</div>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div><span style={{ fontSize: '.75rem', color: 'var(--txt-dim)' }}>Total Litros</span><br /><strong id="a_total_litros" style={{ fontSize: '1rem', color: 'var(--txt-main)' }}>{totais.litros}</strong></div>
                        <div><span style={{ fontSize: '.75rem', color: 'var(--txt-dim)' }}>Total R$</span><br /><strong id="a_total_valor" style={{ fontSize: '1rem', color: 'var(--txt-main)' }}>{totais.valor}</strong></div>
                        <div><span style={{ fontSize: '.75rem', color: 'var(--txt-dim)' }}>Média km/L</span><br /><strong id="a_media_km" style={{ fontSize: '1rem', color: 'var(--green)' }}>{totais.media}</strong></div>
                        <div><span style={{ fontSize: '.75rem', color: 'var(--txt-dim)' }}>km Rodados</span><br /><strong id="a_km_rodados" style={{ fontSize: '1rem', color: 'var(--txt-main)' }}>{totais.km}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div id="formManutencao" className="card" style={estiloDoForm('manutencao')}>
                  <div className="card-header"><h2>🔧 Dados da Manutenção</h2></div>
                  <div className="card-body">
                    <div className="seção-titulo" style={{ marginBottom: '10px' }}>Tipo <span className="required">*</span></div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                      <button ref={btnPreventiva} type="button" className="tipo-manut-btn ativo" id="btnPreventiva" onClick={() => selecionarTipoManutencao('preventiva')} style={{ flex: '1', border: '2px solid var(--green)', background: 'var(--green-soft)', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '.85rem', fontWeight: '700', color: 'var(--green)', fontFamily: 'inherit' }}>🛡️ Preventiva</button>
                      <button ref={btnCorretiva} type="button" className="tipo-manut-btn" id="btnCorretiva" onClick={() => selecionarTipoManutencao('corretiva')} style={{ flex: '1', border: '2px solid var(--border)', background: 'var(--bg-card)', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '.85rem', fontWeight: '700', color: 'var(--txt-dim)', fontFamily: 'inherit' }}>🔨 Corretiva</button>
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Data Programada (envio ao fornecedor)</label>
                        <input type="date" id="m_data_programada" />
                        <div className="hint-field">Data planejada para enviar o veículo</div>
                      </div>
                      <div className="form-group">
                        <label>Placa <span className="required">*</span></label>
                        <input type="text" id="m_placa" placeholder="Ex: NXB2H55" list="lista-veiculos3" style={{ textTransform: 'uppercase' }} />
                        <datalist id="lista-veiculos3">
                          {(autocompleteFoto?.veiculos ?? []).map((v) => <option value={v} key={v} />)}
                        </datalist>
                      </div>
                      <div className="form-group">
                        <label>Data de Entrada na Oficina (realizada) <span className="required">*</span></label>
                        <input type="date" id="m_data_entrada" />
                      </div>
                      <div className="form-group">
                        <label>Hora de Entrada</label>
                        <input type="time" id="m_hora_entrada" />
                      </div>
                      <div className="form-group">
                        <label>Data de Saída da Oficina</label>
                        <input type="date" id="m_data_saida" />
                        <div className="hint-field">Preencher quando o veículo retornar</div>
                      </div>
                      <div className="form-group">
                        <label>Hora de Saída</label>
                        <input type="time" id="m_hora_saida" />
                      </div>
                      <div className="form-group">
                        <label>km do Veículo (odômetro)</label>
                        <input type="number" id="m_km" placeholder="Ex: 48520" />
                      </div>
                      <div className="form-group">
                        <label>Fornecedor / Oficina</label>
                        <input type="text" id="m_fornecedor" placeholder="Nome da oficina" />
                      </div>
                      <div className="form-group full">
                        <label>Serviço / Descrição <span className="required">*</span></label>
                        <input type="text" id="m_servico" placeholder="Ex: Troca de óleo, revisão de freios..." />
                      </div>
                      <div className="form-group">
                        <label>Valor (R$) <span className="required">*</span></label>
                        <input type="number" id="m_valor" placeholder="0,00" step="0.01" min="0" />
                      </div>
                    </div>
                    <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--bg-app)', border: '1.5px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '.72rem', fontWeight: '700', color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>📎 Documentos (anexar após realização)</div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1', minWidth: '200px' }}>
                          <label style={{ fontSize: '.72rem', fontWeight: '600', color: 'var(--txt-dim)', display: 'block', marginBottom: '4px' }}>Orçamento (PDF)</label>
                          {' '}
                          <input type="file" id="m_doc_orcamento" accept=".pdf,image/*" style={{ width: '100%', fontSize: '.8rem' }} />
                          {' '}
                        </div>
                        <div style={{ flex: '1', minWidth: '200px' }}>
                          <label style={{ fontSize: '.72rem', fontWeight: '600', color: 'var(--txt-dim)', display: 'block', marginBottom: '4px' }}>Ordem de Serviço assinada (PDF)</label>
                          {' '}
                          <input type="file" id="m_doc_os" accept=".pdf,image/*" style={{ width: '100%', fontSize: '.8rem' }} />
                          {' '}
                        </div>
                      </div>
                      <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)', marginTop: '6px' }}>Sem documentos: registro fica como 📎 Pendente de Documento</div>
                    </div>
                  </div>
                </div>

                <div id="formQuebra" className="card" style={estiloDoForm('quebra')}>
                  <div className="card-header"><h2>📦 Dados da Quebra de Expedição</h2></div>
                  <div className="card-body">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Data <span className="required">*</span></label>
                        <input type="date" id="q_data" />
                      </div>
                      <div className="form-group">
                        <label>m² Expedido <span className="required">*</span></label>
                        <input type="number" id="q_m2_expedido" placeholder="Total expedido no dia" step="0.01" min="0" />
                      </div>
                      <div className="form-group">
                        <label>m² com Quebra <span className="required">*</span></label>
                        <input type="number" id="q_m2_quebrado" placeholder="m² danificado/devolvido" step="0.01" min="0" />
                      </div>
                      <div className="form-group full">
                        <label>Observação</label>
                        <textarea id="q_obs" placeholder="Motivo, NF, cliente afetado..."></textarea>
                      </div>
                    </div>
                  </div>
                </div>

                {' '}
                <button ref={btnRegistrar} className="btn-registrar" onClick={() => void registrar()}>✅ Registrar</button>
                {' '}
                <div className={feedback === null ? 'feedback' : `feedback ${feedback.tipo}`} id="feedback">{feedback?.msg}</div>
              </div>
            </div>

            <div>
              <div className="card">
                <div className="card-header">
                  <h2>Histórico <span className="hoje-chip" id="chipBase">{chipBase}</span></h2>
                  <span style={{ fontSize: '.78rem', color: 'var(--txt-dim)' }} id="labelHoje">{dataFoto === null ? 'Hoje' : dataFoto.hoje}</span>
                </div>
                <div className="card-body" style={{ padding: '12px 16px', maxHeight: '520px', overflowY: 'auto' }}>
                  <div className="historico-lista" id="historicoLista"><CorpoHistorico foto={historicoFoto} /></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <div className={modalAberto ? 'modal-overlay aberto' : 'modal-overlay'} id="modalUsuarios">
        <div className="modal">
          <div className="modal-header">
            <h3>👥 Gerenciar Usuários</h3>
            <button className="modal-close" onClick={fecharModal}>✕</button>
          </div>
          <div className="modal-body" id="modalUsuariosBody"><CorpoUsuarios usuarios={usuarios} /></div>
          <div className="modal-footer">
            <button className="btn-cancelar" onClick={fecharModal}>Cancelar</button>
            <button className="btn-salvar" onClick={() => void salvarUsuarios()}>💾 Salvar alterações</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ===================== PEDACOS =====================

function CorpoHistorico({ foto }: { foto: HistoricoFoto | null }): JSX.Element {
  if (foto === null) return <div className="hist-vazio">Nenhum registro hoje.</div>
  if (foto.dados.length === 0) {
    return (
      <div className="hist-vazio">
        {foto.erro !== null
          ? `⚠️ Não consegui carregar os registros: ${foto.erro}. Recarregue a página.`
          : `Nenhum registro hoje para ${foto.base}.`}
      </div>
    )
  }
  return (
    <>
      {foto.dados.map((d, i) => {
        const hora = new Date(campoTexto(d, 'registrado_em') ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        let titulo = ''
        let detalhe = ''
        if (d.tipo === 'viagem') {
          const combustivel = campoNumero(d, 'combustivel')
          const detCusto = combustivel !== null
            ? `⛽R$${ptBr(combustivel, 0)} + 🏨R$${ptBr(campoNumero(d, 'diarias'), 0)}`
            : `R$${ptBr(campoNumero(d, 'custo_viagem'), 0)}`
          titulo = `${campoTexto(d, 'rota')} · ${campoTexto(d, 'motorista')}`
          detalhe = `${campoTexto(d, 'veiculo')} · R$${ptBr(campoNumero(d, 'valor_carga'), 0)} carga · ${detCusto} · ${campoNumero(d, 'pct_custo')}%`
        } else if (d.tipo === 'abastecimento') {
          titulo = `${campoTexto(d, 'placa')} · ${campoNumero(d, 'litros')}L`
          detalhe = `R$${campoNumero(d, 'vl_litro')?.toFixed(3)}/L · Total R$${campoNumero(d, 'valor_total')?.toFixed(2)}`
        } else if (d.tipo === 'manutencao') {
          const dias = campoNumero(d, 'dias_oficina')
          titulo = `${campoTexto(d, 'placa')} · ${campoTexto(d, 'servico')}`
          detalhe = `R$${ptBr(campoNumero(d, 'valor'), 2)} · ${campoTexto(d, 'fornecedor') || '—'}${dias !== null ? ' · ' + dias + 'd oficina' : ''}`
        } else if (d.tipo === 'quebra') {
          titulo = `${campoNumero(d, 'm2_expedido')} m² expedido · ${campoNumero(d, 'm2_quebrado')} m² quebrado`
          detalhe = `${campoNumero(d, 'pct_quebra')}% quebra`
        }
        return (
          <div className="hist-item" key={i}>
            <div className={`hist-tipo ${d.tipo}`}>{ICOS_DO_HISTORICO[d.tipo] ?? '📝'}</div>
            <div className="hist-info"><div className="hist-titulo">{titulo}</div><div className="hist-detalhe">{detalhe}</div></div>
            <div className="hist-hora">{hora}</div>
          </div>
        )
      })}
    </>
  )
}

function CorpoUsuarios({ usuarios }: { usuarios: readonly Usuario[] | null }): JSX.Element | null {
  if (usuarios === null) return null
  return (
    <>
      {usuarios.map((u) => {
        const login = u.usuario
        return (
          <div className="user-card" key={login}>
            <div className="user-card-header">
              <div className="user-badge">{u.nome.charAt(0).toUpperCase()}</div>
              <div className="info">
                <div className="user-login">{login}</div>
                <div className="user-base-tag">{ROTULO_DE_BASE[u.baseFixa ?? ''] ?? '🔑 Admin'}</div>
              </div>
            </div>
            <div className="user-fields">
              <div>
                <label>Nome exibido</label>
                {' '}
                <input type="text" id={`edit_nome_${login}`} defaultValue={u.nome} />
                {' '}
              </div>
              <div>
                <label>Senha</label>
                {' '}
                <input type="password" id={`edit_senha_${login}`} defaultValue="" placeholder="Nova senha" />
                {' '}
              </div>
            </div>
            {u.admin ? null : (
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: '700', color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: '6px' }}>Bases liberadas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {TODAS_AS_BASES.map((b) => (
                      <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.8rem', fontWeight: '500', textTransform: 'none', color: 'var(--txt-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          id={`edit_base_${login}_${b.replace(/[^a-z]/gi, '')}`}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                          defaultChecked={u.bases.includes(b)}
                        />
                        {` ${b} `}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: '700', color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: '6px' }}>Tipos liberados</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {TODOS_OS_TIPOS.map((t) => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.8rem', fontWeight: '500', textTransform: 'none', color: 'var(--txt-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          id={`edit_tipo_${login}_${t.id}`}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                          defaultChecked={u.tipos.includes(t.id)}
                        />
                        {` ${t.ico} ${t.label} `}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<FormularioRegistro />)
