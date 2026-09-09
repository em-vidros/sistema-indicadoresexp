/**
 * Atas de reuniao. O artboard e o `Ata` de `var/design-dashboard/build.mjs`, e ele manda
 * no desenho: identificacao em 1/8, participantes em 8/13, pauta na linha inteira e os
 * gestores no rodape.
 *
 * O artboard desenhou a pauta como tabela, e aqui ela e um formulario. A tabela nao tem
 * onde escrever, e esta tela existe para escrever a ata; o que sobrevive do desenho e a
 * ordem das colunas (discussao, conclusao, responsavel, prazo) e a linha de 12 colunas
 * que elas ocupam.
 *
 * O formulario inteiro e um estado so. A tela velha lia cada campo do DOM por id porque a
 * prova de paridade cobrava o id; sem ela, quatro campos por topico dentro de um `map` sao
 * apenas quatro campos de um objeto, e `entradaDe` e o unico lugar que traduz o objeto no
 * que a API recebe. Nao existe segunda leitura do formulario, e por isso nao existe jeito
 * de as duas discordarem.
 *
 * A folha de impressao nasce do mesmo estado, por portal no `<body>`. Ela precisa sair de
 * dentro do painel para que `@media print` possa esconder a casca inteira com uma regra
 * so; dentro do painel, esconder a casca esconderia tambem a folha.
 *
 * O alvo do PDF e uma ref e nao um estado porque ele nao desenha nada: `input.click()` e
 * sincrono e a escolha do arquivo chega muito depois, entao guardar para quem e o proximo
 * arquivo e um bilhete entre duas chamadas, nao algo que a tela mostre.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import { invalidar, useRecurso } from '../app/dados.ts'
import {
  AreaDeTexto,
  Assinatura,
  Campo,
  Dialogo,
  GradeDeCampos,
  LinhaDeCheck,
  TituloDeSecao,
  useAvisos,
} from '../geist/formulario.tsx'
import { Check, CloudUpload, Cross, Download, FileText, Notes, Plus, Trash } from '../geist/icones.tsx'
import {
  Abas,
  Badge,
  Botao,
  CabecalhoDeBloco,
  CabecalhoDePagina,
  Grade,
  Tabela,
  Td,
  Th,
  Vazio,
} from '../geist/primitivos.tsx'
import type { Celula } from '../geist/primitivos.tsx'
import {
  apagarAta,
  caminhoPdfAta,
  enviarPdfAta,
  listarAtas,
  obterCatalogoAtas,
  salvarAta,
} from '../js/atas-api.ts'
import type { AtaSalva, ColaboradorAta, EntradaAta } from '../js/atas-api.ts'

/** O que o servidor aceita por anexo. A tela recusa antes de subir 4 MB para nada. */
const TETO_PDF = 4 * 1024 * 1024

type Topico = {
  readonly id: number
  readonly discussao: string
  readonly conclusao: string
  readonly responsavel: string
  readonly prazo: string
}

type Externo = { readonly id: number; readonly nome: string }

type Formulario = {
  readonly numero: string
  readonly titulo: string
  readonly data: string
  readonly horario: string
  readonly local: string
  readonly convocada: string
  readonly facilitadores: string
  readonly participantesGeral: string
  readonly gestor1Nome: string
  readonly gestor1Cargo: string
  readonly gestor2Nome: string
  readonly gestor2Cargo: string
  readonly topicos: readonly Topico[]
  readonly marcados: ReadonlySet<string>
  readonly externos: readonly Externo[]
}

/** Os dois campos que a API recusa em branco, e por isso os unicos que a tela cobra. */
type Obrigatorio = 'titulo' | 'data'

type LinhaDeImportacao = {
  readonly id: number
  /** O rotulo do mes acima da linha. Vazio na linha adicionada a mao. */
  readonly mes: string
  readonly data: string
  readonly titulo: string
  readonly numero: string
  readonly pdf: File | null
}

/** Para quem e o proximo arquivo escolhido: a ata gravada, ou uma linha da importacao. */
type AlvoDePdf =
  | { readonly tipo: 'ata'; readonly id: string }
  | { readonly tipo: 'linha'; readonly id: number }

/** Os quatro grupos do catalogo, na ordem em que a tela velha os listava. */
const GRUPOS_DE_FUNCAO = [
  { funcao: 'motorista', rotulo: 'Motoristas' },
  { funcao: 'ajudante', rotulo: 'Ajudantes de entrega' },
  { funcao: 'atendimento', rotulo: 'Atendimento ao cliente' },
  { funcao: 'logistica', rotulo: 'Assistente de logística' },
] as const

