/**
 * A ficha de integracao de 45 dias: quem entrou, o que ele ja cumpriu semana a semana, a
 * matriz de avaliacao do programa, as assinaturas e o historico das fichas salvas.
 *
 * A ficha inteira e um estado so, e nao onze campos soltos, porque os onze se movem
 * juntos. Trocar de funcao zera cinco deles e preserva seis; escolher um colaborador
 * preenche tres; carregar do historico reescreve todos. Com um `useState` por campo, cada
 * uma dessas tres acoes vira uma fileira de chamadas que da para esquecer pela metade, e
 * foi assim que a tela velha perdeu o `cargo` ao trocar de funcao.
 *
 * O progresso e indexado pelo `codigo` da atividade e nao pelo `id` porque `codigo` e o
 * que o historico devolve em `atividades[].codigo`. O `id` so aparece na hora de gravar, e
 * nessa hora ele vem do catalogo do programa, que esta na mao.
 *
 * A folha de impressao e JSX escondido, e nao string com `innerHTML`. O modulo velho
 * montava 14 KB de HTML a cada clique e escapava o texto com um `e()` proprio, que e um
 * lugar a mais para esquecer um campo. Em JSX a folha ja esta montada em toda volta, o
 * escape e do React, e imprimir vira uma chamada de `window.print()`. Ela sai por portal
 * no `<body>`, fora de `.g-app`, para a regra de impressao esconder a casca de uma vez.
 */
import { useRef, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import { invalidar, useRecurso } from '../app/dados.ts'
import {
  Assinatura,
  Barra,
  Campo,
  Chips,
  GradeDeCampos,
  LinhaDeCheck,
  TituloDeSecao,
  useAvisos,
} from '../geist/formulario.tsx'
import { Check, FileText, Icone, Information, Warning } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Esqueleto,
  Grade,
  Tabela,
  Td,
  Th,
  Vazio,
  classes,
} from '../geist/primitivos.tsx'
import type { Celula, Opcao } from '../geist/primitivos.tsx'
import { listarIntegracoes, obterCatalogoIntegracoes, salvarIntegracao } from '../js/integracoes-api.ts'
import type {
  CatalogoIntegracao,
  EntradaIntegracao,
  FuncaoIntegracao,
  IntegracaoSalva,
} from '../js/integracoes-api.ts'

type Programa = CatalogoIntegracao['programas'][number]
type Semana = Programa['semanas'][number]

type Marca = { readonly feito: boolean; readonly data: string | null }

/** A ficha na tela: um estado so, e nao dez campos soltos. */
type Ficha = {
  readonly registroId: string | null
  readonly funcao: FuncaoIntegracao
  readonly colaboradorId: string
  readonly nome: string
  readonly cargo: string
  readonly admissao: string
  readonly inicio: string
  readonly coord: string
  readonly gerente: string
  readonly rh: string
  /** Indexado pelo `codigo` da atividade, que e o que o historico devolve. */
  readonly progresso: Readonly<Record<string, Marca>>
}

const COORDENADOR_PADRAO = 'Raimundo Pontes Pereira'
const GERENTE_PADRAO = 'Lívia Maria de Castro Cutrim Lima'

const OPCOES_DE_FUNCAO: readonly Opcao<FuncaoIntegracao>[] = [
  { valor: 'motorista', rotulo: 'Motorista' },
  { valor: 'ajudante', rotulo: 'Ajudante' },
]

const ROTULO_DA_FUNCAO: Readonly<Record<FuncaoIntegracao, string>> = {
  motorista: 'Motorista',
  ajudante: 'Ajudante',
}

/** Quantas semanas cabem numa aba de Modulos, que e a largura de `g-trio`. */
const SEMANAS_POR_ABA = 3

/** O prazo do periodo de experiencia, em dias, contado a partir do inicio da integracao. */
const DIAS_DE_EXPERIENCIA = 45

