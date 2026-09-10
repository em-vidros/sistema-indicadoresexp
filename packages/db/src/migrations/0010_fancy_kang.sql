CREATE TYPE "public"."papel_usuario" AS ENUM('admin', 'gestor', 'operador');--> statement-breakpoint
CREATE TABLE "convite_senha" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convite_senha_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_admin_sem_base_ck";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "papel" "papel_usuario" DEFAULT 'operador' NOT NULL;--> statement-breakpoint
UPDATE "user" SET "papel" = CASE WHEN "admin" THEN 'admin' ELSE 'operador' END::"public"."papel_usuario";--> statement-breakpoint
ALTER TABLE "convite_senha" ADD CONSTRAINT "convite_senha_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "convite_senha_usuario_idx" ON "convite_senha" USING btree ("usuario_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "admin";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_papel_base_ck" CHECK (("user"."papel" = 'admin' AND "user"."base_id" IS NULL) OR ("user"."papel" <> 'admin' AND "user"."base_id" IS NOT NULL));