/**
 * O lugar das seis telas que ainda nao foram reescritas.
 *
 * Ela existe para a tabela de rotas ficar completa desde ja: os seis caminhos novos
 * navegam, entram na sidebar e no historico, e trocar cada um por uma tela de verdade e
 * mexer numa linha de `app/rotas.ts`. O titulo sai da propria tabela, entao esta tela nao
 * repete nome nenhum.
 */
import type { JSX } from 'react'
import { useLocalizacao } from '../app/navegacao.tsx'
import { rotaDe } from '../app/rotas.ts'
import { PencilEdit } from '../geist/icones.tsx'
import { CabecalhoDePagina, Vazio } from '../geist/primitivos.tsx'

export default function EmConstrucao(): JSX.Element {
  const { caminho } = useLocalizacao()
  const rota = rotaDe(caminho)
  return (
    <>
      <CabecalhoDePagina titulo={rota?.titulo ?? 'Tela'} subtitulo="Tela em construção" acoes={null} />
      <Vazio
        icone={PencilEdit}
        titulo="Tela em construção"
        texto="Esta tela ainda é a versão antiga, e vai ser reescrita no sistema visual novo."
      />
    </>
  )
}