/** Os oito meses fechados de 2026, no ultimo dia de cada um, como a importacao os abria. */
const MESES_DE_IMPORTACAO = [
  { mes: 'Janeiro', data: '2026-01-31' },
  { mes: 'Fevereiro', data: '2026-02-28' },
  { mes: 'Março', data: '2026-03-31' },
  { mes: 'Abril', data: '2026-04-30' },
  { mes: 'Maio', data: '2026-05-31' },
  { mes: 'Junho', data: '2026-06-30' },
  { mes: 'Julho', data: '2026-07-31' },
  { mes: 'Agosto', data: '2026-08-31' },
] as const

const TITULO_DE_IMPORTACAO = 'Alinhamento Equipe Expedição'

/** O que toda ata importada carrega igual, porque as oito sao a mesma reuniao mensal. */
const IMPORTADA: Omit<EntradaAta, 'numero' | 'titulo' | 'data'> = {
  horario: null,
  local: 'Raposa - MA',
  convocada: 'Lívia Lima, Raimundo Pontes',
  facilitadores: null,
  participantesGeral: null,
  gestor1Nome: null,
  gestor1Cargo: null,
  gestor2Nome: null,
  gestor2Cargo: null,
  importada: true,
  topicos: [],
  participantes: [],
}

const COLUNAS_DO_HISTORICO = ['Data', 'Nº', 'Título', 'Local', 'Participantes', 'Tópicos', 'PDF', '']

let ultimoId = 0

function proximoId(): number {
  ultimoId += 1
  return ultimoId
}

function topicoVazio(): Topico {
  return { id: proximoId(), discussao: '', conclusao: '', responsavel: '', prazo: '' }
}

function formularioInicial(): Formulario {
  const agora = new Date()
  return {
    numero: '',
    titulo: '',
    data: agora.toISOString().split('T')[0] ?? '',
    horario: agora.toTimeString().slice(0, 5),
    local: '',
    convocada: 'Lívia Lima, Raimundo Pontes',
    facilitadores: 'Gestores de Expedição, EM Vidros',
    participantesGeral: 'Equipe Expedição (motoristas e assistentes de frota)',
    gestor1Nome: 'Lívia Maria de Castro Cutrim Lima',
    gestor1Cargo: 'Gerente de Logística',
    gestor2Nome: 'Raimundo Pontes Pereira',
    gestor2Cargo: 'Coordenador de Expedição',
    topicos: [topicoVazio(), topicoVazio(), topicoVazio()],
    marcados: new Set(),
    externos: [],
  }
}

function nulo(texto: string): string | null {
  return texto.trim() === '' ? null : texto.trim()
}

function formatarData(data: string): string {
  const [ano = '', mes = '', dia = ''] = data.split('-')
  return ano === '' ? '' : `${dia}/${mes}/${ano}`
}

function mensagem(falha: unknown, padrao: string): string {
  return falha instanceof Error ? falha.message : padrao
}

/** Topico sem discussao e sem conclusao e linha em branco, e nao vai para o banco. */
function topicosDe(form: Formulario): EntradaAta['topicos'] {
  return form.topicos
    .filter((t) => t.discussao.trim() !== '' || t.conclusao.trim() !== '')
    .map((t) => ({
      discussao: nulo(t.discussao),
      conclusao: nulo(t.conclusao),
      responsavel: nulo(t.responsavel),
      prazo: nulo(t.prazo),
    }))
}

function participantesDe(form: Formulario): EntradaAta['participantes'] {
  return [
    ...[...form.marcados].map((id) => ({ colaboradorId: id, nomeExterno: null, presente: true })),
    ...form.externos
      .filter((e) => e.nome.trim() !== '')
      .map((e) => ({ colaboradorId: null, nomeExterno: e.nome.trim(), presente: true })),
  ]
}

function entradaDe(form: Formulario): EntradaAta {
  return {
    numero: nulo(form.numero),
    titulo: form.titulo.trim(),
    data: form.data,
    horario: nulo(form.horario),
    local: nulo(form.local),
    convocada: nulo(form.convocada),
    facilitadores: nulo(form.facilitadores),
    participantesGeral: nulo(form.participantesGeral),
    gestor1Nome: nulo(form.gestor1Nome),
    gestor1Cargo: nulo(form.gestor1Cargo),
    gestor2Nome: nulo(form.gestor2Nome),
    gestor2Cargo: nulo(form.gestor2Cargo),
    importada: false,
    topicos: topicosDe(form),
    participantes: participantesDe(form),
  }
}

