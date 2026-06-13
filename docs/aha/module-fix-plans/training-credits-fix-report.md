# AHA Module/Group Fix Report: Training & Credits

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — P0 core credit-award journey + correctness bugs on the same path (FIX-001, FIX-002, FIX-003) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked at start; TDD discipline applied) |
| Working tree status checked | Yes (`git status --short` before edits; prior AHA changes for membership-lifecycle / dues-payments / billing-stripe + migrations 0062/0063 preserved, untouched) |
| Fix scope | P0 / P1 / V1 REQUIRED inside Batch A only |
| Out of scope | Batch B/C/D/E/F; all `[NEEDS PRODUCT DECISION]` items; V2 DEFERRED; DO NOT ADD |
| Shared files touched | Yes — credits repo read-only via new module-local helper; new domain event + consumer; `[SHARED DEPENDENCY]` / `[CROSS-MODULE RISK]` documented |
| Schema/migration touched | No (no DB migration in Batch A by design — `type` column is Batch C, enrollment index is Batch D) |
| Limitations | No live server boot / no E2E execution this pass (focused unit + typecheck validation per prompt). The 2 flagged Playwright specs were read (not run) and confirmed fake-green for the credit journey. The 3 runtime `[NEEDS CONFIRMATION]` items were all resolved by static + test evidence (see §7). |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — attendance→credit award journey broken end-to-end | P0 | V1 REQUIRED | A | Core platform value; produced zero AUTO credit through the product | Fixed |
| FIX-002 | G8 — silent credit-award failure (bare `catch {}`) | P1 | V1 REQUIRED | A | Completion falsely reported credits never persisted; no trace | Fixed |
| FIX-003 | G6 — lifecycle event mis-scoping (enrollment cancel emits program-wide event) | P1 | V1 REQUIRED | A | One enrollment-cancel mass-notified every enrollee `[CROSS-MODULE RISK]` | Fixed (corrected scope — see §9) |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `check-in.test.ts` + `training-enrollment.test.ts` | 53 pass / 0 fail | baseline | Clean baseline before new tests added |
| New FIX-001 check-in award test | FAIL — `createdCredit` is `null` | FIX-001 | RED: `checkInCustomTraining` wrote nothing, awarded nothing |
| New FIX-002 silent-failure test | FAIL — `creditAwarded` === 10 despite insert throwing | FIX-002 | RED: bare `catch {}` swallowed the error and reported success |
| New FIX-003 cancel-event test | FAIL — emitted `training.cancelled` (program-wide) | FIX-003 | RED: enrollment-cancel fired the mass-notify event |
| `specs/api` `bun run lint` (tsp compile) | Compiles (warnings only, 0 errors) | FIX-001 | Confirmed regen pipeline usable in this env |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Added optional `personId` query param to `checkInCustomTraining` (TypeSpec → regen). Handler now targets the named enrollee, transitions `enrolled→completed`, and awards an AUTO credit to THAT member (idempotent). Attendance UI now sends `personId`. | `specs/api/src/association/operations/training.tsp`, `services/api-ts/src/generated/openapi/validators.ts` (regen), `checkInCustomTraining.ts`, `apps/memberry/.../attendance.tsx`, SDK `types.gen.ts`/`sdk.gen.ts`/`react-query.gen.ts` (regen) | `[SHARED DEPENDENCY]` — reads/writes credits repo in `association:member/repos` (in place, not relocated) | Check-in award reuses the shared award routine |
| FIX-002 | Extracted the credit-award logic into `utils/award-training-credit.ts`; replaced the bare `catch {}` with a logged failure that returns `creditAwarded: 0` instead of the misleading non-zero. `completeTrainingEnrollment` now delegates to it. | `services/api-ts/src/handlers/association:operations/utils/award-training-credit.ts` (new), `completeTrainingEnrollment.ts` | `[SHARED DEPENDENCY]` (same credits repo) | Single award pipeline → both check-in and complete benefit |
| FIX-003 | Registered new `training.enrollment.cancelled` event; `cancelCustomTraining` now emits it (enrollment-scoped) instead of program-wide `training.cancelled`. Added a consumer that notifies ONLY the affected member. | `domain-events.registry.ts`, `cancelCustomTraining.ts`, `domain-event-consumers.ts` | `[CROSS-MODULE RISK]` — event rename; program-wide consumer retained for genuine program cancellation | Corrected the gap plan's premise (see §9) |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `association:operations/check-in.test.ts` | backend/unit + regression | Officer check-in with `personId` writes an AUTO credit for that member (not the officer), completes the enrollment, and is idempotent on re-check-in | FIX-001 |
| `association:operations/training-enrollment.test.ts` | backend/unit (failure-path) | A credit-insert failure reports `creditAwarded: 0` and logs the error — not a swallowed false success | FIX-002 |
| `association:operations/training-lifecycle.test.ts` | backend/unit + regression | `cancelCustomTraining` emits `training.enrollment.cancelled` and NOT the program-wide `training.cancelled` | FIX-003 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test check-in.test.ts training-enrollment.test.ts` (baseline) | Passed (53/53) | Pre-change baseline |
| New Batch A tests (first run, pre-implementation) | Failed (3 RED for the right reasons) | Confirmed real defects before fixing |
| `bun test check-in + training-enrollment + training-lifecycle` (post-fix) | Passed (69/69) | All Batch A green |
| `bun test src/handlers/association:operations/ src/handlers/member/credits/` | Passed (606/606, 38 files) | Full training + credits module suite |
| `bun test src/core/domain-event-consumers.test.ts src/core/domain-events.test.ts` | Passed (23/23) | New event + consumer regression |
| Final combined regression (5 touched files) | Passed (92/92) | — |
| `services/api-ts` `bun run typecheck` (`tsc --noEmit`) | Passed (exit 0) | New event type + handler signatures clean |
| `packages/sdk-ts` `bun run typecheck` | Passed (exit 0) | Regenerated SDK types clean |
| `apps/memberry` `tsc --noEmit` | Passed (exit 0, 0 errors) | Attendance UI `personId` wiring clean |
| `specs/api` `bun run build` + `services/api-ts` `bun run generate` + SDK `bun run generate` | Succeeded (exit 0) | Regen pipeline; only the `personId` line added to validators/SDK |

## 7. Validation Summary

- **Passed:** All 3 new failing tests now pass; full training + credits module suite (606), domain-event consumer/event suite (23), and all three workspace typechecks (api, sdk, memberry app) pass. The regen pipeline (TypeSpec → OpenAPI → validators + SDK) ran cleanly and added only the single intended `personId` field.
- **Failed:** None.
- **Not run:** Whole-repo test suite (out of scope per prompt — focused validation only). Live E2E / browser run (no server boot this pass). The 2 flagged Playwright specs were inspected, not executed.
- **Blocked:** None for Batch A.
- **Pre-existing/unrelated:** The working tree carries prior AHA fixes (membership/dues/billing + migrations 0062/0063) — all preserved and untouched. SDK regen emitted pre-existing "transformer too complex" warnings (unrelated to this change).
- **`[NEEDS CONFIRMATION]` resolved this pass:**
  1. *What the 2 `*training-completion*` Playwright specs assert* → **Confirmed fake-green** for the credit journey: `officer/training-completion.spec.ts` only asserts page render + wire-fired status (200/304/401/403); `member/training-completion-flow.spec.ts` only asserts page content visibility. Neither checks in a member or verifies a persisted credit. They provide zero protection for the P0 journey → the new backend tests are the real coverage.
  2. *Member self-complete corruption (FIX-003 premise)* → **Disproven**: `completeCustomTraining`, `cancelCustomTraining`, and `checkInCustomTraining` are all officer-gated (`requirePosition` Society Officer/President; roles `association:admin`/`association:staff`) — members cannot reach them. The "member self-complete blocks officer award" scenario is not reachable. See §9.
  3. *`searchTrainings` `type` filter behaviour* → not in Batch A (FIX-007/Batch C); not investigated this pass.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Credits repo (read+write) | `association:member/repos/credits.repo.ts` (`createOne`, `findByTrainingAndPerson`) via new `utils/award-training-credit.ts` | Consumed by `completeTrainingEnrollment` + `checkInCustomTraining` (the two AUTO-credit writers) | 606-test training+credits suite passes; idempotency proven | `[SHARED DEPENDENCY]` — fixed in place, not relocated (P1-11 split unaffected). No schema change. |
| Domain event bus | `domain-events.registry.ts` (+`training.enrollment.cancelled`), `domain-event-consumers.ts` (new consumer) | New event is additive; program-wide `training.cancelled` consumer + type retained | 23-test consumer/event suite passes | `[CROSS-MODULE RISK]` — event rename isolates enrollment-cancel from program-cancel mass-notify |
| Generated artifacts | `generated/openapi/validators.ts`, SDK `types.gen.ts`/`sdk.gen.ts`/`react-query.gen.ts` | Regenerated, not hand-edited; diff limited to the `personId` addition | All 3 workspace typechecks pass | Per CLAUDE.md: never hand-edit generated files — all changes flowed from the TypeSpec edit |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Real E2E proof of officer-checks-in-member → persisted AUTO credit across reload | FIX-001 / FIX-014 | E2E not executed this pass (no server boot); the 2 existing specs are fake-green | Replace/extend `officer/training-completion.spec.ts` with a real assertion (check in member → `/my/credits` shows AUTO entry → reload) during a Batch E/E2E pass |
| `completeCustomTraining` (officer program-complete) still awards NO credit and only completes the caller's own enrollment | adjacent to G1/G6 | The officer "complete whole training" path is a separate broken op; fixing it is a scope expansion beyond Batch A's three fixes and overlaps a product-decision on bulk-award semantics | Re-scope in a follow-up Batch A.2 or Batch B: decide whether program-complete should bulk-award all present enrollees |
| `setCheckedIn` local optimistic Set retained in attendance UI | FIX-001 (UI) | Kept as harmless optimistic overlay; real persistence + query invalidation now happen server-side | Optional cleanup later; not required (reload reflects server state) |
| FIX-001 self-check-in path (no `personId`) still awards no credit | FIX-001 | Officer self-check-in is a legacy/edge path, not the member-attendance journey | Acceptable; member-attendance journey is the fixed path |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Self-complete (`completeCustomTraining`) existence/scope | `[NEEDS PRODUCT DECISION]` | Whether officer program-complete should bulk-award; whether self-complete should exist | Product decision (Elad) |
| Paid-training pay-and-enroll path (G5) | `[NEEDS PRODUCT DECISION]` + `[CROSS-MODULE RISK]` | Out of Batch A; payment leg in M06 | Product decision on V1 paid trainings |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-004 single cycle authority (G2) | Batch B | Not the selected batch |
| FIX-005 void/pending-aware aggregates (G3) | Batch B | Not the selected batch |
| FIX-006 one required-credits source (G4) | Batch B | Not the selected batch |
| FIX-007 `training.type` column + FIX-008 credit lock (G7) | Batch C | Needs migration + regen; separate pass |
| FIX-009..FIX-013 (toggle, dup-enroll, `/my/training` predicate, CSV, org-strip) | Batch D | Not the selected batch |
| Fractional credits (F4) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Migration behind product decision |
| Enrollment modes / waitlist / network approval / LMS expansion | `V2 DEFERRED` / `DO NOT ADD` `[DO NOT OVERBUILD]` | Outside scope |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `specs/api/src/association/operations/training.tsp` | Added optional `personId` query param to `checkInCustomTraining` | FIX-001 |
| `services/api-ts/src/generated/openapi/validators.ts` | Regenerated — `CheckInCustomTrainingQuery` now includes `personId?` | FIX-001 (generated) |
| `services/api-ts/src/handlers/association:operations/checkInCustomTraining.ts` | Rewrote: officer marks named enrollee present → complete enrollment + award credit (idempotent); legacy self-check-in preserved | FIX-001 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance.tsx` | Check-in mutation now sends `personId: memberId` | FIX-001 |
| `packages/sdk-ts/src/generated/{types,sdk,@tanstack/react-query}.gen.ts` | Regenerated — check-in now accepts `personId` query | FIX-001 (generated) |
| `services/api-ts/src/handlers/association:operations/utils/award-training-credit.ts` | New shared award routine; logs + surfaces insert failures (no bare catch) | FIX-002 |
| `services/api-ts/src/handlers/association:operations/completeTrainingEnrollment.ts` | Delegates credit award to the shared routine | FIX-002 |
| `services/api-ts/src/core/domain-events.registry.ts` | Added `training.enrollment.cancelled` event type | FIX-003 |
| `services/api-ts/src/handlers/association:operations/cancelCustomTraining.ts` | Emits enrollment-scoped event instead of program-wide | FIX-003 |
| `services/api-ts/src/core/domain-event-consumers.ts` | Added consumer that notifies only the affected member | FIX-003 |
| `services/api-ts/src/handlers/association:operations/{check-in,training-enrollment,training-lifecycle}.test.ts` | Added failing-first tests for FIX-001/002/003 | FIX-001/002/003 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline (3 failing tests for the right reasons) | §3 of this report (test output captured) | FIX-001/002/003 |
| GREEN: 69/69 Batch A, 606/606 module suite, 23/23 consumer suite, 92/92 final regression | §6 of this report | All |
| Three-workspace typecheck (api/sdk/memberry all exit 0) | §6 of this report | All |
| Fake-green confirmation of the 2 Playwright specs | §7 item 1 | FIX-001 |
| (No screenshot/Playwright/Webwright files saved — no browser run this pass) | — | — |

## 14. Completion Decision

**PARTIALLY COMPLETE**

All three selected Batch A fixes (FIX-001, FIX-002, FIX-003) are implemented, root-caused, and validated by failing-first unit/regression tests plus three clean workspace typechecks. The P0 credit-award seam now works end-to-end at the API + SDK + UI wiring level: an officer marking a named member present persists the completion and awards a single AUTO credit to that member, idempotently; insert failures are surfaced not swallowed; and an enrollment cancel no longer mass-notifies every enrollee.

It is **PARTIALLY COMPLETE** (not COMPLETE) for two honest reasons: (1) browser-level E2E proof of the P0 journey was not executed this pass and the existing specs are fake-green, so the journey is proven at unit + type level but not yet by a real reload-persistence E2E; (2) the fix-ready plan's FIX-003 premise (member self-complete corruption) was disproven during implementation — the surviving real bug (event mis-scoping) was fixed, but the adjacent broken `completeCustomTraining` program-complete-without-award path and the self-complete product question remain open (§9/§10).

## 15. Recommended Next Step

Run a focused E2E/regression pass for the P0 journey, then proceed to Batch B.

