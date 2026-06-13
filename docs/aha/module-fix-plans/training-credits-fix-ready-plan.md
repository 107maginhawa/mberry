# AHA Fix-Ready Plan: Training & Credits

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| Audit decision | FAIL |
| Superpowers used | No (organizer ran with direct gap-plan + file-existence verification; `/using-superpowers` not invoked — disciplined batching applied manually) |
| Organizer decision | PARTIALLY READY |
| Reason | Core P0/P1 backend+data fixes (G1 attendance→credit wiring, G2 cycle authority, G3 void-blind aggregates, G4 required-credits source-of-truth, G6 lifecycle, G7 type+lock, G8 silent failure) are evidence-backed and fix-ready now. Several items are gated by product decisions (G5 paid trainings, manual-entry pending policy, 45-vs-60 default, fractional credits, self-complete scope) and must not enter the active fix scope until answered. So the module is ready to START fixing (Batch A) but not fully ready end-to-end. |
| Limitations | No server boot, no test execution during organize. Three `[NEEDS CONFIRMATION]` items (matview `status` filter, `requirePosition` ctx-org scoping, what the two `*training-completion*` Playwright specs actually assert) must be resolved during the fix pass with running tests, not assumed. File existence of all primary cited paths confirmed; runtime behavior not re-verified. |

## 2. Fix Strategy Summary

Fix in **multiple ordered batches**, not one pass. The module fails on its core promise (officer confirms attendance → member earns CPD credit), but the surrounding officer tooling and member read views are solid and unit-tested, so this is targeted remediation, not a rewrite.

- **Fix first (Batch A):** the P0 broken credit-award seam (G1) plus the two correctness bugs that make the same code path dangerous — silent credit-insert failure (G8) and member self-complete corrupting the officer award path (G6). These are one tightly-coupled journey: making attendance award a credit is pointless if the award silently fails or if the member can permanently block it first.
- **Fix second (Batch B):** the P1 data-trust cluster — single cycle authority (G2), void/pending-aware aggregates (G3), and one required-credits source of truth (G4). These determine whether compliance numbers and the regulator-facing transcript can be trusted. They depend on Batch A producing real credit rows to assert against.
- **Fix third (Batch C):** P1 spec-alignment that needs a migration + TypeSpec regen — persist `training.type` and lock `creditAmount` after first award (G7). Isolated because it touches the generation pipeline and a DB migration.
- **Fix fourth (Batch D):** selected P2 V1-completeness/reliability — toggle enforcement (G9), duplicate-enrollment guard (G10), `/my/training` earned-credit predicate (G11), client-side CSV export, strip `body.organizationId` from createTraining (F6).
- **Batch E (test hardening)** is woven into A–D as test-first work rather than a trailing batch, but the regression net (cross-path cycle consistency, void exclusion, RBAC cross-org) is called out separately so it is not skipped.
- **Do NOT fix now:** paid-training path (G5) and all product-decision items (manual-entry pending policy, 45-vs-60 default, fractional credits, self-complete existence). Do NOT build enrollment modes, waitlist, network approval, or expand the courses/quizzes LMS.

**Major risks:** (1) credits schema/repo live in `association:member/repos/` but are consumed by `association:operations` training handlers and `member/credits` handlers — a 3-directory coupling that collides with the deferred P1-11 mega-module split; **fix in place, do not relocate**. (2) Cycle-authority refactor (G2) changes how existing rows are interpreted — needs a consistency test and a decision on whether to backfill. (3) G1 may require a TypeSpec change (check-in body needs an enrollee id) → regenerate routes/validators. (4) `compliance_standings` matview and `refreshCompliance` must keep behaving correctly after G3 — verify the view filters `status` too.

