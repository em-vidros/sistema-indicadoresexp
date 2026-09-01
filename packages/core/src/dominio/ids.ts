import { z } from 'zod'

/**
 * Marcar o id impede trocar `VeiculoId` por `ColaboradorId` numa chamada de tres
 * argumentos, que e o erro que o front de hoje comete de graca.
 *
 * Numeros nao sao marcados. Marcar `Km`, `Litros` e `Reais` obrigaria um
 * construtor em cada literal de seed, de teste e de fixture, e a classe de bug
 * deste app nao e unidade trocada, e limiar divergente. O ADR registra a decisao
 * em "o que eu nao mudei".
 *
 * A marca e escrita literal em cada schema, e nao por uma fabrica generica,
 * porque o `.brand<M>()` do zod 4 perde a marca na saida do `parse` quando `M` e
 * um parametro de tipo: `BaseId.parse('raposa')` voltaria `string` puro.
 */
const idCru = z.string().trim().min(1, 'identificador vazio')

export const BaseId = idCru.brand<'BaseId'>()
export const VeiculoId = idCru.brand<'VeiculoId'>()
export const ColaboradorId = idCru.brand<'ColaboradorId'>()
export const RotaId = idCru.brand<'RotaId'>()
export const ArquivoId = idCru.brand<'ArquivoId'>()
export const ViagemId = idCru.brand<'ViagemId'>()
export const AbastecimentoId = idCru.brand<'AbastecimentoId'>()
export const ParadaId = idCru.brand<'ParadaId'>()
export const ManutencaoId = idCru.brand<'ManutencaoId'>()
export const QuebraId = idCru.brand<'QuebraId'>()
export const DocumentoId = idCru.brand<'DocumentoId'>()
export const AtaId = idCru.brand<'AtaId'>()
export const IntegracaoId = idCru.brand<'IntegracaoId'>()
export const UsuarioId = idCru.brand<'UsuarioId'>()
export const MetaChave = idCru.brand<'MetaChave'>()

export type BaseId = z.infer<typeof BaseId>
export type VeiculoId = z.infer<typeof VeiculoId>
export type ColaboradorId = z.infer<typeof ColaboradorId>
export type RotaId = z.infer<typeof RotaId>
export type ArquivoId = z.infer<typeof ArquivoId>
export type ViagemId = z.infer<typeof ViagemId>
export type AbastecimentoId = z.infer<typeof AbastecimentoId>
export type ParadaId = z.infer<typeof ParadaId>
export type ManutencaoId = z.infer<typeof ManutencaoId>
export type QuebraId = z.infer<typeof QuebraId>
export type DocumentoId = z.infer<typeof DocumentoId>
export type AtaId = z.infer<typeof AtaId>
export type IntegracaoId = z.infer<typeof IntegracaoId>
export type UsuarioId = z.infer<typeof UsuarioId>
export type MetaChave = z.infer<typeof MetaChave>

/** O construtor unico: valida e devolve o id ja marcado. */
export function criarId<E extends z.ZodType<string>>(esquema: E, bruto: string): z.infer<E> {
  return esquema.parse(bruto)
}
