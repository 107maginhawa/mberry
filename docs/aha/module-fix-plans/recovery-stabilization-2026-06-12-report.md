# AHA Recovery / Stabilization Report — 2026-06-12

**Mode:** RECOVERY/STABILIZATION (not a forward `04` feature pass).
**Driver:** CONTINUE-23 (`docs/aha/outputs/CONTINUE-23-prompt.md`).
**Run style:** fully manual, main-loop-driven. `.claude/workflows/aha-autorun.js` NOT used (interlocked + unsafe). Adversarial review delegated to 4 strictly-read-only subagents; ALL git/edit operations performed by the orchestrator.

---

## 1. Incident + Recovery (context)

On 2026-06-12 an autonomous autorun orchestrator chained decision-free `04` passes as background subagents. A `jobs-B` executor ran `git checkout HEAD -- .` and `git reset --hard HEAD && git stash drop` on the **shared** working tree, reverting tracked work mid-run.

**Recovery achieved.** The dropped stash survived as a dangling commit and is tagged. Recovery tags (DO NOT DELETE):

| Tag | Commit | Meaning |
| --- | --- | --- |
| `recovery-2025-incident` | `79713197` | Full pre-incident tree (= current live working tree). Restore reference. |
| `recovery-current-tangled` | `20a3a516` | Alternate tangled snapshot. |
| `recovery-1715-earlier` | `d1aff027` | Earlier snapshot. |

Re-restore a single path if needed: `git checkout recovery-2025-incident -- <one specific path>` (NEVER `-- .`).

**Working tree:** intentionally dirty (~394 changed paths, 17 untracked generated files). Preserved. No commit made (per prompt).

---

## 2. Goal of this pass

Land a trustworthy, typecheck-GREEN baseline by (a) verify-or-revert of the 4 NEVER-VERIFIED autorun passes, and (b) resolving the 3 pre-existing typecheck errors. Stop after saving this report. Do NOT start any forward `04` pass.

---

## 3. Baseline established (Step 1, evidence-first)

| Check | Result |
| --- | --- |
| Recovery tags present | ✓ all 3 (`recovery-2025-incident` = `79713197`) |
| Working tree | dirty, 394 paths (expected) |
| Dues Batch B tests (`upsertDuesFunds`, `listDuesInvoices`, `dues-position-gate.routes`) | **18 / 18 pass** — verified intact |
| `bun run --filter '*' typecheck` (before fixes) | 4/5 green; api-ts had **exactly the 3 known errors**, no extras |
| `bun test` (full api-ts, before fixes) | **6273 pass / 1 fail / 4 todo** (1 fail = pre-existing `registerEmailJobs`); +68 tests vs pre-incident ~6205 = the autorun passes' new tests. **No new failures introduced by the 4 passes.** |

The fact that the full suite shows only the single pre-existing `registerEmailJobs` failure (email module, untouched by any of the 4 passes) means **every training / credits / dues module suite is green** — satisfying the "module suite passes" KEEP criterion for all 4 passes. Remaining review therefore focused on Correctness / Scope / Test-Integrity (are the new tests real RED→GREEN, in-scope, no fake-green).

---

## 4. Per-pass KEEP / REVERT decisions (Step 3)

Each unverified pass was treated as an unreviewed PR and reviewed adversarially (Correctness / Scope / Test-Integrity), with the orchestrator self-verifying every crux claim against the live code before deciding. **No pass was reverted** — all four are coherent, in-scope, and backed by real RED→GREEN tests with green module suites. One incompleteness gap (FIX-004) is documented and re-queued rather than reverted, because reverting correct, tested code that fixes 4 real bugs in order to address a separate *pre-existing* bug it didn't touch would be a regression.

### 4.1 Training Batch B (credits) — **KEEP** (with one documented completion gap)

