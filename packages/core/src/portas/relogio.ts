import type { DataISO, Instante } from '../dominio/tempo.ts'

/** Sem a porta, testar "vence em 30 dias" vira mexer no relogio da maquina. */
export interface Relogio {
  hoje(): DataISO
  agora(): Instante
}
