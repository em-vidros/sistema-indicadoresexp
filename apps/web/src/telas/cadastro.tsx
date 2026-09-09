/**
 * O cadastro, a tela em que bases, veiculos, colaboradores e rotas nascem e morrem. O
 * artboard e o `Cadastro` de `var/design-dashboard/build.mjs`, e ele manda no desenho.
 *
 * Sao quatro colecoes de formas diferentes, e a tentacao e escrever quatro telas. O que
 * as separa e pequeno: quais colunas a tabela desenha e o que o dialogo edita. O resto,
 * busca, chip de base, paginacao, selo de status e menu da linha, e identico nas quatro.
 * Por isso cada colecao vira uma `Linha` achatada, com o texto de busca ja em minusculas
 * e um `baseId` que existe ate nas bases, onde ele e o id da propria base. Com a linha
 * achatada, filtrar, paginar e desenhar sao um caminho so; a diferenca entre as abas mora
 * inteira na tabela `ABAS`, e nao numa cadeia de if espalhada pela tela.
 *
 * O `Rascunho` e uma uniao com `aba` na frente porque ele atravessa a tela toda: nasce no
 * botao primario ou na linha da tabela, vira campo no dialogo e vira `EntradaVeiculo` ou
 * `EntradaBase` na gravacao. Sendo uniao, o `switch` de `gravar` cobre os quatro casos e o
 * compilador reclama quando um quinto aparecer. `id` nulo e criacao; e a unica diferenca
 * entre o POST e o PUT.
 *
 * O menu da linha e o Salvar do dialogo passam os dois pela mesma `gravar`: desativar e
 * gravar o mesmo rascunho com `ativo` invertido, e nao um caminho proprio. Por isso o
 * `ativo` nao aparece no formulario.
 *
 * A coluna "Preventiva a cada" do artboard ficou de fora de proposito: o backend nao
 * guarda esse intervalo por veiculo, e coluna desenhada sem dado atras e coluna vazia.
 */
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { invalidar, useRecurso, useSessao } from '../app/dados.ts'
import { Caixa, Campo, Chips, Dialogo, GradeDeCampos, useAvisos } from '../geist/formulario.tsx'
import { ChevronLeft, ChevronRight, Database, Icone, MoreHorizontal, Plus } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Entrada,
  Esqueleto,
  Estatistica,
  Grade,
  Menu,
  Tabela,
  Td,
  Th,
  Vazio,
} from '../geist/primitivos.tsx'
import type { Opcao } from '../geist/primitivos.tsx'
import {
  FalhaDeCadastro,
  atualizarBase,
  atualizarColaborador,
  atualizarRota,
  atualizarVeiculo,
  criarBase,
  criarColaborador,
  criarRota,
  criarVeiculo,
  obterCadastro,
} from '../js/cadastro-api.ts'
import type {
  CatalogoCadastro,
  EntradaBase,
  EntradaColaborador,
  EntradaRota,
  EntradaVeiculo,
  FuncaoColaborador,
} from '../js/cadastro-api.ts'

type Aba = 'veiculos' | 'colaboradores' | 'rotas' | 'bases'

/** O que o dialogo edita e o que a gravacao envia. `id` nulo e criacao. */
type Rascunho =
  | { readonly aba: 'veiculos'; readonly id: string | null; readonly placa: string; readonly marca: string; readonly modelo: string; readonly ano: string; readonly baseId: string; readonly ativo: boolean }
  | { readonly aba: 'colaboradores'; readonly id: string | null; readonly nome: string; readonly cargo: string; readonly funcao: FuncaoColaborador; readonly admissao: string; readonly baseId: string; readonly ativo: boolean }
  | { readonly aba: 'rotas'; readonly id: string | null; readonly nome: string; readonly baseId: string; readonly local: boolean; readonly ativo: boolean }
  | { readonly aba: 'bases'; readonly id: string | null; readonly nome: string; readonly ativo: boolean }

/** Uma linha ja achatada: o que a tabela desenha, o que a busca le e o que o menu abre. */
type Linha = {
  readonly id: string
  /** Ja em minusculas, para a busca comparar sem refazer isso a cada tecla. */
  readonly busca: string
  readonly baseId: string
  readonly ativo: boolean
  readonly celulas: readonly ReactNode[]
  readonly rascunho: Rascunho
}

