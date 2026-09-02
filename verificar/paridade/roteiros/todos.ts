/**
 * O registro de roteiros, com as sete telas dentro. Tela que sai daqui deixa de ser
 * cobrada e o comando so imprime `sem roteiro ainda`, entao tirar uma linha desta
 * lista apaga a prova daquela tela em silencio. `GUIA-CONFIGURACAO` e a unica de fora,
 * porque ainda nao foi decidido se ela e portada ou apagada.
 */
import type { Roteiro } from '../palco.ts'
import { ataReuniao } from './ata-reuniao.ts'
import { dashboardSemanal } from './dashboard-semanal.ts'
import { documentosFrota } from './documentos-frota.ts'
import { entrar } from './entrar.ts'
import { formularioRegistro } from './formulario-registro.ts'
import { integracaoFrota } from './integracao-frota.ts'
import { manutencaoFrota } from './manutencao-frota.ts'

export const ROTEIROS: readonly Roteiro[] = [
  entrar,
  documentosFrota,
  integracaoFrota,
  dashboardSemanal,
  ataReuniao,
  manutencaoFrota,
  formularioRegistro,
]
