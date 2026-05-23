CREATE TABLE IF NOT EXISTS "saved_segment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "name" varchar(100) NOT NULL,
  "filters" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_segment_org_idx" ON "saved_segment" ("organization_id");