**Shared/platform/database work required:** yes — a DB migration for G7 (`training.type` column) and possibly the matview definition for G3; the `creditTracking` feature flag (platformadmin) is a read-only shared dependency for G9. These are isolated into Batch C / Batch F notes.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — Attendance→credit award journey broken end-to-end: officer attendance UI never sends memberId; `checkInCustomTraining` persists nothing; `completeTrainingEnrollment` (only credit-awarding op) has zero frontend consumers | P0 | V1 REQUIRED | A | Core platform value ("track CE credits") produces no AUTO CreditEntry today | `attendance.tsx:31-36`; `checkInCustomTraining.ts:26-42`; grep `completeTrainingEnrollment` in `apps/` = 0 hits (gap §5, §10 G1, §11) |
| FIX-002 | G8 — Silent credit-award failure: bare `catch {}` swallows credit-insert error; completion succeeds, credit silently missing, nothing logged/audited | P1 | V1 REQUIRED | A | Member shows "completed" with zero credits and no trace; same handler FIX-001 touches | `completeTrainingEnrollment.ts:84-86` (gap §5, §10 G8, §15) |
| FIX-003 | G6 — Lifecycle self-service corruption: member self-`completeCustomTraining` (terminal) blocks officer credit award; member enrollment-cancel emits `training.cancelled` (wrong scope) | P1 | V1 REQUIRED | A | Self-complete permanently loses credits; wrong domain event can fire cross-module cancel/cert consumers `[CROSS-MODULE RISK]` | `completeCustomTraining.ts:44-53`; `cancelCustomTraining.ts:49-53`; FSM in `completeTrainingEnrollment.ts:44` (gap §5, §10 G6, §16) |
| FIX-004 | G2 — Three incompatible cycle computations stamp `cycleStart/cycleEnd` at the three credit-write paths | P1 | V1 REQUIRED | B | Same member's entries land in different cycle windows → wrong compliance + transcript | `completeTrainingEnrollment.ts:69`; `awardManualCredit.ts:30-33`; `creditIssue.ts computeCycleBoundaries` (gap §5, §10 G2, §13 F2) |
| FIX-005 | G3 — Voided/pending entries counted in aggregates: `sumCreditsByOrg` and read paths lack `status='active'` filter | P1 | V1 REQUIRED | B | Officer void has no effect on member-visible totals/PDF/compliance | `credits.repo.ts:175-194`; `voidCreditEntry.ts` sets `status='voided'` (gap §5, §10 G3, §13 F3) |
| FIX-006 | G4 — Required-credits has 4 sources of truth incl. client-supplied: org config 60/3, `getCreditCompliance` defaults 40/2, FE hardcode 45/3, client-supplied transcript params | P1 | V1 REQUIRED | B | Officer/member see contradictory verdicts; member self-certifies on regulator PDF | `getCreditCompliance.ts:40-44`; `reports/credits.tsx:30`; `app.ts:522-543`; `org_cpd_config` (gap §5, §10 G4, §14) |
| FIX-007 | G7a — `training.type` (M9-R1) accepted by API, dropped by handler, absent from DB; search filter advertised but unbacked | P1 | V1 REQUIRED | C | Type is the CPD reporting taxonomy; search silently no-ops | `training.tsp:24,167`; `validators.ts:12271`; `training.schema.ts` (no column); `createTraining.ts:28-40` (gap §4, §5, §10 G7) |
| FIX-008 | G7b — M9-R2 credit-value lock: `updateTraining` mutates `creditAmount`/`status` freely after attendance/award | P1 | V1 REQUIRED | C | Credit-value drift after award corrupts history | `updateTraining.ts:31-33` (gap §4, §5, §10 G7) |
| FIX-009 | G9 — `creditTracking` toggle (M9-R8) unenforced at award path | P2 | V1 RECOMMENDED | D | AC explicitly requires hosting-org toggle to suppress credit; util exists+tested but unused at award | `completeTrainingEnrollment.ts:61` (no `isEnabled` check); `credits.test.ts:836-852` (gap §4, §5, §10 G9) |
| FIX-010 | G10 — Duplicate enrollment possible: no unique constraint/pre-check on (trainingId, personId) | P2 | V1 RECOMMENDED | D | Capacity distortion; `enrollments[0]` picks arbitrarily | `enrollInCustomTraining.ts:51-56`; `training_enrollment` indexes (gap §5, §10 G10, §13 F5) |
| FIX-011 | G11 — `/my/training` counts `enrolled` (not attended) as earned credits | P2 | V1 RECOMMENDED | D | Member dashboard overstates earned CPE | `my/training.tsx` `isCompleted = status === 'enrolled'` (gap §10 G11, §11) |
| FIX-012 | 10.7 — No CSV export on officer compliance report | P2 | V1 RECOMMENDED | D | Officers need exportable compliance for regulators; client-side CSV from standings is enough | `officer/reports/credits.tsx` (no export) (gap §4 10.7, §22) |
| FIX-013 | F6 — `createTraining` accepts `body.organizationId || orgId`, allowing org-context override | P2 | V1 RECOMMENDED | D | Org-isolation: could create training under a foreign org if validator passes body org through | `createTraining.ts:29` (gap §13 F6, §14) |
| FIX-014 | Regression coverage for the cross-path credit pipeline (cycle consistency across completion/manual/job; void exclusion across all reads; officer-of-other-org compliance access) | P1 | V1 REQUIRED | E | Without this net, Batch A/B fixes can regress silently; gap flags possible fake-green E2E on the P0 journey | gap §20 (test gaps), §18 (Playwright fake-green risk), §14 (RBAC) |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A | P0 core credit-award journey + the two correctness bugs on the same path | FIX-001, FIX-002, FIX-003 | High (touches the only credit-awarding path; may need TypeSpec regen for check-in body; cross-module event rename) | Run in current `04` pass (FIRST) |
| B | P1 data-trust: single cycle authority, void/pending-aware aggregates, one required-credits source | FIX-004, FIX-005, FIX-006 | High (changes interpretation of existing rows; touches hand-wired `app.ts` transcript routes; verify matview) | Run in a separate `04` pass, after Batch A lands |
| C | P1 spec alignment requiring migration + TypeSpec regen | FIX-007, FIX-008 | Medium-High (DB migration for `type`; generation-pipeline change) | Run after Batch B; coordinate with Batch F migration step |
| D | Selected P2 V1 reliability/completeness | FIX-009, FIX-010, FIX-011, FIX-012, FIX-013 | Low-Medium (mostly module-local; FIX-010 adds a unique index/partial index = small schema change) | Run after Batch C, or interleave low-risk items (FIX-011, FIX-012) earlier if convenient |
| E | Test hardening / regression net for the credit pipeline + RBAC | FIX-014 | Low (test-only) | Written test-first within Batches A–D; cross-path consistency + RBAC tests authored before/with B |
| F | Database/schema dependency isolation (do not bury in module batches) | FIX-007 migration (`training.type` column), FIX-010 unique/partial index, G3 matview `status` verification, **NOT** fractional-credits numeric migration (deferred) | Medium (generated migrations + matview) | Migration steps execute as part of Batch C (type) and Batch D (enrollment index); matview check executes inside Batch B; fractional-credits migration deferred behind product decision |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Officer checks in member X → member X (not the officer) gains an AUTO CreditEntry, persisted across reload | E2E/Playwright + backend/unit | The full journey produces a persisted credit for the correct member; reload does not lose it | E2E: extend/replace `apps/memberry/tests/e2e/officer/training-completion.spec.ts` (verify it is not fake-green first); backend: extend `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts` (AC-M09-001) + `check-in.test.ts` |
| FIX-001 | `checkInCustomTraining` persists attendance (confirmedBy/At) and is idempotent per member | backend/unit | Repeat check-in does not double-award; correct enrollee is targeted | `services/api-ts/src/handlers/association:operations/check-in.test.ts` |
| FIX-002 | Credit-insert failure is logged + surfaced (`creditAwarded: 0` with reason), not swallowed | backend/unit | Forced insert failure produces a log/audit trace, not a silent success | `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts` (failure-path case) |
| FIX-003 | Member self-complete then officer complete → credit still awarded (or self-complete returns 403) | backend/unit | Member self-service cannot permanently block the officer credit award | `services/api-ts/src/handlers/association:operations/training-lifecycle.test.ts` (or `training-enrollment.test.ts`) |
| FIX-003 | `cancelCustomTraining` emits an enrollment-scoped event, not `training.cancelled` | backend/unit + regression | Cross-module cancel/cert consumers are not triggered by an enrollment cancel | same lifecycle test file |
| FIX-004 | Credit from training completion, manual award, and the job for the same member/org land in the SAME cycle window | backend/unit (regression) | One cycle authority resolves all write paths from `org_cpd_config` | new: `services/api-ts/src/handlers/member/credits/utils/credit-cycle.test.ts` (extend) or `credits.test.ts` cycle-consistency describe |
| FIX-005 | Void a credit → transcript total and compliance both drop; pending policy honored | backend/unit | Aggregate reads exclude `status='voided'` everywhere | extend `services/api-ts/src/handlers/member/credits/voidCreditEntry.test.ts` + `credits.test.ts` (BR-14 describe) |
| FIX-005 | `compliance_standings` matview excludes voided rows | data/schema | The matview path agrees with the repo read filter | new assertion in `getComplianceReport.test.ts` or a schema test `[NEEDS CONFIRMATION]` |
| FIX-006 | `updateOrgCpdConfig` change → `getCreditCompliance`/report/transcript reflect new requiredCredits | integration | Single source of truth = `org_cpd_config` | extend `services/api-ts/src/handlers/member/credits/updateCpdConfig.test.ts` + `getComplianceReport.test.ts` |
| FIX-006 | Transcript endpoint IGNORES client-supplied `requiredCredits`/`cyclePeriodYears`/`registrationDate` | backend/unit + permission/RBAC | Member cannot self-certify compliance on the regulator PDF | extend `services/api-ts/src/handlers/member/credits/getCreditTranscriptPdf.test.ts` |
| FIX-007 | `training.type` persists on create and the search filter returns by type | backend/unit + data/schema | Type round-trips through DB; search is real, not a no-op | extend `services/api-ts/src/handlers/association:operations/createTraining.test.ts` + `getTraining.test.ts` |
| FIX-008 | `creditAmount` change is rejected once any AUTO credit exists for the training; `status` stripped from PATCH body | backend/unit | M9-R2 lock holds after first award | extend `services/api-ts/src/handlers/association:operations/training.test.ts` (updateTraining case) |
| FIX-009 | Toggle-disabled org → completion records, NO credit awarded | backend/unit | M9-R8 toggle suppresses credit at award path | extend `training-enrollment.test.ts` + reuse toggle util pattern from `credits.test.ts:836-852` |
| FIX-010 | Duplicate enroll for same (trainingId, personId) rejected | backend/unit + data/schema | Unique/partial index + pre-check prevents double enrollment | extend `services/api-ts/src/handlers/association:operations/training-enrollment.test.ts` |
| FIX-011 | `/my/training` CPE stat counts completed trainings only | frontend/component | Earned-credit predicate is `completed`, not `enrolled` | new/extend component test under `apps/memberry/tests` for `my/training.tsx`; or assert in existing `apps/memberry/tests/e2e/member/training.spec.ts` |
| FIX-012 | Compliance report CSV export contains the standings rows | frontend/component or E2E (light) | Export button produces correct CSV from standings | extend `apps/memberry/tests/e2e/officer/reports-credits.spec.ts` |
| FIX-013 | `createTraining` ignores `body.organizationId`, binds to ctx org | backend/unit + permission/RBAC | Org isolation: cannot create training under a foreign org | extend `services/api-ts/src/handlers/association:operations/createTraining.test.ts` |
| FIX-014 | Officer of org A cannot read org B compliance; cross-path cycle + void regression net | permission/RBAC + regression | RBAC scoping holds; pipeline fixes do not regress | extend `getCreditCompliance.test.ts` / `getComplianceReport.test.ts` + the cycle-consistency and void tests above |

