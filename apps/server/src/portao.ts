/**
 * O portao. Nada sai deste servidor sem sessao, e a excecao e uma lista curta e
 * explicita, nao um padrao de caminho que cresce sozinho.
 */
import type { Auth } from '@ind/auth'
import type { MiddlewareHandler } from 'hono'

/** O portao guarda so o id; quem quiser o resto pergunta ao banco. */
export type Ambiente = { Variables: { usuarioId: string } }

export const ROTA_LOGIN = '/entrar.html'

/** Para onde ir depois de entrar quando nao ha destino, ou quando ele nao passa. */
export const PAGINA_PADRAO = '/formulario-registro.html'

/**
 * O logo esta aqui porque a tela de login o mostra antes de existir sessao. E o
 * unico arquivo de `docs/` publico, e por isso ele e nomeado, nao um padrao.
 *
 * Os cinco de `/assets/` sao o que a tela de login carrega para existir: o proprio
 * modulo, o CSS dela, o React, o shim de modulepreload e o runtime de interop do
 * rolldown. Eles saem do build sem hash de proposito, para caberem numa lista de nomes;
 * liberar `/assets/` inteiro seria o padrao que este portao nao usa, e entregaria de
 * graca o codigo das seis telas de dentro. `verificar/publicos.ts` cobra os dois
 * sentidos, entao arquivo que a login passe a pedir e nome que sobre aqui reprovam a
 * build.
 *
 * O runtime chegou com o Recharts, no porte do dashboard. Ele traz dependencia em CJS,
 * o rolldown precisou emitir os ajudantes de interop, e como todo pedaco os usa eles
 * viraram um pedaco compartilhado que a login tambem carrega. Sem esta linha o portao
 * devolve 302 para o proprio login, o navegador recebe HTML onde esperava JavaScript, e
 * so quem ainda nao entrou ve o defeito.
 */
const PUBLICOS = new Set([
  ROTA_LOGIN,
  '/api/entrar',
  '/saude',
  '/docs/logo-emvidros.svg',
  '/assets/entrar.js',
  '/assets/entrar.css',
  '/assets/vendor-react.js',
  '/assets/modulepreload-polyfill.js',
  '/assets/rolldown-runtime.js',
])

/** O que `verificar/publicos.ts` confere contra o `dist/`. */
export const PUBLICOS_DE_ASSET: readonly string[] = [...PUBLICOS].filter((r) =>
  r.startsWith('/assets/'),
)

/**
 * O better-auth publica `sign-up/email` junto com `sign-in`, e ele nao serve a este
 * app: os quatro usuarios nascem do seed, e cadastro aberto num sistema interno e
 * porta destrancada. Desde a migracao 0005 ele tambem quebra, porque o CHECK
 * `user_admin_sem_base_ck` exige base fixa e o cadastro nao tem como saber qual.
 *
 * 404 e nao 403 porque nao ha por que confirmar que a rota existe.
 */
const FECHADAS = ['/api/auth/sign-up']

export function ehFechada(caminho: string): boolean {
  return FECHADAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`))
}

export function ehPublico(caminho: string): boolean {
  if (PUBLICOS.has(caminho)) return true
  return caminho === '/api/auth' || caminho.startsWith('/api/auth/')
}

/** Controle, espaco e DEL. Num cabecalho Location eles abrem injecao. */
const CONTROLE = /[\x00-\x20\x7f]/

/**
 * `destino` chega pela query string, entao vem de fora e vale o que um estranho
 * quiser. Cada linha aqui fecha uma forma conhecida de redirecionamento aberto, e o
 * que nao passa vira null: o portao ja tem para onde mandar sem ele.
 */
export function destinoSeguro(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  if (!bruto.startsWith('/')) return null
  // '//evil.com' e URL relativa a esquema, e leva para fora do site.
  if (bruto.startsWith('//')) return null
  if (bruto.includes('://')) return null
  // O navegador normaliza '\' para '/', entao '/\evil.com' viraria '//evil.com'.
  if (bruto.includes('\\')) return null
  if (CONTROLE.test(bruto)) return null
  return bruto
}

/**
 * Quem pediu isto: a barra de enderecos ou codigo rodando na pagina?
 *
 * A pergunta nao se responde por prefixo de rota. Um 302 devolvido a um `fetch`
 * chega ao JavaScript como 200 com o HTML do login no corpo, e o erro so aparece
 * depois, longe daqui, como dado estranho. E prefixo nao separa PDF aberto em aba
 * nova de PDF dentro do iframe: e a mesma URL, so a intencao muda.
 * `Sec-Fetch-Dest` responde exatamente isso e todo navegador atual manda; `Accept`
 * cobre curl e cliente velho.
 */
function ehNavegacao(cabecalhos: Headers): boolean {
  const destino = cabecalhos.get('sec-fetch-dest')
  if (destino !== null) return destino === 'document'
  return (cabecalhos.get('accept') ?? '').includes('text/html')
}

export function portao(auth: Auth): MiddlewareHandler<Ambiente> {
  return async (c, next) => {
    const url = new URL(c.req.url)

    // A tela de login e publica, mas nao e indiferente a sessao: quem ja entrou
    // ficaria preso nela, e o `destino` que o trouxe ate aqui se perderia.
    if (url.pathname === ROTA_LOGIN) {
      const bruto = url.searchParams.get('destino')
      const sessao = await auth.api.getSession({ headers: c.req.raw.headers })
      if (sessao) return c.redirect(destinoSeguro(bruto) ?? PAGINA_PADRAO, 302)

      // Sem sessao quem navega depois do login e o script da tela, entao ate aqui o
      // servidor servia o HTML sem nunca olhar o `destino` e a unica checagem que
      // valia era a do navegador. Destino que nao passa sai da query antes de a tela
      // carregar: o valor envenenado nao chega ao script.
      if (bruto !== null && destinoSeguro(bruto) === null) return c.redirect(ROTA_LOGIN, 302)
      return next()
    }

    if (ehFechada(url.pathname)) return c.json({ erro: 'nao encontrado' }, 404)

    // Antes de perguntar ao banco: `/saude` e o logo respondem em toda requisicao,
    // e uma consulta de sessao em cada uma seria carga sem resposta a dar.
    if (ehPublico(url.pathname)) return next()

    const sessao = await auth.api.getSession({ headers: c.req.raw.headers })
    if (sessao) {
      c.set('usuarioId', sessao.user.id)
      return next()
    }

    if (ehNavegacao(c.req.raw.headers)) {
      const destino = encodeURIComponent(url.pathname + url.search)
      return c.redirect(`${ROTA_LOGIN}?destino=${destino}`, 302)
    }
    return c.json({ erro: 'sem sessao' }, 401)
  }
}
