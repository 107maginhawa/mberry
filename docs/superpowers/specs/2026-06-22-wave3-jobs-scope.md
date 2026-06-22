### jobs

## jobs module — Wave-3 (cluster peripheral) TDD slice plan

Floor currently **`{ line: 5, function: 0 }`** (`services/api-ts/.coverage-thresholds.json:33`). Effort **S**. Target floor **40** (Wave-3 peripheral). Method (locked, mirrors Wave-1/Wave-2): characterize existing code → TDD new behavior; where a MISSING BR is a real bug, red-test then fix the RIGHT layer. DoD priority: (1) real-PG harness on `createScratch` → (2) MISSING BRs get real tests → (3) MISSING workflows get real-flow e2e/handler tests → (4) inter-module contracts → (5) ratchet floor toward 40 only as real coverage lands → (6) fix registry/threshold drift.

> **SCOPE NOTE — this is NOT the background-job registry.** The Wave-3 brief described `handlers/jobs/` as a "background JOB REGISTRY (job definitions, runs, schedules)". That is wrong for this codebase. `handlers/jobs/` is the **M15 Job Board** (job postings + applications). The background-job scheduler lives at `core/jobs.ts` (pg-boss) and per-module `jobs/index.ts` cron files — out of scope here. All asserts below target the job-board tables `job_posting` / `job_application`. There is no `job`, `job_run`, `scheduled_job`, `next_run`, `attempts`, or retry table in this module.

### Source facts verified (against source + live catalog)

- **Two repos in one file:** `repos/jobs.repo.ts` → `JobPostingRepository` (list/get/create/update/delete/`listExpired`/`extendPosting`) + `JobApplicationRepository` (list/get/create/update/`findByPersonAndPosting`). Schema `repos/jobs.schema.ts`.
- **Live catalog (`\d job_posting`):** cols `id, created_at, updated_at, version, created_by, updated_by, organization_id, title, organization_name, type, salary, description, requirements(jsonb), posted_at, expires_at, status, posted_by`. **NOT NULL live:** `id, created_at, updated_at, version, organization_id, title, organization_name, type, status` (matches Drizzle — no nullability drift). Defaults: `type='full_time'::job_posting_type`, `status='draft'::job_posting_status`, `version=1`, `id=gen_random_uuid()`. Indexes: pkey + `idx_job_posting_org/status/expires/type` (all plain btree — **no partial-unique**). `created_by/updated_by/location/salary/description/requirements/posted_at/expires_at/posted_by` are nullable.
- **Live catalog (`\d job_application`):** cols `id, created_at, updated_at, version, created_by, updated_by, posting_id, person_id, resume_ref, cover_letter, applied_at, status`. **NOT NULL live:** `id, created_at, updated_at, version, posting_id, person_id, applied_at, status`. Defaults: `applied_at=now()`, `status='applied'::job_application_status`. Indexes: pkey + `idx_job_app_posting/person/status`. **NO unique index on `(person_id, posting_id)`** — the dedup guard is app-layer only (real-bug suspect, see §classify).
- **Live enums:** `job_posting_status = {draft,active,filled,expired,closed}`; `job_posting_type = {full_time,part_time,contract,fellowship,internship}`; `job_application_status = {applied,screening,interviewed,offered,hired,rejected,withdrawn}`. (Enum-as-real-type — `22P02` fires on a bad value, unlike a text column.)
- **No DB-level FK** from `job_application.posting_id → job_posting.id`, and `organization_id/person_id` are plain uuid. The existing integration test relies on this (isolates by unique `organizationId`). → `createScratch(['job_posting','job_application'])` is clean (LIKE drops FKs anyway).
- **Existing integration test = genuine real-PG BUT two anti-patterns:** `repos/jobs.repo.integration.test.ts` uses **raw `new Pool` on the shared `public` schema** (lines 24,37) AND **`if (process.env['CI']) return`** at line 36 — it never runs in CI (the exact B4 LESSON anti-pattern: raw-Pool + hand-scoped cleanup on `public`, CI-gated). Its own comment (lines 31–35) says it "should migrate to" the scratch pattern. It is otherwise solid characterization (covers create-auto-expiry, all list filter branches, listExpired, extendPosting success/NotFound/Validation, app create/update/find/list).
- **Handler tests are mock-only:** `create/update/delete/get JobPosting.test.ts`, `create/update JobApplication.test.ts`, `searchJobPostings.test.ts` all use `makeCtx` + `stubRepo` + `fakeJobPosting`/`fakeApplication` factories (no persisted rows). They exercise the org-scope/IDOR guards and 400/404/409 branches against stubs — good guard coverage, zero SQL proof.
- **REAL BUG — BR-37 expiry is dead code:** `listExpired(now)` (repo:98) and `extendPosting` (repo:111) have **NO production caller** (`grep` for callers returns only the repo defs + the integration test). There is **no `handlers/jobs/jobs/` cron dir**, and **no `scheduler.registerCron`/`registerInterval`** for job-posting expiry anywhere (the 14 registered crons are booking/person/member/notifs/audit/surveys/communication/email/platformadmin — none for jobs). BR-37 "Job Posting Expiry" in `docs/ver-3/business/br-registry.json:683` is `p2-deferred` / "Module M15 not yet implemented", and its `tests.backend` points at a **non-existent** path `handlers/events/br-37.job-posting-expiry.test.ts` (registry drift). **Net effect:** a posting whose `expires_at` passes is never transitioned `active → expired`; `searchJobPostings`/`list` keeps surfacing stale "active" postings indefinitely. (The apply path is partially protected — `createJobApplication.ts:29` rejects `new Date() >= posting.expiresAt` with 409 — but the *listing* and the `expired` status itself are never reached in prod.)

