-- Enforce the consent uniqueness invariant on member_ad_opt_out.
--
-- advertising.schema.ts models opt-out as "one row per (organization_id,
-- person_id) means opted out", and optOut.repo.ts:48-65 assumes that invariant
-- in app code (findOne-then-createOne). But the live DB only has the plain
-- (non-unique) btree `ad_opt_out_org_person_idx` (migration 0050:1089) and the
-- primary key on `id` — NO unique constraint on (organization_id, person_id).
--
-- That gap is a consent/privacy data-integrity defect (W3 advertising S3):
--   * optOut() is findOne-then-createOne — a TOCTOU window where two concurrent
--     opt-outs both pass the guard and insert TWO rows for the same member.
--   * optIn() deleted only the first found row, so any straggler kept the member
--     silently opted-OUT after they clicked "show me ads again".
--
-- The fix pairs an idempotent ON CONFLICT DO NOTHING upsert + a delete-ALL opt-in
-- in the repo with this DB-level backstop. Safe to apply: live prod has 0
-- duplicate (org, person) groups (verified
-- SELECT organization_id, person_id, count(*) ... GROUP BY 1,2 HAVING count(*)>1),
-- but de-dup first (keep the earliest opted_out_at) so the migration applies
-- cleanly even if any duplicates exist.
DELETE FROM "member_ad_opt_out" a
USING "member_ad_opt_out" b
WHERE a."organization_id" = b."organization_id"
  AND a."person_id" = b."person_id"
  AND (a."opted_out_at" > b."opted_out_at"
       OR (a."opted_out_at" = b."opted_out_at" AND a."id" > b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_ad_opt_out_org_person_unique"
  ON "member_ad_opt_out" ("organization_id", "person_id");
