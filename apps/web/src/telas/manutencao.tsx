/**
 * Manutencao da frota. O artboard e o `Manutencao` de `var/design-dashboard/build.mjs`, e
 * ele manda no desenho. O comportamento vem de `manutencao-frota.tsx`: as contas do plano
 * preventivo, a leitura de km dos registros e o import de CSV sao as mesmas.
 *
 * A coluna "Programada" do artboard saiu. `data_programada` e campo de registro de
 * manutencao, e nao de item de plano preventivo, que e o que esta tabela lista. A coluna
 * "OS" das corretivas saiu pelo mesmo motivo: nao ha numero de ordem de servico em
 * registro nenhum. Coluna desenhada que so mostraria ponto medio nao ajuda quem le.
 *
 * O botao "Configurar" do topo tambem saiu. Configurar preventiva e por veiculo, e um
 * botao de pagina teria que perguntar qual placa antes de fazer qualquer coisa. As duas
 * acoes por veiculo do legado viraram uma coluna de acoes, que o artboard nao tem.
 *
 * A terceira parte do subtitulo e a contagem de pendencias documentais. O resumo do
 * legado tem quatro numeros e a triade do artboard so cabe tres, entao o quarto subiu
 * para o subtitulo, onde continua visivel sem disputar espaco com as estatisticas.
 *
 * O km de cada veiculo cai em `ULTIMO_KM_PGQ` quando nenhum registro traz odometro, e
 * cai tambem no resumo. No legado o fallback valia so nos cartoes, entao a soma de cima
 * e a lista de baixo discordavam sobre a mesma frota. Aqui e um km por veiculo, usado
 * nos dois lugares.
 *
 * O dialogo do plano nao tem "Salvar". Cada adicao e cada remocao gravam na hora, entao o
 * botao so poderia mentir sobre haver algo pendente. Reverter e nao invalidar: quem tem o
 * plano e o recurso, e a tela nunca guarda copia mutavel dele.
 */
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { invalidar, useRecurso, useSessao } from '../app/dados.ts'
import { navegar } from '../app/navegacao.tsx'
import {
  Campo,
  CampoDeArquivo,
  Chips,
  Dialogo,
  GradeDeCampos,
  TituloDeSecao,
  useAvisos,
} from '../geist/formulario.tsx'
import { CloudUpload, Plus, SettingsGear, Trash } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Esqueleto,
  Estatistica,
  Grade,
  Seletor,
  Tabela,
  Td,
  Th,
  classes,
} from '../geist/primitivos.tsx'
import type { CorDeBadge, Opcao } from '../geist/primitivos.tsx'
import { obterCadastro } from '../js/cadastro-api.ts'
import { gravarPreventiva, obterPreventiva } from '../js/preventiva-api.ts'
import type {
  EntradaItemPreventivo,
  ItemPreventivo,
  TipoPreventivo,
  VeiculoPreventivo,
} from '../js/preventiva-api.ts'
import { listarRegistros, salvarRegistros } from '../js/registros-api.ts'
import type { Registro } from '../js/registros-api.ts'

// ---------- tabelas de configuracao ----------

/**
 * A ordem em que os itens aparecem na tabela e no select de adicionar. A API devolve os
 * dois em ordem alfabetica de tipo, e a tela nunca mostrou assim: o PGQ lista a preventiva
 * geral antes da lavagem, e "Lavagem" vem antes de "Manutencao" no alfabeto.
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

// O km do PGQ Manutencao Preventiva 2026, para a placa que nenhum registro traz odometro.
// Fica ate o banco guardar essa leitura.
const ULTIMO_KM_PGQ: Readonly<Record<string, number>> = {
  PTV0006: 408413,
  PTT0004: 354277,
  ROW3A87: 176585,
  SMP6F86: 136720,
  SMQ2I80: 40000,
}

// O POST aceita 100 registros por vez, e a planilha importada costuma passar disso.
const LOTE_IMPORT = 100

const VAZIO = '·'

const OUTRO = '__outro__'

type StatusItem = 'vencida' | 'alerta' | 'ok' | 'sem_dado'

/** Qual item a linha da tabela mostra: o mais grave primeiro, o mais perto depois. */
const PRIORIDADE: Readonly<Record<StatusItem, number>> = {
  vencida: 0,
  alerta: 1,
  ok: 2,
  sem_dado: 3,
}

const BADGE_DO_STATUS: Readonly<Record<StatusItem, { readonly rotulo: string; readonly cor: CorDeBadge }>> = {
  vencida: { rotulo: 'Vencida', cor: 'vermelho' },
  alerta: { rotulo: 'Próxima', cor: 'ambar' },
  ok: { rotulo: 'Em dia', cor: 'verde' },
  sem_dado: { rotulo: 'Sem dado', cor: 'cinza' },
}

