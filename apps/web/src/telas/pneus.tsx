/**
 * Controle de pneus: o pneu individual, nao so o alerta por veiculo. O plano preventivo
 * (`manutencao.tsx`) ja avisa quando a frota inteira precisa de rodizio/alinhamento a
 * cada 5.000 km -- essa tela nao repete isso. O que falta ali e o que esta aqui: cada
 * pneu tem a propria posicao, o proprio status (novo/recapado/sucateado) e o proprio km
 * desde a instalacao, porque um caminhao de quatro eixos tem doze pneus que nao chegam
 * aos 60.000 km de avaliar recape no mesmo dia.
 *
 * Mesmo esqueleto de `manutencao.tsx`: tres estatisticas no topo, uma tabela por
 * veiculo, um dialogo por veiculo que lista e edita sem botao "Salvar" -- cada gravacao
 * e imediata, porque reverter e nao invalidar e quem tem a lista e o recurso.
 */
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { invalidar, useRecurso, useSessao } from '../app/dados.ts'
import { lerNumero } from '../dashboard/digitado.ts'
import { Campo, CampoDeArquivo, Chips, Dialogo, GradeDeCampos, TituloDeSecao, useAvisos } from '../geist/formulario.tsx'
import { CloudUpload, Plus, SettingsGear, Trash } from '../geist/icones.tsx'
import {
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Esqueleto,
  Estatistica,
  Grade,
  Tabela,
  Td,
  Th,
  classes,
} from '../geist/primitivos.tsx'
import type { CorDeBadge, Opcao } from '../geist/primitivos.tsx'
import { atualizarPneu, atualizarVeiculo, criarPneu, obterCadastro } from '../js/cadastro-api.ts'
import type { EntradaPneu, EntradaVeiculo, PneuCadastro, StatusPneu, VeiculoCadastro } from '../js/cadastro-api.ts'
import { listarRegistros } from '../js/registros-api.ts'
import type { Registro } from '../js/registros-api.ts'

// ---------- leitura do registro ----------

function texto(r: Registro, campo: string): string | null {
  const valor = r[campo]
  return typeof valor === 'string' ? valor : null
}

