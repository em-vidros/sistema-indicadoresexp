/**
 * Atividades: quem lancou, alterou ou apagou o que, e quando. Nas alteracoes, cada campo que
 * mudou com o valor antes e depois ("Km de chegada: 163.500 → 154.559").
 *
 * So aparece para quem administra o sistema; o servidor confere a mesma capacidade a cada
 * pedido, e a tela recusa a si mesma enquanto a sessao nao chega. O registro comeca no dia
 * em que a tabela foi criada: o que foi feito antes nao tem como ser recuperado.
 *
 * A lista pagina por deslocamento ("Carregar mais" acrescenta as proximas), e trocar um
 * filtro recomeca da primeira pagina.
 */
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useSessao } from '../app/dados.ts'
import { OPCOES_DE_BASE } from '../dashboard/filtros.ts'
import { ClockRewind } from '../geist/icones.tsx'
import {
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Esqueleto,
  Grade,
  Seletor,
  Tabela,
  Td,
  Th,
  Vazio,
} from '../geist/primitivos.tsx'
import type { CorDeBadge, Opcao } from '../geist/primitivos.tsx'
import { listarAtividades } from '../js/atividades-api.ts'
import type { AcaoDeAtividade, Atividade, TipoDeAtividade } from '../js/atividades-api.ts'

const ROTULO_DA_ACAO: Readonly<Record<AcaoDeAtividade, string>> = {
  criou: 'Lançou',
  alterou: 'Alterou',
  apagou: 'Apagou',
}

const COR_DA_ACAO: Readonly<Record<AcaoDeAtividade, CorDeBadge>> = {
  criou: 'verde',
  alterou: 'ambar',
  apagou: 'vermelho',
}

const ROTULO_DO_TIPO: Readonly<Record<TipoDeAtividade, string>> = {
  viagem: 'Viagem',
  abastecimento: 'Abastecimento',
  manutencao: 'Manutenção',
  quebra: 'Quebra',
  km_atual: 'Km atual',
}

const TODOS = 'todos'

const OPCOES_DE_TIPO: readonly Opcao<string>[] = [
  { valor: TODOS, rotulo: 'Todos' },
  ...(Object.keys(ROTULO_DO_TIPO) as TipoDeAtividade[]).map((tipo) => ({
    valor: tipo,
    rotulo: ROTULO_DO_TIPO[tipo],
  })),
]

const COLUNAS = ['Quando', 'Quem', 'Ação', 'O quê', 'Detalhes']

function quandoDe(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function Linha({ atividade }: { readonly atividade: Atividade }): JSX.Element {
  return (
    <tr>
      <Td><span className="g-l13m g-fraco">{quandoDe(atividade.quando)}</span></Td>
      <Td><span className="g-forte">{atividade.usuario}</span></Td>
      <Td><Badge rotulo={ROTULO_DA_ACAO[atividade.acao]} cor={COR_DA_ACAO[atividade.acao]} /></Td>
      <Td>
        {atividade.resumo}
        {atividade.base === null ? null : <span className="g-fraco"> · {atividade.base}</span>}
      </Td>
      <Td>
        {atividade.mudancas.length === 0
          ? <span className="g-fraco">·</span>
          : atividade.mudancas.map((mudanca) => (
            <div key={mudanca.campo} className="g-l13">
              <span className="g-forte">{mudanca.campo}:</span> {mudanca.antes} → {mudanca.depois}
            </div>
          ))}
      </Td>
    </tr>
  )
}

export default function Atividades(): JSX.Element {
  const sessao = useSessao()
  const [base, setBase] = useState('todas')
  const [tipo, setTipo] = useState(TODOS)
  const [lista, setLista] = useState<readonly Atividade[]>([])
  const [temMais, setTemMais] = useState(false)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando')
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState('')
  /** Sobe a cada "Tentar de novo": refaz a busca mesmo com os filtros iguais. */
  const [tentativa, setTentativa] = useState(0)

  const permitido = sessao.dados?.capacidades.gerenciaUsuarios === true

  // Trocar um filtro recomeca da primeira pagina.
  useEffect(() => {
    if (!permitido) return
    let atual = true
    setEstado('carregando')
    void listarAtividades({
      base: base === 'todas' ? undefined : base,
      tipo: tipo === TODOS ? undefined : (tipo as TipoDeAtividade),
    }).then(
      (pagina) => {
        if (!atual) return
        setLista(pagina.atividades)
        setTemMais(pagina.temMais)
        setEstado('ok')
      },
      (falha: unknown) => {
        if (!atual) return
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.')
        setEstado('erro')
      },
    )
    return () => {
      atual = false
    }
  }, [permitido, base, tipo, tentativa])

  function carregarMais(): void {
    setCarregandoMais(true)
    void listarAtividades({
      base: base === 'todas' ? undefined : base,
      tipo: tipo === TODOS ? undefined : (tipo as TipoDeAtividade),
      deslocamento: lista.length,
    }).then(
      (pagina) => {
        setLista((anterior) => [...anterior, ...pagina.atividades])
        setTemMais(pagina.temMais)
        setCarregandoMais(false)
      },
      (falha: unknown) => {
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar mais.')
        setEstado('erro')
        setCarregandoMais(false)
      },
    )
  }

  if (sessao.dados === null) return <Esqueleto />
  if (!permitido) {
    return (
      <Vazio
        icone={ClockRewind}
        titulo="Sem acesso"
        texto="O registro de atividades é só para quem administra o sistema."
      />
    )
  }

  const corpo = estado === 'erro'
    ? (
      <Vazio
        icone={ClockRewind}
        titulo="As atividades não carregaram"
        texto={erro}
        acao={<Botao rotulo="Tentar de novo" aoClicar={() => setTentativa((n) => n + 1)} />}
      />
    )
    : (
      <>
        <CabecalhoDeBloco
          titulo="Registro de atividades"
          subtitulo={estado === 'carregando' && lista.length === 0
            ? 'Carregando…'
            : `${lista.length} ${lista.length === 1 ? 'atividade' : 'atividades'}${temMais ? ' mostradas · há mais antigas' : ''}`}
        />
        <Tabela cabecalho={COLUNAS.map((coluna) => <Th key={coluna}>{coluna}</Th>)}>
          {lista.length === 0
            ? (
              <tr>
                <Td colunas={COLUNAS.length} vazio>
                  {estado === 'carregando'
                    ? 'Carregando…'
                    : 'Nenhuma atividade registrada ainda. O registro começa a partir de agora.'}
                </Td>
              </tr>
            )
            : lista.map((atividade) => <Linha key={atividade.id} atividade={atividade} />)}
        </Tabela>
        {temMais
          ? (
            <div className="g-paginacao">
              <span />
              <div className="g-paginacao-botoes">
                <Botao rotulo="Carregar mais" carregando={carregandoMais} aoClicar={carregarMais} />
              </div>
            </div>
          )
          : null}
      </>
    )

  return (
    <>
      <CabecalhoDePagina
        titulo="Atividades"
        subtitulo="Quem lançou, alterou ou apagou o quê, e quando"
        acoes={
          <>
            <Seletor rotulo="Base" valor={base} opcoes={OPCOES_DE_BASE} aoEscolher={setBase} />
            <Seletor rotulo="Tipo" valor={tipo} opcoes={OPCOES_DE_TIPO} aoEscolher={setTipo} />
          </>
        }
      />
      <Grade celulas={[{ col: [1, 13], linha: 1, rente: true, conteudo: corpo }]} />
    </>
  )
}
