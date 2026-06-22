### audit

## audit module — Wave-3 (cluster peripheral) TDD slice plan

Floor currently **80** line / **0** function (`.coverage-thresholds.json:3` → `"src/handlers/audit": { "line": 80, "function": 0 }`). Effort **S**. Method (locked, mirrors Wave-1/2): characterize existing code → TDD new behavior; where a MISSING BR is a real bug, red-test then fix the RIGHT layer. Asserts MUST be real DATA (persisted rows, SQLSTATE 23502/22P02, enum values read back), never `toBeDefined`/200-only. Guard every real-PG test with `if (!H.dbReachable) return;`.

**Floor decision: HOLD at 80, but the 80 is currently ILLUSION-INFLATED and must be re-backed by real PG.** Measured evidence (this scope run):
- Full module + related tests: `audit.repo.ts` = **94.29%** line.
- **Drop the fake-db illusion `repos/audit.repo.test.ts`** and re-measure: `audit.repo.ts` collapses to **28.83%** line / 63.64% func (uncovered 38-98, 163-258, 297-334 = `buildWhereConditions`, `verifyIntegrity`, `archiveOldLogs`, `purgeArchivedLogs`, `getAuditStatistics`). i.e. ~65 points of the repo's "coverage" is a stub returning scripted arrays — zero real SQL. The genuine real-PG suite (`person/audit-no-pii.integration.test.ts`) only reaches `logEvent` (105-152) + read-back.
- The 80 floor is HELD only because we will REPLACE the illusion's covered surface with a real-PG `createScratch` integration suite that proves the same lines via actual SQL. We do NOT delete the illusion until the real-PG suite covers its lines (avoid a coverage cliff that trips the gate).

### Source facts verified (against source + live catalog)
- **1 handler:** `listAuditLogs.ts` (GET /audit/logs). Real-PG-agnostic — its only test `listAuditLogs.test.ts` uses `stubRepo(AuditRepository,…)` (no DB). `listAuditLogs.ts` = 100% line via stub, but `findMany`/`count` filter SQL is never proven against PG.
- **Repo:** `repos/audit.repo.ts` — `AuditRepository extends DatabaseRepository`. Methods: `buildWhereConditions` (12 filter branches, lines 44-97), `logEvent` (105-152: integrity SHA-256 + `purgeAfter = now+7y` + org default to `SYSTEM_ORG_ID` + actor fallback chain), `calculateIntegrityHash` (157-164), `verifyIntegrity` (170-225), `archiveOldLogs` (231-260: `update … set retention_status='archived'` where active & createdAt ≤ cutoff, `.returning({id})`), `purgeArchivedLogs` (266-298: two-step — mark archived→pending-purge, then DELETE pending-purge), `getAuditStatistics` (304-336: 4× `count`).
- **Repo test `repos/audit.repo.test.ts` = FAKE-DB ILLUSION.** `makeMockDb()` (lines 92-139) hand-builds `insert/update/delete/select` chains that return scripted arrays/thenables. `logEvent` "integrity hash" test asserts only `length===64` + regex on a value computed in-process; archive/purge tests assert `mockDb.update/delete toHaveBeenCalled` + the stub's `.returning` array length. NO real SQL, NO enum/NOT-NULL/index behavior. `getAuditStatistics` test stubs `repo.count` itself (line 590). The 94% is stub-execution, not SQL proof.
- **Live catalog `public.audit_log_entry`** (verified): columns `id uuid PK default gen_random_uuid()`, `created_at/updated_at NOT NULL default now()`, `version int NOT NULL default 1`, `created_by uuid` (NULLABLE), `updated_by uuid` (NULLABLE), `event_type audit_event_type NOT NULL`, `category audit_category NOT NULL`, `action audit_action NOT NULL`, `outcome audit_outcome NOT NULL`, `user uuid` (NULLABLE), `user_type varchar(20)`, `resource_type varchar(100) NOT NULL`, `resource varchar(255) NOT NULL`, `description varchar(1000) NOT NULL`, `details jsonb`, `ip_address varchar(45)`, `integrity_hash varchar(64)`, `retention_status audit_retention_status NOT NULL default 'active'`, `archived_at timestamptz`, `archived_by text` (FK → user.id), `purge_after timestamptz`, **`organization_id uuid NOT NULL`** (no default in DB), `event_sub_type varchar(100)`.
- **Enums (live):** `audit_event_type` (7 vals), `audit_category` (7: hipaa/security/privacy/administrative/clinical/financial/association), `audit_action` (22: …/anonymize/export/resign/deceased/suspend/unsuspend), `audit_outcome` (success/failure/partial/denied), `audit_retention_status` (active/archived/pending-purge). An out-of-enum value → Postgres **22P02** (invalid input value for enum).
- **NO append-only / immutability enforcement in the DB.** `pg_trigger` on `audit_log_entry` = 0 rows; only FK is `archived_by → user.id`. The ONLY mutations in source are `archiveOldLogs` (status flip) + `purgeArchivedLogs` (DELETE). The task's hypothesized "append-only invariant" does NOT exist → characterize the archive/purge state machine; do NOT red-test a constraint that isn't there (see Classifications).
- **`organization_id` NOT NULL in DB**, but `logEvent` (repo line 132) defaults absent org to `SYSTEM_ORG_ID` → a logEvent without org NEVER hits 23502. Direct INSERT without org (bypassing logEvent) → 23502. Characterize both.
- **`user`/`created_by`/`updated_by` are uuid** — passing the literal `'system'` → **22P02** (already proven by `person/audit-no-pii.integration.test.ts:368-409`, the regression guard for why `SYSTEM_USER_ID` is required). Do NOT duplicate; cross-reference.
- **Middleware `src/middleware/per-route-audit.ts`** (the x-audit composer, P1.5) HAS a unit test `per-route-audit.test.ts` (98.96% line). `core/audit/audit-action.ts` (the thin hand-wired wrapper) + `core/audit/derive-user-type.ts` (100%) covered. These are NOT the gap.
- **Jobs:** `jobs/index.ts` (`registerAuditJobs` cron) 100% line via spyOn-on-prototype unit (`jobs/index.test.ts`), but the cron's downstream `archiveOldLogs`/`purgeArchivedLogs` SQL is stubbed there too.

