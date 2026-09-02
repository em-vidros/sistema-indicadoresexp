/**
 * O estado do projeto Neon, em codigo.
 *
 * `neon config apply`, que a CLI tambem chama de `neon deploy`, reconcilia a branch
 * de producao com o que esta declarado aqui. Ele nao publica o app: quem hospeda o
 * Hono e a Vercel, e as duas coisas nao se sobrepoem.
 *
 * A config esta vazia de proposito. O schema deste projeto vem das migracoes do
 * Drizzle, e nada do que o `defineConfig` oferece (Neon Auth, Data API) esta em uso.
 * Declarar recurso que ninguem usa e dar ao `apply` permissao para ligar e desligar
 * coisa em producao sem que ninguem tenha pedido. Antes de qualquer `apply`, rode
 * `neon config plan` e leia o diff.
 */
import { defineConfig } from '@neon/config/v1'

export default defineConfig({})
