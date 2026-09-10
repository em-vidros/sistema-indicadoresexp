/**
 * `semear` nao conhece o better-auth. As duas constantes que identificam a conta de
 * senha chegam em `Deps`, que e o padrao que o `arquitetura.md` escolheu no lugar
 * de repositorio por tabela ("os casos de uso recebem as funcoes de que precisam
 * num objeto `Deps`, tipado estruturalmente"). Isso e o que mantem a cerca verde:
 * `packages/db/src/**` nao pode importar `@ind/auth`, e quem liga os dois e o
 * entrypoint `packages/db/semear.ts`, fora de `src/`.
 *
 * Ninguem nasce com senha. Quem nao tem conta de senha ganha um link de primeiro
 * acesso, que o entrypoint imprime; quem ja definiu a dele nao ganha nada, e por
 * isso rodar o seed de novo nao derruba ninguem.
 *
 * Rodar duas vezes deixa o banco no mesmo estado. Nao ha TRUNCATE: cada tabela entra
 * por `onConflictDoUpdate`, e o alvo do conflito e sempre a chave primaria, porque
 * todos os ids sao derivados por UUIDv5 da chave natural da linha. Id estavel entre
 * maquinas e entre execucoes tambem e o que deixa as FKs sobreviverem ao segundo
 * `bun run db:seed`.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './index.ts'
import { criarConvite } from './consultas/convites.ts'
import { apagarUsuariosForaDe, emailDe, idDeUsuario } from './consultas/usuarios.ts'
import {
  account,
  base,
  colaborador,
  documento,
  documentoVeiculo,
  funcaoColaborador,
  itemPreventivo,
  meta,
  papelUsuario,
  parametro,
  politicaDocumento,
  programaAtividade,
  programaCriterio,
  programaIntegracao,
  programaSemana,
  rota,
  tipoPreventivo,
  tipoRegistro,
  user,
  usuarioBase,
  usuarioTipo,
  veiculo,
} from './schema/index.ts'

// ---------------------------------------------------------------------------
// ids deterministicos
// ---------------------------------------------------------------------------

// UUIDv5 sobre um namespace fixo deste projeto. A alternativa era `defaultRandom()`
// mais conflito na chave natural, que funciona em quase tudo menos em `colaborador`:
// aquela tabela nao tem UNIQUE nenhum (duas pessoas podem se chamar igual), entao
// nao existe alvo de conflito e a segunda execucao duplicaria as 31 linhas.
const NAMESPACE = 'b0a9b2d6-2c3f-5f6a-9d21-6f3c8a1e4b70'

function uuid5(chave: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex')
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(chave, 'utf8')])).digest()
  const b = h.subarray(0, 16)
  b[6] = (b[6]! & 0x0f) | 0x50
  b[8] = (b[8]! & 0x3f) | 0x80
  const s = b.toString('hex')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

const id = (tabela: string, ...partes: string[]) => uuid5(`${tabela} ${partes.join(' ')}`)

/**
 * `excluded` e a linha que o INSERT tentou gravar e o conflito recusou. Escrever o
 * `set` do `onConflictDoUpdate` contra ela e o que torna a segunda execucao uma
 * atualizacao em vez de um erro de unicidade, sem TRUNCATE e sem apagar nada. O nome
 * vai cru porque e o da coluna no banco, nao o do campo no TypeScript.
 */
const sqlExcluded = (coluna: string) => sql.raw(`excluded."${coluna}"`)

type Funcao = (typeof funcaoColaborador.enumValues)[number]

const CADASTRO_INICIAL = fileURLToPath(new URL('../cadastro-inicial.json', import.meta.url))

const Preventiva = z.object({
  tipo: z.string(),
  intervalo_km: z.number(),
  alerta_km: z.number(),
  ultimo_km: z.number().nullable().optional(),
  obs: z.string().optional(),
})

const Atividade = z.object({ id: z.string(), titulo: z.string(), desc: z.string() })

