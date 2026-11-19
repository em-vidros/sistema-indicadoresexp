CREATE TABLE "estoque_pneu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"medida" text NOT NULL,
	"marca" text DEFAULT '' NOT NULL,
	"recapagens" integer DEFAULT 0 NOT NULL,
	"quantidade" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_pneu_chave_uk" UNIQUE("base_id","medida","marca","recapagens"),
	CONSTRAINT "estoque_pneu_recapagens_ck" CHECK ("estoque_pneu"."recapagens" between 0 and 3),
	CONSTRAINT "estoque_pneu_quantidade_ck" CHECK ("estoque_pneu"."quantidade" >= 0)
);
--> statement-breakpoint
CREATE TABLE "estoque_pneu_movimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" text,
	"estoque_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"delta" integer NOT NULL,
	"saldo_depois" integer NOT NULL,
	"motivo" text NOT NULL,
	"placa" text,
	"observacao" text,
	CONSTRAINT "estoque_pneu_movimento_tipo_ck" CHECK ("estoque_pneu_movimento"."tipo" in ('entrada', 'saida', 'ajuste')),
	CONSTRAINT "estoque_pneu_movimento_delta_ck" CHECK ("estoque_pneu_movimento"."delta" <> 0),
	CONSTRAINT "estoque_pneu_movimento_saldo_ck" CHECK ("estoque_pneu_movimento"."saldo_depois" >= 0)
);
--> statement-breakpoint
ALTER TABLE "estoque_pneu" ADD CONSTRAINT "estoque_pneu_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_pneu_movimento" ADD CONSTRAINT "estoque_pneu_movimento_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_pneu_movimento" ADD CONSTRAINT "estoque_pneu_movimento_estoque_id_estoque_pneu_id_fk" FOREIGN KEY ("estoque_id") REFERENCES "public"."estoque_pneu"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estoque_pneu_movimento_quando_idx" ON "estoque_pneu_movimento" USING btree ("quando");--> statement-breakpoint
CREATE INDEX "estoque_pneu_movimento_estoque_idx" ON "estoque_pneu_movimento" USING btree ("estoque_id");