const COLUNAS_DO_HISTORICO = ['Colaborador', 'Função', 'Início', 'Coordenador', 'Progresso']

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function diaMes(iso: string | null): string {
  if (iso === null || iso === '') return ''
  const [, mes, dia] = iso.split('-')
  return mes === undefined || dia === undefined ? '' : `${dia}/${mes}`
}

function dataBR(iso: string | null): string {
  if (iso === null || iso === '') return ''
  const [ano, mes, dia] = iso.split('-')
  return ano === undefined || mes === undefined || dia === undefined ? '' : `${dia}/${mes}/${ano}`
}

/** O dia 45 contado em UTC, para o fuso de Sao Luis nao devolver a vespera. */
function diaDaAvaliacao(inicio: string): string {
  const partida = Date.parse(`${inicio}T00:00:00Z`)
  if (Number.isNaN(partida)) return ''
  return diaMes(new Date(partida + DIAS_DE_EXPERIENCIA * 86_400_000).toISOString().slice(0, 10))
}

function fichaNova(funcao: FuncaoIntegracao): Ficha {
  const hoje = hojeISO()
  return {
    registroId: null,
    funcao,
    colaboradorId: '',
    nome: '',
    cargo: '',
    admissao: hoje,
    inicio: hoje,
    coord: COORDENADOR_PADRAO,
    gerente: GERENTE_PADRAO,
    rh: '',
    progresso: {},
  }
}

function fichaDe(registro: IntegracaoSalva): Ficha {
  return {
    registroId: registro.id,
    funcao: registro.funcao,
    colaboradorId: registro.colaboradorId ?? '',
    nome: registro.nome,
    cargo: registro.cargo ?? '',
    admissao: registro.admissao ?? '',
    inicio: registro.inicio ?? '',
    coord: registro.coord ?? '',
    gerente: registro.gerente ?? '',
    rh: registro.rh ?? '',
    progresso: Object.fromEntries(
      registro.atividades.map((atividade) => [atividade.codigo, { feito: atividade.feito, data: atividade.data }]),
    ),
  }
}

function feitasDe(semana: Semana, progresso: Ficha['progresso']): number {
  return semana.atividades.filter((atividade) => progresso[atividade.codigo]?.feito === true).length
}

function contarPrograma(programa: Programa, progresso: Ficha['progresso']): { readonly feitas: number; readonly total: number } {
  return {
    feitas: programa.semanas.reduce((soma, semana) => soma + feitasDe(semana, progresso), 0),
    total: programa.semanas.reduce((soma, semana) => soma + semana.atividades.length, 0),
  }
}

function percentual(feitas: number, total: number): number {
  return total === 0 ? 0 : Math.round((feitas / total) * 100)
}

function gruposDeSemanas(programa: Programa): readonly (readonly Semana[])[] {
  const grupos: Semana[][] = []
  for (let i = 0; i < programa.semanas.length; i += SEMANAS_POR_ABA) {
    grupos.push(programa.semanas.slice(i, i + SEMANAS_POR_ABA))
  }
  return grupos
}

function rotuloDaAba(grupo: readonly Semana[]): string {
  const primeira = grupo[0]?.numero ?? 0
  const ultima = grupo[grupo.length - 1]?.numero ?? primeira
  return primeira === ultima ? `Semana ${primeira}` : `Semanas ${primeira} a ${ultima}`
}

/** Espaco duro no lugar do vazio: a linha da assinatura tem que manter a altura. */
function ouVao(texto: string): string {
  return texto === '' ? '\u00A0' : texto
}

const VAZIO = <span className="g-fraco">·</span>

// ---------- pedacos da tela ----------

