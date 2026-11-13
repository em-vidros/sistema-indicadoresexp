# Registro de atividades — o que mudou e como voltar atrás

Mudança de 13/11/2026. Migração `0017_absent_lady_vermin.sql`.

## O que entra
- **Tabela nova `atividade`** (só acrescenta; nenhuma tabela existente é alterada): uma linha por
  ação — lançou, alterou ou apagou — com quem fez, quando, o que foi e, nas alterações, cada campo
  que mudou com o valor antes e depois.
- As linhas são escritas **dentro da mesma transação** do lançamento: uma gravação que falha não
  deixa rastro, e uma que dá certo nunca fica sem ele.
- Registram: viagens, abastecimentos, manutenções, quebras, exclusões (inclusive "Limpar hoje")
  e o km atual dos veículos.
- Tela **Atividades** (`/atividades`) e rota `GET /api/atividades`, só para quem administra o
  sistema (`gerenciaUsuarios`). Operador e gestor recebem 403.
- O registro começa no dia da publicação: o que foi feito antes não tem como ser recuperado (o
  banco só guardava quem criou e quem mexeu por último).

## Risco
Baixo. A migração só cria uma tabela, um índice e uma chave estrangeira para `user`. Nenhum dado
existente é lido, movido ou apagado. O custo é uma ou duas consultas a mais por lançamento, dentro
da transação.

## Backup
Ponto de restauração do Neon, antes do deploy (feito pelo Henrique). Os arquivos alterados estão
copiados em `backup-manutencao-2026-11-05/etapa10-atividades`.

## Como voltar atrás
1. **Só desligar a tela**: remover a linha `atividades` de `apps/web/src/app/rotas.ts` e o caminho
   `/atividades` das duas listas de caminhos. A tabela continua gravando, sem dano.
2. **Voltar tudo**: reverter o commit. O código volta a não escrever em `atividade`. A tabela fica
   no banco, vazia de uso, sem atrapalhar.
3. **Remover a tabela** (só depois do passo 2, senão o código tenta escrever nela):
   ```sql
   DROP TABLE "atividade";
   DELETE FROM drizzle.__drizzle_migrations WHERE hash = '<hash da 0017>';
   ```
   O rollback do workflow não desfaz migrações; este passo é manual e perde o histórico gravado.
