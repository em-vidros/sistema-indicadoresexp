/**
 * A entrada unica do app. Uma casca, dez telas, um pedaco de JavaScript por tela.
 *
 * A `Casca` fica fora do `Suspense` de proposito: ela e o mesmo elemento em toda rota, e
 * so o miolo do painel e trocado. E o que faz a sidebar nao piscar na navegacao, e o que
 * o `.html` por tela nao tinha como dar.
 *
 * Cada `React.lazy` e criado uma vez e guardado por id. Criado dentro do render, ele seria
 * um componente novo a cada render, e o React desmontaria e remontaria a tela inteira sem
 * ninguem ter navegado.
 *
 * `Avisos` fica por fora de tudo porque o toast sobrevive a troca de tela: salvar um
 * registro e ir para a Visao geral nao pode apagar a confirmacao do salvamento.
 *
 * `NuqsAdapter` envolve o app porque base e periodo sao estado da query pelo nuqs, e
 * todo `useFiltros` precisa dele acima.
 */
import { Suspense, lazy, useEffect } from 'react'
import type { ComponentType, JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { NuqsAdapter, enableHistorySync } from 'nuqs/adapters/react'
import { Ligacao, useLocalizacao } from './navegacao.tsx'
import { rotaDe } from './rotas.ts'
import type { Rota } from './rotas.ts'
import { Casca } from '../geist/casca.tsx'
import { Avisos } from '../geist/formulario.tsx'
import { MagnifyingGlass } from '../geist/icones.tsx'
import { CabecalhoDePagina, Esqueleto, Vazio } from '../geist/primitivos.tsx'

const LENTAS = new Map<string, ComponentType>()

function telaDe(rota: Rota): ComponentType {
  const guardada = LENTAS.get(rota.id)
  if (guardada !== undefined) return guardada
  const lenta = lazy(rota.carregar)
  LENTAS.set(rota.id, lenta)
  return lenta
}

function NaoEncontrada(): JSX.Element {
  return (
    <>
      <CabecalhoDePagina titulo="Página não encontrada" subtitulo={window.location.pathname} acoes={null} />
      <Vazio
        icone={MagnifyingGlass}
        titulo="Não há nada neste endereço"
        texto="O link pode estar velho, ou a tela pode ter mudado de caminho."
        acao={<Ligacao className="g-botao g-botao-primario" para="/registrar">Ir para Registrar rota</Ligacao>}
      />
    </>
  )
}

function App(): JSX.Element {
  const { caminho } = useLocalizacao()
  const rota = rotaDe(caminho)

  useEffect(() => {
    document.title = rota === null ? 'EM Vidros' : `${rota.titulo} · EM Vidros`
  }, [rota])

  const Tela = rota === null ? null : telaDe(rota)

  return (
    <Avisos>
      <Casca>
        {Tela === null || rota === null
          ? <NaoEncontrada />
          : (
            <Suspense key={rota.id} fallback={<Esqueleto />}>
              <Tela />
            </Suspense>
          )}
      </Casca>
    </Avisos>
  )
}

const raiz = document.getElementById('app')
if (raiz === null) throw new Error('a casca da tela nao tem #app')
/**
 * O roteador da casa escreve na History API direto pelo `navegar`, sem passar pelo
 * nuqs. Sem isto o nuqs so reagiria as proprias escritas e ao popstate, e a troca de
 * tela pela sidebar deixaria os filtros do nuqs para tras. Com o remendo, o push do
 * `navegar` tambem acorda os hooks.
 */
enableHistorySync()
createRoot(raiz).render(
  <NuqsAdapter>
    <App />
  </NuqsAdapter>,
)
