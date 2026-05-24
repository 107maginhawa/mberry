-- Wave 6: Surveys & NPS module tables
-- Schema: services/api-ts/src/handlers/surveys/repos/survey.schema.ts

CREATE TABLE IF NOT EXISTS "survey" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid REFERENCES "person"("id") ON DELETE RESTRICT,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "survey_type" varchar(20) NOT NULL,
  "questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "analytics_snapshot" jsonb
);

CREATE TABLE IF NOT EXISTS "survey_response" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL REFERENCES "survey"("id") ON DELETE CASCADE,
  "responder_id" uuid NOT NULL REFERENCES "person"("id") ON DELETE RESTRICT,
  "answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "completed_at" timestamp,
  "context_id" uuid
);

-- Indexes
CREATE INDEX IF NOT EXISTS "surveys_org_idx" ON "survey" ("organization_id");
CREATE INDEX IF NOT EXISTS "surveys_status_idx" ON "survey" ("status");
CREATE INDEX IF NOT EXISTS "surveys_type_idx" ON "survey" ("survey_type");
CREATE INDEX IF NOT EXISTS "surveys_created_by_idx" ON "survey" ("created_by");

CREATE INDEX IF NOT EXISTS "survey_responses_org_idx" ON "survey_response" ("organization_id");
CREATE INDEX IF NOT EXISTS "survey_responses_survey_idx" ON "survey_response" ("survey_id");
CREATE INDEX IF NOT EXISTS "survey_responses_responder_idx" ON "survey_response" ("responder_id");
CREATE INDEX IF NOT EXISTS "survey_responses_status_idx" ON "survey_response" ("status");

-- Unique constraint: one response per survey per responder
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_responses_survey_responder_unique"
  UNIQUE ("survey_id", "responder_id");
