/**
 * A tela de login, e tambem a de primeiro acesso. Ela e a unica fora da casca da SPA:
 * pinta antes de existir sessao, e por isso tudo que ela carrega passa pelo portao sem
 * cookie nenhum.
 *
 * O link que o cadastro de usuarios entrega e `/entrar.html?convite=<token>`, e quem muda
 * de modo e esta tela, olhando a query. Uma pagina propria custaria uma entrada nova no
 * build, um `.html` novo no `dist/` e nomes novos na lista de assets publicos do portao,
 * tres coisas que teriam de ser lembradas juntas. Aqui nao muda nenhuma delas.
 *
 * O token esta na URL desde o primeiro render, entao o modo e escolhido antes de pintar e
 * ninguem ve o formulario de entrar aparecer e sumir. O que chega depois e so o nome de
 * quem foi convidado, e ate ele chegar a tela diz que esta conferindo em vez de mostrar
 * campos que talvez nao valham.
 *
 * Dai a regra que manda no que este arquivo importa: nada de `primitivos.tsx` nem de
 * `formulario.tsx`. Os dois puxam `app/navegacao.tsx`, que puxa a tabela de rotas, e a
 * tabela traria as onze telas de dentro para o bundle publico. Os controles daqui sao as
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

/** O menor que o servidor aceita. Repetido aqui para a recusa chegar antes do pedido. */
const SENHA_MINIMA = 8

/**
 * O que se sabe do convite. `checando` existe porque o token so vale depois que o servidor
 * responde, e pintar os campos antes seria pedir uma senha que talvez nao va a lugar nenhum.
 */
type Convite =
  | { readonly estado: 'checando' }
  | { readonly estado: 'valido'; readonly nome: string }
  | { readonly estado: 'invalido' }

/** O motivo do 404 nao vem do servidor de proposito: dizer qual e conta que logins existem. */
const LINK_MORTO = 'Este link não vale mais. Peça um novo para quem cuida dos usuários.'

function Cartao({ sub, children }: { readonly sub: string; readonly children: JSX.Element | null }): JSX.Element {
  return (
    <div className="g-entrar">
      <div className="g-entrar-cartao">
        <img className="g-entrar-logo" src="docs/logo-emvidros.svg" alt="EM Vidros" />
        <div className="g-entrar-sub g-l13 g-fraco">{sub}</div>
        {children}
      </div>
    </div>
  )
}

function PrimeiroAcesso({ token }: { readonly token: string }): JSX.Element {
  const [convite, setConvite] = useState<Convite>({ estado: 'checando' })
  const [senha, setSenha] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    void fetch(`/api/convite?token=${encodeURIComponent(token)}`)
      .then(async (resposta) => {
        if (!resposta.ok) return null
        return (await resposta.json()) as { nome?: string }
      })
      .catch(() => null)
      .then((lido) => {
        if (!vivo) return
        setConvite(lido === null ? { estado: 'invalido' } : { estado: 'valido', nome: lido.nome ?? '' })
      })
    return () => {
      vivo = false
    }
  }, [token])

  async function definir(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    if (senha !== repetida) {
      setErro('As duas senhas não são iguais.')
      return
    }

    setErro(null)
    setEnviando(true)
    try {
      const resposta = await fetch('/api/convite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      })
      if (resposta.ok) {
        // O servidor ja criou a sessao e mandou o cookie; nao ha o que digitar de novo.
        location.replace(PAGINA_PADRAO)
        return
      }
      // O link pode ter morrido entre a conferencia e o envio, e ai o formulario sai da tela.
      if (resposta.status === 404) {
        setConvite({ estado: 'invalido' })
        return
      }
      const falha = (await resposta.json().catch(() => null)) as { erro?: string } | null
      setErro(falha?.erro ?? 'Não foi possível definir a senha.')
    } catch {
      setErro('Não foi possível definir a senha. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (convite.estado === 'checando') {
    return (
      <Cartao sub="Primeiro acesso">
        <div className="g-l13 g-fraco">Conferindo o link.</div>
      </Cartao>
    )
  }

  if (convite.estado === 'invalido') {
    return (
      <Cartao sub="Primeiro acesso">
        <>
          <div className="g-entrar-erro g-l13" role="alert">
            <Icone de={Warning} />
            <span>{LINK_MORTO}</span>
          </div>
          <div className="g-entrar-dica">
            <a className="g-botao g-botao-secundario g-botao-medio g-entrar-botao" href="/entrar.html">
              <span>Ir para o login</span>
            </a>
          </div>
        </>
      </Cartao>
    )
  }

  return (
    <div className="g-entrar">
      <form className="g-entrar-cartao" onSubmit={(e) => void definir(e)}>
        <img className="g-entrar-logo" src="docs/logo-emvidros.svg" alt="EM Vidros" />
        <div className="g-entrar-sub g-l13 g-fraco">
          {convite.nome === '' ? 'Primeiro acesso' : `Primeiro acesso · ${convite.nome}`}
        </div>

        <label className="g-entrar-rotulo g-l13 g-fraco" htmlFor="senha">Escolha sua senha</label>
        <div className="g-caixa">
          <input
            id="senha"
            className="g-campo-entrada"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.currentTarget.value)}
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

        <label className="g-entrar-rotulo g-entrar-rotulo-2 g-l13 g-fraco" htmlFor="repetida">Repita a senha</label>
        <div className="g-caixa">
          <input
            id="repetida"
            className="g-campo-entrada"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.currentTarget.value)}
          />
        </div>

        <div className="g-entrar-dica g-l13 g-fraco">
          Pelo menos {SENHA_MINIMA} caracteres. Ninguém mais vê esta senha.
        </div>

        <button
          type="submit"
          className="g-botao g-botao-primario g-botao-medio g-entrar-botao"
          disabled={enviando}
          aria-busy={enviando ? true : undefined}
        >
          {enviando ? <span className="g-giro" /> : null}
          <span>Definir senha e entrar</span>
        </button>

        {erro === null ? null : (
          <div className="g-entrar-erro g-l13" role="alert">
            <Icone de={Warning} />
            <span>{erro}</span>
          </div>
        )}
      </form>
    </div>
  )
}

/** O modo sai da query, que ja esta lida no primeiro render: nada troca debaixo dos olhos. */
function Tela(): JSX.Element {
  const convite = new URLSearchParams(location.search).get('convite')
  return convite === null || convite === '' ? <Entrar /> : <PrimeiroAcesso token={convite} />
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
createRoot(raiz).render(<Tela />)
