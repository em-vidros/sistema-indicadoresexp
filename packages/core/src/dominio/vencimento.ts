import { z } from 'zod'
import { diasEntre } from './tempo.ts'
import type { DataISO } from './tempo.ts'

/**
 * `sem_dado` espelha o `'sem-data'` de documentos-frota.html, linha 295. Documento
 * que vence sem data de vencimento existe no parque de hoje: os 7 tacografos nao
 * tem data nenhuma. Ausencia de dado nao e "ok" nem "vencido", e pintar de verde
 * um tacografo sem data e exatamente o erro que a tela ja evita.
 */
export const StatusVencimento = z.enum(['ok', 'alerta', 'vencido', 'sem_dado'])
export type StatusVencimento = z.infer<typeof StatusVencimento>

export function statusVencimento(
  hoje: DataISO,
  vencimento: DataISO | null,
  alertaDias: number,
): StatusVencimento {
  if (vencimento === null) return 'sem_dado'
  const dias = diasEntre(hoje, vencimento)
  if (dias < 0) return 'vencido'
  if (dias <= alertaDias) return 'alerta'
  return 'ok'
}
