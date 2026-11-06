# KM atual do veículo: backup e rollback

Mudança de 06/11/2026. Aba "KM atual" na Manutenção, com o km do veículo informado à mão.

## O que muda no banco de produção

Migração `0015_empty_smiling_tiger.sql`, só aditiva, na tabela `veiculo`:

```sql
ALTER TABLE "veiculo" ADD COLUMN "km_atual" integer;
ALTER TABLE "veiculo" ADD COLUMN "km_atual_em" timestamp with time zone;
ALTER TABLE "veiculo" ADD COLUMN "km_atual_por" text;
```

As três colunas aceitam nulo e começam vazias. Nenhuma linha existente muda, nenhuma
consulta antiga quebra: veículo sem `km_atual` continua usando o maior km dos registros.

## Antes de publicar (backup)

Quem tem acesso à Neon (Henrique) cria um ponto de restauração ou branch do banco de
produção antes do push na `main`. A migração roda no workflow `deploy`, antes do deploy.
Se ela falhar, o deploy não acontece e a produção fica como está.

## Como voltar atrás

1. **Código:** aba Actions, workflow `rollback`, Run workflow com `acao=voltar` (volta ao
   deploy anterior). Com o código antigo no ar, as colunas novas ficam sem uso e não fazem mal.
2. **Colunas (só se for preciso removê-las):** migração nova, nunca editando a 0015, com:

```sql
ALTER TABLE "veiculo" DROP COLUMN "km_atual";
ALTER TABLE "veiculo" DROP COLUMN "km_atual_em";
ALTER TABLE "veiculo" DROP COLUMN "km_atual_por";
```

   Isso apaga os km informados à mão, que não existem em outro lugar. Antes de dropar, copiar
   `select placa, km_atual, km_atual_em, km_atual_por from veiculo where km_atual is not null`.
3. **Só limpar os km manuais, sem tirar as colunas:** `update veiculo set km_atual = null,
   km_atual_em = null, km_atual_por = null;` devolve todos os veículos ao km dos registros.
   Também dá para fazer um por um, pelo botão "Usar registros" da aba.

## Regra de uso

O km informado vale primeiro no cálculo do vencimento da preventiva, mesmo menor que o dos
registros. A aba mostra o km dos registros ao lado e avisa quando ele é maior que o manual.
