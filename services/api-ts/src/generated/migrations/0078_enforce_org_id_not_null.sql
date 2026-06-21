-- Wave-1 findings remediation: enforce P0-7 multi-tenant org_id NOT NULL.
-- billing.schema.ts (invoice) and notification-preferences.schema.ts already declare
-- organizationId .notNull(), but the original SET NOT NULL was left commented out in an
-- earlier migration, so the live columns stayed nullable (schema-vs-DB drift). invoice has
-- zero null rows; notification_preference has orphan rows with no org (a preference must be
-- scoped to an org), which are removed before the constraint is added.
DELETE FROM "notification_preference" WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "notification_preference" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "organization_id" SET NOT NULL;
