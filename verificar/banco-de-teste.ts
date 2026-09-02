/**
 * A trava que impede a suite de rodar contra o banco de producao.
 *
 * `seed.test.ts` e `sessao.test.ts` fazem `truncate ... restart identity cascade`
 * para partir de um estado conhecido. Isso e correto contra o Postgres da maquina e
 * catastrofico contra a Neon, e a diferenca entre os dois e uma linha do `.env` que
 * alguem trocou para publicar. Nao existe aviso no meio do caminho: o teste passa,
 * verde, e leva o banco junto.
 *
 * Por isso a regra e por host, e nao por nome de ambiente. Host remoto so passa com
 * `PERMITIR_TESTE_REMOTO=1` na linha de comando, que e curto de escrever e
 * impossivel de digitar sem querer.
 *
 * Roda como `preload` de `bun test`, declarado em `bunfig.toml`.
 */
const url = process.env['DATABASE_URL'] ?? ''
const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)

if (url !== '' && !local && process.env['PERMITIR_TESTE_REMOTO'] !== '1') {
  const host = url.replace(/^[^@]*@/, '').replace(/[/?].*$/, '')
  throw new Error(
    `a suite trunca tabelas e DATABASE_URL aponta para ${host}, que nao e local.\n` +
      'Rode contra o Postgres da maquina:\n' +
      '  DATABASE_URL=postgres://indicadores:...@127.0.0.1:5433/indicadores bun run verificar\n' +
      'Se a intencao for mesmo apagar o banco remoto, repita com PERMITIR_TESTE_REMOTO=1.',
  )
}