function numero(r: Registro, campo: string): number | null {
  const valor = r[campo]
  return typeof valor === 'number' ? valor : null
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

// ---------- status de recape ----------

/** 60.000 km e a regra da Livia pra avaliar recape; o alerta antecipa no mesmo intervalo
 * do rodizio (5.000 km), pra quem olha a tela ter tempo de agendar. */
const LIMITE_RECAPE_KM = 60000
const ALERTA_RECAPE_KM = 5000

type StatusRecape = 'vencida' | 'alerta' | 'ok' | 'sem_dado'

const PRIORIDADE: Readonly<Record<StatusRecape, number>> = { vencida: 0, alerta: 1, ok: 2, sem_dado: 3 }

const BADGE_DO_STATUS: Readonly<Record<StatusRecape, { readonly rotulo: string; readonly cor: CorDeBadge }>> = {
  vencida: { rotulo: 'Avaliar recape', cor: 'vermelho' },
  alerta: { rotulo: 'Próximo', cor: 'ambar' },
  ok: { rotulo: 'Em dia', cor: 'verde' },
  sem_dado: { rotulo: 'Sem dado', cor: 'cinza' },
}

const TOM_DO_STATUS: Readonly<Record<StatusRecape, string | null>> = {
  vencida: 'g-tom-critico',
  alerta: 'g-tom-atencao',
  ok: null,
  sem_dado: null,
}

const ROTULO_DO_STATUS_PNEU: Readonly<Record<StatusPneu, string>> = {
  novo: 'Novo',
  recapado: 'Recapado',
  sucateado: 'Sucateado',
}

type PneuAvaliado = PneuCadastro & {
  readonly kmRodado: number | null
  readonly restante: number | null
  readonly statusRecape: StatusRecape
}

/** Pneu sucateado nao conta recape: ja saiu de circulacao, nao ha o que avaliar nele. */
function avaliarPneu(p: PneuCadastro, kmAtual: number | null): PneuAvaliado {
  if (p.status === 'sucateado' || p.kmInstalado === null || kmAtual === null) {
    return { ...p, kmRodado: null, restante: null, statusRecape: 'sem_dado' }
  }
  const kmRodado = Math.max(0, kmAtual - p.kmInstalado)
  const restante = LIMITE_RECAPE_KM - kmRodado
  const statusRecape: StatusRecape = restante <= 0 ? 'vencida' : restante <= ALERTA_RECAPE_KM ? 'alerta' : 'ok'
  return { ...p, kmRodado, restante, statusRecape }
}

function maisUrgente(pneus: readonly PneuAvaliado[]): PneuAvaliado | null {
  const ordenados = [...pneus].sort((a, b) =>
    PRIORIDADE[a.statusRecape] - PRIORIDADE[b.statusRecape] ||
    (a.restante ?? Number.POSITIVE_INFINITY) - (b.restante ?? Number.POSITIVE_INFINITY)
  )
  return ordenados[0] ?? null
}

type VeiculoAvaliado = {
  readonly id: string
  readonly placa: string
  readonly modelo: string | null
  readonly eixos: number | null
  readonly kmAtual: number | null
  readonly pneus: readonly PneuAvaliado[]
  readonly urgente: PneuAvaliado | null
}

function avaliar(veiculo: VeiculoCadastro, pneusDoVeiculo: readonly PneuCadastro[], registros: readonly Registro[]): VeiculoAvaliado {
  const kmAtual = kmAtualPorPlaca(registros, veiculo.placa)
  const pneus = pneusDoVeiculo.map((p) => avaliarPneu(p, kmAtual))
  return {
    id: veiculo.id,
    placa: veiculo.placa,
    modelo: veiculo.modelo,
    eixos: veiculo.eixos,
    kmAtual,
    pneus,
    urgente: maisUrgente(pneus),
  }
}

// ---------- texto ----------

const VAZIO = '·'

function motivoDaFalha(e: unknown, padrao: string): string {
  if (e instanceof TypeError) return 'Sem conexão. Tente de novo.'
  return e instanceof Error ? e.message : padrao
}

function emKm(valor: number | null): string {
  return valor === null ? VAZIO : valor.toLocaleString('pt-BR')
}

function faltam(restante: number): string {
  return `${restante < 0 ? '−' : ''}${Math.abs(restante).toLocaleString('pt-BR')} km`
}

function apoioDasVencidas(placas: readonly string[]): string {
  if (placas.length === 0) return 'nenhuma placa com pneu passado do km'
  if (placas.length === 1) return `${placas[0]} passou do km`
  if (placas.length === 2) return `${placas.join(' e ')} passaram do km`
  return `${placas.slice(0, 2).join(', ')} e mais ${placas.length - 2} passaram do km`
}

function propErro(mensagem: string | null): { readonly erro?: string } {
  return mensagem === null ? {} : { erro: mensagem }
}

function baseComMaisPneus(veiculos: readonly VeiculoCadastro[], pneus: readonly PneuCadastro[], bases: readonly string[]): string {
  let escolhida = bases[0] ?? ''
  let maior = -1
  for (const nome of bases) {
    const idsDaBase = new Set(veiculos.filter((v) => v.base === nome).map((v) => v.id))
    const quantos = pneus.filter((p) => idsDaBase.has(p.veiculoId)).length
    if (quantos > maior) {
      escolhida = nome
      maior = quantos
    }
  }
  return escolhida
}

// ---------- tabela ----------

const COLUNAS: ReadonlyArray<{ readonly rotulo: string; readonly direita: boolean }> = [
  { rotulo: 'Placa', direita: false },
  { rotulo: 'Modelo', direita: false },
  { rotulo: 'Eixos', direita: true },
  { rotulo: 'Pneus cadastrados', direita: true },
  { rotulo: 'km atual', direita: true },
  { rotulo: 'Faltam p/ recape', direita: true },
  { rotulo: 'Status', direita: false },
  { rotulo: '', direita: false },
]

function LinhaVeiculo({ veiculo, aoConfigurar }: {
  readonly veiculo: VeiculoAvaliado
  readonly aoConfigurar: () => void
}): JSX.Element {
  const { urgente } = veiculo
  const ativos = veiculo.pneus.filter((p) => p.status !== 'sucateado')
  return (
    <tr>
      <Td><span className="g-l13m g-forte">{veiculo.placa}</span></Td>
      <Td><span className="g-fraco">{veiculo.modelo ?? VAZIO}</span></Td>
      <Td direita>{veiculo.eixos === null ? <span className="g-fraco">{VAZIO}</span> : veiculo.eixos}</Td>
      <Td direita>{ativos.length}</Td>
      <Td direita>{veiculo.kmAtual === null ? <span className="g-fraco">{VAZIO}</span> : emKm(veiculo.kmAtual)}</Td>
      <Td direita>
        {urgente === null || urgente.restante === null
          ? <span className="g-fraco">{VAZIO}</span>
          : <span className={classes('g-forte', TOM_DO_STATUS[urgente.statusRecape])}>{faltam(urgente.restante)}</span>}
      </Td>
      <Td>
        {urgente === null
          ? <span className="g-fraco">Nenhum pneu cadastrado</span>
          : <Badge rotulo={BADGE_DO_STATUS[urgente.statusRecape].rotulo} cor={BADGE_DO_STATUS[urgente.statusRecape].cor} />}
      </Td>
      <Td>
        <Botao antes={SettingsGear} nome={`Pneus de ${veiculo.placa}`} aoClicar={aoConfigurar} />
      </Td>
    </tr>
  )
}

function TabelaDeVeiculos({ veiculos, aoConfigurar }: {
  readonly veiculos: readonly VeiculoAvaliado[]
  readonly aoConfigurar: (id: string) => void
}): JSX.Element {
  return (
    <>
      <CabecalhoDeBloco
        titulo="Pneus por veículo"
        subtitulo="Faltam p/ recape é do pneu mais perto do limite de 60.000 km"
      />
      <Tabela
        cabecalho={COLUNAS.map((coluna) => (
          <Th key={coluna.rotulo === '' ? 'acoes' : coluna.rotulo} direita={coluna.direita}>{coluna.rotulo}</Th>
        ))}
      >
        {veiculos.length === 0
          ? <tr><Td colunas={COLUNAS.length} vazio>Nenhum veículo nesta base</Td></tr>
          : veiculos.map((veiculo) => (
            <LinhaVeiculo key={veiculo.id} veiculo={veiculo} aoConfigurar={() => aoConfigurar(veiculo.id)} />
          ))}
      </Tabela>
    </>
  )
}

// ---------- dialogo por veiculo ----------

const OPCOES_DE_STATUS: readonly Opcao<StatusPneu>[] = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'recapado', rotulo: 'Recapado' },
  { valor: 'sucateado', rotulo: 'Sucateado' },
]