/** Os nomes que vao para a lista de assinaturas da folha impressa. */
function nomesDe(form: Formulario, catalogo: readonly ColaboradorAta[]): readonly string[] {
  const doCatalogo = catalogo.filter((p) => form.marcados.has(p.id)).map((p) => p.nome)
  const externos = form.externos.map((e) => e.nome.trim()).filter((nome) => nome !== '')
  return [...doCatalogo, ...externos]
}

/** O nome do arquivo baixado: numero, data e titulo, sem nada que atrapalhe o disco. */
function nomeDoArquivo(ata: AtaSalva): string {
  const partes = [ata.numero === null ? 'ata' : `ata-${ata.numero.replace('/', '')}`, ata.data, ata.titulo]
  return `${partes.filter((p) => p !== '').join('-').replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`
}

function baixarPdf(ata: AtaSalva): void {
  const link = document.createElement('a')
  link.href = caminhoPdfAta(ata.id)
  link.download = nomeDoArquivo(ata)
  link.click()
}

// ---------- blocos da aba "ata" ----------

function Identificacao({ form, faltando, mudar }: {
  readonly form: Formulario
  readonly faltando: ReadonlySet<Obrigatorio>
  readonly mudar: (mudanca: Partial<Formulario>) => void
}): JSX.Element {
  const erro = (campo: Obrigatorio): { erro?: string } =>
    faltando.has(campo) ? { erro: 'A ata não é salva sem este campo' } : {}
  return (
    <>
      <TituloDeSecao titulo="Identificação da reunião" subtitulo="EM Vidros Indústria e Comércio de Vidros Ltda" />
      <GradeDeCampos>
        <Campo rotulo="Nº da ata" valor={form.numero} span={2} mono dica="014/2026" aoMudar={(numero) => mudar({ numero })} />
        <Campo rotulo="Data" tipo="data" valor={form.data} span={3} obrigatorio aoMudar={(data) => mudar({ data })} {...erro('data')} />
        <Campo rotulo="Horário" tipo="hora" valor={form.horario} span={2} aoMudar={(horario) => mudar({ horario })} />
        <Campo rotulo="Local" valor={form.local} span={5} dica="Expedição Raposa" aoMudar={(local) => mudar({ local })} />
        <Campo
          rotulo="Título da reunião"
          valor={form.titulo}
          span={12}
          obrigatorio
          dica="Alinhamento semanal de expedição e frota"
          aoMudar={(titulo) => mudar({ titulo })}
          {...erro('titulo')}
        />
        <Campo rotulo="Reunião convocada por" valor={form.convocada} span={6} aoMudar={(convocada) => mudar({ convocada })} />
        <Campo rotulo="Facilitadores" valor={form.facilitadores} span={6} aoMudar={(facilitadores) => mudar({ facilitadores })} />
      </GradeDeCampos>
    </>
  )
}

