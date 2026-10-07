import type { JSX, ReactNode } from 'react'
import type { RegistrosDoPainel } from './carregar.ts'
import { Botao, CabecalhoDePagina, Esqueleto } from '../geist/primitivos.tsx'

export function EstadoDosRegistros({ registros, titulo, children }: {
  readonly registros: RegistrosDoPainel
  readonly titulo: string
  readonly children: ReactNode
}): JSX.Element {
  const { temDados, sincronia, recarregar } = registros
  if (!temDados && sincronia.estado === 'carregando') return <Esqueleto />
  if (!temDados) {
    return (
      <div role="alert">
        <CabecalhoDePagina
          titulo={titulo}
          subtitulo="Não foi possível carregar os registros. Tente novamente."
          acoes={<Botao rotulo="Tentar novamente" aoClicar={recarregar} />}
        />
      </div>
    )
  }
  return (
    <>
      {sincronia.estado === 'offline' && (
        <div role="status" className="g-barra">
          <span className="g-l13">Não foi possível atualizar os registros. Exibindo os últimos dados carregados.</span>
          <Botao rotulo="Tentar novamente" aoClicar={recarregar} />
        </div>
      )}
      {children}
    </>
  )
}
