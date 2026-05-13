DROP INDEX "membership_org_person_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "membership_org_person_unique" ON "membership" USING btree ("organization_id","person_id");