/**
 * O seed do cadastro. Ele nao redigita nome, placa nem rota: le
 * `infra/constantes.json`, que `infra/extrair-constantes.ts` produz varrendo os 7
 * HTMLs de origem. Se o arquivo nao existir, o extrator e chamado antes; se falhar,
 * o seed morre dizendo qual comando rodar.
 *
 * `semear` nao conhece o better-auth. A senha chega como funcao em `Deps`, que e o
 * padrao que o `arquitetura.md` escolheu no lugar de repositorio por tabela ("os
 * casos de uso recebem as funcoes de que precisam num objeto `Deps`, tipado
 * estruturalmente"). Isso e o que mantem a cerca verde: `packages/db/src/**` nao
 * pode importar `@ind/auth`, e quem liga os dois e o entrypoint
 * `packages/db/semear.ts`, fora de `src/`.
 *
 * Rodar duas vezes deixa o banco no mesmo estado. Nao ha TRUNCATE: cada tabela entra
 * por `onConflictDoUpdate`, e o alvo do conflito e sempre a chave primaria, porque
 * todos os ids sao derivados por UUIDv5 da chave natural da linha. Id estavel entre
 * maquinas e entre execucoes tambem e o que deixa as FKs sobreviverem ao segundo
 * `bun run db:seed`.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './index.ts'
import {
  account,
  base,
  colaborador,
  funcaoColaborador,
  itemPreventivo,
  meta,
  parametro,
  programaAtividade,
  programaCriterio,
  programaIntegracao,
  programaSemana,
  rota,
  tipoPreventivo,
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

// ---------------------------------------------------------------------------
// as constantes de origem
// ---------------------------------------------------------------------------

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url))
const CONSTANTES = `${RAIZ}infra/constantes.json`

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

const Usuario = z.object({
  nome: z.string(),
  bases: z.array(z.string()),
  tipos: z.array(z.enum(['viagem', 'abastecimento', 'manutencao', 'quebra'])),
})

const Constantes = z.object({
  'ata-reuniao.html': z.object({
    COLABORADORES: z.record(
      z.enum(['motorista', 'ajudante', 'atendimento', 'logistica']),
      z.array(z.string()),
    ),
  }),
  'documentos-frota.html': z.object({
    VEICULOS_INFO: z.record(
      z.string(),
      z.object({ modelo: z.string(), marca: z.string(), ano: z.string() }),
    ),
  }),
  'formulario-registro.html': z.object({
    MOTORISTAS_BELEM: z.array(z.string()),
    MOTORISTAS_IMPERATRIZ: z.array(z.string()),
    MOTORISTAS_RAPOSA: z.array(z.string()),
    ROTAS_BELEM: z.array(z.string()),
    ROTAS_IMPERATRIZ: z.array(z.string()),
    ROTAS_LOCAIS: z.array(z.string()),
    ROTAS_RAPOSA: z.array(z.string()),
    USUARIOS: z.record(z.string(), Usuario),
    VEICULOS_BELEM: z.array(z.string()),
    VEICULOS_IMPERATRIZ: z.array(z.string()),
    VEICULOS_RAPOSA: z.array(z.string()),
  }),
  'integracao-frota.html': z.object({
    COLABORADORES: z.record(
      z.string(),
      z.array(z.object({ nome: z.string(), cargo: z.string(), admissao: z.string() })),
    ),
    INTEGRACOES: z.record(z.enum(['motorista', 'ajudante']), Programa),
  }),
  'manutencao-frota.html': z.object({
    CONFIG_PADRAO_RAPOSA: z.record(z.string(), z.array(Preventiva)),
    TIPOS_PREVENTIVA_PADRAO: z.array(Preventiva),
    ULTIMO_KM_PGQ: z.record(z.string(), z.number()),
  }),
})

export type Constantes = z.infer<typeof Constantes>

export function carregarConstantes(caminho = CONSTANTES): Constantes {
  if (!existsSync(caminho)) {
    try {
      execFileSync('bun', ['infra/extrair-constantes.ts'], { cwd: RAIZ, stdio: 'inherit' })
    } catch (erro) {
      throw new Error(
        `${caminho} nao existe e o extrator falhou. Rode 'bun infra/extrair-constantes.ts' na raiz do projeto e leia o erro dele. Causa: ${erro instanceof Error ? erro.message : String(erro)}`,
      )
    }
  }
  if (!existsSync(caminho)) {
    throw new Error(
      `${caminho} continua ausente depois de rodar o extrator. O seed nao inventa nome nem placa: sem esse arquivo nao ha o que semear.`,
    )
  }
  const lido = Constantes.safeParse(JSON.parse(readFileSync(caminho, 'utf8')))
  if (!lido.success) {
    throw new Error(
      `${caminho} nao tem a forma esperada. Rode 'bun infra/extrair-constantes.ts' de novo.\n${z.prettifyError(lido.error)}`,
    )
  }
  return lido.data
}

// ---------------------------------------------------------------------------
// o que fica decidido aqui, e nao nas constantes
// ---------------------------------------------------------------------------

/**
 * Os quatro limiares de KPI. Sao a unica parte do seed que nao sai de constante
 * nomeada, porque no dashboard eles estao embutidos dentro das condicionais que
 * pintam o card, com valores que divergem entre o card, a tabela de rotas e o texto
 * do WhatsApp. `docs/planos/arquitetura.md`, secao "os valores que estavam em
 * aberto", decidiu por um par so: o do card, que e a superficie que a Livia olha.
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

/** Escalar sem direcao e sem faixa nao e meta. Vive em `parametro`, por decisao do arquitetura.md. */
const PARAMETROS = [
  {
    chave: 'pontualidade_tolerancia_min',
    valor: '15',
    descricao: 'Minutos de tolerancia antes de a chegada contar como atraso.',
  },
  {
    chave: 'upload_max_mb',
    valor: '6',
    descricao: 'Teto de tamanho de arquivo enviado, em MB. O maior PDF do parque tem 1,66 MB.',
  },
] as const