### HARNESS NOTE
A genuine `createScratch(['audit_log_entry'])` real-PG harness pattern ALREADY EXISTS and works for this exact table — `person/audit-no-pii.integration.test.ts:187` does `createScratch(['person','session','audit_log_entry'])` and reads back rows via `H.scopedPool.query`. **Do NOT build a new harness; reuse `@/test-utils/pg-scratch`.** `LIKE public.audit_log_entry INCLUDING ALL` copies all columns/enums/NOT-NULL/defaults/indexes (FKs dropped — `archived_by` FK absent, so we can archive without seeding a user). This is the cluster-peripheral one-table harness; no cross-module seed needed (audit is leaf — no FK into it except the optional archived_by).

---

### Slice 1 — Real-PG harness for AuditRepository: logEvent persistence + enum/org invariants (DoD #1)
- **axis:** integ
- **files to CREATE:** `src/handlers/audit/repos/audit.repo.integration.test.ts` — `createScratch(['audit_log_entry'])`; `if (!H.dbReachable) return` per test; `afterAll(H.teardown)`.
- **asserts (real persisted rows, read back via `H.scopedPool.query`):**
  - `logEvent({eventType:'data-access',category:'hipaa',action:'read',outcome:'success',organizationId:ORG,user:U,userType:'admin',resourceType:'audit_log',resource:R,description:'x'}, creatorId)` persists ONE row; read back: `event_type='data-access'`, `category='hipaa'`, `action='read'`, `outcome='success'`, `retention_status='active'`, `organization_id=ORG`, `created_by=creatorId`, `updated_by=creatorId`, `user=U`. Proves the enum columns + spread land via real SQL (the illusion proved none of this).
  - **integrity hash is persisted AND recomputable:** the persisted `integrity_hash` is a 64-char `/^[a-f0-9]{64}$/`, AND equals the repo's `calculateIntegrityHash` over the read-back row's fields (drive through `verifyIntegrity([readBackRow])` → `verifiedCount===1`, `compromisedEntries===[]`). This is the real round-trip the stub fakes.
  - **`purge_after ≈ now+7y`:** read-back `purge_after` year − insert year ∈ [6,7] (HIPAA). Real timestamptz, not a captured JS Date.
  - **`event_sub_type` persists via the `...request` spread:** `logEvent({…, eventSubType:'financial.payment-recorded'})` → read-back `event_sub_type='financial.payment-recorded'` (column exists; spread carries it — currently UNPROVEN anywhere).
  - **org default:** `logEvent({… without organizationId})` → row persists with `organization_id = SYSTEM_ORG_ID` (repo line 132) — proves the default branch fires and the NOT-NULL is satisfied, not violated.
  - **direct INSERT without org → 23502:** raw `H.scopedPool.query('INSERT INTO … (event_type,category,action,outcome,resource_type,resource,description) VALUES (…)')` omitting `organization_id` rejects with SQLSTATE `23502` on `organization_id` — proves the NOT-NULL is real (a bypass-logEvent writer would fail), characterizing that ALL audit writes MUST go through logEvent or supply org.
  - **bad enum → 22P02:** raw INSERT with `event_type='not-a-real-type'` rejects with `22P02`. Confirms enum is enforced at DB, not just app.