function Participantes({ form, catalogo, carregando, mudar }: {
  readonly form: Formulario
  readonly catalogo: readonly ColaboradorAta[]
  readonly carregando: boolean
  readonly mudar: (mudanca: Partial<Formulario>) => void
}): JSX.Element {
  const presentes = form.marcados.size + form.externos.filter((e) => e.nome.trim() !== '').length

  const marcar = (id: string, marcado: boolean): void => {
    const proximos = new Set(form.marcados)
    if (marcado) proximos.add(id)
    else proximos.delete(id)
    mudar({ marcados: proximos })
  }

  const todos = (marcado: boolean): void => {
    mudar({ marcados: marcado ? new Set(catalogo.map((p) => p.id)) : new Set() })
  }

  return (
    <>
      <TituloDeSecao
        titulo="Participantes"
        subtitulo={`${presentes} ${presentes === 1 ? 'presente' : 'presentes'} · lista por função`}
      />

      {carregando ? <div className="g-l13 g-fraco">Carregando o catálogo…</div> : null}
      {!carregando && catalogo.length === 0
        ? <div className="g-l13 g-fraco">Nenhum colaborador no catálogo.</div>
        : null}

      {GRUPOS_DE_FUNCAO.map((grupo) => {
        const pessoas = catalogo.filter((p) => p.funcao === grupo.funcao)
        if (pessoas.length === 0) return null
        return (
          <div key={grupo.funcao}>
            <div className="g-campo-rotulo">{grupo.rotulo}</div>
            {pessoas.map((pessoa) => (
              <LinhaDeCheck
                key={pessoa.id}
                texto={pessoa.nome}
                feito={form.marcados.has(pessoa.id)}
                data={pessoa.cargo ?? '·'}
                aoMudar={(marcado) => marcar(pessoa.id, marcado)}
              />
            ))}
          </div>
        )
      })}

      <div className="g-secao-acoes">
        <Botao rotulo="Marcar todos" antes={Check} aoClicar={() => todos(true)} />
        <Botao rotulo="Desmarcar todos" antes={Cross} aoClicar={() => todos(false)} />
        <Botao
          rotulo="Adicionar externo"
          antes={Plus}
          aoClicar={() => mudar({ externos: [...form.externos, { id: proximoId(), nome: '' }] })}
        />
      </div>

      <GradeDeCampos>
        {form.externos.map((externo) => (
          <ParticipanteExterno
            key={externo.id}
            externo={externo}
            aoMudar={(nome) => mudar({ externos: form.externos.map((e) => e.id === externo.id ? { ...e, nome } : e) })}
            aoRemover={() => mudar({ externos: form.externos.filter((e) => e.id !== externo.id) })}
          />
        ))}
        <AreaDeTexto
          rotulo="Participantes (descrição geral)"
          valor={form.participantesGeral}
          span={12}
          dica="Equipe de expedição da base Raposa, turno da manhã."
          aoMudar={(participantesGeral) => mudar({ participantesGeral })}
        />
      </GradeDeCampos>
    </>
  )
}

function ParticipanteExterno({ externo, aoMudar, aoRemover }: {
  readonly externo: Externo
  readonly aoMudar: (nome: string) => void
  readonly aoRemover: () => void
}): JSX.Element {
  return (
    <>
      <Campo
        rotulo="Participante externo"
        valor={externo.nome}
        span={10}
        dica="Nome completo do convidado"
        aoMudar={aoMudar}
      />
      <div className="g-campo-acao" style={{ gridColumn: 'span 2' }}>
        <Botao nome="Remover participante externo" antes={Trash} aoClicar={aoRemover} />
      </div>
    </>
  )
}

function Pauta({ form, mudar }: {
  readonly form: Formulario
  readonly mudar: (mudanca: Partial<Formulario>) => void
}): JSX.Element {
  const editar = (id: number, mudanca: Partial<Topico>): void => {
    mudar({ topicos: form.topicos.map((t) => t.id === id ? { ...t, ...mudanca } : t) })
  }

  return (
    <>
      <TituloDeSecao
        titulo="Pauta e encaminhamentos"
        subtitulo="Cada tópico vira um item com responsável e prazo. Os vazios não são salvos."
        direita={<Botao rotulo="Adicionar tópico" antes={Plus} aoClicar={() => mudar({ topicos: [...form.topicos, topicoVazio()] })} />}
      />
      {form.topicos.length === 0
        ? <div className="g-l13 g-fraco">Nenhum tópico. Adicione um para começar a pauta.</div>
        : null}
      {form.topicos.map((topico, indice) => (
        <div className="g-topico" key={topico.id}>
          <TituloDeSecao
            titulo={`Tópico ${indice + 1}`}
            direita={
              <Botao
                nome={`Remover o tópico ${indice + 1}`}
                antes={Trash}
                aoClicar={() => mudar({ topicos: form.topicos.filter((t) => t.id !== topico.id) })}
              />
            }
          />
          <GradeDeCampos>
            <Campo
              rotulo="Discussão"
              valor={topico.discussao}
              span={12}
              dica="Assunto discutido"
              aoMudar={(discussao) => editar(topico.id, { discussao })}
            />
            <AreaDeTexto
              rotulo="Conclusão e encaminhamento"
              valor={topico.conclusao}
              span={12}
              dica="Deliberações e o que fica combinado"
              aoMudar={(conclusao) => editar(topico.id, { conclusao })}
            />
            <Campo
              rotulo="Responsável"
              valor={topico.responsavel}
              span={6}
              dica="Nome ou função"
              aoMudar={(responsavel) => editar(topico.id, { responsavel })}
            />
            <Campo
              rotulo="Prazo"
              valor={topico.prazo}
              span={6}
              dica="Imediato, ou 30/09/2026"
              aoMudar={(prazo) => editar(topico.id, { prazo })}
            />
          </GradeDeCampos>
        </div>
      ))}
    </>
  )
}

