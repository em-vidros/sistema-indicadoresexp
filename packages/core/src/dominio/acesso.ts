import { z } from 'zod'
import { BaseId } from './ids.ts'

export const TipoRegistro = z.enum(['viagem', 'abastecimento', 'manutencao', 'quebra'])
export type TipoRegistro = z.infer<typeof TipoRegistro>

/**
 * Tres papeis no lugar do booleano `admin`.
 *
 * O booleano so sabia responder uma pergunta, e o produto passou a fazer outras
 * duas: quem edita cadastro sem mexer em usuario, e quem so lanca registro. A
 * saida obvia seria um booleano por pergunta, e ela e pior: tres booleanos
 * independentes admitem oito combinacoes e cinco delas ninguem pediu. Um enum de
 * tres valores admite tres.
 */
export const Papel = z.enum(['admin', 'gestor', 'operador'])
export type Papel = z.infer<typeof Papel>

export type Capacidades = {
  readonly todasAsBases: boolean
  readonly gerenciaUsuarios: boolean
  readonly editaCadastro: boolean
}

/**
 * A unica autoridade sobre o que um papel pode. Nenhum outro arquivo compara
 * papel com string: quem precisa saber consulta a tabela.
 *
 * A regra vale para o servidor tambem, e nao so para desenhar tela. Quem monta a
 * sessao resolve as capacidades aqui e manda resolvidas, entao o navegador nunca
 * recalcula, e no dia em que o gestor ganhar uma capacidade a mudanca e uma
 * linha desta tabela em vez de uma cacada por `=== 'admin'`.
 */
export const CAPACIDADES: Readonly<Record<Papel, Capacidades>> = {
  admin: { todasAsBases: true, gerenciaUsuarios: true, editaCadastro: true },
  gestor: { todasAsBases: false, gerenciaUsuarios: false, editaCadastro: true },
  operador: { todasAsBases: false, gerenciaUsuarios: false, editaCadastro: false },
}

export const Permissao = z.object({
  papel: Papel,
  bases: z.array(BaseId).readonly(),
  tipos: z.array(TipoRegistro).readonly(),
})
export type Permissao = z.infer<typeof Permissao>

/**
 * Ver todas as bases e ter base fixa sao o mesmo fato dito ao contrario, e o
 * banco escreve isso no CHECK `user_papel_base_ck`. Aqui a mesma frase em
 * TypeScript, para a rota recusar com 400 e mensagem em vez de deixar o INSERT
 * estourar com o nome de uma constraint.
 *
 * O CHECK compara com `'admin'` literal, porque SQL nao le esta tabela. Enquanto
 * admin for o unico papel com `todasAsBases`, as duas frases dizem o mesmo, e
 * `acesso.test.ts` reprova o dia em que deixarem de dizer.
 */
export function baseFixaCoerente(papel: Papel, temBaseFixa: boolean): boolean {
  return CAPACIDADES[papel].todasAsBases !== temBaseFixa
}

export function podeRegistrar(p: Permissao, base: BaseId, tipo: TipoRegistro): boolean {
  if (CAPACIDADES[p.papel].todasAsBases) return true
  return p.bases.includes(base) && p.tipos.includes(tipo)
}
