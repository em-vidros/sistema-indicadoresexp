/**
 * A administracao de usuarios, provada pelo efeito e nao pelo UPDATE.
 *
 * Duas provas so valem se atravessarem o sistema inteiro: permissao mudada e
 * conferida lendo `GET /api/sessao` do proprio usuario, e senha trocada e
 * conferida entrando com ela. Um teste que olhasse a tabela passaria com a senha
 * gravada no lugar errado, que e exatamente o erro que o `sign-in/email` castiga
 * com um 401 mudo.
 *
 * Estado: estes testes mexem em usuarios que outros arquivos e `verificar/fase-0.sh`
 * usam. Cada teste que estraga alguma coisa devolve dentro dele mesmo, antes de
 * terminar, e por isso a janela em que o banco fica alterado e de uma requisicao.
 * O `afterAll` continua ali, mas como rede: ele so tem trabalho se um teste morrer
 * no meio, e a senha trocada de um `.env` que ninguem leu e uma reprovacao de
 * `verificar/fase-0.sh` num arquivo que ninguem vai abrir para achar a causa.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ISSUER_SENHA, PROVEDOR_SENHA } from '@ind/auth'
import { exigir } from '@ind/db'
import { pedir, sql } from './ajuda.ts'

const json = { 'content-type': 'application/json' }

type Usuario = {
  usuario: string
  nome: string
  admin: boolean
  baseFixa: string | null
  bases: string[]
  tipos: string[]
}

async function entrar(usuario: string, senha: string): Promise<Response> {
  return await pedir('/api/entrar', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ usuario, senha }),
  })
}

async function cookieDe(usuario: string, senha: string): Promise<string> {
  const resposta = await entrar(usuario, senha)
  if (resposta.status !== 200) {
    throw new Error(`login de ${usuario} falhou com ${resposta.status}`)
  }
  return resposta.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

const cookieAdmin = () => cookieDe('livia', exigir('SENHA_LIVIA'))

async function listar(cookie: string): Promise<Usuario[]> {
  const resposta = await pedir('/api/usuarios', { headers: { cookie } })
  expect(resposta.status).toBe(200)
  return (await resposta.json()) as Usuario[]
}

async function salvar(cookie: string, corpo: unknown): Promise<Response> {
  return await pedir('/api/usuarios', {
    method: 'PUT',
    headers: { cookie, ...json },
    body: JSON.stringify(corpo),
  })
}

async function sessaoCom(cookie: string): Promise<Usuario> {
  const resposta = await pedir('/api/sessao', { headers: { cookie } })
  expect(resposta.status).toBe(200)
  return (await resposta.json()) as Usuario
}

const achar = (lista: Usuario[], usuario: string): Usuario =>
  lista.find((u) => u.usuario === usuario)!

/**
 * O id interno, lido pelo e-mail e nao montado a mao a partir do login.
 *
 * As tres consultas diretas deste arquivo sao SQL cru pelo `postgres`, e nao query
 * builder: `apps/server` nao depende de `drizzle-orm`, e por a dependencia no
 * `package.json` so para o teste montar duas linhas de `account` seria pagar caro
 * por pouco.
 */
async function idDe(usuario: string): Promise<string> {
  const linhas = await sql`select id from "user" where email = ${`${usuario}@emvidros.com.br`}`
  const linha = linhas[0]
  if (!linha) throw new Error(`usuario '${usuario}' nao existe no banco`)
  return linha['id'] as string
}

let original: Usuario[] = []

beforeAll(async () => {
  original = await listar(await cookieAdmin())
})

afterAll(async () => {
  const cookie = await cookieAdmin()
  const resposta = await salvar(
    cookie,
    original
      .filter((u) => !u.admin)
      .map((u) => ({
        usuario: u.usuario,
        nome: u.nome,
        senha: exigir(`SENHA_${u.usuario.toUpperCase()}`),
        bases: u.bases,
        tipos: u.tipos,
      })),
  )
  if (resposta.status !== 200) {
    throw new Error(`restauracao falhou com ${resposta.status}: ${await resposta.text()}`)
  }
})