const DOMINIO_EMAIL = 'emvidros.com.br'

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

export type DepsSeed = {
  /** O hasher do proprio better-auth. Ver `packages/auth`: o login verifica com ele. */
  hashSenha: (senha: string) => Promise<string>
  /** `account.provider_id` que o `sign-in/email` exige. */
  provedorSenha: string
  /** `account.issuer` que o `sign-in/email` exige, hoje `local:credential`. */
  issuerSenha: string
  /** Uma variavel por usuario, lida do `.env`. As senhas antigas ja vazaram no HTML. */
  senhaDe: (chaveUsuario: string) => string
  agora?: Date
}

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
export function semear(db: Db, deps: DepsSeed, c = carregarConstantes()): Promise<Contagens> {
  return db.transaction((tx) => semearEm(tx, deps, c))
}

/**
 * O corpo, contra um escritor que ja e a transacao. Exportado para o teste de
 * idempotencia poder rodar o seed duas vezes dentro de uma transacao que ele mesmo
 * desfaz no fim, em vez de gravar no banco de verdade para depois limpar.
 */
export async function semearEm(db: Escritor, deps: DepsSeed, c: Constantes): Promise<Contagens> {
  const agora = deps.agora ?? new Date()
  const form = c['formulario-registro.html']
  const USUARIOS = form.USUARIOS

  // --- bases -------------------------------------------------------------
  // Nao existe constante BASES em lugar nenhum dos 7 HTMLs. O que existe e a lista
  // de bases de cada usuario, e a da Livia (admin) e o conjunto inteiro. Derivar
  // dali evita a unica lista digitada a mao que ainda faltava.
  const nomesBase = [...new Set(Object.values(USUARIOS).flatMap((u) => u.bases))]
  const idBase = (nome: string) => id('base', nome)
  // O sufixo das constantes (`_RAPOSA`, `_BELEM`) e o nome da base sem acento e em
  // caixa alta. `Belém` -> `BELEM`.
  const porSufixo = new Map(nomesBase.map((n) => [semAcento(n).toUpperCase(), n]))
  const baseDoSufixo = (sufixo: string): string => {
    const nome = porSufixo.get(sufixo)
    if (!nome) throw new Error(`sufixo ${sufixo} nao casa com nenhuma base de USUARIOS`)
    return nome
  }

  await db
    .insert(base)
    .values(nomesBase.map((nome) => ({ id: idBase(nome), nome })))
    .onConflictDoUpdate({ target: base.id, set: { ativo: true } })

  // --- veiculos ----------------------------------------------------------
  const info = c['documentos-frota.html'].VEICULOS_INFO
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
    Object.values(c['integracao-frota.html'].COLABORADORES)
      .flat()
      .map((p) => [p.nome, p]),
  )

  const pessoas = new Map<string, { nome: string; funcao: Funcao; baseNome: string }>()
  const juntar = (nome: string, funcao: Funcao, baseNome: string) => {
    if (!pessoas.has(nome)) pessoas.set(nome, { nome, funcao, baseNome })
  }
  for (const [funcao, nomes] of Object.entries(c['ata-reuniao.html'].COLABORADORES)) {
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
  const tipos = c['manutencao-frota.html'].TIPOS_PREVENTIVA_PADRAO.map((t) => ({
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
  const pgq = c['manutencao-frota.html'].ULTIMO_KM_PGQ
  const itens = Object.entries(c['manutencao-frota.html'].CONFIG_PADRAO_RAPOSA).flatMap(
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
  const programas = Object.entries(c['integracao-frota.html'].INTEGRACOES)
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
  // As quatro senhas antigas estao em base64 dentro de formulario-registro.html, com
  // um atob() ao lado: ja vazaram para qualquer um que abriu a pagina. O extrator as
  // apaga do JSON, e o seed le uma senha nova por usuario do `.env`. Nenhuma das
  // antigas pode autenticar, e `verificar/fase-0.sh` cobra isso com as quatro.
  const chaves = Object.keys(USUARIOS)
  const usuarios = chaves.map((chave) => ({
    id: `usr_${chave}`,
    name: USUARIOS[chave]!.nome,
    // Minusculo porque o `sign-in/email` procura por `email.toLowerCase()`.
    email: `${chave.toLowerCase()}@${DOMINIO_EMAIL}`,
    emailVerified: true,
  }))
  await db
    .insert(user)
    .values(usuarios)
    .onConflictDoUpdate({
      target: user.id,
      set: { name: sqlExcluded('name'), email: sqlExcluded('email'), updatedAt: agora },
    })

  const contas = await Promise.all(
    chaves.map(async (chave) => ({
      id: `acc_${chave}`,
      // Os tres campos que o `sign-in/email` casa. `accountId` tem que ser o proprio
      // id do usuario; `issuer` e `local:credential` nesta versao do better-auth.
      issuer: deps.issuerSenha,
      accountId: `usr_${chave}`,
      providerId: deps.provedorSenha,
      userId: `usr_${chave}`,
      password: await deps.hashSenha(deps.senhaDe(chave)),
    })),
  )
  await db
    .insert(account)
    .values(contas)
    .onConflictDoUpdate({
      target: account.id,
      set: {
        issuer: sqlExcluded('issuer'),
        accountId: sqlExcluded('account_id'),
        providerId: sqlExcluded('provider_id'),
        password: sqlExcluded('password'),
        updatedAt: agora,
      },
    })

  await db
    .insert(usuarioBase)
    .values(
      chaves.flatMap((chave) =>
        USUARIOS[chave]!.bases.map((nome) => ({ usuarioId: `usr_${chave}`, baseId: idBase(nome) })),
      ),
    )
    .onConflictDoNothing()

  await db
    .insert(usuarioTipo)
    .values(
      chaves.flatMap((chave) =>
        USUARIOS[chave]!.tipos.map((tipo) => ({ usuarioId: `usr_${chave}`, tipo })),
      ),
    )
    .onConflictDoNothing()

  return {
    bases: nomesBase.length,
    veiculos: veiculos.length,
    colaboradores: colaboradores.length,
    rotas: rotas.length,
    tiposPreventiva: tipos.length,
    usuarios: usuarios.length,
    metas: METAS.length,
    programas: programas.length,
    atividades: atividades.length,
  }
}