type Formulario = {
  readonly id: string | null
  readonly posicao: string
  readonly numeroFogo: string
  readonly marca: string
  readonly status: StatusPneu
  readonly recapagens: string
  readonly kmInstalado: string
  readonly dataInstalado: string
  readonly observacao: string
}

const FORMULARIO_VAZIO: Formulario = {
  id: null,
  posicao: '',
  numeroFogo: '',
  marca: '',
  status: 'novo',
  recapagens: '0',
  kmInstalado: '',
  dataInstalado: '',
  observacao: '',
}

function paraFormulario(p: PneuCadastro): Formulario {
  return {
    id: p.id,
    posicao: p.posicao,
    numeroFogo: p.numeroFogo ?? '',
    marca: p.marca ?? '',
    status: p.status,
    recapagens: String(p.recapagens),
    kmInstalado: p.kmInstalado === null ? '' : String(p.kmInstalado),
    dataInstalado: p.dataInstalado ?? '',
    observacao: p.observacao ?? '',
  }
}

type Erros = { readonly posicao: string | null }
const SEM_ERROS: Erros = { posicao: null }

function DialogoDoVeiculo({ veiculo, aoFechar }: {
  readonly veiculo: VeiculoAvaliado
  readonly aoFechar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VAZIO)
  const [erros, setErros] = useState<Erros>(SEM_ERROS)
  const [aDesativar, setADesativar] = useState<PneuAvaliado | null>(null)
  const [gravando, setGravando] = useState(false)

  const gravar = async (entrada: EntradaPneu, id: string | null, feito: string): Promise<boolean> => {
    setGravando(true)
    try {
      if (id === null) await criarPneu(entrada)
      else await atualizarPneu(id, entrada)
      invalidar('cadastro')
      avisar(feito, 'ok')
      return true
    } catch (e) {
      avisar(motivoDaFalha(e, 'Não foi possível salvar.'), 'erro')
      return false
    } finally {
      setGravando(false)
    }
  }

  const salvar = async (): Promise<void> => {
    const posicao = formulario.posicao.trim()
    const achados: Erros = { posicao: posicao === '' ? 'Informe a posição do pneu.' : null }
    setErros(achados)
    if (achados.posicao !== null) return
    const entrada: EntradaPneu = {
      veiculoId: veiculo.id,
      posicao,
      numeroFogo: formulario.numeroFogo.trim() || null,
      marca: formulario.marca.trim() || null,
      status: formulario.status,
      recapagens: Math.max(0, Math.trunc(lerNumero(formulario.recapagens)) || 0),
      kmInstalado: formulario.kmInstalado === '' ? null : Math.trunc(lerNumero(formulario.kmInstalado)) || null,
      dataInstalado: formulario.dataInstalado || null,
      observacao: formulario.observacao.trim() || null,
      ativo: true,
    }
    if (await gravar(entrada, formulario.id, formulario.id === null ? 'Pneu adicionado' : 'Pneu atualizado')) {
      setFormulario(FORMULARIO_VAZIO)
      setErros(SEM_ERROS)
    }
  }

  const desativar = async (pneu: PneuAvaliado): Promise<void> => {
    const entrada: EntradaPneu = {
      veiculoId: pneu.veiculoId,
      posicao: pneu.posicao,
      numeroFogo: pneu.numeroFogo,
      marca: pneu.marca,
      status: pneu.status,
      recapagens: pneu.recapagens,
      kmInstalado: pneu.kmInstalado,
      dataInstalado: pneu.dataInstalado,
      observacao: pneu.observacao,
      ativo: false,
    }
    if (await gravar(entrada, pneu.id, 'Pneu removido do inventário')) setADesativar(null)
  }

  return (
    <>
      <Dialogo
        aberto
        titulo={`Pneus · ${veiculo.placa}`}
        subtitulo={`km atual registrado: ${veiculo.kmAtual === null ? 'não disponível' : `${emKm(veiculo.kmAtual)} km`}`}
        largura={720}
        aoFechar={aoFechar}
        acoes={<Botao rotulo="Fechar" aoClicar={aoFechar} />}
      >
        {veiculo.pneus.length === 0
          ? <div className="g-l13 g-fraco">Nenhum pneu cadastrado ainda.</div>
          : (
            <div className="g-linhas">
              {veiculo.pneus.map((p) => (
                <div className="g-linha" key={p.id}>
                  <div>
                    <div className="g-linha-rotulo g-l14 g-forte">
                      {p.posicao}
                      {' · '}
                      <Badge comIcone={false} cor={p.status === 'sucateado' ? 'vermelho' : 'cinza'} rotulo={ROTULO_DO_STATUS_PNEU[p.status]} />
                    </div>
                    <div className="g-linha-apoio g-l13">
                      {`${p.marca ?? 'sem marca'} · ${p.recapagens} ${p.recapagens === 1 ? 'recapagem' : 'recapagens'} · ` +
                        (p.kmRodado === null ? 'km desde a instalação não disponível' : `${emKm(p.kmRodado)} km desde a instalação`)}
                    </div>
                  </div>
                  <div className="g-rodape-acoes">
                    <Botao antes={SettingsGear} nome={`Editar pneu ${p.posicao}`} aoClicar={() => setFormulario(paraFormulario(p))} />
                    <Botao antes={Trash} nome={`Remover pneu ${p.posicao}`} aoClicar={() => setADesativar(p)} />
                  </div>
                </div>
              ))}
            </div>
          )}

        <div className="g-secao-apartada">
          <TituloDeSecao
            titulo={formulario.id === null ? 'Adicionar pneu' : `Editando ${formulario.posicao}`}
            subtitulo="O pneu entra no inventário assim que você adiciona"
            direita={
              <>
                {formulario.id === null ? null : <Botao rotulo="Cancelar edição" aoClicar={() => setFormulario(FORMULARIO_VAZIO)} />}
                <Botao
                  rotulo={formulario.id === null ? 'Adicionar pneu' : 'Salvar alterações'}
                  antes={Plus}
                  tipo="primario"
                  carregando={gravando}
                  aoClicar={() => void salvar()}
                />
              </>
            }
          />
        </div>
        <GradeDeCampos>
          <Campo
            rotulo="Posição"
            span={4}
            obrigatorio
            dica="Ex: Dianteiro esquerdo"
            valor={formulario.posicao}
            aoMudar={(posicao) => setFormulario((atual) => ({ ...atual, posicao }))}
            {...propErro(erros.posicao)}
          />
          <Campo
            rotulo="Marca"
            span={4}
            valor={formulario.marca}
            aoMudar={(marca) => setFormulario((atual) => ({ ...atual, marca }))}
          />
          <Campo
            rotulo="Nº de fogo"
            span={4}
            valor={formulario.numeroFogo}
            aoMudar={(numeroFogo) => setFormulario((atual) => ({ ...atual, numeroFogo }))}
          />
          <Campo
            tipo="select"
            rotulo="Status"
            span={4}
            opcoes={OPCOES_DE_STATUS}
            valor={formulario.status}
            aoMudar={(status) => setFormulario((atual) => ({ ...atual, status: status as StatusPneu }))}
          />
          <Campo
            tipo="numero"
            rotulo="Recapagens"
            span={4}
            valor={formulario.recapagens}
            aoMudar={(recapagens) => setFormulario((atual) => ({ ...atual, recapagens }))}
          />
          <Campo
            tipo="numero"
            rotulo="km na instalação"
            span={4}
            valor={formulario.kmInstalado}
            aoMudar={(kmInstalado) => setFormulario((atual) => ({ ...atual, kmInstalado }))}
            {...(veiculo.kmAtual === null ? {} : { dica: String(veiculo.kmAtual) })}
          />
          <Campo
            tipo="data"
            rotulo="Data da instalação"
            span={6}
            valor={formulario.dataInstalado}
            aoMudar={(dataInstalado) => setFormulario((atual) => ({ ...atual, dataInstalado }))}
          />
          <Campo
            rotulo="Observação"
            span={6}
            valor={formulario.observacao}
            aoMudar={(observacao) => setFormulario((atual) => ({ ...atual, observacao }))}
          />
        </GradeDeCampos>
      </Dialogo>

      {aDesativar === null ? null : (
        <Dialogo
          aberto
          titulo="Remover pneu"
          aoFechar={() => setADesativar(null)}
          acoes={
            <>
              <Botao rotulo="Cancelar" aoClicar={() => setADesativar(null)} />
              <Botao rotulo="Remover" tipo="primario" carregando={gravando} aoClicar={() => void desativar(aDesativar)} />
            </>
          }
        >
          <div className="g-l14">
            {`Remover "${aDesativar.posicao}" do inventário de ${veiculo.placa}? O histórico de recapagem dele some junto.`}
          </div>
        </Dialogo>
      )}
    </>
  )
}