describe('quem nao e admin', () => {
  test('recebe 403 nas duas rotas, mesmo com sessao valida', async () => {
    const cookie = await cookieDe('andreina', exigir('SENHA_ANDREINA'))

    const leitura = await pedir('/api/usuarios', { headers: { cookie } })
    expect(leitura.status).toBe(403)
    expect(await leitura.json()).toEqual({ erro: 'somente administrador' })

    const escrita = await salvar(cookie, [{ usuario: 'andreina', nome: 'Eu Mesma' }])
    expect(escrita.status).toBe(403)
    expect(await escrita.json()).toEqual({ erro: 'somente administrador' })
  })
})

describe('GET /api/usuarios', () => {
  test('devolve os quatro, em ordem, com bases e tipos', async () => {
    const lista = await listar(await cookieAdmin())

    expect(lista.map((u) => u.usuario)).toEqual(['andreina', 'belem', 'livia', 'lucascunha'])

    expect(achar(lista, 'livia')).toEqual({
      usuario: 'livia',
      nome: 'Livia (Admin)',
      admin: true,
      baseFixa: null,
      bases: ['Belém', 'Imperatriz', 'Raposa'],
      tipos: ['abastecimento', 'manutencao', 'quebra', 'viagem'],
    })

    expect(achar(lista, 'lucascunha')).toEqual({
      usuario: 'lucascunha',
      nome: 'Lucas Cunha',
      admin: false,
      baseFixa: 'Imperatriz',
      bases: ['Imperatriz'],
      tipos: ['abastecimento', 'manutencao', 'quebra', 'viagem'],
    })
  })

  // O id interno nao tem uso no navegador, e a tela de administracao lista todo
  // mundo: um campo a mais aqui vaza para quatro cartoes de uma vez.
  test('nao devolve o usuarioId que a rota de sessao devolve', async () => {
    const lista = await listar(await cookieAdmin())
    for (const u of lista) {
      expect(Object.keys(u).sort()).toEqual(
        ['admin', 'baseFixa', 'bases', 'nome', 'tipos', 'usuario'].sort(),
      )
    }
  })
})

/**
 * A base fixa e a que a tela ja deixa selecionada e travada. Tirar ela das bases
 * liberadas grava um operador preso numa base cujo botao some da tela e cuja
 * escrita a fase 2 vai recusar, e ninguem escolheu isso conscientemente: sai da
 * mao de quem desmarcou uma caixa achando que estava tirando permissao a mais.
 */
describe('PUT /api/usuarios: a base fixa nao pode sair das liberadas', () => {
  test('tirar a base fixa das liberadas e 400, e a mensagem diz qual base', async () => {
    const resposta = await salvar(await cookieAdmin(), [
      { usuario: 'lucascunha', nome: 'Lucas Cunha', bases: ['Raposa'], tipos: ['viagem'] },
    ])
    expect(resposta.status).toBe(400)
    expect(((await resposta.json()) as { erro: string }).erro).toContain('Imperatriz')
  })

  test('o 400 da base fixa nao grava nada: nome, bases e tipos ficam como estavam', async () => {
    const cookie = await cookieAdmin()
    const resposta = await salvar(cookie, [
      { usuario: 'lucascunha', nome: 'Nome Que Nao Deve Ficar', bases: ['Belém'], tipos: ['quebra'] },
    ])
    expect(resposta.status).toBe(400)

    const lucas = achar(await listar(cookie), 'lucascunha')
    expect(lucas.nome).toBe('Lucas Cunha')
    expect(lucas.bases).toEqual(['Imperatriz'])
    expect(lucas.tipos).toEqual(['abastecimento', 'manutencao', 'quebra', 'viagem'])
  })

  test('dar uma base a mais, mantendo a fixa, entra e o proprio usuario ve na sessao', async () => {
    const cookie = await cookieAdmin()
    try {
      const resposta = await salvar(cookie, [
        { usuario: 'lucascunha', nome: 'Lucas Cunha', bases: ['Imperatriz', 'Raposa'] },
      ])
      expect(resposta.status).toBe(200)

      expect(achar(await listar(cookie), 'lucascunha').bases).toEqual(['Imperatriz', 'Raposa'])

      const sessao = await sessaoCom(await cookieDe('lucascunha', exigir('SENHA_LUCASCUNHA')))
      expect(sessao.bases).toEqual(['Imperatriz', 'Raposa'])
      // A base fixa e o `admin` nao sao editaveis por esta rota; so as permissoes sao.
      expect(sessao.baseFixa).toBe('Imperatriz')
      expect(sessao.admin).toBe(false)
    } finally {
      await salvar(cookie, [{ usuario: 'lucascunha', nome: 'Lucas Cunha', bases: ['Imperatriz'] }])
    }

    expect(achar(await listar(cookie), 'lucascunha').bases).toEqual(['Imperatriz'])
  })
})

