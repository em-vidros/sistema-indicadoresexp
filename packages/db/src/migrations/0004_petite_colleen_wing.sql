ALTER TABLE "manutencao" DROP CONSTRAINT "manutencao_saida_ck";--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_odometro_ck" CHECK ("manutencao"."km_odometro" IS NULL OR "manutencao"."km_odometro" > 0);--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_saida_ck" CHECK ("manutencao"."data_saida" IS NULL
          OR CASE
               WHEN "manutencao"."hora_entrada" IS NOT NULL AND "manutencao"."hora_saida" IS NOT NULL
                 THEN ("manutencao"."data_saida" + "manutencao"."hora_saida") >= ("manutencao"."data_entrada" + "manutencao"."hora_entrada")
               ELSE "manutencao"."data_saida" >= "manutencao"."data_entrada"
             END);