- **est commits:** 2 (harness file + logEvent/integrity/purge_after/eventSubType; org-default + 23502/22P02 invariants)

### Slice 2 — buildWhereConditions filter SQL + findMany/count against real Postgres (the 28.83%→real gap)
- **axis:** BR
- **files to CREATE:** extend `repos/audit.repo.integration.test.ts` (same `createScratch`).
- **asserts (seed 3-5 rows spanning orgs/types/dates, assert filtered subsets — the filter branches lines 44-97 are the illusion's biggest blind spot):**
  - **org scoping (P0-3):** seed rows in ORG_A and ORG_B; `findMany({organizationId:ORG_A})` returns ONLY ORG_A rows (count + ids). This is the multi-tenant leak guard `listAuditLogs.ts:46` depends on — currently proven by NO test against real SQL.
  - `findMany({eventType:'security'})`, `{category:'financial'}`, `{action:'anonymize'}`, `{outcome:'denied'}`, `{user:U}`, `{resourceType:'person'}`, `{retentionStatus:'archived'}` each return only the matching subset.
  - **date range:** seed rows at distinct `created_at`; `findMany({startDate, endDate})` includes boundary rows (gte/lte, lines 92/96) and excludes outside-window rows.
  - **combined filters AND together** (`{organizationId:ORG_A, eventType:'data-access'}` → intersection only).
  - `count(filters)` matches `findMany(filters).length` for each above (proves `count` shares `buildWhereConditions`).
  - empty/undefined filters → `buildWhereConditions` returns undefined (line 99) → `findMany()` returns all seeded rows.
- **est commits:** 2

### Slice 3 — archive/purge retention state machine + statistics against real Postgres (lines 231-336)
- **axis:** integ (covers BR-32 7-year retention, currently mock-only in `retention-compliance.test.ts`)
- **files to CREATE:** extend `repos/audit.repo.integration.test.ts`.
- **asserts (real rows, real `update`/`delete … returning`):**
  - **archiveOldLogs:** seed 2 `active` rows with `created_at` older than `daysOld`, 1 recent `active` row → `archiveOldLogs(365, adminId)` returns `2`; read back: the 2 old rows are now `retention_status='archived'` with `archived_at` set + `archived_by=adminId`; the recent row stays `active`. Proves the dual `WHERE active AND created_at ≤ cutoff` predicate fires (the illusion only checked `update toHaveBeenCalled`).
  - **purgeArchivedLogs two-step:** seed 1 `archived` row older than `daysOld` + 1 `archived` row newer + 1 `active` row → `purgeArchivedLogs(2555)` first flips the old archived→`pending-purge` then DELETEs all `pending-purge`; returns `1`; read back: old archived row is GONE (`count=0` for its id), newer archived + active rows remain. Proves the mark-then-delete ordering at SQL (a single-pass bug would delete the wrong set).
  - **getAuditStatistics:** seed N rows across active/archived/pending-purge → `getAuditStatistics()` returns `totalEntries=N`, `activeEntries`/`archivedEntries`/`pendingPurge` matching the seeded distribution (4 real `count` queries, not a stubbed `repo.count`), `integrityStatus==='healthy'`.
  - **BR-32 retention floor characterization:** a freshly-logged financial event's `purge_after` ≥ `created_at + 7y` AND `archiveOldLogs` with a window shorter than the row's age does NOT delete it (archive ≠ purge). Document that there is **no DB-level guard preventing purge before `purge_after`** — the only retention enforcement is the `daysOld` arg passed to the cron (product decision, see Classifications).
- **est commits:** 2

### Slice 4 — verifyIntegrity tamper-detection against PERSISTED rows + DB-fetch path
- **axis:** BR
- **files to CREATE:** extend `repos/audit.repo.integration.test.ts`.
- **asserts:**
  - **persisted-row roundtrip:** `logEvent` a row, read it back, `verifyIntegrity([readBackRow])` → `verifiedCount===1`. (Distinct from Slice 1 by exercising the `entry.createdAt.toISOString()` recompute against the timestamptz Postgres actually stored — catches a tz-serialization drift the in-process test can't.)
  - **real tamper:** `logEvent` a row, then raw `UPDATE … SET description='TAMPERED' WHERE id=…` (no hash recompute), read back, `verifyIntegrity([row])` → `compromisedEntries` contains the id, `verifiedCount===0`. Proves tamper-detection on a row mutated in the STORE, not a hand-built bad-hash literal.
  - **DB-fetch path:** with no arg, `verifyIntegrity()` calls `findMany({retentionStatus:'active'})` against real PG → checks exactly the persisted active rows (`totalChecked` === seeded active count). The illusion's `verifyIntegrity()`-no-arg test stubs the select to `[]`; this proves the real query.
  - legacy rows (`integrity_hash IS NULL`) are skipped (not counted as compromised). Seed one via raw INSERT with null hash.
- **est commits:** 1

### Slice 5 — listAuditLogs handler over the REAL repo (org-scope + self-audit-logging end-to-end)
- **axis:** workflow
- **files to CREATE:** extend `repos/audit.repo.integration.test.ts` with a thin handler-level block driving the REAL `AuditRepository` via `createScratch` (NOT stubRepo), OR `src/handlers/audit/listAuditLogs.integration.test.ts`.
- **asserts (real data; today the handler is unit-only with a stub):**
  - seed audit rows in ORG_A + ORG_B; call `listAuditLogs` with `organizationId=ORG_A` → response `data` contains ONLY ORG_A rows (assert ids), `pagination.totalCount` = ORG_A count. Proves the `filters.organizationId = orgId` (listAuditLogs.ts:46) tenant boundary at SQL, not just "filter forwarded to stub".
  - **self-audit side effect:** after the call, a NEW row exists in the store with `resource_type='audit_log'`, `resource='audit_logs_query'`, `action='read'`, `category='administrative'`, `user=callerId`, `event_type='data-access'` (listAuditLogs.ts:78-98) — i.e. querying audit logs is itself audited, persisted. The stub test only asserted the logEvent ARG; this proves the ROW lands.
  - `startDate>endDate` → `ValidationError` thrown BEFORE any repo call (no row leaked, no self-audit row written).
  - pagination: seed 30 rows, `{limit:'10',offset:'20'}` → 10 rows, correct page, `totalCount=30`.
- **est commits:** 1

### Slice 6 (FOLDED into Wave-3 finalize) — retire the fake-db illusion + ratchet/registry housekeeping (DoD #5/#6)
- **axis:** integ/BR (housekeeping)
- **edit:** (a) DELETE or gut `repos/audit.repo.test.ts` ONLY after Slices 1-4 cover its lines via real PG (re-measure first to avoid a coverage cliff that trips the gate); keep any genuinely-pure unit (e.g. `calculateIntegrityHash` determinism) if it isn't redundant. (b) `.coverage-thresholds.json` `src/handlers/audit` — **HOLD `line` at 80** (now real-PG-backed, no longer illusion-inflated); set `function` to the honest measured number (currently 0 — raise to the real floor once the integration suite lands, target ≥ measured). (c) update `br-registry.json` + coverage-matrix: BR-32 (7-year retention) now real-PG; mark `buildWhereConditions`/`archive`/`purge`/`verifyIntegrity`/org-scope as REAL (drop stale MISSING/SHALLOW rows).
- **asserts:** `bun test` (api) green incl. the new CI-running integration suite; module `audit.repo.ts` line% measured WITHOUT the illusion is now ≥ 80 (the honest floor); coverage gate passes; registry has no stale illusion-backed rows.
- **est commits:** 1 (folded into the single Wave-3 finalize commit with marketplace/advertising/jobs/onboarding ratchets).

---

**Totals:** 6 slices (~9 commits; Slice 6 folds into Wave-3 finalize). Harness-first (Slice 1) reuses the existing `createScratch` pattern proven by `person/audit-no-pii.integration.test.ts`. **No real bugs found** — source behavior is SQL-correct and the live catalog matches the Drizzle schema (no `.notNull()` drift on audit; `organization_id` NOT NULL matches both schema line 86 and live; no enum-as-text drift). The dominant finding is **test-fragility (fake-db illusion inflating an 80 floor that collapses to 28.83% without it)** — the fix is real-PG `createScratch`, NOT source. The hypothesized append-only/immutability invariant does not exist in the DB and is recorded as a product decision, not a bug.
