/**
 * Registrar rota: as quatro tabelas de lancamento numa tela so.
 *
 * O rascunho e um objeto com os quatro tipos dentro, e nao um por aba. Trocar de aba
 * com estado por aba jogaria fora o que ja estava digitado na anterior, e quem lanca
 * uma viagem e um abastecimento da mesma rota digita os dois na mesma sentada.
 *
 * O que cada tipo manda para a API sai de `MONTADORES`, uma tabela de tipo para funcao.
 * A cadeia de if que fazia isso antes crescia junto com os tipos e deixava a validacao
 * de um deles a dois pulos da montagem do payload do outro; aqui cada linha da tabela e
 * a validacao e o payload do mesmo tipo, lado a lado.
 */
import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { invalidar, useRecurso, useSessao } from '../app/dados.ts'
import { useLocalizacao } from '../app/navegacao.tsx'
import { brl, numero, texto } from '../dashboard/dominio.ts'
import {
  AreaDeTexto,
  Caixa,
  Campo,
  CampoDeArquivo,
  Chips,
  Dialogo,
  GradeDeCampos,
  RodapeDeFormulario,
  TituloDeSecao,
  useAvisos,
} from '../geist/formulario.tsx'
import { Buildings, Check, Icone, MoreHorizontal, Plus } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Esqueleto,
  Grade,
  Menu,
  Tabela,
  Td,
  Th,
  Vazio,
} from '../geist/primitivos.tsx'
import type { Celula, CorDeBadge, Opcao } from '../geist/primitivos.tsx'
import { obterCadastro } from '../js/cadastro-api.ts'
import type { CatalogoCadastro } from '../js/cadastro-api.ts'
import { apagarRegistrosDoDia, listarRegistros, salvarRegistros } from '../js/registros-api.ts'
import type { Registro } from '../js/registros-api.ts'

// ---------- forma dos dados ----------

type Tipo = 'viagem' | 'abastecimento' | 'manutencao' | 'quebra'
type TipoDeManutencao = 'preventiva' | 'corretiva'

const TIPOS = ['viagem', 'abastecimento', 'manutencao', 'quebra'] as const satisfies readonly Tipo[]

const ROTULO_DE_ABA: Readonly<Record<Tipo, string>> = {
  viagem: 'Viagem',
  abastecimento: 'Abastecimento',
  manutencao: 'Manutenção',
  quebra: 'Quebra de expedição',
}

const ROTULO_DO_TIPO: Readonly<Record<Tipo, string>> = {
  viagem: 'Viagem',
  abastecimento: 'Abastecimento',
  manutencao: 'Manutenção',
  quebra: 'Quebra',
}

const COR_DO_TIPO: Readonly<Record<Tipo, CorDeBadge>> = {
  viagem: 'teal',
  abastecimento: 'cinza',
  manutencao: 'cinza',
  quebra: 'vermelho',
}

const ROTULO_DE_SALVAR: Readonly<Record<Tipo, string>> = {
  viagem: 'Salvar viagem',
  abastecimento: 'Salvar abastecimento',
  manutencao: 'Salvar manutenção',
  quebra: 'Salvar quebra',
}

const ROTULOS_DE_PARADA = ['Saída', 'Interior', 'Chegada'] as const

const TITULOS_DE_PARADA = ['Abastecimento 1', 'Abastecimento 2', 'Abastecimento 3'] as const

const SUBTITULOS_DE_PARADA = ['saída', 'interior', 'chegada'] as const

const OPCOES_DE_MANUTENCAO: readonly Opcao<TipoDeManutencao>[] = [
  { valor: 'preventiva', rotulo: 'Preventiva' },
  { valor: 'corretiva', rotulo: 'Corretiva' },
]

type Parada = { readonly litros: string; readonly vlLitro: string; readonly km: string; readonly posto: string }

type Paradas = readonly [Parada, Parada, Parada]

type Viagem = {
  readonly dataSaida: string
  readonly horaSaida: string
  readonly dataChegada: string
  readonly horaPrevista: string
  readonly horaChegada: string
  readonly motorista: string
  readonly veiculo: string
  readonly rota: string
  readonly kmSaida: string
  readonly kmChegada: string
  readonly valorCarga: string
  readonly combustivel: string
  readonly diarias: string
  readonly m2: string
  readonly peso: string
  readonly observacao: string
}

type Abastecimento = {
  readonly data: string
  readonly placa: string
  readonly rota: string
  readonly longa: boolean
  /** Quantas paradas estao abertas. O botao de adicionar some na terceira. */
  readonly ativas: 1 | 2 | 3
  readonly paradas: Paradas
}

type CampoDeAbastecimento = 'data' | 'placa' | 'rota'

type Manutencao = {
  readonly tipoManutencao: TipoDeManutencao
  readonly dataProgramada: string
  readonly placa: string
  readonly dataEntrada: string
  readonly horaEntrada: string
  readonly dataSaida: string
  readonly horaSaida: string
  readonly km: string
  readonly fornecedor: string
  readonly servico: string
  readonly valor: string
  /** So o nome do arquivo escolhido importa: o upload em si nao existe nesta tela. */
  readonly temOrcamento: string | null
  readonly temOS: string | null
}

type CampoDeManutencao =
  | 'dataProgramada'
  | 'placa'
  | 'dataEntrada'
  | 'horaEntrada'
  | 'dataSaida'
  | 'horaSaida'
  | 'km'
  | 'fornecedor'
  | 'servico'
  | 'valor'

type Quebra = {
  readonly data: string
  readonly m2Expedido: string
  readonly m2Quebrado: string
  readonly observacao: string
}

type Rascunho = {
  readonly viagem: Viagem
  readonly abastecimento: Abastecimento
  readonly manutencao: Manutencao
  readonly quebra: Quebra
}

// ---------- numeros, datas e texto ----------

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function decimal(valor: string): number {
  const lido = Number(valor.replace(',', '.'))
  return Number.isFinite(lido) ? lido : 0
}

function inteiro(valor: string): number {
  const lido = Number.parseInt(valor, 10)
  return Number.isFinite(lido) ? lido : 0
}

