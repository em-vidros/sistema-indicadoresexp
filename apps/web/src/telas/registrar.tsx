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
import { lerDinheiro, lerNumero } from '../dashboard/digitado.ts'
import { hojeISO } from '../app/data.ts'
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
import { Buildings, Check, CloudUpload, Icone, MoreHorizontal, PencilEdit, Plus, Trash } from '../geist/icones.tsx'
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
import { fecharMes, listarFechamentos, reabrirMes } from '../js/fechamentos-api.ts'
import { obterPreventiva } from '../js/preventiva-api.ts'
import {
  apagarRegistro,
  apagarRegistrosDoDia,
  atualizarRegistro,
  listarRegistros,
  salvarRegistros,
} from '../js/registros-api.ts'
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

/** O sentinela de "nao esta no catalogo", o mesmo padrao que a Frota ja usa no plano preventivo. */
const OUTRO_SERVICO = '__outro__'

type Parada = { readonly litros: string; readonly vlLitro: string; readonly km: string; readonly posto: string }

type Paradas = readonly [Parada, Parada, Parada]

type Viagem = {
  readonly dataSaida: string
  readonly horaSaida: string
  readonly dataChegada: string
  readonly horaPrevista: string
  readonly dataPrevista: string
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
  /** De quem e a media que este abastecimento fecha, nao necessariamente quem abasteceu. */
  readonly motorista: string
  readonly rota: string
  readonly longa: boolean
  /** Quantas paradas estao abertas. O botao de adicionar some na terceira. */
  readonly ativas: 1 | 2 | 3
  readonly paradas: Paradas
}

type CampoDeAbastecimento = 'data' | 'placa' | 'motorista' | 'rota'

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

function decimal(valor: string): number {
  return lerNumero(valor)
}

/**
 * O valor por litro tem tres casas (`5.899`) e nunca chega a mil: sem `milhar: false`
 * aqui, o ponto desse preco seria lido como separador de milhar e 5,899 viraria 5899.
 */
function valorPorLitro(valor: string): number {
  return lerNumero(valor, { milhar: false })
}

function inteiro(valor: string): number {
  return Math.trunc(lerNumero(valor))
}

