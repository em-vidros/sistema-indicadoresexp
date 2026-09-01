ALTER TABLE "ata" DROP CONSTRAINT "ata_numero_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "ata_numero_base_uk" ON "ata" USING btree ("numero","base_id") WHERE numero is not null and base_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ata_numero_empresa_uk" ON "ata" USING btree ("numero") WHERE numero is not null and base_id is null;