const TOM_DO_STATUS: Readonly<Record<StatusItem, string | null>> = {
  vencida: 'g-tom-critico',
  alerta: 'g-tom-atencao',
  ok: null,
  sem_dado: null,
}

const ABAS = ['Preventivas', 'Corretivas', 'Histórico']

const COLUNAS_PREVENTIVAS: ReadonlyArray<{ readonly rotulo: string; readonly direita: boolean }> = [
  { rotulo: 'Placa', direita: false },
  { rotulo: 'Modelo', direita: false },
  { rotulo: 'Serviço', direita: false },
  { rotulo: 'km atual', direita: true },
  { rotulo: 'km previsto', direita: true },
  { rotulo: 'Faltam', direita: true },
  { rotulo: 'Status', direita: false },
  { rotulo: '', direita: false },
]

const COLUNAS_CORRETIVAS = ['Data', 'Placa', 'Serviço', 'Fornecedor', 'Valor', 'Status']
const COLUNAS_HISTORICO = ['Data', 'Placa', 'Tipo', 'Serviço', 'Fornecedor', 'Valor', 'Status']

type FiltroDeTipo = 'todos' | 'preventiva' | 'corretiva'
type FiltroDeDoc = 'todos' | 'pendente' | 'concluido'

const OPCOES_DE_TIPO: ReadonlyArray<Opcao<FiltroDeTipo>> = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'preventiva', rotulo: 'Preventivas' },
  { valor: 'corretiva', rotulo: 'Corretivas' },
]

const OPCOES_DE_DOC: ReadonlyArray<Opcao<FiltroDeDoc>> = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendente de doc' },
  { valor: 'concluido', rotulo: 'Doc OK' },
]

// ---------- leitura do registro ----------

// O registro chega do servidor como saco de campos, e cada tela le os seus. Ler com
// `typeof` e o que impede um campo que mudou de forma no banco de virar
// `undefined.toLocaleString()` no meio do desenho.
function texto(r: Registro, campo: string): string | null {
  const valor = r[campo]
  return typeof valor === 'string' ? valor : null
}

function numero(r: Registro, campo: string): number | null {
  const valor = r[campo]
  return typeof valor === 'number' ? valor : null
}

// ---------- o plano avaliado ----------

type ItemAvaliado = ItemPreventivo & {
  readonly status: StatusItem
  readonly proximoKm: number | null
  readonly restante: number | null
}

type VeiculoAvaliado = {
  readonly id: string
  readonly placa: string
  readonly base: string
  readonly modelo: string | null
  readonly marca: string | null
  readonly ano: string | null
  readonly kmAtual: number | null
  readonly itens: readonly ItemAvaliado[]
  readonly urgente: ItemAvaliado | null
}

/**
 * A lista na ordem de `tipos`, com o que nao estiver nela depois, como veio. A API ordena
 * por nome, e a tela nunca mostrou assim.
 */
function naOrdemDoCatalogo<T extends { tipo: string }>(itens: readonly T[], tipos: readonly string[]): T[] {
  const posicao = new Map(tipos.map((tipo, i) => [tipo, i]))
  return [...itens].sort((a, b) => (posicao.get(a.tipo) ?? tipos.length) - (posicao.get(b.tipo) ?? tipos.length))
}

function calcularStatus(item: ItemPreventivo, kmAtual: number | null): ItemAvaliado {
  if (!item.ultimo_km) return { ...item, status: 'sem_dado', proximoKm: null, restante: null }
  const proximoKm = item.ultimo_km + item.intervalo_km
  const restante = proximoKm - (kmAtual ?? item.ultimo_km)
  const status: StatusItem = restante <= 0 ? 'vencida' : restante <= item.alerta_km ? 'alerta' : 'ok'
  return { ...item, status, proximoKm, restante }
}

function kmAtualPorPlaca(registros: readonly Registro[], placa: string): number | null {
  let maior: number | null = null
  for (const r of registros) {
    const p = (texto(r, 'veiculo') ?? texto(r, 'placa') ?? '').toUpperCase()
    if (p !== placa.toUpperCase()) continue
    for (const campo of ['km_chegada', 'km', 'km_odometro']) {
      const v = numero(r, campo)
      if (v === null || v <= 0) continue
      if (maior === null || v > maior) maior = v
    }
  }
  return maior
}

function maisUrgente(itens: readonly ItemAvaliado[]): ItemAvaliado | null {
  const ordenados = [...itens].sort((a, b) =>
    PRIORIDADE[a.status] - PRIORIDADE[b.status] ||
    (a.restante ?? Number.POSITIVE_INFINITY) - (b.restante ?? Number.POSITIVE_INFINITY)
  )
  return ordenados[0] ?? null
}

