/**
 * A tela de login. Ela e a unica fora da casca da SPA: pinta antes de existir sessao,
 * e por isso tudo que ela carrega passa pelo portao sem cookie nenhum.
 *
 * Dai a regra que manda no que este arquivo importa: nada de `primitivos.tsx` nem de
 * `formulario.tsx`. Os dois puxam `app/navegacao.tsx`, que puxa a tabela de rotas, e a
 * tabela traria as dez telas de dentro para o bundle publico. Os controles daqui sao as
 * mesmas classes do sistema visual escritas a mao; `icones.tsx` entra porque nao depende
 * de nada e o rolldown descarta os icones que a tela nao usa.
 *
 * A folha e `geist.css` inteira, e nao um recorte: as cinco fontes que ela pede saem sem
 * hash pelo `SEM_HASH` do `vite.config.ts` e estao liberadas por nome no portao. Quem
 * cobra as duas pontas e `verificar/publicos.ts`.
 */
import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, Eye, EyeOff, Icone, Warning } from '../geist/icones.tsx'
import '../geist/geist.css'

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

/** Para onde ir quando nao ha `?destino`, ou quando ele nao passa. */
const PAGINA_PADRAO = '/registrar'

/** Quanto tempo o aviso de credencial errada fica na tela. */
const DURACAO_DO_ERRO = 3000

type Formulario = { readonly usuario: string; readonly senha: string; readonly lembrar: boolean }

const VAZIO: Formulario = { usuario: '', senha: '', lembrar: true }

function Entrar(): JSX.Element {
  const [dados, setDados] = useState<Formulario>(VAZIO)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!erro) return
    const relogio = setTimeout(() => setErro(false), DURACAO_DO_ERRO)
    return () => clearTimeout(relogio)
  }, [erro])

  async function entrar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setEnviando(true)

    let ok = false
    try {
      const resposta = await fetch('/api/entrar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          usuario: dados.usuario.trim().toLowerCase(),
          senha: dados.senha,
          // Marcado, o cookie sobrevive ao fechar o navegador; desmarcado, morre com ele.
          lembrar: dados.lembrar,
        }),
      })
      ok = resposta.ok
    } catch {
      // Rede fora e credencial errada dao o mesmo aviso: quem esta na tela nao tem o que
      // fazer de diferente nos dois casos, e um deles nao merece uma tela propria.
      ok = false
    }

    if (!ok) {
      setEnviando(false)
      setErro(true)
      return
    }

    const destino = new URLSearchParams(location.search).get('destino')
    // `replace` e nao `assign`: o botao voltar nao deve trazer o login de volta.
    location.replace(destinoSeguro(destino) ?? PAGINA_PADRAO)
  }

  return (
    <div className="g-entrar">
      <form className="g-entrar-cartao" onSubmit={(e) => void entrar(e)}>
        <img className="g-entrar-logo" src="docs/logo-emvidros.svg" alt="EM Vidros" />
        <div className="g-entrar-sub g-l13 g-fraco">Registro Diário · Logística</div>

        <label className="g-entrar-rotulo g-l13 g-fraco" htmlFor="usuario">Usuário</label>
        <div className="g-caixa">
          <input
            id="usuario"
            className="g-campo-entrada"
            type="text"
            autoComplete="username"
            autoFocus
            value={dados.usuario}
            onChange={(e) => setDados({ ...dados, usuario: e.currentTarget.value })}
          />
        </div>

        <label className="g-entrar-rotulo g-entrar-rotulo-2 g-l13 g-fraco" htmlFor="senha">Senha</label>
        <div className="g-caixa">
          <input
            id="senha"
            className="g-campo-entrada"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            value={dados.senha}
            onChange={(e) => setDados({ ...dados, senha: e.currentTarget.value })}
          />
          <button
            type="button"
            className="g-caixa-gatilho"
            aria-label={mostrarSenha ? 'Esconder a senha' : 'Mostrar a senha'}
            tabIndex={-1}
            onClick={() => setMostrarSenha(!mostrarSenha)}
          >
            <Icone de={mostrarSenha ? Eye : EyeOff} />
          </button>
        </div>

        <label className="g-caixinha g-entrar-lembrar">
          <input
            className="g-escondido"
            type="checkbox"
            checked={dados.lembrar}
            onChange={(e) => setDados({ ...dados, lembrar: e.currentTarget.checked })}
          />
          <span className={dados.lembrar ? 'g-caixinha-marca g-caixinha-marcada' : 'g-caixinha-marca'}>
            {dados.lembrar ? <Icone de={Check} tamanho={12} /> : null}
          </span>
          <span className="g-caixinha-rotulo g-l13">Lembrar de mim</span>
        </label>

        <button
          type="submit"
          className="g-botao g-botao-primario g-botao-medio g-entrar-botao"
          disabled={enviando}
          aria-busy={enviando ? true : undefined}
        >
          {enviando ? <span className="g-giro" /> : null}
          <span>Entrar</span>
        </button>

        {erro ? (
          <div className="g-entrar-erro g-l13" role="alert">
            <Icone de={Warning} />
            <span>Usuário ou senha incorretos.</span>
          </div>
        ) : null}
      </form>
    </div>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<Entrar />)
