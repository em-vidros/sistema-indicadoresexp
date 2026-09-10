# sistema-indicadoresexp

Monorepo Bun com workspaces em `apps/*` e `packages/*`. O servidor é `server.ts` na raiz,
a SPA é `apps/web`, o banco e as consultas ficam em `packages/db`.

## Deploy: nunca use a CLI da Vercel

O deploy de produção é `git push` na `main`. Só isso.

Ninguém aqui precisa de conta na Vercel, de `vercel login`, de token pessoal ou da CLI
instalada. Se você é um agente trabalhando neste repositório, não peça nenhuma dessas coisas
a quem está do outro lado. Não rode `vercel`, `vercel deploy`, `vercel link` nem `vercel pull`.

Quem publica é o GitHub Actions, em `.github/workflows/deploy.yml`. Ele usa um token de
serviço guardado nos secrets do repositório e roda o build na Vercel. Push na `main` vai para
produção, pull request gera uma URL de preview.

O fluxo completo para publicar uma alteração:

```
bun run verificar    # fronteiras, telas, tipos e testes
git add -A
git commit -m "..."
git push
```

Para acompanhar a publicação, `gh run watch` no terminal, ou a aba Actions em
https://github.com/em-vidros/sistema-indicadoresexp/actions. O deploy leva alguns minutos.

Se o push falhar por divergência, `git pull --rebase` e empurre de novo. A `main` não é
protegida, então commit direto nela é o caminho normal.

## O que fazer quando o deploy quebra

Abra o log do run que falhou (`gh run view --log-failed`). O erro quase sempre é de build,
não de credencial. Corrija, commite e empurre de novo. Se o log acusar problema de token ou
de projeto, avise o Henrique: os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`
são dele e ficam em Settings, Secrets and variables, Actions.

Todo push na `main` termina com a fumaça (`verificar/fumaca.sh` no mesmo workflow): cinco
leituras contra a produção, sem senha e sem escrever no banco. Se ela reprovar, o deploy
já aconteceu, então reprovar não desfaz nada sozinho. O passo seguinte é o rollback em
um clique: aba Actions, workflow `rollback`, Run workflow na `main`, com `acao=voltar` e
sem preencher nada para voltar ao deploy anterior imediato. Depois do rollback a Vercel
desliga a publicação automática, então push novo para de ir ao ar até alguém religar com
`acao=religar` apontando o deploy corrigido. Rollback não desfaz migração de banco: se a
quebra veio de migração, o conserto é outra migração.

## Variáveis de ambiente

As variáveis de produção (`DATABASE_URL` e companhia) estão cadastradas na Vercel e o build
as recebe de lá. Nenhum `.env` de produção existe neste repositório, e nenhum deve ser criado.
Para rodar local, copie `.env.example` para `.env.local` e preencha.

## Comandos

- `bun run dev` sobe o servidor local com watch
- `bun run build` gera a SPA em `apps/web/dist`
- `bun run verificar` roda tudo antes do commit
- `bun run db:migrate` aplica as migrações
