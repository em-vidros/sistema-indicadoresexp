CREATE TABLE "fechamento_mensal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"mes" date NOT NULL,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fechamento_mensal" ADD CONSTRAINT "fechamento_mensal_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamento_mensal" ADD CONSTRAINT "fechamento_mensal_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamento_mensal" ADD CONSTRAINT "fechamento_mensal_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fechamento_mensal_base_mes_uk" ON "fechamento_mensal" USING btree ("base_id","mes") WHERE apagado_em is null;