// ---------- importar eixos e modelo ----------
//
// So os campos eixos e modelo do veiculo, pela mesma planilha que a Livia ja usa pra
// controlar a frota (Base, Placa, Eixos, Quantidade de pneus) mais o modelo, que
// tambem fica em branco em boa parte da frota. Nao cria pneu nenhum: "quantidade de
// pneus" na planilha dela e so uma contagem, sem posicao nem status, e inventar doze
// linhas genericas de "Pneu 1".."Pneu 12" por veiculo poluiria o inventario de verdade
// em vez de ajudar -- o pneu individual continua entrando pelo dialogo, um a um, a
// medida que ela identifica cada posicao fisica.
//
// Eixos e modelo sao independentes linha a linha: uma planilha so com eixos, so com
// modelo, ou com os dois funciona igual. So troca o que a linha trouxe -- coluna
// ausente ou em branco deixa o campo como ja estava no cadastro.

type LinhaVeiculoImportado = { readonly placa: string; readonly eixos: number | null; readonly modelo: string | null }

function lerCsvVeiculos(
  conteudo: string,
): { readonly achadas: readonly LinhaVeiculoImportado[]; readonly erros: readonly string[] } {
  const linhas = conteudo.split('\n').map((l) => l.trim()).filter(Boolean)
  const [cabecalhoBruto, ...corpo] = linhas
  if (cabecalhoBruto === undefined || corpo.length === 0) return { achadas: [], erros: [] }
  const cabecalho = cabecalhoBruto.split(',').map((h) => h.trim().toLowerCase())
  const achadas: LinhaVeiculoImportado[] = []
  const erros: string[] = []
  corpo.forEach((bruta, i) => {
    const colunas = bruta.split(',')
    const linha: Record<string, string> = {}
    cabecalho.forEach((h, j) => {
      linha[h] = (colunas[j] ?? '').trim()
    })
    const eixos = linha.eixos ? Math.trunc(lerNumero(linha.eixos)) : 0
    const modelo = linha.modelo || null
    if (!linha.placa || (eixos <= 0 && modelo === null)) {
      erros.push(`Linha ${i + 2}: faltou placa, e eixos ou modelo`)
      return
    }
    achadas.push({ placa: linha.placa.toUpperCase(), eixos: eixos > 0 ? eixos : null, modelo })
  })
  return { achadas, erros }
}

