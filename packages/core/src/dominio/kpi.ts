import { z } from 'zod'

export const Direcao = z.enum(['menor_melhor', 'maior_melhor'])
export type Direcao = z.infer<typeof Direcao>

/**
 * A ordem dos dois limites e parte do limiar, nao convencao de quem semeia. Com
 * `{ direcao: 'menor_melhor', limiteOk: 9, limiteAtencao: 7 }`, todo valor que
 * passa de 7 ja passou de 9: a faixa amarela fica inalcancavel e `avaliarKpi(8, ...)`
 * responde `ok`. Sao quatro linhas de `meta` vindas do seed, e um par trocado nao
 * daria erro em lugar nenhum. Nulo continua valido, porque o percentual de atraso
 * (linha 431 do dashboard) so tem duas faixas.
 */
export const Limiar = z
  .object({
    direcao: Direcao,
    limiteOk: z.number(),
    limiteAtencao: z.number().nullable(),
  })
  .superRefine((l, ctx) => {
    if (l.limiteAtencao === null) return
    const invertido =
      l.direcao === 'menor_melhor'
        ? l.limiteAtencao < l.limiteOk
        : l.limiteAtencao > l.limiteOk
    if (invertido) {
      ctx.addIssue({
        code: 'custom',
        message:
          l.direcao === 'menor_melhor'
            ? 'em menor_melhor, limiteAtencao tem que ser maior ou igual a limiteOk'
            : 'em maior_melhor, limiteAtencao tem que ser menor ou igual a limiteOk',
        path: ['limiteAtencao'],
      })
    }
  })
export type Limiar = z.infer<typeof Limiar>

export const Semaforo = z.enum(['ok', 'atencao', 'critico', 'sem_dado'])
export type Semaforo = z.infer<typeof Semaforo>

/**
 * A fronteira e sempre inclusiva, nos dois sentidos. Hoje o dashboard usa `<` no
 * custo por carga, na quebra e na manutencao sobre producao, e `<=` no percentual
 * de atraso (linha 431). Duas regras para a mesma pergunta custa mais que mudar a
 * cor no valor exato da fronteira: com `<`, um custo de exatamente 7% num limiar
 * de 7 aparece amarelo, e ninguem consegue explicar isso para a Livia.
 */
export function avaliarKpi(valor: number | null, limiar: Limiar): Semaforo {
  if (valor === null) return 'sem_dado'

  const dentro = (limite: number): boolean =>
    limiar.direcao === 'menor_melhor' ? valor <= limite : valor >= limite

  if (dentro(limiar.limiteOk)) return 'ok'
  if (limiar.limiteAtencao === null) return 'atencao'
  if (dentro(limiar.limiteAtencao)) return 'atencao'
  return 'critico'
}