function Gestores({ form, mudar }: {
  readonly form: Formulario
  readonly mudar: (mudanca: Partial<Formulario>) => void
}): JSX.Element {
  return (
    <>
      <TituloDeSecao titulo="Gestores responsáveis" subtitulo="Assinam a ata impressa" />
      <GradeDeCampos>
        <Campo rotulo="Nome do gestor 1" valor={form.gestor1Nome} span={6} aoMudar={(gestor1Nome) => mudar({ gestor1Nome })} />
        <Campo rotulo="Cargo do gestor 1" valor={form.gestor1Cargo} span={6} aoMudar={(gestor1Cargo) => mudar({ gestor1Cargo })} />
        <Campo rotulo="Nome do gestor 2" valor={form.gestor2Nome} span={6} aoMudar={(gestor2Nome) => mudar({ gestor2Nome })} />
        <Campo rotulo="Cargo do gestor 2" valor={form.gestor2Cargo} span={6} aoMudar={(gestor2Cargo) => mudar({ gestor2Cargo })} />
      </GradeDeCampos>
      <div className="g-assinaturas">
        <Assinatura nome={form.gestor1Nome} cargo={form.gestor1Cargo} />
        <Assinatura nome={form.gestor2Nome} cargo={form.gestor2Cargo} />
      </div>
    </>
  )
}

// ---------- aba "historico" ----------

function Historico({ atas, carregando, aoAnexar, aoExcluir }: {
  readonly atas: readonly AtaSalva[]
  readonly carregando: boolean
  readonly aoAnexar: (ata: AtaSalva) => void
  readonly aoExcluir: (ata: AtaSalva) => void
}): JSX.Element {
  if (!carregando && atas.length === 0) {
    return (
      <Vazio
        icone={Notes}
        titulo="Nenhuma ata salva"
        texto="Salve a ata da aba ao lado, ou importe as reuniões passadas."
      />
    )
  }
  return (
    <>
      <CabecalhoDeBloco titulo="Atas salvas" subtitulo="Da mais recente para a mais antiga" />
      <Tabela cabecalho={COLUNAS_DO_HISTORICO.map((coluna, i) => (
        <Th key={coluna === '' ? 'acoes' : coluna} direita={i >= 4 && i <= 5}>{coluna}</Th>
      ))}
      >
        {carregando
          ? <tr><Td colunas={COLUNAS_DO_HISTORICO.length} vazio>Carregando as atas…</Td></tr>
          : atas.map((ata) => (
            <tr key={ata.id}>
              <Td><span className="g-l13m g-fraco">{formatarData(ata.data) || '·'}</span></Td>
              <Td><span className="g-l13m">{ata.numero ?? '·'}</span></Td>
              <Td><span className="g-forte">{ata.titulo || 'Sem título'}</span></Td>
              <Td>{ata.local ?? '·'}</Td>
              <Td direita>{ata.participantes.length}</Td>
              <Td direita>{ata.topicos.length}</Td>
              <Td>
                {ata.temPdf
                  ? <Badge rotulo="Anexado" cor="verde" />
                  : <Badge rotulo="Pendente" cor="ambar" />}
              </Td>
              <Td direita>
                <div className="g-acoes-linha">
                  {ata.temPdf
                    ? <Botao nome="Baixar o PDF" antes={Download} aoClicar={() => baixarPdf(ata)} />
                    : null}
                  <Botao
                    nome={ata.temPdf ? 'Substituir o PDF' : 'Anexar o PDF'}
                    antes={CloudUpload}
                    aoClicar={() => aoAnexar(ata)}
                  />
                  <Botao nome="Excluir a ata" antes={Trash} aoClicar={() => aoExcluir(ata)} />
                </div>
              </Td>
            </tr>
          ))}
      </Tabela>
    </>
  )
}

// ---------- folha de impressao ----------