function CartaoDeSemana({ semana, progresso, aoMarcar }: {
  readonly semana: Semana
  readonly progresso: Ficha['progresso']
  readonly aoMarcar: (codigo: string, feito: boolean) => void
}): JSX.Element {
  const feitas = feitasDe(semana, progresso)
  const total = semana.atividades.length
  const completa = total > 0 && feitas === total
  return (
    <div>
      <div className="g-semana-topo">
        <span className="g-etapa-titulo g-l13 g-forte">{semana.titulo}</span>
        <span className="g-etapa-conta g-l12m">{feitas}/{total}</span>
      </div>
      <div className="g-semana-barra">
        <Barra pct={percentual(feitas, total)} tom={completa ? 'verde' : 'teal'} />
      </div>
      {semana.atividades.map((atividade) => {
        const marca = progresso[atividade.codigo]
        const data = marca?.data ?? null
        return (
          <LinhaDeCheck
            key={atividade.codigo}
            texto={atividade.titulo}
            feito={marca?.feito === true}
            // `exactOptionalPropertyTypes` recusa `undefined` escrito na prop: sem data, ela some.
            {...(data === null || data === '' ? {} : { data: diaMes(data) })}
            aoMudar={(feito) => aoMarcar(atividade.codigo, feito)}
          />
        )
      })}
    </div>
  )
}

function Progresso({ ficha, programa }: { readonly ficha: Ficha; readonly programa: Programa }): JSX.Element {
  const { feitas, total } = contarPrograma(programa, ficha.progresso)
  const avaliacao = diaDaAvaliacao(ficha.inicio)
  return (
    <>
      <div className="g-l13 g-fraco">Progresso das atividades</div>
      <div className="g-progresso-linha">
        <div className="g-h40 g-tab">{percentual(feitas, total)}%</div>
        <div className="g-progresso-conta g-l13 g-fraco">{feitas} de {total} atividades</div>
      </div>
      <div className="g-progresso-barra"><Barra pct={percentual(feitas, total)} /></div>
      {programa.semanas.map((semana) => {
        const cumpridas = feitasDe(semana, ficha.progresso)
        const quantas = semana.atividades.length
        return (
          <div className="g-etapa" key={semana.numero}>
            <span
              className={classes(
                'g-ponto',
                cumpridas === 0 ? 'g-ponto-neutro' : cumpridas === quantas ? 'g-ponto-ok' : 'g-ponto-atencao',
              )}
            />
            <span className="g-etapa-titulo g-l13">{semana.titulo}</span>
            <span className="g-etapa-conta g-l12m">{cumpridas}/{quantas}</span>
          </div>
        )
      })}
      <div className="g-destaque">
        <Icone de={Information} />
        <span className="g-l13">
          {avaliacao === ''
            ? 'Defina a data de início para saber o dia da avaliação formal.'
            : `Avaliação formal no dia 45: ${avaliacao}.`}
        </span>
      </div>
    </>
  )
}

/** Os quatro que assinam, na ordem do termo. A tela e a folha leem a mesma lista. */
function assinantesDe(ficha: Ficha): ReadonlyArray<{ readonly nome: string; readonly cargo: string }> {
  return [
    { nome: ficha.nome, cargo: `Colaborador (${ROTULO_DA_FUNCAO[ficha.funcao]})` },
    { nome: ficha.coord, cargo: 'Coordenação logística' },
    { nome: ficha.gerente, cargo: 'Gerência logística' },
    { nome: ficha.rh, cargo: 'Recursos humanos' },
  ]
}

function Assinaturas({ ficha }: { readonly ficha: Ficha }): JSX.Element {
  return (
    <div className="g-assinaturas">
      {assinantesDe(ficha).map((assinante) => (
        <Assinatura key={assinante.cargo} nome={ouVao(assinante.nome)} cargo={assinante.cargo} />
      ))}
    </div>
  )
}

function CampoDaFolha({ rotulo, valor }: { readonly rotulo: string; readonly valor: string }): JSX.Element {
  return (
    <div className="g-folha-campo">
      <div className="g-folha-rotulo">{rotulo}</div>
      <div className="g-folha-valor">{valor}</div>
    </div>
  )
}