- First: rerun focused proof — replace the fake-green `apps/memberry/tests/e2e/officer/training-completion.spec.ts` with a real assertion (officer checks in member → member's `/my/credits` shows the AUTO entry → persists across reload). Command path: a Batch E / E2E pass via `04-module-or-group-fix-tdd.md` (FIX-014) or `/qa` on the running app.
- Then: run another `04-module-or-group-fix-tdd.md` pass for **Batch B** (FIX-004 single cycle authority, FIX-005 void/pending-aware aggregates, FIX-006 one required-credits source) — it now has real AUTO credit rows from Batch A to assert against.
  - Module/group: Training & Credits
  - Module slug: `training-credits`
  - Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
  - Input fix-ready plan: `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md`
  - Recommended batch: Batch B — P1 data-trust (cycle authority, void exclusion, required-credits source)
- Also recommend: request a product decision on `completeCustomTraining` program-complete semantics (bulk-award vs none) before it is wired (§10), since it is the natural companion to the FIX-001 check-in award.

---
---

# AHA Module/Group Fix Report: Training & Credits — Batch B (FIX-004, FIX-005, FIX-006 + FIX-014 nets)

> Appended section. Prior Batch A section above is unchanged.

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-report.md` |
| Fix date | 2026-06-12 |
| Batch executed | Batch B — P1 data-trust (FIX-004 cycle authority, FIX-005 void/pending-aware aggregates, FIX-006 one required-credits source) + the deferred FIX-014 cycle-consistency + void-exclusion + RBAC regression nets |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked at start; RED→GREEN discipline applied per fix) |
| Working tree status checked | Yes (`git status --short` first; tree is intentionally dirty from prior AHA passes — preserved. Touched ONLY the files needed for Batch B; no destructive git used; no commit) |
| Fix scope | P1 / V1 REQUIRED inside Batch B only (+ FIX-014 test net) |
| Out of scope | Batch C/D; all `[NEEDS PRODUCT DECISION]` items; paid trainings (G5); V2 DEFERRED; DO NOT ADD |
| Shared files touched | Yes — credits repo (read filters), shared `make-ctx.ts` test util (additive `select` shim), hand-wired `app.ts` transcript query validators. `[SHARED DEPENDENCY]` documented in §8 |
| Schema/migration touched | No DB migration generated/applied. Matview definition (migration 0046) inspected only (already filters `status='active'`) — no edit |
| Limitations | No live server boot / no E2E this pass (focused unit + repo-SQL-introspection + workspace typecheck per prompt). The two FIX-006 `[NEEDS CONFIRMATION]` items were resolved by static + test evidence (see §7) |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-004 | G2 — multiple incompatible cycle computations stamp `cycleStart/cycleEnd` at the credit-write paths [⚠️ CORRECTED 2026-06-12: **five** write paths total, not four — the 5th, member self-service `CreditService.createEntry`, was missed by this pass and closed in the FIX-004-completion section at the end of this report] | P1 | V1 REQUIRED | B | Same member's entries landed in different windows → wrong compliance/transcript | Fixed (4 of 5 paths this pass; 5th in FIX-004-completion) |
| FIX-005 | G3 — voided entries counted in aggregates (`sumCreditsByOrg`/`sumCreditsForCycle`/`sumCreditsByCategoryBatch`/`listForPerson` lacked `status='active'`) | P1 | V1 REQUIRED | B | Officer void had no effect on member-visible totals / transcript / compliance | Fixed |
| FIX-006 | G4 — required-credits had 4 sources incl. client-supplied transcript params (member self-certifies on regulator PDF) | P1 | V1 REQUIRED | B | Officer/member saw contradictory verdicts; security/integrity hole on the PDF | Fixed |
| FIX-014 | Cross-path cycle-consistency + void-exclusion + officer-of-other-org RBAC regression nets | P1 | V1 REQUIRED | E (woven into B) | Without the net, B fixes can regress silently | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `resolveCycle` import in `credit-cycle.test.ts` | FAIL — `Export named 'resolveCycle' not found` | FIX-004 | RED: single authority did not exist |
| Cross-path consistency (`credit-cycle-consistency.test.ts`) | FAIL — training path = 2024-09-15 (degenerate, config ignored); job path = 2026-01-01 (`now`, not activity date) | FIX-004 | RED for the right reasons; manual path already config-driven (passed) |
| Repo aggregate filter (`credits.repo.aggregate-filter.test.ts`) | FAIL — `sumCreditsByOrg`/`sumCreditsForCycle`/`sumCreditsByCategoryBatch`/`listForPerson` had no `status='active'` chunk | FIX-005 | RED via Drizzle SQL-chunk introspection |
| Required-credits source (`required-credits-source.test.ts`) | FAIL — `getCreditCompliance`/`getCreditTranscript`/`getCreditTranscriptPdf` used client `requiredCredits=1` | FIX-006 | RED: handlers honored client override |
| `compliance_standings` matview filter | Already `WHERE ce.status='active'` (migration 0046:12) | FIX-005 | `[NEEDS CONFIRMATION]` RESOLVED — matview already correct |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-004 | Added one `resolveCycle(config, activityDate)` authority in `credit-cycle.ts` (2020-epoch aligned, reads `cycleStartMonth`/`cycleLengthYears`). Wired it into four write paths [⚠️ CORRECTED 2026-06-12 — this "ALL paths" claim was overstated: a FIFTH path, the member self-service `CreditService.createEntry` (person `createMyCreditEntry`), was missed and still used the legacy `getCycleForDate(activityDate, activityDate, 2)`. It is now wired to `resolveCycle` too — see the FIX-004-completion section at the end of this report]: `award-training-credit.ts` (now reads `org_cpd_config` + anchors on activity date, replacing degenerate `getCycleForDate(...,2)`), `awardManualCredit.ts`, `creditIssue.ts` (anchors on payload `activityDate` when present, else now; removed dead `computeCycleBoundaries`), `adjustCreditEntry.ts` | `credit-cycle.ts`, `award-training-credit.ts`, `awardManualCredit.ts`, `creditIssue.ts`, `adjustCreditEntry.ts` | `[SHARED DEPENDENCY]` — credits repo/schema in `association:member/repos`, consumed across 3 dirs; fixed in place, NOT relocated (P1-11 split unaffected) | `resolveCycle` is behavior-preserving for the manual path (existing `computes correct cycle boundaries` test still passes unchanged) |
| FIX-005 | Added `status='active'` filter to `sumCreditsByOrg`, `sumCreditsForCycle`, `sumCreditsByCategoryBatch`; added optional `status` to `CreditEntryFilters`/`buildWhereConditions`; `listForPerson` (transcript entries) opts into `status:'active'`. Plain `findMany({personId})` (DPA data export) intentionally NOT forced to active so voided entries remain in the legal record | `credits.repo.ts` | `[SHARED DEPENDENCY]` — repo feeds all credit reads | ONLY `status` filtered; `verificationStatus` (pending policy) deliberately untouched — see §10 product-decision boundary |
| FIX-006 | `getCreditCompliance`, `getCreditTranscript`, `getCreditTranscriptPdf` now resolve `requiredCredits` + cycle from `org_cpd_config` server-side (fallback 60/3 = existing config defaults) and IGNORE client `requiredCredits`/`cyclePeriodYears`/`registrationDate`/`cycleStartMonth/Day`. Stripped those params from the hand-wired `app.ts` transcript query validators (kept `carryoverEnabled`/`previousCycleEarned`/`personName`). FE `reports/credits.tsx` no longer sends `?requiredCredits=45&cyclePeriodYears=3`; PRC note reflects server value | `getCreditCompliance.ts`, `getCreditTranscript.ts`, `getCreditTranscriptPdf.ts`, `app.ts`, `apps/memberry/.../officer/reports/credits.tsx` | `[CROSS-MODULE RISK]` — hand-wired `app.ts` routes; middleware order preserved (`query validator → authMiddleware → handler`, smaller schema) | Did NOT seed a new default literal — reuses the existing 60/3 `org_cpd_config` defaults (no product-decision gate hit) |
| FIX-014 | Cross-path cycle-consistency net (3 write paths → same window for same anchor+config); repo void-exclusion SQL net; matview `status='active'` characterization; officer-of-other-org compliance RBAC denial (proves `requirePosition` scopes to the path-param org) | new test files (§5) | test-only | RBAC `[NEEDS CONFIRMATION]` RESOLVED — see §7 |
| (test infra) | Added an additive `select()` shim to shared `make-ctx.ts` `makeMockDb` so handlers/utils that issue a raw config select don't throw under the mock DB (returns empty → config defaults) | `test-utils/make-ctx.ts` | `[SHARED DEPENDENCY]` test util — additive only | Verified no regression across full suite |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/credits/utils/credit-cycle.test.ts` | backend/unit | `resolveCycle` anchors from config (not hardcoded 2y), honors July anchor, defaults to 60/3-shape, deterministic | FIX-004 |
| `member/credits/credit-cycle-consistency.test.ts` (new) | backend/unit + regression | Training-completion, manual-award, and job paths stamp an IDENTICAL `[cycleStart,cycleEnd)` for the same anchor+config | FIX-004 / FIX-014 |
| `association:member/repos/credits.repo.aggregate-filter.test.ts` (new) | backend/unit + data | `sumCreditsByOrg`/`sumCreditsForCycle`/`sumCreditsByCategoryBatch`/`listForPerson` carry a `status='active'` predicate; DPA `findMany` does NOT | FIX-005 / FIX-014 |
| `member/credits/compliance-matview.schema.test.ts` (new) | data/schema + regression | The `compliance_standings` matview definition filters `ce.status='active'` (locks the resolved `[NEEDS CONFIRMATION]`) | FIX-005 |
| `member/credits/required-credits-source.test.ts` (new) | backend/unit + permission/RBAC | Compliance + both transcript endpoints resolve `requiredCredits` from config and IGNORE client overrides; officer of org A is denied (403) reading org B compliance | FIX-006 / FIX-014 |
| `member/credits/credits.test.ts` (updated) | backend/unit | Transcript cross-org tests assert config-driven `required` (40 via injected config) instead of client param | FIX-006 |
| `member/credits/getCreditTranscriptPdf.test.ts` (updated) | backend/unit | PDF carryover/compliance assertions run against injected config (required=40) instead of client param | FIX-006 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test credit-cycle.test.ts` (RED→GREEN) | Passed (34/34) | resolveCycle authority |
| `bun test credit-cycle-consistency.test.ts` | Passed (3/3) | RED (2 fail for right reasons) → GREEN after wiring |
| `bun test credits.repo.aggregate-filter.test.ts` | Passed (5/5) | RED (3) → GREEN; +2 listForPerson/data-export |
| `bun test compliance-matview.schema.test.ts` | Passed (1/1) | matview characterization |
| `bun test required-credits-source.test.ts` | Passed (4/4) | RED (3) → GREEN; +1 RBAC |
| `bun test` (training + credits + jobs + person suites) | Passed (834/834, 80 files) | full affected-module regression |
| `bun test` (final focused Batch B + FIX-014 set, 12 files) | Passed (216/216) | all nets green together |
| `bun run typecheck` (api) | Passed (exit 0) | — |
| `bun run --filter '*' typecheck` | Passed (5/5: ui, admin, sdk, api, memberry) | FE `reports/credits.tsx` clean |
| `bun test` (FULL repo suite) | 6227 pass / 1 fail / 4 todo | the 1 fail is the documented pre-existing `registerEmailJobs` interval test (email module, unrelated). +22 over baseline = this pass's new tests |

## 7. Validation Summary

- **Passed:** every new RED test went GREEN after the minimal fix; full training+credits+jobs+person suites (834) pass; full repo suite 6227 pass; all five workspace typechecks pass.
- **Failed:** none attributable to this pass.
- **Pre-existing/unrelated:** the single full-suite failure is `registerEmailJobs > registers email.processor as interval job` (expects 30000ms, env yields 1000ms) — email module, documented baseline failure, not this pass.
- **`[NEEDS CONFIRMATION]` resolved this pass:**
  1. *Does `compliance_standings` matview filter `status='voided'`?* → **YES, already correct.** Migration `0046_wave2b_compliance_view.sql:12` ends `... WHERE ce.status='active' GROUP BY ...`. The matview (officer compliance report path) already agrees with the FIX-005 repo filters. Locked by `compliance-matview.schema.test.ts`.
  2. *Does `requirePosition` scope to the ctx org set from the path param in `getCreditCompliance`?* → **YES.** `getCreditCompliance` sets `ctx.organizationId` from the path param BEFORE calling `requirePosition`, which queries `OfficerTermRepository.findActiveByPersonAndOrg(user.id, ctxOrg)`. An officer of another org gets zero terms → 403. Proved by the FIX-014 RBAC test.
- **Product-decision gates — NOT hit (plumbing only):**
  - *45-vs-60 default literal:* FIX-006 resolves from `org_cpd_config` and falls back to the **existing** 60/3 config defaults (already in the schema + `getCpdConfig`). No new default literal was seeded/invented.
  - *Manual-entry pending policy:* FIX-005 filters ONLY `status='active'` (void exclusion). `verificationStatus='pending'` counting behavior was left exactly as-is (counted) — the policy was not changed, so the gate was not forced.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Credits repo (read filters) | `association:member/repos/credits.repo.ts` | All credit reads: transcript, compliance, peer, my-credits-list, data-export | aggregate-filter test (5) + 834-test module suite | `[SHARED DEPENDENCY]` — fixed in place, not relocated. Data-export read deliberately keeps voided rows |
| Single cycle authority | `member/credits/utils/credit-cycle.ts` (`resolveCycle`) | 4 write paths this pass (training/manual/job/adjust) [⚠️ a 5th — member self-service `CreditService.createEntry` — was missed; closed 2026-06-12, see FIX-004-completion] | consistency test (3) + each write path's own test suite | `[SHARED DEPENDENCY]` — one function now owns cycle math |
| Hand-wired transcript routes | `app.ts:520-541` (query validators) | `/persons/me/credit-transcript[/pdf]` | typecheck + handler tests | `[CROSS-MODULE RISK]` — middleware order preserved; no contract test depends on the removed params |
| Shared test util | `test-utils/make-ctx.ts` (additive `select` shim) | every handler test using `makeMockDb` | full suite (6227) | additive only; returns empty result so config-backed code uses documented defaults |
| `compliance_standings` matview | migration `0046_wave2b_compliance_view.sql` | `getComplianceReport` officer path | matview schema test | inspected only — already filters `status='active'`; no migration edit |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Fifth required-credits source: `getMyCreditSummary` (`/persons/me/credit-summary`, the endpoint `/my/credits` actually uses) reads `associations.requiredCreditsPerCycle` and still accepts client `registrationDate`/`cyclePeriodYears`/`targetDate` | FIX-006 (adjacent, discovered) | Out of FIX-006's named scope (plan named compliance + transcript + `org_cpd_config`). `requiredCredits` there is already server-derived (not client), but from a DIFFERENT table than `org_cpd_config` | Reconcile `associations.requiredCreditsPerCycle` vs `org_cpd_config.requiredCredits` into one authority; strip its client cycle params — schedule a follow-up `04` slice or fold into Batch C |
| Cross-org transcript org-context | FIX-006 | Hand-wired `/persons/me/credit-transcript[/pdf]` routes have no org-context middleware, so `ctx.organizationId` is undefined → config falls back to platform defaults (60/3) rather than the member's actual org config. (Still SAFE — no longer client-controlled — and these endpoints currently have no active FE consumer.) | If the transcript endpoints are surfaced in the FE, add org scoping (path/query org → `org_cpd_config`) so the PDF uses the member's real org requirement |
| Real E2E proof of void→total-drop and cross-path consistency through the UI | FIX-005/FIX-014 | No server boot/E2E this pass (focused unit + repo-SQL proof per prompt) | Add an E2E in a Batch E pass: officer voids → member `/my/credits` total drops on reload |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Manual-entry PENDING-counting policy (whether `verificationStatus='pending'` counts) | `[NEEDS PRODUCT DECISION]` | FIX-005 intentionally avoided this by filtering ONLY `status`; finalizing a `verificationStatus` filter needs the policy | Product decision on the verification gate |
| Canonical 45-vs-60 required-credits default literal | `[NEEDS PRODUCT DECISION]` | FIX-006 plumbing is done (resolve-from-config); the seeded default value remains the existing 60/3, which conflicts with FE/PRC "45" copy | Product decision on the canonical PH default; then update `org_cpd_config`/`associations` defaults + seeds |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-007 `training.type` column + FIX-008 credit lock | Batch C | Needs migration + TypeSpec regen; separate pass |
| FIX-009..FIX-013 (toggle, dup-enroll, `/my/training` predicate, CSV, org-strip) | Batch D | Not the selected batch |
| Paid trainings (G5), fractional credits (F4) | `[NEEDS PRODUCT DECISION]` / V2 DEFERRED | Out of scope |
| `getCreditCompliance` deprecation in favor of matview-only | `[DO NOT OVERBUILD]` | FIX-006 made it config-driven (trustworthy); full removal is a follow-up cleanup, not required for V1 trust |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/credits/utils/credit-cycle.ts` | Added `resolveCycle` single cycle authority + `ResolveCycleConfig` | FIX-004 |
| `services/api-ts/src/handlers/association:operations/utils/award-training-credit.ts` | Reads `org_cpd_config`, uses `resolveCycle` (replaced degenerate hardcoded-2y cycle) | FIX-004 |
| `services/api-ts/src/handlers/member/credits/awardManualCredit.ts` | Inline 2020-epoch math → `resolveCycle` | FIX-004 |
| `services/api-ts/src/handlers/association:member/jobs/creditIssue.ts` | `computeCycleBoundaries(now)` → `resolveCycle(config, activityDate ?? now)`; payload `activityDate`; removed dead helper | FIX-004 |
| `services/api-ts/src/handlers/member/credits/adjustCreditEntry.ts` | Inline math → `resolveCycle` | FIX-004 |
| `services/api-ts/src/handlers/association:member/repos/credits.repo.ts` | `status='active'` filter on 3 aggregates + optional `status` filter; `listForPerson` opts in | FIX-005 |
| `services/api-ts/src/handlers/member/credits/getCreditCompliance.ts` | Resolve required+cycle from `org_cpd_config`; ignore client params | FIX-006 |
| `services/api-ts/src/handlers/member/credits/getCreditTranscript.ts` | Resolve from config; ignore client params; trimmed query interface | FIX-006 |
| `services/api-ts/src/handlers/member/credits/getCreditTranscriptPdf.ts` | Resolve from config; ignore client params; trimmed query interface | FIX-006 |
| `services/api-ts/src/app.ts` | Stripped client compliance params from hand-wired transcript query validators | FIX-006 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` | Stop sending `?requiredCredits=45&cyclePeriodYears=3`; PRC note uses server value | FIX-006 |
| `services/api-ts/src/test-utils/make-ctx.ts` | Additive `select()` shim on mock DB | FIX-004 (test infra) |
| `services/api-ts/src/handlers/member/credits/utils/credit-cycle.test.ts` | Added resolveCycle describe | FIX-004 |
| `services/api-ts/src/handlers/member/credits/credit-cycle-consistency.test.ts` (new) | Cross-path consistency net | FIX-004/FIX-014 |
| `services/api-ts/src/handlers/association:member/repos/credits.repo.aggregate-filter.test.ts` (new) | Void-exclusion SQL net | FIX-005/FIX-014 |
| `services/api-ts/src/handlers/member/credits/compliance-matview.schema.test.ts` (new) | Matview status filter characterization | FIX-005 |
| `services/api-ts/src/handlers/member/credits/required-credits-source.test.ts` (new) | Source-of-truth + RBAC nets | FIX-006/FIX-014 |
| `services/api-ts/src/handlers/member/credits/credits.test.ts` | Transcript tests assert config-driven required | FIX-006 |
| `services/api-ts/src/handlers/member/credits/getCreditTranscriptPdf.test.ts` | PDF tests inject config | FIX-006 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baselines (resolveCycle export missing; training/job windows wrong; aggregates unfiltered; client-param honored) | §3 + test output captured this pass | FIX-004/005/006 |
| GREEN: 216/216 focused; 834/834 module; 6227 full-suite pass | §6 | All |
| Five-workspace typecheck (5/5 exit 0) | §6 | All |
| Matview `status='active'` confirmation | migration `0046_wave2b_compliance_view.sql:12` | FIX-005 |
| (No screenshot/Playwright/Webwright — no browser run this pass) | — | — |

## 14. Completion Decision

**COMPLETE**

All three Batch B fixes (FIX-004, FIX-005, FIX-006) plus the deferred FIX-014 regression nets are implemented test-first (RED watched, then minimal GREEN), prove real persisted behavior (cycle windows stamped on inserts, status filters in the query SQL, server-resolved required credits replacing client overrides), and pass focused + module-wide + full-suite tests and all five workspace typechecks. No product-decision gate was hit (FIX-006 reuses existing 60/3 config defaults; FIX-005 filters only `status`, not the pending policy). The two `[NEEDS CONFIRMATION]` items (matview status filter, RBAC org scoping) were resolved with test evidence, not assumed. The only full-suite failure is the documented pre-existing `registerEmailJobs` interval test (unrelated email module).

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch C** (FIX-007 `training.type` column + FIX-008 credit-value lock) — it requires a DB migration + TypeSpec regen, isolated from Batch B by design.
- Module/group: Training & Credits
- Module slug: `training-credits`
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md`
- Recommended batch: Batch C — P1 spec alignment (migration + regen)
- Also fold in (Remaining Gap §9): reconcile the 5th required-credits source `getMyCreditSummary`/`associations.requiredCreditsPerCycle` with `org_cpd_config`, and add org-context scoping to the cross-org transcript endpoints if/when surfaced in the FE.

---
---

# AHA Module/Group Fix Report: Training & Credits — Batch B FIX ROUND (verifier MUST-FIX: FIX-006 5th source `getMyCreditSummary`)

> Appended section. Prior Batch A and Batch B sections above are unchanged. This is a follow-up FIX ROUND addressing the adversarial-verifier MUST-FIX raised against the Batch B FIX-006 completion (the 5th required-credits source that Batch B left as a "deferred" Remaining Gap §9 instead of closing).

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-report.md` |
| Fix date | 2026-06-12 |
| Batch executed | Batch B FIX ROUND — close the FIX-006 (G4) integrity hole the verifier flagged: `getMyCreditSummary` was the 5th required-credits source (read `associations.requiredCreditsPerCycle`) and still honored client-supplied `registrationDate`/`cyclePeriodYears`/`targetDate` |
| Superpowers used | No (`/using-superpowers` not invoked; this is a single tightly-scoped continuation of the already-completed Batch B FIX-006 — TDD discipline applied directly: RED watched, then minimal GREEN) |
| Working tree status checked | Yes (`git status --short` first; tree intentionally dirty from prior AHA passes — preserved. Touched ONLY the two files needed for this fix; no destructive git; no commit) |
| Fix scope | P1 / V1 REQUIRED — completion of FIX-006 (G4) single required-credits source of truth |
| Out of scope | Batch C/D; paid trainings (G5); all `[NEEDS PRODUCT DECISION]` items; V2 DEFERRED; DO NOT ADD; cross-org transcript org-context scoping (still tracked in Batch B §9; endpoints have no active FE consumer) |
| Shared files touched | No new shared files beyond the already-touched FIX-006 surface. `getMyCreditSummary.ts` is a person-module handler; it now consumes the SAME `resolveCycle` authority + `org_cpd_config` source used by the Batch B FIX-006 handlers. `[SHARED DEPENDENCY]` (credits schema/util read in place, not relocated) |
| Schema/migration touched | No |
| Limitations | No live server boot / no E2E this pass (focused unit + workspace typecheck, consistent with the prior Batch B pass). FE consumers verified by static read (no client cycle params sent; response shape unchanged for the fields they read) |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-006 (completion) | G4 — `getMyCreditSummary` (`/persons/me/credit-summary`, backing `/my/credits` + `/dashboard`) was a 5th, divergent required-credits source: read `associations.requiredCreditsPerCycle` AND accepted client `requiredCredits`/`registrationDate`/`cyclePeriodYears`/`targetDate`, letting a member pick a favorable cycle window and lower the requirement on their own member-facing summary | P1 | V1 REQUIRED | B (FIX ROUND) | Verifier MUST-FIX: Batch B claimed to collapse required-credits to one server-side source (`org_cpd_config`) but excluded this endpoint, leaving the integrity goal violated and (incorrectly) labeling it "deferred" | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `getMyCreditSummary.test.ts` (pre-existing 2 tests) | 2 pass / 0 fail | baseline | Pre-existing happy-path + unauthorized only; no integrity coverage |
| New `[FIX-006]` requiredCredits-source test | FAIL — `requiredCredits` === 45 (read `associations.requiredCreditsPerCycle`) instead of 60 (`org_cpd_config`) | FIX-006 | RED: handler read the wrong table |
| New `[FIX-006]` cycle-window test | FAIL — repo asked for window `getMonth()===2` (March, from client `registrationDate=2010-03-15`) instead of `6` (July, from `org_cpd_config` via `resolveCycle`) | FIX-006 | RED: handler honored client cycle params via `getCycleForDate` |
| New `[FIX-006]` config-fallback test | FAIL — fallback returned 45 (associations) instead of 60 (config default) | FIX-006 | RED: associations was the source even on fallback |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-006 (completion) | Rewrote `getMyCreditSummary` to resolve `requiredCredits` + cycle window SERVER-SIDE from the member's org `org_cpd_config` via the shared `resolveCycle(config, now)` authority — the SAME source/algorithm used by `getCreditCompliance`/`getCreditTranscript`. Removed the `associations.requiredCreditsPerCycle` read (the 5th, divergent source) and the `organizations`/`associations` lookup chain. Stopped honoring client `requiredCredits`/`registrationDate`/`cyclePeriodYears`/`targetDate` query params entirely (no longer read). Fallback is the existing 60/3 `org_cpd_config` column defaults — no new default literal seeded | `services/api-ts/src/handlers/person/getMyCreditSummary.ts` | `[SHARED DEPENDENCY]` — reads `org_cpd_config` schema + `resolveCycle` util from `association:member`/`member/credits` in place, NOT relocated (P1-11 split unaffected) | Response shape preserved: `cycle`, `totalEarned`, `totalCredits`, `requiredCredits`, `remaining`, `organizations` all still returned; the `cycle` window is now org-config-derived |
| (test) | Replaced the 2-test placeholder file with a table-keyed-db harness proving the source-of-truth + client-param-ignore behavior | `services/api-ts/src/handlers/person/getMyCreditSummary.test.ts` | test-only | `associations` deliberately seeded to a WRONG value (45) so a handler reading it fails RED; `org_cpd_config` carries 60 |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/person/getMyCreditSummary.test.ts` (updated) | backend/unit + permission/RBAC-integrity | (1) resolves `requiredCredits` from `org_cpd_config` (60), IGNORING `associations` (45) AND client `requiredCredits=1`; (2) IGNORES client `registrationDate`/`cyclePeriodYears`/`targetDate` — the repo aggregate is asked for the July-anchored 3-year config window, not the client's March/1-year/2099 window; (3) falls back to the platform default 60 (not associations 45, not client 999) when no config row exists | FIX-006 (completion) |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/person/getMyCreditSummary.test.ts` (RED) | Failed (3 RED for the right reasons) | Pre-implementation: associations source + client cycle params confirmed |
| `bun test src/handlers/person/getMyCreditSummary.test.ts` (GREEN) | Passed (5/5) | Post-fix |
| `bun test src/handlers/person/ src/handlers/member/credits/ src/handlers/association:member/repos/` | Passed (438/438, 53 files) | Person + credits + credits-repo regression (incl. all prior FIX-004/005/006 nets) |
| `bun run typecheck` (api) | Passed (exit 0) | `tsc --noEmit` |
| `bun run --filter '*' typecheck` | Passed (5/5: ui, admin, sdk, api, memberry) | All workspaces clean |
| `bun test` (FULL repo suite) | 6230 pass / 1 fail / 4 todo | The 1 fail is the documented pre-existing `registerEmailJobs > registers email.processor as interval job` (email module, expects 30000ms / env yields 1000ms) — NOT this pass. +3 net over the prior Batch B 6227 (the 5-test file replaced the prior 2-test file) |

## 7. Validation Summary

- **Passed:** the 3 new RED tests went GREEN after the minimal fix; person + credits + repo suites (438) pass; full repo suite 6230 pass; all five workspace typechecks pass.
- **Failed:** none attributable to this pass.
- **Pre-existing/unrelated:** the single full-suite failure is `registerEmailJobs > registers email.processor as interval job` — documented baseline failure in the email module, unchanged by this pass.
- **FE alignment:** both consumers (`apps/memberry/.../my/credits/index.tsx`, `.../dashboard.tsx`) call `/api/persons/me/credit-summary` with NO query params and read only `totalCredits`/`totalEarned`/`requiredCredits`/`remaining` — all still present. No FE change required; no FE breakage.
- **Product-decision gates — NOT hit:** FIX-006 completion resolves from `org_cpd_config` and falls back to the EXISTING 60/3 config defaults. No new default literal was seeded/invented (the 45-vs-60 gate is untouched). The `verificationStatus` pending policy is untouched (this handler aggregates via `sumCreditsByOrg`, which already carries the FIX-005 `status='active'` filter).

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Single required-credits source | `handlers/person/getMyCreditSummary.ts` now reads `org_cpd_config` + `resolveCycle` instead of `associations.requiredCreditsPerCycle` + `getCycleForDate` | `/my/credits`, `/dashboard` member-facing summaries | new 5-test file + 438-test person/credits suite | `[SHARED DEPENDENCY]` — credits schema/util consumed in place. `getMyCreditSummary` is now the 5th endpoint aligned to the FIX-006 single source; `associations.requiredCreditsPerCycle` is no longer read by the credit pipeline anywhere |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Cross-org transcript org-context (`/persons/me/credit-transcript[/pdf]`) falls back to platform 60/3 because the hand-wired routes carry no org-context middleware | FIX-006 (Batch B §9, unchanged) | Still SAFE (no longer client-controlled); endpoints have no active FE consumer | If surfaced in the FE, add org scoping so the PDF uses the member's real org `org_cpd_config` |
| `associations.requiredCreditsPerCycle` column still exists (now unread by the credit pipeline) | FIX-006 | Removing/reconciling the column is a schema/migration change beyond this fix round and outside Batch B | Reconcile/deprecate the dead `associations.requiredCreditsPerCycle` column in a Batch C migration pass (it is now a vestigial source of truth) |
| Real E2E proof of the member summary using the org-config requirement across reload | FIX-006/FIX-014 | No server boot/E2E this pass | Add to a Batch E E2E pass: change org config → `/my/credits` `requiredCredits` reflects it |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| (none new this pass) | — | The prior Batch B blocked items (pending-counting policy, 45-vs-60 default literal) were NOT forced by this fix — it reuses the existing 60/3 config defaults and the FIX-005 `status='active'` filter | — |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Reconcile/drop `associations.requiredCreditsPerCycle` column | Batch C (schema) | Now unread by the credit pipeline; column removal needs a migration — outside this fix round |
| Batch C (FIX-007/008), Batch D (FIX-009..013), paid trainings (G5), fractional credits (F4) | per fix-ready plan | Not this batch / `[NEEDS PRODUCT DECISION]` |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/person/getMyCreditSummary.ts` | Resolve `requiredCredits` + cycle from `org_cpd_config` via `resolveCycle`; drop `associations`/`organizations` reads and all client cycle/required params | FIX-006 (completion) |
| `services/api-ts/src/handlers/person/getMyCreditSummary.test.ts` | RED→GREEN source-of-truth + client-param-ignore + config-fallback tests via a table-keyed db mock | FIX-006 (completion) |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline (requiredCredits=45 from associations; cycle from client March window; fallback=45) | §3 + captured test output this pass | FIX-006 |
| GREEN: 5/5 focused, 438/438 person+credits, 6230 full-suite pass | §6 | FIX-006 |
| Five-workspace typecheck (5/5 exit 0) | §6 | FIX-006 |
| (No screenshot/Playwright/Webwright — no browser run this pass) | — | — |

## 14. Completion Decision

**COMPLETE**

The verifier MUST-FIX is resolved test-first: `getMyCreditSummary` (the member-facing `/my/credits` + `/dashboard` summary endpoint) no longer reads the divergent `associations.requiredCreditsPerCycle` source and no longer honors any client-supplied required-credits or cycle-window params. It now resolves both `requiredCredits` and the cycle window server-side from the member's org `org_cpd_config` via the shared `resolveCycle` authority — the SAME single source of truth as the rest of FIX-006. A member can no longer pick a favorable cycle window or lower the requirement to self-certify on their own summary. Proven by three RED→GREEN tests (source-of-truth, client-cycle-param-ignore, config-fallback), the full person+credits suite (438), the full repo suite (6230 pass; the lone failure is the documented pre-existing `registerEmailJobs` interval test), and all five workspace typechecks. No product-decision gate was hit (existing 60/3 defaults reused; pending policy untouched). With this, Batch B FIX-006 collapses required-credits to a single `org_cpd_config` authority across ALL five read paths (compliance, transcript, transcript PDF, my-credits, and now credit-summary).

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch C** (FIX-007 `training.type` column + FIX-008 credit-value lock) — it requires a DB migration + TypeSpec regen, isolated from Batch B by design.
- Module/group: Training & Credits
- Module slug: `training-credits`
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md`
- Recommended batch: Batch C — P1 spec alignment (migration + regen)
- Fold into Batch C (schema): reconcile/deprecate the now-vestigial `associations.requiredCreditsPerCycle` column, and add org-context scoping to the cross-org transcript endpoints if/when surfaced in the FE.

---
---

# AHA Module/Group Fix Report: Training & Credits — Batch C (FIX-007 training.type, FIX-008 credit-value lock)

> Appended section. Prior Batch A, Batch B, and Batch B FIX ROUND sections above are unchanged.

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-report.md` |
| Fix date | 2026-06-12 |
| Batch executed | Batch C — P1 spec alignment requiring DB migration + TypeSpec regen (FIX-007 `training.type` column + persist + real search filter; FIX-008 M9-R2 `creditAmount` lock after first AUTO credit) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked at start; RED watched → minimal GREEN per fix) |
| Working tree status checked | Yes (`git status --short` first; tree intentionally dirty from prior AHA passes — preserved. Touched ONLY the files needed for Batch C; no destructive git; no commit) |
| Fix scope | P1 / V1 REQUIRED inside Batch C only |
| Out of scope | Batch D; paid trainings (G5); fractional-credits numeric migration (F4 — product-decision gated, NOT touched); all `[NEEDS PRODUCT DECISION]` items; V2 DEFERRED; DO NOT ADD |
| Shared files touched | Yes — added `countAutoByTraining` to the shared `association:member/repos/credits.repo.ts`; `updateTraining` (in `association:operations`) imports `CreditEntryRepository` cross-directory. `[SHARED DEPENDENCY]` documented in §8 (same 3-dir credits coupling used by Batch A/B; fixed in place, NOT relocated) |
| Schema/migration touched | Yes — new hand-authored idempotent additive migration `0067_training_type.sql` (`training_type` enum + nullable `type` column + `idx_training_type`) + `_journal.json` entry. Applied + verified + idempotency-checked against the reachable Postgres. The F4 fractional-credits integer→numeric migration was explicitly NOT touched |
| Limitations | `drizzle-kit generate` is non-interactive-blocked in this env (snapshot baseline is 0060; migrations 0061–0066 were already hand-authored by prior AHA passes for the same reason) — so FIX-007's migration was hand-authored idempotently, matching the established 0061–0066 pattern, then APPLIED + round-trip-verified against the live DB (not just unit-mocked). No browser/E2E this pass (focused unit + repo-SQL introspection + live-DB schema proof + 5-workspace typecheck) |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-007 | G7a (M9-R1) — `training.type` accepted by API, dropped by handler, absent from DB; the advertised `?type=` search filter was a silent no-op | P1 | V1 REQUIRED | C | `type` is the CPD reporting taxonomy; type was unstorable and the search filter was unbacked | Fixed |
| FIX-008 | G7b (M9-R2) — `updateTraining` mutated `creditAmount`/`status` freely after attendance/award; credit-value drift corrupts already-issued history | P1 | V1 REQUIRED | C | Locking creditAmount post-award protects compliance integrity | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `createTraining.test.ts` + `getTraining.test.ts` + `training.test.ts` | 51 pass / 0 fail | baseline | Clean baseline before new tests |
| New FIX-007 create-persist test | FAIL — `captured.type` is `undefined` | FIX-007 | RED: `createTraining` dropped `type` (never forwarded to `repo.createOne`) |
| New FIX-007 searchTrainings filter test | FAIL — `?type` not in repo filters | FIX-007 | RED: handler only forwarded `status`, ignored `type` |
| New FIX-007 repo `buildWhereConditions` type test | FAIL — no `COL:type` predicate | FIX-007 | RED: repo had no `type` filter (and no column) |
| New FIX-008 creditAmount-lock test | FAIL — returned 200 (no lock) when 3 AUTO credits exist | FIX-008 | RED: `updateTraining` had no lock/status guard |
| New FIX-008 strip-`status` test | FAIL — `status` passed through to `updateOneById` | FIX-008 | RED: loose `{ ...body }` forwarded `status` |
| `drizzle-kit generate` | BLOCKED — non-TTY "Interactive prompts require a TTY terminal" (snapshot drift from 0060 baseline) | FIX-007 | Resolved by hand-authored idempotent migration (matches 0061–0066 pattern); applied + verified against live DB |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-007 | (1) Added `training_type` pgEnum + nullable `type` column + `idx_training_type` index to the `trainings` table schema. (2) Hand-authored idempotent migration `0067_training_type.sql` + journal entry. (3) `createTraining` now forwards `body.type` to `repo.createOne`. (4) `TrainingFilters.type` + `buildWhereConditions` type predicate added to `TrainingRepository`. (5) `searchTrainings` now forwards `?type` to the repo filters. | `repos/training.schema.ts`, `repos/training.repo.ts`, `createTraining.ts`, `searchTrainings.ts`, `generated/migrations/0067_training_type.sql` (new), `generated/migrations/meta/_journal.json` | `[SHARED DEPENDENCY]` (database/schema migration) | TypeSpec already declared `TrainingType` + `type` on Training/Create/Update/Search models — no `.tsp` edit needed; `build`+`generate` re-run confirmed no validator drift |
| FIX-008 | Added `countAutoByTraining(trainingId)` to `CreditEntryRepository` (counts `type='auto'` entries for a training). `updateTraining` now: (a) strips `status` from the loose body (status transitions belong to publish/cancel/complete, and `status` isn't in the TypeSpec update contract anyway); (b) when `creditAmount` would actually CHANGE (not a no-op same-value), checks `countAutoByTraining` and returns `409 CREDIT_AMOUNT_LOCKED` if ≥1 AUTO credit exists. | `association:member/repos/credits.repo.ts` (new method), `association:operations/updateTraining.ts` | `[SHARED DEPENDENCY]` — `updateTraining` imports `CreditEntryRepository` cross-directory (same 3-dir credits coupling as Batch A/B `award-training-credit.ts`; fixed in place, NOT relocated → P1-11 split unaffected) | Identical (no-op) creditAmount values are allowed through so a benign PATCH that re-sends the current value isn't rejected |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `association:operations/createTraining.test.ts` (updated) | backend/unit | `createTraining` forwards the validated `type` to `repo.createOne` (no longer dropped) | FIX-007 |
| `association:operations/training.test.ts` (updated) | backend/unit | `searchTrainings` forwards `?type=webinar` to BOTH the `findMany` and `count` repo filters (real filter, not a no-op) | FIX-007 |
| `association:operations/repos/training.repo.type-filter.test.ts` (new) | data/schema (SQL introspection) | `buildWhereConditions` emits a real `type` predicate when a `type` filter is given, and omits it otherwise | FIX-007 |
| `association:operations/training.test.ts` (updated) | backend/unit | `updateTraining`: rejects (409) a creditAmount change once an AUTO credit exists; allows the change when none exist; allows non-creditAmount changes (title) post-award; allows an identical no-op creditAmount; strips `status` from the loose body | FIX-008 |
| `association:member/repos/credits.repo.count-auto.test.ts` (new) | data/schema (SQL introspection) | `countAutoByTraining` filters on BOTH `training_id` AND `type='auto'`, and returns the count (0 when none) | FIX-008 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| Baseline (`createTraining`+`getTraining`+`training` tests) | Passed (51/51) | Pre-change baseline |
| New Batch C tests (first run, pre-implementation) | Failed (5 RED for the right reasons) | type dropped on create; type filter no-op (handler + repo); creditAmount unlocked; status not stripped |
| Focused Batch C (4 files, post-fix) | Passed (57/57) | All RED → GREEN; existing tests preserved |
| `bun test src/handlers/association:operations/` | Passed (435/435, 27 files) | Full training/operations module suite |
| `bun test src/handlers/association:member/repos/ src/handlers/member/credits/` | Passed (254/254, 21 files) | Credits repo + member credits regression |
| `bun run typecheck` (api) | Passed (exit 0) | `tsc --noEmit` |
| `bun run --filter '*' typecheck` | Passed (5/5: ui, admin, sdk, api, memberry) | All workspaces clean |
| `cd specs/api && bun run build` + `cd ../../services/api-ts && bun run generate` | Succeeded (exit 0) | Regen pipeline; warnings only (pre-existing); no validator drift (`TrainingType` 5-value enum still present) |
| Live DB: apply `0067_training_type.sql` + verify column/enum/index | Passed | `type` (udt `training_type`), all 5 enum labels, `idx_training_type` all present |
| Live DB: re-apply `0067_training_type.sql` | Passed (idempotent — NOTICE skips, exit 0) | Migration is safe to re-run |
| Live DB: round-trip insert `type='webinar'` + filter | Passed (1 row matches `type='webinar'`, 0 rows match `type='seminar'`) | Real persisted behavior + real filter; rolled back (no lingering data) |
| `bun test` (FULL repo suite) | 6241 pass / 1 fail / 4 todo | The 1 fail is the documented pre-existing `registerEmailJobs > registers email.processor as interval job` (email module; expects 30000ms / env yields 1000ms) — NOT this pass |

## 7. Validation Summary

- **Passed:** all 5 new RED tests went GREEN after the minimal fix; full operations module suite (435) + credits repo/member credits suites (254) pass; all 5 workspace typechecks pass; full repo suite 6241 pass. FIX-007 was additionally proven against the LIVE Postgres: the migration applies, is idempotent, and a real round-trip insert+filter confirms `type` persists and `?type` filters (not a no-op).
- **Failed:** none attributable to this pass.
- **Pre-existing/unrelated:** the single full-suite failure is `registerEmailJobs > registers email.processor as interval job` — documented baseline failure in the email module, unchanged by this pass.
- **`[NEEDS CONFIRMATION]` resolved this pass:**
  1. *Does `searchTrainings` repo error or silently ignore the `type` filter (no column)?* → **It silently ignored it** (no-op): `buildWhereConditions` had no `type` branch AND the handler never forwarded `type`. FIX-007 makes the filter real end-to-end (handler → repo → indexed DB column), proven by the live-DB round-trip.
- **Product-decision gates — NOT hit:**
  - *Fractional CPD units (F4):* deliberately untouched. `creditAmount` columns on both `training` and `credit_entry` remain `integer`; no integer→numeric migration was generated. FIX-008 locks the existing integer value; it does not change its type.
  - FIX-008 returns `409 CREDIT_AMOUNT_LOCKED` rather than guessing any money/compliance semantic beyond "the value is immutable once credits have been issued" (directly from M9-R2).

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| `trainings` schema + migration | `repos/training.schema.ts`, `generated/migrations/0067_training_type.sql`, `_journal.json` | All training reads/writes; the new column is nullable so existing rows + all other handlers are unaffected | operations suite (435) + live-DB apply/idempotency/round-trip | Additive only; hand-authored idempotent migration matching the 0061–0066 pattern (drizzle-kit non-interactive in env) |
| Credits repo (new read method) | `association:member/repos/credits.repo.ts` (`countAutoByTraining`) | `updateTraining` lock check (only new consumer) | count-auto SQL test (2) + 254-test credits suite | `[SHARED DEPENDENCY]` — credits repo in `association:member/repos`, consumed by `association:operations`; fixed in place, NOT relocated (P1-11 split unaffected) |
| `updateTraining` cross-dir import | `association:operations/updateTraining.ts` imports `CreditEntryRepository` | training update path only | training.test.ts lock cases (5) | `[CROSS-MODULE RISK]` minimal — same 3-dir coupling already established by Batch A/B `award-training-credit.ts` |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Existing pre-migration `training` rows have `type = NULL` | FIX-007 | Column added nullable (no safe backfill value — `type` is a real taxonomy choice, not inferable) | If a default is desired, run a one-time data backfill once product confirms a default delivery format; otherwise officers set `type` on next edit |
| `updateTraining` `status` is stripped but no explicit status-transition path validation added here | FIX-008 | Out of FIX-008 scope (status transitions already go through publish/cancel/complete ops); the strip is a defensive guard, not a new transition system | None required for V1 |
| Vestigial `associations.requiredCreditsPerCycle` column (flagged in Batch B §9) | FIX-006 follow-up | Schema deprecation is a separate migration beyond Batch C's named scope (type + lock) | Deprecate in a dedicated schema-cleanup pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Fractional CPD units / `creditAmount` integer→numeric migration (F4) | `[NEEDS PRODUCT DECISION]` | Explicitly out of Batch C scope and product-decision gated; not touched | Product decision on whether PRC requires 0.5 units |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-009..FIX-013 (toggle enforcement, dup-enroll guard, `/my/training` predicate, CSV export, createTraining org-strip) | Batch D | Not the selected batch |
| Paid trainings (G5) | `[NEEDS PRODUCT DECISION]` | Out of scope |
| Fractional credits numeric migration (F4) | `V2 DEFERRED` / `[NEEDS PRODUCT DECISION]` | Product-decision gated; explicitly NOT touched this pass |
| `type` backfill for existing rows | `[DO NOT OVERBUILD]` (this pass) | No inferable default; nullable column is correct for V1 |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/association:operations/repos/training.schema.ts` | Added `trainingTypeEnum` pgEnum + nullable `type` column + `idx_training_type` index | FIX-007 |
| `services/api-ts/src/handlers/association:operations/repos/training.repo.ts` | Added `TrainingFilters.type` + `type` predicate in `buildWhereConditions` | FIX-007 |
| `services/api-ts/src/handlers/association:operations/createTraining.ts` | Forward `body.type` to `repo.createOne` | FIX-007 |
| `services/api-ts/src/handlers/association:operations/searchTrainings.ts` | Forward `?type` query to repo filters | FIX-007 |
| `services/api-ts/src/generated/migrations/0067_training_type.sql` | NEW — hand-authored idempotent additive migration (enum + column + index) | FIX-007 |
| `services/api-ts/src/generated/migrations/meta/_journal.json` | Added `0067_training_type` journal entry | FIX-007 |
| `services/api-ts/src/handlers/association:member/repos/credits.repo.ts` | Added `countAutoByTraining(trainingId)` | FIX-008 |
| `services/api-ts/src/handlers/association:operations/updateTraining.ts` | Strip `status` from body; lock `creditAmount` (409) once an AUTO credit exists | FIX-008 |
| `services/api-ts/src/handlers/association:operations/createTraining.test.ts` | Added FIX-007 persist test | FIX-007 |
| `services/api-ts/src/handlers/association:operations/training.test.ts` | Added FIX-007 search-filter + FIX-008 lock/strip tests | FIX-007/008 |
| `services/api-ts/src/handlers/association:operations/repos/training.repo.type-filter.test.ts` | NEW — repo type-filter SQL test | FIX-007 |
| `services/api-ts/src/handlers/association:member/repos/credits.repo.count-auto.test.ts` | NEW — `countAutoByTraining` SQL test | FIX-008 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline (5 failing tests for the right reasons) | §3 + captured test output this pass | FIX-007/008 |
| GREEN: 57/57 focused; 435/435 operations; 254/254 credits; 6241 full-suite pass | §6 | FIX-007/008 |
| Five-workspace typecheck (5/5 exit 0) | §6 | FIX-007/008 |
| Live-DB proof: migration applies + idempotent + round-trip insert/filter for `type` | §6 (psql output captured this pass) | FIX-007 |
| (No screenshot/Playwright/Webwright — no browser run this pass) | — | — |

## 14. Completion Decision

**COMPLETE**

Both Batch C fixes (FIX-007, FIX-008) are implemented test-first (RED watched, then minimal GREEN) and prove real persisted behavior. FIX-007 added the `training.type` column via a hand-authored idempotent migration (the established in-env pattern — `drizzle-kit generate` is non-interactive-blocked and 0061–0066 were authored the same way), and it was APPLIED + verified + idempotency-checked + round-trip-proven against the live Postgres: `type` persists and the once-fake `?type` search filter is now real end-to-end (handler → repo → indexed column). FIX-008 locks `creditAmount` (returns 409) once any AUTO credit has been awarded for a training and strips `status` from the loose PATCH body, proven by handler + repo-SQL tests. No product-decision gate was hit — the F4 fractional-credits integer→numeric migration was explicitly NOT touched. The single full-suite failure is the documented pre-existing `registerEmailJobs` interval test (unrelated email module). All five workspace typechecks pass.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch D** (FIX-009 `creditTracking` toggle enforcement, FIX-010 duplicate-enrollment guard + index, FIX-011 `/my/training` earned-credit predicate, FIX-012 officer compliance CSV export, FIX-013 `createTraining` org-strip) — mostly module-local, with one small enrollment unique/partial index (Batch F note).
- Module/group: Training & Credits
- Module slug: `training-credits`
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md`
- Recommended batch: Batch D — selected P2 V1 reliability/completeness
- Optional schema-cleanup follow-up: deprecate the vestigial `associations.requiredCreditsPerCycle` column (Batch B §9) and consider a `training.type` backfill once product confirms a default delivery format.

---
---

# AHA Module/Group Fix Report: Training & Credits — Batch D (FIX-009 toggle, FIX-010 dup-enroll guard, FIX-011 /my/training predicate, FIX-012 CSV export, FIX-013 createTraining org-strip)

> Appended section. Prior Batch A, Batch B, Batch B FIX ROUND, and Batch C sections above are unchanged.

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-report.md` |
| Fix date | 2026-06-12 |
| Batch executed | Batch D — selected P2 V1 reliability/completeness (FIX-009 `creditTracking` toggle enforcement at award path; FIX-010 duplicate-enrollment guard + partial unique index; FIX-011 `/my/training` earned-credit predicate; FIX-012 client-side CSV export of officer compliance standings; FIX-013 `createTraining` org-strip) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked at start; RED watched → minimal GREEN per fix) |
| Working tree status checked | Yes (`git status --short` first; tree intentionally dirty from prior AHA passes — preserved. Touched ONLY the files needed for Batch D; no destructive git; no commit) |
| Fix scope | selected P2 / V1 RECOMMENDED inside Batch D only |
| Out of scope | Batches A/B/C (done); paid trainings (G5); fractional credits (F4); all `[NEEDS PRODUCT DECISION]` items; V2 DEFERRED; DO NOT ADD |
| Shared files touched | Yes — `award-training-credit.ts` (already a Batch A shared util) now reads `organizations.featureFlags` (platformadmin schema) + uses the env-flag `isEnabled` util for the toggle; one DB migration. `[SHARED DEPENDENCY]` documented in §8 |
| Schema/migration touched | Yes — new hand-authored idempotent additive migration `0068_training_enroll_unique_active.sql` (partial unique index on `training_enrollment (training_id, person_id)` WHERE `status <> 'cancelled'`) + `_journal.json` entry. Matches the established 0061–0067 hand-authored pattern (drizzle-kit generate is non-interactive-blocked in this env) |
| Limitations | `drizzle-kit generate` is non-interactive-blocked in this env (TTY/columns-conflict prompt; snapshot baseline is 0060, 0061–0067 were already hand-authored by prior passes) — so FIX-010's migration was hand-authored idempotently and locked by a schema/text test. The DB was NOT booted to apply 0068 this pass (no live psql round-trip like Batch C), but the handler-level guard is the primary enforcement and is fully unit-proven; the index is the race backstop. No browser/E2E this pass (focused unit + component + schema-text proof + 5-workspace typecheck) |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-009 | G9 (M9-R8) — `creditTracking` toggle unenforced at the award path; util exists+tested but never consulted before a credit insert | P2 | V1 RECOMMENDED | D | AC explicitly requires the hosting-org toggle to suppress credit | Fixed |
| FIX-010 | G10 — duplicate enrollment possible: no unique constraint / no pre-check on (trainingId, personId); distorts capacity, makes `enrollments[0]` arbitrary | P2 | V1 RECOMMENDED | D | Capacity integrity + deterministic enrollee selection at check-in | Fixed |
| FIX-011 | G11 — `/my/training` counted `status === 'enrolled'` as EARNED credits and as "Completed", overstating member CPE | P2 | V1 RECOMMENDED | D | Member dashboard must not overstate earned credits | Fixed |
| FIX-012 | 10.7 — no CSV export on the officer compliance report; officers need an exportable regulator-facing file | P2 | V1 RECOMMENDED | D | Client-side CSV from already-loaded standings is sufficient | Fixed |
| FIX-013 | F6 — `createTraining` accepted `body.organizationId || orgId`, allowing org-context override (org-isolation breach) | P2 | V1 RECOMMENDED | D | Org isolation: cannot create training under a foreign org | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `createTraining.test.ts` + `training-enrollment.test.ts` + `check-in.test.ts` | 66 pass / 0 fail | baseline | Clean baseline before new tests |
| New FIX-013 ctx-org bind test | FAIL — `captured.organizationId === 'org-foreign'` (body won) | FIX-013 | RED: `body.organizationId || orgId` passed the foreign org through |
| New FIX-009 toggle-disabled test | FAIL — `creditAwarded === 10` despite org toggle = false | FIX-009 | RED: award path never consulted the toggle |
| New FIX-010 second-enroll test | FAIL — promise RESOLVED (no rejection) on a duplicate active enrollment | FIX-010 | RED: no pre-check existed |
| New FIX-011 stats helper test | FAIL — `Export named 'computeTrainingStats' not found` | FIX-011 | RED: predicate was inline + counted `enrolled` as earned |
| New FIX-012 CSV builder test | FAIL — `Export named 'buildComplianceCsv' not found` | FIX-012 | RED: no export feature existed |
| `drizzle-kit generate` (FIX-010 index) | BLOCKED — non-TTY "Interactive prompts require a TTY terminal" (columns-conflict prompt, snapshot drift from 0060) | FIX-010 | Resolved by hand-authored idempotent migration (matches 0061–0067 pattern) |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-013 | `createTraining` now binds the persisted training to the caller's resolved `orgId` (ctx) only — removed the `body.organizationId || orgId` fallback that trusted the body. | `association:operations/createTraining.ts` | No (module-local handler) | Org-isolation guard; body org is now ignored entirely |
| FIX-009 | Enforced the hosting-org `creditTracking` toggle inside the shared `awardTrainingCredit` routine (so BOTH the completion path and the officer check-in path honor it). It reads `organizations.featureFlags` for the training's org and, if `creditTracking` is explicitly present and disabled, suppresses the AUTO credit (logs at debug) and returns `creditAwarded: 0`. Default is ON — absent flag / no org row → award proceeds. | `association:operations/utils/award-training-credit.ts` (reads `organizations` schema + uses `isEnabled`) | `[SHARED DEPENDENCY]` — reads platformadmin `organizations.featureFlags` (read-only); writes nothing new | Manual self-report credits (`awardManualCredit`) are NOT affected — the toggle is scoped to the AUTO training-award path per M9-R8 |
| FIX-010 | (a) Pre-check in `enrollInCustomTraining`: reject (`409 ALREADY_ENROLLED`) when the member already holds a non-cancelled enrollment for the training; a previously cancelled enrollment does not block re-enrollment. (b) DB backstop: hand-authored idempotent migration `0068` adds a partial unique index on `(training_id, person_id)` WHERE `status <> 'cancelled'`, plus the matching `uniqueIndex(...).where(...)` in the Drizzle schema. | `association:operations/enrollInCustomTraining.ts`, `repos/training.schema.ts`, `generated/migrations/0068_training_enroll_unique_active.sql` (new), `generated/migrations/meta/_journal.json` | `[SHARED DEPENDENCY]` (database/schema migration) | Partial index allows re-enrollment after cancel while blocking duplicate live rows under a race |
| FIX-011 | Extracted the stat computation into a pure exported `computeTrainingStats(items)` helper and corrected the earned-credit predicate from `status === 'enrolled'` to `status === 'completed'`. Both "CPE Credits" and "Completed" now reflect completed enrollments; "Enrolled" still reflects active enrolled rows. | `apps/memberry/.../my/training.tsx` | No (module-local frontend) | Removed the duplicated inline predicate; component now consumes the tested helper |
| FIX-012 | Added a pure exported `buildComplianceCsv(rows)` helper (RFC-4180-style quoting for commas/quotes/newlines, header + one line per member incl. the General/Major/Self-Directed breakdown + verdict) and a thin `downloadCsv` Blob-download wrapper, wired to an "Export CSV" button in the report's `PageShell` actions slot (disabled when no rows; exports the currently-filtered standings). | `apps/memberry/.../officer/reports/credits.tsx` | No (module-local frontend) | Client-side only — operates on the standings already loaded; no extra request |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `association:operations/createTraining.test.ts` (updated) | backend/unit + permission/RBAC | `createTraining` persists the ctx `organizationId` and IGNORES a foreign `body.organizationId`; still binds to ctx when body org is absent | FIX-013 |
| `association:operations/training-enrollment.test.ts` (updated) | backend/unit | Toggle DISABLED → completion records but `creditAwarded === 0` and no credit insert; toggle TRUE / ABSENT → credit awarded as normal | FIX-009 |
| `association:operations/check-in.test.ts` (updated) | backend/unit + regression | The officer-attendance seam (the core CPD journey) also suppresses the credit when the org toggle is disabled | FIX-009 |
| `association:operations/training-enrollment.test.ts` (updated) | backend/unit | Second active enrollment for same (trainingId, personId) is rejected; a cancelled prior enrollment allows re-enroll; first-ever enrollment succeeds | FIX-010 |
| `association:operations/repos/training-enroll-index.schema.test.ts` (new) | data/schema | Migration 0068 creates a UNIQUE index on `(training_id, person_id)`, is PARTIAL (`WHERE status <> 'cancelled'`), and is idempotent (`IF NOT EXISTS`) | FIX-010 |
| `apps/memberry/.../my/training.test.ts` (new) | frontend/component | `computeTrainingStats` counts only `completed` enrollments toward CPE + "Completed"; enrolled-only members earn 0; cancelled/noShow earn 0 | FIX-011 |
| `apps/memberry/.../officer/reports/credits.test.ts` (new) | frontend/component | `buildComplianceCsv` emits header + one row per member with name/id/earned/required/remaining/verdict + category breakdown; escapes commas; tolerates missing fields | FIX-012 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| Baseline (`createTraining`+`training-enrollment`+`check-in`) | Passed (66/66) | Pre-change baseline |
| New Batch D tests (first run, pre-implementation) | Failed (5 distinct RED for the right reasons) | FIX-013 body-org won; FIX-009 toggle ignored; FIX-010 dup allowed; FIX-011/012 helpers missing |
| `bun test createTraining.test.ts` (FIX-013 GREEN) | Passed (12/12) | — |
| `bun test training-enrollment.test.ts + check-in.test.ts` (FIX-009/010 GREEN + regression) | Passed (59/59) | — |
| `bun test training-enroll-index.schema.test.ts` (FIX-010 migration) | Passed (3/3) | partial-unique-index characterization |
| `bun test .../my/training.test.ts` (FIX-011) | Passed (5/5) | earned-credit predicate |
| `bun test .../officer/reports/credits.test.ts` (FIX-012) | Passed (5/5) | CSV builder |
| Focused Batch D backend (4 files) | Passed (78/78) | all backend nets green together |
| `bun test src/handlers/association:operations/` | Passed (447/447, 28 files) | full training/operations module suite |
| `bun test src/handlers/member/credits/ + association:member/repos/ + jobs/` | Passed (286/286, 27 files) | credits + jobs regression (toggle org-read did not regress) |
| `bun run typecheck` (api) | Passed (exit 0) | `tsc --noEmit` |
| `bun run --filter '*' typecheck` | Passed (5/5: ui, admin, sdk, api, memberry) | all workspaces clean |
| `apps/memberry` `bun run test` (full isolated frontend suite) | Passed (658/658, 0 fail) | both new component test files included; no FE regression |
| `bun test` (FULL api-ts repo suite) | 6253 pass / 1 fail / 4 todo | The 1 fail is the documented pre-existing `registerEmailJobs > registers email.processor as interval job` (email module; expects 30000ms / env yields 1000ms) — NOT this pass |

