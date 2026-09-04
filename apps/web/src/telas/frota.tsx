/**
 * Frota, a quarta e ultima tela do painel, e a unica das quatro que nao tem artboard.
 * `var/design-dashboard/build.mjs` desenhou `Main`, `Viagens` e `Rotas`, e parou ali.
 *
 * A analogia e com `Rotas`, e ela e literal: mesmo cabecalho de pagina com o seletor de
 * periodo a direita, mesma primeira linha de tres estatisticas em celulas 1/5, 5/9 e
 * 9/13, e as tabelas em celulas de 12 colunas com recuo zero e cabecalho proprio, como o
 * `blockHead` mais `table` do artboard de Rotas. A unica coisa que Rotas tem e esta nao
 * tem e uma segunda tabela; ela entra como mais uma linha da mesma grade.
 *
 * O conteudo e o das duas tabelas que a tela velha carregava no fim da Visao geral,
 * manutencoes e abastecimentos, com as mesmas colunas e a mesma ordem de colunas. O que
 * mudou foi o material: `<code>` com fundo virou a classe mono do sistema, e o dinheiro
 * passou por `brl`, que e o que as outras tres telas escrevem.
 *
 * Nao ha "Exportar" aqui, e a ausencia e escolhida. Rotas e Viagens exportam uma tabela
 * cada, e o botao nao precisa dizer qual; nesta tela sao duas, e um botao so teria que
 * escolher em silencio ou baixar dois arquivos de um clique. Quando alguem pedir o CSV da
 * frota, ele nasce com dois botoes, um por bloco.
 */
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegistros } from '../dashboard/carregar.ts'
import { brl, calcularKPIs, diaMes, filtrarDados } from '../dashboard/dominio.ts'
import type { Item } from '../dashboard/dominio.ts'
import {
  BASES,
  OPCOES_DE_BASE,
  OPCOES_DE_PERIODO,
  PERIODOS,
  consultaDe,
  lerFiltros,
} from '../dashboard/filtros.ts'
import type { Filtros } from '../dashboard/filtros.ts'
import { Casca, ativaDe } from '../geist/casca.tsx'
import {
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Estatistica,
  Grade,
  Seletor,
  Tabela,
  Td,
  Th,
} from '../geist/primitivos.tsx'
import type { Celula } from '../geist/primitivos.tsx'

type Manutencao = Extract<Item, { tipo: 'manutencao' }>
type Abastecimento = Extract<Item, { tipo: 'abastecimento' }>

const COLUNAS_DE_MANUTENCAO = ['Data', 'Placa', 'Base', 'Serviço', 'Valor', 'Fornecedor']
const COLUNAS_DE_ABASTECIMENTO = ['Data', 'Placa', 'Base', 'Litros', 'R$ / L', 'Total', 'Km']

function litrosDe(litros: number): string {
  return `${litros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`
}

/** Tres casas, porque o preco do litro anda no terceiro decimal e `brl` arredondaria. */
function porLitro(valor: number): string {
  return valor <= 0 ? '—' : `R$ ${valor.toFixed(3).replace('.', ',')}`
}

/** Quantas placas diferentes aparecem, ignorando o registro que veio sem placa. */
function veiculosDe(registros: ReadonlyArray<{ readonly placa: string }>): number {
  return new Set(registros.map((r) => r.placa).filter((placa) => placa !== '')).size
}

/** A mais recente em cima, comparando o texto `AAAA-MM-DD`, que ja ordena sozinho. */
function maisRecente<T extends { readonly data: string; readonly quando: string }>(registros: readonly T[]): T[] {
  return [...registros].sort((a, b) => (b.data || b.quando).localeCompare(a.data || a.quando))
}

function Manutencoes({ manuts }: { readonly manuts: readonly Manutencao[] }): JSX.Element {
  return (
    <>
      <CabecalhoDeBloco titulo="Manutenções" subtitulo="Serviços do período, do mais recente para o mais antigo" />
      <Tabela
        cabecalho={COLUNAS_DE_MANUTENCAO.map((coluna) => (
          <Th key={coluna} direita={coluna === 'Valor'}>{coluna}</Th>
        ))}
      >
        {manuts.length === 0
          ? <tr><Td colunas={COLUNAS_DE_MANUTENCAO.length} vazio>Sem manutenções no período</Td></tr>
          : maisRecente(manuts).map((manut, i) => (
            <tr key={i}>
              <Td><span className="g-l13m g-fraco">{diaMes(manut.data || manut.quando)}</span></Td>
              <Td><span className="g-l13m">{manut.placa || '—'}</span></Td>
              <Td>{manut.base || '—'}</Td>
              <Td><span className="g-forte">{manut.servico || '—'}</span></Td>
              <Td direita>{brl(manut.valor)}</Td>
              <Td>{manut.fornecedor || '—'}</Td>
            </tr>
          ))}
      </Tabela>
    </>
  )
}

