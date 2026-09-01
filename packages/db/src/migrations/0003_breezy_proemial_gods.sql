ALTER TABLE "abastecimento_parada" DROP CONSTRAINT "abastecimento_parada_nao_negativo_ck";--> statement-breakpoint
ALTER TABLE "quebra" DROP CONSTRAINT "quebra_nao_negativo_ck";--> statement-breakpoint
ALTER TABLE "viagem" DROP CONSTRAINT "viagem_nao_negativo_ck";--> statement-breakpoint
ALTER TABLE "documento" DROP CONSTRAINT "documento_fonte_ck";--> statement-breakpoint
ALTER TABLE "abastecimento_parada" ADD CONSTRAINT "abastecimento_parada_nao_negativo_ck" CHECK ("abastecimento_parada"."litros" > 0 AND "abastecimento_parada"."vl_litro" >= 0 AND ("abastecimento_parada"."km" IS NULL OR "abastecimento_parada"."km" > 0));--> statement-breakpoint
ALTER TABLE "quebra" ADD CONSTRAINT "quebra_nao_negativo_ck" CHECK ("quebra"."m2_expedido" > 0 AND "quebra"."m2_quebrado" >= 0);--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_custo_ck" CHECK ("viagem"."combustivel" + "viagem"."diarias" > 0);--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_chegada_ordem_ck" CHECK (CASE
            WHEN "viagem"."data_chegada" IS NULL THEN TRUE
            WHEN "viagem"."hora_saida" IS NULL OR "viagem"."hora_chegada" IS NULL
              THEN "viagem"."data_chegada" >= "viagem"."data_saida"
            ELSE ("viagem"."data_chegada" + "viagem"."hora_chegada") >= ("viagem"."data_saida" + "viagem"."hora_saida")
          END);--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_janela_ck" CHECK ("viagem"."data_saida" BETWEEN DATE '2020-01-01' AND DATE '2100-01-01'
          AND ("viagem"."data_prevista" IS NULL
               OR "viagem"."data_prevista" BETWEEN DATE '2020-01-01' AND DATE '2100-01-01')
          AND ("viagem"."data_chegada" IS NULL
               OR "viagem"."data_chegada" BETWEEN DATE '2020-01-01' AND DATE '2100-01-01'));--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_nao_negativo_ck" CHECK ("viagem"."km_saida" >= 0
          AND ("viagem"."km_chegada" IS NULL OR "viagem"."km_chegada" >= 0)
          AND "viagem"."valor_carga" > 0
          AND "viagem"."combustivel" >= 0
          AND "viagem"."diarias" >= 0
          AND ("viagem"."m2" IS NULL OR "viagem"."m2" >= 0)
          AND ("viagem"."peso_kg" IS NULL OR "viagem"."peso_kg" >= 0));--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_fonte_ck" CHECK ("documento"."arquivo_id" IS NOT NULL
          OR COALESCE("documento"."link_externo", '') ~ '^https?://[^[:space:]]+$'
          OR COALESCE("documento"."link_externo", '') ~ '^[^[:space:]:]+$');--> statement-breakpoint
ALTER TABLE "meta" ADD CONSTRAINT "meta_limite_ck" CHECK ("meta"."limite_atencao" IS NULL
          OR ("meta"."direcao" = 'menor_melhor' AND "meta"."limite_atencao" >= "meta"."limite_ok")
          OR ("meta"."direcao" = 'maior_melhor' AND "meta"."limite_atencao" <= "meta"."limite_ok"));