## 7. Validation Summary

- **Passed:** every new RED test went GREEN after the minimal fix; full operations module suite (447), credits+jobs suites (286), full memberry frontend suite (658), full api-ts repo suite (6253), and all five workspace typechecks pass. Each fix proves real behavior: FIX-013 persists the ctx org not the body org; FIX-009 suppresses the actual credit insert (createOne call count = 0) when the toggle is off; FIX-010 rejects the duplicate enrollment AND adds the DB partial-unique backstop (locked by a schema-text test); FIX-011 changes the earned-credit predicate (`enrolled`→`completed`) and reflects it in both stats; FIX-012 builds correct CSV text from standings.
- **Failed:** none attributable to this pass.
- **Pre-existing/unrelated:** the single full-suite failure is `registerEmailJobs > registers email.processor as interval job` — documented baseline failure in the email module, unchanged by this pass.
- **`[NEEDS CONFIRMATION]` resolved this pass:**
  1. *Whether the validator already strips `body.organizationId` (FIX-013 reachability)?* → **NOT stripped** — `TrainingCreateRequestSchema` accepts `organizationId`, and the handler's `body.organizationId || orgId` actively used it (proven by the RED test where `org-foreign` won). The override was reachable; FIX-013 closes it.
  2. *Which toggle mechanism backs `creditTracking` (env `FF_*` vs DB)?* → The hosting-org toggle lives in `organizations.featureFlags` (a per-org `Record<string, boolean>` jsonb). FIX-009 reads that and reuses the tested `isEnabled(flags, 'creditTracking')` util (the same util exercised at `credits.test.ts:836-852`).
