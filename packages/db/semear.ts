#!/usr/bin/env bun
/**
 * O entrypoint do seed: `bun run db:seed` na raiz, ou `bun semear.ts` aqui dentro.
 *
 * Ele mora no diretorio do pacote e nao em `src/` de proposito. A cerca de
 * `verificar/fronteiras.ts` proibe `packages/db/src/**` de importar `@ind/auth`,
 * com razao, porque `auth` ja importa `db` e a seta nao pode apontar nos dois
 * sentidos. Entao `src/seed.ts` fica puro, recebendo em `Deps` as duas constantes
 * que identificam a conta de senha, e a ligacao dos dois pacotes acontece aqui, ao
 * lado de `drizzle.config.ts`, que e o outro script de pacote que ja vivia fora da
 * cerca.
 *
 * O seed nao grava senha nenhuma, entao nao ha hasher aqui e nao ha variavel
 * `SENHA_*` no `.env`. O que sai daqui e um link por pessoa que ainda nao definiu
 * a dela. O link vale sete dias e so aparece uma vez: o banco guarda o SHA-256 dele
 * e ninguem consegue reimprimi-lo, so gerar outro.
 */
import { ISSUER_SENHA, PROVEDOR_SENHA } from '@ind/auth'
import { criarDb } from './src/index.ts'
import { semear } from './src/seed.ts'

const { db, sql } = criarDb(undefined, { max: 1 })

try {
  const { contagens, convites } = await semear(db, {
    provedorSenha: PROVEDOR_SENHA,
    issuerSenha: ISSUER_SENHA,
  })
  for (const [conjunto, quantos] of Object.entries(contagens)) {
    console.log(`  ${conjunto.padEnd(18)} ${quantos}`)
  }
  console.log('seed aplicado')

  if (convites.length > 0) {
    console.log('\nprimeiro acesso, um link por pessoa que ainda nao tem senha:')
    for (const convite of convites) {
      console.log(`  ${convite.usuario.padEnd(12)} ${convite.url}`)
    }
    console.log(`  os links valem ate ${convites[0]!.expiraEm.toISOString()}`)
  }
} finally {
  await sql.end()
}