type ResultadoVeiculoImportado =
  & { readonly linha: LinhaVeiculoImportado }
  & ({ readonly estado: 'ok' } | { readonly estado: 'erro'; readonly motivo: string })

function DialogoImportarVeiculos({ veiculos, aoFechar }: {
  readonly veiculos: readonly VeiculoCadastro[]
  readonly aoFechar: () => void
}): JSX.Element {
  const { avisar } = useAvisos()
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<readonly LinhaVeiculoImportado[]>([])
  const [errosDoArquivo, setErrosDoArquivo] = useState<readonly string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<readonly ResultadoVeiculoImportado[]>([])

  const escolher = (arquivo: File): void => {
    setNomeDoArquivo(arquivo.name)
    const leitor = new FileReader()
    leitor.onload = () => {
      const { achadas, erros } = lerCsvVeiculos(String(leitor.result))
      setLinhas(achadas)
      setErrosDoArquivo(erros)
      setResultados([])
    }
    leitor.readAsText(arquivo, 'UTF-8')
  }

  async function importar(): Promise<void> {
    setEnviando(true)
    const saida: ResultadoVeiculoImportado[] = []
    for (const linha of linhas) {
      const compativeis = veiculos.filter((v) => v.placa.toUpperCase() === linha.placa)
      const [veiculo, ...resto] = compativeis
      if (veiculo === undefined) {
        saida.push({ linha, estado: 'erro', motivo: 'nenhum veículo encontrado com essa placa' })
        continue
      }
      if (resto.length > 0) {
        saida.push({ linha, estado: 'erro', motivo: 'mais de um veículo com essa placa; corrija pelo Cadastro' })
        continue
      }
      // So troca o que a linha trouxe; o resto do cadastro passa intacto.
      const entrada: EntradaVeiculo = {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: linha.modelo ?? veiculo.modelo,
        ano: veiculo.ano,
        eixos: linha.eixos ?? veiculo.eixos,
        baseId: veiculo.baseId,
        ativo: veiculo.ativo,
      }
      try {
        await atualizarVeiculo(veiculo.id, entrada)
        saida.push({ linha, estado: 'ok' })
      } catch (e) {
        saida.push({ linha, estado: 'erro', motivo: motivoDaFalha(e, 'não foi possível salvar') })
      }
    }
    setResultados(saida)
    setEnviando(false)
    invalidar('cadastro')
    const ok = saida.filter((r) => r.estado === 'ok').length
    avisar(`${ok} de ${saida.length} veículos atualizados.`, ok === saida.length ? 'ok' : 'erro')
  }

  return (
    <Dialogo
      aberto
      titulo="Importar eixos e modelo"
      subtitulo="O CSV precisa da coluna placa, e de eixos e/ou modelo. Coluna ausente ou em branco não muda o que já está salvo."
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
      {resultados.map((r, i) => {
        const mudou = [
          r.linha.eixos === null ? null : `eixos = ${r.linha.eixos}`,
          r.linha.modelo === null ? null : `modelo = ${r.linha.modelo}`,
        ].filter((p): p is string => p !== null).join(', ')
        return (
          <div className={`g-l13 ${r.estado === 'erro' ? 'g-tom-critico' : 'g-tom-ok'}`} key={i}>
            {`${r.linha.placa}: ${r.estado === 'ok' ? mudou : r.motivo}`}
          </div>
        )
      })}
    </Dialogo>
  )
}