Note: Reserve Playwright/E2E for the core journey (FIX-001 attendance→credit, light export check for FIX-012). All other proofs are backend/unit, component, or integration. Prefer extending the named existing files over creating new ones. Do NOT create or modify any test during this prompt.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/handlers/association:operations/checkInCustomTraining.ts`, `completeTrainingEnrollment.ts`; `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance.tsx`; possibly `specs/api/src/association/operations/training.tsp` (check-in body needs enrollee id) + regenerated `routes.ts`/`validators.ts` | cross-module (operations handler + memberry UI + possibly TypeSpec pipeline) | High — touches the credit-write path and the generation pipeline; certificates consumer downstream |
| FIX-002 | `services/api-ts/src/handlers/association:operations/completeTrainingEnrollment.ts` (lines 84-86) | module-local | Low-Medium — same handler as FIX-001 |
| FIX-003 | `services/api-ts/src/handlers/association:operations/completeCustomTraining.ts`, `cancelCustomTraining.ts`; possibly TypeSpec lifecycle interface roles; domain-event name | cross-module (event rename affects `core/domain-event-consumers.ts` + certificates) | High — event-name change has cross-module consumers `[CROSS-MODULE RISK]` |
| FIX-004 | `services/api-ts/src/handlers/member/credits/utils/credit-cycle.ts`; call sites: `completeTrainingEnrollment.ts:69`, `awardManualCredit.ts:30-33`, `adjustCreditEntry.ts:36-45`, `association:member/jobs/creditIssue.ts` | cross-module (operations + credits + jobs) | High — single shared cycle service consumed by 3 write paths |
| FIX-005 | `services/api-ts/src/handlers/association:member/repos/credits.repo.ts` (`sumCreditsByOrg` 175-194); read paths `getMyCredits.ts`, `getCreditTranscript.ts`, compliance handlers; `compliance_standings` matview definition (migration) | shared/platform (repo in `association:member/repos/`) + database/schema (matview) | High — repo feeds all credit reads; matview is a migration artifact |
| FIX-006 | `services/api-ts/src/app.ts:522-543` (hand-wired transcript routes); `getCreditCompliance.ts:40-44`; `getCreditTranscript.ts`; `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx:30` | cross-module (hand-wired app routes + handlers + UI) | High — hand-wired routes in `app.ts` (not generated) |
| FIX-007 | `services/api-ts/src/handlers/association:operations/repos/training.schema.ts` (+ generated migration); `createTraining.ts:28-40`; search handler; `specs/api/src/association/operations/training.tsp` already has `TrainingType` | database/schema + module-local | Medium-High — DB migration + generation pipeline |
| FIX-008 | `services/api-ts/src/handlers/association:operations/updateTraining.ts:31-33` | module-local | Low |
| FIX-009 | `services/api-ts/src/handlers/association:operations/completeTrainingEnrollment.ts:61` (add `isEnabled(org,'creditTracking')`) | shared/platform (reads platformadmin feature flag) | Low — read-only flag dependency |
| FIX-010 | `services/api-ts/src/handlers/association:operations/repos/training.schema.ts` (unique/partial index, migration); `enrollInCustomTraining.ts:51-56` | database/schema + module-local | Low-Medium — index migration |
| FIX-011 | `apps/memberry/src/routes/_authenticated/my/training.tsx` (predicate + dead status variants) | module-local (frontend) | Low |
| FIX-012 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx` (client-side CSV) | module-local (frontend) | Low |
| FIX-013 | `services/api-ts/src/handlers/association:operations/createTraining.ts:29` | module-local | Low |
| FIX-014 | Test files only (see §5) | module-local / cross-module (tests) | None (test-only) |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001, FIX-004, FIX-005 | shared/platform | Credits repo+schema live in `association:member/repos/` but are consumed by `association:operations` training handlers and `member/credits` handlers (3-directory coupling) | Any credit-write/read fix spans all three dirs; collides with deferred P1-11 mega-module split | Fix IN PLACE; do not relocate. No prerequisite, but document `[SHARED DEPENDENCY]` |
| FIX-005 | database/schema | `compliance_standings` materialized view + `refreshCompliance` | The matview must also exclude `status='voided'` or it will disagree with repo reads | Verify matview filter during Batch B `[NEEDS CONFIRMATION]` |
| FIX-006 | cross-module | Hand-wired transcript routes in `services/api-ts/src/app.ts:522-543` (not generated) | Editing app.ts bypasses the normal generated-route path; care with middleware ordering | During fix; confirm against `docs/quality/HAND_WIRED_ROUTES.yaml` |
| FIX-003 | cross-module | `training.completed` / `training.cancelled` domain events consumed by certificates (EM-M11) and `core/domain-event-consumers.ts` | Renaming/rescoping the event changes cross-module side effects | During fix; coordinate event name with consumers `[CROSS-MODULE RISK]` |
| FIX-007 | database/schema | New `type` column on `trainings` table → generated migration + TypeSpec regen | Schema change + code-gen pipeline; `TrainingType` already exists in TypeSpec | During Batch C; run `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` after |
| FIX-009 | shared/platform | platformadmin `creditTracking` feature flag (`isEnabled` util) | M9-R8 enforcement reads platform org flags | Read-only; util already tested |
| FIX-010 | database/schema | Unique/partial index on `training_enrollment (trainingId, personId)` | Prevents duplicate enrollment at DB level | During Batch D; generated migration |
| FIX-007 (declined variant), F4 | database/schema + product decision | Fractional credits (integer→numeric migration on `credit_amount` in both `training` and `credit_entry`) | Touches generated migrations + TypeSpec types | DEFERRED behind product decision — NOT in active scope |
| FIX-001 | cross-module | `cpdActivityTypeEnum` imported from `association:operations/repos/events.schema.ts` into `credits.schema.ts:18` | Schema-level cross-module cycle; split-blocker | Document `[SHARED DEPENDENCY]`; do not move during fix |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Are paid trainings in V1 scope, and via which M06 path (proof-of-payment vs Stripe)? | ✅ **DECIDED (Step 47, TC-DEC-01)** | G5 | **Proof-of-payment** chosen (module-local, no Stripe). Built: paid enroll → `payment_pending`, `submitTrainingPaymentProof` (member) + `confirmTrainingPayment` (officer) → `enrolled`. Stripe path deferred to a coordinated billing-stripe `04` `[CROSS-MODULE RISK]`; frontend UI is a `[FOLLOW-UP]`. |
| Should member-submitted manual entries (`verificationStatus='pending'`) count toward totals immediately (10.2) or behind a verification gate? | ✅ **DECIDED (Step 47, TC-DEC-02)** | FIX-005 (aggregate verification policy) | **Verification gate** chosen. Built: all credit-TOTAL aggregates + the `compliance_standings` matview now require `verification_status='verified'`; AUTO/officer-award entries written `verified`; member self-entries stay `pending` until an officer verifies. |
| Canonical PH default: 45 units (FE/PRC copy) vs 60 (`org_cpd_config` default)? | `[NEEDS PRODUCT DECISION]` | FIX-006 (single source of truth value) | Seeds + config defaults; FIX-006 makes `org_cpd_config` authoritative but the seeded default value must be correct | Confirm canonical default before FIX-006; FIX-006 plumbing can proceed (resolve from config) while the literal default awaits confirmation |
| Should `completeCustomTraining` (member self-complete) exist at all, or only for self-paced online types? | `[NEEDS PRODUCT DECISION]` | FIX-003 | Determines whether to forbid (403) or make officer path idempotent | Confirm scope; FIX-003 can ship the idempotent-officer-award safety net regardless, but the self-complete restriction shape needs the decision |
| Does `requirePosition` validate the officer term against the ctx org set from the path param in `getCreditCompliance`? | `[NEEDS CONFIRMATION]` | FIX-014 (RBAC), FIX-006 | Cross-org officer access correctness | Verify during fix with a running test (officer-of-other-org) — do not assume |
| Does `searchTrainings` repo error or silently ignore the `type` filter (no column)? | `[NEEDS CONFIRMATION]` | FIX-007 | Affects whether FIX-007 is purely additive or also fixes an error | Verify during Batch C |
| What do `officer/training-completion.spec.ts` and `member/training-completion-flow.spec.ts` actually assert (UI state vs persisted credit)? | `[NEEDS CONFIRMATION]` | FIX-001, FIX-014 | Fake-green risk on the P0 journey | Run + read these specs FIRST in Batch A before trusting them |
| Are fractional CPD units (0.5) required for PRC compliance (integer→numeric migration)? | `[NEEDS PRODUCT DECISION]` | F4 (deferred) | Migration risk | Defer; not in active scope |
| Does `compliance_standings` matview filter `status='voided'`? | `[NEEDS CONFIRMATION]` | FIX-005 | G3 completeness | Verify during Batch B |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Paid training pay-and-enroll path (G5) | ✅ **RESOLVED (Step 47, TC-DEC-01)** — proof-of-payment built module-local (`payment_pending` + submit/confirm). Stripe variant still `[CROSS-MODULE RISK]` → billing-stripe `04`; frontend UI `[FOLLOW-UP]`. | — | — |
| Fractional credit columns (integer→numeric migration, F4) | `[NEEDS PRODUCT DECISION]` | Touches generated migrations + TypeSpec types; unknown if PRC requires 0.5 units | Product decision on fractional units |
| Manual-entry pending-counting policy (10.2) — exact aggregate filter | ✅ **RESOLVED (Step 47, TC-DEC-02)** — verification gate built; aggregates + matview require `verification_status='verified'`. | — | — |
| Canonical 45-vs-60 required-credits default value | `[NEEDS PRODUCT DECISION]` | FIX-006 plumbing is unblocked, but the seeded literal default cannot be set correctly without this | Product decision on canonical PH default |
| Self-complete (`completeCustomTraining`) existence/scope | `[NEEDS PRODUCT DECISION]` | FIX-003's restriction shape (forbid vs scope-to-self-paced) depends on it | Product decision |

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Enrollment modes (approval-required, invitation-only) + TrainingInvitation table | §5 M9-R4, §23 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Open enrollment covers pilot orgs; large schema/UI surface |
| Training waitlist + 24h paid promotion (M9-R9) | §5, §23 | `V2 DEFERRED` | Capacity hard-stop acceptable for V1; events waitlist exists as future template |
| Network approval workflow (M9-R6) + TrainingApprovalConfig | §5, §23 | `V2 DEFERRED` | PRD itself says "when configured"; no approver model yet |
| Multi-session fields, cover image, rich-text description | §23 | `V2 DEFERRED` | Cosmetic for V1 |
| Prorated below-pace compliance flagging (10.7) | §4 10.7, §23 | `V2 DEFERRED` | Nice-to-have analytics |
| Fractional credit numeric migration (F4) | §13 F4, §21 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Migration risk; behind product decision (also in Blocked) |
| `getCreditCompliance` deprecation/removal in favor of matview-only | §6, §22 | `[DO NOT OVERBUILD]` (consolidation only, not now) | FIX-006 points FE at the matview path; full removal of the second endpoint is a follow-up cleanup, not required for V1 trust |
| `adjusted_by/adjustment_reason` dedicated columns (PRD wants columns; impl uses `attestation` jsonb) | §4, §15 | `V2 DEFERRED` | P3; current attestation trail is acceptable and immutable |
| `creditIssue` background-job pipeline consolidation | §6 | `[DO NOT OVERBUILD]` | Keep + clarify single award pipeline (covered by FIX-004 cycle service); no structural rewrite |
| Stale `credits-flow.hurl` header refresh + deepen assertions | §12, §22 | `V2 DEFERRED` (P3 hygiene) | Docs/test hygiene; low priority, can ride along when contract tests are next touched |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Expand courses/quizzes LMS surface | §6, §9, §23 | Already beyond m09 scope (m09 treats "Online Course/Webinar" as a training *type*, not a separate LMS); stabilize trainings first `[DO NOT OVERBUILD]` |
| Per-member credit variation / custom training types | §23 | Explicitly forbidden by M9-R1/R2 |
| New standalone attendance microservice / generic event-sourcing for credits | §23 | A table/columns + one award pipeline suffices `[DO NOT OVERBUILD]` |
| Relocating credits schema/repo out of `association:member/repos/` during this fix | §16, §21, §26 | Collides with deferred P1-11 mega-module split; fix in place |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Two real defects: UI never sends enrollee id (`attendance.tsx` uses a local `useState` Set) AND `checkInCustomTraining` writes nothing; the actual credit-awarding op (`completeTrainingEnrollment`) is unwired. Fix the data flow, not a UI patch. |
| FIX-002 | Root cause | Bare `catch {}` is the root cause of silent loss; replace with logged/audited failure + non-zero signal. |
| FIX-003 | Root cause | Member-reachable terminal self-complete + mis-scoped event are the root causes; gate the transition and rename the event rather than patching consumers. |
| FIX-004 | Root cause | Three divergent cycle computations are the root cause of wrong compliance windows; extract one `resolveCycle(orgId, activityDate)` over `org_cpd_config`. Decide on backfill of existing rows. |
| FIX-005 | Root cause | Aggregate reads lack a `status` filter at the repo layer; fix at the repo (`sumCreditsByOrg`) and matview, not per-caller. |
| FIX-006 | Root cause | Four sources of truth; collapse to `org_cpd_config` server-side and remove client-supplied params. The transcript trust issue is a direct security/integrity root cause. |
| FIX-007 | Root cause | `type` advertised in spec/validator/FE but never persisted; add the column + persist (root), not remove the spec (the gap notes removal is the alternative only if a product decision rejects the taxonomy). |
| FIX-008 | Root cause | `updateTraining` has no lock/status guard; add the guard at the handler. |
| FIX-009 | Root cause | Toggle util exists but is not consulted at award; add the read at the award path. |
| FIX-010 | Root cause | No unique constraint + no pre-check; add both. |
| FIX-011 | Symptom (UI predicate) | `isCompleted = status === 'enrolled'` is a frontend logic bug; correct the predicate. Low risk. |
| FIX-012 | Root cause (missing feature) | No export exists; add client-side CSV from the standings already loaded. |
| FIX-013 | Root cause | `body.organizationId || orgId` allows override; bind to ctx org. `[NEEDS CONFIRMATION]` whether validator already strips it — verify, then fix if confirmed reachable. |
| FIX-014 | N/A (test hardening) | Regression net + RBAC proofs; ensures Batches A–C don't regress and surfaces fake-green specs. |