- **Product-decision gates — NOT hit:**
  - FIX-009 default is ON (toggle only ever SUPPRESSES when explicitly disabled), so no new money/compliance default was invented.
  - FIX-010 partial index excludes cancelled rows — a deliberate, conservative rule (one active enrollment per training) that does not change any pending/verification policy.
  - No fractional-credits or paid-training semantics were touched.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Credit-award toggle read | `association:operations/utils/award-training-credit.ts` reads `organizations.featureFlags` (platformadmin schema) + `isEnabled` (`core/feature-flags`) | Both AUTO-credit writers (completeTrainingEnrollment + checkInCustomTraining) | operations suite (447) + 2 toggle test blocks | `[SHARED DEPENDENCY]` — read-only platformadmin flag; default ON. Credits repo unchanged this pass; P1-11 split unaffected |
| `training_enrollment` schema + migration | `repos/training.schema.ts` (partial uniqueIndex), `generated/migrations/0068_*.sql`, `_journal.json` | All enrollment writes; existing rows unaffected (additive index; cancelled rows excluded) | enroll-index schema test (3) + enrollment guard tests (3) + 447 operations suite | Additive idempotent migration matching the 0061–0067 hand-authored pattern. NOT applied to a live DB this pass (handler guard is primary; index is race backstop) |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Migration 0068 not applied/round-trip-verified against a live Postgres this pass | FIX-010 | DB was not booted this pass (focused unit + schema-text proof). The handler pre-check is the primary enforcement and is fully unit-proven | Apply 0068 on next server boot (auto-applied by the migrator) and confirm the partial unique index exists; if any existing data has duplicate active enrollments, de-dup before the index creation succeeds |
| `createTraining` validator still accepts `organizationId` in the request body (now ignored by the handler) | FIX-013 | Removing it from the TypeSpec contract is a spec/regen change beyond Batch D's handler-scope fix | Optionally drop `organizationId` from `TrainingCreateRequest` in a TypeSpec-regen pass so the API surface no longer advertises an ignored field |
| Dead enrollment status variants in `/my/training` (`pending_approval`/`pending_payment`/`waitlisted`) not in the backend enum | FIX-011 (adjacent) | Out of FIX-011's named predicate scope; the `pending` stat is harmless (always 0 with the real enum) | Clean up the dead variants when enrollment modes (V2 DEFERRED) are decided |
| Real E2E proof (officer voids/toggles → member reload; CSV download triggers a file) | FIX-009/012/014 | No browser boot this pass | Add to a Batch E E2E pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| (none new this pass) | — | No Batch D fix required a product decision; FIX-009 default-ON and FIX-010 active-only rules avoid forcing any money/compliance/verification policy | — |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Paid trainings (G5), fractional credits (F4) | `[NEEDS PRODUCT DECISION]` / V2 DEFERRED | Out of scope |
| Enrollment modes / waitlist / network approval / LMS expansion | `V2 DEFERRED` / `DO NOT ADD` `[DO NOT OVERBUILD]` | Outside scope |
| Drop `organizationId` from the create-training TypeSpec request | `[DO NOT OVERBUILD]` (this pass) | Handler now ignores it; spec cleanup is a follow-up, not required for the security fix |
| FIX-014 standalone regression-net batch | Batch E | Woven into Batches A–D; the Batch D nets (toggle on both paths, dup-guard, predicate, CSV) are in place. The remaining cross-path E2E proof is the Batch E item |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/association:operations/createTraining.ts` | Bind to ctx `orgId`; drop `body.organizationId` fallback | FIX-013 |
| `services/api-ts/src/handlers/association:operations/utils/award-training-credit.ts` | Read `organizations.featureFlags`; suppress AUTO credit when `creditTracking` explicitly disabled (default ON) | FIX-009 |
| `services/api-ts/src/handlers/association:operations/enrollInCustomTraining.ts` | Pre-check: reject duplicate active enrollment (`409 ALREADY_ENROLLED`) | FIX-010 |
| `services/api-ts/src/handlers/association:operations/repos/training.schema.ts` | Added partial `uniqueIndex('uq_training_enroll_active')` on `(trainingId, personId)` WHERE status <> 'cancelled' | FIX-010 |
| `services/api-ts/src/generated/migrations/0068_training_enroll_unique_active.sql` | NEW — hand-authored idempotent partial-unique-index migration | FIX-010 |
| `services/api-ts/src/generated/migrations/meta/_journal.json` | Added `0068_training_enroll_unique_active` journal entry | FIX-010 |
| `apps/memberry/src/routes/_authenticated/my/training.tsx` | Extract `computeTrainingStats`; fix earned-credit predicate `enrolled`→`completed` | FIX-011 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` | Add `buildComplianceCsv` + `downloadCsv` + "Export CSV" button (PageShell actions) | FIX-012 |
| `services/api-ts/src/handlers/association:operations/createTraining.test.ts` | Added FIX-013 ctx-org bind tests | FIX-013 |
| `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts` | Added FIX-009 toggle + FIX-010 dup-enroll tests | FIX-009/010 |
| `services/api-ts/src/handlers/association:operations/check-in.test.ts` | Added FIX-009 check-in toggle test | FIX-009 |
| `services/api-ts/src/handlers/association:operations/repos/training-enroll-index.schema.test.ts` | NEW — migration 0068 partial-unique-index schema test | FIX-010 |
| `apps/memberry/src/routes/_authenticated/my/training.test.ts` | NEW — `computeTrainingStats` predicate tests | FIX-011 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.test.ts` | NEW — `buildComplianceCsv` tests | FIX-012 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baselines (body org won; toggle ignored; dup allowed; helpers missing) | §3 + captured test output this pass | FIX-009/010/011/012/013 |
| GREEN: 78/78 focused backend; 447 operations; 286 credits+jobs; 658 memberry FE; 6253 full api-ts suite | §6 | All |
| Five-workspace typecheck (5/5 exit 0) | §6 | All |
| Migration 0068 partial-unique-index text proof | `training-enroll-index.schema.test.ts` + `0068_training_enroll_unique_active.sql` | FIX-010 |
| (No screenshot/Playwright/Webwright — no browser run this pass) | — | — |

## 14. Completion Decision

**COMPLETE**

All five Batch D fixes (FIX-009, FIX-010, FIX-011, FIX-012, FIX-013) are implemented test-first (RED watched, then minimal GREEN) and prove real behavior: FIX-013 persists the ctx org and ignores a foreign body org (org-isolation); FIX-009 suppresses the actual AUTO credit insert on both award paths (completion + officer check-in) when the hosting org has `creditTracking` disabled, default ON; FIX-010 rejects duplicate active enrollments at the handler AND adds a partial unique index as the race backstop (hand-authored idempotent migration 0068, locked by a schema-text test); FIX-011 corrects the `/my/training` earned-credit predicate from `enrolled` to `completed` via a tested pure helper; FIX-012 adds a tested client-side CSV export of the officer compliance standings. The full operations suite (447), credits+jobs suites (286), full memberry frontend suite (658), and full api-ts repo suite (6253 pass; the lone failure is the documented pre-existing `registerEmailJobs` interval test) all pass, with all five workspace typechecks clean. No product-decision gate was hit. The only honest caveat (§9): migration 0068 was not applied to a live DB this pass — the handler-level dup guard is the primary, fully-proven enforcement and the index is the additional race backstop, queued to auto-apply on next server boot.

## 15. Recommended Next Step

Batch D (the final fix batch in the fix-ready plan's active scope) is complete. Recommended next:
- Run a **Batch E / E2E pass** (`04-module-or-group-fix-tdd.md`, FIX-014) for browser-level proof of the core journeys: officer checks in member → member `/my/credits` shows the AUTO credit across reload; officer voids → totals drop; org toggle off → no credit; officer "Export CSV" produces a file. Also confirm migration 0068 applied on a live boot.
  - Module/group: Training & Credits
  - Module slug: `training-credits`
  - Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
  - Input fix-ready plan: `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md`
- Optional spec cleanups (non-blocking): drop the now-ignored `organizationId` from `TrainingCreateRequest` (TypeSpec regen); deprecate the vestigial `associations.requiredCreditsPerCycle` column (Batch B §9); clean up the dead `/my/training` enrollment status variants.
- With Batches A–D done, the module's P0/P1 + selected-P2 active scope is fully addressed; consider running `05-cross-cutting-pattern-audit.md` once 2–3 modules are remediated.

---
---

# AHA Module/Group Fix Report: Training & Credits — FIX-004-COMPLETION (close the 5th cycle-authority write path)

> Appended section. Prior Batch A, Batch B, Batch B FIX ROUND, Batch C, and Batch D sections above are unchanged (their FIX-004 "all four paths" claims are corrected inline with ⚠️ markers pointing here). Surfaced by the 2026-06-12 recovery-stabilization pass (CONTINUE-23) §4.1 and re-queued via CONTINUE-24.

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` (FIX-004 row) |
| Source of the gap | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/recovery-stabilization-2026-06-12-report.md` §4.1 + §7 re-queue row |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-report.md` (this file) |
| Fix date | 2026-06-12 |
| Batch executed | FIX-004 completion — the FIFTH credit-write path missed by the original Batch B FIX-004 pass |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked at start; RED watched → minimal GREEN. `superpowers:verification-before-completion` discipline applied to the validation evidence below) |
| Working tree status checked | Yes (`git status --short`; tree intentionally dirty ~`recovery-2025-incident` — preserved. Touched ONLY the two files needed; no destructive git; no commit) |
| Fix scope | P1 / V1 REQUIRED — completion of FIX-004 (G2) single cycle authority |
| Out of scope | The 4 already-correct write paths (untouched); the transcript/compliance reads (FIX-006, correct); the void filters (FIX-005, correct); Batch C/D; all `[NEEDS PRODUCT DECISION]` items; `[DO NOT OVERBUILD]` |
| Shared files touched | No new shared files — `CreditService.createEntry` now reads the SAME `org_cpd_config` schema + `resolveCycle` util used by the other four write paths, in place (P1-11 split unaffected) |
| Schema/migration touched | No |
| Limitations | No live server boot / no E2E this pass (focused unit + workspace typecheck, consistent with the prior Training & Credits passes). The body validator already strips `registrationDate`/`cyclePeriodYears`, so this is a stored-correctness fix, not an attacker-controlled exploit |

