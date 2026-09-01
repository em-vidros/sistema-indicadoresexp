import { z } from 'zod'
import { minutosEntre } from './tempo.ts'
import type { Instante } from './tempo.ts'

export const Pontualidade = z.enum(['adiantado', 'no_prazo', 'atrasado'])
export type Pontualidade = z.infer<typeof Pontualidade>

/**
 * Hoje isso e um `<select>` que o operador preenche (linha 308 do formulario),
 * solto de `hora_prevista` e `hora_chegada`. Nada impede gravar "adiantado" com
 * chegada depois do previsto, e o KPI de atraso conta essa linha.
 */
export function classificarPontualidade(
  previsto: Instante,
  chegada: Instante,
  toleranciaMin: number,
): Pontualidade {
  const tolerancia = Math.abs(toleranciaMin)
  const desvio = minutosEntre(previsto, chegada)
  if (desvio > tolerancia) return 'atrasado'
  if (desvio < -tolerancia) return 'adiantado'
  return 'no_prazo'
}
