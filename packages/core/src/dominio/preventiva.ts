import { z } from 'zod'

export const StatusPreventiva = z.enum(['ok', 'proxima', 'vencida', 'sem_dado'])
export type StatusPreventiva = z.infer<typeof StatusPreventiva>

export type EstadoPreventiva = {
  ultimoKm: number | null
  kmAtual: number | null
  intervaloKm: number
  alertaKm: number
}

/**
 * Espelha `calcularStatus` de manutencao-frota.html, linhas 388 a 395, inclusive
 * o teste por valor falsy: la, `ultimo_km` zerado conta como "nunca medido", e um
 * `kmAtual` zerado cai de volta no proprio `ultimo_km`, o que faz o item nascer
 * com um intervalo inteiro pela frente em vez de nascer vencido.
 */
export function statusPreventiva(e: EstadoPreventiva): StatusPreventiva {
  if (e.ultimoKm === null || e.ultimoKm <= 0) return 'sem_dado'
  const referencia = e.kmAtual !== null && e.kmAtual > 0 ? e.kmAtual : e.ultimoKm
  const restante = e.ultimoKm + e.intervaloKm - referencia
  if (restante <= 0) return 'vencida'
  if (restante <= e.alertaKm) return 'proxima'
  return 'ok'
}
