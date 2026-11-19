ALTER TABLE "estoque_pneu" DROP CONSTRAINT "estoque_pneu_chave_uk";--> statement-breakpoint
ALTER TABLE "pneu" ADD COLUMN "tipo_pneu" text;--> statement-breakpoint
ALTER TABLE "estoque_pneu" ADD COLUMN "tipo_pneu" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "estoque_pneu" ADD CONSTRAINT "estoque_pneu_chave_uk" UNIQUE("base_id","medida","marca","tipo_pneu","recapagens");--> statement-breakpoint
ALTER TABLE "pneu" ADD CONSTRAINT "pneu_tipo_ck" CHECK ("pneu"."tipo_pneu" is null or "pneu"."tipo_pneu" in ('direcional', 'tracao', 'misto'));--> statement-breakpoint
ALTER TABLE "estoque_pneu" ADD CONSTRAINT "estoque_pneu_tipo_ck" CHECK ("estoque_pneu"."tipo_pneu" in ('', 'direcional', 'tracao', 'misto'));