function avaliar(veiculo: VeiculoPreventivo, registros: readonly Registro[]): VeiculoAvaliado {
  const kmAtual = kmAtualPorPlaca(registros, veiculo.placa) ?? ULTIMO_KM_PGQ[veiculo.placa] ?? null
  const itens = naOrdemDoCatalogo(veiculo.itens, ORDEM_CATALOGO).map((item) => calcularStatus(item, kmAtual))
  return {
    id: veiculo.id,
    placa: veiculo.placa,
    base: veiculo.base,
    modelo: veiculo.modelo,
    marca: veiculo.marca,
    ano: veiculo.ano,
    kmAtual,
    itens,
    urgente: maisUrgente(itens),
  }
}

// ---------- texto ----------

/** Falha de rede nao tem resposta e vira TypeError; com resposta, o texto e da API. */
function motivoDaFalha(e: unknown, padrao: string): string {
  if (e instanceof TypeError) return 'Sem conexão. Tente de novo.'
  return e instanceof Error ? e.message : padrao
}

function diaMes(data: string | null): string {
  const [, mes, dia] = (data ?? '').slice(0, 10).split('-')
  return mes === undefined || dia === undefined ? VAZIO : `${dia}/${mes}`
}

function brl(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function emKm(valor: number | null): string {
  return valor === null ? VAZIO : valor.toLocaleString('pt-BR')
}

/** O `−` e o U+2212 do artboard, e nao o hifen: ele alinha com os digitos da coluna. */
function faltam(restante: number): string {
  return `${restante < 0 ? '−' : ''}${Math.abs(restante).toLocaleString('pt-BR')} km`
}

function apoioDasVencidas(placas: readonly string[]): string {
  if (placas.length === 0) return 'nenhuma placa passou do km'
  if (placas.length === 1) return `${placas[0]} passou do km`
  if (placas.length === 2) return `${placas.join(' e ')} passaram do km`
  return `${placas.slice(0, 2).join(', ')} e mais ${placas.length - 2} passaram do km`
}

/** `exactOptionalPropertyTypes` recusa `erro={undefined}`, entao a prop entra ou nao entra. */
function propErro(mensagem: string | null): { readonly erro?: string } {
  return mensagem === null ? {} : { erro: mensagem }
}

// ---------- tabela das preventivas ----------

function LinhaPreventiva({ veiculo, aoConfigurar }: {
  readonly veiculo: VeiculoAvaliado
  readonly aoConfigurar: () => void
}): JSX.Element {
  const { urgente } = veiculo
  return (
    <tr>
      <Td><span className="g-l13m g-forte">{veiculo.placa}</span></Td>
      <Td><span className="g-fraco">{veiculo.modelo ?? VAZIO}</span></Td>
      <Td>
        {urgente === null
          ? <span className="g-fraco">Nenhum item configurado</span>
          : urgente.tipo}
      </Td>
      <Td direita>{veiculo.kmAtual === null ? <span className="g-fraco">{VAZIO}</span> : emKm(veiculo.kmAtual)}</Td>
      <Td direita>
        {urgente === null || urgente.proximoKm === null
          ? <span className="g-fraco">{VAZIO}</span>
          : emKm(urgente.proximoKm)}
      </Td>
      <Td direita>
        {urgente === null || urgente.restante === null
          ? <span className="g-fraco">{VAZIO}</span>
          : <span className={classes('g-forte', TOM_DO_STATUS[urgente.status])}>{faltam(urgente.restante)}</span>}
      </Td>
      <Td>
        {urgente === null
          ? <span className="g-fraco">{VAZIO}</span>
          : <Badge rotulo={BADGE_DO_STATUS[urgente.status].rotulo} cor={BADGE_DO_STATUS[urgente.status].cor} />}
      </Td>
      <Td>
        <div className="g-rodape-acoes">
          <Botao
            antes={SettingsGear}
            nome={`Configurar preventivas de ${veiculo.placa}`}
            aoClicar={aoConfigurar}
          />
          <Botao
            antes={Plus}
            nome={`Registrar manutenção de ${veiculo.placa}`}
            aoClicar={() => navegar(`/registrar?placa=${veiculo.placa}&tipo=manutencao`)}
          />
        </div>
      </Td>
    </tr>
  )
}

function TabelaDePreventivas({ veiculos, aoConfigurar }: {
  readonly veiculos: readonly VeiculoAvaliado[]
  readonly aoConfigurar: (placa: string) => void
}): JSX.Element {
  return (
    <>
      <CabecalhoDeBloco
        titulo="Preventivas por veículo"
        subtitulo="km previsto é o último serviço mais o intervalo do tipo"
      />
      <Tabela
        cabecalho={COLUNAS_PREVENTIVAS.map((coluna) => (
          <Th key={coluna.rotulo === '' ? 'acoes' : coluna.rotulo} direita={coluna.direita}>{coluna.rotulo}</Th>
        ))}
      >
        {veiculos.length === 0
          ? <tr><Td colunas={COLUNAS_PREVENTIVAS.length} vazio>Nenhum veículo nesta base</Td></tr>
          : veiculos.map((veiculo) => (
            <LinhaPreventiva
              key={veiculo.id}
              veiculo={veiculo}
              aoConfigurar={() => aoConfigurar(veiculo.placa)}
            />
          ))}
      </Tabela>
    </>
  )
}

// ---------- tabelas de manutencoes ----------

function LinhaDeManutencao({ registro, comTipo }: {
  readonly registro: Registro
  readonly comTipo: boolean
}): JSX.Element {
  const preventiva = texto(registro, 'tipo_manutencao') === 'preventiva'
  const concluido = texto(registro, 'status_documental') === 'concluido'
  return (
    <tr>
      <Td><span className="g-l13m g-fraco">{diaMes(dataDoRegistro(registro))}</span></Td>
      <Td><span className="g-l13m g-forte">{texto(registro, 'placa') || VAZIO}</span></Td>
      {comTipo
        ? (
          <Td>
            <Badge
              rotulo={preventiva ? 'Preventiva' : 'Corretiva'}
              cor={preventiva ? 'teal' : 'cinza'}
              comIcone={false}
            />
          </Td>
        )
        : null}
      <Td>{texto(registro, 'servico') || VAZIO}</Td>
      <Td>{texto(registro, 'fornecedor') || VAZIO}</Td>
      <Td direita>{brl(numero(registro, 'valor') ?? 0)}</Td>
      <Td>
        <Badge
          rotulo={concluido ? 'Concluída' : 'Pendente'}
          cor={concluido ? 'verde' : 'ambar'}
        />
      </Td>
    </tr>
  )
}

function TabelaDeManutencoes({ titulo, subtitulo, direita, colunas, registros, vazio }: {
  readonly titulo: string
  readonly subtitulo: string
  readonly direita?: JSX.Element
  readonly colunas: readonly string[]
  readonly registros: readonly Registro[]
  readonly vazio: string
}): JSX.Element {
  const comTipo = colunas.includes('Tipo')
  return (
    <>
      <CabecalhoDeBloco titulo={titulo} subtitulo={subtitulo} direita={direita} />
      <Tabela
        cabecalho={colunas.map((coluna) => (
          <Th key={coluna} direita={coluna === 'Valor'}>{coluna}</Th>
        ))}
      >
        {registros.length === 0
          ? <tr><Td colunas={colunas.length} vazio>{vazio}</Td></tr>
          : registros.map((registro, i) => (
            <LinhaDeManutencao key={i} registro={registro} comTipo={comTipo} />
          ))}
      </Tabela>
    </>
  )
}

// ---------- dialogo do plano ----------

type Formulario = {
  readonly tipo: string
  readonly descricao: string
  readonly intervalo: string
  readonly alerta: string
  readonly ultimo: string
}

const FORMULARIO_VAZIO: Formulario = { tipo: '', descricao: '', intervalo: '', alerta: '', ultimo: '' }

type Erros = {
  readonly tipo: string | null
  readonly descricao: string | null
  readonly intervalo: string | null
}

const SEM_ERROS: Erros = { tipo: null, descricao: null, intervalo: null }

function paraEntrada(item: ItemPreventivo): EntradaItemPreventivo {
  return {
    tipo: item.tipo,
    intervalo_km: item.intervalo_km,
    alerta_km: item.alerta_km,
    ultimo_km: item.ultimo_km,
    obs: item.obs,
  }
}

function DialogoDoPlano({ veiculo, tipos, aoFechar }: {
  readonly veiculo: VeiculoAvaliado
  readonly tipos: readonly TipoPreventivo[]
  readonly aoFechar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VAZIO)
  const [erros, setErros] = useState<Erros>(SEM_ERROS)
  const [aRemover, setARemover] = useState<ItemAvaliado | null>(null)
  const [gravando, setGravando] = useState(false)

  const opcoes: readonly Opcao[] = [
    ...naOrdemDoCatalogo(tipos, ORDEM_CATALOGO).map((t) => ({ valor: t.tipo, rotulo: t.tipo })),
    { valor: OUTRO, rotulo: 'Outro (digitar abaixo)' },
  ]

  const gravar = async (itens: readonly EntradaItemPreventivo[], feito: string): Promise<boolean> => {
    setGravando(true)
    try {
      await gravarPreventiva(veiculo.id, [...itens])
      invalidar('preventiva')
      avisar(feito, 'ok')
      return true
    } catch (e) {
      avisar(motivoDaFalha(e, 'Não foi possível salvar.'), 'erro')
      return false
    } finally {
      setGravando(false)
    }
  }

  const adicionar = async (): Promise<void> => {
    const nome = formulario.tipo === OUTRO ? formulario.descricao.trim() : formulario.tipo
    const intervalo = Number.parseInt(formulario.intervalo, 10) || 0
    const achados: Erros = {
      tipo: formulario.tipo === '' ? 'Escolha o tipo de manutenção.' : null,
      descricao: formulario.tipo === OUTRO && nome === '' ? 'Escreva a descrição do item.' : null,
      intervalo: intervalo > 0 ? null : 'Informe o intervalo em km.',
    }
    setErros(achados)
    if (achados.tipo !== null || achados.descricao !== null || achados.intervalo !== null) return
    const novo: EntradaItemPreventivo = {
      tipo: nome,
      intervalo_km: intervalo,
      alerta_km: Number.parseInt(formulario.alerta, 10) || 500,
      ultimo_km: Number.parseInt(formulario.ultimo, 10) || null,
      obs: null,
    }
    if (await gravar([...veiculo.itens.map(paraEntrada), novo], 'Item adicionado')) {
      setFormulario(FORMULARIO_VAZIO)
      setErros(SEM_ERROS)
    }
  }

  const remover = async (item: ItemAvaliado): Promise<void> => {
    const restantes = veiculo.itens
      .filter((i) => i.tipo_preventivo_id !== item.tipo_preventivo_id)
      .map(paraEntrada)
    if (await gravar(restantes, 'Item removido')) setARemover(null)
  }

  return (
    <>
      <Dialogo
        aberto
        titulo={`Preventivas · ${veiculo.placa}`}
        subtitulo={`km atual registrado: ${veiculo.kmAtual === null ? 'não disponível' : `${emKm(veiculo.kmAtual)} km`}`}
        largura={640}
        aoFechar={aoFechar}
        acoes={<Botao rotulo="Fechar" aoClicar={aoFechar} />}
      >
        {veiculo.itens.length === 0
          ? <div className="g-l13 g-fraco">Nenhum item configurado ainda.</div>
          : (
            <div className="g-linhas">
              {veiculo.itens.map((item) => (
                <div className="g-linha" key={item.tipo_preventivo_id}>
                  <div>
                    <div className="g-linha-rotulo g-l14 g-forte">{item.tipo}</div>
                    <div className="g-linha-apoio g-l13">
                      {`A cada ${emKm(item.intervalo_km)} km · alerta ${emKm(item.alerta_km)} km antes · ` +
                        (item.ultimo_km === null
                          ? 'último não informado'
                          : `último ${emKm(item.ultimo_km)} km`)}
                    </div>
                  </div>
                  <Botao antes={Trash} nome={`Remover ${item.tipo}`} aoClicar={() => setARemover(item)} />
                </div>
              ))}
            </div>
          )}

        <div className="g-secao-apartada">
          <TituloDeSecao
            titulo="Adicionar item"
            subtitulo="O item entra no plano assim que você adiciona"
            direita={<Botao rotulo="Adicionar item" antes={Plus} carregando={gravando} aoClicar={() => void adicionar()} />}
          />
        </div>
        <GradeDeCampos>
          <Campo
            tipo="select"
            rotulo="Tipo de manutenção"
            span={12}
            obrigatorio
            dica="Escolha o tipo"
            opcoes={opcoes}
            valor={formulario.tipo}
            aoMudar={(tipo) => setFormulario((atual) => ({ ...atual, tipo }))}
            {...propErro(erros.tipo)}
          />
          {formulario.tipo === OUTRO
            ? (
              <Campo
                rotulo="Descrição"
                span={12}
                dica="Ex: troca de correia dentada"
                valor={formulario.descricao}
                aoMudar={(descricao) => setFormulario((atual) => ({ ...atual, descricao }))}
                {...propErro(erros.descricao)}
              />
            )
            : null}
          <Campo
            tipo="numero"
            rotulo="Intervalo (km)"
            span={4}
            obrigatorio
            dica="10000"
            valor={formulario.intervalo}
            aoMudar={(intervalo) => setFormulario((atual) => ({ ...atual, intervalo }))}
            {...propErro(erros.intervalo)}
          />
          <Campo
            tipo="numero"
            rotulo="Alerta (km antes)"
            span={4}
            dica="500"
            valor={formulario.alerta}
            aoMudar={(alerta) => setFormulario((atual) => ({ ...atual, alerta }))}
          />
          <Campo
            tipo="numero"
            rotulo="Último km realizado"
            span={4}
            valor={formulario.ultimo}
            aoMudar={(ultimo) => setFormulario((atual) => ({ ...atual, ultimo }))}
            {...(veiculo.kmAtual === null ? {} : { dica: String(veiculo.kmAtual) })}
          />
        </GradeDeCampos>
      </Dialogo>

      {aRemover === null
        ? null
        : (
          <Dialogo
            aberto
            titulo="Remover item"
            aoFechar={() => setARemover(null)}
            acoes={
              <>
                <Botao rotulo="Cancelar" aoClicar={() => setARemover(null)} />
                <Botao
                  rotulo="Remover"
                  tipo="primario"
                  carregando={gravando}
                  aoClicar={() => void remover(aRemover)}
                />
              </>
            }
          >
            <div className="g-l14">
              {`Remover "${aRemover.tipo}" do plano de ${veiculo.placa}? A contagem de km deste item some junto.`}
            </div>
          </Dialogo>
        )}
    </>
  )
}

// ---------- dialogo do import ----------

type Preview =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'resumo'; readonly erros: readonly string[] }

