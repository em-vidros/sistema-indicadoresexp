# Tipo do pneu (direcional, tração, misto) — o que mudou e como voltar atrás

Mudança de 20/11/2026. Migração `0019_gigantic_tyrannus.sql`.

## O que entra
- **Estoque de pneus**: nova coluna `estoque_pneu.tipo_pneu` (`direcional`, `tracao`, `misto`, ou vazio
  nas linhas lançadas antes). O tipo passa a fazer parte da identidade da linha de estoque: a chave
  única agora é base × medida × marca × **tipo** × condição. A mesma medida de tipos diferentes é
  saldo separado.
- **Pneus nos veículos**: nova coluna `pneu.tipo_pneu`, **nula** nos pneus já cadastrados e opcional
  no formulário.
- Toda **entrada** nova no estoque exige o tipo. As linhas antigas (sem tipo) aparecem como "Sem tipo"
  e aceitam **saída** e **ajuste**, nunca entrada, e não nasce linha nova sem tipo.

## Risco
Baixo. A migração só adiciona duas colunas (com valor padrão vazio / nulo) e troca a chave única do
estoque por outra que inclui o tipo, mais larga, então nenhuma linha existente passa a conflitar. Os
pneus e o saldo que já existem ficam intactos, como "Sem tipo".

## Backup
Ponto de restauração do Neon antes do deploy (Henrique). Os arquivos alterados estão em
`backup-manutencao-2026-11-05/etapa12-tipo-pneu`.

## Como voltar atrás
1. **Reverter o commit.** O código volta a ignorar as colunas, que ficam no banco sem atrapalhar.
2. **Remover as colunas** (só depois do passo 1; perde o tipo gravado):
   ```sql
   ALTER TABLE "estoque_pneu" DROP CONSTRAINT "estoque_pneu_chave_uk";
   ALTER TABLE "estoque_pneu" DROP CONSTRAINT "estoque_pneu_tipo_ck";
   ALTER TABLE "estoque_pneu" DROP COLUMN "tipo_pneu";
   ALTER TABLE "estoque_pneu" ADD CONSTRAINT "estoque_pneu_chave_uk"
     UNIQUE ("base_id", "medida", "marca", "recapagens");
   ALTER TABLE "pneu" DROP CONSTRAINT "pneu_tipo_ck";
   ALTER TABLE "pneu" DROP COLUMN "tipo_pneu";
   DELETE FROM drizzle.__drizzle_migrations WHERE hash = '<hash da 0019>';
   ```
   Atenção: se já houver linhas de estoque que só se diferenciam pelo tipo, recriar a chave antiga
   falha. Junte-as antes (some os saldos) ou não remova a coluna. O rollback do workflow não desfaz
   migrações; este passo é manual.
