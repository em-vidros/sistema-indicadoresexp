# Viagem de rota local sem custo: backup e rollback

Mudança de 06/11/2026. Rota local (SÃO LUÍS, lojas, BARCARENA, IMPERATRIZ) não tem diária
nem abastecimento, então a viagem dela pode ter combustível e diárias zerados.

## O que muda no banco de produção

Migração `0016_clever_tyger_tiger.sql`, uma linha:

```sql
ALTER TABLE "viagem" DROP CONSTRAINT "viagem_custo_ck";
```

A trava exigia `combustivel + diarias > 0`. Tirá-la não altera nenhuma linha existente: todas
já passavam nela. O banco não enxerga `rota.local` (CHECK não cruza tabela), então a regra passou
para o servidor (`valoresDaViagem`, em `packages/db/src/consultas/registros.ts`) e para o
formulário do Registrar: rota **não** local continua exigindo custo maior que zero, com a mesma
mensagem e o mesmo 400.

## Antes de publicar (backup)

Quem tem acesso à Neon (Henrique) cria um ponto de restauração ou branch antes do push na `main`.
A migração roda no workflow `deploy` antes do deploy. Se falhar, o deploy não acontece.

## Como voltar atrás

1. **Código:** aba Actions, workflow `rollback`, `acao=voltar`.
2. **Trava:** só recolocar se não houver viagem com custo zero, ou a migração falha. Primeiro
   conferir: `select count(*) from viagem where combustivel + diarias <= 0 and apagado_em is null;`
   - Se der 0, migração nova (nunca editar a 0016):
     `ALTER TABLE "viagem" ADD CONSTRAINT "viagem_custo_ck" CHECK ("combustivel" + "diarias" > 0);`
   - Se der mais que 0, essas viagens são de rota local e são legítimas. Recolocar a trava exigiria
     apagá-las ou dar a elas um custo falso. Melhor deixar a trava fora.
3. **Só quem é local:** a lista de rotas locais está no Cadastro (campo `local`). Desmarcar uma rota
   volta a exigir custo nela, sem mexer no banco.

## Efeito nos indicadores

Viagem local sem custo entra com custo R$ 0,00 e % custo 0,00%. Misturada com as viagens de rota
longa, ela baixa o % custo médio. Se isso distorcer algum indicador, filtrar por rota.
