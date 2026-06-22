-- Enforce the duplicate-application uniqueness invariant on job_application.
--
-- jobs.repo.ts dedup is a check-then-create app-layer guard
-- (createJobApplication.ts: findByPersonAndPosting then 409 "already applied").
-- But the live DB only has the primary key + 3 plain (non-unique) btree indexes
-- (idx_job_app_posting/person/status) — NO unique constraint on
-- (person_id, posting_id).
--
-- That gap is a data-integrity defect (W3 jobs S5 → W3 follow-up): the serial
-- guard works only when requests are serialized. Two concurrent applies for the
-- same (person, posting) both read "no existing row" before either inserts
-- (TOCTOU), so both succeed and two duplicate applications persist. Nothing at
-- the DB layer stops it.
--
-- The fix pairs the existing app-layer guard + a new 23505→ConflictError catch in
-- createJobApplication.ts (so the concurrent loser returns a clean 409, not a 500)
-- with this DB-level backstop. Safe to apply: live prod has 0 duplicate
-- (person_id, posting_id) groups (verified SELECT person_id, posting_id, count(*)
-- ... GROUP BY 1,2 HAVING count(*)>1 → 0), but de-dup first (keep the earliest
-- applied_at) so the migration applies cleanly even if any duplicates exist.
DELETE FROM "job_application" WHERE "id" IN (SELECT a."id" FROM "job_application" a JOIN "job_application" b ON a."person_id"=b."person_id" AND a."posting_id"=b."posting_id" AND (a."applied_at">b."applied_at" OR (a."applied_at"=b."applied_at" AND a."id">b."id")));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_application_person_posting_unique"
  ON "job_application" ("person_id", "posting_id");