const Programa = z.object({
  funcao: z.string(),
  semanas: z.array(z.object({ titulo: z.string(), atividades: z.array(Atividade) })),
  matriz: z.array(z.object({ criterio: z.string(), padrao: z.string(), freq: z.string() })),
})

const CadastroInicial = z.object({
  atas: z.object({
    COLABORADORES: z.record(
      z.enum(['motorista', 'ajudante', 'atendimento', 'logistica']),
      z.array(z.string()),
    ),
  }),
  documentos: z.object({
    DOCS_ESTATICOS: z.record(
      z.string(),
      z.object({
        seguradora: z.string(),
        apolice_url: z.string(),
        apolice_venc: z.string(),
        tacografo_url: z.string(),
      }),
    ),
    MANUAIS_RAPOSA: z.array(
      z.object({
        titulo: z.string(),
        marca: z.string(),
        modelos: z.string(),
        placas: z.string(),
        url: z.string(),
      }),
    ),
    PLANOS: z.array(
      z.object({ titulo: z.string(), descricao: z.string(), url: z.string(), tipo: z.string() }),
    ),
    VEICULOS_INFO: z.record(
      z.string(),
      z.object({ modelo: z.string(), marca: z.string(), ano: z.string() }),
    ),
  }),
  registros: z.object({
    MOTORISTAS_BELEM: z.array(z.string()),
    MOTORISTAS_IMPERATRIZ: z.array(z.string()),
    MOTORISTAS_RAPOSA: z.array(z.string()),
    ROTAS_BELEM: z.array(z.string()),
    ROTAS_IMPERATRIZ: z.array(z.string()),
    ROTAS_LOCAIS: z.array(z.string()),
    ROTAS_RAPOSA: z.array(z.string()),
    VEICULOS_BELEM: z.array(z.string()),
    VEICULOS_IMPERATRIZ: z.array(z.string()),
    VEICULOS_RAPOSA: z.array(z.string()),
  }),
  integracoes: z.object({
    COLABORADORES: z.record(
      z.string(),
      z.array(z.object({ nome: z.string(), cargo: z.string(), admissao: z.string() })),
    ),
    INTEGRACOES: z.record(z.enum(['motorista', 'ajudante']), Programa),
  }),
  preventiva: z.object({
    CONFIG_PADRAO_RAPOSA: z.record(z.string(), z.array(Preventiva)),
    TIPOS_PREVENTIVA_PADRAO: z.array(Preventiva),
    ULTIMO_KM_PGQ: z.record(z.string(), z.number()),
  }),
})

export type CadastroInicial = z.infer<typeof CadastroInicial>

export function carregarCadastroInicial(caminho = CADASTRO_INICIAL): CadastroInicial {
  const lido = CadastroInicial.safeParse(JSON.parse(readFileSync(caminho, 'utf8')))
  if (!lido.success) {
    throw new Error(`Cadastro inicial inválido em ${caminho}.\n${z.prettifyError(lido.error)}`)
  }
  return lido.data
}

// ---------------------------------------------------------------------------
// o que fica decidido aqui, e nao nas constantes
// ---------------------------------------------------------------------------

/**
 * Os quatro limiares de KPI. Sao a unica parte do seed que nao sai de constante
 * nomeada, porque no dashboard eles estao embutidos nas condicionais que pintam o
 * card (linhas 394, 404, 414 e 431 de `dashboard-semanal.html`), com valores que
 * divergem entre o card, a tabela de rotas e o texto do WhatsApp.
 * `docs/planos/arquitetura.md`, secao "os valores que estavam em aberto", decidiu
 * por um par so: o do card, que e a superficie que a Livia olha.
 *
 * A ordem `(limiteOk, limiteAtencao)` obedece ao `meta_limite_ck` do schema e ao
 * `Limiar` do dominio: em `menor_melhor`, atencao >= ok.
 */