| Fix | Verdict | Evidence |
| --- | --- | --- |
| **FIX-004** cycle authority (`resolveCycle`) | **KEEP code + re-queue completion** | `credit-cycle.ts:140-159` `resolveCycle` correct (2020-epoch alignment, config-driven; math verified). Wired into 4 write paths: `award-training-credit.ts`, `awardManualCredit.ts:31-35`, `adjustCreditEntry.ts:36-39`, `creditIssue.ts:30-34`. Tests genuine RED→GREEN (`credit-cycle-consistency.test.ts` stubs `repo.createOne`, asserts all 3 of {training, manual, job} stamp the identical config window; `credit-cycle.test.ts` import was a hard RED). **GAP (self-verified):** a 5th write path — `CreditService.createEntry` (`services/credit.service.ts:37-38`) via `createMyCreditEntry` (`POST /persons/me/credit-entries`) — STILL uses legacy `getCycleForDate(registrationDate, activityDate, cyclePeriodYears ?? 2)`, ignoring `org_cpd_config`. NOT attacker-exploitable (`CreateCreditEntryRequestSchema` strips client cycle params → undefined → 2-yr default), but produces a wrong stored `cycle_start/cycle_end` for member-self-logged credits, which `membership.repo.ts:145` (`cycleStart<=NOW()<=cycleEnd`) trusts → real correctness drift. The "single authority" claim in `training-credits-fix-report.md` is therefore **overstated** — corrected here. |
| **FIX-005** void/pending aggregate filters | **KEEP** | Void exclusion is a real root fix: `eq(creditEntries.status,'active')` added to `credits.repo.ts` `sumCreditsForCycle:141`, `sumCreditsByCategoryBatch:181`, `sumCreditsByOrg:235`, `listForPerson:209`. DPA export deliberately retains voided rows (correct — legal record). `compliance_standings` matview already filters `WHERE ce.status='active'` (migration 0046, pre-existing; test locks it). Tests walk the Drizzle WHERE tree (`credits.repo.aggregate-filter.test.ts`) — real. **Pending half explicitly descoped:** "pending" lives in the separate `verificationStatus` enum, untouched. Currently MOOT — every in-scope write path inserts `verificationStatus:'verified'`. Flagged for product decision (see §7). |
| **FIX-006** required-credits source collapse | **KEEP** | Clean, complete root fix: `getCreditCompliance.ts:47-57`, `getCreditTranscript.ts:50-62`, `getCreditTranscriptPdf.ts:50-69`, `getMyCreditSummary.ts:37-62` all read `requiredCredits` + cycle from `org_cpd_config` server-side and ignore client params; client params stripped from handler signatures AND from the hand-wired `app.ts` zValidator schemas. Strong tests (`getMyCreditSummary.test.ts` proves config 60 wins over wrong `associations` 45 and over client `requiredCredits:'1'`). |

**Test runs:** scoped batch 135/0, full credits dir 210/0 (re-confirmed final: credits suite **193/0**). No fake-green / `.skip` / `.todo` / weakened asserts found.

### 4.2 Training Batch C (`training.type` + credit-lock) — **KEEP**

| Fix | Verdict | Evidence |
| --- | --- | --- |
| **FIX-007** `training.type` column | **KEEP** | Chain consistent by inspection AND by regen-diff: tsp `training.tsp:24` `enum TrainingType` (5 values) → `openapi.json` → `validators.ts:9412` `TrainingTypeSchema = z.enum([...])` → drizzle `trainingTypeEnum` → handler maps `type: body.type` → repo `buildWhereConditions` real `eq(trainings.type,...)` → `searchTrainings.ts:31` forwards `?type=`. Migration **0067_training_type.sql** well-formed + additive/idempotent (`CREATE TYPE` in `DO $$ ... EXCEPTION WHEN duplicate_object`; `ADD COLUMN IF NOT EXISTS` nullable, no NOT NULL / default / backfill; `CREATE INDEX IF NOT EXISTS`). Real tests (`training.repo.type-filter.test.ts` walks condition tree). |
| **FIX-008** creditAmount lock once AUTO credits issued | **KEEP** | `updateTraining.ts` returns 409 `CREDIT_AMOUNT_LOCKED` when `creditRepo.countAutoByTraining(trainingId) > 0`; dependency exists (`credits.repo.ts:110`). 3-case test matrix in `training.test.ts:102` (409 when locked, 200 when count=0, allows non-credit field edits). |