function Folha({ form, nomes }: {
  readonly form: Formulario
  readonly nomes: readonly string[]
}): JSX.Element {
  const campo = (rotulo: string, valor: string): JSX.Element => (
    <div className="g-folha-campo">
      <div className="g-folha-rotulo">{rotulo}</div>
      <div className="g-folha-valor">{valor}</div>
    </div>
  )
  return (
    <div className="g-folha">
      <div className="g-folha-cabecalho">
        <div className="g-folha-empresa">EM Vidros Indústria e Comércio de Vidros Ltda</div>
        <div className="g-folha-doc">Ata de reunião</div>
        <div className="g-folha-num">{form.numero === '' ? '' : `Ata nº ${form.numero}`}</div>
      </div>

      <div className="g-folha-linha">{campo('Título da reunião', form.titulo)}</div>
      <div className="g-folha-linha">
        {campo('Data', formatarData(form.data))}
        {campo('Horário', form.horario)}
        {campo('Local', form.local)}
      </div>
      <div className="g-folha-linha">
        {campo('Reunião convocada por', form.convocada)}
        {campo('Facilitadores', form.facilitadores)}
        {campo('Participantes', form.participantesGeral)}
      </div>

      {form.topicos
        .filter((t) => t.discussao.trim() !== '' || t.conclusao.trim() !== '')
        .map((topico, indice) => (
          <div className="g-folha-topico" key={topico.id}>
            <div className="g-folha-topico-num">{`Tópico ${indice + 1}`}</div>
            <div className="g-folha-linha">
              <div className="g-folha-campo">
                <div className="g-folha-rotulo">Discussão</div>
                <div className="g-folha-caixa">{topico.discussao}</div>
              </div>
              <div className="g-folha-campo">
                <div className="g-folha-rotulo">Conclusão e encaminhamento</div>
                <div className="g-folha-caixa">{topico.conclusao}</div>
              </div>
            </div>
            <div className="g-folha-linha">
              {campo('Responsável', topico.responsavel || '·')}
              {campo('Prazo', topico.prazo || '·')}
            </div>
          </div>
        ))}

      <div className="g-folha-participantes">
        <div className="g-folha-titulo">Participantes</div>
        <div className="g-folha-grade">
          {nomes.map((nome, indice) => (
            <div className="g-folha-item" key={indice}>
              <div className="g-folha-nome">{nome}</div>
              <div className="g-folha-assina">Assinatura</div>
            </div>
          ))}
        </div>
      </div>

      <div className="g-folha-gestores">
        <div className="g-folha-rotulo">Gestores responsáveis</div>
        <div className="g-folha-linha">
          <div className="g-folha-campo">
            <div className="g-folha-gestor">{form.gestor1Nome}</div>
            <div className="g-folha-rotulo">{form.gestor1Cargo}</div>
          </div>
          <div className="g-folha-campo">
            <div className="g-folha-gestor">{form.gestor2Nome}</div>
            <div className="g-folha-rotulo">{form.gestor2Cargo}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- a tela ----------

export default function Atas(): JSX.Element {
  const { avisar } = useAvisos()
  const atas = useRecurso('atas', listarAtas)
  const catalogo = useRecurso('atas-catalogo', obterCatalogoAtas)

  const [form, setForm] = useState<Formulario>(formularioInicial)
  const [faltando, setFaltando] = useState<ReadonlySet<Obrigatorio>>(() => new Set())
  const [ataId, setAtaId] = useState<string | null>(null)
  const [aba, setAba] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [linhas, setLinhas] = useState<readonly LinhaDeImportacao[] | null>(null)
  const [paraExcluir, setParaExcluir] = useState<AtaSalva | null>(null)

  const entradaDePdf = useRef<HTMLInputElement>(null)
  const alvoDoPdf = useRef<AlvoDePdf | null>(null)

  useEffect(() => {
    if (atas.estado === 'erro') avisar('Não foi possível carregar o histórico de atas.', 'erro')
  }, [atas.estado])

  const listadas = atas.dados ?? []
  const pessoas = catalogo.dados ?? []

  const mudar = (mudanca: Partial<Formulario>): void => {
    setForm((atual) => ({ ...atual, ...mudanca }))
  }

  async function salvar(): Promise<void> {
    const faltas = new Set<Obrigatorio>()
    if (form.titulo.trim() === '') faltas.add('titulo')
    if (form.data === '') faltas.add('data')
    setFaltando(faltas)
    if (faltas.size > 0) {
      avisar('Informe o título e a data da reunião antes de salvar.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const salva = await salvarAta(ataId, entradaDe(form))
      setAtaId(salva.id)
      invalidar('atas')
      avisar('Ata salva.')
    } catch (falha) {
      avisar(mensagem(falha, 'Não foi possível salvar a ata.'), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  // Imprimir nunca cobrou campo: quem quer so a folha em branco para preencher a mao
  // continua levando a folha. O que muda e que a ata completa e gravada de passagem.
  async function imprimir(): Promise<void> {
    if (form.titulo.trim() !== '' && form.data !== '') await salvar()
    window.print()
  }

  function pedirPdf(alvo: AlvoDePdf): void {
    alvoDoPdf.current = alvo
    const entrada = entradaDePdf.current
    if (entrada === null) return
    entrada.value = ''
    entrada.click()
  }

  async function receberPdf(entrada: HTMLInputElement): Promise<void> {
    const arquivo = entrada.files?.[0]
    const alvo = alvoDoPdf.current
    alvoDoPdf.current = null
    entrada.value = ''
    if (arquivo === undefined || alvo === null) return
    if (arquivo.size > TETO_PDF) {
      avisar('O PDF passa de 4 MB. Reduza o arquivo antes de anexar.', 'erro')
      return
    }
    if (alvo.tipo === 'linha') {
      setLinhas((antes) => (antes ?? []).map((l) => l.id === alvo.id ? { ...l, pdf: arquivo } : l))
      return
    }
    try {
      await enviarPdfAta(alvo.id, arquivo)
      invalidar('atas')
      avisar('PDF anexado.')
    } catch (falha) {
      avisar(mensagem(falha, 'Não foi possível anexar o PDF.'), 'erro')
    }
  }

  async function excluir(ata: AtaSalva): Promise<void> {
    setParaExcluir(null)
    try {
      await apagarAta(ata.id)
      if (ata.id === ataId) setAtaId(null)
      invalidar('atas')
      avisar('Ata excluída.')
    } catch (falha) {
      avisar(mensagem(falha, 'Não foi possível excluir a ata.'), 'erro')
    }
  }

  function abrirImportacao(): void {
    setLinhas(MESES_DE_IMPORTACAO.map((m) => ({
      id: proximoId(),
      mes: m.mes,
      data: m.data,
      titulo: TITULO_DE_IMPORTACAO,
      numero: '',
      pdf: null,
    })))
  }

  async function importar(): Promise<void> {
    const pendentes = (linhas ?? []).filter((l) => l.data !== '' || l.titulo.trim() !== '')
    setImportando(true)
    let salvas = 0
    let recusadas = 0
    for (const linha of pendentes) {
      try {
        const nova = await salvarAta(null, {
          ...IMPORTADA,
          numero: nulo(linha.numero),
          titulo: linha.titulo.trim() === '' ? 'Ata de reunião' : linha.titulo.trim(),
          data: linha.data,
        })
        if (linha.pdf !== null) await enviarPdfAta(nova.id, linha.pdf)
        salvas += 1
      } catch {
        // Uma linha recusada nao derruba o lote: parar no meio deixaria as anteriores
        // gravadas sem ninguem saber quais.
        recusadas += 1
      }
    }
    setImportando(false)
    setLinhas(null)
    invalidar('atas')
    const feitas = `${salvas} ${salvas === 1 ? 'ata importada' : 'atas importadas'}`
    if (recusadas === 0) avisar(`${feitas}.`)
    else avisar(`${feitas}. ${recusadas} ${recusadas === 1 ? 'linha recusada' : 'linhas recusadas'}, confira a data.`, 'erro')
  }

  const carregandoAtas = atas.estado === 'carregando'
  const identificacao = [
    form.numero === '' ? '' : `Nº ${form.numero}`,
    form.local,
    formatarData(form.data),
  ].filter((parte) => parte !== '')

  const celulas: readonly Celula[] = aba === 0
    ? [
      {
        col: [1, 8],
        linha: 1,
        conteudo: <Identificacao form={form} faltando={faltando} mudar={mudar} />,
      },
      {
        col: [8, 13],
        linha: 1,
        conteudo: (
          <Participantes
            form={form}
            catalogo={pessoas}
            carregando={catalogo.estado === 'carregando'}
            mudar={mudar}
          />
        ),
      },
      { col: [1, 13], linha: 2, conteudo: <Pauta form={form} mudar={mudar} /> },
      { col: [1, 13], linha: 3, conteudo: <Gestores form={form} mudar={mudar} /> },
    ]
    : [
      {
        col: [1, 13],
        linha: 1,
        rente: listadas.length > 0 || carregandoAtas,
        conteudo: (
          <Historico
            atas={listadas}
            carregando={carregandoAtas}
            aoAnexar={(ata) => pedirPdf({ tipo: 'ata', id: ata.id })}
            aoExcluir={setParaExcluir}
          />
        ),
      },
    ]

  return (
    <>
      <CabecalhoDePagina
        titulo="Atas de reunião"
        subtitulo={identificacao.length === 0 ? 'Nova ata' : identificacao.join(' · ')}
        acoes={
          <>
            <Botao rotulo="Gerar PDF" antes={FileText} aoClicar={() => void imprimir()} />
            {ataId === null
              ? null
              : <Botao rotulo="Anexar PDF assinado" antes={CloudUpload} aoClicar={() => pedirPdf({ tipo: 'ata', id: ataId })} />}
            <Botao rotulo="Salvar ata" tipo="primario" antes={Check} carregando={salvando} aoClicar={() => void salvar()} />
          </>
        }
      />

      <div className="g-barra">
        <Abas itens={['Ata', `Histórico (${listadas.length})`]} ativa={aba} aoTrocar={setAba} />
        <span className="g-barra-vao" />
        {aba === 1 ? <Botao rotulo="Importar atas passadas" antes={Download} aoClicar={abrirImportacao} /> : null}
      </div>

      <Grade celulas={celulas} />

      <input
        ref={entradaDePdf}
        className="g-escondido"
        type="file"
        accept="application/pdf"
        onChange={(e) => void receberPdf(e.currentTarget)}
      />

      <Dialogo
        aberto={paraExcluir !== null}
        titulo="Excluir esta ata"
        {...(paraExcluir === null
          ? {}
          : { subtitulo: `${paraExcluir.titulo || 'Sem título'} · ${formatarData(paraExcluir.data)}` })}
        aoFechar={() => setParaExcluir(null)}
        largura={440}
        acoes={
          <>
            <Botao rotulo="Manter a ata" tipo="terciario" aoClicar={() => setParaExcluir(null)} />
            <Botao
              rotulo="Excluir a ata"
              antes={Trash}
              aoClicar={() => { if (paraExcluir !== null) void excluir(paraExcluir) }}
            />
          </>
        }
      >
        <div className="g-l14">
          A ata sai do histórico junto com o PDF anexado. Não há como desfazer.
        </div>
      </Dialogo>

      <Dialogo
        aberto={linhas !== null}
        titulo="Importar atas passadas"
        subtitulo="Janeiro a agosto de 2026. Informe data, título e número; anexe o PDF assinado se tiver."
        aoFechar={() => setLinhas(null)}
        largura={760}
        acoes={
          <>
            <Botao rotulo="Cancelar" tipo="terciario" aoClicar={() => setLinhas(null)} />
            <Botao rotulo="Salvar no histórico" tipo="primario" antes={Check} carregando={importando} aoClicar={() => void importar()} />
          </>
        }
      >
        <GradeDeCampos>
          {(linhas ?? []).map((linha) => (
            <LinhaImportada
              key={linha.id}
              linha={linha}
              aoMudar={(mudanca) => setLinhas((antes) => (antes ?? []).map((l) => l.id === linha.id ? { ...l, ...mudanca } : l))}
              aoEscolherPdf={() => pedirPdf({ tipo: 'linha', id: linha.id })}
            />
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <Botao
              rotulo="Adicionar linha"
              antes={Plus}
              aoClicar={() => setLinhas((antes) => [...(antes ?? []), { id: proximoId(), mes: '', data: '', titulo: '', numero: '', pdf: null }])}
            />
          </div>
        </GradeDeCampos>
      </Dialogo>

      {createPortal(<Folha form={form} nomes={nomesDe(form, pessoas)} />, document.body)}
    </>
  )
}

function LinhaImportada({ linha, aoMudar, aoEscolherPdf }: {
  readonly linha: LinhaDeImportacao
  readonly aoMudar: (mudanca: Partial<LinhaDeImportacao>) => void
  readonly aoEscolherPdf: () => void
}): JSX.Element {
  return (
    <>
      {linha.mes === ''
        ? null
        : <div className="g-l13 g-fraco" style={{ gridColumn: '1 / -1' }}>{`${linha.mes} de 2026`}</div>}
      <Campo rotulo="Data" tipo="data" valor={linha.data} span={3} aoMudar={(data) => aoMudar({ data })} />
      <Campo rotulo="Título" valor={linha.titulo} span={6} dica="Título da reunião" aoMudar={(titulo) => aoMudar({ titulo })} />
      <Campo rotulo="Nº" valor={linha.numero} span={2} mono dica="001/2026" aoMudar={(numero) => aoMudar({ numero })} />
      <div className="g-campo-acao" style={{ gridColumn: 'span 1' }}>
        <Botao
          nome={linha.pdf === null ? 'Anexar o PDF assinado' : `PDF escolhido: ${linha.pdf.name}`}
          antes={linha.pdf === null ? CloudUpload : Check}
          aoClicar={aoEscolherPdf}
        />
      </div>
    </>
  )
}