const METAS = [
  { chave: 'custo_carga', direcao: 'menor_melhor', limiteOk: '7', limiteAtencao: '9' },
  { chave: 'quebra', direcao: 'menor_melhor', limiteOk: '1', limiteAtencao: '2' },
  { chave: 'manutencao_producao', direcao: 'menor_melhor', limiteOk: '2', limiteAtencao: '3' },
  // O unico com duas faixas: a linha 431 do dashboard usa `<=` e nao tem vermelho.
  { chave: 'atraso', direcao: 'menor_melhor', limiteOk: '5', limiteAtencao: null },
] as const

/**
 * Quem existe no sistema quando ele nasce. Os dois sao admin, e nenhum dos dois
 * nasce com senha: o seed gera um link de primeiro acesso e cada um escolhe a
 * dela.
 *
 * As tres bases sao derivadas destas listas `bases`, e o id de cada uma e o UUIDv5
 * do nome. Manter os tres nomes exatos nos dois nao e zelo: base com id novo deixa
 * veiculo, rota e registro apontando para uma linha que nao existe mais.
 */
const USUARIOS_INICIAIS = {
  henrique: {
    nome: 'Henrique Martins',
    papel: 'admin',
    base: null,
    bases: ['Raposa', 'Imperatriz', 'Belém'],
    tipos: ['viagem', 'abastecimento', 'manutencao', 'quebra'],
  },
  livia: {
    nome: 'Livia',
    papel: 'admin',
    base: null,
    bases: ['Raposa', 'Imperatriz', 'Belém'],
    tipos: ['viagem', 'abastecimento', 'manutencao', 'quebra'],
  },
} as const satisfies Record<string, UsuarioInicial>

type UsuarioInicial = {
  nome: string
  papel: (typeof papelUsuario.enumValues)[number]
  /** A base travada. `null` em quem ve todas, que o CHECK do banco exige. */
  base: string | null
  bases: readonly string[]
  tipos: readonly (typeof tipoRegistro.enumValues)[number][]
}

/**
 * Escalar sem direcao e sem faixa nao e meta. Vive em `parametro`, por decisao do arquitetura.md.
 *
 * So entra aqui o que tem fonte nos HTMLs. `upload_max_mb` vale 6 porque
 * `documentos-frota.html` recusa acima de 6 MB em dois pontos e `ata-reuniao.html`
 * recusa acima de 4 MB em dois pontos: o maior teto real vence. O maior PDF do
 * parque tem 1,66 MB. A tolerancia de pontualidade nao entra: a origem usa
 * `<select>` manual e nenhum numero real existe para ela.
 */
const PARAMETROS = [
  {
    chave: 'upload_max_mb',
    valor: '6',
    descricao: 'Teto de tamanho de arquivo enviado, em MB. O maior PDF do parque tem 1,66 MB.',
  },
] as const