**Generated-consistency (prompt-required regen-diff):** ran `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`. Result = **confirmed no-op** — porcelain fingerprint identical before/after (`a32ea03b…`), `git diff --stat HEAD` for generated dirs identical (3217 ins / 2356 del, same files), untracked count unchanged (17). `training.type`/`self_paced` present in both `openapi.json` and `validators.ts`. → generated/** is fully in sync with the current TypeSpec; the incident-time regen did not leave drift.

### 4.3 Training Batch D (FIX-009..013) — **KEEP**

| Fix | Verdict | Evidence |
| --- | --- | --- |
| **FIX-009** credit-tracking toggle | KEEP | `utils/award-training-credit.ts:41` reads `organizations.featureFlags`, suppresses AUTO credit only when `creditTracking` explicitly disabled (default-ON). Tested both directions (`training-enrollment.test.ts:322`, `check-in.test.ts:518`). |
| **FIX-010** duplicate-enrollment | KEEP | Handler `enrollInCustomTraining.ts` rejects non-cancelled existing enrollment (`ALREADY_ENROLLED`); DB backstop = partial `uniqueIndex('uq_training_enroll_active') WHERE status <> 'cancelled'` + migration **0068** (idempotent, additive). Predicate correct (re-enroll after cancel allowed). Tested handler + schema. |
| **FIX-011** `/my/training` predicate | KEEP | `computeTrainingStats` (`my/training.tsx`) earns credits/counts "Completed" only for `status==='completed'` (old bug counted `'enrolled'`); helper exported + wired. 5-case FE test. |
| **FIX-012** CSV export | KEEP | `buildComplianceCsv` (`officer/reports/credits.tsx:42`) RFC-4180 escaping + category columns + null-safe. 5-case test incl. comma-escaping + missing fields. |
| **FIX-013** createTraining org-id strip | KEEP | `createTraining.ts` binds `organizationId` from `ctx.get('organizationId')`, never `body.organizationId` — org-isolation breach closed. Tested (persists ctx org over foreign body org). |

**Test runs:** operations suite **447/0** (final), FE project runner 658/0/0/0. No `.skip`/`.todo`.
**Scope note:** `checkInCustomTraining` (FIX-001), `completeTrainingEnrollment` (FIX-002), `cancelCustomTraining` event rename `training.cancelled`→`training.enrollment.cancelled` (FIX-003) ride along from earlier training batches (A/B) co-resident in the recovery tree. They are sound and wired end-to-end (registry `domain-events.registry.ts:257`, consumer `domain-event-consumers.ts:568`, test `training-lifecycle.test.ts:145`) — not orphaned, not a blocker. Noted for batch accounting.

### 4.4 Dues settle-seam — **KEEP** (all 6 files)

| Item | Verdict | Evidence |
| --- | --- | --- |
| **FIX-007** over-refund cap + eligibility | KEEP | `validateRefundEligibility` (`utils/refund-validation.ts:84-90`): rejects `effectiveAmount > (paymentAmount - alreadyRefunded)`, rejects `<=0` (NOTHING_TO_REFUND), 30-day window + refundable-status gate. Persists cumulative `newRefundedAmount`, flips status via `assertValidTransition`. Units = integer cents throughout. Real tests (over-refund 3000>2000 rejected; cumulative-full allowed; 30-day rejection). |
| **FIX-010** `confirmPaymentProof` atomicity | KEEP | settle + status flip + invoice `markPaid` wrapped in one `db.transaction` (`confirmPaymentProof.ts:62-93`); `settlePayment` honors passed `tx` (`settle-payment.ts:43`); prior swallowing `catch {}` removed → failures propagate. Test proves in-tx execution + partial-failure rejection. **Caveat:** rollback proven structurally vs mock DB, not real-PG — follow-up integration test recommended (§7). |
| **CONFIG-GUARD** `update`/`deleteDuesConfig` cross-org | KEEP | Both compare `existing.organizationId !== ctx.get('organizationId')` → `ForbiddenError` (403) before mutate/delete; `findOneById` is unscoped-by-id and config table has NOT-NULL org → guard is load-bearing. Cross-org deny + same-org allow tested. |

**Cross-module [CROSS-MODULE RISK]:** settle delegates to `membershipLifecycle.settlePayment` (extends `duesExpiryDate`, recomputes status) and refund to `processRefund` (reverses fund allocations, resets expiry, recomputes status). Pass routes the tx through but does NOT change lifecycle internals. **Membership side-effect IS asserted** (refund test: "resets duesExpiryDate to pre-payment value" `'2025-06-30'`, "recomputes membership status" `lapsed`; partial-refund test: expiry NOT reset). → no revert signal.
**Test run:** `refundDuesPayment` + `dues-mutation-auth` + `dues-config-tenant-guard` + `confirmPaymentProof` = **31/0** (final dues module suite **312/0**).
**Naming note:** config-guard tests live in untracked `dues-config-tenant-guard.test.ts` (CONTINUE prompt said `dues-mutation-auth.test.ts`; that file holds the FIX-002 refund guard). Coverage exists — naming drift only.

---

## 5. Typecheck-error resolutions (Step 2)

All 3 were HEAD-level mid-refactor debt, NOT this session's fix-work. Resolved to reach `bun run --filter '*' typecheck` = **5/5**.

| Error | Root cause (self-verified) | Resolution |
| --- | --- | --- |
| `deleteMembership.ts:4` — no `DeleteMembershipParams` export | **Orphan by design.** `membership.tsp:863-867` DELIBERATELY removed the op (FIX-011 / decision #6 — officers use terminal states; hard delete is platform-admin only). Handler unwired: 0 hits in generated registry, not in `app.ts`, never imported. Test codifies removal (`crossOrgGuard.test.ts:131`). | Replaced the broken import with a **local param type** `type DeleteMembershipParams = { membershipId: string }`. Chosen over deletion to honor the CLAUDE.md hard rule "NEVER delete handler files to fix type errors — fix the types instead." Orphan-file deletion flagged as a follow-up `[NEEDS CONFIRMATION]` (§7). |
| `deleteMembershipApplication.ts:4` — no `DeleteMembershipApplicationParams` export | Same — `membership.tsp:1034-1036` removed the op (resolve-by-deny preserves audit trail). Unwired/unimported. | Local param type `{ applicationId: string }`; same rationale + follow-up flag. |
| `executeAccountDeletion.ts:112` — `'person.anonymized'` not in `DomainEventMap` | **A staged edit to `domain-events.registry.ts` wrongly removed the type.** The committed emitter is LIVE at line 112 and a committed test asserts it. The handler **anonymizes** (scrubs PII, keeps row) — the destructive cascade already ran separately via `executeCascadeDeletion()` (line 67, emits `person.deleted`). Option Y (switch emit to `person.deleted`) would double-fire the cascade → wrong + dangerous. | **Option X:** restored `'person.anonymized': { personId: string }` to `DomainEventMap` and replaced the stale comment with an accurate one. Verified: `executeAccountDeletion.test.ts` + `domain-event-consumers.test.ts` + `crossOrgGuard.test.ts` = 44/0. |

---

## 6. Final baseline (Step 4 validation)

| Check | Result |
| --- | --- |
| `bun run --filter '*' typecheck` | **5 / 5 workspaces GREEN** (`@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry`) |
| `bun test` (full api-ts, post-edit) | **6273 pass / 1 fail / 4 todo** — the 1 fail is pre-existing `registerEmailJobs` (email module; interval 30000≠1000; untouched by all 4 passes). No regressions from the edits (type-only changes). |
| Dues Batch B | 18 / 0 |
| Training operations suite | 447 / 0 |
| Credits suite | 193 / 0 |
| Dues module suite | 312 / 0 |
| Regen (`build` + `generate`) | confirmed no-op (generated/** in sync with tsp) |

**Tree:** preserved dirty (no commit). No forbidden git commands run. The 3 edits touch only: `services/api-ts/src/core/domain-events.registry.ts`, `services/api-ts/src/handlers/member/membership/deleteMembership.ts`, `services/api-ts/src/handlers/member/membership/deleteMembershipApplication.ts`.

---

## 7. Re-queued / follow-up work (NOT done this pass)

| Item | Type | Action |
| --- | --- | --- |
| **FIX-004 completion** — 5th cycle write path | Correctness gap (re-queue, not revert) | Migrate `CreditService.createEntry` (`credit.service.ts:37-38`) to `resolveCycle(org_cpd_config, activityDate)`; extend `credit-cycle-consistency.test.ts` to cover the `createMyCreditEntry` path. Small, scoped follow-up `04` pass. |
| **FIX-005 pending-vs-verified** | `[NEEDS PRODUCT DECISION]` | Currently moot (all writes `verificationStatus:'verified'`). Decide whether a pending-verification credit should ever count toward earned; if a pending-earned write path is added, filter it. |
| **Orphan handler cleanup** — `deleteMembership.ts`, `deleteMembershipApplication.ts` | `[NEEDS CONFIRMATION]` | Both are unwired/unimported and implement ops the spec deliberately removed. Recommend deleting the two files in an explicit cleanup commit (skipped here per CLAUDE.md "never delete handler files to fix type errors"). |
| **FIX-010 real-PG rollback** | Test hardening | Add an integration test asserting real Postgres rollback for `confirmPaymentProof` (current proof is structural vs mock DB). |
| **Migration deploy preflight** | Ops | 0068 (dup-enroll partial unique index) will FAIL on a DB with pre-existing duplicate active enrollments — run `SELECT training_id, person_id, count(*) FROM training_enrollment WHERE status <> 'cancelled' GROUP BY 1,2 HAVING count(*)>1` and de-dupe before applying. 0067 is additive/safe. |
| **Pre-existing `registerEmailJobs` fail** | Unrelated debt | Email job interval expectation (30000) vs config (1000) — pre-existing, not from any of these passes. Triage separately. |

---

## 8. Decision

**STABILIZED — `COMPLETE`.** Baseline is typecheck-GREEN (5/5) and the full suite carries no new failures. All 4 unverified autorun passes verified and **KEPT** (Training B with a documented, re-queued FIX-004 completion gap); the 3 pre-existing typecheck errors resolved with minimal, non-destructive, reversible fixes. No passes reverted; no forbidden git commands; tree preserved; nothing committed.

## 9. Recommended next step (manual, one session each via /clear + CONTINUE)

1. **FIX-004 completion** small `04` pass (5th cycle path) — highest value, closes the only correctness gap surfaced here.
2. **CONTINUE-22** — Training Batch E / FIX-014: real E2E proof of the P0 attendance→credit journey + cross-org RBAC (needs live stack: API 7213 + memberry 3004, Playwright pinned 1.58.2).
3. Orphan-handler cleanup + FIX-010 integration test (small, batchable).
4. Then carry-forward loose ends (realtime DM-UI, jobs Batch B, auth officerAuthMiddleware triplet) and Track B product decisions, then Track C roadmap consolidation (`07-consolidate-roadmap.md`).

Do NOT use `.claude/workflows/aha-autorun.js` until it has per-pass git-worktree isolation.