type Especie = {
  readonly rotulo: string
  readonly novo: string
  readonly editar: string
  readonly titulo: string
  readonly subtitulo: string
  /** Sem Status e sem a do menu, que sao as mesmas nas quatro e entram no desenho. */
  readonly colunas: readonly string[]
  readonly linhas: (catalogo: CatalogoCadastro) => readonly Linha[]
  readonly vazio: { readonly titulo: string; readonly texto: string }
  readonly rascunho: (baseId: string) => Rascunho
  readonly salvo: string
  readonly desativado: string
  readonly reativado: string
}

const POR_PAGINA = 20

const ROTULO_DA_FUNCAO: Readonly<Record<FuncaoColaborador, string>> = {
  motorista: 'Motorista',
  ajudante: 'Ajudante',
  atendimento: 'Atendimento',
  logistica: 'Logística',
}

const PLURAL_DA_FUNCAO: Readonly<Record<FuncaoColaborador, string>> = {
  motorista: 'motoristas',
  ajudante: 'ajudantes',
  atendimento: 'atendimentos',
  logistica: 'logísticas',
}

const FUNCOES = Object.keys(ROTULO_DA_FUNCAO) as readonly FuncaoColaborador[]

const OPCOES_DE_FUNCAO: readonly Opcao<string>[] = FUNCOES.map((funcao) => ({
  valor: funcao,
  rotulo: ROTULO_DA_FUNCAO[funcao],
}))

const AUSENTE = <span className="g-fraco">·</span>

function texto(valor: string | null): ReactNode {
  return valor === null || valor === '' ? AUSENTE : valor
}

function mono(valor: string | null): ReactNode {
  return valor === null || valor === '' ? AUSENTE : <span className="g-l13m">{valor}</span>
}

/** A API manda a admissao em `AAAA-MM-DD`, e a tabela mostra o dia na frente. */
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return dia === undefined ? iso : `${dia}/${mes}/${ano}`
}

