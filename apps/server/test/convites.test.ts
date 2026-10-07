import { describe, expect, test } from 'bun:test'
import { ISSUER_SENHA, PROVEDOR_SENHA, hasherDe } from '@ind/auth'
import { aceitarConvite, atualizarUsuarios, criarConvite, criarUsuario, lerConvite } from '@ind/db'
import { auth, cookieDaLivia, db, pedir, sql } from './ajuda.ts'

const json = { 'content-type': 'application/json' }
const conta = { provedorSenha: PROVEDOR_SENHA, issuerSenha: ISSUER_SENHA }

async function comUsuario(prova: (login: string, id: string) => Promise<void>) {
  const login = `teste-convite-${crypto.randomUUID()}`
  const { id } = await criarUsuario(db, {
    usuario: login, nome: 'Pessoa Convidada', papel: 'operador',
    baseFixa: 'Raposa', bases: ['Raposa'], tipos: ['viagem'],
  })
  try {
    await prova(login, id)
  } finally {
    await sql`delete from "user" where id = ${id}`
  }
}

const aceitar = (token: string, senha: string) => pedir('/api/convite', {
  method: 'POST', headers: json, body: JSON.stringify({ token, senha }),
})

describe('primeiro acesso sem sessão', () => {
  test('o convite define a senha, abre sessão e deixa de valer', async () => {
    await comUsuario(async (login, id) => {
      const { token } = await criarConvite(db, id)
      const leitura = await pedir(`/api/convite?token=${token}`)
      expect(leitura.status).toBe(200)
      expect(await leitura.json()).toEqual({ usuario: login, nome: 'Pessoa Convidada' })
      const curta = await aceitar(token, 'curta')
      expect(curta.status).toBe(400)
      expect(await curta.json()).toEqual({ erro: 'senha curta' })
      const resposta = await aceitar(token, 'senha-do-primeiro-acesso')
      expect(resposta.status).toBe(200)
      expect(await resposta.json()).toEqual({ ok: true })
      const cookie = resposta.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
      const sessao = await pedir('/api/sessao', { headers: { cookie } })
      expect(sessao.status).toBe(200)
      expect((await sessao.json()).usuario).toBe(login)
      expect((await pedir(`/api/convite?token=${token}`)).status).toBe(404)
      expect((await aceitar(token, 'outra-senha-que-nao-entra')).status).toBe(404)
    })
  })

  test('duas aceitações simultâneas têm um vencedor e preservam sua senha', async () => {
    await comUsuario(async (login, id) => {
      const { token } = await criarConvite(db, id)
      const senhas = ['primeira-senha-concorrente', 'segunda-senha-concorrente']
      const respostas = await Promise.all(senhas.map((senha) => aceitar(token, senha)))
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 404])
      for (let i = 0; i < respostas.length; i++) {
        const entrada = await pedir('/api/entrar', {
          method: 'POST', headers: json, body: JSON.stringify({ usuario: login, senha: senhas[i] }),
        })
        expect(entrada.status).toBe(respostas[i]!.status === 200 ? 200 : 401)
      }
    })
  })

  test('gerações simultâneas deixam somente um link válido', async () => {
    await comUsuario(async (_login, id) => {
      const convites = await Promise.all(Array.from({ length: 8 }, () => criarConvite(db, id)))
      const donos = await Promise.all(convites.map((c) => lerConvite(db, c.token)))
      expect(donos.filter((d) => d !== null)).toHaveLength(1)
      const linhas = await sql`select count(*)::int as quantos from convite_senha where usuario_id = ${id} and usado_em is null`
      expect(linhas[0]!.quantos).toBe(1)
    })
  })

  test('convite gerado dentro de uma transação também pode ser aceito', async () => {
    await comUsuario(async (login, id) => {
      const convite = await db.transaction((tx) => criarConvite(tx, id))
      const hash = await (await hasherDe(auth)).hash('senha-gerada-em-transacao')
      expect(await aceitarConvite(db, convite.token, hash, conta)).toEqual({
        usuarioId: id, usuario: login, nome: 'Pessoa Convidada',
      })
    })
  })

  test('trocar a senha encerra a sessão anterior', async () => {
    await comUsuario(async (login, id) => {
      const { token } = await criarConvite(db, id)
      const resposta = await aceitar(token, 'senha-anterior-do-convite')
      const cookie = resposta.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
      expect((await pedir('/api/sessao', { headers: { cookie } })).status).toBe(200)
      const admin = await cookieDaLivia()
      const troca = await pedir('/api/usuarios', {
        method: 'PUT', headers: { ...json, cookie: admin },
        body: JSON.stringify([{ usuario: login, nome: 'Pessoa Convidada', senha: 'senha-nova-do-convite' }]),
      })
      expect(troca.status).toBe(200)
      expect((await pedir('/api/sessao', { headers: { cookie } })).status).toBe(401)
    })
  })
})

test('despromover os dois administradores simultaneamente preserva um administrador', async () => {
  const originais = await sql`select id, name, email, papel, base_id from "user" where papel = 'admin' order by id`
  expect(originais).toHaveLength(2)
  const ids = originais.map((u) => u.id as string)
  const vinculos = await sql`select * from usuario_base where usuario_id in ${sql(ids)}`
  try {
    const resultados = await Promise.allSettled(originais.map((u) => atualizarUsuarios(db, [{
      usuario: String(u.email).split('@')[0]!, nome: String(u.name), papel: 'operador',
      baseFixa: 'Raposa', bases: ['Raposa'],
    }], conta)))
    expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    const restantes = await sql`select count(*)::int as quantos from "user" where papel = 'admin'`
    expect(restantes[0]!.quantos).toBe(1)
  } finally {
    await sql`delete from usuario_base where usuario_id in ${sql(ids)}`
    if (vinculos.length > 0) await sql`insert into usuario_base ${sql(vinculos)}`
    for (const u of originais) {
      await sql`update "user" set papel = 'admin', base_id = null where id = ${u.id}`
    }
  }
})

test('cadastro recusa base fixa ausente das bases liberadas', async () => {
  const login = `teste-base-${crypto.randomUUID()}`
  const cookie = await cookieDaLivia()
  const resposta = await pedir('/api/usuarios', {
    method: 'POST', headers: { ...json, cookie },
    body: JSON.stringify({ usuario: login, nome: 'Pessoa', papel: 'operador', baseFixa: 'Raposa', bases: [] }),
  })
  expect(resposta.status).toBe(400)
  expect(await resposta.json()).toEqual({ erro: "base 'Raposa' precisa estar nas bases liberadas" })
  const linhas = await sql`select id from "user" where email = ${`${login}@emvidros.com.br`}`
  expect(linhas).toHaveLength(0)
})
