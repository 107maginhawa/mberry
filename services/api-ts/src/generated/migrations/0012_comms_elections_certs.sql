-- F2: Communications, Elections, and Certificates module tables (not tracked by Drizzle — schema in .types.ts)

-- ─── Enums: Communications ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'scheduled', 'sent', 'scheduled_failed', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."announcement_visibility" AS ENUM('internal', 'network');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── Enums: Elections ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."election_type" AS ENUM('officer', 'bylaw');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."election_status" AS ENUM('draft', 'nominations_open', 'voting_open', 'awaiting_confirmation', 'published', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."voting_mode" AS ENUM('online', 'in_person', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."nominee_status" AS ENUM('nominated', 'accepted', 'declined', 'elected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint

-- ─── Tables: Communications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "announcement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "person"("id"),
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL,
  "audience_type" varchar(20) DEFAULT 'all' NOT NULL,
  "audience_categories" jsonb,
  "channel_push" boolean DEFAULT true NOT NULL,
  "channel_email" boolean DEFAULT false NOT NULL,
  "visibility" "announcement_visibility" DEFAULT 'internal' NOT NULL,
  "status" "announcement_status" DEFAULT 'draft' NOT NULL,
  "scheduled_at" timestamp,
  "published_at" timestamp
);

CREATE TABLE IF NOT EXISTS "announcement_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "announcement_id" uuid NOT NULL REFERENCES "announcement"("id") ON DELETE CASCADE,
  "recipients" integer DEFAULT 0 NOT NULL,
  "inapp_views" integer DEFAULT 0 NOT NULL,
  "push_delivered" integer DEFAULT 0 NOT NULL,
  "email_sent" integer DEFAULT 0 NOT NULL,
  "email_opened" integer DEFAULT 0 NOT NULL
);

-- ─── Tables: Elections ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "election" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "type" "election_type" DEFAULT 'officer' NOT NULL,
  "status" "election_status" DEFAULT 'draft' NOT NULL,
  "voting_mode" "voting_mode" DEFAULT 'online' NOT NULL,
  "nominations_open_at" timestamp,
  "nominations_close_at" timestamp,
  "voting_open_at" timestamp,
  "voting_close_at" timestamp,
  "passage_threshold" integer,
  "positions" jsonb,
  "published_at" timestamp
);

CREATE TABLE IF NOT EXISTS "election_nominee" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "election_id" uuid NOT NULL REFERENCES "election"("id") ON DELETE CASCADE,
  "position_id" varchar(50) NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "person"("id"),
  "nominated_by" uuid REFERENCES "person"("id"),
  "status" "nominee_status" DEFAULT 'nominated' NOT NULL
);

CREATE TABLE IF NOT EXISTS "election_vote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "election_id" uuid NOT NULL REFERENCES "election"("id") ON DELETE CASCADE,
  "position_id" varchar(50) NOT NULL,
  "nominee_id" uuid NOT NULL REFERENCES "election_nominee"("id"),
  "voter_id" uuid NOT NULL REFERENCES "person"("id")
);

-- ─── Tables: Certificates ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "certificate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "person"("id") ON DELETE CASCADE,
  "training_id" uuid NOT NULL,
  "certificate_number" varchar(50) NOT NULL,
  "issued_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- ─── Indexes: Communications ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "announcement_org_idx" ON "announcement" ("organization_id");
CREATE INDEX IF NOT EXISTS "announcement_status_idx" ON "announcement" ("status");
CREATE INDEX IF NOT EXISTS "announcement_org_status_idx" ON "announcement" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "ann_stats_announcement_idx" ON "announcement_stats" ("announcement_id");

-- ─── Indexes: Elections ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "election_org_idx" ON "election" ("organization_id");
CREATE INDEX IF NOT EXISTS "election_status_idx" ON "election" ("status");
CREATE INDEX IF NOT EXISTS "nominee_election_idx" ON "election_nominee" ("election_id");
CREATE INDEX IF NOT EXISTS "nominee_person_idx" ON "election_nominee" ("person_id");
CREATE INDEX IF NOT EXISTS "vote_election_idx" ON "election_vote" ("election_id");
CREATE INDEX IF NOT EXISTS "vote_voter_idx" ON "election_vote" ("voter_id");
CREATE INDEX IF NOT EXISTS "vote_election_voter_idx" ON "election_vote" ("election_id", "voter_id", "position_id");

-- ─── Indexes: Certificates ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "certificate_org_idx" ON "certificate" ("organization_id");
CREATE INDEX IF NOT EXISTS "certificate_person_idx" ON "certificate" ("person_id");
CREATE INDEX IF NOT EXISTS "certificate_training_idx" ON "certificate" ("training_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_cert_num_unique" ON "certificate" ("certificate_number");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_training_person_unique" ON "certificate" ("training_id", "person_id");