function lerCsv(conteudo: string, base: string): { readonly achados: readonly Registro[]; readonly erros: readonly string[] } {
  const linhas = conteudo.split('\n').map((l) => l.trim()).filter(Boolean)
  const [cabecalhoBruto, ...corpo] = linhas
  if (cabecalhoBruto === undefined || corpo.length === 0) return { achados: [], erros: [] }
  const cabecalho = cabecalhoBruto.split(',').map((h) => h.trim().toLowerCase())
  const achados: Registro[] = []
  const erros: string[] = []
  corpo.forEach((bruta, i) => {
    const colunas = bruta.split(',')
    const linha: Record<string, string> = {}
    cabecalho.forEach((h, j) => {
      linha[h] = (colunas[j] ?? '').trim()
    })
    if (!linha.placa || !linha.data) {
      erros.push(`Linha ${i + 2}: placa ou data ausente`)
      return
    }
    achados.push({
      tipo: 'manutencao',
      base: linha.base || base,
      // `registrado_em` e `status_documental` nao vao daqui: quem carimba a hora do
      // registro e o estado documental e o servidor.
      data_entrada: linha.data,
      placa: linha.placa.toUpperCase(),
      tipo_manutencao: (linha.tipo || 'corretiva').toLowerCase().includes('prev') ? 'preventiva' : 'corretiva',
      servico: linha.servico || linha['serviço'] || VAZIO,
      valor: Number.parseFloat(linha.valor ?? '') || 0,
      fornecedor: linha.fornecedor || '',
      km_odometro: Number.parseInt(linha.km ?? '', 10) || null,
    })
  })
  return { achados, erros }
}