### HARNESS NOTE
This module is **self-contained** (no FK coupling to other Wave-3 modules; marketplace/advertising/audit/onboarding share no tables with the job board). It does **not** participate in a shared cluster fixture. Slice 1 stands up its own `createScratch(['job_posting','job_application'])` harness by **migrating the existing real-PG file off raw-Pool-on-public + un-gating it from CI** — converting "real but CI-skipped on a contended public schema" into "real, isolated, and runs in the `ci-migrate` lane". This mirrors the booking Wave-2 Slice-2 migration exactly.

---

### Slice 1 — Migrate `jobs.repo.integration.test.ts` to `createScratch` + un-gate from CI (DoD #1)
- **axis:** integ (harness — highest leverage)
- **files to CREATE / EDIT (in place):** `services/api-ts/src/handlers/jobs/repos/jobs.repo.integration.test.ts`
- **change:** replace `new Pool({connectionString: DB_URL})` + `if (process.env['CI']) return` (lines 19–50) and the hand-scoped org-id cleanup `afterAll` (lines 52–67) with `H = await createScratch(['job_posting','job_application'])` from `@/test-utils/pg-scratch`; build repos on `H.db as never`; guard every test `if (!H.dbReachable) return`; `afterAll(() => H?.teardown())`. Keep all existing assertions (they remain green, now isolated + in CI). Drop the `ORG_ID`-scoped delete loop (scratch schema is dropped wholesale).
- **asserts (must remain green, now in CI on an isolated schema):**
  - all existing characterization tests pass against `createScratch` (auto-expiry +30d, caller-expiresAt-kept, null-postedAt→null-expiresAt, get hit/miss, update bump, delete true/false, list every filter branch + pagination, `listExpired`, `extendPosting` success/default-30/NotFound/Validation, app create/get/update/findByPersonAndPosting/list).
  - read-backs use `H.scopedPool.query(...)` (not the contended public pool).
- **est commits:** 1 (mechanical migration; verify the `ci-migrate` lane runs it green).

