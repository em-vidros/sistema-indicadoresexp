import { z } from 'zod'
import { BaseId } from './ids.ts'

export const TipoRegistro = z.enum(['viagem', 'abastecimento', 'manutencao', 'quebra'])
export type TipoRegistro = z.infer<typeof TipoRegistro>

export const Permissao = z.object({
  admin: z.boolean(),
  bases: z.array(BaseId).readonly(),
  tipos: z.array(TipoRegistro).readonly(),
})
export type Permissao = z.infer<typeof Permissao>

export function podeRegistrar(p: Permissao, base: BaseId, tipo: TipoRegistro): boolean {
  if (p.admin) return true
  return p.bases.includes(base) && p.tipos.includes(tipo)
}