function DialogoDoImport({ base, aoFechar }: {
  readonly base: string
  readonly aoFechar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [aImportar, setAImportar] = useState<readonly Registro[]>([])
  const [enviando, setEnviando] = useState(false)

  const escolher = (arquivo: File): void => {
    setNomeDoArquivo(arquivo.name)
    const leitor = new FileReader()
    leitor.onload = () => {
      const { achados, erros } = lerCsv(String(leitor.result), base)
      if (achados.length === 0 && erros.length === 0) {
        setAImportar([])
        setPreview({ tipo: 'invalido' })
        return
      }
      setAImportar(achados)
      setPreview({ tipo: 'resumo', erros })
    }
    leitor.readAsText(arquivo, 'UTF-8')
  }

  const importar = async (): Promise<void> => {
    const total = aImportar.length
    if (total === 0) return
    setEnviando(true)
    let gravados = 0
    try {
      for (let i = 0; i < total; i += LOTE_IMPORT) {
        const lote = aImportar.slice(i, i + LOTE_IMPORT)
        await salvarRegistros([...lote])
        gravados += lote.length
      }
    } catch (e) {
      // O lote que passou nao volta, entao a fila perde os gravados e o proximo clique
      // repete so o que faltou, sem duplicar nada.
      setAImportar(aImportar.slice(gravados))
      avisar(`${gravados} de ${total} registros importados. ${motivoDaFalha(e, 'Não foi possível importar.')}`, 'erro')
      setEnviando(false)
      return
    }
    invalidar('registros')
    avisar(`${total} registros importados`, 'ok')
    setEnviando(false)
    aoFechar()
  }

  return (
    <Dialogo
      aberto
      titulo="Importar histórico de manutenções"
      subtitulo="O CSV precisa das colunas data, placa, base, tipo, servico, valor, fornecedor e km. Placa e data são obrigatórias em cada linha."
      largura={640}
      aoFechar={aoFechar}
      acoes={
        <>
          <Botao rotulo="Cancelar" aoClicar={aoFechar} />
          {aImportar.length === 0
            ? null
            : (
              <Botao
                rotulo="Importar registros"
                tipo="primario"
                antes={CloudUpload}
                carregando={enviando}
                aoClicar={() => void importar()}
              />
            )}
        </>
      }
    >
      <GradeDeCampos>
        <CampoDeArquivo
          rotulo="Arquivo CSV"
          span={12}
          aceita=".csv,text/csv"
          texto="Arraste o CSV ou clique"
          aoEscolher={escolher}
          {...(nomeDoArquivo === null ? {} : { arquivo: nomeDoArquivo })}
        />
      </GradeDeCampos>
      {preview === null ? null : preview.tipo === 'invalido'
        ? <div className="g-l13 g-tom-critico">Arquivo inválido ou vazio.</div>
        : (
          <>
            <div className="g-l14">
              <span className="g-forte">{`${aImportar.length} registros`}</span>
              {' encontrados para importar'}
              {preview.erros.length === 0
                ? null
                : <>{' · '}<span className="g-tom-critico">{`${preview.erros.length} com erro`}</span></>}
            </div>
            {preview.erros.map((erro) => <div className="g-l13 g-tom-critico" key={erro}>{erro}</div>)}
          </>
        )}
    </Dialogo>
  )
}

// ---------- tela ----------

type Vista = {
  readonly aba: number
  readonly tipo: FiltroDeTipo
  readonly documento: FiltroDeDoc
}

const VISTA_INICIAL: Vista = { aba: 0, tipo: 'todos', documento: 'todos' }

/**
 * A data que a coluna mostra, e que tambem ordena a tabela. O legado ordenava por
 * `registrado_em`, que e igual para toda linha vinda do mesmo import: a lista prometia a
 * mais recente em cima e entregava a ordem do arquivo. `registrado_em` fica como criterio
 * de desempate, para duas entradas do mesmo dia sairem na ordem em que foram registradas.
 */
function dataDoRegistro(r: Registro): string | null {
  return texto(r, 'data_entrada') || texto(r, 'data') || (texto(r, 'registrado_em')?.split('T')[0] ?? null)
}

function maisRecente(a: Registro, b: Registro): number {
  const porData = (dataDoRegistro(b) ?? '').localeCompare(dataDoRegistro(a) ?? '')
  if (porData !== 0) return porData
  return (texto(b, 'registrado_em') ?? '').localeCompare(texto(a, 'registrado_em') ?? '')
}

function baseComMaisItens(veiculos: readonly VeiculoPreventivo[], bases: readonly string[]): string {
  let escolhida = bases[0] ?? ''
  let maior = -1
  for (const nome of bases) {
    const quantos = veiculos
      .filter((v) => v.base === nome)
      .reduce((soma, v) => soma + v.itens.length, 0)
    if (quantos > maior) {
      escolhida = nome
      maior = quantos
    }
  }
  return escolhida
}

export default function Manutencao(): JSX.Element {
  const { avisar } = useAvisos()
  const sessao = useSessao()
  const plano = useRecurso('preventiva', obterPreventiva)
  const registros = useRecurso('registros', () => listarRegistros())
  const cadastro = useRecurso('cadastro', () => obterCadastro())

  const [base, setBase] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)
  const [placaConfigurando, setPlacaConfigurando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  // A dependencia e o estado das leituras, e nao o render: o aviso e sobre a leitura ter
  // falhado, e uma tela que redesenha nao e uma falha nova.
  const falhou = plano.estado === 'erro' || registros.estado === 'erro' || cadastro.estado === 'erro'
  useEffect(() => {
    if (falhou) avisar('Não foi possível ler os dados do servidor.', 'erro')
  }, [falhou])

  if (plano.estado === 'carregando' || registros.estado === 'carregando') return <Esqueleto />

  const bases = (cadastro.dados?.bases ?? []).filter((b) => b.ativo).map((b) => b.nome)
  const daSessao = sessao.dados?.baseFixa ?? null
  // Quem tem base fixa abre nela. Quem ve todas abre na base com mais item de plano, e nao
  // na primeira do cadastro: essa e alfabetica, e abria a tela numa base sem preventiva
  // configurada, onde as tres estatisticas e a tabela nascem vazias.
  const padrao = daSessao !== null && bases.includes(daSessao) ? daSessao : baseComMaisItens(plano.dados?.veiculos ?? [], bases)
  const baseAtual = base ?? padrao

  const semPlano = plano.dados === null
  const semRegistros = registros.dados === null
  const todosOsRegistros = registros.dados ?? []

  const veiculos = (plano.dados?.veiculos ?? [])
    .filter((v) => v.base === baseAtual)
    .map((v) => avaliar(v, todosOsRegistros))

  const itens = veiculos.flatMap((v) => v.itens)
  const contar = (status: StatusItem): string =>
    semPlano ? VAZIO : String(itens.filter((i) => i.status === status).length)
  const vencidas = veiculos.filter((v) => v.itens.some((i) => i.status === 'vencida')).map((v) => v.placa)

  const manutencoes = todosOsRegistros
    .filter((r) => r.tipo === 'manutencao' && r.base === baseAtual)
    .sort(maisRecente)
  const corretivas = manutencoes.filter((r) => texto(r, 'tipo_manutencao') === 'corretiva')
  const historico = manutencoes
    .filter((r) => vista.tipo === 'todos' || texto(r, 'tipo_manutencao') === vista.tipo)
    .filter((r) => vista.documento === 'todos' || texto(r, 'status_documental') === vista.documento)

  const pendentes = manutencoes.filter((r) => texto(r, 'status_documental') === 'pendente').length
  const documentais = semRegistros
    ? `${VAZIO} pendências documentais`
    : `${pendentes} ${pendentes === 1 ? 'pendência documental' : 'pendências documentais'}`

  // Numero que nao deu para calcular sai como ponto medio, e nao como zero: zero e uma
  // afirmacao sobre a frota, e o ponto diz que nao deu para ler.
  const apoioDoResumo = (proprio: string): string => (semPlano ? 'não foi possível ler o plano' : proprio)

  const configurando = veiculos.find((v) => v.placa === placaConfigurando) ?? null

  const tabelaDaAba = [
    <TabelaDePreventivas key="preventivas" veiculos={veiculos} aoConfigurar={setPlacaConfigurando} />,
    <TabelaDeManutencoes
      key="corretivas"
      titulo="Corretivas"
      subtitulo="Entradas em oficina, do registro mais recente para o mais antigo"
      colunas={COLUNAS_CORRETIVAS}
      registros={corretivas}
      vazio="Nenhuma corretiva registrada para esta base"
    />,
    <TabelaDeManutencoes
      key="historico"
      titulo="Histórico completo"
      subtitulo={`${historico.length} ${historico.length === 1 ? 'registro' : 'registros'}`}
      direita={
        <>
          <Seletor
            rotulo="Tipo"
            valor={vista.tipo}
            opcoes={OPCOES_DE_TIPO}
            aoEscolher={(tipo) => setVista((atual) => ({ ...atual, tipo }))}
          />
          <Seletor
            rotulo="Documento"
            valor={vista.documento}
            opcoes={OPCOES_DE_DOC}
            aoEscolher={(documento) => setVista((atual) => ({ ...atual, documento }))}
          />
        </>
      }
      colunas={COLUNAS_HISTORICO}
      registros={historico}
      vazio="Nenhum registro com esses filtros"
    />,
  ][vista.aba]

  return (
    <>
      <CabecalhoDePagina
        titulo="Manutenção da frota"
        subtitulo={`${veiculos.length} ${veiculos.length === 1 ? 'veículo' : 'veículos'} · Base ${baseAtual} · ${documentais}`}
        acoes={
          <>
            <Botao rotulo="Importar histórico" antes={CloudUpload} aoClicar={() => setImportando(true)} />
            <Botao rotulo="Nova manutenção" tipo="primario" antes={Plus} href="/registrar?tipo=manutencao" />
          </>
        }
      />

      <div className="g-barra">
        <Abas
          itens={ABAS}
          ativa={vista.aba}
          aoTrocar={(aba) => setVista((atual) => ({ ...atual, aba }))}
        />
        <span className="g-barra-vao" />
        <Chips
          valor={baseAtual}
          opcoes={bases.map((nome) => ({ valor: nome, rotulo: nome }))}
          aoEscolher={setBase}
        />
      </div>

      <Grade
        celulas={[
          {
            col: [1, 5],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Vencidas"
                valor={contar('vencida')}
                apoio={apoioDoResumo(apoioDasVencidas(vencidas))}
              />
            ),
          },
          {
            col: [5, 9],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Próximas"
                valor={contar('alerta')}
                apoio={apoioDoResumo('dentro da faixa de alerta do tipo')}
              />
            ),
          },
          {
            col: [9, 13],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Em dia"
                valor={contar('ok')}
                apoio={apoioDoResumo(`de ${itens.length} preventivas configuradas`)}
              />
            ),
          },
          { col: [1, 13], linha: 2, rente: true, conteudo: tabelaDaAba },
        ]}
      />

      {configurando === null
        ? null
        : (
          <DialogoDoPlano
            veiculo={configurando}
            tipos={plano.dados?.tipos ?? []}
            aoFechar={() => setPlacaConfigurando(null)}
          />
        )}

      {importando
        ? <DialogoDoImport base={baseAtual} aoFechar={() => setImportando(false)} />
        : null}
    </>
  )
}