function juntarComE(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

function contar(quantos: number, singular: string, plural: string): string {
  return `${quantos} ${quantos === 1 ? singular : plural}`
}

function vazioNulo(valor: string): string | null {
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

const ABAS: Readonly<Record<Aba, Especie>> = {
  veiculos: {
    rotulo: 'Veículos',
    novo: 'Novo veículo',
    editar: 'Editar veículo',
    titulo: 'Veículos',
    subtitulo: 'A placa daqui é a que aparece em Registrar rota, Manutenção e Documentos',
    colunas: ['Placa', 'Marca', 'Modelo', 'Ano', 'Base'],
    linhas: (catalogo) => catalogo.veiculos.map((veiculo) => ({
      id: veiculo.id,
      busca: `${veiculo.placa} ${veiculo.marca ?? ''} ${veiculo.modelo ?? ''} ${veiculo.base}`.toLowerCase(),
      baseId: veiculo.baseId,
      ativo: veiculo.ativo,
      celulas: [
        <span className="g-l13m g-forte">{veiculo.placa}</span>,
        texto(veiculo.marca),
        texto(veiculo.modelo),
        mono(veiculo.ano),
        texto(veiculo.base),
      ],
      rascunho: {
        aba: 'veiculos',
        id: veiculo.id,
        placa: veiculo.placa,
        marca: veiculo.marca ?? '',
        modelo: veiculo.modelo ?? '',
        ano: veiculo.ano ?? '',
        baseId: veiculo.baseId,
        ativo: veiculo.ativo,
      },
    })),
    vazio: {
      titulo: 'Nenhum veículo',
      texto: 'Nenhum veículo com este recorte. Cadastre um ou limpe a busca e o chip de base.',
    },
    rascunho: (baseId) => ({
      aba: 'veiculos',
      id: null,
      placa: '',
      marca: '',
      modelo: '',
      ano: '',
      baseId,
      ativo: true,
    }),
    salvo: 'Veículo salvo',
    desativado: 'Veículo desativado',
    reativado: 'Veículo reativado',
  },

  colaboradores: {
    rotulo: 'Colaboradores',
    novo: 'Novo colaborador',
    editar: 'Editar colaborador',
    titulo: 'Colaboradores',
    subtitulo: 'O nome daqui é o que aparece como motorista e ajudante em Registrar rota',
    colunas: ['Nome', 'Cargo', 'Função', 'Admissão', 'Base'],
    linhas: (catalogo) => catalogo.colaboradores.map((pessoa) => ({
      id: pessoa.id,
      busca: `${pessoa.nome} ${pessoa.cargo ?? ''} ${ROTULO_DA_FUNCAO[pessoa.funcao]} ${pessoa.base}`.toLowerCase(),
      baseId: pessoa.baseId,
      ativo: pessoa.ativo,
      celulas: [
        <span className="g-forte">{pessoa.nome}</span>,
        texto(pessoa.cargo),
        ROTULO_DA_FUNCAO[pessoa.funcao],
        pessoa.admissao === null ? AUSENTE : mono(dataBr(pessoa.admissao)),
        texto(pessoa.base),
      ],
      rascunho: {
        aba: 'colaboradores',
        id: pessoa.id,
        nome: pessoa.nome,
        cargo: pessoa.cargo ?? '',
        funcao: pessoa.funcao,
        admissao: pessoa.admissao ?? '',
        baseId: pessoa.baseId,
        ativo: pessoa.ativo,
      },
    })),
    vazio: {
      titulo: 'Nenhum colaborador',
      texto: 'Nenhum colaborador com este recorte. Cadastre um ou limpe a busca e o chip de base.',
    },
    rascunho: (baseId) => ({
      aba: 'colaboradores',
      id: null,
      nome: '',
      cargo: '',
      funcao: 'motorista',
      admissao: '',
      baseId,
      ativo: true,
    }),
    salvo: 'Colaborador salvo',
    desativado: 'Colaborador desativado',
    reativado: 'Colaborador reativado',
  },

  rotas: {
    rotulo: 'Rotas',
    novo: 'Nova rota',
    editar: 'Editar rota',
    titulo: 'Rotas',
    subtitulo: 'O nome daqui é o que aparece na lista de rotas de Registrar rota',
    colunas: ['Nome', 'Base', 'Tipo'],
    linhas: (catalogo) => catalogo.rotas.map((rota) => ({
      id: rota.id,
      busca: `${rota.nome} ${rota.base}`.toLowerCase(),
      baseId: rota.baseId,
      ativo: rota.ativo,
      celulas: [
        <span className="g-forte">{rota.nome}</span>,
        texto(rota.base),
        rota.local ? 'Local' : 'Viagem',
      ],
      rascunho: {
        aba: 'rotas',
        id: rota.id,
        nome: rota.nome,
        baseId: rota.baseId,
        local: rota.local,
        ativo: rota.ativo,
      },
    })),
    vazio: {
      titulo: 'Nenhuma rota',
      texto: 'Nenhuma rota com este recorte. Cadastre uma ou limpe a busca e o chip de base.',
    },
    rascunho: (baseId) => ({ aba: 'rotas', id: null, nome: '', baseId, local: false, ativo: true }),
    salvo: 'Rota salva',
    desativado: 'Rota desativada',
    reativado: 'Rota reativada',
  },

  bases: {
    rotulo: 'Bases',
    novo: 'Nova base',
    editar: 'Editar base',
    titulo: 'Bases',
    subtitulo: 'A base é o recorte que a sidebar e o painel usam em todas as telas',
    colunas: ['Nome', 'Veículos', 'Colaboradores', 'Rotas'],
    linhas: (catalogo) => catalogo.bases.map((base) => ({
      id: base.id,
      busca: base.nome.toLowerCase(),
      baseId: base.id,
      ativo: base.ativo,
      celulas: [
        <span className="g-forte">{base.nome}</span>,
        <span className="g-l13m">{catalogo.veiculos.filter((v) => v.baseId === base.id).length}</span>,
        <span className="g-l13m">{catalogo.colaboradores.filter((c) => c.baseId === base.id).length}</span>,
        <span className="g-l13m">{catalogo.rotas.filter((r) => r.baseId === base.id).length}</span>,
      ],
      rascunho: { aba: 'bases', id: base.id, nome: base.nome, ativo: base.ativo },
    })),
    vazio: {
      titulo: 'Nenhuma base',
      texto: 'Nenhuma base com este recorte. Cadastre uma ou limpe a busca.',
    },
    rascunho: () => ({ aba: 'bases', id: null, nome: '', ativo: true }),
    salvo: 'Base salva',
    desativado: 'Base desativada',
    reativado: 'Base reativada',
  },
}

const ORDEM: readonly Aba[] = ['veiculos', 'colaboradores', 'rotas', 'bases']

type Vista = {
  readonly aba: Aba
  readonly busca: string
  readonly baseId: string
  readonly pagina: number
}

const VISTA_INICIAL: Vista = { aba: 'veiculos', busca: '', baseId: '', pagina: 1 }

/** Toda mudanca de recorte volta para a primeira pagina, senao a tabela abre vazia. */
function restringir(vista: Vista, mudanca: Partial<Omit<Vista, 'pagina'>>): Vista {
  return { ...vista, ...mudanca, pagina: 1 }
}

/** A gravacao inteira: uma entrada montada do rascunho, e o POST ou o PUT conforme o id. */
async function gravar(rascunho: Rascunho): Promise<void> {
  switch (rascunho.aba) {
    case 'veiculos': {
      const entrada: EntradaVeiculo = {
        placa: rascunho.placa.trim(),
        marca: vazioNulo(rascunho.marca),
        modelo: vazioNulo(rascunho.modelo),
        ano: vazioNulo(rascunho.ano),
        baseId: rascunho.baseId,
        ativo: rascunho.ativo,
      }
      if (rascunho.id === null) await criarVeiculo(entrada)
      else await atualizarVeiculo(rascunho.id, entrada)
      return
    }
    case 'colaboradores': {
      const entrada: EntradaColaborador = {
        nome: rascunho.nome.trim(),
        cargo: vazioNulo(rascunho.cargo),
        funcao: rascunho.funcao,
        admissao: vazioNulo(rascunho.admissao),
        baseId: rascunho.baseId,
        ativo: rascunho.ativo,
      }
      if (rascunho.id === null) await criarColaborador(entrada)
      else await atualizarColaborador(rascunho.id, entrada)
      return
    }
    case 'rotas': {
      const entrada: EntradaRota = {
        nome: rascunho.nome.trim(),
        baseId: rascunho.baseId,
        local: rascunho.local,
        ativo: rascunho.ativo,
      }
      if (rascunho.id === null) await criarRota(entrada)
      else await atualizarRota(rascunho.id, entrada)
      return
    }
    case 'bases': {
      const entrada: EntradaBase = { nome: rascunho.nome.trim(), ativo: rascunho.ativo }
      if (rascunho.id === null) await criarBase(entrada)
      else await atualizarBase(rascunho.id, entrada)
    }
  }
}

function comAtivo(rascunho: Rascunho, ativo: boolean): Rascunho {
  switch (rascunho.aba) {
    case 'veiculos': return { ...rascunho, ativo }
    case 'colaboradores': return { ...rascunho, ativo }
    case 'rotas': return { ...rascunho, ativo }
    case 'bases': return { ...rascunho, ativo }
  }
}

/** O dialogo aberto: o que se edita e a mensagem de conflito que a API devolveu. */
type Edicao = { readonly rascunho: Rascunho; readonly erro: string | undefined }

function Campos({ rascunho, erro, bases, mudar }: {
  readonly rascunho: Rascunho
  readonly erro: string | undefined
  readonly bases: readonly Opcao<string>[]
  readonly mudar: (rascunho: Rascunho) => void
}): JSX.Element {
  // `exactOptionalPropertyTypes` recusa `erro={undefined}`, entao a prop entra por spread.
  const conflito = erro === undefined ? {} : { erro }

  if (rascunho.aba === 'veiculos') {
    return (
      <GradeDeCampos>
        <Campo
          rotulo="Placa"
          valor={rascunho.placa}
          mono
          obrigatorio
          {...conflito}
          aoMudar={(valor) => mudar({ ...rascunho, placa: valor.toUpperCase() })}
        />
        <Campo rotulo="Marca" valor={rascunho.marca} aoMudar={(marca) => mudar({ ...rascunho, marca })} />
        <Campo rotulo="Modelo" valor={rascunho.modelo} aoMudar={(modelo) => mudar({ ...rascunho, modelo })} />
        <Campo rotulo="Ano" valor={rascunho.ano} aoMudar={(ano) => mudar({ ...rascunho, ano })} />
        <Campo
          rotulo="Base"
          tipo="select"
          valor={rascunho.baseId}
          opcoes={bases}
          obrigatorio
          aoMudar={(baseId) => mudar({ ...rascunho, baseId })}
        />
      </GradeDeCampos>
    )
  }

  if (rascunho.aba === 'colaboradores') {
    return (
      <GradeDeCampos>
        <Campo
          rotulo="Nome"
          valor={rascunho.nome}
          span={6}
          obrigatorio
          {...conflito}
          aoMudar={(nome) => mudar({ ...rascunho, nome })}
        />
        <Campo rotulo="Cargo" valor={rascunho.cargo} span={6} aoMudar={(cargo) => mudar({ ...rascunho, cargo })} />
        <Campo
          rotulo="Função"
          tipo="select"
          valor={rascunho.funcao}
          opcoes={OPCOES_DE_FUNCAO}
          obrigatorio
          aoMudar={(valor) => mudar({ ...rascunho, funcao: valor as FuncaoColaborador })}
        />
        <Campo
          rotulo="Admissão"
          tipo="data"
          valor={rascunho.admissao}
          aoMudar={(admissao) => mudar({ ...rascunho, admissao })}
        />
        <Campo
          rotulo="Base"
          tipo="select"
          valor={rascunho.baseId}
          opcoes={bases}
          obrigatorio
          aoMudar={(baseId) => mudar({ ...rascunho, baseId })}
        />
      </GradeDeCampos>
    )
  }

  if (rascunho.aba === 'rotas') {
    return (
      <>
        <GradeDeCampos>
          <Campo
            rotulo="Nome"
            valor={rascunho.nome}
            span={6}
            obrigatorio
            {...conflito}
            aoMudar={(nome) => mudar({ ...rascunho, nome })}
          />
          <Campo
            rotulo="Base"
            tipo="select"
            valor={rascunho.baseId}
            opcoes={bases}
            span={6}
            obrigatorio
            aoMudar={(baseId) => mudar({ ...rascunho, baseId })}
          />
        </GradeDeCampos>
        {/* Fora da grade porque um `g-campo` solto ocupa uma das 12 colunas, e a caixinha
            nao cabe em 40 px. `g-check` e a linha que ja existe para isto. */}
        <div className="g-check">
          <Caixa
            marcado={rascunho.local}
            rotulo="Rota local"
            aoMudar={(local) => mudar({ ...rascunho, local })}
          />
        </div>
      </>
    )
  }

  return (
    <GradeDeCampos>
      <Campo
        rotulo="Nome"
        valor={rascunho.nome}
        span={12}
        obrigatorio
        {...conflito}
        aoMudar={(nome) => mudar({ ...rascunho, nome })}
      />
    </GradeDeCampos>
  )
}

export default function Cadastro(): JSX.Element {
  const catalogo = useRecurso('cadastro-todos', () => obterCadastro(true))
  const sessao = useSessao()
  const { avisar } = useAvisos()
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [salvando, setSalvando] = useState(false)

  const admin = sessao.dados?.admin === true
  const abas = admin ? ORDEM : ORDEM.slice(0, 3)
  const aba = !admin && vista.aba === 'bases' ? 'veiculos' : vista.aba
  const especie = ABAS[aba]

  const dados = catalogo.dados
  if (dados === null) {
    if (catalogo.estado === 'carregando') return <Esqueleto />
    return (
      <Vazio
        icone={Database}
        titulo="O cadastro não carregou"
        texto="A lista de bases, veículos, colaboradores e rotas não chegou."
        acao={<Botao rotulo="Tentar de novo" aoClicar={catalogo.recarregar} />}
      />
    )
  }

  const opcoesDeBase: readonly Opcao<string>[] = dados.bases.map((base) => ({
    valor: base.id,
    rotulo: base.nome,
  }))
  const chipsDeBase: readonly Opcao<string>[] = [{ valor: '', rotulo: 'Todas as bases' }, ...opcoesDeBase]
  const baseAtual = vista.baseId === '' ? (dados.bases[0]?.id ?? '') : vista.baseId

  const alvo = vista.busca.trim().toLowerCase()
  const achadas = especie.linhas(dados)
    .filter((linha) => vista.baseId === '' || linha.baseId === vista.baseId)
    .filter((linha) => alvo === '' || linha.busca.includes(alvo))

  const paginas = Math.max(1, Math.ceil(achadas.length / POR_PAGINA))
  const pagina = Math.min(vista.pagina, paginas)
  const primeira = (pagina - 1) * POR_PAGINA
  const naPagina = achadas.slice(primeira, primeira + POR_PAGINA)

  const inativos = dados.veiculos.filter((veiculo) => !veiculo.ativo).length
  const porFuncao = FUNCOES
    .map((funcao) => ({
      funcao,
      quantos: dados.colaboradores.filter((pessoa) => pessoa.funcao === funcao).length,
    }))
    .filter((par) => par.quantos > 0)
    .map((par) => contar(par.quantos, ROTULO_DA_FUNCAO[par.funcao].toLowerCase(), PLURAL_DA_FUNCAO[par.funcao]))
  const rotasPorBase = dados.bases
    .map((base) => ({ base, quantas: dados.rotas.filter((rota) => rota.baseId === base.id).length }))
    .filter((par) => par.quantas > 0)
    .map((par) => `${par.quantas} ${par.base.nome}`)

  const terminar = (mensagem: string): void => {
    setSalvando(false)
    setEdicao(null)
    invalidar('cadastro')
    avisar(mensagem)
  }

  const falhar = (motivo: unknown, noCampo: boolean): void => {
    setSalvando(false)
    const mensagem = motivo instanceof Error ? motivo.message : 'não foi possível salvar'
    if (noCampo && motivo instanceof FalhaDeCadastro && motivo.status === 409) {
      setEdicao((atual) => (atual === null ? null : { ...atual, erro: mensagem }))
      return
    }
    avisar(mensagem, 'erro')
  }

  const salvar = (): void => {
    if (edicao === null) return
    setSalvando(true)
    void gravar(edicao.rascunho).then(
      () => terminar(especie.salvo),
      (motivo: unknown) => falhar(motivo, true),
    )
  }

  const alternar = (linha: Linha): void => {
    void gravar(comAtivo(linha.rascunho, !linha.ativo)).then(
      () => terminar(linha.ativo ? especie.desativado : especie.reativado),
      (motivo: unknown) => falhar(motivo, false),
    )
  }

  const colunas = [...especie.colunas, 'Status', '']

  const bloco = (
    <>
      <CabecalhoDeBloco titulo={especie.titulo} subtitulo={especie.subtitulo} />
      {achadas.length === 0
        ? <Vazio icone={Database} titulo={especie.vazio.titulo} texto={especie.vazio.texto} />
        : (
          <>
            <Tabela cabecalho={colunas.map((coluna, i) => <Th key={i}>{coluna}</Th>)}>
              {naPagina.map((linha) => (
                <tr key={linha.id}>
                  {linha.celulas.map((celula, i) => <Td key={i}>{celula}</Td>)}
                  <Td>
                    {linha.ativo
                      ? <Badge rotulo="Ativo" cor="verde" />
                      : <Badge rotulo="Inativo" cor="cinza" />}
                  </Td>
                  <Td>
                    <Menu
                      aparencia="quadrado"
                      nome="Ações da linha"
                      gatilho={<Icone de={MoreHorizontal} />}
                      itens={[
                        {
                          rotulo: 'Editar',
                          aoEscolher: () => setEdicao({ rascunho: linha.rascunho, erro: undefined }),
                        },
                        {
                          rotulo: linha.ativo ? 'Desativar' : 'Reativar',
                          aoEscolher: () => alternar(linha),
                        },
                      ]}
                    />
                  </Td>
                </tr>
              ))}
            </Tabela>
            <div className="g-paginacao">
              <span className="g-paginacao-conta g-l13">
                {primeira + 1} a {primeira + naPagina.length} de {achadas.length}
              </span>
              <div className="g-paginacao-botoes">
                <Botao
                  rotulo="Anterior"
                  antes={ChevronLeft}
                  desabilitado={pagina === 1}
                  aoClicar={() => setVista((atual) => ({ ...atual, pagina: Math.max(1, pagina - 1) }))}
                />
                <Botao
                  rotulo="Próxima"
                  depois={ChevronRight}
                  desabilitado={pagina === paginas}
                  aoClicar={() => setVista((atual) => ({ ...atual, pagina: Math.min(paginas, pagina + 1) }))}
                />
              </div>
            </div>
          </>
        )}
    </>
  )

  return (
    <>
      <CabecalhoDePagina
        titulo="Cadastro"
        subtitulo="Bases, veículos, colaboradores e rotas que as outras telas leem"
        acoes={
          <>
            <Entrada
              marcador="Buscar placa, nome ou rota"
              largura={280}
              valor={vista.busca}
              aoDigitar={(busca) => setVista((atual) => restringir(atual, { busca }))}
            />
            <Botao
              rotulo={especie.novo}
              tipo="primario"
              antes={Plus}
              aoClicar={() => setEdicao({ rascunho: especie.rascunho(baseAtual), erro: undefined })}
            />
          </>
        }
      />

      <div className="g-barra">
        <Abas
          itens={abas.map((cada) => ABAS[cada].rotulo)}
          ativa={abas.indexOf(aba)}
          aoTrocar={(indice) => setVista((atual) => restringir(atual, { aba: abas[indice] ?? 'veiculos' }))}
        />
        <span className="g-barra-vao" />
        <Chips
          valor={vista.baseId}
          opcoes={chipsDeBase}
          aoEscolher={(baseId) => setVista((atual) => restringir(atual, { baseId }))}
        />
      </div>

      <Grade
        celulas={[
          {
            col: [1, 4],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Bases"
                valor={String(dados.bases.length)}
                apoio={dados.bases.length === 0
                  ? 'Nenhuma base cadastrada'
                  : juntarComE(dados.bases.map((base) => base.nome))}
              />
            ),
          },
          {
            col: [4, 7],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Veículos"
                valor={String(dados.veiculos.length)}
                apoio={`${contar(dados.veiculos.length - inativos, 'ativo', 'ativos')} · ${contar(inativos, 'inativo', 'inativos')}`}
              />
            ),
          },
          {
            col: [7, 10],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Colaboradores"
                valor={String(dados.colaboradores.length)}
                apoio={porFuncao.length === 0 ? 'Nenhum colaborador cadastrado' : porFuncao.join(' · ')}
              />
            ),
          },
          {
            col: [10, 13],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Rotas"
                valor={String(dados.rotas.length)}
                apoio={rotasPorBase.length === 0 ? 'Nenhuma rota cadastrada' : rotasPorBase.join(' · ')}
              />
            ),
          },
          { col: [1, 13], linha: 2, rente: true, conteudo: bloco },
        ]}
      />

      {edicao === null
        ? null
        : (
          <Dialogo
            aberto
            titulo={edicao.rascunho.id === null ? especie.novo : especie.editar}
            aoFechar={() => setEdicao(null)}
            acoes={
              <>
                <Botao rotulo="Cancelar" aoClicar={() => setEdicao(null)} />
                <Botao rotulo="Salvar" tipo="primario" carregando={salvando} aoClicar={salvar} />
              </>
            }
          >
            <Campos
              rascunho={edicao.rascunho}
              erro={edicao.erro}
              bases={opcoesDeBase}
              mudar={(rascunho) => setEdicao({ rascunho, erro: undefined })}
            />
          </Dialogo>
        )}
    </>
  )
}
