ALTER TABLE "documento" DROP CONSTRAINT "documento_vencimento_ck";--> statement-breakpoint
ALTER TABLE "documento" DROP CONSTRAINT "documento_cnh_ck";--> statement-breakpoint
ALTER TABLE "viagem" drop column "atraso_min";--> statement-breakpoint
ALTER TABLE "viagem" ADD COLUMN "atraso_min" integer GENERATED ALWAYS AS (FLOOR(
        EXTRACT(
          EPOCH FROM
            (data_chegada + hora_chegada) - (data_prevista + hora_prevista)
        ) / 60 + 0.5
      )::integer) STORED;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_vencimento_ck" CHECK ("documento"."vencimento" IS NULL OR "documento"."tipo" IN ('apolice', 'crlv', 'tacografo', 'cnh'));--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_cnh_ck" CHECK (("documento"."cnh_numero" IS NULL AND "documento"."cnh_categoria" IS NULL) OR "documento"."tipo" = 'cnh');