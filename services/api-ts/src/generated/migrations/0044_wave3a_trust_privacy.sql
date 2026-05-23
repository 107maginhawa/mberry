-- Wave 3a: Trust Directory privacy extension + pg_trgm search index

ALTER TABLE "person_privacy_setting" ADD COLUMN "credentials_visible" boolean DEFAULT false NOT NULL;
ALTER TABLE "person_privacy_setting" ADD COLUMN "dues_status_visible" boolean DEFAULT false NOT NULL;
ALTER TABLE "person_privacy_setting" ADD COLUMN "ce_compliance_visible" boolean DEFAULT false NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "directory_profile_trgm_idx" ON "directory_profile" USING gin (
  "display_name" gin_trgm_ops,
  "specialty" gin_trgm_ops
);
