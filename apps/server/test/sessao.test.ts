/**
 * Entrar, saber quem entrou e sair. O contrato de `/api/sessao` e consumido pelas
 * telas, entao os nomes dos campos sao verificados um a um: renomear qualquer um
 * deles quebra a tela em silencio.
 */
import { describe, expect, test } from 'bun:test'
import { exigir } from '@ind/db'
import { cookieDaLivia, NAVEGACAO, pedir } from './ajuda.ts'

const json = { 'content-type': 'application/json' }

describe('POST /api/entrar', () => {
  test('senha certa devolve cookie de sessao', async () => {
    const resposta = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: 'livia', senha: exigir('SENHA_LIVIA') }),
    })
    expect(resposta.status).toBe(200)
    expect(resposta.headers.getSetCookie().join(';')).toContain('session')
  })

  test('o usuario e maiusculo ou com espaco entra do mesmo jeito', async () => {
    const resposta = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: '  LIVIA ', senha: exigir('SENHA_LIVIA') }),
    })
    expect(resposta.status).toBe(200)
  })

  test('senha errada devolve 401 sem cookie', async () => {
    const resposta = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: 'livia', senha: 'nao-e-essa' }),
    })
    expect(resposta.status).toBe(401)
    expect(resposta.headers.getSetCookie()).toHaveLength(0)
  })

  test('usuario inexistente devolve o mesmo 401 da senha errada', async () => {
    const resposta = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: 'ninguem', senha: 'nao-e-essa' }),
    })
    expect(resposta.status).toBe(401)
  })

  test('corpo sem os campos e recusado antes de encostar no banco', async () => {
    const resposta = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: 'livia' }),
    })
    expect(resposta.status).toBe(400)
  })

  test('o `lembrar` desmarcado nao deixa o cookie sobreviver ao navegador', async () => {
    const com = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: 'livia', senha: exigir('SENHA_LIVIA'), lembrar: true }),
    })
    const sem = await pedir('/api/entrar', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ usuario: 'livia', senha: exigir('SENHA_LIVIA'), lembrar: false }),
    })
    // Cookie persistente tem Max-Age; cookie de sessao de navegador nao tem.
    expect(com.headers.getSetCookie().join(';')).toContain('Max-Age')
    expect(sem.headers.getSetCookie().join(';')).not.toContain('Max-Age')
  })
})

describe('GET /api/sessao', () => {
  test('devolve o contrato que a tela consome', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/api/sessao', { headers: { cookie } })
    expect(resposta.status).toBe(200)

    const corpo = (await resposta.json()) as Record<string, unknown>
    expect(Object.keys(corpo).sort()).toEqual(
      ['admin', 'baseFixa', 'bases', 'nome', 'tipos', 'usuario', 'usuarioId'].sort(),
    )
    expect(corpo['usuario']).toBe('livia')
    expect(corpo['admin']).toBe(true)
    expect(corpo['baseFixa']).toBeNull()
    expect(corpo['bases']).toEqual(['Belém', 'Imperatriz', 'Raposa'])
    expect(corpo['tipos']).toEqual(['abastecimento', 'manutencao', 'quebra', 'viagem'])
    expect(typeof corpo['usuarioId']).toBe('string')
    expect(typeof corpo['nome']).toBe('string')
  })
})

describe('POST /api/sair', () => {
  test('devolve 204 e apaga o cookie', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/api/sair', { method: 'POST', headers: { cookie } })
    expect(resposta.status).toBe(204)
    expect(resposta.headers.getSetCookie().join(';')).toContain('Max-Age=0')

    const depois = await pedir('/api/sessao', { headers: { cookie } })
    expect(depois.status).toBe(401)
  })
})

describe('a tela de login com sessao', () => {
  test('devolve ao destino guardado', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/entrar.html?destino=%2Fmanutencao-frota.html', {
      headers: { cookie, ...NAVEGACAO },
    })
    expect(resposta.status).toBe(302)
    expect(resposta.headers.get('location')).toBe('/manutencao-frota.html')
  })

  test('sem destino, cai no formulario', async () => {
    const cookie = await cookieDaLivia()
    const resposta = await pedir('/entrar.html', { headers: { cookie, ...NAVEGACAO } })
    expect(resposta.headers.get('location')).toBe('/formulario-registro.html')
  })

  test.each(['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/\\evil.com'])(
    'destino %s cai no padrao em vez de sair do site',
    async (destino) => {
      const cookie = await cookieDaLivia()
      const resposta = await pedir(`/entrar.html?destino=${encodeURIComponent(destino)}`, {
        headers: { cookie, ...NAVEGACAO },
      })
      expect(resposta.status).toBe(302)
      expect(resposta.headers.get('location')).toBe('/formulario-registro.html')
    },
  )
})