// ---------- tela ----------

export default function Pneus(): JSX.Element {
  const { avisar } = useAvisos()
  const sessao = useSessao()
  const cadastro = useRecurso('cadastro', () => obterCadastro())
  const registros = useRecurso('registros', () => listarRegistros())

  const [base, setBase] = useState<string | null>(null)
  const [veiculoConfigurando, setVeiculoConfigurando] = useState<string | null>(null)
  const [importandoVeiculos, setImportandoVeiculos] = useState(false)

  // A dependencia e o estado da leitura, e nao o render: o aviso e sobre a leitura ter
  // falhado, e uma tela que redesenha nao e uma falha nova.
  const falhou = cadastro.estado === 'erro' || registros.estado === 'erro'
  useEffect(() => {
    if (falhou) avisar('Não foi possível ler os dados do servidor.', 'erro')
  }, [falhou])

  if (cadastro.estado === 'carregando' || registros.estado === 'carregando') return <Esqueleto />

  const bases = (cadastro.dados?.bases ?? []).filter((b) => b.ativo).map((b) => b.nome)
  const todosOsVeiculos = cadastro.dados?.veiculos ?? []
  const todosOsPneus = cadastro.dados?.pneus ?? []
  const todosOsRegistros = registros.dados ?? []

  const daSessao = sessao.dados?.baseFixa ?? null
  const padrao = daSessao !== null && bases.includes(daSessao)
    ? daSessao
    : baseComMaisPneus(todosOsVeiculos, todosOsPneus, bases)
  const baseAtual = base ?? padrao

  const veiculosDaBase = todosOsVeiculos.filter((v) => v.base === baseAtual)
  const veiculos = veiculosDaBase.map((v) =>
    avaliar(v, todosOsPneus.filter((p) => p.veiculoId === v.id), todosOsRegistros)
  )

  const pneusDaBase = veiculos.flatMap((v) => v.pneus)
  const contar = (status: StatusRecape): number => pneusDaBase.filter((p) => p.statusRecape === status).length
  const vencidas = veiculos.filter((v) => v.pneus.some((p) => p.statusRecape === 'vencida')).map((v) => v.placa)

  const configurando = veiculos.find((v) => v.id === veiculoConfigurando) ?? null

  return (
    <>
      <CabecalhoDePagina
        titulo="Controle de pneus"
        subtitulo={`${veiculos.length} ${veiculos.length === 1 ? 'veículo' : 'veículos'} · Base ${baseAtual}`}
        acoes={
          <>
            <Botao rotulo="Importar eixos e modelo" antes={CloudUpload} aoClicar={() => setImportandoVeiculos(true)} />
            <Botao rotulo="Cadastrar veículo" href="/cadastro" />
          </>
        }
      />

      <div className="g-secao">
        <Chips valor={baseAtual} opcoes={bases.map((nome) => ({ valor: nome, rotulo: nome }))} aoEscolher={setBase} />
      </div>

      <Grade
        celulas={[
          {
            col: [1, 5],
            linha: 1,
            conteudo: (
              <Estatistica rotulo="Precisam avaliar recape" valor={String(contar('vencida'))} apoio={apoioDasVencidas(vencidas)} />
            ),
          },
          {
            col: [5, 9],
            linha: 1,
            conteudo: (
              <Estatistica rotulo="Próximos do limite" valor={String(contar('alerta'))} apoio="dentro de 5.000 km do limite de 60.000" />
            ),
          },
          {
            col: [9, 13],
            linha: 1,
            conteudo: (
              <Estatistica rotulo="Em dia" valor={String(contar('ok'))} apoio={`de ${pneusDaBase.length} pneus cadastrados`} />
            ),
          },
          {
            col: [1, 13],
            linha: 2,
            rente: true,
            conteudo: <TabelaDeVeiculos veiculos={veiculos} aoConfigurar={setVeiculoConfigurando} />,
          },
        ]}
      />

      {configurando === null ? null : (
        <DialogoDoVeiculo veiculo={configurando} aoFechar={() => setVeiculoConfigurando(null)} />
      )}

      {importandoVeiculos
        ? <DialogoImportarVeiculos veiculos={todosOsVeiculos} aoFechar={() => setImportandoVeiculos(false)} />
        : null}
    </>
  )
}
