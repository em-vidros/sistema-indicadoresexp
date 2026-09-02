/**
 * O registro de roteiros. Tela que nao esta aqui nao reprova nada, o comando imprime
 * `sem roteiro ainda` e segue, e e isso que mantem `bun run verificar` verde enquanto
 * as outras cinco nao chegam.
 */
import type { Roteiro } from '../palco.ts'
import { documentosFrota } from './documentos-frota.ts'
import { entrar } from './entrar.ts'

export const ROTEIROS: readonly Roteiro[] = [entrar, documentosFrota]