/**
 * A folha que sai na impressora. Ela veste o mesmo vocabulario `g-folha-*` da folha da
 * ata, porque as duas sao o mesmo papel timbrado; o que muda e o miolo.
 */
function Folha({ ficha, programa }: { readonly ficha: Ficha; readonly programa: Programa }): JSX.Element {
  return (
    <div className="g-folha">
      <div className="g-folha-cabecalho">
        <div className="g-folha-empresa">EM Vidros Indústria e Comércio de Vidros Ltda</div>
        <div className="g-folha-doc">Programa de integração e período de experiência de 45 dias</div>
        <div className="g-folha-num">{programa.titulo}</div>
      </div>

      <div className="g-folha-linha">
        <CampoDaFolha rotulo="Colaborador" valor={ficha.nome} />
        <CampoDaFolha rotulo="Cargo" valor={ficha.cargo} />
      </div>
      <div className="g-folha-linha">
        <CampoDaFolha rotulo="Data de admissão" valor={dataBR(ficha.admissao)} />
        <CampoDaFolha rotulo="Início da integração" valor={dataBR(ficha.inicio)} />
      </div>
      <div className="g-folha-linha">
        <CampoDaFolha rotulo="Coordenador responsável" valor={ficha.coord} />
        <CampoDaFolha rotulo="Gerente de logística" valor={ficha.gerente} />
        <CampoDaFolha rotulo="Responsável RH" valor={ficha.rh} />
      </div>

      {programa.semanas.map((semana) => (
        <div className="g-folha-semana" key={semana.numero}>
          <div className="g-folha-topico-num">{semana.titulo}</div>
          {semana.atividades.map((atividade) => {
            const marca = ficha.progresso[atividade.codigo]
            const feito = marca?.feito === true
            return (
              <div className="g-folha-atividade" key={atividade.codigo}>
                <span className="g-folha-marca">{feito ? 'X' : ''}</span>
                <span className="g-folha-atividade-texto">
                  <b>{atividade.titulo}</b> {atividade.descricao}
                </span>
                <span className="g-folha-atividade-data">{feito ? dataBR(marca?.data ?? null) : ''}</span>
              </div>
            )
          })}
        </div>
      ))}

      <div className="g-folha-participantes">
        <div className="g-folha-titulo">Matriz de avaliação contínua</div>
        <table className="g-folha-matriz">
          <thead>
            <tr>
              <th>Critério</th>
              <th>Padrão esperado</th>
              <th>Frequência</th>
            </tr>
          </thead>
          <tbody>
            {programa.criterios.map((criterio) => (
              <tr key={criterio.criterio}>
                <td><b>{criterio.criterio}</b></td>
                <td>{criterio.padrao}</td>
                <td>{criterio.frequencia}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="g-folha-titulo g-folha-termo-titulo">Termo de ciente e assinaturas</div>
        <div className="g-folha-termo">
          Declaro que recebi o plano de integração para o período de experiência de 45 dias e estou ciente das
          atividades, treinamentos e responsabilidades descritas.
          <br />
          <br />
          Data: ______ / ______ / __________
        </div>
        <div className="g-folha-grade">
          {assinantesDe(ficha).map((assinante) => (
            <div className="g-folha-item" key={assinante.cargo}>
              <div className="g-folha-nome">{assinante.nome}</div>
              <div className="g-folha-assina">{assinante.cargo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- tela ----------

export default function Integracoes(): JSX.Element {
  const catalogo = useRecurso('integracoes-catalogo', obterCatalogoIntegracoes)
  const historico = useRecurso('integracoes', listarIntegracoes)
  const { avisar } = useAvisos()
  const [ficha, setFicha] = useState<Ficha>(() => fichaNova('motorista'))
  const [aba, setAba] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)

  // `invalidar('integracoes')` casa por prefixo e derruba tambem 'integracoes-catalogo'.
  // Sem guardar o ultimo catalogo, todo salvamento trocaria a ficha preenchida por um
  // esqueleto ate a segunda resposta chegar.
  const ultimoCatalogo = useRef<CatalogoIntegracao | null>(null)
  if (catalogo.dados !== null) ultimoCatalogo.current = catalogo.dados
  const dados = catalogo.dados ?? ultimoCatalogo.current

  if (dados === null) {
    if (catalogo.estado !== 'erro') return <Esqueleto />
    return (
      <>
        <CabecalhoDePagina titulo="Ficha de integração de 45 dias" subtitulo="Programa de integração da frota" acoes={null} />
        <Vazio
          icone={Warning}
          titulo="Não foi possível carregar o catálogo"
          texto="Os programas e os colaboradores não chegaram. Verifique a conexão e tente de novo."
          acao={<Botao rotulo="Tentar de novo" aoClicar={catalogo.recarregar} />}
        />
      </>
    )
  }

  const programa = dados.programas.find((item) => item.funcao === ficha.funcao)
  if (programa === undefined) {
    return (
      <>
        <CabecalhoDePagina
          titulo="Ficha de integração de 45 dias"
          subtitulo={ROTULO_DA_FUNCAO[ficha.funcao]}
          acoes={<Chips valor={ficha.funcao} opcoes={OPCOES_DE_FUNCAO} aoEscolher={trocarFuncao} />}
        />
        <Vazio
          icone={Warning}
          titulo="Programa não cadastrado"
          texto={`O programa de integração do ${ROTULO_DA_FUNCAO[ficha.funcao].toLowerCase()} ainda não existe no catálogo.`}
        />
      </>
    )
  }

  const colaboradores = dados.colaboradores.filter((pessoa) => pessoa.funcao === ficha.funcao)
  const grupos = gruposDeSemanas(programa)
  const grupo = grupos[aba] ?? grupos[0] ?? []
  const { total } = contarPrograma(programa, ficha.progresso)

  // Declaracao e nao arrow, ao contrario das tres abaixo: o ramo do programa ausente ja
  // usa esta funcao antes desta linha, e so a declaracao chega la em cima.
  function trocarFuncao(funcao: FuncaoIntegracao): void {
    setFicha((atual) => ({ ...atual, funcao, registroId: null, colaboradorId: '', nome: '', cargo: '', progresso: {} }))
    setErroDoNome(null)
    setAba(0)
  }

  const escolherColaborador = (id: string): void => {
    const pessoa = dados.colaboradores.find((candidato) => candidato.id === id)
    if (pessoa === undefined) {
      setFicha((atual) => ({ ...atual, colaboradorId: '' }))
      return
    }
    setFicha((atual) => ({
      ...atual,
      colaboradorId: pessoa.id,
      nome: pessoa.nome,
      cargo: pessoa.cargo ?? '',
      admissao: pessoa.admissao ?? '',
    }))
    setErroDoNome(null)
  }

  const marcar = (codigo: string, feito: boolean): void => {
    setFicha((atual) => {
      const antes = atual.progresso[codigo]
      return {
        ...atual,
        progresso: {
          ...atual.progresso,
          [codigo]: { feito, data: feito ? antes?.data ?? hojeISO() : antes?.data ?? null },
        },
      }
    })
  }

  const carregar = (registro: IntegracaoSalva): void => {
    setFicha(fichaDe(registro))
    setErroDoNome(null)
    setAba(0)
  }

  const salvar = async (): Promise<void> => {
    // O servidor exige nome com pelo menos um caractere; sem isto a pessoa levaria um 400 cru.
    if (ficha.nome.trim() === '') {
      setErroDoNome('Informe o nome do colaborador')
      avisar('Informe o nome do colaborador', 'erro')
      return
    }
    setErroDoNome(null)
    setSalvando(true)
    const corpo: EntradaIntegracao = {
      colaboradorId: ficha.colaboradorId === '' ? null : ficha.colaboradorId,
      nome: ficha.nome.trim(),
      cargo: ficha.cargo === '' ? null : ficha.cargo,
      admissao: ficha.admissao === '' ? null : ficha.admissao,
      programaId: programa.id,
      inicio: ficha.inicio === '' ? null : ficha.inicio,
      coord: ficha.coord === '' ? null : ficha.coord,
      gerente: ficha.gerente === '' ? null : ficha.gerente,
      rh: ficha.rh === '' ? null : ficha.rh,
      atividades: programa.semanas.flatMap((semana) =>
        semana.atividades.map((atividade) => ({
          atividadeId: atividade.id,
          feito: ficha.progresso[atividade.codigo]?.feito ?? false,
          data: ficha.progresso[atividade.codigo]?.data ?? null,
        })),
      ),
    }
    try {
      const salva = await salvarIntegracao(ficha.registroId, corpo)
      setFicha((atual) => ({ ...atual, registroId: salva.id }))
      invalidar('integracoes')
      avisar('Progresso salvo')
    } catch (falha) {
      avisar(falha instanceof Error ? falha.message : 'Não foi possível salvar o progresso', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const salvas = [...(historico.dados ?? [])].sort((a, b) => b.salvoEm.localeCompare(a.salvoEm))

  const celulas: readonly Celula[] = [
    {
      col: [1, 9],
      linha: 1,
      conteudo: (
        <>
          <TituloDeSecao
            titulo="Dados do colaborador"
            subtitulo="EM Vidros Indústria e Comércio de Vidros Ltda"
            direita={<Chips valor={ficha.funcao} opcoes={OPCOES_DE_FUNCAO} aoEscolher={trocarFuncao} />}
          />
          <GradeDeCampos>
            <Campo
              tipo="select"
              rotulo="Colaborador"
              span={4}
              dica="Escolher ou preencher à mão"
              valor={ficha.colaboradorId}
              opcoes={colaboradores.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome }))}
              aoMudar={escolherColaborador}
            />
            <Campo
              rotulo="Nome completo"
              span={5}
              obrigatorio
              dica="Nome do colaborador"
              valor={ficha.nome}
              {...(erroDoNome === null ? {} : { erro: erroDoNome })}
              aoMudar={(nome) => {
                setFicha((atual) => ({ ...atual, nome }))
                setErroDoNome(null)
              }}
            />
            <Campo rotulo="Cargo" span={3} valor={ficha.cargo} aoMudar={(cargo) => setFicha((atual) => ({ ...atual, cargo }))} />
            <Campo tipo="data" rotulo="Data de admissão" span={3} valor={ficha.admissao} aoMudar={(admissao) => setFicha((atual) => ({ ...atual, admissao }))} />
            <Campo tipo="data" rotulo="Início da integração" span={3} valor={ficha.inicio} aoMudar={(inicio) => setFicha((atual) => ({ ...atual, inicio }))} />
            <Campo rotulo="Responsável RH" span={6} valor={ficha.rh} aoMudar={(rh) => setFicha((atual) => ({ ...atual, rh }))} />
            <Campo rotulo="Coordenador responsável" span={6} valor={ficha.coord} aoMudar={(coord) => setFicha((atual) => ({ ...atual, coord }))} />
            <Campo rotulo="Gerente de logística" span={6} valor={ficha.gerente} aoMudar={(gerente) => setFicha((atual) => ({ ...atual, gerente }))} />
          </GradeDeCampos>
        </>
      ),
    },
    { col: [9, 13], linha: 1, conteudo: <Progresso ficha={ficha} programa={programa} /> },
    {
      col: [1, 13],
      linha: 2,
      conteudo: (
        <>
          <TituloDeSecao
            titulo="Módulos"
            subtitulo={`${programa.semanas.length} semanas, ${total} atividades. Marcar grava a data no mesmo clique.`}
            direita={<Abas itens={grupos.map(rotuloDaAba)} ativa={aba} aoTrocar={setAba} />}
          />
          <div className="g-trio">
            {grupo.map((semana) => (
              <CartaoDeSemana key={semana.numero} semana={semana} progresso={ficha.progresso} aoMarcar={marcar} />
            ))}
          </div>
        </>
      ),
    },
    {
      col: [1, 13],
      linha: 3,
      rente: true,
      conteudo: (
        <>
          <CabecalhoDeBloco
            titulo="Matriz de avaliação contínua"
            subtitulo={`Critérios fixos do programa do ${ROTULO_DA_FUNCAO[ficha.funcao].toLowerCase()}`}
            rente
          />
          <Tabela cabecalho={<><Th>Critério</Th><Th>Frequência</Th><Th>Padrão esperado</Th></>}>
            {programa.criterios.map((criterio) => (
              <tr key={criterio.criterio}>
                <Td><span className="g-forte">{criterio.criterio}</span></Td>
                <Td><Badge rotulo={criterio.frequencia} cor="cinza" comIcone={false} /></Td>
                <Td><span className="g-quebra-linha g-fraco">{criterio.padrao}</span></Td>
              </tr>
            ))}
          </Tabela>
        </>
      ),
    },
    {
      col: [1, 13],
      linha: 4,
      conteudo: (
        <>
          <TituloDeSecao
            titulo="Termo de ciente e assinaturas"
            subtitulo="Impresso ao fim dos 45 dias, junto com a avaliação formal"
          />
          <Assinaturas ficha={ficha} />
        </>
      ),
    },
    {
      col: [1, 13],
      linha: 5,
      rente: true,
      conteudo: (
        <>
          <CabecalhoDeBloco titulo="Histórico de integrações" subtitulo="Fichas salvas, da mais recente para a mais antiga" rente />
          <Tabela
            cabecalho={
              <>
                {COLUNAS_DO_HISTORICO.map((coluna) => <Th key={coluna} direita={coluna === 'Progresso'}>{coluna}</Th>)}
                <Th>{null}</Th>
              </>
            }
          >
            {historico.estado === 'carregando'
              ? <tr><Td colunas={6} vazio>Carregando</Td></tr>
              : salvas.length === 0
                ? <tr><Td colunas={6} vazio>Nenhuma ficha salva ainda</Td></tr>
                : salvas.map((registro) => {
                  const feitas = registro.atividades.filter((atividade) => atividade.feito).length
                  const quantas = registro.atividades.length
                  return (
                    <tr key={registro.id}>
                      <Td><span className="g-forte">{registro.nome === '' ? VAZIO : registro.nome}</span></Td>
                      <Td>{ROTULO_DA_FUNCAO[registro.funcao]}</Td>
                      <Td><span className="g-l13m g-fraco">{dataBR(registro.inicio) === '' ? VAZIO : dataBR(registro.inicio)}</span></Td>
                      <Td>{registro.coord === null || registro.coord === '' ? VAZIO : registro.coord}</Td>
                      <Td direita>
                        <span className="g-tab">{percentual(feitas, quantas)}% ({feitas}/{quantas})</span>
                      </Td>
                      <Td direita><Botao rotulo="Carregar" aoClicar={() => carregar(registro)} /></Td>
                    </tr>
                  )
                })}
          </Tabela>
        </>
      ),
    },
  ]

  return (
    <>
      <CabecalhoDePagina
        titulo="Ficha de integração de 45 dias"
        subtitulo={`${programa.titulo} · ${ficha.nome === '' ? 'sem colaborador escolhido' : ficha.nome}`}
        acoes={
          <>
            <Botao rotulo="Imprimir" antes={FileText} aoClicar={() => window.print()} />
            <Botao
              rotulo="Salvar progresso"
              tipo="primario"
              antes={Check}
              carregando={salvando}
              aoClicar={() => void salvar()}
            />
          </>
        }
      />
      <Grade celulas={celulas} />
      {createPortal(<Folha ficha={ficha} programa={programa} />, document.body)}
    </>
  )
}
