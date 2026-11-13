/**
 * O seletor de mes que as quatro telas do painel dividem, ao lado do de periodo. Escolher um
 * mes mostra o resultado daquele mes inteiro; "Usar o período" volta ao periodo de sempre.
 * So lista os meses que tem registro na base filtrada, mais o mes escolhido caso ele (por
 * link antigo) nao tenha nenhum, para o seletor nao mentir sobre o que esta filtrando.
 */
import type { JSX } from 'react'
import { Seletor } from '../geist/primitivos.tsx'
import { mesesComRegistro } from './dominio.ts'
import type { Item } from './dominio.ts'
import { rotuloDoMes } from './filtros.ts'
import type { Filtros } from './filtros.ts'

const SEM_MES = ''

export function SeletorDeMes({ itens, filtros, aoEscolher }: {
  readonly itens: readonly Item[]
  readonly filtros: Filtros
  readonly aoEscolher: (novos: Filtros) => void
}): JSX.Element {
  const meses = mesesComRegistro(itens, filtros.base)
  if (filtros.mes !== null && !meses.includes(filtros.mes)) meses.push(filtros.mes)
  const opcoes = [
    { valor: SEM_MES, rotulo: 'Usar o período' },
    ...meses.sort().reverse().map((mes) => ({ valor: mes, rotulo: rotuloDoMes(mes) })),
  ]
  return (
    <Seletor
      rotulo="Mês"
      valor={filtros.mes ?? SEM_MES}
      opcoes={opcoes}
      aoEscolher={(mes) => aoEscolher({ ...filtros, mes: mes === SEM_MES ? null : mes })}
    />
  )
}
