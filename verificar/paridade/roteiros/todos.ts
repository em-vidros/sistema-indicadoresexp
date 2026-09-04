/**
 * O registro de roteiros, com seis telas dentro. Tela que sai daqui deixa de ser cobrada e
 * o comando so imprime `sem roteiro ainda`, entao tirar uma linha desta lista apaga a
 * prova daquela tela em silencio. Duas telas estao de fora, por motivos diferentes.
 *
 * `dashboard-semanal` saiu porque foi redesenhada de proposito. A prova compara a tela de
 * hoje com uma baseline gravada antes do porte, e o redesenho troca a tela inteira: nao ha
 * divergencia a investigar, so uma tela nova. O que entrou no lugar e
 * `verificar/olhar-dashboard.ts`, que nao reprova nada e fotografa a tela para alguem
 * olhar. Junto com o roteiro sairam a baseline, as duas mutacoes e o recorte de
 * `fora-da-prova.ts`.
 *
 * `GUIA-CONFIGURACAO` nunca entrou, porque ainda nao foi decidido se ela e portada ou
 * apagada.
 */
import type { Roteiro } from '../palco.ts'
import { ataReuniao } from './ata-reuniao.ts'
import { documentosFrota } from './documentos-frota.ts'
import { entrar } from './entrar.ts'
import { formularioRegistro } from './formulario-registro.ts'
import { integracaoFrota } from './integracao-frota.ts'
import { manutencaoFrota } from './manutencao-frota.ts'

export const ROTEIROS: readonly Roteiro[] = [
  entrar,
  documentosFrota,
  integracaoFrota,
  ataReuniao,
  manutencaoFrota,
  formularioRegistro,
]