function duasCasas(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(parte: number, todo: number): string {
  return todo > 0 ? `${duasCasas(parte / todo * 100)}%` : '·'
}

/**
 * O primeiro dia do mes anterior a uma data ISO. E o mes que "fechar" mira: o mes
 * corrente ainda esta em andamento, quem fecha e o que ja terminou.
 */
function mesAnteriorISO(dataISO: string): string {
  const [ano = 0, mes = 1] = dataISO.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10)
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

/** Minutos desde a epoca, juntando data e hora -- o unico jeito de comparar dois
 * instantes que podem cair em dias diferentes. */
function instanteEmMinutos(data: string, hora: string): number | null {
  const minutosHora = minutosDaHora(hora)
  if (data === '' || minutosHora === null) return null
  const diaMs = Date.parse(`${data}T00:00:00Z`)
  return Number.isNaN(diaMs) ? null : diaMs / 60000 + minutosHora
}

/**
 * Positivo e atraso, negativo e adiantamento. So a hora, mesmo dia assumido -- e a
 * pontualidade da ROTA (o trecho rodado), que nao muda: quem mexeu foi o calculo da
 * pontualidade da ENTREGA, em `atrasoDaEntregaDe`, que e outra coisa.
 */
function atrasoDe(viagem: Viagem): number | null {
  const prevista = minutosDaHora(viagem.horaPrevista)
  const chegada = minutosDaHora(viagem.horaChegada)
  return prevista === null || chegada === null ? null : chegada - prevista
}

/**
 * Positivo e atraso, negativo e adiantamento. Compara o instante inteiro -- data e
 * hora --, e nao so a hora: uma entrega planejada para 14/10 e feita em 16/10 e dois
 * dias de atraso, nao a diferenca de hora dentro do mesmo dia. Mesma formula do
 * `atraso_min` gerado no banco (`schema/registro.ts`), e o numero que alimenta a
 * pontualidade do Painel/Visao geral.
 */
function atrasoDaEntregaDe(viagem: Viagem): number | null {
  const prevista = instanteEmMinutos(viagem.dataPrevista, viagem.horaPrevista)
  const chegada = instanteEmMinutos(viagem.dataChegada, viagem.horaChegada)
  return prevista === null || chegada === null ? null : chegada - prevista
}

function rotuloDaPontualidade(atraso: number): string {
  if (atraso > 0) return 'Atrasado'
  if (atraso < 0) return 'Adiantado'
  return 'No prazo'
}

/** `2d 4h`, `45min` -- os minutos crus de uma entrega atrasada em dias ficam ilegiveis. */
function duracao(totalMinutos: number): string {
  const total = Math.abs(totalMinutos)
  const dias = Math.floor(total / 1440)
  const horas = Math.floor((total % 1440) / 60)
  const minutos = Math.round(total % 60)
  const partes = [
    dias > 0 ? `${dias}d` : null,
    horas > 0 ? `${horas}h` : null,
    (minutos > 0 || (dias === 0 && horas === 0)) ? `${minutos}min` : null,
  ]
  return partes.filter((p): p is string => p !== null).join(' ')
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
      dataPrevista: hoje,
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
      motorista: '',
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
    const m2 = decimal(viagem.m2)
    const peso = decimal(viagem.peso)
    if (
      viagem.dataSaida === '' || viagem.motorista.trim() === '' || veiculo === ''
      || viagem.rota.trim() === '' || valorCarga <= 0 || combustivel + diarias <= 0 || m2 <= 0 || peso <= 0
    ) {
      return {
        erro:
          'Preencha os campos obrigatórios: data de saída, motorista, veículo, rota, m² total, peso da carga, valor da carga, combustível e diárias.',
      }
    }
    const kmChegada = inteiro(viagem.kmChegada)
    // Sem hora prevista a data prevista fica sem com o que comparar -- `viagem_previsao_ck`
    // recusa uma sem a outra, entao as duas andam juntas ou as duas somem.
    const dataPrevista = viagem.horaPrevista && viagem.dataPrevista ? viagem.dataPrevista : null
    return {
      registros: [{
        tipo: 'viagem',
        base,
        data_saida: viagem.dataSaida,
        hora_saida: viagem.horaSaida,
        data_chegada: viagem.dataChegada,
        hora_prevista: viagem.horaPrevista,
        data_prevista: dataPrevista,
        hora_chegada: viagem.horaChegada,
        motorista: viagem.motorista.trim(),
        veiculo,
        rota: viagem.rota.trim(),
        km_saida: inteiro(viagem.kmSaida),
        km_chegada: kmChegada || null,
        valor_carga: valorCarga,
        combustivel,
        diarias,
        m2,
        peso_kg: peso,
        observacao: viagem.observacao.trim(),
      }],
    }
  },

  abastecimento: ({ abastecimento }, base) => {
    const placa = abastecimento.placa.trim().toUpperCase()
    const motorista = abastecimento.motorista.trim()
    if (abastecimento.data === '' || placa === '' || motorista === '') {
      return { erro: 'Preencha a data, a placa e o motorista.' }
    }
    const comum = {
      tipo: 'abastecimento',
      base,
      data: abastecimento.data,
      placa,
      motorista,
      rota: abastecimento.rota.trim() || null,
    }

    if (!abastecimento.longa) {
      const parada = abastecimento.paradas[0]
      const litros = decimal(parada.litros)
      const vlLitro = valorPorLitro(parada.vlLitro)
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
        vl_litro: valorPorLitro(parada.vlLitro),
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
    const valor = lerDinheiro(manutencao.valor)
    if (manutencao.dataEntrada === '' || placa === '' || servico === '' || valor === null || valor < 0) {
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

// ---------- do registro de volta para o rascunho ----------

/** Numero do banco no campo de digitar: ponto decimal, e zero ou nulo viram campo vazio. */
function digitavel(registro: Registro, chave: string): string {
  const valor = numero(registro, chave)
  return valor === 0 ? '' : String(valor)
}

/** O banco devolve `HH:MM:SS`; o campo de hora e a validacao do servidor querem `HH:MM`. */
function horaCurta(registro: Registro, chave: string): string {
  return texto(registro, chave).slice(0, 5)
}

/**
 * O que a tela escreve ao editar: o registro vira o rascunho da aba dele, campo a campo, ao
 * contrario de `MONTADORES`. O abastecimento recebe todas as linhas do grupo, porque a
 * leitura devolve uma por parada e a edicao troca o grupo inteiro.
 */
const LEITORES_DE_RASCUNHO: Readonly<Record<Tipo, (linhas: readonly Registro[], atual: Rascunho) => Rascunho>> = {
  viagem: ([r], atual) =>
    r === undefined ? atual : {
      ...atual,
      viagem: {
        dataSaida: texto(r, 'data_saida'),
        horaSaida: horaCurta(r, 'hora_saida'),
        dataChegada: texto(r, 'data_chegada'),
        horaPrevista: horaCurta(r, 'hora_prevista'),
        // Registro antigo sem data prevista propria cai na data de chegada, a mesma
        // suposicao de "mesmo dia" que a tela usava antes deste campo existir.
        dataPrevista: texto(r, 'data_prevista') || texto(r, 'data_chegada') || hojeISO(),
        horaChegada: horaCurta(r, 'hora_chegada'),
        motorista: texto(r, 'motorista'),
        veiculo: texto(r, 'veiculo'),
        rota: texto(r, 'rota'),
        kmSaida: digitavel(r, 'km_saida'),
        kmChegada: digitavel(r, 'km_chegada'),
        valorCarga: digitavel(r, 'valor_carga'),
        combustivel: digitavel(r, 'combustivel'),
        diarias: digitavel(r, 'diarias'),
        m2: digitavel(r, 'm2'),
        peso: digitavel(r, 'peso_kg'),
        observacao: texto(r, 'observacao'),
      },
    },

  abastecimento: (linhas, atual) => {
    const [primeira] = linhas
    if (primeira === undefined) return atual
    const ordenadas = [...linhas].sort((a, b) => numero(a, 'ordem') - numero(b, 'ordem'))
    const parada = (i: number): Parada => {
      const r = ordenadas[i]
      return r === undefined
        ? paradaVazia()
        : { litros: digitavel(r, 'litros'), vlLitro: digitavel(r, 'vl_litro'), km: digitavel(r, 'km'), posto: texto(r, 'posto') }
    }
    const ativas = Math.min(3, Math.max(1, ordenadas.length)) as 1 | 2 | 3
    return {
      ...atual,
      abastecimento: {
        data: texto(primeira, 'data'),
        placa: texto(primeira, 'placa'),
        motorista: texto(primeira, 'motorista'),
        rota: texto(primeira, 'rota'),
        longa: ordenadas.length > 1,
        ativas,
        paradas: [parada(0), parada(1), parada(2)],
      },
    }
  },

  manutencao: ([r], atual) =>
    r === undefined ? atual : {
      ...atual,
      manutencao: {
        tipoManutencao: texto(r, 'tipo_manutencao') === 'corretiva' ? 'corretiva' : 'preventiva',
        dataProgramada: texto(r, 'data_programada'),
        placa: texto(r, 'placa'),
        dataEntrada: texto(r, 'data_entrada'),
        horaEntrada: horaCurta(r, 'hora_entrada'),
        dataSaida: texto(r, 'data_saida'),
        horaSaida: horaCurta(r, 'hora_saida'),
        km: digitavel(r, 'km_odometro'),
        fornecedor: texto(r, 'fornecedor'),
        servico: texto(r, 'servico'),
        valor: String(numero(r, 'valor')),
      },
    },

  quebra: ([r], atual) =>
    r === undefined ? atual : {
      ...atual,
      quebra: {
        data: texto(r, 'data'),
        m2Expedido: digitavel(r, 'm2_expedido'),
        m2Quebrado: digitavel(r, 'm2_quebrado'),
        observacao: texto(r, 'observacao'),
      },
    },
}

/** O id que a API de edicao espera: o do abastecimento inteiro, e nao o da parada clicada. */
function idParaEditar(registro: Registro): string {
  return texto(registro, registro.tipo === 'abastecimento' ? 'abastecimento_id' : 'id')
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
    quem: `${texto(r, 'motorista') || '·'} · ${texto(r, 'placa') || '·'}`,
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

const COLUNAS_DO_HISTORICO = ['Quando', 'Tipo', 'Quem / veículo', 'Descrição', 'Valor', ''] as const

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

function Historico({ registros, estado, deHoje, editando, aoEditar, aoApagar }: {
  readonly registros: readonly Registro[]
  readonly estado: 'carregando' | 'ok' | 'erro'
  readonly deHoje: number
  /** O id do registro que esta no formulario agora, para a linha dele sair destacada. */
  readonly editando: string | null
  readonly aoEditar: (registro: Registro) => void
  readonly aoApagar: (registro: Registro) => void
}): JSX.Element {
  const linhas = registros.slice(0, LINHAS_DO_HISTORICO)
  return (
    <>
      <CabecalhoDeBloco
        titulo="Histórico recente"
        subtitulo="Últimos lançamentos da base, do mais novo para o mais antigo"
        direita={<span className="g-l13 g-fraco">{deHoje} hoje</span>}
      />
      <Tabela
        cabecalho={COLUNAS_DO_HISTORICO.map((coluna) => (
          <Th key={coluna || 'acoes'} direita={coluna === 'Valor' || coluna === ''}>
            {coluna === '' ? <span className="g-escondido">Ações</span> : coluna}
          </Th>
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
                <Td direita>
                  {tipo === null
                    ? null
                    : (
                      <span className="g-rodape-acoes">
                        <Botao
                          tipo="terciario"
                          antes={PencilEdit}
                          rotulo={editando === idParaEditar(registro) ? 'Editando' : 'Editar'}
                          desabilitado={editando === idParaEditar(registro)}
                          aoClicar={() => aoEditar(registro)}
                        />
                        <Botao
                          tipo="terciario"
                          antes={Trash}
                          nome="Apagar"
                          aoClicar={() => aoApagar(registro)}
                        />
                      </span>
                    )}
                </Td>
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
  /** O catalogo de tipos de preventiva, o mesmo que a Frota usa pra configurar o plano. */
  readonly servicos: readonly Opcao[]
  /** A rota curta esconde o toggle de viagem longa e o desliga. */
  readonly rotaCurta: boolean
  readonly mudarViagem: (campo: keyof Viagem, valor: string) => void
  readonly mudarAbastecimento: (campo: CampoDeAbastecimento, valor: string) => void
  readonly mudarLonga: (longa: boolean) => void
  readonly adicionarParada: () => void
  readonly mudarParada: (indice: number, campo: keyof Parada, valor: string) => void
  readonly mudarManutencao: (campo: CampoDeManutencao, valor: string) => void
  readonly mudarTipoManutencao: (tipo: TipoDeManutencao) => void
  readonly mudarQuebra: (campo: keyof Quebra, valor: string) => void
}

function celulasDeViagem(f: Ferramentas): readonly Celula[] {
  const v = f.rascunho.viagem
  const custo = decimal(v.combustivel) + decimal(v.diarias)
  const atraso = atrasoDe(v)
  const atrasoEntrega = atrasoDaEntregaDe(v)
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
              tipo="data"
              rotulo="Data prevista de chegada"
              span={2}
              valor={v.dataPrevista}
              aoMudar={(valor) => f.mudarViagem('dataPrevista', valor)}
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
              rotulo="Status de pontualidade da rota"
              mono
              valor={atraso === null ? '' : rotuloDaPontualidade(atraso)}
            />
            <Campo
              tipo="numero"
              rotulo="m² total da carga"
              span={2}
              obrigatorio
              mono
              valor={v.m2}
              aoMudar={(valor) => f.mudarViagem('m2', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="Peso da carga em kg"
              span={2}
              obrigatorio
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
              span={6}
              mono
              valor={v.diarias}
              aoMudar={(valor) => f.mudarViagem('diarias', valor)}
            />
            <Campo
              tipo="dinheiro"
              rotulo="Combustível"
              span={6}
              mono
              valor={v.combustivel}
              aoMudar={(valor) => f.mudarViagem('combustivel', valor)}
            />
            <Campo tipo="calculado" rotulo="Total custo da viagem (R$)" span={6} mono valor={duasCasas(custo)} />
            <Campo
              tipo="calculado"
              rotulo="% do custo sobre a carga"
              span={6}
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
          <TituloDeSecao titulo="Pontualidade da rota" subtitulo="A diferença entre a hora prevista e a hora real de chegada" />
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
    {
      col: [1, 13],
      linha: 3,
      conteudo: (
        <>
          <TituloDeSecao
            titulo="Pontualidade da entrega"
            subtitulo="A diferença entre a data e hora previstas e a data e hora reais de chegada, mesmo quando atravessa dias"
          />
          {atrasoEntrega !== null && atrasoEntrega > 0
            ? (
              <>
                <div className="g-secao"><Badge cor="ambar" rotulo={`Atrasada em ${duracao(atrasoEntrega)}`} /></div>
                <div className="g-l13 g-fraco">
                  A entrega chegou depois do dia planejado. Quando a data real passa da data prevista, o
                  atraso conta os dias, não só as horas.
                </div>
              </>
            )
            : (
              <div className="g-l13 g-fraco">
                A pontualidade da entrega é calculada a partir da data prevista e da data real de chegada.
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
  const total = cheias.reduce((soma, parada) => soma + decimal(parada.litros) * valorPorLitro(parada.vlLitro), 0)
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
          <TituloDeSecao
            titulo="Dados do abastecimento"
            subtitulo="Data, veículo e de quem é a média que este abastecimento fecha"
          />
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
              rotulo="Motorista"
              obrigatorio
              dica="De quem é a média"
              opcoes={f.motoristas}
              valor={a.motorista}
              aoMudar={(valor) => f.mudarAbastecimento('motorista', valor)}
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
  // So a preventiva usa o catalogo: a corretiva e sempre um servico avulso, e forcar
  // a escolha de um tipo preventivo ali so atrapalharia. "Outro" e o escape tanto para
  // um servico que ainda nao esta no catalogo quanto para o historico anterior a ele.
  const servicoNoCatalogo = f.servicos.some((o) => o.valor === m.servico)
  const servicoSelecionado = m.servico === '' ? '' : (servicoNoCatalogo ? m.servico : OUTRO_SERVICO)
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
            {m.tipoManutencao === 'preventiva'
              ? (
                <>
                  <Campo
                    tipo="select"
                    rotulo="Serviço"
                    span={servicoSelecionado === OUTRO_SERVICO ? 4 : 8}
                    obrigatorio
                    dica="Selecione o serviço"
                    opcoes={[...f.servicos, { valor: OUTRO_SERVICO, rotulo: 'Outro (digitar abaixo)' }]}
                    valor={servicoSelecionado}
                    aoMudar={(valor) => f.mudarManutencao('servico', valor === OUTRO_SERVICO ? '' : valor)}
                  />
                  {servicoSelecionado === OUTRO_SERVICO
                    ? (
                      <Campo
                        rotulo="Descrição do serviço"
                        span={4}
                        obrigatorio
                        valor={m.servico}
                        aoMudar={(valor) => f.mudarManutencao('servico', valor)}
                      />
                    )
                    : null}
                </>
              )
              : (
                <Campo
                  rotulo="Serviço / descrição"
                  span={8}
                  obrigatorio
                  valor={m.servico}
                  aoMudar={(valor) => f.mudarManutencao('servico', valor)}
                />
              )}
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
          <TituloDeSecao titulo="Documentos da manutenção" />
          <div className="g-l13 g-fraco">
            Este formulário salva os dados da manutenção. Orçamento e ordem de serviço ainda não podem ser anexados aqui.
          </div>
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
              span={6}
              obrigatorio
              valor={q.data}
              aoMudar={(valor) => f.mudarQuebra('data', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="m² expedido"
              span={6}
              obrigatorio
              mono
              valor={q.m2Expedido}
              aoMudar={(valor) => f.mudarQuebra('m2Expedido', valor)}
            />
            <Campo
              tipo="numero"
              rotulo="m² com quebra"
              span={6}
              mono
              valor={q.m2Quebrado}
              aoMudar={(valor) => f.mudarQuebra('m2Quebrado', valor)}
            />
            <Campo
              tipo="calculado"
              rotulo="% de quebra"
              span={6}
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

// ---------- importar abastecimento ----------
//
// So a parada simples (uma linha = um abastecimento). Viagem longa com tres paradas
// exigiria casar linhas da planilha num grupo so, e ninguem pediu isso ainda; quem
// precisar lanca a viagem longa pela tela, como ja fazia.

const LOTE_IMPORT_ABASTECIMENTO = 100

function lerCsvAbastecimento(
  conteudo: string,
  base: string,
): { readonly achados: readonly Registro[]; readonly erros: readonly string[] } {
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
    const litros = decimal(linha.litros ?? '')
    const vlLitro = valorPorLitro(linha['vl_litro'] || linha['valor_litro'] || '')
    if (!linha.placa || !linha.data || !linha.motorista || litros <= 0 || vlLitro <= 0) {
      erros.push(`Linha ${i + 2}: faltou placa, data, motorista, litros ou valor por litro`)
      return
    }
    achados.push({
      tipo: 'abastecimento',
      base: linha.base || base,
      data: linha.data,
      placa: linha.placa.toUpperCase(),
      motorista: linha.motorista,
      rota: linha.rota || null,
      litros,
      vl_litro: vlLitro,
      km: linha.km ? inteiro(linha.km) || null : null,
      posto: linha.posto || '',
      slot: null,
      viagem_longa: false,
    })
  })
  return { achados, erros }
}

type PreviewDoImport =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'resumo'; readonly erros: readonly string[] }

function DialogoImportarAbastecimento({ base, aoFechar }: {
  readonly base: string
  readonly aoFechar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewDoImport | null>(null)
  const [aImportar, setAImportar] = useState<readonly Registro[]>([])
  const [enviando, setEnviando] = useState(false)

  const escolher = (arquivo: File): void => {
    setNomeDoArquivo(arquivo.name)
    const leitor = new FileReader()
    leitor.onload = () => {
      const { achados, erros } = lerCsvAbastecimento(String(leitor.result), base)
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
      for (let i = 0; i < total; i += LOTE_IMPORT_ABASTECIMENTO) {
        const lote = aImportar.slice(i, i + LOTE_IMPORT_ABASTECIMENTO)
        await salvarRegistros([...lote])
        gravados += lote.length
      }
    } catch (falha) {
      // O lote que passou nao volta, entao a fila perde os gravados e o proximo clique
      // repete so o que faltou, sem duplicar nada.
      setAImportar(aImportar.slice(gravados))
      const motivo = falha instanceof TypeError
        ? 'Sem conexão. Tente de novo.'
        : falha instanceof Error
        ? falha.message
        : 'Não foi possível importar.'
      avisar(`${gravados} de ${total} registros importados. ${motivo}`, 'erro')
      setEnviando(false)
      return
    }
    invalidar('registros')
    avisar(`${total} abastecimentos importados.`, 'ok')
    setEnviando(false)
    aoFechar()
  }

  return (
    <Dialogo
      aberto
      titulo="Importar abastecimento"
      subtitulo="O CSV precisa das colunas placa, data, motorista e litros, vl_litro. Rota, km e posto são opcionais."
      largura={640}
      aoFechar={aoFechar}
      acoes={
        <>
          <Botao tipo="terciario" rotulo="Cancelar" aoClicar={aoFechar} />
          {aImportar.length === 0
            ? null
            : (
              <Botao
                tipo="primario"
                rotulo="Importar registros"
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

// ---------- importar pontualidade da entrega ----------
//
// Nao cria viagem nenhuma: so troca a data e a hora previstas de chegada de uma
// viagem ja lancada, pela mesma rota PUT /registros/:id que o lapis da tela usa.
// A fabrica manda a data planejada de cada entrega numa planilha; ate existir
// integracao de verdade entre os dois sistemas (ver docs/planos/roteiro.md), o
// CSV e a ponte.

type LinhaPontualidade = {
  readonly placa: string
  readonly data: string
  readonly dataPrevista: string
  readonly horaPrevista: string
}

function lerCsvPontualidade(
  conteudo: string,
): { readonly achadas: readonly LinhaPontualidade[]; readonly erros: readonly string[] } {
  const linhas = conteudo.split('\n').map((l) => l.trim()).filter(Boolean)
  const [cabecalhoBruto, ...corpo] = linhas
  if (cabecalhoBruto === undefined || corpo.length === 0) return { achadas: [], erros: [] }
  const cabecalho = cabecalhoBruto.split(',').map((h) => h.trim().toLowerCase())
  const achadas: LinhaPontualidade[] = []
  const erros: string[] = []
  corpo.forEach((bruta, i) => {
    const colunas = bruta.split(',')
    const linha: Record<string, string> = {}
    cabecalho.forEach((h, j) => {
      linha[h] = (colunas[j] ?? '').trim()
    })
    if (!linha.placa || !linha.data || !linha['data_prevista'] || !linha['hora_prevista']) {
      erros.push(`Linha ${i + 2}: faltou placa, data, data_prevista ou hora_prevista`)
      return
    }
    achadas.push({
      placa: linha.placa.toUpperCase(),
      data: linha.data,
      dataPrevista: linha['data_prevista'],
      horaPrevista: linha['hora_prevista'],
    })
  })
  return { achadas, erros }
}

/** Reaproveita a viagem ja salva, trocando so a data e a hora previstas de chegada. */
function viagemComPontualidade(r: Registro, dataPrevista: string, horaPrevista: string): Registro {
  return {
    tipo: 'viagem',
    base: texto(r, 'base'),
    data_saida: texto(r, 'data_saida'),
    hora_saida: horaCurta(r, 'hora_saida') || null,
    data_chegada: texto(r, 'data_chegada') || null,
    hora_chegada: horaCurta(r, 'hora_chegada') || null,
    data_prevista: dataPrevista,
    hora_prevista: horaPrevista,
    motorista: texto(r, 'motorista'),
    veiculo: texto(r, 'veiculo'),
    rota: texto(r, 'rota'),
    km_saida: numero(r, 'km_saida'),
    km_chegada: numero(r, 'km_chegada') || null,
    valor_carga: numero(r, 'valor_carga'),
    combustivel: numero(r, 'combustivel'),
    diarias: numero(r, 'diarias'),
    m2: numero(r, 'm2'),
    peso_kg: numero(r, 'peso_kg'),
    observacao: texto(r, 'observacao'),
  }
}

type ResultadoLinha =
  & { readonly linha: LinhaPontualidade }
  & ({ readonly estado: 'ok' } | { readonly estado: 'erro'; readonly motivo: string })

function DialogoImportarPontualidade({ registros, aoFechar }: {
  readonly registros: readonly Registro[]
  readonly aoFechar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<readonly LinhaPontualidade[]>([])
  const [errosDoArquivo, setErrosDoArquivo] = useState<readonly string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<readonly ResultadoLinha[]>([])

  const escolher = (arquivo: File): void => {
    setNomeDoArquivo(arquivo.name)
    const leitor = new FileReader()
    leitor.onload = () => {
      const { achadas, erros } = lerCsvPontualidade(String(leitor.result))
      setLinhas(achadas)
      setErrosDoArquivo(erros)
      setResultados([])
    }
    leitor.readAsText(arquivo, 'UTF-8')
  }

  async function importar(): Promise<void> {
    setEnviando(true)
    const saida: ResultadoLinha[] = []
    for (const linha of linhas) {
      const compativeis = registros.filter((r) =>
        r.tipo === 'viagem' && texto(r, 'veiculo') === linha.placa && texto(r, 'data_saida') === linha.data
      )
      const [registro, ...resto] = compativeis
      if (registro === undefined) {
        saida.push({ linha, estado: 'erro', motivo: 'nenhuma viagem encontrada com essa placa e data' })
        continue
      }
      if (resto.length > 0) {
        saida.push({ linha, estado: 'erro', motivo: 'mais de uma viagem com essa placa e data; corrija pelo histórico' })
        continue
      }
      try {
        await atualizarRegistro(
          texto(registro, 'id'),
          [viagemComPontualidade(registro, linha.dataPrevista, linha.horaPrevista)],
        )
        saida.push({ linha, estado: 'ok' })
      } catch (falha) {
        saida.push({ linha, estado: 'erro', motivo: falha instanceof Error ? falha.message : 'não foi possível salvar' })
      }
    }
    setResultados(saida)
    setEnviando(false)
    invalidar('registros')
    const ok = saida.filter((r) => r.estado === 'ok').length
    avisar(`${ok} de ${saida.length} viagens atualizadas.`, ok === saida.length ? 'ok' : 'erro')
  }

  return (
    <Dialogo
      aberto
      titulo="Importar pontualidade da entrega"
      subtitulo="O CSV precisa das colunas placa, data, data_prevista e hora_prevista. A data é a de saída da viagem já lançada."
      largura={640}
      aoFechar={aoFechar}
      acoes={
        <>
          <Botao tipo="terciario" rotulo="Fechar" aoClicar={aoFechar} />
          {linhas.length === 0
            ? null
            : (
              <Botao
                tipo="primario"
                rotulo="Importar"
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
      {linhas.length === 0 && errosDoArquivo.length === 0
        ? null
        : (
          <div className="g-secao">
            <span className="g-l14">
              <span className="g-forte">{`${linhas.length} linhas`}</span>
              {' encontradas para importar'}
              {errosDoArquivo.length === 0
                ? null
                : <>{' · '}<span className="g-tom-critico">{`${errosDoArquivo.length} com erro no arquivo`}</span></>}
            </span>
          </div>
        )}
      {errosDoArquivo.map((erro) => <div className="g-l13 g-tom-critico" key={erro}>{erro}</div>)}
      {resultados.map((r, i) => (
        <div className={`g-l13 ${r.estado === 'erro' ? 'g-tom-critico' : 'g-tom-ok'}`} key={i}>
          {`${r.linha.placa} · ${dataBr(r.linha.data)}: ${r.estado === 'ok' ? 'atualizada' : r.motivo}`}
        </div>
      ))}
    </Dialogo>
  )
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
  const fechamentos = useRecurso('fechamentos', listarFechamentos)
  const preventiva = useRecurso('preventiva', obterPreventiva)

  const [base, setBase] = useState<string | null>(null)
  const [tipoEscolhido, setTipoEscolhido] = useState<Tipo>('viagem')
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio())
  const [salvando, setSalvando] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [limpezaAberta, setLimpezaAberta] = useState(false)
  /** O lancamento carregado no formulario para edicao. Sem ele, salvar cria um novo. */
  const [editando, setEditando] = useState<{ readonly id: string; readonly tipo: Tipo } | null>(null)
  const [fechando, setFechando] = useState(false)
  /** O lancamento esperando confirmacao para apagar, ou nulo com o dialogo fechado. */
  const [apagando, setApagando] = useState<Registro | null>(null)
  const [apagandoEmProgresso, setApagandoEmProgresso] = useState(false)
  const [importandoPontualidade, setImportandoPontualidade] = useState(false)
  const [importandoAbastecimento, setImportandoAbastecimento] = useState(false)

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
  const servicos: readonly Opcao[] = (preventiva.dados?.tipos ?? [])
    .map((t) => ({ valor: t.tipo, rotulo: t.tipo }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo))

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
  const mudarQuebra = (campo: keyof Quebra, valor: string): void => {
    setRascunho((r) => ({ ...r, quebra: { ...r.quebra, [campo]: valor } }))
  }

  const limparAba = (): void => {
    setRascunho((r) => LIMPADORES[tipo](r, rascunhoVazio()))
  }

  // Sair da edicao devolve a aba ao vazio: o que ficou no formulario era o registro, e deixa-lo
  // la faria o proximo "Salvar" parecer uma copia nova do registro editado.
  const cancelarEdicao = (): void => {
    if (editando === null) return
    setRascunho((r) => LIMPADORES[editando.tipo](r, rascunhoVazio()))
    setEditando(null)
  }

  const editar = (registro: Registro): void => {
    const doRegistro = tipoDe(registro.tipo)
    if (doRegistro === null) return
    const id = idParaEditar(registro)
    const grupo = doRegistro === 'abastecimento'
      ? daBase.filter((r) => r.tipo === 'abastecimento' && idParaEditar(r) === id)
      : [registro]
    setRascunho((r) => LEITORES_DE_RASCUNHO[doRegistro](grupo, r))
    setTipoEscolhido(doRegistro)
    setEditando({ id, tipo: doRegistro })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      if (editando === null) {
        await salvarRegistros(montagem.registros)
      } else {
        await atualizarRegistro(editando.id, montagem.registros)
      }
      invalidar('registros')
      limparAba()
      setEditando(null)
      const quantos = montagem.registros.length
      avisar(
        editando !== null
          ? 'Alterações gravadas.'
          : quantos > 1
          ? `${quantos} abastecimentos registrados.`
          : 'Registro gravado.',
        'ok',
      )
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

  /** Apaga o lancamento em `apagando`, depois da confirmacao no dialogo. */
  async function confirmarApagar(): Promise<void> {
    if (apagando === null) return
    const doRegistro = tipoDe(apagando.tipo)
    if (doRegistro === null) return
    const id = idParaEditar(apagando)
    setApagandoEmProgresso(true)
    try {
      await apagarRegistro(doRegistro, id)
      invalidar('registros')
      // O que estava no formulario era esse mesmo lancamento: sem isto, "Salvar" tentaria
      // corrigir um registro que acabou de sumir.
      if (editando !== null && editando.id === id) cancelarEdicao()
      setApagando(null)
      avisar('Lançamento apagado.', 'ok')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não foi possível apagar.', 'erro')
    } finally {
      setApagandoEmProgresso(false)
    }
  }

  /**
   * Fecha ou reabre o mes anterior da base ativa. So o admin ve este botao
   * (`sessao.capacidades.todasAsBases`), e a rota recusa de novo do lado do
   * servidor -- o botao some e a recusa continua ali, cinto e suspensorio.
   */
  async function alternarFechamento(): Promise<void> {
    if (base === null || fechando) return
    const mesAlvo = mesAnteriorISO(hoje)
    const aberto = (fechamentos.dados?.[base] ?? []).find((f) => f.mes === mesAlvo)
    setFechando(true)
    try {
      if (aberto) {
        await reabrirMes(aberto.id)
        avisar(`${base}: ${mesAlvo.slice(0, 7)} reaberto.`, 'ok')
      } else {
        await fecharMes(base, mesAlvo)
        avisar(`${base}: ${mesAlvo.slice(0, 7)} fechado.`, 'ok')
      }
      invalidar('fechamentos')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não foi possível mudar o fechamento.', 'erro')
    } finally {
      setFechando(false)
    }
  }

  const ferramentas: Ferramentas = {
    rascunho,
    motoristas,
    veiculos,
    rotas,
    servicos,
    rotaCurta,
    mudarViagem,
    mudarAbastecimento,
    mudarLonga,
    adicionarParada,
    mudarParada,
    mudarManutencao,
    mudarTipoManutencao,
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
          <Historico
            registros={daBase}
            estado={registros.estado}
            deHoje={deHoje}
            editando={editando?.id ?? null}
            aoEditar={editar}
            aoApagar={setApagando}
          />
          <RodapeDeFormulario
            apoio="Os campos em cinza são calculados a partir dos outros."
            acoes={
              <>
                <Botao
                  tipo="terciario"
                  rotulo={editando === null ? 'Limpar formulário' : 'Cancelar edição'}
                  aoClicar={editando === null ? limparAba : cancelarEdicao}
                />
                <Botao
                  tipo="primario"
                  tamanho="medio"
                  antes={Check}
                  rotulo={editando === null ? ROTULO_DE_SALVAR[tipo] : 'Salvar alterações'}
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

  const mesAnterior = mesAnteriorISO(hoje)
  const mesAnteriorFechado = base !== null && (fechamentos.dados?.[base] ?? []).some((f) => f.mes === mesAnterior)

  const itensDoMenu = [
    { rotulo: 'Exportar JSON', aoEscolher: exportar },
    { rotulo: 'Limpar registros de hoje', aoEscolher: () => setLimpezaAberta(true) },
    ...(sessao.tipos.includes('viagem')
      ? [{ rotulo: 'Importar pontualidade da entrega', aoEscolher: () => setImportandoPontualidade(true) }]
      : []),
    ...(sessao.tipos.includes('abastecimento') && base !== null
      ? [{ rotulo: 'Importar abastecimento', aoEscolher: () => setImportandoAbastecimento(true) }]
      : []),
    ...(sessao.capacidades.todasAsBases && base !== null
      ? [{
        rotulo: `${mesAnteriorFechado ? 'Reabrir' : 'Fechar'} ${mesAnterior.slice(0, 7)} desta base`,
        aoEscolher: () => void alternarFechamento(),
      }]
      : []),
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
              rotulo={editando === null ? 'Salvar registro' : 'Salvar alterações'}
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
              aoEscolher={(nome) => {
                cancelarEdicao()
                setBase(nome)
              }}
            />
            <span className="g-l12 g-fraco">O registro entra na base marcada.</span>
          </div>
        )
        : null}

      {editando === null
        ? null
        : (
          <div className="g-secao" role="status">
            <span className="g-l14 g-forte">Editando um lançamento já gravado: {ROTULO_DO_TIPO[editando.tipo].toLowerCase()}.</span>
            <span className="g-l12 g-fraco">Mexa no que precisa e salve. Trocar de aba ou de base cancela a edição.</span>
            <Botao tipo="terciario" rotulo="Cancelar edição" aoClicar={cancelarEdicao} />
          </div>
        )}

      <div className="g-secao">
        <Abas
          itens={permitidos.map((t) => ROTULO_DE_ABA[t])}
          ativa={permitidos.indexOf(tipo)}
          aoTrocar={(indice) => {
            const escolhido = permitidos[indice]
            if (escolhido === undefined) return
            if (escolhido !== editando?.tipo) cancelarEdicao()
            setTipoEscolhido(escolhido)
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

      <Dialogo
        aberto={apagando !== null}
        titulo="Apagar lançamento"
        subtitulo={apagando === null ? '' : ROTULO_DO_TIPO[tipoDe(apagando.tipo) ?? 'viagem']}
        aoFechar={() => setApagando(null)}
        acoes={
          <>
            <Botao tipo="terciario" rotulo="Cancelar" aoClicar={() => setApagando(null)} />
            <Botao
              tipo="primario"
              rotulo="Apagar lançamento"
              carregando={apagandoEmProgresso}
              aoClicar={() => void confirmarApagar()}
            />
          </>
        }
      >
        <div className="g-l14">
          {(() => {
            if (apagando === null) return null
            const tipoDoApagando = tipoDe(apagando.tipo)
            const linha = tipoDoApagando === null ? null : LEITORES[tipoDoApagando](apagando)
            return linha === null
              ? 'Isto apaga este lançamento do histórico. Não tem como desfazer pela tela.'
              : `Isto apaga "${linha.quem} · ${linha.descricao}" do histórico. Não tem como desfazer pela tela.`
          })()}
        </div>
      </Dialogo>

      {importandoPontualidade
        ? <DialogoImportarPontualidade registros={daBase} aoFechar={() => setImportandoPontualidade(false)} />
        : null}

      {importandoAbastecimento && base !== null
        ? <DialogoImportarAbastecimento base={base} aoFechar={() => setImportandoAbastecimento(false)} />
        : null}
    </>
  )
}