function duasCasas(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(parte: number, todo: number): string {
  return todo > 0 ? `${duasCasas(parte / todo * 100)}%` : '·'
}

function dataBr(iso: string): string {
  const partes = iso.slice(0, 10).split('-')
  const [ano, mes, dia] = partes
  return ano === undefined || mes === undefined || dia === undefined ? '·' : `${dia}/${mes}/${ano}`
}

/** `DD/MM HH:MM` do carimbo do banco, que chega como texto ISO. */
function quandoBr(iso: string): string {
  const instante = new Date(iso)
  if (Number.isNaN(instante.getTime())) return '·'
  const dia = String(instante.getDate()).padStart(2, '0')
  const mes = String(instante.getMonth() + 1).padStart(2, '0')
  const hora = String(instante.getHours()).padStart(2, '0')
  const minuto = String(instante.getMinutes()).padStart(2, '0')
  return `${dia}/${mes} ${hora}:${minuto}`
}

function minutosDaHora(hora: string): number | null {
  const partes = hora.split(':')
  const h = Number(partes[0])
  const m = Number(partes[1])
  return partes.length < 2 || !Number.isFinite(h) || !Number.isFinite(m) ? null : h * 60 + m
}

/** Positivo e atraso, negativo e adiantamento. Sem as duas horas nao ha o que comparar. */
function atrasoDe(viagem: Viagem): number | null {
  const prevista = minutosDaHora(viagem.horaPrevista)
  const chegada = minutosDaHora(viagem.horaChegada)
  return prevista === null || chegada === null ? null : chegada - prevista
}

function rotuloDaPontualidade(atraso: number): string {
  if (atraso > 0) return 'Atrasado'
  if (atraso < 0) return 'Adiantado'
  return 'No prazo'
}

function diasEntre(inicio: string, fim: string): number | null {
  if (inicio === '' || fim === '') return null
  const a = Date.parse(inicio)
  const b = Date.parse(fim)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : null
}

function tipoDe(bruto: string): Tipo | null {
  return TIPOS.find((t) => t === bruto) ?? null
}

// ---------- rascunho ----------

function paradaVazia(): Parada {
  return { litros: '', vlLitro: '', km: '', posto: '' }
}

function rascunhoVazio(): Rascunho {
  const hoje = hojeISO()
  return {
    viagem: {
      dataSaida: hoje,
      horaSaida: '',
      dataChegada: hoje,
      horaPrevista: '',
      horaChegada: '',
      motorista: '',
      veiculo: '',
      rota: '',
      kmSaida: '',
      kmChegada: '',
      valorCarga: '',
      combustivel: '',
      diarias: '',
      m2: '',
      peso: '',
      observacao: '',
    },
    abastecimento: {
      data: hoje,
      placa: '',
      rota: '',
      longa: false,
      ativas: 1,
      paradas: [paradaVazia(), paradaVazia(), paradaVazia()],
    },
    manutencao: {
      tipoManutencao: 'preventiva',
      dataProgramada: '',
      placa: '',
      dataEntrada: hoje,
      horaEntrada: '',
      dataSaida: '',
      horaSaida: '',
      km: '',
      fornecedor: '',
      servico: '',
      valor: '',
      temOrcamento: null,
      temOS: null,
    },
    quebra: { data: hoje, m2Expedido: '', m2Quebrado: '', observacao: '' },
  }
}

const LIMPADORES: Readonly<Record<Tipo, (atual: Rascunho, vazio: Rascunho) => Rascunho>> = {
  viagem: (atual, vazio) => ({ ...atual, viagem: vazio.viagem }),
  abastecimento: (atual, vazio) => ({ ...atual, abastecimento: vazio.abastecimento }),
  manutencao: (atual, vazio) => ({ ...atual, manutencao: vazio.manutencao }),
  quebra: (atual, vazio) => ({ ...atual, quebra: vazio.quebra }),
}

/**
 * O indice literal em cada posicao existe para a tupla continuar tupla: com `map` o tipo
 * vira `Parada[]` e o campo `paradas` deixaria de garantir que sao tres.
 */
function comParada(paradas: Paradas, indice: number, mudar: (parada: Parada) => Parada): Paradas {
  return [
    indice === 0 ? mudar(paradas[0]) : paradas[0],
    indice === 1 ? mudar(paradas[1]) : paradas[1],
    indice === 2 ? mudar(paradas[2]) : paradas[2],
  ]
}

// ---------- montadores ----------

type Montagem = { readonly erro: string } | { readonly registros: Registro[] }

const MONTADORES: Readonly<Record<Tipo, (rascunho: Rascunho, base: string) => Montagem>> = {
  viagem: ({ viagem }, base) => {
    const veiculo = viagem.veiculo.trim().toUpperCase()
    const valorCarga = decimal(viagem.valorCarga)
    const combustivel = decimal(viagem.combustivel)
    const diarias = decimal(viagem.diarias)
    if (
      viagem.dataSaida === '' || viagem.motorista.trim() === '' || veiculo === ''
      || viagem.rota.trim() === '' || valorCarga <= 0 || combustivel + diarias <= 0
    ) {
      return {
        erro:
          'Preencha os campos obrigatórios: data de saída, motorista, veículo, rota, valor da carga, combustível e diárias.',
      }
    }
    const kmChegada = inteiro(viagem.kmChegada)
    return {
      registros: [{
        tipo: 'viagem',
        base,
        data_saida: viagem.dataSaida,
        hora_saida: viagem.horaSaida,
        data_chegada: viagem.dataChegada,
        hora_prevista: viagem.horaPrevista,
        hora_chegada: viagem.horaChegada,
        motorista: viagem.motorista.trim(),
        veiculo,
        rota: viagem.rota.trim(),
        km_saida: inteiro(viagem.kmSaida),
        km_chegada: kmChegada || null,
        valor_carga: valorCarga,
        combustivel,
        diarias,
        m2: decimal(viagem.m2),
        peso_kg: decimal(viagem.peso),
        observacao: viagem.observacao.trim(),
      }],
    }
  },

  abastecimento: ({ abastecimento }, base) => {
    const placa = abastecimento.placa.trim().toUpperCase()
    if (abastecimento.data === '' || placa === '') return { erro: 'Preencha a data e a placa.' }
    const comum = {
      tipo: 'abastecimento',
      base,
      data: abastecimento.data,
      placa,
      rota: abastecimento.rota.trim() || null,
    }

    if (!abastecimento.longa) {
      const parada = abastecimento.paradas[0]
      const litros = decimal(parada.litros)
      const vlLitro = decimal(parada.vlLitro)
      if (litros <= 0 || vlLitro <= 0) return { erro: 'Preencha os litros e o valor por litro.' }
      return {
        registros: [{
          ...comum,
          litros,
          vl_litro: vlLitro,
          km: inteiro(parada.km) || null,
          posto: parada.posto.trim(),
          slot: null,
          viagem_longa: false,
        }],
      }
    }

    const registros: Registro[] = []
    abastecimento.paradas.forEach((parada, i) => {
      const litros = decimal(parada.litros)
      if (litros <= 0) return
      registros.push({
        ...comum,
        litros,
        vl_litro: decimal(parada.vlLitro),
        km: inteiro(parada.km) || null,
        posto: parada.posto.trim(),
        slot: ROTULOS_DE_PARADA[i] ?? null,
        viagem_longa: true,
      })
    })
    if (registros.length === 0) return { erro: 'Preencha pelo menos um abastecimento.' }
    return { registros }
  },

  manutencao: ({ manutencao }, base) => {
    const placa = manutencao.placa.trim().toUpperCase()
    const servico = manutencao.servico.trim()
    const valor = decimal(manutencao.valor)
    if (manutencao.dataEntrada === '' || placa === '' || servico === '' || valor <= 0) {
      return { erro: 'Preencha a data de entrada, a placa, o serviço e o valor.' }
    }
    return {
      registros: [{
        tipo: 'manutencao',
        base,
        tipo_manutencao: manutencao.tipoManutencao,
        data_programada: manutencao.dataProgramada,
        data_entrada: manutencao.dataEntrada,
        hora_entrada: manutencao.horaEntrada,
        data_saida: manutencao.dataSaida,
        hora_saida: manutencao.horaSaida,
        placa,
        servico,
        valor,
        km_odometro: inteiro(manutencao.km) || null,
        fornecedor: manutencao.fornecedor.trim(),
      }],
    }
  },

  quebra: ({ quebra }, base) => {
    const expedido = decimal(quebra.m2Expedido)
    if (quebra.data === '' || expedido <= 0) return { erro: 'Preencha a data e o m² expedido.' }
    return {
      registros: [{
        tipo: 'quebra',
        base,
        data: quebra.data,
        m2_expedido: expedido,
        m2_quebrado: decimal(quebra.m2Quebrado),
        observacao: quebra.observacao.trim(),
      }],
    }
  },
}

// ---------- historico ----------

type LinhaDoHistorico = { readonly quem: string; readonly descricao: string; readonly valor: string }

const LEITORES: Readonly<Record<Tipo, (registro: Registro) => LinhaDoHistorico>> = {
  viagem: (r) => ({
    quem: `${texto(r, 'motorista') || '·'} · ${texto(r, 'veiculo') || '·'}`,
    descricao: texto(r, 'rota') || '·',
    valor: brl(numero(r, 'custo_viagem')),
  }),
  abastecimento: (r) => ({
    quem: texto(r, 'placa') || '·',
    descricao: texto(r, 'posto') || '·',
    valor: brl(numero(r, 'valor_total')),
  }),
  manutencao: (r) => ({
    quem: `${texto(r, 'placa') || '·'} · ${texto(r, 'fornecedor') || '·'}`,
    descricao: texto(r, 'servico') || '·',
    valor: brl(numero(r, 'valor')),
  }),
  quebra: (r) => ({
    quem: '·',
    descricao: `${duasCasas(numero(r, 'm2_quebrado'))} m² de ${duasCasas(numero(r, 'm2_expedido'))} m²`,
    valor: `${duasCasas(numero(r, 'pct_quebra'))}%`,
  }),
}

const COLUNAS_DO_HISTORICO = ['Quando', 'Tipo', 'Quem / veículo', 'Descrição', 'Valor'] as const

/** Quantas linhas do historico cabem embaixo do formulario sem virar segunda tela. */
const LINHAS_DO_HISTORICO = 12

/**
 * `data_saida` quer dizer coisas diferentes em dois tipos: na viagem e o dia da partida, na
 * manutencao e o dia em que o veiculo saiu da oficina. Ler o campo pelo tipo evita contar a
 * manutencao de hoje no dia em que ela vai deixar a oficina.
 */
const CAMPO_DE_DATA: Readonly<Record<Tipo, string>> = {
  viagem: 'data_saida',
  abastecimento: 'data',
  manutencao: 'data_entrada',
  quebra: 'data',
}

function dataDoRegistro(registro: Registro): string {
  const tipo = tipoDe(registro.tipo)
  const proprio = tipo === null ? '' : texto(registro, CAMPO_DE_DATA[tipo])
  return proprio || texto(registro, 'registrado_em').slice(0, 10)
}

function LinhaVazia({ children }: { readonly children: ReactNode }): JSX.Element {
  return <tr><Td colunas={COLUNAS_DO_HISTORICO.length} vazio>{children}</Td></tr>
}

function Historico({ registros, estado, deHoje }: {
  readonly registros: readonly Registro[]
  readonly estado: 'carregando' | 'ok' | 'erro'
  readonly deHoje: number
}): JSX.Element {
  const linhas = registros.slice(0, LINHAS_DO_HISTORICO)
  return (
    <>
      <CabecalhoDeBloco
        rente
        titulo="Histórico recente"
        subtitulo="Últimos lançamentos da base, do mais novo para o mais antigo"
        direita={<span className="g-l13 g-fraco">{deHoje} hoje</span>}
      />
      <Tabela
        cabecalho={COLUNAS_DO_HISTORICO.map((coluna) => (
          <Th key={coluna} direita={coluna === 'Valor'}>{coluna}</Th>
        ))}
      >
        {estado === 'carregando' && linhas.length === 0
          ? <LinhaVazia>Carregando…</LinhaVazia>
          : estado === 'erro' && linhas.length === 0
          ? <LinhaVazia>Não consegui ler os registros; o que está na tela pode estar velho</LinhaVazia>
          : linhas.length === 0
          ? <LinhaVazia>Nenhum registro nesta base ainda</LinhaVazia>
          : linhas.map((registro, i) => {
            const tipo = tipoDe(registro.tipo)
            const linha = tipo === null
              ? { quem: '·', descricao: '·', valor: '·' }
              : LEITORES[tipo](registro)
            return (
              <tr key={i}>
                <Td><span className="g-l13m g-fraco">{quandoBr(texto(registro, 'registrado_em'))}</span></Td>
                <Td>
                  <Badge
                    comIcone={false}
                    cor={tipo === null ? 'cinza' : COR_DO_TIPO[tipo]}
                    rotulo={tipo === null ? registro.tipo : ROTULO_DO_TIPO[tipo]}
                  />
                </Td>
                <Td><span className="g-forte">{linha.quem}</span></Td>
                <Td>{linha.descricao}</Td>
                <Td direita>{linha.valor}</Td>
              </tr>
            )
          })}
      </Tabela>
    </>
  )
}

// ---------- celulas de cada aba ----------

type Ferramentas = {
  readonly rascunho: Rascunho
  readonly motoristas: readonly Opcao[]
  readonly veiculos: readonly Opcao[]
  readonly rotas: readonly Opcao[]
  /** A rota curta esconde o toggle de viagem longa e o desliga. */
  readonly rotaCurta: boolean
  readonly mudarViagem: (campo: keyof Viagem, valor: string) => void
  readonly mudarAbastecimento: (campo: CampoDeAbastecimento, valor: string) => void
  readonly mudarLonga: (longa: boolean) => void
  readonly adicionarParada: () => void
  readonly mudarParada: (indice: number, campo: keyof Parada, valor: string) => void
  readonly mudarManutencao: (campo: CampoDeManutencao, valor: string) => void
  readonly mudarTipoManutencao: (tipo: TipoDeManutencao) => void
  readonly mudarDocumento: (campo: 'temOrcamento' | 'temOS', nome: string) => void
  readonly mudarQuebra: (campo: keyof Quebra, valor: string) => void
}

/** `arquivo` nao aceita `undefined` explicito, entao a chave so existe quando ha nome. */
function anexo(nome: string | null): { readonly arquivo?: string } {
  return nome === null ? {} : { arquivo: nome }
}

function celulasDeViagem(f: Ferramentas): readonly Celula[] {
  const v = f.rascunho.viagem
  const custo = decimal(v.combustivel) + decimal(v.diarias)
  const atraso = atrasoDe(v)
  return [
    {
      col: [1, 13],
      linha: 1,
      conteudo: (
        <>
          <TituloDeSecao titulo="Dados da viagem" subtitulo="Odômetro de saída e chegada, horário previsto e real" />
          <GradeDeCampos>
            <Campo
              tipo="data"
              rotulo="Data"
              obrigatorio
              valor={v.dataSaida}
              aoMudar={(valor) => f.mudarViagem('dataSaida', valor)}
            />
            <Campo
              tipo="select"
              rotulo="Motorista"
              obrigatorio
              dica="Selecione o motorista"
              opcoes={f.motoristas}
              valor={v.motorista}
              aoMudar={(valor) => f.mudarViagem('motorista', valor)}
            />
            <Campo
              tipo="select"
              rotulo="Veículo / placa"
              obrigatorio
              dica="Selecione o veículo"
              opcoes={f.veiculos}
              valor={v.veiculo}
              aoMudar={(valor) => f.mudarViagem('veiculo', valor)}
            />
            <Campo
              tipo="select"
              rotulo="Rota / destino"
              obrigatorio
              dica="Selecione a rota"
              opcoes={f.rotas}
              valor={v.rota}
              aoMudar={(valor) => f.mudarViagem('rota', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="km saída"
              span={2}
              mono
              valor={v.kmSaida}
              aoMudar={(valor) => f.mudarViagem('kmSaida', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="km chegada"
              span={2}
              mono
              valor={v.kmChegada}
              aoMudar={(valor) => f.mudarViagem('kmChegada', valor)}
            />
            <Campo
              tipo="data"
              rotulo="Data de chegada"
              valor={v.dataChegada}
              aoMudar={(valor) => f.mudarViagem('dataChegada', valor)}
            />
            <Campo
              tipo="hora"
              rotulo="Hora de saída"
              span={2}
              valor={v.horaSaida}
              aoMudar={(valor) => f.mudarViagem('horaSaida', valor)}
            />
            <Campo
              tipo="hora"
              rotulo="Hora prevista de chegada"
              span={2}
              valor={v.horaPrevista}
              aoMudar={(valor) => f.mudarViagem('horaPrevista', valor)}
            />
            <Campo
              tipo="hora"
              rotulo="Hora real de chegada"
              span={2}
              valor={v.horaChegada}
              aoMudar={(valor) => f.mudarViagem('horaChegada', valor)}
            />
            <Campo
              tipo="calculado"
              rotulo="Status de pontualidade"
              mono
              valor={atraso === null ? '' : rotuloDaPontualidade(atraso)}
            />
            <Campo
              tipo="numero"
              rotulo="m² total da carga"
              span={2}
              mono
              valor={v.m2}
              aoMudar={(valor) => f.mudarViagem('m2', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="Peso da carga em kg"
              span={2}
              mono
              valor={v.peso}
              aoMudar={(valor) => f.mudarViagem('peso', valor)}
            />
            <Campo
              tipo="dinheiro"
              rotulo="Valor da carga"
              obrigatorio
              mono
              valor={v.valorCarga}
              aoMudar={(valor) => f.mudarViagem('valorCarga', valor)}
            />
          </GradeDeCampos>
        </>
      ),
    },
    {
      col: [1, 9],
      linha: 2,
      conteudo: (
        <>
          <TituloDeSecao titulo="Custos da viagem" subtitulo="O total é a soma das parcelas e não aceita digitação" />
          <GradeDeCampos>
            <Campo
              tipo="dinheiro"
              rotulo="Diárias"
              mono
              valor={v.diarias}
              aoMudar={(valor) => f.mudarViagem('diarias', valor)}
            />
            <Campo
              tipo="dinheiro"
              rotulo="Combustível"
              mono
              valor={v.combustivel}
              aoMudar={(valor) => f.mudarViagem('combustivel', valor)}
            />
            <Campo tipo="calculado" rotulo="Total custo da viagem (R$)" mono valor={duasCasas(custo)} />
            <Campo
              tipo="calculado"
              rotulo="% do custo sobre a carga"
              mono
              valor={pct(custo, decimal(v.valorCarga))}
            />
            <AreaDeTexto
              rotulo="Observação"
              valor={v.observacao}
              aoMudar={(valor) => f.mudarViagem('observacao', valor)}
            />
          </GradeDeCampos>
        </>
      ),
    },
    {
      col: [9, 13],
      linha: 2,
      conteudo: (
        <>
          <TituloDeSecao titulo="Pontualidade" subtitulo="A diferença entre a hora prevista e a hora real de chegada" />
          {atraso !== null && atraso > 0
            ? (
              <>
                <div className="g-secao"><Badge cor="ambar" rotulo={`Atrasada em ${atraso} min`} /></div>
                <div className="g-l13 g-fraco">
                  A chegada real veio depois da prevista, e a viagem entra como atrasada.
                </div>
              </>
            )
            : (
              <div className="g-l13 g-fraco">
                A pontualidade é calculada a partir da hora prevista e da hora real de chegada.
              </div>
            )}
        </>
      ),
    },
  ]
}

function celulasDeAbastecimento(f: Ferramentas): readonly Celula[] {
  const a = f.rascunho.abastecimento
  const cheias = a.paradas.filter((parada) => decimal(parada.litros) > 0)
  const litros = cheias.reduce((soma, parada) => soma + decimal(parada.litros), 0)
  const total = cheias.reduce((soma, parada) => soma + decimal(parada.litros) * decimal(parada.vlLitro), 0)
  const kms = a.paradas.map((parada) => inteiro(parada.km)).filter((km) => km > 0)
  const primeiro = kms[0]
  const rodados = primeiro === undefined ? 0 : Math.max(...kms) - primeiro
  const visiveis = a.longa ? a.ativas : 1

  return [
    {
      col: [1, 13],
      linha: 1,
      conteudo: (
        <>
          <TituloDeSecao titulo="Dados do abastecimento" subtitulo="Data, veículo e a rota que o abastecimento atende" />
          <GradeDeCampos>
            <Campo
              tipo="data"
              rotulo="Data"
              obrigatorio
              valor={a.data}
              aoMudar={(valor) => f.mudarAbastecimento('data', valor)}
            />
            <Campo
              tipo="select"
              rotulo="Placa"
              obrigatorio
              dica="Selecione a placa"
              opcoes={f.veiculos}
              valor={a.placa}
              aoMudar={(valor) => f.mudarAbastecimento('placa', valor)}
            />
            <Campo
              tipo="select"
              rotulo="Rota vinculada"
              dica="Sem rota"
              opcoes={f.rotas}
              valor={a.rota}
              aoMudar={(valor) => f.mudarAbastecimento('rota', valor)}
            />
          </GradeDeCampos>
          {f.rotaCurta
            ? null
            : (
              <div className="g-secao">
                <Caixa
                  marcado={a.longa}
                  aoMudar={f.mudarLonga}
                  rotulo="Viagem longa (interior), com vários abastecimentos"
                />
              </div>
            )}
        </>
      ),
    },
    {
      col: [1, 13],
      linha: 2,
      conteudo: (
        <>
          <TituloDeSecao titulo="Abastecimentos" subtitulo="Litros, valor por litro e odômetro de cada parada" />
          {a.paradas.slice(0, visiveis).map((parada, i) => (
            <div key={i}>
              {a.longa
                ? <TituloDeSecao titulo={TITULOS_DE_PARADA[i] ?? ''} subtitulo={SUBTITULOS_DE_PARADA[i] ?? ''} />
                : null}
              <GradeDeCampos>
                <Campo
                  tipo="numero"
                  rotulo="Litros"
                  span={3}
                  mono
                  valor={parada.litros}
                  aoMudar={(valor) => f.mudarParada(i, 'litros', valor)}
                />
                <Campo
                  tipo="numero"
                  rotulo="Valor por litro"
                  span={3}
                  mono
                  valor={parada.vlLitro}
                  aoMudar={(valor) => f.mudarParada(i, 'vlLitro', valor)}
                />
                <Campo
                  tipo="numero"
                  rotulo="km odômetro"
                  span={3}
                  mono
                  valor={parada.km}
                  aoMudar={(valor) => f.mudarParada(i, 'km', valor)}
                />
                <Campo
                  rotulo="Posto / fornecedor"
                  span={3}
                  valor={parada.posto}
                  aoMudar={(valor) => f.mudarParada(i, 'posto', valor)}
                />
              </GradeDeCampos>
            </div>
          ))}
          {a.longa && a.ativas < 3
            ? (
              <div className="g-secao">
                <Botao antes={Plus} rotulo="Adicionar abastecimento" aoClicar={f.adicionarParada} />
              </div>
            )
            : null}
          {a.longa
            ? (
              <>
                <TituloDeSecao titulo="Totais da viagem" />
                <GradeDeCampos>
                  <Campo tipo="calculado" rotulo="Total de litros" span={3} mono valor={duasCasas(litros)} />
                  <Campo tipo="calculado" rotulo="Total R$" span={3} mono valor={duasCasas(total)} />
                  <Campo
                    tipo="calculado"
                    rotulo="Média km/L"
                    span={3}
                    mono
                    valor={rodados > 0 && litros > 0 ? duasCasas(rodados / litros) : '·'}
                  />
                  <Campo
                    tipo="calculado"
                    rotulo="km rodados"
                    span={3}
                    mono
                    valor={rodados > 0 ? rodados.toLocaleString('pt-BR') : '·'}
                  />
                </GradeDeCampos>
              </>
            )
            : null}
        </>
      ),
    },
  ]
}

function celulasDeManutencao(f: Ferramentas): readonly Celula[] {
  const m = f.rascunho.manutencao
  const dias = diasEntre(m.dataEntrada, m.dataSaida)
  const completo = m.temOrcamento !== null && m.temOS !== null
  return [
    {
      col: [1, 9],
      linha: 1,
      conteudo: (
        <>
          <TituloDeSecao
            titulo="Dados da manutenção"
            subtitulo="Entrada e saída da oficina, serviço e valor"
            direita={
              <Chips valor={m.tipoManutencao} opcoes={OPCOES_DE_MANUTENCAO} aoEscolher={f.mudarTipoManutencao} />
            }
          />
          <GradeDeCampos>
            <Campo
              tipo="data"
              rotulo="Data programada"
              valor={m.dataProgramada}
              aoMudar={(valor) => f.mudarManutencao('dataProgramada', valor)}
            />
            <Campo
              tipo="select"
              rotulo="Placa"
              obrigatorio
              dica="Selecione a placa"
              opcoes={f.veiculos}
              valor={m.placa}
              aoMudar={(valor) => f.mudarManutencao('placa', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="km do veículo"
              mono
              valor={m.km}
              aoMudar={(valor) => f.mudarManutencao('km', valor)}
            />
            <Campo
              tipo="data"
              rotulo="Data de entrada na oficina"
              obrigatorio
              valor={m.dataEntrada}
              aoMudar={(valor) => f.mudarManutencao('dataEntrada', valor)}
            />
            <Campo
              tipo="hora"
              rotulo="Hora de entrada"
              span={2}
              valor={m.horaEntrada}
              aoMudar={(valor) => f.mudarManutencao('horaEntrada', valor)}
            />
            <Campo
              tipo="data"
              rotulo="Data de saída da oficina"
              valor={m.dataSaida}
              aoMudar={(valor) => f.mudarManutencao('dataSaida', valor)}
            />
            <Campo
              tipo="hora"
              rotulo="Hora de saída"
              span={2}
              valor={m.horaSaida}
              aoMudar={(valor) => f.mudarManutencao('horaSaida', valor)}
            />
            <Campo tipo="calculado" rotulo="Dias em oficina" mono valor={dias === null ? '' : String(dias)} />
            <Campo
              rotulo="Fornecedor / oficina"
              valor={m.fornecedor}
              aoMudar={(valor) => f.mudarManutencao('fornecedor', valor)}
            />
            <Campo
              rotulo="Serviço / descrição"
              span={8}
              obrigatorio
              valor={m.servico}
              aoMudar={(valor) => f.mudarManutencao('servico', valor)}
            />
            <Campo
              tipo="dinheiro"
              rotulo="Valor"
              obrigatorio
              mono
              valor={m.valor}
              aoMudar={(valor) => f.mudarManutencao('valor', valor)}
            />
          </GradeDeCampos>
        </>
      ),
    },
    {
      col: [9, 13],
      linha: 1,
      conteudo: (
        <>
          <TituloDeSecao titulo="Documentos" subtitulo="PDF de até 6 MB" />
          <GradeDeCampos>
            <CampoDeArquivo
              rotulo="Orçamento (PDF)"
              span={12}
              aceita="application/pdf,image/*"
              aoEscolher={(arquivo) => f.mudarDocumento('temOrcamento', arquivo.name)}
              {...anexo(m.temOrcamento)}
            />
            <CampoDeArquivo
              rotulo="Ordem de serviço assinada (PDF)"
              span={12}
              aceita="application/pdf,image/*"
              aoEscolher={(arquivo) => f.mudarDocumento('temOS', arquivo.name)}
              {...anexo(m.temOS)}
            />
          </GradeDeCampos>
          <div className="g-secao">
            <Badge cor={completo ? 'verde' : 'ambar'} rotulo={completo ? 'Concluído' : 'Pendente de documento'} />
          </div>
          <div className="g-l13 g-fraco">Sem os dois documentos o registro fica pendente.</div>
        </>
      ),
    },
  ]
}

function celulasDeQuebra(f: Ferramentas): readonly Celula[] {
  const q = f.rascunho.quebra
  return [
    {
      col: [1, 13],
      linha: 1,
      conteudo: (
        <>
          <TituloDeSecao titulo="Quebra de expedição" subtitulo="Quanto saiu e quanto voltou quebrado" />
          <GradeDeCampos>
            <Campo
              tipo="data"
              rotulo="Data"
              obrigatorio
              valor={q.data}
              aoMudar={(valor) => f.mudarQuebra('data', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="m² expedido"
              obrigatorio
              mono
              valor={q.m2Expedido}
              aoMudar={(valor) => f.mudarQuebra('m2Expedido', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="m² com quebra"
              mono
              valor={q.m2Quebrado}
              aoMudar={(valor) => f.mudarQuebra('m2Quebrado', valor)}
            />
            <Campo
              tipo="calculado"
              rotulo="% de quebra"
              mono
              valor={pct(decimal(q.m2Quebrado), decimal(q.m2Expedido))}
            />
            <AreaDeTexto
              rotulo="Observação"
              dica="Motivo, nota fiscal, cliente afetado…"
              valor={q.observacao}
              aoMudar={(valor) => f.mudarQuebra('observacao', valor)}
            />
          </GradeDeCampos>
        </>
      ),
    },
  ]
}

const CELULAS: Readonly<Record<Tipo, (f: Ferramentas) => readonly Celula[]>> = {
  viagem: celulasDeViagem,
  abastecimento: celulasDeAbastecimento,
  manutencao: celulasDeManutencao,
  quebra: celulasDeQuebra,
}

// ---------- tela ----------

const CHAVE_DA_BASE = 'registrar.base'

function lerBaseLembrada(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_DA_BASE)
  } catch {
    return null
  }
}

function lembrarBase(base: string): void {
  try {
    window.localStorage.setItem(CHAVE_DA_BASE, base)
  } catch {
    // Sem armazenamento a tela so volta a pedir a base na proxima visita.
  }
}

export default function Registrar(): JSX.Element {
  const { dados: sessao } = useSessao()
  const { busca } = useLocalizacao()
  const { avisar } = useAvisos()
  const cadastro = useRecurso('cadastro', () => obterCadastro())
  const registros = useRecurso('registros', listarRegistros)

  const [base, setBase] = useState<string | null>(null)
  const [tipoEscolhido, setTipoEscolhido] = useState<Tipo>('viagem')
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio())
  const [salvando, setSalvando] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [limpezaAberta, setLimpezaAberta] = useState(false)

  // O admin comeca na base do ultimo lancamento desta maquina, e nao numa tela vazia
  // pedindo um clique; quem lanca todo dia lanca quase sempre na mesma base.
  const baseFixa = sessao?.baseFixa ?? null
  useEffect(() => {
    if (baseFixa !== null) {
      setBase(baseFixa)
      return
    }
    if (sessao === null) return
    const lembrada = lerBaseLembrada()
    if (lembrada !== null) setBase(lembrada)
  }, [baseFixa, sessao])

  // Sem lembranca nesta maquina, a base do ultimo lancamento de todos vale como palpite.
  const ultimo = registros.dados?.[0]?.base ?? null
  useEffect(() => {
    if (base === null && baseFixa === null && lerBaseLembrada() === null && ultimo !== null) setBase(ultimo)
  }, [base, baseFixa, ultimo])

  useEffect(() => {
    if (base !== null && baseFixa === null) lembrarBase(base)
  }, [base, baseFixa])

  // A base lembrada pode ter sido desativada no cadastro desde a ultima visita.
  const nomesAtivos = cadastro.dados?.bases.filter((b) => b.ativo).map((b) => b.nome)
  useEffect(() => {
    if (base !== null && nomesAtivos !== undefined && !nomesAtivos.includes(base)) setBase(null)
  }, [base, nomesAtivos])

  useEffect(() => {
    const parametros = new URLSearchParams(busca)
    const placa = parametros.get('placa')
    if (placa !== null && placa !== '') {
      setRascunho((r) => ({
        ...r,
        viagem: { ...r.viagem, veiculo: placa },
        abastecimento: { ...r.abastecimento, placa },
        manutencao: { ...r.manutencao, placa },
      }))
    }
    const tipo = tipoDe(parametros.get('tipo') ?? '')
    if (tipo !== null) setTipoEscolhido(tipo)
  }, [busca])

  if (sessao === null) return <Esqueleto />

  const catalogo: CatalogoCadastro | null = cadastro.dados
  const bases = (catalogo?.bases ?? [])
    .filter((b) => b.ativo && (sessao.capacidades.todasAsBases || sessao.bases.includes(b.nome)))
    .map((b) => b.nome)
    .sort((a, b) => a.localeCompare(b))

  const permitidos = TIPOS.filter((t) => sessao.tipos.includes(t))
  const tipo = permitidos.includes(tipoEscolhido) ? tipoEscolhido : (permitidos[0] ?? 'viagem')

  const veiculos: readonly Opcao[] = (catalogo?.veiculos ?? [])
    .filter((v) => v.ativo && v.base === base)
    .sort((a, b) => a.placa.localeCompare(b.placa))
    .map((v) => ({ valor: v.placa, rotulo: v.modelo === null ? v.placa : `${v.placa} · ${v.modelo}` }))

  const motoristas: readonly Opcao[] = (catalogo?.colaboradores ?? [])
    .filter((c) => c.ativo && c.base === base && c.funcao === 'motorista')
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((c) => ({ valor: c.nome, rotulo: c.nome }))

  const rotasDaBase = (catalogo?.rotas ?? [])
    .filter((r) => r.ativo && r.base === base)
    .sort((a, b) => a.nome.localeCompare(b.nome))
  const rotas: readonly Opcao[] = rotasDaBase.map((r) => ({ valor: r.nome, rotulo: r.nome }))
  const rotaCurta = rotasDaBase.some((r) => r.nome === rascunho.abastecimento.rota && r.local)

  const daBase = (registros.dados ?? []).filter((r) => r.base === base)
  const hoje = hojeISO()
  const deHoje = daBase.filter((r) => dataDoRegistro(r) === hoje).length

  const mudarViagem = (campo: keyof Viagem, valor: string): void => {
    setRascunho((r) => ({ ...r, viagem: { ...r.viagem, [campo]: valor } }))
  }
  // A rota curta nao tem interior, entao escolher uma desliga a viagem longa em vez de so
  // esconder o toggle: escondido e ligado, o montador ainda gravaria as tres paradas.
  const mudarAbastecimento = (campo: CampoDeAbastecimento, valor: string): void => {
    const curta = campo === 'rota' && rotasDaBase.some((r) => r.nome === valor && r.local)
    setRascunho((r) => ({
      ...r,
      abastecimento: {
        ...r.abastecimento,
        [campo]: valor,
        longa: curta ? false : r.abastecimento.longa,
      },
    }))
  }
  const mudarLonga = (longa: boolean): void => {
    setRascunho((r) => ({ ...r, abastecimento: { ...r.abastecimento, longa } }))
  }
  const adicionarParada = (): void => {
    setRascunho((r) => ({
      ...r,
      abastecimento: { ...r.abastecimento, ativas: r.abastecimento.ativas === 1 ? 2 : 3 },
    }))
  }
  const mudarParada = (indice: number, campo: keyof Parada, valor: string): void => {
    setRascunho((r) => ({
      ...r,
      abastecimento: {
        ...r.abastecimento,
        paradas: comParada(r.abastecimento.paradas, indice, (parada) => ({ ...parada, [campo]: valor })),
      },
    }))
  }
  const mudarManutencao = (campo: CampoDeManutencao, valor: string): void => {
    setRascunho((r) => ({ ...r, manutencao: { ...r.manutencao, [campo]: valor } }))
  }
  const mudarTipoManutencao = (tipoManutencao: TipoDeManutencao): void => {
    setRascunho((r) => ({ ...r, manutencao: { ...r.manutencao, tipoManutencao } }))
  }
  const mudarDocumento = (campo: 'temOrcamento' | 'temOS', nome: string): void => {
    setRascunho((r) => ({ ...r, manutencao: { ...r.manutencao, [campo]: nome } }))
  }
  const mudarQuebra = (campo: keyof Quebra, valor: string): void => {
    setRascunho((r) => ({ ...r, quebra: { ...r.quebra, [campo]: valor } }))
  }

  const limparAba = (): void => {
    setRascunho((r) => LIMPADORES[tipo](r, rascunhoVazio()))
  }

  async function salvar(): Promise<void> {
    if (base === null) {
      avisar('Escolha uma base antes de gravar.', 'erro')
      return
    }
    const montagem = MONTADORES[tipo](rascunho, base)
    if ('erro' in montagem) {
      avisar(montagem.erro, 'erro')
      return
    }
    setSalvando(true)
    try {
      await salvarRegistros(montagem.registros)
      invalidar('registros')
      limparAba()
      const quantos = montagem.registros.length
      avisar(quantos > 1 ? `${quantos} abastecimentos registrados.` : 'Registro gravado.', 'ok')
    } catch (falha) {
      // O formulario continua preenchido: quem perdeu a conexao tenta de novo sem redigitar.
      avisar(
        falha instanceof TypeError
          ? 'Sem conexão. O registro não foi salvo, tente de novo.'
          : falha instanceof Error
          ? falha.message
          : 'Não foi possível salvar.',
        'erro',
      )
    } finally {
      setSalvando(false)
    }
  }

  function exportar(): void {
    if (daBase.length === 0) {
      avisar('Não há registros para exportar.', 'erro')
      return
    }
    const blob = new Blob([JSON.stringify(daBase, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `emvidros-indicadores-${hoje}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function limparHoje(): Promise<void> {
    if (base === null) return
    setLimpando(true)
    try {
      const { apagados } = await apagarRegistrosDoDia(base, hoje)
      invalidar('registros')
      setLimpezaAberta(false)
      avisar(`${apagados} registros apagados.`, 'ok')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não foi possível apagar.', 'erro')
    } finally {
      setLimpando(false)
    }
  }

  const ferramentas: Ferramentas = {
    rascunho,
    motoristas,
    veiculos,
    rotas,
    rotaCurta,
    mudarViagem,
    mudarAbastecimento,
    mudarLonga,
    adicionarParada,
    mudarParada,
    mudarManutencao,
    mudarTipoManutencao,
    mudarDocumento,
    mudarQuebra,
  }

  const doTipo = CELULAS[tipo](ferramentas)
  const linhaDoHistorico = doTipo.reduce((maior, celula) => Math.max(maior, celula.linha), 0) + 1
  const celulas: readonly Celula[] = [
    ...doTipo,
    {
      col: [1, 13],
      linha: linhaDoHistorico,
      rente: true,
      conteudo: (
        <>
          <Historico registros={daBase} estado={registros.estado} deHoje={deHoje} />
          <RodapeDeFormulario
            apoio="Os campos em cinza são calculados a partir dos outros."
            acoes={
              <>
                <Botao tipo="terciario" rotulo="Limpar formulário" aoClicar={limparAba} />
                <Botao
                  tipo="primario"
                  tamanho="medio"
                  antes={Check}
                  rotulo={ROTULO_DE_SALVAR[tipo]}
                  carregando={salvando}
                  aoClicar={() => void salvar()}
                />
              </>
            }
          />
        </>
      ),
    },
  ]

  const itensDoMenu = [
    { rotulo: 'Exportar JSON', aoEscolher: exportar },
    { rotulo: 'Limpar registros de hoje', aoEscolher: () => setLimpezaAberta(true) },
  ]

  return (
    <>
      <CabecalhoDePagina
        titulo="Registrar rota"
        subtitulo={`${base ?? 'Sem base'} · ${sessao.nome} · ${dataBr(hoje)}`}
        acoes={
          <>
            <Menu nome="Mais ações" gatilho={<Icone de={MoreHorizontal} />} itens={itensDoMenu} />
            <Botao
              tipo="primario"
              tamanho="medio"
              antes={Check}
              rotulo="Salvar registro"
              carregando={salvando}
              aoClicar={() => void salvar()}
            />
          </>
        }
      />

      {sessao.capacidades.todasAsBases
        ? (
          <div className="g-secao">
            <Chips
              valor={base ?? ''}
              opcoes={bases.map((nome) => ({ valor: nome, rotulo: nome }))}
              aoEscolher={setBase}
            />
            <span className="g-l12 g-fraco">O registro entra na base marcada.</span>
          </div>
        )
        : null}

      <div className="g-secao">
        <Abas
          itens={permitidos.map((t) => ROTULO_DE_ABA[t])}
          ativa={permitidos.indexOf(tipo)}
          aoTrocar={(indice) => {
            const escolhido = permitidos[indice]
            if (escolhido !== undefined) setTipoEscolhido(escolhido)
          }}
        />
        <span className="g-l12 g-fraco">Cada aba grava numa tabela própria; o rodapé é o mesmo.</span>
      </div>

      {base === null
        ? (
          <Vazio icone={Buildings} titulo="Escolha uma base" texto="Os registros entram na base selecionada acima." />
        )
        : <Grade celulas={celulas} />}

      <Dialogo
        aberto={limpezaAberta}
        titulo="Limpar registros de hoje"
        subtitulo={base ?? 'Sem base'}
        aoFechar={() => setLimpezaAberta(false)}
        acoes={
          <>
            <Botao tipo="terciario" rotulo="Cancelar" aoClicar={() => setLimpezaAberta(false)} />
            <Botao
              tipo="primario"
              rotulo="Apagar registros de hoje"
              carregando={limpando}
              aoClicar={() => void limparHoje()}
            />
          </>
        }
      >
        <div className="g-l14">
          Isto apaga todos os registros lançados hoje na base {base ?? 'sem base'}. Não tem como desfazer.
        </div>
      </Dialogo>
    </>
  )
}