// `—` no lugar do modelo, da marca ou do ano nao e dado, e um travessao de tela.
// Gravar a string faria `modelo = '—'` aparecer em relatorio e em filtro.
const semDado = (v: string): string | null => {
  const t = v.trim()
  return t === '' || t === '—' || t === '-' ? null : t
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// ---------------------------------------------------------------------------
// as deps
// ---------------------------------------------------------------------------

/**
 * O seed nao hasheia senha nenhuma, porque nao grava senha nenhuma. O par
 * `(providerId, issuer)` continua aqui para a outra pergunta: quem ja tem conta de
 * senha, e portanto nao precisa de convite novo.
 */
export type DepsSeed = {
  /** `account.provider_id` que o `sign-in/email` exige. */
  provedorSenha: string
  /** `account.issuer` que o `sign-in/email` exige, hoje `local:credential`. */
  issuerSenha: string
  agora?: Date
}

/** O link de primeiro acesso de quem ainda nao tem senha. `semear.ts` imprime. */
export type ConviteDoSeed = { usuario: string; url: string; expiraEm: Date }

export type ResultadoSeed = { contagens: Contagens; convites: ConviteDoSeed[] }

export type Contagens = {
  bases: number
  veiculos: number
  colaboradores: number
  rotas: number
  tiposPreventiva: number
  usuarios: number
  metas: number
  programas: number
  atividades: number
  /** Quantos usuarios saíram por nao estarem em `USUARIOS_INICIAIS`. */
  apagados: number
}

// ---------------------------------------------------------------------------
// semear
// ---------------------------------------------------------------------------

/** O que `db.transaction` entrega ao callback. Mesmo `insert`, dentro da transacao. */
type Escritor = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Tudo ou nada. Sem a transacao, um seed que estoura no meio deixa as tabelas de
 * cima gravadas e as de baixo vazias, e a proxima execucao pode nem conseguir se
 * recuperar: se a chave derivada mudar entre uma tentativa e outra, o `ON CONFLICT
 * (id)` nao acha a linha velha e o UNIQUE da chave natural recusa a nova.
 */
export function semear(db: Db, deps: DepsSeed, c = carregarCadastroInicial()): Promise<ResultadoSeed> {
  return db.transaction((tx) => semearEm(tx, deps, c))
}

/**
 * O corpo, contra um escritor que ja e a transacao. Exportado para o teste de
 * idempotencia poder rodar o seed duas vezes dentro de uma transacao que ele mesmo
 * desfaz no fim, em vez de gravar no banco de verdade para depois limpar.
 */
export async function semearEm(
  db: Escritor,
  deps: DepsSeed,
  c: CadastroInicial,
): Promise<ResultadoSeed> {
  const agora = deps.agora ?? new Date()
  const form = c.registros

  // --- bases -------------------------------------------------------------
  // Nao existe constante BASES em lugar nenhum dos 7 HTMLs. O que existe e a lista
  // de bases de cada usuario, e a de quem ve todas e o conjunto inteiro. Derivar
  // dali evita a unica lista digitada a mao que ainda faltava, e e por isso que os
  // tres nomes em USUARIOS_INICIAIS nao podem mudar: o id da base e o UUIDv5 do
  // nome, e nome novo orfana veiculo, rota e registro.
  const nomesBase = [...new Set(Object.values(USUARIOS_INICIAIS).flatMap((u) => u.bases))]
  const idBase = (nome: string) => id('base', nome)
  // O sufixo das constantes (`_RAPOSA`, `_BELEM`) e o nome da base sem acento e em
  // caixa alta. `Belém` -> `BELEM`.
  const porSufixo = new Map(nomesBase.map((n) => [semAcento(n).toUpperCase(), n]))
  const baseDoSufixo = (sufixo: string): string => {
    const nome = porSufixo.get(sufixo)
    if (!nome) throw new Error(`sufixo ${sufixo} nao casa com nenhuma base de USUARIOS_INICIAIS`)
    return nome
  }

  await db
    .insert(base)
    .values(nomesBase.map((nome) => ({ id: idBase(nome), nome })))
    .onConflictDoUpdate({ target: base.id, set: { ativo: true } })

  // --- veiculos ----------------------------------------------------------
  const info = c.documentos.VEICULOS_INFO
  const veiculos = (['RAPOSA', 'IMPERATRIZ', 'BELEM'] as const).flatMap((sufixo) =>
    form[`VEICULOS_${sufixo}`].map((placa) => {
      const i = info[placa]
      return {
        id: id('veiculo', placa),
        placa,
        // 8 das 15 placas chegam com `—` nos tres campos: nao ha ficha delas hoje.
        modelo: i ? semDado(i.modelo) : null,
        marca: i ? semDado(i.marca) : null,
        // Texto, e nao inteiro: a origem traz "2019/2020".
        ano: i ? semDado(i.ano) : null,
        baseId: idBase(baseDoSufixo(sufixo)),
      }
    }),
  )
  await db
    .insert(veiculo)
    .values(veiculos)
    .onConflictDoUpdate({
      target: veiculo.id,
      set: {
        modelo: sqlExcluded('modelo'),
        marca: sqlExcluded('marca'),
        ano: sqlExcluded('ano'),
        baseId: sqlExcluded('base_id'),
        ativo: true,
      },
    })

  // --- colaboradores -----------------------------------------------------
  // Os dois cadastros de pessoa cobrem populacoes diferentes, e o seed UNE em vez de
  // escolher. O `COLABORADORES` da ata e da Expedicao Raposa e tem as quatro funcoes
  // (22 pessoas, entre elas as 3 de atendimento e logistica que so existem ali). As
  // listas `MOTORISTAS_*` do formulario tem os 8 motoristas de Imperatriz e o
  // Severino de Belem, que nao estao em nenhum dos dois `COLABORADORES`. Os 8 da
  // Raposa aparecem nos dois e a uniao os conta uma vez. 22 + 9 = 31.
  const fichas = new Map(
    Object.values(c.integracoes.COLABORADORES)
      .flat()
      .map((p) => [p.nome, p]),
  )

  const pessoas = new Map<string, { nome: string; funcao: Funcao; baseNome: string }>()
  const juntar = (nome: string, funcao: Funcao, baseNome: string) => {
    if (!pessoas.has(nome)) pessoas.set(nome, { nome, funcao, baseNome })
  }
  for (const [funcao, nomes] of Object.entries(c.atas.COLABORADORES)) {
    for (const nome of nomes ?? []) juntar(nome, funcao as Funcao, baseDoSufixo('RAPOSA'))
  }
  for (const sufixo of ['RAPOSA', 'IMPERATRIZ', 'BELEM'] as const) {
    for (const nome of form[`MOTORISTAS_${sufixo}`]) {
      juntar(nome, 'motorista', baseDoSufixo(sufixo))
    }
  }

  const colaboradores = [...pessoas.values()].map((p) => {
    const ficha = fichas.get(p.nome)
    return {
      id: id('colaborador', p.nome),
      nome: p.nome,
      cargo: ficha?.cargo ?? null,
      funcao: p.funcao,
      admissao: ficha?.admissao ?? null,
      baseId: idBase(p.baseNome),
    }
  })
  await db
    .insert(colaborador)
    .values(colaboradores)
    .onConflictDoUpdate({
      target: colaborador.id,
      set: {
        cargo: sqlExcluded('cargo'),
        funcao: sqlExcluded('funcao'),
        admissao: sqlExcluded('admissao'),
        baseId: sqlExcluded('base_id'),
        ativo: true,
      },
    })

  // --- documentos que ja acompanham o sistema --------------------------
  // Os caminhos continuam sob /docs e passam pelo mesmo portao de sessao das
  // paginas. A fase 2 troca apenas os novos uploads por armazenamento privado.
  const documentosOrigem = c.documentos
  const documentosVeiculo = Object.entries(documentosOrigem.DOCS_ESTATICOS).flatMap(
    ([placa, ficha]) => [
      {
        id: id('documento', 'apolice', placa),
        tipo: 'apolice' as const,
        titulo: `Apólice ${placa}`,
        vencimento: ficha.apolice_venc,
        linkExterno: ficha.apolice_url,
        veiculoId: id('veiculo', placa),
        seguradora: ficha.seguradora,
      },
      {
        id: id('documento', 'tacografo', placa),
        tipo: 'tacografo' as const,
        titulo: `Tacógrafo ${placa}`,
        linkExterno: ficha.tacografo_url,
        veiculoId: id('veiculo', placa),
      },
    ],
  )
  const manuais = documentosOrigem.MANUAIS_RAPOSA.map((manual) => ({
    id: id('documento', 'manual', manual.titulo),
    tipo: 'manual' as const,
    titulo: manual.titulo,
    descricao: `${manual.marca} · ${manual.modelos}`,
    linkExterno: manual.url,
  }))
  const planos = documentosOrigem.PLANOS.map((plano) => ({
    id: id('documento', 'plano_pgq', plano.titulo),
    tipo: 'plano_pgq' as const,
    titulo: plano.titulo,
    descricao: plano.descricao,
    linkExterno: plano.url,
    baseId: idBase(baseDoSufixo('RAPOSA')),
  }))
  const documentosIniciais = [...documentosVeiculo, ...manuais, ...planos]
  await db
    .insert(documento)
    .values(documentosIniciais)
    .onConflictDoUpdate({
      target: documento.id,
      set: {
        titulo: sqlExcluded('titulo'),
        descricao: sqlExcluded('descricao'),
        vencimento: sqlExcluded('vencimento'),
        linkExterno: sqlExcluded('link_externo'),
        veiculoId: sqlExcluded('veiculo_id'),
        baseId: sqlExcluded('base_id'),
        seguradora: sqlExcluded('seguradora'),
      },
    })

  const manuaisVeiculos = documentosOrigem.MANUAIS_RAPOSA.flatMap((manual) =>
    manual.placas.split(',').map((placa) => ({
      documentoId: id('documento', 'manual', manual.titulo),
      tipo: 'manual' as const,
      veiculoId: id('veiculo', placa.trim()),
    })),
  )
  await db.insert(documentoVeiculo).values(manuaisVeiculos).onConflictDoNothing()
  // Janelas de alerta reais de `documentos-frota.html`: 30 dias para tacografo e 60
  // para os demais com vencimento. Manual e plano_pgq nao entram porque nunca têm
  // vencimento e nenhum numero real existe para eles.
  await db
    .insert(politicaDocumento)
    .values([
      { tipo: 'apolice', alertaDias: 60 },
      { tipo: 'crlv', alertaDias: 60 },
      { tipo: 'tacografo', alertaDias: 30 },
      { tipo: 'cnh', alertaDias: 60 },
    ])
    .onConflictDoNothing()

  // --- rotas -------------------------------------------------------------
  // 22 linhas para 20 nomes: BELEM e SALINOPOLIS existem em duas bases ao mesmo
  // tempo. `rota` e UNIQUE (nome, base_id), e deduplicar por nome apagaria duas.
  const locais = new Set(form.ROTAS_LOCAIS)
  const rotas = (['RAPOSA', 'IMPERATRIZ', 'BELEM'] as const).flatMap((sufixo) => {
    const baseNome = baseDoSufixo(sufixo)
    return form[`ROTAS_${sufixo}`].map((nome) => ({
      id: id('rota', nome, baseNome),
      nome,
      baseId: idBase(baseNome),
      // O booleano que hoje decide se o toggle de viagem longa aparece.
      local: locais.has(nome),
    }))
  })
  await db
    .insert(rota)
    .values(rotas)
    .onConflictDoUpdate({
      target: rota.id,
      set: { local: sqlExcluded('local'), ativo: true },
    })

  // --- tipos de preventiva -----------------------------------------------
  // O catalogo. A Lavagem alerta em 200 aqui e em 300 no `item_preventivo` da
  // Raposa: nao e conflito, e nivel. O catalogo e o padrao, a base sobrepoe.
  const tipos = c.preventiva.TIPOS_PREVENTIVA_PADRAO.map((t) => ({
    id: id('tipo_preventivo', t.tipo),
    nome: t.tipo,
    intervaloKm: t.intervalo_km,
    alertaKm: t.alerta_km,
  }))
  await db
    .insert(tipoPreventivo)
    .values(tipos)
    .onConflictDoUpdate({
      target: tipoPreventivo.id,
      set: { intervaloKm: sqlExcluded('intervalo_km'), alertaKm: sqlExcluded('alerta_km') },
    })

  // --- itens de preventiva da Raposa -------------------------------------
  // `ULTIMO_KM_PGQ` cobre 5 das 7 placas. As outras duas ficam com `ultimo_km` nulo,
  // e `statusPreventiva` do dominio le isso como "sem_dado", que e a verdade.
  const pgq = c.preventiva.ULTIMO_KM_PGQ
  const itens = Object.entries(c.preventiva.CONFIG_PADRAO_RAPOSA).flatMap(
    ([placa, lista]) =>
      lista.map((i) => ({
        id: id('item_preventivo', placa, i.tipo),
        veiculoId: id('veiculo', placa),
        tipoPreventivoId: id('tipo_preventivo', i.tipo),
        intervaloKm: i.intervalo_km,
        alertaKm: i.alerta_km,
        ultimoKm: pgq[placa] ?? null,
        obs: i.obs ?? null,
      })),
  )
  await db
    .insert(itemPreventivo)
    .values(itens)
    .onConflictDoUpdate({
      target: itemPreventivo.id,
      set: {
        intervaloKm: sqlExcluded('intervalo_km'),
        alertaKm: sqlExcluded('alerta_km'),
        ultimoKm: sqlExcluded('ultimo_km'),
        obs: sqlExcluded('obs'),
        atualizadoEm: agora,
      },
    })

  // --- metas e parametros ------------------------------------------------
  await db
    .insert(meta)
    .values(METAS.map((m) => ({ ...m })))
    .onConflictDoUpdate({
      target: meta.chave,
      set: {
        direcao: sqlExcluded('direcao'),
        limiteOk: sqlExcluded('limite_ok'),
        limiteAtencao: sqlExcluded('limite_atencao'),
      },
    })

  await db
    .insert(parametro)
    .values(PARAMETROS.map((p) => ({ ...p })))
    .onConflictDoUpdate({
      target: parametro.chave,
      set: { valor: sqlExcluded('valor'), descricao: sqlExcluded('descricao') },
    })

  // --- programas de integracao -------------------------------------------
  // 47 atividades, 23 do motorista e 24 do ajudante. A semana 5 do motorista tem 2 e
  // nao 3: `m5c` nao existe em integracao-frota.html, e completar a serie seria
  // inventar uma atividade que ninguem escreveu.
  const programas = Object.entries(c.integracoes.INTEGRACOES)
  await db
    .insert(programaIntegracao)
    .values(
      programas.map(([funcao, p]) => ({
        id: id('programa_integracao', funcao),
        funcao: funcao as Funcao,
        titulo: p.funcao,
      })),
    )
    .onConflictDoUpdate({
      target: programaIntegracao.id,
      set: { titulo: sqlExcluded('titulo'), ativo: true },
    })

  const semanas = programas.flatMap(([funcao, p]) =>
    p.semanas.map((s, i) => ({
      id: id('programa_semana', funcao, String(i + 1)),
      programaId: id('programa_integracao', funcao),
      numero: i + 1,
      titulo: s.titulo,
    })),
  )
  await db
    .insert(programaSemana)
    .values(semanas)
    .onConflictDoUpdate({ target: programaSemana.id, set: { titulo: sqlExcluded('titulo') } })

  const atividades = programas.flatMap(([funcao, p]) =>
    p.semanas.flatMap((s, i) =>
      s.atividades.map((a, j) => ({
        id: id('programa_atividade', a.id),
        semanaId: id('programa_semana', funcao, String(i + 1)),
        codigo: a.id,
        ordem: j + 1,
        titulo: a.titulo,
        descricao: a.desc,
      })),
    ),
  )
  await db
    .insert(programaAtividade)
    .values(atividades)
    .onConflictDoUpdate({
      target: programaAtividade.id,
      set: {
        semanaId: sqlExcluded('semana_id'),
        codigo: sqlExcluded('codigo'),
        ordem: sqlExcluded('ordem'),
        titulo: sqlExcluded('titulo'),
        descricao: sqlExcluded('descricao'),
      },
    })

  const criterios = programas.flatMap(([funcao, p]) =>
    p.matriz.map((m, i) => ({
      id: id('programa_criterio', funcao, String(i + 1)),
      programaId: id('programa_integracao', funcao),
      ordem: i + 1,
      criterio: m.criterio,
      padrao: m.padrao,
      frequencia: m.freq,
    })),
  )
  await db
    .insert(programaCriterio)
    .values(criterios)
    .onConflictDoUpdate({
      target: programaCriterio.id,
      set: {
        criterio: sqlExcluded('criterio'),
        padrao: sqlExcluded('padrao'),
        frequencia: sqlExcluded('frequencia'),
      },
    })

  // --- usuarios ----------------------------------------------------------
  // Os quatro logins antigos vinham do objeto USUARIOS do HTML, com as senhas em
  // base64 ao lado: elas ja vazaram para quem abriu a pagina. Ninguem nasce com
  // senha agora, entao nao ha o que vazar: o seed grava a pessoa, apaga quem saiu
  // da lista e gera um link de primeiro acesso para quem ainda nao tem conta.
  const chaves = Object.keys(USUARIOS_INICIAIS) as (keyof typeof USUARIOS_INICIAIS)[]
  const usuarios = chaves.map((chave) => {
    const u = USUARIOS_INICIAIS[chave]
    return {
      id: idDeUsuario(chave),
      name: u.nome,
      email: emailDe(chave),
      // Nao ha servidor de e-mail neste app, e exigir verificacao trancaria os dois
      // do lado de fora.
      emailVerified: true,
      papel: u.papel,
      baseId: u.base === null ? null : idBase(u.base),
    }
  })

  // Apagar antes de inserir, e nao depois: se alguem que sai da lista tiver o mesmo
  // e-mail de alguem que entra, o UNIQUE de `user.email` recusaria o INSERT.
  const apagados = await apagarUsuariosForaDe(db, [...chaves])

  await db
    .insert(user)
    .values(usuarios)
    .onConflictDoUpdate({
      target: user.id,
      // `papel` e `base_id` entram no set junto com o resto: sem eles, um usuario
      // que ficou com a permissao errada continuaria errado depois do segundo seed.
      set: {
        name: sqlExcluded('name'),
        email: sqlExcluded('email'),
        papel: sqlExcluded('papel'),
        baseId: sqlExcluded('base_id'),
        updatedAt: agora,
      },
    })

  await db
    .insert(usuarioBase)
    .values(
      chaves.flatMap((chave) =>
        USUARIOS_INICIAIS[chave].bases.map((nome) => ({
          usuarioId: idDeUsuario(chave),
          baseId: idBase(nome),
        })),
      ),
    )
    .onConflictDoNothing()

  await db
    .insert(usuarioTipo)
    .values(
      chaves.flatMap((chave) =>
        USUARIOS_INICIAIS[chave].tipos.map((tipo) => ({ usuarioId: idDeUsuario(chave), tipo })),
      ),
    )
    .onConflictDoNothing()

  // O convite so nasce para quem ainda nao tem conta de senha. E o que faz o
  // segundo `bun run db:seed` nao derrubar a senha de quem ja definiu a dele, e o
  // que faz esta parte do seed ser idempotente como o resto.
  const comSenha = new Set(
    (
      await db
        .select({ usuarioId: account.userId })
        .from(account)
        .where(
          and(
            eq(account.providerId, deps.provedorSenha),
            eq(account.issuer, deps.issuerSenha),
            isNotNull(account.password),
          ),
        )
    ).map((linha) => linha.usuarioId),
  )

  const convites: ConviteDoSeed[] = []
  for (const chave of chaves) {
    const usuarioId = idDeUsuario(chave)
    if (comSenha.has(usuarioId)) continue
    const convite = await criarConvite(db, usuarioId, agora)
    convites.push({
      usuario: chave,
      url: `/entrar.html?convite=${convite.token}`,
      expiraEm: convite.expiraEm,
    })
  }

  return {
    contagens: {
      bases: nomesBase.length,
      veiculos: veiculos.length,
      colaboradores: colaboradores.length,
      rotas: rotas.length,
      tiposPreventiva: tipos.length,
      usuarios: usuarios.length,
      metas: METAS.length,
      programas: programas.length,
      atividades: atividades.length,
      apagados,
    },
    convites,
  }
}
