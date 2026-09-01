ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_hora_sem_segundo_ck" CHECK (COALESCE(EXTRACT(SECOND FROM "manutencao"."hora_entrada"), 0) = 0
          AND COALESCE(EXTRACT(SECOND FROM "manutencao"."hora_saida"), 0) = 0);--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_hora_sem_segundo_ck" CHECK (COALESCE(EXTRACT(SECOND FROM "viagem"."hora_saida"), 0) = 0
          AND COALESCE(EXTRACT(SECOND FROM "viagem"."hora_prevista"), 0) = 0
          AND COALESCE(EXTRACT(SECOND FROM "viagem"."hora_chegada"), 0) = 0);