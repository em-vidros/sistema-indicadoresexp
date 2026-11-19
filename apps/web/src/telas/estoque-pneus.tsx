/**
 * A aba Estoque da tela de pneus: os pneus guardados no almoxarifado, por quantidade.
 *
 * Cada linha e uma medida (e marca) com o saldo em quatro condicoes: nao recapado (novo) e
 * recapado 1x, 2x e 3x. O saldo nao se digita: muda por movimentacao (entrada, saida ou
 * ajuste de inventario), que grava quem fez, quando e por que. O servidor recusa saida maior
 * que o saldo e confere a base, e a tela so mostra o que ele responde.
 *
 * E independente do controle por veiculo, que cuida do pneu ja montado.
 */
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useRecurso } from '../app/dados.ts'
import {
  ROTULO_DO_TIPO_DE_PNEU,
  TIPOS_DE_PNEU,
  agruparEstoque,
  medidasDoEstoque,
  rotuloDoTipoDePneu,
  totaisDoEstoque,
} from '../dashboard/estoque-pneus.ts'
import { erroDeNumero, lerNumero } from '../dashboard/digitado.ts'
import { Campo, Chips, Dialogo, GradeDeCampos, useAvisos } from '../geist/formulario.tsx'
import { Plus, SettingsGear } from '../geist/icones.tsx'
import {
  Badge,
  Botao,
  CabecalhoDeBloco,
  Estatistica,
  Grade,
  Tabela,
  Td,
  Th,
  Vazio,
} from '../geist/primitivos.tsx'
import type { Opcao } from '../geist/primitivos.tsx'
import { obterCadastro } from '../js/cadastro-api.ts'
import {
  listarEstoque,
  listarMovimentos,
  registrarMovimento,
} from '../js/estoque-pneu-api.ts'
import type { LinhaDeEstoque, MovimentoListado, TipoDeMovimento } from '../js/estoque-pneu-api.ts'

// Os motivos e os rotulos espelham `estoque-pneu-regras.ts`, que e quem valida no servidor.
const MOTIVOS: Readonly<Record<TipoDeMovimento, readonly string[]>> = {
  entrada: ['compra', 'retorno_recapadora', 'retirado_veiculo', 'outro'],
  saida: ['instalado_veiculo', 'enviado_recapadora', 'sucata', 'outro'],
  ajuste: ['inventario'],
}

const ROTULO_DO_MOTIVO: Readonly<Record<string, string>> = {
  compra: 'Compra',
  retorno_recapadora: 'Voltou da recapadora',
  retirado_veiculo: 'Retirado de veículo',
  instalado_veiculo: 'Instalado em veículo',
  enviado_recapadora: 'Enviado à recapadora',
  sucata: 'Sucata',
  inventario: 'Inventário (contagem)',
  outro: 'Outro',
}

const OPCOES_DE_TIPO: readonly Opcao<TipoDeMovimento>[] = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'saida', rotulo: 'Saída' },
  { valor: 'ajuste', rotulo: 'Ajuste (inventário)' },
]

const OPCOES_DE_CONDICAO: readonly Opcao[] = [
  { valor: '0', rotulo: 'Não recapado' },
  { valor: '1', rotulo: 'Recapado 1×' },
  { valor: '2', rotulo: 'Recapado 2×' },
  { valor: '3', rotulo: 'Recapado 3×' },
]

const POR_PAGINA_DO_HISTORICO = 30

/** A escolha explicita de "sem tipo" no formulario; vai ao servidor como texto vazio. */
const SEM_TIPO = '__sem_tipo'

function rotuloDaCondicao(recapagens: number): string {
  return recapagens === 0 ? 'Não recapado' : `Recapado ${recapagens}×`
}

function motivosDe(tipo: TipoDeMovimento): readonly Opcao[] {
  return MOTIVOS[tipo].map((valor) => ({ valor, rotulo: ROTULO_DO_MOTIVO[valor] ?? valor }))
}