## 2. Fix Selected

| Fix ID | Gap | Severity | Scope Label | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-004 (completion) | G2 — `CreditService.createEntry` (`handlers/member/credits/services/credit.service.ts`), reached by the member self-service route `POST /persons/me/credit-entries` → `createMyCreditEntry`, was the FIFTH credit-write path. It used the legacy `getCycleForDate(registrationDate ?? activityDate, activityDate, cyclePeriodYears ?? 2)` — a hardcoded 2-year window anchored at the activity date that **ignored `org_cpd_config` entirely** — stamping a WRONG `cycle_start/cycle_end` on member-self-logged credit rows. `membership.repo.ts:145` (`cycleStart <= NOW() AND cycleEnd >= NOW()`) trusts those stored columns → real compliance-number drift for the member credit sum. | P1 | V1 REQUIRED | The original FIX-004 (Batch B) claimed "single cycle authority / all four write paths"; this 5th path made that invariant false in practice. Closing it makes "one cycle authority" actually true across all five writers. | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| New self-service case in `credit-cycle-consistency.test.ts` driving `CreditService.createEntry` with an org `org_cpd_config` of Jan-anchored / 3-year and `activityDate=2024-09-15` | FAIL — persisted `cycleStart` = `1726358400000` (2024-09-15, the legacy 2-year activityDate window) instead of the config-driven `1672531200000` (2023-01-01 from `resolveCycle`) | FIX-004 (completion) | RED for the right reason: legacy `getCycleForDate(activityDate, activityDate, 2)` ignored config and anchored on the activity date. The other 3 consistency cases (training/manual/job) still passed |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-004 (completion) | `CreditService.createEntry` now derives the cycle window SERVER-SIDE from the member's org `org_cpd_config` (`cycleStartMonth` + `cycleLengthYears`) anchored at `input.activityDate` via the shared `resolveCycle(config, activityDate)` authority — exactly like `award-training-credit.ts` / `awardManualCredit.ts`. Replaced the legacy `getCycleForDate(registrationDate ?? activityDate, activityDate, cyclePeriodYears ?? 2)`. The service constructor now retains `db` (it previously only kept the repo) to issue the `org_cpd_config` select. Falls back to the existing 60/3 `org_cpd_config` column defaults when no config row exists. | `services/api-ts/src/handlers/member/credits/services/credit.service.ts` | `[SHARED DEPENDENCY]` — reads `orgCpdConfig` schema + `resolveCycle` util in place, NOT relocated | `[DO NOT OVERBUILD]`: the now-dead `registrationDate` / `cyclePeriodYears` interface fields were KEPT (marked `@deprecated`/ignored) rather than removed — removing them would force editing the one caller (`createMyCreditEntry.ts:92-93`, which already passes `undefined` post-validator). No handler change; smallest correct diff |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/credits/credit-cycle-consistency.test.ts` (updated) | backend/unit + regression | Added a FOURTH case: the member self-service path (`CreditService.createEntry`) stamps the SAME config-driven `[cycleStart, cycleEnd)` window as the training/manual/job paths for the same anchor date + `org_cpd_config` — not the legacy 2-year activityDate window. Header + "paths under test" list updated 3→4 (and now documents the 5th writer's prior legacy behavior) | FIX-004 (completion) |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/member/credits/credit-cycle-consistency.test.ts` (RED) | Failed (1 RED for the right reason; 3 pre-existing pass) | Pre-implementation: self-service path stamped 2024-09-15 (legacy) not 2023-01-01 (config) |
| `bun test src/handlers/member/credits/credit-cycle-consistency.test.ts` (GREEN) | Passed (4/4) | Post-fix; the new case + the 3 existing cases all agree on the window |
| `bun test src/handlers/member/credits/ src/handlers/person/createMyCreditEntry.test.ts` | Passed (201/201, 16 files) | Full member-credits suite + the self-service handler test — no regression; no existing assertion weakened |
| `bun run --filter '*' typecheck` | Passed (5/5: ui, admin, sdk, api, memberry) | All workspaces exit 0 — typecheck held 5/5 |

## 7. Validation Summary

- **Passed:** the new RED case went GREEN after the minimal service change; full member-credits suite + the `createMyCreditEntry` handler test (201) pass; all five workspace typechecks pass (5/5 exit 0).
- **Failed:** none attributable to this pass.
- **Not run:** whole-repo suite (out of scope per the CONTINUE-24 prompt — focused validation only); live server boot / E2E (no browser run this pass — consistent with prior Training & Credits passes; the P0 attendance→credit E2E proof is the queued CONTINUE-22 / FIX-014 item).
- **No assertion weakened:** the existing 3 consistency cases and all `createMyCreditEntry`/credits tests were left intact; the fix only added a case and corrected the service.
- **Product-decision gates — NOT hit:** reuses the existing 60/3 `org_cpd_config` defaults (no new default literal); does not touch the `verificationStatus` pending policy or the FIX-005 `status='active'` filters.
- **Invariant now true:** "single cycle authority" holds across ALL FIVE credit-write paths — `award-training-credit`, `awardManualCredit`, `adjustCreditEntry`, `creditIssue`, and now `CreditService.createEntry`. The overstated Batch B FIX-004 "all four paths" claim is corrected inline (⚠️ markers at Batch B §2 / §4 / §8) to point here.

## 8. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/credits/services/credit.service.ts` | `createEntry` resolves the cycle from `org_cpd_config` via `resolveCycle(config, activityDate)` instead of legacy `getCycleForDate(..., cyclePeriodYears ?? 2)`; constructor retains `db`; `registrationDate`/`cyclePeriodYears` interface fields marked `@deprecated`/ignored (kept to avoid touching the sole caller) | FIX-004 (completion) |
| `services/api-ts/src/handlers/member/credits/credit-cycle-consistency.test.ts` | Added the 4th cross-path consistency case (member self-service `CreditService.createEntry`); updated header/paths-under-test (3→4, documents the 5th writer) | FIX-004 (completion) |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Dead `registrationDate` / `cyclePeriodYears` fields on `CreateCreditEntryInput` (now `@deprecated`, ignored) | FIX-004 (completion) | Removing them forces editing the sole caller (`createMyCreditEntry.ts:92-93`) — `[DO NOT OVERBUILD]` per the prompt: left unused + noted | Optional cleanup: drop the two fields from the interface AND the two pass-through lines in `createMyCreditEntry.ts` in a later tidy pass (purely cosmetic; both already arrive `undefined`) |
| Real E2E proof of member self-logged credit landing in the org-config window across reload | FIX-004 / FIX-014 | No server boot/E2E this pass | Fold into the queued CONTINUE-22 Batch E E2E pass (member logs CPD → `/my/credits` shows it in the correct cycle window) |