function Abastecimentos({ abasts }: { readonly abasts: readonly Abastecimento[] }): JSX.Element {
  return (
    <>
      <CabecalhoDeBloco titulo="Abastecimentos" subtitulo="Litros, preço e quilometragem de cada parada" />
      <Tabela
        cabecalho={COLUNAS_DE_ABASTECIMENTO.map((coluna, i) => (
          <Th key={coluna} direita={i >= 3}>{coluna}</Th>
        ))}
      >
        {abasts.length === 0
          ? <tr><Td colunas={COLUNAS_DE_ABASTECIMENTO.length} vazio>Sem abastecimentos no período</Td></tr>
          : maisRecente(abasts).map((abast, i) => (
            <tr key={i}>
              <Td><span className="g-l13m g-fraco">{diaMes(abast.data || abast.quando)}</span></Td>
              <Td><span className="g-l13m">{abast.placa || '—'}</span></Td>
              <Td>{abast.base || '—'}</Td>
              <Td direita>{litrosDe(abast.litros)}</Td>
              <Td direita>{porLitro(abast.vlLitro)}</Td>
              <Td direita>{brl(abast.valorTotal)}</Td>
              <Td direita>{abast.km === 0 ? '—' : abast.km.toLocaleString('pt-BR')}</Td>
            </tr>
          ))}
      </Tabela>
    </>
  )
}

function celulasDe(manuts: readonly Manutencao[], abasts: readonly Abastecimento[]): readonly Celula[] {
  const totalManut = manuts.reduce((soma, m) => soma + m.valor, 0)
  const totalAbast = abasts.reduce((soma, a) => soma + a.valorTotal, 0)
  const litros = abasts.reduce((soma, a) => soma + a.litros, 0)
  const emManutencao = veiculosDe(manuts)
  return [
    {
      col: [1, 5],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Manutenções"
          valor={String(manuts.length)}
          apoio={`${brl(totalManut)} em ${emManutencao} ${emManutencao === 1 ? 'veículo' : 'veículos'}`}
        />
      ),
    },
    {
      col: [5, 9],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Abastecimentos"
          valor={String(abasts.length)}
          apoio={`${litrosDe(litros)} · ${brl(totalAbast)}`}
        />
      ),
    },
    {
      col: [9, 13],
      linha: 1,
      conteudo: (
        <Estatistica
          rotulo="Custo total"
          valor={brl(totalManut + totalAbast)}
          apoio="manutenção e abastecimento no período"
        />
      ),
    },
    { col: [1, 13], linha: 2, rente: true, conteudo: <Manutencoes manuts={manuts} /> },
    { col: [1, 13], linha: 3, rente: true, conteudo: <Abastecimentos abasts={abasts} /> },
  ]
}

function Frota(): JSX.Element {
  const filtros = lerFiltros(window.location.search)
  const consulta = consultaDe(filtros)
  const { itens } = useRegistros()

  const kpis = calcularKPIs(filtrarDados(itens, filtros.base, filtros.periodo))
  const veiculos = veiculosDe([...kpis.manuts, ...kpis.abasts])

  const irPara = (novos: Filtros): void => {
    window.location.search = consultaDe(novos)
  }

  return (
    <Casca
      ativa={ativaDe(window.location.pathname)}
      consulta={consulta}
      base={{
        valor: filtros.base,
        rotulo: BASES[filtros.base].naCasca,
        opcoes: OPCOES_DE_BASE,
        aoEscolher: (base) => irPara({ ...filtros, base }),
      }}
      selos={{ viagens: String(kpis.viagens.length) }}
    >
      <CabecalhoDePagina
        titulo="Frota"
        subtitulo={`${veiculos} ${veiculos === 1 ? 'veículo' : 'veículos'} · ${PERIODOS[filtros.periodo].rotulo} · ${BASES[filtros.base].naCasca}`}
        acoes={
          <Seletor
            rotulo="Período"
            valor={filtros.periodo}
            opcoes={OPCOES_DE_PERIODO}
            aoEscolher={(periodo) => irPara({ ...filtros, periodo })}
          />
        }
      />
      <Grade celulas={celulasDe(kpis.manuts, kpis.abasts)} />
    </Casca>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<Frota />)
