CREATE TYPE "public"."status_pneu" AS ENUM('novo', 'recapado', 'sucateado');--> statement-breakpoint
CREATE TABLE "pneu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"posicao" text NOT NULL,
	"numero_fogo" text,
	"marca" text,
	"status" "status_pneu" DEFAULT 'novo' NOT NULL,
	"recapagens" integer DEFAULT 0 NOT NULL,
	"km_instalado" integer,
	"data_instalado" date,
	"observacao" text,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "veiculo" ADD COLUMN "eixos" integer;--> statement-breakpoint
ALTER TABLE "pneu" ADD CONSTRAINT "pneu_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pneu_veiculo_posicao_uk" ON "pneu" USING btree ("veiculo_id","posicao") WHERE "pneu"."ativo" = true;