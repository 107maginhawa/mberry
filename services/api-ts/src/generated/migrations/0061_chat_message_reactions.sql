-- Hand-written migration: create chat_message_reaction table.
-- The Drizzle schema (src/handlers/comms/repos/comms.schema.ts) defines
-- `chatMessageReactions` but no auto-generated migration ever shipped it
-- because `bun run db:generate` (drizzle-kit) fails with exit 127 in CI
-- (drizzle-kit binary missing on PATH; the generate.ts try/catch
-- intentionally swallows that error and warns). Hand-writing the table
-- here unblocks fresh-DB boots without requiring drizzle-kit to be
-- installed in CI.

CREATE TABLE IF NOT EXISTS "chat_message_reaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat_message_reaction"
    ADD CONSTRAINT "chat_message_reaction_message_id_chat_message_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_message_reactions_message_idx"
  ON "chat_message_reaction" USING btree ("message_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat_message_reaction"
    ADD CONSTRAINT "chat_message_reactions_unique"
    UNIQUE ("message_id", "person_id", "emoji");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
