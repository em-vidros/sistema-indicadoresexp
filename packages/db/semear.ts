#!/usr/bin/env bun
/**
 * O entrypoint do seed: `bun run db:seed` na raiz, ou `bun semear.ts` aqui dentro.
 *
 * Ele mora no diretorio do pacote e nao em `src/` de proposito. `semear` precisa do
 * hasher do better-auth, e a cerca de `verificar/fronteiras.ts` proibe
 * `packages/db/src/**` de importar `@ind/auth` — com razao, porque `auth` ja importa
 * `db` e a seta nao pode apontar nos dois sentidos. Entao `src/seed.ts` fica puro,
 * recebendo a funcao de hash em `Deps`, e a ligacao dos dois pacotes acontece aqui,
 * ao lado de `drizzle.config.ts`, que e o outro script de pacote que ja vivia fora
 * da cerca.
 */
import { ISSUER_SENHA, PROVEDOR_SENHA, criarAuth, hasherDe } from '@ind/auth'
import { criarDb, exigir } from './src/index.ts'
import { semear } from './src/seed.ts'

const { db, sql } = criarDb(undefined, { max: 1 })
const auth = criarAuth(db)
const hasher = await hasherDe(auth)

try {
  const contagens = await semear(db, {
    hashSenha: hasher.hash,
    provedorSenha: PROVEDOR_SENHA,
    issuerSenha: ISSUER_SENHA,
    // Uma variavel por usuario. As quatro senhas antigas estao em base64 no HTML
    // servido ao navegador, entao nenhuma delas pode voltar: `exigir` estoura se a
    // nova faltar, em vez de semear um usuario sem senha.
    senhaDe: (chave) => exigir(`SENHA_${chave.toUpperCase()}`),
  })
  for (const [conjunto, quantos] of Object.entries(contagens)) {
    console.log(`  ${conjunto.padEnd(18)} ${quantos}`)
  }
  console.log('seed aplicado')
} finally {
  await sql.end()
}