type Rascunho = {
  readonly tipo: TipoDeMovimento
  readonly medida: string
  readonly marca: string
  /** `direcional`, `tracao`, `misto`, ou vazio (nao escolhido, ou a linha antiga sem tipo). */
  readonly tipoPneu: string
  readonly condicao: string
  readonly quantidade: string
  readonly motivo: string
  readonly placa: string
  readonly observacao: string
}

function rascunhoNovo(
  inicial?: { readonly medida: string; readonly marca: string; readonly tipoPneu: string },
): Rascunho {
  return {
    tipo: 'entrada',
    medida: inicial?.medida ?? '',
    marca: inicial?.marca ?? '',
    // Da linha antiga sem tipo (vazio no banco) vem a escolha explicita; linha nova comeca sem nada.
    tipoPneu: inicial === undefined ? '' : inicial.tipoPneu === '' ? SEM_TIPO : inicial.tipoPneu,
    condicao: '0',
    quantidade: '',
    motivo: 'compra',
    placa: '',
    observacao: '',
  }
}

function quandoDe(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function textoDoMovimento(m: MovimentoListado): string {
  if (m.tipo === 'ajuste') return `Contagem: ${m.saldoDepois} (${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)})`
  return `${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)}`
}

function DialogoDeMovimento({ base, medidas, placas, temSemTipo, inicial, aoFechar, aoSalvar }: {
  readonly base: string
  readonly medidas: readonly string[]
  readonly placas: readonly Opcao[]
  /** Ha saldo lancado antes do tipo existir: a linha "Sem tipo" aparece como escolha. */
  readonly temSemTipo: boolean
  readonly inicial: Rascunho
  readonly aoFechar: () => void
  readonly aoSalvar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [rascunho, setRascunho] = useState(inicial)
  const [salvando, setSalvando] = useState(false)

  const mudar = (parcial: Partial<Rascunho>): void => setRascunho((atual) => ({ ...atual, ...parcial }))
  const ajuste = rascunho.tipo === 'ajuste'
  const pedePlaca = rascunho.motivo === 'instalado_veiculo' || rascunho.motivo === 'retirado_veiculo'

  function trocarTipo(tipo: TipoDeMovimento): void {
    mudar({ tipo, motivo: MOTIVOS[tipo][0] ?? 'outro', placa: '' })
  }

  function salvar(): void {
    const medida = rascunho.medida.trim()
    if (medida === '') {
      avisar('Informe a medida do pneu.', 'erro')
      return
    }
    // Nada escolhido, ou "sem tipo" numa entrada: o "sem tipo" so serve para dar saida e
    // ajustar o estoque antigo.
    if (rascunho.tipoPneu === '' || (rascunho.tipoPneu === SEM_TIPO && rascunho.tipo === 'entrada')) {
      avisar('Informe o tipo do pneu: direcional, tração ou misto.', 'erro')
      return
    }
    const malFormado = erroDeNumero([[ajuste ? 'Quantidade contada' : 'Quantidade', rascunho.quantidade]])
    if (malFormado !== null) {
      avisar(malFormado, 'erro')
      return
    }
    if (rascunho.quantidade.trim() === '') {
      avisar(ajuste ? 'Informe a quantidade contada.' : 'Informe a quantidade.', 'erro')
      return
    }
    setSalvando(true)
    void registrarMovimento({
      base,
      medida,
      marca: rascunho.marca.trim(),
      tipoPneu: rascunho.tipoPneu === SEM_TIPO ? '' : rascunho.tipoPneu,
      recapagens: Number(rascunho.condicao),
      tipo: rascunho.tipo,
      quantidade: Math.trunc(lerNumero(rascunho.quantidade)),
      motivo: rascunho.motivo,
      placa: pedePlaca && rascunho.placa !== '' ? rascunho.placa : null,
      observacao: rascunho.observacao.trim() === '' ? null : rascunho.observacao.trim(),
    }).then(
      (linha) => {
        setSalvando(false)
        avisar(`${linha.medida} · ${rotuloDaCondicao(linha.recapagens)}: saldo agora ${linha.quantidade}.`)
        aoSalvar()
      },
      (falha: unknown) => {
        setSalvando(false)
        avisar(falha instanceof Error ? falha.message : 'Não foi possível registrar.', 'erro')
      },
    )
  }

  return (
    <Dialogo
      aberto
      titulo="Movimentar estoque"
      subtitulo={`Base ${base}`}
      largura={640}
      aoFechar={aoFechar}
      acoes={
        <>
          <Botao tipo="terciario" rotulo="Cancelar" aoClicar={aoFechar} />
          <Botao tipo="primario" rotulo="Registrar" carregando={salvando} aoClicar={salvar} />
        </>
      }
    >
      <div className="g-secao">
        <Chips valor={rascunho.tipo} opcoes={OPCOES_DE_TIPO} aoEscolher={trocarTipo} />
      </div>
      <GradeDeCampos>
        <Campo
          rotulo="Medida"
          obrigatorio
          span={6}
          mono
          dica="Ex.: 295/80 R22.5"
          valor={rascunho.medida}
          aoMudar={(medida) => mudar({ medida })}
        />
        <Campo rotulo="Marca" span={6} dica="Opcional" valor={rascunho.marca} aoMudar={(marca) => mudar({ marca })} />
        {medidas.length === 0
          ? null
          : (
            <div className="g-secao [grid-column:1/-1]">
              <Chips
                valor={rascunho.medida.trim().toUpperCase()}
                opcoes={medidas.map((medida) => ({ valor: medida, rotulo: medida }))}
                aoEscolher={(medida) => mudar({ medida })}
              />
            </div>
          )}
        <Campo
          tipo="select"
          rotulo="Tipo do pneu"
          obrigatorio
          span={6}
          dica="Selecione o tipo"
          opcoes={[
            ...TIPOS_DE_PNEU.map((valor) => ({ valor, rotulo: ROTULO_DO_TIPO_DE_PNEU[valor] ?? valor })),
            ...(temSemTipo ? [{ valor: SEM_TIPO, rotulo: 'Sem tipo (estoque antigo)' }] : []),
          ]}
          valor={rascunho.tipoPneu}
          aoMudar={(tipoPneu) => mudar({ tipoPneu })}
        />
        <Campo
          tipo="select"
          rotulo="Condição"
          obrigatorio
          span={6}
          opcoes={OPCOES_DE_CONDICAO}
          valor={rascunho.condicao}
          aoMudar={(condicao) => mudar({ condicao })}
        />
        <Campo
          tipo="numero"
          rotulo={ajuste ? 'Quantidade contada' : 'Quantidade'}
          obrigatorio
          span={6}
          mono
          {...(ajuste ? { dica: 'O saldo passa a ser este número' } : {})}
          valor={rascunho.quantidade}
          aoMudar={(quantidade) => mudar({ quantidade })}
        />
        <Campo
          tipo="select"
          rotulo="Motivo"
          obrigatorio
          span={pedePlaca ? 6 : 12}
          opcoes={motivosDe(rascunho.tipo)}
          valor={rascunho.motivo}
          aoMudar={(motivo) => mudar({ motivo, placa: '' })}
        />
        {pedePlaca
          ? (
            <Campo
              tipo="select"
              rotulo="Veículo / placa"
              obrigatorio={rascunho.motivo === 'instalado_veiculo'}
              span={6}
              dica="Selecione o veículo"
              opcoes={placas}
              valor={rascunho.placa}
              aoMudar={(placa) => mudar({ placa })}
            />
          )
          : null}
        <Campo
          rotulo="Observação"
          span={12}
          dica="Opcional: nota fiscal, recapadora, número de fogo…"
          valor={rascunho.observacao}
          aoMudar={(observacao) => mudar({ observacao })}
        />
      </GradeDeCampos>
    </Dialogo>
  )
}

export function EstoqueDePneus({ base }: { readonly base: string }): JSX.Element {
  const { avisar } = useAvisos()
  const cadastro = useRecurso('cadastro', () => obterCadastro())
  const [linhas, setLinhas] = useState<readonly LinhaDeEstoque[]>([])
  const [movimentos, setMovimentos] = useState<readonly MovimentoListado[]>([])
  const [temMais, setTemMais] = useState(false)
  const [limite, setLimite] = useState(POR_PAGINA_DO_HISTORICO)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando')
  /** Sobe a cada movimentacao gravada: refaz a leitura do saldo e do historico. */
  const [versao, setVersao] = useState(0)
  const [aberto, setAberto] = useState<Rascunho | null>(null)

  useEffect(() => {
    let atual = true
    void Promise.all([listarEstoque(base), listarMovimentos(base, limite)]).then(
      ([novas, historico]) => {
        if (!atual) return
        setLinhas(novas)
        setMovimentos(historico.movimentos)
        setTemMais(historico.temMais)
        setEstado('ok')
      },
      (falha: unknown) => {
        if (!atual) return
        setEstado('erro')
        avisar(falha instanceof Error ? falha.message : 'Não foi possível ler o estoque.', 'erro')
      },
    )
    return () => {
      atual = false
    }
  }, [base, limite, versao])

  const grupos = agruparEstoque(linhas)
  const totais = totaisDoEstoque(linhas)
  const medidas = medidasDoEstoque(linhas)
  const placas: readonly Opcao[] = (cadastro.dados?.veiculos ?? [])
    .filter((v) => v.ativo && v.base === base)
    .sort((a, b) => a.placa.localeCompare(b.placa))
    .map((v) => ({ valor: v.placa, rotulo: v.modelo === null ? v.placa : `${v.placa} · ${v.modelo}` }))

  const tabela = (
    <>
      <CabecalhoDeBloco
        titulo="Pneus em estoque"
        subtitulo="Por medida, tipo e condição · o saldo muda só por movimentação"
        direita={<Botao rotulo="Movimentar estoque" antes={Plus} aoClicar={() => setAberto(rascunhoNovo())} />}
      />
      {estado === 'ok' && grupos.length === 0
        ? (
          <Vazio
            icone={SettingsGear}
            titulo="Estoque vazio"
            texto="Registre a primeira entrada: a medida, a condição (novo ou recapado) e a quantidade."
            acao={<Botao tipo="primario" rotulo="Registrar entrada" antes={Plus} aoClicar={() => setAberto(rascunhoNovo())} />}
          />
        )
        : (
          <Tabela
            cabecalho={
              <>
                <Th>Medida</Th>
                <Th>Marca</Th>
                <Th>Tipo</Th>
                <Th direita>Não recapado</Th>
                <Th direita>Recapado 1×</Th>
                <Th direita>Recapado 2×</Th>
                <Th direita>Recapado 3×</Th>
                <Th direita>Total</Th>
                <Th direita><span className="g-escondido">Ações</span></Th>
              </>
            }
          >
            {estado === 'carregando'
              ? <tr><Td colunas={9} vazio>Carregando…</Td></tr>
              : grupos.map((grupo) => (
                <tr key={`${grupo.medida}|${grupo.marca}|${grupo.tipoPneu}`}>
                  <Td><span className="g-forte g-l14m">{grupo.medida}</span></Td>
                  <Td>{grupo.marca === '' ? <span className="g-fraco">·</span> : grupo.marca}</Td>
                  <Td>
                    {grupo.tipoPneu === ''
                      ? <Badge rotulo="Sem tipo" cor="cinza" comIcone={false} />
                      : <Badge rotulo={rotuloDoTipoDePneu(grupo.tipoPneu)} cor={grupo.tipoPneu === 'misto' ? 'teal' : 'verde'} comIcone={false} />}
                  </Td>
                  {grupo.porCondicao.map((quantidade, i) => (
                    <Td key={i} direita>{quantidade === 0 ? <span className="g-fraco">·</span> : quantidade}</Td>
                  ))}
                  <Td direita><span className="g-forte">{grupo.total}</span></Td>
                  <Td direita>
                    <Botao
                      tipo="terciario"
                      rotulo="Movimentar"
                      aoClicar={() => setAberto(rascunhoNovo({
                        medida: grupo.medida,
                        marca: grupo.marca,
                        tipoPneu: grupo.tipoPneu,
                      }))}
                    />
                  </Td>
                </tr>
              ))}
          </Tabela>
        )}
    </>
  )

  const historico = (
    <>
      <CabecalhoDeBloco
        titulo="Histórico de movimentações"
        subtitulo="Do mais recente para o mais antigo: quem mexeu, quando e por quê"
      />
      <Tabela
        cabecalho={['Quando', 'Quem', 'Pneu', 'Movimento', 'Saldo', 'Motivo'].map((coluna, i) => (
          <Th key={coluna} direita={i === 3 || i === 4}>{coluna}</Th>
        ))}
      >
        {movimentos.length === 0
          ? <tr><Td colunas={6} vazio>{estado === 'carregando' ? 'Carregando…' : 'Nenhuma movimentação ainda.'}</Td></tr>
          : movimentos.map((m) => (
            <tr key={m.id}>
              <Td><span className="g-l13m g-fraco">{quandoDe(m.quando)}</span></Td>
              <Td><span className="g-forte">{m.usuario}</span></Td>
              <Td>
                <span className="g-l14m">{m.medida}</span>
                {m.marca === '' ? null : <span className="g-fraco"> · {m.marca}</span>}
                <span className="g-fraco"> · {rotuloDoTipoDePneu(m.tipoPneu)} · {rotuloDaCondicao(m.recapagens)}</span>
              </Td>
              <Td direita>
                <Badge
                  rotulo={textoDoMovimento(m)}
                  cor={m.tipo === 'ajuste' ? 'ambar' : m.delta > 0 ? 'verde' : 'vermelho'}
                  comIcone={false}
                />
              </Td>
              <Td direita>{m.saldoDepois}</Td>
              <Td>
                {ROTULO_DO_MOTIVO[m.motivo] ?? m.motivo}
                {m.placa === null ? null : <span className="g-fraco"> · {m.placa}</span>}
                {m.observacao === null ? null : <div className="g-l13 g-fraco">{m.observacao}</div>}
              </Td>
            </tr>
          ))}
      </Tabela>
      {temMais
        ? (
          <div className="g-paginacao">
            <span />
            <div className="g-paginacao-botoes">
              <Botao rotulo="Mostrar mais" aoClicar={() => setLimite((n) => n + POR_PAGINA_DO_HISTORICO)} />
            </div>
          </div>
        )
        : null}
    </>
  )

  return (
    <>
      <Grade
        celulas={[
          {
            col: [1, 5],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Pneus em estoque"
                valor={String(totais.total)}
                apoio={`${grupos.length} ${grupos.length === 1 ? 'medida' : 'medidas'} · Base ${base}`}
              />
            ),
          },
          {
            col: [5, 9],
            linha: 1,
            conteudo: <Estatistica rotulo="Não recapados" valor={String(totais.novos)} apoio="pneus novos, sem recapagem" />,
          },
          {
            col: [9, 13],
            linha: 1,
            conteudo: (
              <Estatistica
                rotulo="Recapados"
                valor={String(totais.recapados)}
                apoio={`1×: ${totais.porRecapagem[0]} · 2×: ${totais.porRecapagem[1]} · 3×: ${totais.porRecapagem[2]}`}
              />
            ),
          },
          { col: [1, 13], linha: 2, rente: true, conteudo: tabela },
          { col: [1, 13], linha: 3, rente: true, conteudo: historico },
        ]}
      />

      {aberto === null
        ? null
        : (
          <DialogoDeMovimento
            base={base}
            medidas={medidas}
            placas={placas}
            temSemTipo={linhas.some((l) => l.tipoPneu === '' && l.quantidade > 0)}
            inicial={aberto}
            aoFechar={() => setAberto(null)}
            aoSalvar={() => {
              setAberto(null)
              setVersao((n) => n + 1)
            }}
          />
        )}
    </>
  )
}
