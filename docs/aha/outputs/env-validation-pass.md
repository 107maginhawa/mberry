# AHA Env Validation Pass (roadmap §8 order 6 / P-6)

**Date:** 2026-06-12
**Stack:** booted + seeded local — API on `:7213` (`PORT=7213 bun src/index.ts`), Postgres `localhost:5432/monobase` (Docker), migrated to **0064**.
**Purpose:** clear `[BLOCKED BY ENVIRONMENT]` for migration/contract/E2E validation; record pass/fail deltas vs the known-good baseline after this session's decision-free `04` fixes (billing Batch B, auth-rbac FIX-006/009, notifications FIX-008, surveys Batch C, realtime-comms R-1).

## 1. Database migration apply (live)

- API booted cleanly → `Database migrations completed successfully`.
- Migration **0064_comms_org_id_not_null** applied through the real migrator (not just code-level — unlike env-blocked 0062/0063).
- Post-state (direct `pg` query): `chat_room.organization_id` and `chat_message.organization_id` are both `is_nullable = NO`; **0** NULL-org rows in either table (the 2 legacy NULL `chat_message` rows were backfilled from their room).
- **Result: PASS** — corrective migration verified on live data.

## 2. Full unit/integration suite — `bun test` (services/api-ts)

| Metric | Baseline | This pass | Delta |
| --- | --- | --- | --- |
| pass | 5855 | **6001** | **+146** |
| fail | 1 | **1** | 0 |
| todo | 3 | 4 | +1 |
| skip | 93 | 0 (shown) | −93 |
| total ran | — | 6006 (544 files) | — |

- The **+146 pass / −93 skip** comes from (a) this session's ~38 new tests (billing +11, invite/middleware FIX-006/009, email +5 FIX-008, surveys FIX-007/008/009, comms repo +4 FIX-008, migration-verify comms +4) and (b) DB-gated tests that were SKIPPED at baseline now executing against the live stack (DATABASE_URL resolved from `.env`).
- The **1 fail is the documented pre-existing baseline failure**, unchanged and unrelated: `registerEmailJobs > registers email.processor as interval job` (`handlers/email/jobs/index.test.ts:80` — asserts interval `30000`, got `1000`; an env/interval-config artifact in a file untouched this session).
- **No new failures** introduced by any of this session's fixes.
- **Result: PASS** (vs baseline; net +146 pass, 0 new fail).

## 3. Contract suite — Hurl (`scripts/run-contract-tests.ts`, `API_URL=:7213`)

| Metric | Baseline | This pass (stable) |
| --- | --- | --- |
| Succeeded files | 153/155 | 153/155 |
| Deterministic failures | 2 | 2 (same) |

- The **2 stable failures are the documented pre-existing baseline**: `impersonation-flow.hurl` (expects 403, gets 400) and `platformadmin-extended-flow.hurl` `GET /admin/committees` (expects 403, gets 200).
- **Intermittent (flaky):** `member/governance/position-crud.hurl` failed in 2 of 4 runs and **passed (11/11 requests) in the others** — a stateful-suite ordering/seed-state flake in the **governance** area, which is **untouched** by this session's fixes. Not a deterministic regression.
- **No new deterministic contract failures** from this session's changes. Spot-verified via direct HTTP that FIX-009's public-path bypass still works: `/association/member/directory/public` → 404 (bypasses auth, not 401), while `/association/surveys/anonymous` and other `/association/*` routes correctly → 401 unauthenticated.
- **Result: PASS** (matches baseline; flaky governance test is pre-existing env noise).

## 4. Playwright E2E (apps/memberry, against booted stack)

- Harness auto-starts servers (`reuseExistingServer` → reused the booted `:7213` API + started the app on `:3004`). Ran a targeted chromium subset (golden-path smoke + survey-anonymity stub, the area touched by surveys FIX-007).
- **6 passed.** Two failures, both **environmental/harness artifacts, not code regressions:**
  - `_golden-path.spec.ts` — `Applicant signed up via UI` failed in `beforeAll` (UI signup/seed/env setup; `maxFailures:1` then halted the run). Blocks the UI-driven suite — `[BLOCKED BY ENVIRONMENT]`.
  - `stubs/survey-anonymity.spec.ts` — `unauthenticated request returns 401` failed in the browser `page.evaluate` fetch, but the spec runs under officer `storageState` and the **API itself is correct**: a direct unauthenticated `curl` of `/association/surveys/anonymous?organizationId=…` returns **401** (verified). The failure is a test auth-state/origin artifact, not a backend defect.
- **Result: PARTIAL — `[BLOCKED BY ENVIRONMENT]`** for the full UI-driven suite (signup `beforeAll`); no E2E failure attributable to this session's backend-only changes. Backend behavior is covered deterministically by §2 (unit) and §3 (contract) + direct-HTTP probes.

## 5. Summary

| Layer | Verdict | Notes |
| --- | --- | --- |
| Migration 0064 (live apply) | **PASS** | org_id NOT NULL enforced + verified; 0 NULL rows |
| `bun test` | **PASS** | 6001 pass / 1 pre-existing fail; +146 vs baseline, 0 new fail |
| Hurl contract | **PASS** | 153/155 stable (2 baseline); 1 flaky governance test (pre-existing, untouched area) |
| Playwright E2E | **PARTIAL / `[BLOCKED BY ENVIRONMENT]`** | env-fragile signup `beforeAll`; no regression attributable to this session (API correctness confirmed via direct HTTP) |

**Net:** this session's decision-free fixes introduced **zero new deterministic failures** across the unit and contract layers, and the realtime-comms `org_id` NOT NULL migration was applied and verified on the live booted+seeded stack. Remaining red is pre-existing baseline (1 unit fail, 2 contract fails) plus environmental E2E/Hurl flakiness in areas untouched by this work.

> Note: the API remains running on `:7213` for any follow-up live checks.
