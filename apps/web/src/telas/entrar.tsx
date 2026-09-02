/**
 * A tela de login, e a primeira do porte para React. As outras seis copiam a forma
 * daqui, entao o que esta escrito abaixo vale como regra e nao como caso.
 *
 * Os campos ficam sem `value`. Um `<input value={x} onChange>` faz o React escrever o
 * atributo `value` no elemento, e a baseline congelou a tela sem esse atributo: o
 * campo de hoje guarda o que foi digitado no proprio DOM e o script le na hora de
 * enviar. Ref reproduz isso; estado controlado mudaria a arvore. Sempre que a tela
 * velha ler o campo com `getElementById(...).value`, o porte usa ref.
 *
 * O aviso de erro tem tres estados e nao dois. Antes do primeiro erro o elemento nao
 * tem atributo `style` nenhum e quem o esconde e a regra `.login-erro{display:none}`;
 * depois do erro ele ganha `display:block` inline; e quando o aviso apaga sozinho ele
 * fica com `display:none` inline. Renderizar sempre o `style` mudaria o estado inicial
 * da tela, entao os tres estados estao aqui como estao la.
 *
 * O `#app` da casca leva `display:contents` porque `body` e um flex container: um
 * wrapper com caixa propria mudaria o layout de toda tela que use o flex do body.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import './entrar.css'

/**
 * O servidor valida `destino` do mesmo jeito, e essa e a checagem que vale. Esta aqui
 * existe para o navegador nao chegar a sair do site antes de ouvir o nao. As cinco
 * linhas sao as mesmas do `destinoSeguro` do servidor, na mesma ordem.
 */
function destinoSeguro(bruto: string | null): string | null {
  if (!bruto) return null
  if (bruto.charAt(0) !== '/') return null
  if (bruto.slice(0, 2) === '//') return null
  if (bruto.indexOf('://') !== -1) return null
  if (bruto.indexOf('\\') !== -1) return null
  // O parser de URL do navegador descarta TAB, LF e CR antes de resolver, entao
  // '/\u0009/evil.com' viraria '//evil.com' depois desta funcao e sairia do site.
  if (/[\u0000-\u0020\u007f]/.test(bruto)) return null
  return bruto
}

type Aviso = 'nunca' | 'aceso' | 'apagado'

function Entrar(): JSX.Element {
  const usuario = useRef<HTMLInputElement>(null)
  const senha = useRef<HTMLInputElement>(null)
  const lembrar = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<Aviso>('nunca')

  // O overlay antigo focava o campo de usuario 100ms depois de carregar. Aqui a
  // pagina e so isso, entao o foco pode ser imediato.
  useEffect(() => {
    usuario.current?.focus()
  }, [])

  async function fazerLogin(): Promise<void> {
    const nome = usuario.current?.value.trim().toLowerCase() ?? ''
    const chave = senha.current?.value ?? ''
    // Marcado, o cookie sobrevive ao fechar o navegador; desmarcado, morre com ele.
    const guardar = lembrar.current?.checked ?? false

    let ok = false
    try {
      const r = await fetch('/api/entrar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usuario: nome, senha: chave, lembrar: guardar }),
      })
      ok = r.ok
    } catch {
      ok = false
    }

    if (!ok) {
      setAviso('aceso')
      setTimeout(() => setAviso('apagado'), 3000)
      return
    }

    const destino = new URLSearchParams(location.search).get('destino')
    // `replace` e nao `assign`: o botao voltar nao deve trazer o login de volta.
    location.replace(destinoSeguro(destino) ?? '/formulario-registro.html')
  }

  const aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') void fazerLogin()
  }

  return (
    <div className="login-overlay" id="loginOverlay">
      <div className="login-box">
        <div className="login-logo">
          <img
            src="docs/logo-emvidros.svg"
            alt="EM Vidros"
            style={{ height: '64px', width: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>
        <div className="login-sub">Registro Diário · Logística</div>
        <div>
          <label>Usuário</label>{' '}
          <input
            ref={usuario}
            type="text"
            id="loginUsuario"
            placeholder="Seu usuário"
            autoComplete="username"
            onKeyDown={aoTeclar}
          />{' '}
          <label>Senha</label>{' '}
          <input
            ref={senha}
            type="password"
            id="loginSenha"
            placeholder="Sua senha"
            autoComplete="current-password"
            onKeyDown={aoTeclar}
          />{' '}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '8px 0 4px',
              fontSize: '.85rem',
              color: 'var(--dim)',
            }}
          >
            <input
              ref={lembrar}
              type="checkbox"
              id="lembrarMe"
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              defaultChecked
            />
            <label htmlFor="lembrarMe" style={{ cursor: 'pointer', margin: '0' }}>
              Lembrar de mim
            </label>
          </div>{' '}
          <button className="btn-login" onClick={() => void fazerLogin()}>
            Entrar
          </button>{' '}
          <div
            className="login-erro"
            id="loginErro"
            style={aviso === 'nunca' ? undefined : { display: aviso === 'aceso' ? 'block' : 'none' }}
          >
            Usuário ou senha incorretos.
          </div>
        </div>
      </div>
    </div>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<Entrar />)