### Slice 2 — Repo constraint + enum + default proofs against real PG (BR/integ depth the mock tests can't give)
- **axis:** integ
- **files to CREATE:** extend `repos/jobs.repo.integration.test.ts` (same `createScratch` suite as Slice 1).
- **asserts (real persisted rows / real SQLSTATE):**
  - **org_id NOT NULL invariant:** `postingRepo.create({...without organizationId})` → Postgres `code === '23502'` on `job_posting.organization_id` (live NOT NULL confirmed). Positive: a create WITH org persists and `organization_id` reads back equal.
  - **enum domain (`22P02`):** insert a `job_posting` with `type` cast from an out-of-range string (raw `H.scopedPool.query` with `'director'`) → `code === '22P02'` (invalid input for enum `job_posting_type`); same for `status='archived'` → `22P02`. Proves these are real enums, not text. (Drizzle's typed `create` can't reach this — use a raw insert.)
  - **defaults applied by PG, not app:** raw-insert a `job_posting` with only the NOT-NULL minimum (org/title/organization_name, no type/status) → row reads back `type='full_time'`, `status='draft'`, `version=1`, `id` populated. Confirms the DB defaults the schema declares.
  - **application NOT NULL:** `appRepo.create({...without postingId})` → `23502` on `posting_id`; `{...without personId}` → `23502` on `person_id`.
  - **application defaults:** `appRepo.create({postingId, personId})` (no status/appliedAt) → reads back `status='applied'`, `applied_at` non-null (DB `now()` default).
- **est commits:** 1.