## 10. Completion Decision

**COMPLETE**

The fifth credit-write path is closed test-first: `CreditService.createEntry` (the member self-service `POST /persons/me/credit-entries` writer) now derives `cycle_start/cycle_end` from the member's org `org_cpd_config` via the shared `resolveCycle` authority — the SAME source/algorithm as the other four writers — instead of the legacy hardcoded 2-year activityDate window that ignored config. Proven by a failing-first 4th case in the cross-path consistency net (RED: 2024-09-15 legacy window → GREEN: 2023-01-01 config window), the full member-credits + self-service-handler suite (201 pass), and all five workspace typechecks (5/5). The "single cycle authority" invariant is now actually true across all five paths; the overstated Batch B "all four paths" claim is corrected inline. No product-decision gate was hit. Per the CONTINUE-24 stop condition: STOP — no further batch or module started.

## 11. Recommended Next Step

Per CONTINUE-24 "After this pass":
- **CONTINUE-22** — Training Batch E / FIX-014: real E2E proof of the P0 attendance→credit journey + cross-org RBAC (needs live stack: API 7213 + memberry 3004, Playwright pinned 1.58.2).
- Orphan-handler cleanup (`deleteMembership.ts` / `deleteMembershipApplication.ts`) + FIX-010 real-PG rollback integration test (small, batchable).
- 0068 dup-enroll deploy preflight (de-dup active duplicate enrollments before applying the partial unique index).
- Then Track B product decisions, then Track C roadmap consolidation.

---
---

# AHA Module/Group Fix Report: Training & Credits — Batch E subset (FIX-014: real E2E proof of the P0 attendance→credit journey + cross-org RBAC)

> Appended section. Prior Batch A, Batch B, Batch B FIX ROUND, Batch C, Batch D, and FIX-004-completion sections above are unchanged. This is the test-only (`04`) Batch E subset from CONTINUE-22 (run 2026-06-12).

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Fix date | 2026-06-12 |
| Batch executed | Batch E subset (decision-free) — FIX-014: real browser proof of the P0 attendance→credit journey (Part 1) + cross-org compliance RBAC (Part 2) |
| Superpowers used | Yes (`superpowers:test-driven-development` — the E2E is the failing-first/real-journey artifact; `superpowers:verification-before-completion` on the evidence) |
| Working tree status checked | Yes (intentionally dirty ~recovery; preserved. Touched ONLY the two E2E specs + this report; no source/handler/schema/TypeSpec/`generated/**` changes — FIX-014 is test-only) |
| Fix scope | P1 / V1 REQUIRED — FIX-014 test hardening only |
| Out of scope | Any source fix (incl. the P0 finding below), Batch B/C/D (done), `completeCustomTraining` award fix, all `[NEEDS PRODUCT DECISION]` items. No DB migration / schema / regen |
| Live stack used | Yes — Docker infra up; **API booted on 7213 (re-migrated)** + memberry on 3004 via Playwright `webServer`; Playwright pinned `1.58.2` (not bumped). Member enrollment/credit state verified directly against the live Postgres |

## 2. Parts Selected

| Part | What | Status |
| --- | --- | --- |
| Part 1 — real E2E proof (PRIMARY) | Drive the ACTUAL officer attendance UI → mark a member present → assert that member earns a persisted AUTO `CreditEntry` (correct member/type/amount), survives reload; negative control proves it is not fake-green | **Done — and it SURFACED A P0 BUG** (see §4). Delivered as: a passing real-roster-hydration test + a quarantined (`test.fail()`) real-journey test that is RED for the right reason |
| Part 2 — cross-org compliance RBAC (decision-free) | Officer of org A denied (403) reading org B compliance — resolve the fix-ready §8 `[NEEDS CONFIRMATION]` with a running test | **Already COVERED** — Batch B landed it: `services/api-ts/src/handlers/member/credits/required-credits-source.test.ts:118` `describe('[FIX-014] getCreditCompliance RBAC — officer of one org cannot read another org')` → `expect(res.status).toBe(403)`. Confirmed present + passing; no new test needed |

## 3. Environment Reality (verified at start)

- Docker infra (postgres/minio/mailpit/stripe-mock) up. **A second, LOCAL Postgres also binds loopback `:5432`** (Homebrew, pid 468) and shadows Docker's `*:5432` for `localhost` connections — the API connects to the LOCAL pg (129 tables, migrated + seeded). The empty Docker pg was a red herring. Documented so future passes query the right DB (`psql -h 127.0.0.1 -U postgres -d monobase`).
- A stale 13h API on 7213 (connected to a since-wiped DB) was killed + rebooted to re-migrate.
- Seed state confirmed against the live DB: member@memberry.ph ("Miguel Bautista", personId `e209571f…`) is ENROLLED (not completed, zero AUTO credits) in the credit-bearing published "Dental Photography Seminar" (credit 8) and "Infection Control & Sterilization Update" (credit 6); the officer test@memberry.ph is also enrolled in the seminar; org `featureFlags` empty → `creditTracking` defaults ON.

