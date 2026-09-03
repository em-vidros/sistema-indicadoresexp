/**
 * Os dois textos que o menu da Visao geral produz, e os tres efeitos que os entregam.
 *
 * O texto e formato congelado: sai linha por linha igual ao que a tela escrevia antes do
 * redesenho, emoji por emoji, porque quem recebe le no WhatsApp e compara com o da semana
 * passada. Os rotulos de periodo e de base vem de `PERIODOS[...].noRelatorio` e
 * `BASES[...].noRelatorio` justamente por isso: a tela mudou a caixa das palavras, o
 * relatorio nao.
 *
 * As duas funcoes de texto sao puras e recebem `agora`. Testar o relatorio nao devia
 * precisar de um relogio congelado, e o unico motivo de elas lerem a hora era conveniencia.
 */
import { BASES, PERIODOS } from './filtros.ts'
import type { Filtros } from './filtros.ts'
import { brl, fmtPct, parcela } from './dominio.ts'
import type { Indicadores, Rota } from './dominio.ts'

export function textoDoRelatorio(kpis: Indicadores, filtros: Filtros, agora: Date): string {
  return [
    `📊 RELATÓRIO LOGÍSTICO — EM VIDROS`,
    `${PERIODOS[filtros.periodo].noRelatorio} · ${BASES[filtros.base].noRelatorio} · ${agora.toLocaleDateString('pt-BR')}`,
    ``,
    `🚛 VIAGENS: ${kpis.viagens.length} | Carga: R$ ${kpis.totalCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Custo: R$ ${kpis.totalCustoV.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    kpis.pctCustoRota !== null ? `   % Custo/Carga: ${kpis.pctCustoRota.toFixed(2)}% ${kpis.pctCustoRota < 7 ? '✅' : '⚠️'} (meta < 7%)` : '',
    ``,
    `🔧 MANUTENÇÕES: R$ ${kpis.totalManut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    kpis.pctManutProd !== null ? `   % Manut/Produção: ${kpis.pctManutProd.toFixed(2)}% ${kpis.pctManutProd < 2 ? '✅' : '⚠️'} (meta < 2%)` : '',
    ``,
    `⛽ ABASTECIMENTO: R$ ${kpis.totalAbast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ``,
    kpis.pctQuebra !== null ? `📦 QUEBRA: ${kpis.pctQuebra.toFixed(2)}% ${kpis.pctQuebra < 1 ? '✅' : '⚠️'} (meta < 1%)` : '📦 QUEBRA: sem registros',
    ``,
    kpis.pont.total > 0 ? `⏱️ PONTUALIDADE (${kpis.pont.total} viagens com status):` : '⏱️ PONTUALIDADE: sem dados',
    kpis.pont.total > 0 ? `   Adiantado: ${parcela(kpis.pont.adiantado, kpis.pont.total)}% | No Prazo: ${parcela(kpis.pont.no_prazo, kpis.pont.total)}% | Atrasado: ${parcela(kpis.pont.atrasado, kpis.pont.total)}% (meta ≤ 5%)` : '',
  ].join('\n')
}

export function textoDoWhatsApp(
  kpis: Indicadores,
  rotas: readonly Rota[],
  filtros: Filtros,
  agora: Date,
): string {
  const semaforo = (val: number | null, meta: number): string => {
    if (val === null) return '⚪'
    return val < meta ? '🟢' : val < meta * 1.3 ? '🟡' : '🔴'
  }

  const pt = kpis.pont
  const ptTxt = pt.total > 0
    ? `✅ ${parcela(pt.adiantado, pt.total)}% adiant. | 🟡 ${parcela(pt.no_prazo, pt.total)}% prazo | 🔴 ${parcela(pt.atrasado, pt.total)}% atraso`
    : 'Sem dados'

  const rotasCrit = rotas.filter((r) => r.pct >= 7).slice(0, 3)
  const linhasRotas = rotasCrit.length > 0
    ? rotasCrit.map((r) => `   • ${r.rota}: ${r.pct.toFixed(1)}% ${r.pct < 10 ? '⚠️' : '🔴'}`).join('\n')
    : '   ✅ Todas as rotas dentro da meta'

  return [
    `📊 *LOGÍSTICA EM VIDROS — ${BASES[filtros.base].noRelatorio.toUpperCase()}*`,
    `_${PERIODOS[filtros.periodo].noRelatorio} · ${agora.toLocaleDateString('pt-BR')}_`,
    ``,
    `🚛 *VIAGENS*: ${kpis.viagens.length} viagem(ns)`,
    `   Carga: ${brl(kpis.totalCarga)}`,
    `   Custo: ${brl(kpis.totalCustoV)}`,
    kpis.pctCustoRota !== null ? `   ${semaforo(kpis.pctCustoRota, 7)} % Custo/Carga: *${fmtPct(kpis.pctCustoRota)}* (meta < 7%)` : `   ⚪ % Custo/Carga: —`,
    ``,
    `📍 *ROTAS ACIMA DA META:*`,
    linhasRotas,
    ``,
    `⏱️ *PONTUALIDADE*:`,
    `   ${ptTxt}`,
    `   Meta: ≤ 5% atraso`,
    ``,
    `🔧 *MANUTENÇÃO*: ${brl(kpis.totalManut)}`,
    kpis.pctManutProd !== null ? `   ${semaforo(kpis.pctManutProd, 2)} % Manut/Produção: *${fmtPct(kpis.pctManutProd)}* (meta < 2%)` : `   ⚪ % Manut/Produção: —`,
    ``,
    `⛽ *ABASTECIMENTO*: ${brl(kpis.totalAbast)}`,
    ``,
    kpis.pctQuebra !== null
      ? `📦 *QUEBRA EXPEDIÇÃO*: ${semaforo(kpis.pctQuebra, 1)} *${fmtPct(kpis.pctQuebra)}* (meta < 1%)`
      : `📦 *QUEBRA EXPEDIÇÃO*: ⚪ sem registros`,
    ``,
    `_Gerado pelo Sistema de Indicadores EM Vidros_`,
  ].join('\n')
}

function baixar(nome: string, corpo: BlobPart, tipo: string): void {
  const url = URL.createObjectURL(new Blob([corpo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function baixarTexto(nome: string, texto: string): void {
  baixar(nome, texto, 'text/plain;charset=utf-8')
}

/**
 * O CSV que os botoes "Exportar" produzem, com `;` e BOM porque quem abre abre no Excel
 * em pt-BR, onde a virgula ja e separador decimal e o UTF-8 sem BOM vira acento quebrado.
 */
export function baixarCsv(nome: string, linhas: ReadonlyArray<readonly string[]>): void {
  const escapar = (celula: string): string =>
    /[";\n]/.test(celula) ? `"${celula.replaceAll('"', '""')}"` : celula
  const corpo = linhas.map((linha) => linha.map(escapar).join(';')).join('\n')
  baixar(nome, `﻿${corpo}`, 'text/csv;charset=utf-8')
}

/** `false` quando o navegador recusa a area de transferencia, e ai quem chamou decide. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
