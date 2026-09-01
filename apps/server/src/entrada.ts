/**
 * O que toda rota datada precisa dizer sobre data, hora e mensagem de erro.
 *
 * `^\d{4}-\d{2}-\d{2}$` casa `2026-02-31` e `2026-99-99`, que nao existem no
 * calendario, e casa nada quando o campo e so `z.string().nullable()`. O que o
 * Postgres faz com esse texto e recusar a coluna `date` com o codigo 22008 --
 * que nao e 23514 e por isso nao cai na rede de `checkViolado` em
 * `rotas-registros.ts`. O cliente recebia 500 por ter digitado um dia errado, e
 * 500 diz que o defeito e nosso e que nao adianta ele mexer no que mandou.
 *
 * `ehDataValida` e `ehHoraValida` moram em `@ind/core` e conferem o valor de
 * verdade: mes, dia do mes e ano bissexto. Elas existem desde a fase 0; as
 * rotas da fase 2 as ignoraram e escreveram o regex a mao.
 *
 * Isto e um arquivo so porque as tres rotas datadas precisam da mesma regra.
 * Regra de boundary copiada envelhece como regra de permissao copiada: quando
 * ela muda, a copia esquecida nao quebra teste nenhum -- ela aceita em silencio.
 */
import { ehDataValida, ehHoraValida } from '@ind/core'
import { z } from 'zod'

export const MENSAGEM_DATA = 'data inválida: use AAAA-MM-DD com um dia que exista no calendário'
export const MENSAGEM_HORA = 'hora inválida: use HH:MM entre 00:00 e 23:59'

/** Coluna `date` obrigatoria. */
export const Data = z.string().trim().refine(ehDataValida, MENSAGEM_DATA)

/** Coluna `time` obrigatoria. */
export const Hora = z.string().trim().refine(ehHoraValida, MENSAGEM_HORA)

/**
 * O campo que a tela manda vazio quando a pessoa nao preencheu. `''` vira nulo,
 * porque `<input type="date">` em branco chega assim e nulo e o que a coluna
 * aceita.
 */
export const TextoOuNulo = z
  .string()
  .trim()
  .nullable()
  .transform((valor) => valor || null)

/** Coluna `date` anulavel: nulo passa, texto que nao e data nao. */
export const DataOuNula = TextoOuNulo.refine(
  (valor) => valor === null || ehDataValida(valor),
  MENSAGEM_DATA,
)

/** Coluna `time` anulavel. */
export const HoraOuNula = TextoOuNulo.refine(
  (valor) => valor === null || ehHoraValida(valor),
  MENSAGEM_HORA,
)

/**
 * A mensagem escrita a mao vai inteira para o cliente, que a mostra como esta.
 * Erro de forma (campo faltando, numero que chegou como texto) sai com o padrao
 * da rota: ali a mensagem do zod e em ingles e fala de tipo, nao do que a pessoa
 * precisa mudar.
 */
export function mensagemDaEntrada(erro: z.ZodError, padrao: string): string {
  const escritas = erro.issues
    .filter((problema) => problema.code === 'custom')
    .map((problema) => problema.message)
  return escritas.length ? [...new Set(escritas)].join('; ') : padrao
}