describe('PUT /api/usuarios', () => {
  test('a senha nova entra, a antiga para de entrar, e a antiga volta antes do fim', async () => {
    const cookie = await cookieAdmin()
    const nova = 'senha-nova-do-teste-9f2a'
    const antiga = exigir('SENHA_BELEM')

    try {
      expect((await salvar(cookie, [{ usuario: 'belem', nome: 'Victor', senha: nova }])).status).toBe(200)

      const comNova = await entrar('belem', nova)
      expect(comNova.status).toBe(200)
      expect(comNova.headers.getSetCookie().join(';')).toContain('session')

      expect((await entrar('belem', antiga)).status).toBe(401)
    } finally {
      // Devolvida aqui, e nao no `afterAll`: entre trocar e devolver cabem tres
      // requisicoes, e nao o resto do arquivo.
      await salvar(cookie, [{ usuario: 'belem', nome: 'Victor', senha: antiga }])
    }

    expect((await entrar('belem', antiga)).status).toBe(200)
    expect((await entrar('belem', nova)).status).toBe(401)
  })

  /**
   * A senha so pode cair na linha que o `sign-in/email` le, que e a que casa
   * `user_id`, `provider_id` e `issuer` ao mesmo tempo. Hoje cada usuario tem uma
   * linha so em `account`, entao um `where` so por `user_id` acertaria por sorte.
   * As duas linhas extras tiram a sorte da jogada: uma difere so no `provider_id`,
   * a outra so no `issuer`. Derrubar qualquer uma das tres condicoes leva a senha
   * nova para uma delas.
   */
  test('a senha vai so para a conta que o login le, e nao para as outras do mesmo usuario', async () => {
    const cookie = await cookieAdmin()
    const id = await idDe('andreina')
    const MARCA = 'hash-que-nenhum-update-desta-rota-pode-encostar'
    const extras = [
      {
        id: `teste_outro_provedor_${id}`,
        issuer: ISSUER_SENHA,
        account_id: `teste_outro_provedor_${id}`,
        provider_id: 'teste-outro-provedor',
        user_id: id,
        password: MARCA,
      },
      {
        id: `teste_outro_issuer_${id}`,
        issuer: 'teste:outro-issuer',
        account_id: id,
        provider_id: PROVEDOR_SENHA,
        user_id: id,
        password: MARCA,
      },
    ]
    const idsExtras = extras.map((e) => e.id)
    const antiga = exigir('SENHA_ANDREINA')
    const nova = 'senha-nova-da-andreina-4c71'

    await sql`insert into account ${sql(extras)}`
    try {
      expect((await salvar(cookie, [{ usuario: 'andreina', nome: 'Andreina', senha: nova }])).status).toBe(200)

      const depois = await sql`select id, password from account where id in ${sql(idsExtras)}`
      expect(depois).toHaveLength(2)
      for (const linha of depois) expect(linha['password']).toBe(MARCA)

      expect((await entrar('andreina', nova)).status).toBe(200)
    } finally {
      await salvar(cookie, [{ usuario: 'andreina', nome: 'Andreina', senha: antiga }])
      await sql`delete from account where id in ${sql(idsExtras)}`
    }

    expect((await entrar('andreina', antiga)).status).toBe(200)
  })

  test('senha vazia e entrada invalida, e nao um pedido para apagar a senha', async () => {
    const resposta = await salvar(await cookieAdmin(), [
      { usuario: 'andreina', nome: 'Andreina', senha: '' },
    ])
    expect(resposta.status).toBe(400)
    expect((await entrar('andreina', exigir('SENHA_ANDREINA'))).status).toBe(200)
  })

  test('usuario que nao existe e 400, e o resto do mesmo corpo nao e aplicado', async () => {
    const cookie = await cookieAdmin()
    const resposta = await salvar(cookie, [
      { usuario: 'andreina', nome: 'Nome Que Nao Deve Ficar' },
      { usuario: 'ninguem', nome: 'Fantasma' },
    ])
    expect(resposta.status).toBe(400)

    const lista = await listar(cookie)
    expect(achar(lista, 'andreina').nome).toBe('Andreina')
    expect(lista.map((u) => u.usuario)).not.toContain('ninguem')
  })

  test('base que nao existe e 400, e nada e aplicado', async () => {
    const cookie = await cookieAdmin()
    const resposta = await salvar(cookie, [
      { usuario: 'andreina', nome: 'Outro Nome', bases: ['Macapá'], tipos: ['viagem'] },
    ])
    expect(resposta.status).toBe(400)

    const andreina = achar(await listar(cookie), 'andreina')
    expect(andreina.nome).toBe('Andreina')
    expect(andreina.bases).toEqual(['Raposa'])
  })

  /**
   * O unico erro que estoura depois de a transacao ja ter escrito. Os outros tres
   * testes de 400 param na pre-validacao, antes do primeiro UPDATE: eles passam do
   * mesmo jeito se cada escrita for direto no `db`, fora da transacao. Este nao.
   *
   * Sem conta de senha, a andreina do inicio do corpo ja teve o nome gravado quando
   * o belem estoura. Nome antigo de volta significa ROLLBACK.
   */
  test('erro depois da primeira escrita desfaz a primeira escrita', async () => {
    const cookie = await cookieAdmin()
    const idBelem = await idDe('belem')

    const contas = await sql`delete from account where user_id = ${idBelem} returning *`
    expect(contas.length).toBeGreaterThan(0)
    try {
      const resposta = await salvar(cookie, [
        { usuario: 'andreina', nome: 'Nome Que A Transacao Desfaz' },
        { usuario: 'belem', nome: 'Victor', senha: 'senha-que-nao-chega-a-ser-gravada' },
      ])
      expect(resposta.status).toBe(500)

      expect(achar(await listar(cookie), 'andreina').nome).toBe('Andreina')
    } finally {
      await sql`insert into account ${sql(contas as unknown as Record<string, unknown>[])}`
    }

    expect((await entrar('belem', exigir('SENHA_BELEM'))).status).toBe(200)
  })

  test('`admin` e `baseFixa` no corpo nao promovem nem mudam a base de ninguem', async () => {
    const cookie = await cookieAdmin()
    const resposta = await salvar(cookie, [
      {
        usuario: 'andreina',
        nome: 'Andreina',
        admin: true,
        baseFixa: 'Belém',
        bases: ['Raposa'],
        tipos: ['viagem', 'quebra'],
      },
    ])
    expect(resposta.status).toBe(200)

    const andreina = achar(await listar(cookie), 'andreina')
    expect(andreina.admin).toBe(false)
    expect(andreina.baseFixa).toBe('Raposa')
    expect(andreina.tipos).toEqual(['quebra', 'viagem'])
  })

  test('admin nao tem permissao editavel: bases e tipos que chegam para ele sao ignorados', async () => {
    const cookie = await cookieAdmin()
    const resposta = await salvar(cookie, [
      { usuario: 'livia', nome: 'Livia (Admin)', bases: ['Raposa'], tipos: ['viagem'] },
    ])
    expect(resposta.status).toBe(200)

    const livia = achar(await listar(cookie), 'livia')
    expect(livia.bases).toEqual(['Belém', 'Imperatriz', 'Raposa'])
    expect(livia.tipos).toEqual(['abastecimento', 'manutencao', 'quebra', 'viagem'])
  })
})