### Slice 3 — RED-then-FIX: BR-37 job-posting expiry has no production caller (real bug)
- **axis:** BR (real-bug — red-test then fix the RIGHT layer)
- **files to CREATE:** `services/api-ts/src/handlers/jobs/jobs/expirePostings.ts` (new cron handler) + `services/api-ts/src/handlers/jobs/jobs/index.ts` (register it) + `services/api-ts/src/handlers/jobs/jobs/expirePostings.test.ts` (mock-unit) + a real-PG block in `repos/jobs.repo.integration.test.ts`.
- **the bug (verified):** `listExpired`/`extendPosting` (repo:98,111) are invoked by nothing in prod; no `registerCron` for job expiry exists; BR-37 is shelved as "not implemented". A posting past `expires_at` stays `active` forever and keeps showing in `list`/`searchJobPostings`.
- **plan:** FIRST write a failing test asserting the prod control exists and works; THEN add the minimal cron (mirror `surveys/jobs/index.ts` `survey.expirePending` `registerCron(..., '0 4 * * *', ...)` pattern) that calls `listExpired(new Date())` and flips each to `status='expired'`.
- **asserts (real PG, real rows):**
  - **RED → GREEN, real outcome:** seed an `active` posting with `expires_at` in the past + an `active` posting with `expires_at` in the future + a `draft` past-expiry posting. Run the new expiry handler. Read back: the past-active posting is now `status='expired'`; the future-active posting stays `active`; the `draft` posting is **untouched** (only `status='active'` rows are eligible per `listExpired`'s `eq(status,'active')`).
  - **batch cap:** `listExpired` `.limit(200)` — seeding >200 expired actives processes at most one batch per run (characterize the cap; flag if product wants pagination — do not silently change).
  - **idempotent:** running the handler twice does not error and the second run flips zero additional rows (already-`expired` rows are no longer in `listExpired`).
  - **mock-unit (expirePostings.test.ts):** stub `JobPostingRepository.listExpired` → 2 rows; assert `update` called with `{status:'expired'}` for each; assert handler swallows a per-row update failure and continues (fire-and-forget cron resilience).
  - **registry/threshold note:** if product instead decides BR-37 stays deferred, DOWNGRADE this slice to a characterization test that documents `listExpired`/`extendPosting` as currently-unreachable dead code and remove the false BR-37 registry test path — flag the decision in the commit. (Recommended: implement — the repo method already exists and the search/listing leak is a live correctness gap, not a feature.)
- **est commits:** 2 (1 red-test + cron handler + register; 1 idempotent/batch + mock-unit).

### Slice 4 — Cross-org IDOR seam: `createJobApplication` / `updateJobApplication` org-scope against real PG (workflow)
- **axis:** workflow
- **files to CREATE:** `services/api-ts/src/handlers/jobs/jobApplication-orgscope.integration.test.ts` (thin handler-level test driving the REAL repos via `createScratch`, not stubRepo).
- **why:** `job_application` carries no org column; handlers derive org from the parent posting (`createJobApplication.ts:20-23`, `updateJobApplication.ts:21-25`). This cross-org guard is asserted today only against stubs — never against a real two-org dataset.
- **asserts (real rows, real cross-org boundary):**
  - seed org-A `active` posting + org-B `active` posting (real `createScratch` rows). Caller scoped to org-A applies to the org-B posting by UUID → handler returns `404` and **no `job_application` row is persisted** (read-back count = 0). Proves the IDOR guard at the data layer.
  - caller in org-A applies to the org-A posting → `201`, exactly one `job_application` row persisted with `person_id`/`posting_id` correct, `status='applied'`.
  - apply to a `draft` org-A posting → `409` "not accepting applications", zero rows.
  - apply to an `active` org-A posting whose `expires_at` is in the past → `409` "has expired", zero rows (the `createJobApplication.ts:29` guard against real data).
  - `updateJobApplication` for an application whose parent posting is org-B → `404`, the row's `status` is **unchanged** in the DB (read-back).
- **est commits:** 1.

### Slice 5 — RED candidate: duplicate-application race (app-layer-only dedup) — characterize + flag
- **axis:** BR
- **files to CREATE:** extend `jobApplication-orgscope.integration.test.ts` (or a sibling `jobApplication-dedup.integration.test.ts`).
- **the gap (verified):** dedup is `findByPersonAndPosting` check-then-`create` in `createJobApplication.ts:34-37`. There is **no unique index on `(person_id, posting_id)`** (live catalog confirms only pkey + 3 plain btree indexes). Two concurrent applies for the same (person, posting) can both pass the check and both insert — a TOCTOU race; nothing at the DB stops it.
- **asserts:**
  - **sequential characterization (current behavior):** create one application; a second `createJobApplication` for the same (person, posting) → `409` "already applied", still exactly one row (the app-layer guard works when serialized).
  - **race characterization:** fire two `appRepo.create` for the same (person, posting) **concurrently** (`Promise.allSettled`) against real PG → assert that **both succeed today** (two rows persist) — proving there is no DB-level dedup. Document this as the gap. (Do NOT add a unique index in this slice — that is a schema change with a migration; flag it as a product/data-integrity decision. A migration adding a partial-unique `(person_id, posting_id)` would need a pre-backfill dedupe and would surface `23505` for the loser; recommend it as a follow-up, not in-scope for the floor-40 ratchet.)
- **est commits:** 1.

### Slice 6 — Ratchet floor + fix registry/threshold drift (DoD #5/#6) — FOLD INTO Wave-3 finalize
- **axis:** integ/BR (housekeeping)
- **edit:** `services/api-ts/.coverage-thresholds.json` — raise `src/handlers/jobs` `{ line: 5, function: 0 }` toward **40** to the actual measured module-min line% after slices 1–5 land (set the real number just below the lowest file, no number-chasing; the repo + 7 handlers now all have real or guard coverage so 40 should clear comfortably — measure to confirm). Fix `br-registry.json` BR-37: repoint `tests.backend` off the non-existent `handlers/events/br-37.job-posting-expiry.test.ts` onto the new real test(s), and update `ruleClass`/`deferredReason` per the Slice-3 product decision (implemented → mark active; deferred → mark dead-code documented).
- **asserts:** `bun test` (api) green incl. the now-CI-running `jobs.repo.integration.test.ts`; coverage gate passes at the new floor; registry has no stale "MISSING/deferred/wrong-path" rows for items this plan made REAL.
- **est commits:** 1 (folded into the single Wave-3 finalize commit alongside the other 4 peripheral modules).

---

**Totals:** 6 slices, ~7 commits. **Harness-first** (Slice 1: migrate off raw-Pool-on-public + un-gate from CI) is the single highest-leverage move. **One real bug** (Slice 3, BR-37 expiry dead code — red-then-fix the cron path) and **one race/data-integrity flag** (Slice 5, no DB dedup unique index — characterize + recommend migration as follow-up). Everything else is constraint/enum/default/IDOR characterization that the mock-only handler tests and the CI-skipped integration test cannot prove.
