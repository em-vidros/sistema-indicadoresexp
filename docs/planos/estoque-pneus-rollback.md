# Estoque de pneus — o que mudou e como voltar atrás

Mudança de 19/11/2026. Migração `0018_amused_klaw.sql`.

## O que entra
- **Duas tabelas novas** (só acrescenta; nenhuma tabela existente é alterada):
  - `estoque_pneu`: o saldo por base × medida × marca × condição. Condição = `recapagens`: 0 é
    pneu não recapado (novo), 1 a 3 é quantas vezes já foi recapado. `quantidade` nunca fica negativa
    (CHECK no banco).
  - `estoque_pneu_movimento`: uma linha por movimentação (entrada, saída ou ajuste de inventário),
    com quem fez, quando, a variação com sinal, o saldo depois, o motivo e, na instalação, a placa.
    Só acrescenta.
- **Aba Estoque** na tela Controle de pneus (a aba "Nos veículos" é a tela de sempre, sem mudança).
- Rotas `GET /api/estoque-pneus`, `GET /api/estoque-pneus/movimentos` e
  `POST /api/estoque-pneus/movimentos`.
- O saldo **só muda por movimentação**, na mesma transação que grava o histórico, com a linha do saldo
  travada (`for update`): duas saídas ao mesmo tempo não passam do saldo. O ajuste de inventário é a
  contagem física (o saldo passa a ser o número contado).
- Quem alcança a base mexe no estoque dela; base alheia é 403.

## O que NÃO entra
- Ligação automática com o pneu montado no veículo (instalar não dá baixa sozinho no estoque).
- Estoque mínimo por medida e alerta de reposição.
- Controle por número de fogo de cada pneu em estoque.

## Risco
Baixo. A migração só cria tabelas, índices e chaves estrangeiras para `base` e `user`. Nada existente
é lido, movido ou apagado. A tela de pneus por veículo continua igual.

## Backup
Ponto de restauração do Neon antes do deploy (Henrique). Os arquivos alterados estão copiados em
`backup-manutencao-2026-11-05/etapa11-estoque-pneus`.

## Como voltar atrás
1. **Só desligar a aba**: tirar `EstoqueDePneus` e as `Abas` de `apps/web/src/telas/pneus.tsx`. As
   tabelas continuam, sem dano.
2. **Voltar tudo**: reverter o commit. O código volta a não usar as tabelas, que ficam no banco sem
   atrapalhar.
3. **Remover as tabelas** (só depois do passo 2, e perde o estoque e o histórico gravados):
   ```sql
   DROP TABLE "estoque_pneu_movimento";
   DROP TABLE "estoque_pneu";
   DELETE FROM drizzle.__drizzle_migrations WHERE hash = '<hash da 0018>';
   ```
   O rollback do workflow não desfaz migrações; este passo é manual.
