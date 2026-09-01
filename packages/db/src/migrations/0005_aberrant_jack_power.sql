ALTER TABLE "user" ADD COLUMN "admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "base_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_admin_sem_base_ck" CHECK (("user"."admin" AND "user"."base_id" IS NULL) OR (NOT "user"."admin" AND "user"."base_id" IS NOT NULL));