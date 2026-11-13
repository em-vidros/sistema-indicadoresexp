CREATE TABLE "atividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" text,
	"acao" text NOT NULL,
	"tipo" text NOT NULL,
	"base" text,
	"registro_id" text,
	"resumo" text NOT NULL,
	"mudancas" jsonb,
	CONSTRAINT "atividade_acao_ck" CHECK ("atividade"."acao" in ('criou', 'alterou', 'apagou')),
	CONSTRAINT "atividade_tipo_ck" CHECK ("atividade"."tipo" in ('viagem', 'abastecimento', 'manutencao', 'quebra', 'km_atual'))
);
--> statement-breakpoint
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atividade_quando_idx" ON "atividade" USING btree ("quando");