## 4. ⚠️ P0 FINDING — the P0 attendance→credit journey is STILL broken through the real UI (NOT fixed — test-only pass)

The real E2E exposed that **Batch A FIX-001 fixed the wrong (unreachable) code path**, so the core platform value is still broken in the product:

| Aspect | Detail |
| --- | --- |
| What Batch A fixed | `checkInCustomTraining` (awards an AUTO credit to a named `personId`) in `apps/memberry/.../officer/training/$trainingId/attendance.tsx` |
| Why that is unreachable | `attendance.tsx` is a CHILD route of `$trainingId.tsx`, but `$trainingId.tsx` renders **no `<Outlet/>`** — navigating `.../$trainingId/attendance` shows the detail page, never the child. The `checkInCustomTraining` wiring is dead UI. |
| What the real UI actually uses | The detail page's **"Attendance" tab → `<CompletionTable>`** (`apps/memberry/src/features/training/components/completion-table.tsx`). Its "Mark Complete" button calls **`completeCustomTraining`** with `{ personId, creditAmount }`. |
| The bug in `completeCustomTraining` (`services/api-ts/src/handlers/association:operations/completeCustomTraining.ts`) | (a) It **ignores `body.personId`** and looks up `findMany({ trainingId, personId: user.id })` — the OFFICER's own enrollment, not the member's. (b) It **awards NO credit** (no `awardTrainingCredit` call). So clicking "Mark Complete" on a member's row completes the officer's own enrollment (or 400s `ALREADY_COMPLETED`/`NOT_ENROLLED`) and the member earns nothing. |
| Browser-verified failure | Quarantined real-journey test fails at: `Error: member must earn a persisted AUTO credit from the real check-in — expect(received).toBeTruthy() — Received: undefined` (member's `/persons/me/credit-entries` has no AUTO entry for the seminar after the officer "marked them present"). A `400 Bad Request` is logged for the `completeCustomTraining` POST. |
| Severity | **P0** — the headline platform value (officer attendance → member CPD credit) does not work through any reachable UI path. |
| Recommended follow-up FIX (out of this test-only subset) | Make `completeCustomTraining` honour `body.personId` (target that enrollee, officer-gated) and award the AUTO credit via the shared `awardTrainingCredit` routine — OR point `<CompletionTable>` at the already-correct `checkInCustomTraining`. Then un-quarantine the test below (remove `test.fail()`). Schedule as a dedicated Training fix pass (NOT Batch B/C/D). |

This is exactly the failure the fake-green specs hid and that FIX-014's real E2E was meant to catch. Per the decision-free test-only subset (and CONTINUE-22's "if the test reveals a real bug, document it as a finding + recommended fix; do NOT silently add the fix"), the handler was **left unchanged**.

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Status |
| --- | --- | --- | --- |
| `apps/memberry/tests/e2e/officer/training-completion.spec.ts` (rewritten) | E2E real-flow | **Test 1 (passing):** the real officer Attendance tab (`CompletionTable`) hydrates the REAL enrolled-member roster from the backend (member row keyed by personId prefix + "Enrolled" status). **Test 2 (`test.fail()`, RED-for-right-reason):** the real journey — officer "Mark Complete" on the member's row → that member must earn a persisted AUTO credit (correct amount) on `/my/credits`, surviving reload. Currently RED because of the §4 P0 bug; quarantined so CI stays green and it auto-alerts (starts "unexpectedly passing") when the handler is fixed. | Test 1 PASS; Test 2 expected-failure (documents P0) |
| `apps/memberry/tests/e2e/member/training-completion-flow.spec.ts` (strengthened) | E2E real-flow | Upgraded from render/heading-only to a REAL persisted-data assertion: `/my/credits` hydrates from `GET /persons/me/credit-entries` and renders the member's actual seeded credit rows (a specific entry's activity + amount), proving the table is data-driven, not a static shell. | PASS (2/2) |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun run test:e2e --project=chromium officer/training-completion.spec.ts member/training-completion-flow.spec.ts` (live stack) | **10 passed** (6 setup sign-ins + member 2/2 + officer test 1 pass + officer test 2 expected-failure) | Officer test 2 fails at the credit assertion (`Received: undefined`) — the §4 P0, verified by browser + the member's live `credit-entries` wire. No suite breakage (`test.fail()` quarantine). |
| `bun run --filter 'memberry' typecheck` | exit 0 | New spec files typecheck clean |
| Live-DB verification (psql against local pg) | — | Member enrollment + zero-AUTO-credit baseline + org flags confirmed before authoring |

> Note: api-ts unit suite + full 5-workspace typecheck were already green from the FIX-004-completion pass earlier the same day; FIX-014 adds only E2E spec files + this report (no source/api-ts change), so those baselines are unaffected. `check:sdk-compat` not touched (FIX-014 adds no operationId).

## 7. Validation Summary

- **Passed:** Part 1 real-roster-hydration E2E (real backend data, not fake-green); member real-persisted-credit-data E2E; memberry typecheck. Part 2 RBAC confirmed already-covered + passing (Batch B).
- **RED (intended, quarantined):** the real attendance→credit journey — documents the §4 P0. Fails for the right reason (member earns no credit through the real UI), verified against the live credit-entries wire.
- **Not fixed (out of subset):** the §4 P0 handler bug — documented + recommended, not patched (test-only pass).
- **Fake-green eliminated:** the two prior specs (render/wire-status only) are replaced by specs that exercise real data + the real journey; the negative/real-data assertions cannot be satisfied by a render-only shell.

## 8. Files Changed

| File | Change Summary |
| --- | --- |
| `apps/memberry/tests/e2e/officer/training-completion.spec.ts` | Replaced fake-green render checks with a real-roster-hydration test (passing) + a quarantined real attendance→credit journey test (`test.fail()`) that documents the §4 P0 |
| `apps/memberry/tests/e2e/member/training-completion-flow.spec.ts` | Strengthened to assert real persisted credit-row data on `/my/credits` (not headings) |

## 9. Completion Decision

**COMPLETE (test-only subset) — with a P0 product finding surfaced.**

FIX-014 delivered the real browser proof the fake-green specs lacked. Part 2 (cross-org RBAC 403) was already landed in Batch B and is confirmed passing. Part 1's real journey **surfaced a P0**: the reachable officer attendance UI (`CompletionTable` → `completeCustomTraining`) ignores `personId` and awards no credit, so the attendance→credit journey is still broken in the product despite Batch A FIX-001 (which fixed an unreachable route). Per the decision-free test-only subset, the handler was NOT changed; the failing real-journey test is committed quarantined (`test.fail()`) as the executable spec + regression alarm, and the bug + recommended fix are documented in §4. STOP — no further batch or module started.

## 10. Recommended Next Step

1. **New Training fix pass (P0, decision-free):** fix `completeCustomTraining` to honour `body.personId` + award the AUTO credit via `awardTrainingCredit` (or repoint `<CompletionTable>` to `checkInCustomTraining`); then remove `test.fail()` from the real-journey test so it becomes a passing GREEN proof. Also resolve the dead `attendance.tsx` route (`$trainingId.tsx` renders no `<Outlet/>`).
2. Then the previously-queued CONTINUE-22 follow-ups: orphan-handler cleanup + FIX-010 real-PG rollback test; 0068 dup-enroll deploy preflight; then Track B product decisions; Track C roadmap consolidation.

---

## FIX-014-followup (P0 award fix) — 2026-06-12

**Status: COMPLETE (P0 source fix, GREEN).** The P0 surfaced by FIX-014 is fixed and proven through the real browser. An officer marking a member present now awards THAT member the persisted AUTO credit.

### Approach chosen + why

**Option B (frontend repoint) — Option A was infeasible without scope creep.** `CompleteCustomTrainingBody` = `TrainingEnrollmentCompleteRequestSchema` = `{ completedAt?, awardCredit (required bool) }`. It does **not** carry `personId`, and the UI was sending `{ personId, creditAmount }` with **no `awardCredit`** → the body failed Zod validation, which is the `400` seen on the `completeCustomTraining` POST. Making `completeCustomTraining` honour `personId` (Option A) would require adding `personId` to the TypeSpec body schema = OpenAPI/validator regen = scope creep, explicitly to be avoided. Option B is a pure frontend change against the **already-correct** `checkInCustomTraining` (FIX-001): it honours the targeted member's `personId` (via query), completes THAT enrollee, awards the AUTO credit (server reads the amount from the training record), and is idempotent + toggle-aware.

### Changes made

- `apps/memberry/src/features/training/components/completion-table.tsx` — repointed both `markMutation` and `markAllMutation` from `completeCustomTrainingMutation` to `checkInCustomTrainingMutation`. The two `.mutate()` calls now send `{ path:{trainingId}, query:{organizationId, personId} }` (no body) — dropped the `CompleteTrainingByPersonBody` cast/interface and the unused `TrainingEnrollmentCompleteRequest` import. Optimistic `onMutate` reads `variables.query?.personId`. No backend/TypeSpec change → **no contract/validator drift**.
- `apps/memberry/tests/e2e/officer/training-completion.spec.ts` — removed `test.fail()` (un-quarantined the real-journey test); updated the post-click `waitForResponse` barrier from `/complete` → `/check-in`; refreshed the stale FINDING header to record the fix.

### Backend test (chosen path = `checkInCustomTraining`)

The chosen backend path already carries authoritative coverage from FIX-001 in `check-in.test.ts` (`checkInCustomTraining — awards credit to the named member`): officer checks in member `m-1` → AUTO credit written **for m-1** (not the officer), enrollment completed; re-check-in is idempotent (no 2nd credit); G9 toggle suppresses. Confirmed GREEN (no source change needed there). Option B is frontend-only, so the real RED→GREEN proof is the E2E.

### Verification evidence

- `apps/memberry typecheck` clean; `bun run --filter '*' typecheck` → **5/5 pass**.
- `bun test src/handlers/association:operations/ src/handlers/member/credits/` → **641 pass / 0 fail**.
- Un-quarantined E2E live-stack run → `8 passed (19.5s)`, including `officer marking a member present awards THAT member a persisted AUTO credit`.
- DB proof (local pg): after the run, `credit_entry` holds one `auto` row for member `e209571f…` (member@memberry.ph), `activity_name = 'Dental Photography Seminar'`, `credit_amount = 8` — exactly the targeted member, correct amount.

### Dead-route state (OPTIONAL cleanup — left + documented)

`$trainingId.tsx` still renders no `<Outlet/>`, so `.../$trainingId/attendance` (→ `attendance.tsx` + its FIX-001 `checkInCustomTraining` wiring) remains unreachable. With Option B the canonical attendance path is the `<CompletionTable>` "Attendance" tab; `attendance.tsx` is now redundant. Removal is **not** a 1-line change (route file + parent wiring), so per scope it is left in place and noted here rather than deleted.

**STOP — no further batch or module started.**

---

# AHA Step 26 — orphan-handler cleanup + multi-table approval rollback (real-PG)

Decision-free batchable pass (`04-module-or-group-fix-tdd.md` style). Scope: (a) delete proven-dead delete handlers; (b) add a real-Postgres rollback integration test for the membership-approval multi-table transaction. Manual, no autorun. Working tree left dirty (recovery-2025-incident) — only the dead handlers, the new test, and this section were touched. No commit.

## (a) Orphan-handler cleanup — grep evidence + decision

Candidates: `deleteMembership.ts` / `deleteMembershipApplication.ts` (both in `services/api-ts/src/handlers/member/membership/`). Both self-documented as removable orphans ("the orphan file itself should be removed in a follow-up cleanup. [NEEDS CONFIRMATION]") because the `deleteMembership` / `deleteMembershipApplication` operations were deliberately removed from the membership TypeSpec (FIX-011 / decision #6).

Proof of dead (a handler is orphan only if nothing routes to it AND nothing imports it):

| Reference channel | Command | Result |
|---|---|---|
| Routes/registry (generated) | `grep -rn 'deleteMembership\|deleteMembershipApplication' src/generated` | Only `deleteMembershipTier` (a different, live handler). NO ref to either candidate. |
| Hand-wired routes | `grep -n ... src/app.ts` | none |
| Imports / re-exports (whole repo) | `grep -rn 'deleteMembership\b\|deleteMembershipApplication\b' <repo> --include='*.ts' -l` | only the two files themselves + a **comment-only** mention in `crossOrgGuard.test.ts:131` (no `import`) |
| OpenAPI operationId | `grep -c '"deleteMembership"\|"deleteMembershipApplication"' specs/api/dist/openapi/openapi.json` | `0` |
| Dedicated test files | `ls .../membership/ \| grep deleteMembership` | none (no `deleteMembership.test.ts`); the only delete-handler tests are for the live `deleteMembershipTier` / `deleteInstitutionalMembership` |

**Decision: DELETE both.** No generated route, no `app.ts` wiring, no importer, no re-export, no OpenAPI op, no dedicated test → genuinely dead. Removed via plain `rm` (tree intentionally dirty; `git rm` refused on locally-modified files — deletion preserved, not staged-forced). Post-delete sweep: zero code references remain (only two comments: this report's companion test header + the pre-existing `crossOrgGuard.test.ts` note). `[DO NOT OVERBUILD]` honoured — no live membership delete path was touched; `deleteMembershipTier` / `deleteInstitutionalMembership` (live, distinct) left untouched.

## (b) Multi-table rollback integration test — real Postgres, not a mock

**Premise correction (root cause, surfaced not papered over):** the queued item was labelled "**FIX-010** real-PG **membership-delete** rollback". On inspection that label does not map to any real finding: "FIX-010" is overloaded — in *this* (training-credits) report it is the dup-enrollment guard, and in the membership-lifecycle report it is the re-application unique-violation reuse-row fix (already GREEN). **Neither is a rollback/atomicity finding, and there is no live membership hard-delete path at all** (the only delete handlers were the dead orphans removed in (a); `repo.deleteOneById` is a generic single-table base-repo method). The genuine multi-table atomic write that warrants a real-PG rollback guard is **`approveMembershipApplication.ts`'s `db.transaction(...)`** (reuse-row re-application path, membership FIX-010 / decision #5): it does three writes across three tables —

1. `UPDATE membership_application` → `approved` (+ reviewedBy/At)
2. `UPDATE membership` → `pendingPayment` (re-applied terminal row)
3. `INSERT membership_status_history` (the from→to transition row)

— and its own inline comment states the atomicity contract: "Wrap approval + membership creation in a transaction so a failed [write] doesn't leave the application stuck in 'approved' with no membership record." That is the contract the test guards.

**Test:** `services/api-ts/src/handlers/member/membership/approvalRollback.integration.test.ts` (new). Real Postgres via `pg.Pool` + drizzle, isolated scratch schema, skip-if-unreachable — follows the existing real-PG harness pattern (`statusRecomputeCron.integration.test.ts` / `resignedAtBackfill.integration.test.ts`); no new fixture invented. It drives the **exact `db.transaction` primitive the handler uses** (drizzle `db.transaction(async (tx) => …)` over a scratch-schema-pinned pool) and asserts ZERO partial rows on an induced mid-transaction failure.

RED discipline for existing-correct behaviour (the contract is already correct → the atomic cases are **regression guards**; stated explicitly per the pass rules). To keep the guard honest (a test that can only ever pass proves nothing), a **CONTROL** case demonstrates the hazard is real:

| Case | What it does | Asserts |
|---|---|---|
| CONTROL (proves hazard / "watch it fail") | the SAME 3 writes run **non-transactionally** (autocommit); the 3rd (`to_status` NOT NULL) fails | **partial rows survive** — application `approved`, membership `pendingPayment` — the exact bug the tx prevents |
| ATOMIC #1 | the 3 writes inside `db.transaction`; same DB-constraint failure on the 3rd | **full rollback** — application back to `submitted`, membership back to `removed`, history count `0` |
| ATOMIC #2 | writes 1–2 inside `db.transaction`, then a thrown error before commit | **full rollback** — same zero-partial-row end state |

The CONTROL passing on partial-state survival is the "watch it fail" evidence: it confirms the assertions discriminate atomic from non-atomic; the ATOMIC cases then confirm `db.transaction` eliminates exactly that partial state. No existing assertion weakened.

## Verification evidence

- `bun test src/handlers/member/membership/approvalRollback.integration.test.ts` → **3 pass / 0 fail / 12 expect()** (real local Postgres reachable; the `pg` deprecation warning is emitted by the pre-existing `makeScopedDb` `on('connect')` pattern, not this test).
- `bun test src/handlers/member/membership/` (post-orphan-delete) → **648 pass / 0 fail** (38 files) — deletion broke nothing.
- `bun run --filter '*' typecheck` → **5/5 pass** (`@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry`).

## Files

| File | Change |
|---|---|
| `services/api-ts/src/handlers/member/membership/deleteMembership.ts` | **deleted** (proven-dead orphan) |
| `services/api-ts/src/handlers/member/membership/deleteMembershipApplication.ts` | **deleted** (proven-dead orphan) |
| `services/api-ts/src/handlers/member/membership/approvalRollback.integration.test.ts` | **new** — real-PG multi-table approval-transaction rollback guard (CONTROL + 2 atomic cases) |

No transaction fix was required — `approveMembershipApplication` was already atomic; the test is a regression guard documenting and locking that contract.

**STOP — no further batch or module started.** Next queued (not done this pass): 0068 dup-enroll deploy preflight (de-dup active duplicate enrollments before the partial unique index), then Track B product decisions, then Track C roadmap consolidation.

---

## AHA Step 27 — 0068 dup-enroll deploy preflight (de-dup before the partial unique index)

**Scope:** make the FIRST apply of migration `0068_training_enroll_unique_active.sql` crash-proof on a target DB that already holds duplicate ACTIVE enrollments. The migration adds a PARTIAL UNIQUE index `uq_training_enroll_active` on `training_enrollment(training_id, person_id) WHERE status <> 'cancelled'`; its own header warned that `CREATE UNIQUE INDEX` fails (and the boot-time migrator crashes) on dirty data. This pass prepends an idempotent de-dup preflight INSIDE 0068, before the index. Migration-only — **no schema change, no handler change, no new migration file, no `_journal.json` change.**

### Scope-discovery evidence (premise check)

- Live duplicate active enrollments: `SELECT training_id, person_id, count(*) FROM training_enrollment WHERE status <> 'cancelled' GROUP BY 1,2 HAVING count(*) > 1;` → **0 rows.** The local DB is clean; the preflight is a forward-looking deploy safeguard, not a local repair.
- **Premise contradiction surfaced:** the continuation prompt stated 0068 had "never been applied to a live DB," but the LOCAL Homebrew Postgres (`:5432`, the one the API uses) already has the index — `SELECT indexname FROM pg_indexes WHERE tablename='training_enrollment'` lists `uq_training_enroll_active`, and `0068` is recorded in `meta/_journal.json`. So 0068 already applied cleanly **on this machine** (zero dups, so no crash). It does **not** follow that every deploy target is clean: the migration FILE on disk still shipped with **no preflight**, so any fresh CI/staging/prod DB carrying dirty data would still crash the migrator on first 0068 apply. The deploy-guard work was therefore genuinely undone; this pass adds it. Re-applying the amended 0068 on the already-migrated local DB is a no-op (journal-skipped anyway; and the preflight UPDATE finds zero losers — see below).
- No FK references `training_enrollment.id` (credits are keyed by person/activity, not enrollment id), so soft-cancelling a loser row severs no linked record. The preflight only flips `status`/`cancelled_at`; it never DELETEs.

### Pinned de-dup rule (decision-free, idempotent)

Per `(training_id, person_id)`, among NON-cancelled rows, keep exactly ONE **winner**; losers get `status='cancelled', cancelled_at=now()` (soft-cancel, never DELETE). Winner priority (most-progressed first, so no completion is ever cancelled):
1. `completed` > `enrolled` > `noShow`.
2. Tie-break: earliest `enrolled_at`.
3. Final tie-break: smallest `id`.

Implemented as a `row_number() OVER (PARTITION BY training_id, person_id ORDER BY (status='completed') DESC, (status='enrolled') DESC, enrolled_at ASC, id ASC)` keeping rn=1; rn>1 rows are cancelled. Re-running cancels nothing once one winner per group remains.

### TDD proof (RED → GREEN)

New real-PG integration test `trainingEnrollDedup.integration.test.ts` (same `pg.Pool` + scratch-schema + skip-if-unreachable harness as the Step-26 `approvalRollback.integration.test.ts`). It reads the **actual** preflight + index statements from the 0068 file (comment-stripped, split on `;`) so it can never drift from what ships.

- **RED** (migration unamended, no preflight): `expect(PREFLIGHT_SQL).toBeDefined()` → **fail** (`Received: undefined`); the behavioural test guards out because there is no preflight to run. → `1 pass / 1 fail`.
- **GREEN** (migration amended): seeds two duplicate groups in a scratch `training_enrollment` —
  - Group 1 `(T1,P1)`: `completed` + `enrolled` → asserts `CREATE UNIQUE INDEX … WHERE status <> 'cancelled'` **FAILS** on the dup data (hazard real), then the preflight runs and the `completed` row survives non-cancelled while the `enrolled` loser is `cancelled` with `cancelled_at` set.
  - Group 2 `(T1,P2)`: `enrolled(early)` + `enrolled(late)` + `noShow` → earliest `enrolled` survives; later `enrolled` and `noShow` cancelled (proves priority clauses 1 + 2).
  - After preflight: exactly **2** active rows (one per group), all **5** seeded rows still present (nothing DELETEd), and `CREATE UNIQUE INDEX` now **creates successfully** (`pg_indexes` shows `uq_training_enroll_active`).
  - **Idempotency:** re-running the preflight leaves the active count unchanged and winners untouched.
  - → `2 pass / 0 fail / 17 expect()`.
- **Live-table no-op proof:** the amended preflight run against the real `training_enrollment` inside `BEGIN … ROLLBACK` reports `UPDATE 0` (zero losers on the clean live table) — confirms it is a harmless no-op where data is already clean.

### Verification (fresh runs)

- `bun test trainingEnrollDedup.integration.test.ts training-enroll-index.schema.test.ts` → **6 pass / 0 fail / 25 expect()** (real local Postgres reachable).
- Existing `training-enroll-index.schema.test.ts` partial-unique-index assertions **unchanged and still GREEN**; added one assertion locking the preflight-before-index ordering + soft-cancel/row_number text (no existing assertion weakened).
- `bun run --filter '*' typecheck` → **5/5 pass** (`@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry`).

### Files

| File | Change |
|---|---|
| `services/api-ts/src/generated/migrations/0068_training_enroll_unique_active.sql` | **amended in place** (never renumbered) — idempotent de-dup preflight UPDATE prepended before the existing `CREATE UNIQUE INDEX IF NOT EXISTS`; header note records the preflight |
| `services/api-ts/src/handlers/association:operations/repos/trainingEnrollDedup.integration.test.ts` | **new** — real-PG hazard→preflight→index proof + idempotency, executing the actual 0068 statements |
| `services/api-ts/src/handlers/association:operations/repos/training-enroll-index.schema.test.ts` | **+1 test** locking preflight-before-index ordering + soft-cancel text; partial-unique-index assertions untouched |

**STOP — no further batch or module started.** Next: Track B product decisions (membership E2 state-machine — reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy) need product input → halt for the user. Then Track C roadmap consolidation.

---

## AHA Step 47 — Training & Credits product-decision gates (TC-DEC-01 + TC-DEC-02)

**Fix date:** 2026-06-13 · **Batch executed:** TC-DEC-01 (paid-training proof-of-payment) + TC-DEC-02 (manual-entry verification gate) · **Superpowers used:** No (disciplined batching applied manually) · **Working tree status checked:** Yes (intentionally dirty — preserved; no destructive git) · **Fix scope:** the two remaining P1 product-decision gates · **Out of scope:** Stripe fee path, fractional credits, V2 enrollment modes/waitlist/LMS · **Shared files touched:** Yes (credits repo in `association:member/repos`, shared `enrollment_status` enum, status-transitions FSM) · **Schema/migration touched:** Yes (0070 matview, 0071 enum+columns).

### Decisions captured (user deferred → engineering recommendation applied, per `feedback_defer_decisions`)

| ID | Decision | Resolution (verbatim user answer: *"I defer to your recommendation and best judgment"*) |
|---|---|---|
| **TC-DEC-01** | Paid trainings in V1? Fee path? | **Proof-of-payment (Recommended)** — module-local, no Stripe. Paid enrollment enters `payment_pending`; member submits offline-payment proof; an officer confirms → `enrolled`. Stripe Connect option explicitly **NOT** taken (would be a cross-module billing-stripe pass). |
| **TC-DEC-02** | Manual member credit entries: count immediately or behind a verification gate? | **Verification gate (Recommended)** — member self-reported manual entries stay `verificationStatus='pending'` and do **not** count toward totals until an officer verifies them. AUTO (training-attendance) and officer-awarded entries are written `verified` and count immediately. |

### TC-DEC-02 — verification gate (RED → GREEN)

- **Root cause:** the `verificationStatus` enum + `'pending'` default already existed, but every credit-TOTAL aggregate filtered only `status='active'` (FIX-005 void gate) and **ignored `verification_status`** — so a member's pending self-entry inflated their total. Separately, `awardTrainingCredit` never set `verificationStatus`, so AUTO credits were silently `pending` and only counted because the gate didn't exist; adding the gate **required** stamping AUTO = `verified` or the shipped Batch-A/E journey would have broken.
- **RED** (`verification-gate.test.ts`, mock-db + real handlers/repo; `7 fail / 1 pass`): AUTO insert lacked `verified`; `sumCreditsForCycle` / `sumCreditsByOrg` / `sumCreditsByCategoryBatch` / transcript-list / `getMyCredits`-sum WHEREs lacked `verification_status`; matview migration absent.
- **GREEN** (`8 pass / 21 expect()`):
  - `award-training-credit.ts` → AUTO insert stamps `verificationStatus: 'verified'`.
  - `credits.repo.ts` → `CreditEntryFilters.verificationStatus` + `buildWhereConditions` predicate; `sumCreditsForCycle`, `sumCreditsByCategoryBatch`, `sumCreditsByOrg` all add `eq(verificationStatus,'verified')`; `listForPerson` (transcript) filters `verificationStatus:'verified'`.
  - `getMyCredits.ts` → the credit **total** uses a `verified`-gated `sumConditions`; the **history** list keeps the unfiltered conditions so a member still SEES their pending submissions (with the badge).
  - **Matview parity** (the FIX-005 consistency lesson) → migration `0070_credit_verification_gate.sql` DROP+CREATEs `compliance_standings` adding `AND ce.verification_status='verified'` to the existing `ce.status='active'` filter; file-read schema test locks it.
- **Member self-entry** (`createCreditEntry`) already left `verificationStatus` at the `'pending'` default — confirmed by a regression-lock test (it must never be created `verified`). No change needed there.

### TC-DEC-01 — paid-training proof-of-payment (RED → GREEN)

- **Root cause:** paid trainings dead-ended — `createTrainingEnrollment` / `enrollInCustomTraining` threw `PAYMENT_REQUIRED` when `registrationFee > 0`, so a member could never enroll.
- **RED:** the two existing `BR-41` tests asserting `PAYMENT_REQUIRED` were rewritten to assert the new proof-of-payment behaviour (paid → `payment_pending`, no throw) → failed against the unmodified handlers; new `training-payment.test.ts` for the two new lifecycle handlers (didn't exist).
- **GREEN** (`training-enrollment.test.ts 41 pass`; `training-payment.test.ts 7 pass`):
  - Both enroll handlers: paid training → create enrollment `status: 'payment_pending'` (free → `enrolled` unchanged).
  - Schema: `payment_pending` added to the shared `enrollment_status` enum; `training_enrollment` gains `proof_storage_key`, `proof_file_name`, `proof_mime_type`, `payment_submitted_at`, `payment_confirmed_by`, `payment_confirmed_at` (migration `0071_training_payment_proof.sql`).
  - FSM (`status-transitions.ts`): `payment_pending → [enrolled, cancelled]`. Crucially `payment_pending` is **not** a valid source for `completed`, so **no credit can be awarded while payment is unconfirmed** (completion still requires `enrolled → completed`).
  - New TypeSpec ops (regenerated): `submitTrainingPaymentProof` (member, attaches proof to own `payment_pending` enrollment; rejects others' / non-pending) and `confirmTrainingPayment` (officer `x-require-position`; FSM-guarded `payment_pending → enrolled`, records confirmer/timestamp; rejects confirming a non-paid enrollment with 409).

### `[CROSS-MODULE RISK]` / deferred

- **Stripe fee path** — NOT built (decision chose proof-of-payment). If Stripe is later wanted it is a coordinated **billing-stripe** `04`, mirroring `registerAndPayForEvent`. `[CROSS-MODULE RISK]`.
- **Frontend UI** (member submit-proof upload + officer confirm-payment button + a payment_pending badge on `/my/training`) — **NOT built this pass**; backend contract is complete and exposed. `[FOLLOW-UP]` (E2E is `[BLOCKED BY ENVIRONMENT]` — `:3004` redirects to `/auth/sign-in`, no seeded auth — so this was proven at the handler/repo/DB layer, not via browser).
- **Contract suite (Hurl):** TypeSpec changed (2 new ops) but no `.hurl` scenarios authored for them and the suite needs a running impl → `[BLOCKED BY ENVIRONMENT]` this pass; generated routes/validators compile clean.

### Validation (fresh runs)

- `bun test src/handlers/member/credits/ src/handlers/association:operations/ src/handlers/person/` → **855 pass / 0 fail**.
- `bunx tsc --noEmit` (api-ts) → **clean** (also `specs/api bun run build` + `api-ts bun run generate` clean — 2 new handler stubs generated + implemented).
- Full `bun test` → **6439 pass / 1 fail**. The single failure (`email/jobs/index.test.ts` expecting interval `30000`, got `1000`) is **pre-existing and unrelated** — bun auto-loads `.env` which sets `EMAIL_PROCESSOR_INTERVAL_MS=1000`; nothing in this pass touches the email module.
- **DB proof (local Postgres `monobase`):** migrations `0070` + `0071` applied cleanly via the real SQL; verified `enrollment_status` now includes `payment_pending`, all 6 proof/payment columns exist on `training_enrollment`, and `pg_get_viewdef('compliance_standings')` contains `verification_status = 'verified'`.

### Files changed

| File | Change | Decision |
|---|---|---|
| `services/api-ts/src/handlers/association:operations/utils/award-training-credit.ts` | AUTO credit insert stamps `verificationStatus: 'verified'` | TC-DEC-02 |
| `services/api-ts/src/handlers/association:member/repos/credits.repo.ts` | `verificationStatus` filter on `CreditEntryFilters`/`buildWhereConditions` + the 3 SUM methods + transcript `listForPerson` | TC-DEC-02 |
| `services/api-ts/src/handlers/person/getMyCredits.ts` | total gated on `verified`; history shows all (pending visible) | TC-DEC-02 |
| `services/api-ts/src/generated/migrations/0070_credit_verification_gate.sql` (+journal) | matview `compliance_standings` adds `verification_status='verified'` | TC-DEC-02 |
| `services/api-ts/src/handlers/association:operations/createTrainingEnrollment.ts`, `enrollInCustomTraining.ts` | paid → `payment_pending` instead of `PAYMENT_REQUIRED` throw | TC-DEC-01 |
| `services/api-ts/src/handlers/association:operations/repos/training.schema.ts` | `payment_pending` enum value + 6 proof/payment columns | TC-DEC-01 |
| `services/api-ts/src/utils/status-transitions.ts` | `payment_pending → [enrolled, cancelled]` | TC-DEC-01 |
| `services/api-ts/src/handlers/association:operations/submitTrainingPaymentProof.ts`, `confirmTrainingPayment.ts` | new lifecycle handlers (implemented from generated stubs) | TC-DEC-01 |
| `specs/api/src/association/operations/training.tsp` | enum value, `TrainingEnrollment` proof fields, `TrainingPaymentProofRequest`, 2 new ops | TC-DEC-01 |
| `services/api-ts/src/generated/migrations/0071_training_payment_proof.sql` (+journal) | enum value + proof columns | TC-DEC-01 |
| `…/member/credits/verification-gate.test.ts` (new), `…/association:operations/training-payment.test.ts` (new), `…/training-enrollment.test.ts` (BR-41 rewritten) | tests | both |

### Completion Decision

**COMPLETE** — both gates closed for V1 at the backend/data layer. Stripe fee path (TC-DEC-01 alternative) and proof-of-payment frontend UI are the only carry-forwards, each tagged above. **STOP — no auto-chain to another gated module from within this report.**
