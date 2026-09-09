/**
 * O travessao esta proibido no texto visivel, e parte do dado do banco veio com ele
 * (titulos de semana da integracao, do plano PGQ). Trocar o dado e migracao em producao;
 * ate la, quem mostra troca. Vira dois-pontos, que e o que o travessao fazia ali.
 */
export function semTravessao(texto: string): string {
  return texto.replace(/\s*[—–]\s*/g, ': ')
}
