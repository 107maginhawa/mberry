-- Wave 0 T1: Contract phase — enforce NOT NULL on organization.slug
-- Runs after 0040_slug_backfill which populated all NULL slugs
ALTER TABLE "organization" ALTER COLUMN "slug" SET NOT NULL;
