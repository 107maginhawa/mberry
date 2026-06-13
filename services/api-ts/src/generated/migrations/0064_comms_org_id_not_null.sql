-- 0064: Backfill chat_room/chat_message.organization_id, then enforce NOT NULL.
--
-- Fixes migration drift (AHA realtime-comms FIX-010): migration 0016 created
-- organization_id as nullable; 0019's conditional SET NOT NULL was skipped while
-- NULL rows existed. The Drizzle schema declares both columns .notNull(), so the
-- DB type was lying. The WebSocket chat path (now fixed by FIX-008, which derives
-- the org from the room row in ChatMessageRepository) had inserted NULL-org
-- messages.
--
-- Hand-written (additive + idempotent): `drizzle-kit generate` is unavailable in
-- this environment, and Drizzle would not emit the required data backfill.

-- 1. Backfill chat_message.organization_id from its parent room. Every message
--    has a valid room (FK, no orphans) and every room has a non-null org, so
--    this repairs all NULL-org messages.
UPDATE "chat_message" m
SET "organization_id" = r."organization_id"
FROM "chat_room" r
WHERE m."chat_room_id" = r."id"
  AND m."organization_id" IS NULL;

-- 2. Enforce NOT NULL to match the schema. Unconditional (NOT guarded): unlike
--    0019's conditional block that silently skipped while NULL rows existed, the
--    backfill above guarantees zero NULLs, so this enforces deterministically and
--    fails loudly if that assumption is ever violated (SET NOT NULL on an
--    already-NOT-NULL column is a harmless no-op, so re-runs are safe).
ALTER TABLE "chat_room" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "chat_message" ALTER COLUMN "organization_id" SET NOT NULL;