## 13. Recommended First Fix Batch

- **Batch name:** Batch A — P0 core credit-award journey + correctness bugs on the same path
- **Included Fix IDs:** FIX-001 (G1 attendance→credit wiring, both halves), FIX-002 (G8 silent credit failure), FIX-003 (G6 lifecycle self-service)
- **Why this batch comes first:** This is the platform's core stated value ("track CE credits") and it is fully broken end-to-end (P0). FIX-002 and FIX-003 sit on the exact same credit-award path and would either silently undermine the FIX-001 fix (a swallowed insert) or let a member permanently block it (self-complete). Fixing them together yields one trustworthy journey rather than a fix that looks done but still loses credits. Everything in Batch B (cycle authority, void exclusion, required-credits source) needs real credit rows to assert against, so it depends on Batch A producing them.
- **Tests to write first (failing, before implementation):**
  1. E2E: officer checks in member X → member X's `/my/credits` shows an AUTO CreditEntry, persisted across reload (extend `apps/memberry/tests/e2e/officer/training-completion.spec.ts` — but FIRST run + inspect it and `member/training-completion-flow.spec.ts` to confirm they are not fake-green asserting only local UI state).
  2. Backend: `checkInCustomTraining` persists attendance (confirmedBy/At) and is idempotent per member (`check-in.test.ts`).
  3. Backend: credit-insert failure is logged + surfaced, not swallowed (`training-enrollment.test.ts` failure-path case).
  4. Backend: member self-complete then officer complete → credit still awarded OR self-complete returns 403 (`training-lifecycle.test.ts`).
  5. Backend: `cancelCustomTraining` emits an enrollment-scoped event, not `training.cancelled`.
- **Explicit out-of-scope for Batch A:** cycle-authority refactor (FIX-004), aggregate filters (FIX-005), required-credits consolidation (FIX-006), `type` column + credit lock (FIX-007/FIX-008), toggle (FIX-009), duplicate-enroll guard (FIX-010), `/my/training` predicate (FIX-011), CSV (FIX-012), createTraining org strip (FIX-013); all paid-training work (G5); all product-decision items; all §10 Deferred and §11 Do-Not-Build items. Do NOT relocate credits schema/repo. Do NOT regenerate TypeSpec beyond what FIX-001's check-in body change strictly requires.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Training & Credits
- **Exact module slug:** `training-credits`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/training-credits-fix-ready-plan.md`
- **Exact batch to execute first:** Batch A (FIX-001, FIX-002, FIX-003) — the P0 credit-award journey plus the silent-failure and lifecycle bugs on the same path.
- **Tests to prioritize (write failing first):** (1) E2E officer-checks-in-member → member gains persisted AUTO credit across reload — but FIRST run/inspect `apps/memberry/tests/e2e/officer/training-completion.spec.ts` and `member/training-completion-flow.spec.ts` to rule out fake-green; (2) backend `checkInCustomTraining` persists + idempotent per member; (3) backend credit-insert failure logged/surfaced; (4) backend self-complete-then-officer-complete still awards (or 403); (5) backend `cancelCustomTraining` emits enrollment-scoped event. Extend `services/api-ts/src/handlers/association:operations/{training-enrollment,check-in,training-lifecycle}.test.ts`; do not reorganize the hybrid `member/credits/credits.test.ts`.
- **Files likely to touch:** `services/api-ts/src/handlers/association:operations/{checkInCustomTraining,completeTrainingEnrollment,completeCustomTraining,cancelCustomTraining}.ts`; `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance.tsx`; possibly `specs/api/src/association/operations/training.tsp` (check-in body enrollee id) → then run `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`. Do NOT hand-edit `services/api-ts/src/generated/**`.
- **Shared/database cautions:** Credits schema/repo live in `association:member/repos/` and feed three handler dirs — **fix in place, never relocate** (collides with deferred P1-11 mega-module split). FIX-003's event rename has cross-module consumers in `core/domain-event-consumers.ts` and certificates (EM-M11) — coordinate the new event name `[CROSS-MODULE RISK]`. No DB migration in Batch A (the `type` migration is Batch C; the enrollment unique index is Batch D). Restart the API server after any new route registration.
- **Items NOT to implement (this pass):** anything outside Batch A — specifically G5 paid trainings (blocked on product decision), fractional credits, manual-entry pending policy, 45-vs-60 default, self-complete existence decision (all `[NEEDS PRODUCT DECISION]`), and all §10 Deferred (enrollment modes, waitlist, network approval, LMS expansion, multi-session/cosmetic fields, prorated flagging, `getCreditCompliance` removal, dedicated adjustment columns) and §11 Do-Not-Build items. Do not promote any V2 item into V1. Do not perform the mega-module split or relocate any credits file.

---

Next recommended step:
Module/group: Training & Credits
Module slug: training-credits
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/training-credits-fix-ready-plan.md
Recommended batch: Batch A — P0 core credit-award journey + correctness bugs on the same path
