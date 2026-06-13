# AHA Module/Group Fix Report: Surveys & Polls

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Surveys & Polls |
| Module slug | surveys-polls |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/surveys-polls-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/surveys-polls-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/surveys-polls-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — read-authorization subset only (FIX-001, FIX-002), with FIX-010/FIX-011 RED tests written first for these two fixes |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked at Step 0; TDD discipline followed RED→GREEN) |
| Working tree status checked | Yes (`git status --short` run first; prior AHA changes from 13 earlier modules preserved, nothing reset/checked-out) |
| Fix scope | P1 / V1 REQUIRED (the two confirmed confidentiality read-leaks) |
| Out of scope | Rest of the publish→respond loop (FIX-003/004/005 targeting/discovery/publish-notify), FIX-006 M18-R2 platform-admin exclusion (PD-2), Batch C (FIX-007/008/009), Batch F (targetAudience normalization + person-deletion FK cascade), all §10 Deferred and §11 Do-Not-Build items |
| Shared files touched | No |
| Schema/migration touched | No |
| Limitations | Module-local handler-unit/RBAC tests only (Bun + `make-ctx` stubs). No live DB/runtime RBAC verification. No browser/Playwright E2E (member-facing loop is out of scope this pass and was flagged `[BLOCKED BY ENVIRONMENT]` in the plan). Whole-repo suite intentionally not run per the focused-validation instruction. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Officer-gate `getSurvey` so members cannot read draft surveys + internal `targetAudience`/settings | P1 | V1 REQUIRED | A | Confirmed read-leak: handler had only auth + org-scope, no role gate. Pure module-local RBAC, smallest blast radius, no cross-module data or product decision needed. | Fixed |
| FIX-002 | Officer-gate `listSurveys` non-`mine` path so members cannot list org surveys (incl. `?status=draft`); restrict members to `mine=true` view | P1 | V1 REQUIRED | A | Same draft/config exposure as FIX-001 for the list view; the non-`mine` path returns ALL org surveys with internal settings. | Fixed |
| FIX-010 (subset) | Add RBAC regression tests for the two read-auth gates (member-draft-read-denied; non-`mine` list denied; `mine=true` allowed; officer/admin allowed) | P1 (test gap) | V1 REQUIRED | D (written first as part of Batch A) | These RED tests did not exist; they are the safety net proving FIX-001/002 and guarding against regression. | Fixed (for the FIX-001/002 subset) |
| FIX-011 | Relabel mislabeled "M18-R5" test + add real targeting assertion | P3→D | V1 RECOMMENDED | D | Pairs with FIX-003 (targeting), which is OUT of scope this pass. | Not Fixed (out of scope — belongs to the FIX-003 targeting subset, deferred) |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/handlers/surveys/getSurvey.test.ts src/handlers/surveys/listSurveys.test.ts` (after adding new RED RBAC cases, before handler fix) | 13 pass, **4 fail** | FIX-001, FIX-002 | The 4 new RBAC cases failed exactly as expected: `getSurvey` non-officer-reads-draft and non-officer-reads-any both "resolved" (read leaked, no Forbidden); `listSurveys` non-officer-lists-all and non-officer-lists-drafts both "resolved" (list leaked). This is the documented read-leak today. |
| Pre-existing handler behavior — `getSurvey.ts` | Only `session` + org-scope check; no officer/admin gate (`getSurvey.ts:18-40`) | FIX-001 | Confirmed root cause: TypeSpec marks the op `x-security-required-roles: ["user"]`, and the generator does NOT emit role/officer middleware from that extension (verified: 0 occurrences of `x-security-required-roles` in `generated/openapi/routes.ts`; officer enforcement is emitted only from `x-require-officer`, which this op lacks). |
| Pre-existing handler behavior — `listSurveys.ts` | No role gate on the non-`mine` path (`listSurveys.ts:50-58`); `mine=true` is the only member-safe view | FIX-002 | Same root cause as FIX-001. |
| Sibling reference pattern | `publishSurvey.ts:38-44` and `listSurveyResponses.ts:39-45` already implement the `hasRole(admin) \|\| active-officer-term` gate | FIX-001/002 | Fix matches this established "any active officer term" gate, per plan §14 (do not tighten to specific titles — PD-5 unresolved). |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Added officer/admin read gate to `getSurvey`: `if (!hasRole(session.user,'admin')) { terms = OfficerTermRepository.findActiveByPersonAndOrg(userId, orgId); if (terms.length===0) throw ForbiddenError('Only officers or admins can view survey details') }`. Imported `ForbiddenError`, `OfficerTermRepository`, `hasRole`. | `services/api-ts/src/handlers/surveys/getSurvey.ts` | No (consumes existing `OfficerTermRepository` from `association:member/repos/governance.repo`, already used by sibling survey handlers) | `[CROSS-MODULE RISK]` is minimal — the import was already a wired dependency of `publishSurvey.ts`/`listSurveyResponses.ts`; no new coupling introduced. |
| FIX-002 | Added the same officer/admin gate to `listSurveys`, placed AFTER the `query.mine` branch returns, so `mine=true` stays open to members and only the all-org (non-`mine`) listing is gated. Imported `ForbiddenError`, `OfficerTermRepository`, `hasRole`. | `services/api-ts/src/handlers/surveys/listSurveys.ts` | No (same existing dependency) | Member `mine=true` assigned view intentionally preserved (the only member-safe survey-list path). |

No TypeSpec change was required: `x-security-required-roles` is documentation-only in this generator (does not emit enforcement middleware), so the correct, minimal, sibling-consistent fix is the in-handler gate. No regeneration of routes/validators/openapi was needed. No schema, no `core/domain-event-consumers.ts`, no shared file touched.

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/surveys/getSurvey.test.ts` | permission/RBAC + regression | Non-officer member reading a **draft** survey → ForbiddenError; non-officer member reading **any** survey → ForbiddenError; officer with active term → 200 (can read draft); admin → 200. Existing 404 cases updated to use an authorized (admin) user so they still exercise the not-found/org-scope branch. | FIX-001, FIX-010 |
| `services/api-ts/src/handlers/surveys/listSurveys.test.ts` | permission/RBAC + regression | Non-officer member listing all surveys (non-`mine`) → ForbiddenError; non-officer member listing `?status=draft` (non-`mine`) → ForbiddenError; member with `mine=true` → 200 (assigned view, no officer gate); officer with active term → 200; admin happy/empty/filter paths → 200. Existing officer-path tests updated to use an authorized user. | FIX-002, FIX-010 |

No new test files were created (extended existing per plan §5). No Playwright/E2E added (out of scope this pass). FIX-011 relabel NOT performed — it pairs with the FIX-003 targeting fix, which is out of scope; touching `submitSurveyResponse.test.ts` now would be a change without its corresponding code fix.

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/surveys/getSurvey.test.ts src/handlers/surveys/listSurveys.test.ts` (RED, after tests added / before handler fix) | Partially Passed (13 pass, 4 fail) | Intentional RED — the 4 new RBAC cases failed, proving the read-leak exists today. |
| `bun test src/handlers/surveys/getSurvey.test.ts src/handlers/surveys/listSurveys.test.ts` (GREEN, after handler fix) | Passed (17 pass, 0 fail, 33 expect calls) | All RBAC cases now pass; member `mine=true` still allowed; officer/admin still allowed. |
| `bun test src/handlers/surveys/` (full module suite) | Passed (126 pass, 0 fail, 239 expect calls, 15 files) | No regressions across the surveys module. |
| `bun run typecheck` (`tsc --noEmit`, api-ts workspace) | Passed (exit 0, no errors) | Type-safe; imports resolve. |

Whole-repo suite was intentionally NOT run (focused-validation instruction). Marked "Not Run" for the repo-wide suite.

## 7. Validation Summary

- **Passed:** RED→GREEN cycle on the two target handlers (17/17). Full surveys module suite (126/126). api-ts typecheck (exit 0).
- **Failed:** Nothing remaining. The only failures observed were the intentional RED baseline failures, which are now GREEN.
- **Not run:** Whole-repo test suite (per focused-validation instruction); frontend tests; Playwright/E2E.
- **Remains blocked:** Nothing in this batch. Out-of-scope loop work (FIX-003/004/005/006 + Batch F) remains blocked on product decisions PD-2/PD-3 and Batch F schema/cascade verification.
- **Pre-existing/unrelated:** No pre-existing failures were touched. The working tree's 13-module prior AHA changes were preserved; no unrelated file was modified.

## 8. Shared / Cross-Module / Database Impact

No shared/platform/database files were touched. The only cross-module reference is the **read** of `OfficerTermRepository.findActiveByPersonAndOrg`, which was already an established dependency of sibling survey handlers (`publishSurvey.ts`, `listSurveyResponses.ts`) — no new coupling, no schema change, no migration, no domain-event-consumer change.

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Cross-module read (existing) | `OfficerTermRepository.findActiveByPersonAndOrg` (`handlers/association:member/repos/governance.repo`) | Survey read paths (`getSurvey`, `listSurveys` non-`mine`) now join the same officer-gate consumers already used by `publishSurvey`/`listSurveyResponses` | Covered by new RBAC cases (officer-allowed / member-denied) in both `*.test.ts` files | `[CROSS-MODULE RISK]` low — read-only, pre-wired dependency, governance refactor would already affect the sibling handlers identically. |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Targeting enforcement on read/submit | FIX-003 | Out of scope this pass; depends on M05 membership read path + Batch F `targetAudience` union normalization | Verify Batch F, then run a follow-up `04` pass for the FIX-003 subset |
| Member discovery of published surveys | FIX-004 | Out of scope; blocked by PD-3 (pending-rows vs active+targeted query design decision) | Resolve PD-3, then implement |
| Publish notification fan-out | FIX-005 | Out of scope; coupled to FIX-003/004 | Implement with FIX-003/004 in the same follow-up pass |
| M18-R2 platform-admin exclusion | FIX-006 | Out of scope; blocked by PD-2 (`admin` = platform-admin vs org-admin role semantics) | Resolve PD-2, then run Batch B |
| FIX-007/008/009 (anon `null`, auto-close, scoped delete) | Batch C | Out of scope this pass | Run Batch C `04` pass later |
| FIX-011 relabel of mislabeled "M18-R5" test | FIX-011 | Pairs with FIX-003 (targeting), which is out of scope; relabeling without the code fix would be a no-value change | Do during the FIX-003 subset pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-006 platform-admin exclusion | `[NEEDS PRODUCT DECISION]` (PD-2) | `admin` role meaning ambiguous; guessing risks locking out legitimate org-admins or leaving platform-admin deanonymization | Resolve PD-2 |
| FIX-004 discovery design | `[NEEDS PRODUCT DECISION]` (PD-3) | Two valid designs change the fix shape | Resolve PD-3 |
| FIX-003 targeting (full) | `[CROSS-MODULE RISK]` + database/schema | Needs M05 audience read path AND `targetAudience` union normalization (Batch F) | Identify M05 read path; complete Batch F |
| Person-deletion cascade vs survey FK `restrict` | `[CROSS-MODULE RISK]` (PD-8) | Cannot assert cascade behavior without verifying the consumer | Verify `core/domain-event-consumers.ts` (Batch F) |
| Member-facing E2E confirmation of the loop | `[BLOCKED BY ENVIRONMENT]` | Browser tooling out of scope for this batch | Optional Playwright pass when the loop subset lands |
| Gate breadth (any officer term vs specific titles) | `[NEEDS PRODUCT DECISION]` (PD-5) | Spec restricts to president/VP/secretary; impl allows any active officer term | Confirmed-deferred: matched the existing sibling "any active officer term" gate to avoid a regression/inconsistency until PD-5 is decided |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Publish-deadline gate | `[NEEDS PRODUCT DECISION]` (PD-4) | NPS/open-ended surveys are intentionally deadline-less |
| m18 spec/route reconciliation (`/org/:id/surveys` + `/polls`, error-code taxonomy) | `[NEEDS PRODUCT DECISION]` (PD-1) | Doc-only reconciliation, not a code fix |
| Structured error codes M18-001..006 | V2 DEFERRED | Platform-wide error-taxonomy rollout |
| Audit logging for identified response views/exports | V2 DEFERRED | Add when platform audit extension standardizes for read/export |
| Observability metrics | V2 DEFERRED | Add when platform observability standardizes |
| Word-cloud free-text visualization | V2 DEFERRED | Text-list aggregation suffices for V1 |
| Skip-logic / conditional branching renderer | `[DO NOT OVERBUILD]` / DO NOT ADD | Spec §1 explicitly out-of-scope |
| Survey templates marketplace; external distribution; NPS-engine expansion | DO NOT ADD | Spec §1 out-of-scope |
| Remodel `/surveys` routes | `[DO NOT OVERBUILD]` | Shipped platform convention; spec-reconciliation/doc decision (PD-1), not a code fix |
| TypeSpec `x-security-required-roles` change for `getSurvey`/`listSurveys` | `[DO NOT OVERBUILD]` | Generator does not enforce that extension (verified); the in-handler sibling-consistent gate is the correct minimal fix — changing TypeSpec + regenerating would add churn with no enforcement benefit |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/surveys/getSurvey.ts` | Added officer/admin read gate (`hasRole(admin)` short-circuit, else active-officer-term lookup → `ForbiddenError`); +3 imports (`ForbiddenError`, `OfficerTermRepository`, `hasRole`); doc comment. | FIX-001 |
| `services/api-ts/src/handlers/surveys/listSurveys.ts` | Added the same officer/admin gate on the non-`mine` path (placed after the `mine` branch returns); +3 imports; doc comment. | FIX-002 |
| `services/api-ts/src/handlers/surveys/getSurvey.test.ts` | Added RBAC cases (member-draft-denied, member-any-denied, officer-allowed, admin-allowed); updated 404 cases to use an authorized user; +`OfficerTermRepository` import + `restoreRepo`. | FIX-001, FIX-010 |
| `services/api-ts/src/handlers/surveys/listSurveys.test.ts` | Added RBAC cases (non-`mine` member-denied, draft-list member-denied, `mine=true` member-allowed, officer-allowed); switched existing officer-path happy/empty/filter tests to an authorized user; +`OfficerTermRepository` import + `restoreRepo`. | FIX-002, FIX-010 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline (13 pass / 4 fail) — new RBAC cases failed, proving the read-leak | Recorded in §3 and §6 of this report (test-output notes) | FIX-001, FIX-002 |
| GREEN (17 pass / 0 fail) after handler fix | Recorded in §6 | FIX-001, FIX-002 |
| Full surveys module suite (126 pass / 0 fail, 15 files) | Recorded in §6 | FIX-001, FIX-002, FIX-010 |
| Typecheck (`tsc --noEmit`, exit 0) | Recorded in §6 | FIX-001, FIX-002 |
| Scope proof: `git diff --stat` shows only the 4 surveys files changed (no shared/schema/TypeSpec/generated files) | Recorded in §1, §4, §8 | FIX-001, FIX-002 |

No screenshot/Playwright/Webwright evidence — browser-level proof was out of scope for this read-auth subset.

## 14. Completion Decision

`COMPLETE`

The selected batch — the **read-authorization subset of Batch A (FIX-001, FIX-002), with FIX-010/FIX-011 RED tests written first** — was fully implemented test-first and validated. RED proved the confidentiality read-leak existed; the minimal, sibling-consistent in-handler officer/admin gate closed it; GREEN confirmed the fix with member `mine=true` access preserved; the full surveys module suite (126/126) and api-ts typecheck both pass. No shared, schema, or out-of-scope code was touched. The remaining publish→respond loop work (FIX-003/004/005/006, Batch C, Batch F) was correctly left out of scope per the gates in the fix-ready plan §4/§13.

## 15. Recommended Next Step

Resolve the product decisions and verify the schema dependency that gate the rest of the loop, then run the next `04` pass for the targeting/discovery/notify subset. Concretely:

1. Request product decisions **PD-3** (member-discovery design: pending-rows vs active+targeted query) and **PD-2** (`admin` role semantics for M18-R2).
2. Run **`06-database-schema-audit.md`** OR a focused Batch F verification of `targetAudience` union normalization + person-deletion FK `restrict` vs `core/domain-event-consumers.ts` — this gates FIX-003.
3. Then run another **`04-module-or-group-fix-tdd.md`** pass:
   - Module/group: Surveys & Polls
   - Module slug: `surveys-polls`
   - Fix-ready plan: `docs/aha/module-fix-plans/surveys-polls-fix-ready-plan.md`
   - Next batch: Batch A remaining subset (FIX-003 targeting, FIX-004 discovery, FIX-005 publish-notify, + FIX-011 relabel) once PD-3 + Batch F land; then Batch B (FIX-006) once PD-2 lands; Batch C (FIX-007/008/009) independently.

Do not proceed to another batch or module in this pass.

---

## Addendum — Batch F (cascade half): person-deletion → survey-response anonymization

> Added in a later `04` pass. Closes the **privacy/cascade** half of Batch F.
> The `targetAudience` union-normalization half of Batch F (which gates FIX-003)
> remains **deferred** — it is PD-3-gated and may need a migration.

**Defect (consolidated roadmap order 3, P1 / V1 REQUIRED):** `survey_response.responder_id`
is `uuid('responder_id').references(persons.id, { onDelete: 'restrict' })`, and
`core/domain-event-consumers.ts` had **no `person.deleted` subscriber for surveys**
(confirmed: subscribers existed for 8 other module owners, zero for surveys).
Consequence: identified survey responses retained the deleted member's `responder_id`
(de-anonymization / BR-32 violation), and the `restrict` FK could block the person
hard-delete entirely.

**Fix (TDD, smallest correct change, sibling-consistent):** added one
fire-and-forget `domainEvents.on('person.deleted', …)` subscriber that anonymizes
the member's identified responses — `UPDATE survey_response SET responder_id = NULL,
updated_by = SYSTEM_USER_ID WHERE responder_id = :personId`. Answers are **retained**
for aggregate integrity (the BR-32 "preserve aggregate, scrub the PII link" pattern
already used by the dues-payments and billing subscribers). The FK stays
`onDelete: 'restrict'` as defense-in-depth (forces the cleanup to run). `responder_id`
is nullable, so **no migration** was required.

**RED → GREEN:**
- RED: new test `person.deleted → surveys — anonymizes survey responses (NULL responder_id, BR-32)`
  in `core/domain-event-consumers.test.ts` failed (no subscriber → no `update(surveyResponses)` call).
- GREEN: after adding the subscriber, the consumers suite passes **18/18**.
- Full api-ts suite: **5855 pass / 93 skip / 3 todo / 1 fail**; the single fail is the
  pre-existing, unrelated `registerEmailJobs > registers email.processor as interval job`.
  `tsc --noEmit`: **0 errors**.

**Files changed:**
- `services/api-ts/src/core/domain-event-consumers.ts` — import `surveyResponses`; add the surveys `person.deleted` subscriber.
- `services/api-ts/src/core/domain-event-consumers.test.ts` — import `surveyResponses`; add the anonymization test.

**Still deferred (unchanged):** `targetAudience` union normalization (Batch F other half, PD-3-gated, possible migration); FIX-003/004/005 (PD-3), FIX-006 (PD-2), Batch C (FIX-007/008/009).

---

## Batch C Addendum — P2 V1-completeness (2026-06-11)

Executed the full roadmap §8 order-10 decision-free Batch C trio: **FIX-007** (anonymous responderId → null), **FIX-008** (auto-close surveys at deadline), **FIX-009** (org-scope deleteMemberResponses). Targeting (FIX-003/004) stays PD-3-gated, untouched.

### Batch executed

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-007 | `listSurveyResponses` returned a zeros-UUID sentinel for anonymous responses — a client could treat it as a real person id (TypeSpec expects nullable `responderId?`) | P2 | Fixed |
| FIX-008 | No lifecycle transition at deadline — the expiry cron only skipped pending *responses*; surveys showed "active" past their deadline | P2 | Fixed |
| FIX-009 | `deleteMemberResponses` deleted ALL responses by `responderId` across every org with no scoping — silent cross-org over-deletion | P2 | Fixed |

### TDD evidence (RED → GREEN)

- FIX-007: rewrote the BR-40 test to expect `null` (not `ANONYMOUS_UUID`) — RED returned the sentinel, now returns `null`.
- FIX-008: `survey.expirePending auto-closes active surveys whose deadline has passed` — RED `closed` was `[]` (no auto-close existed), now `['past']` (future + no-deadline surveys untouched).
- FIX-009: `deletes only the caller responses scoped to the current org` — RED the org-scoped repo method was never called; `requires org context — no unscoped cross-org wipe` — RED threw the wrong error (raw `db.delete`), now throws `ValidationError(/Organization context/)`.

### Changes made

| File | Change | Fix ID |
| --- | --- | --- |
| `handlers/surveys/listSurveyResponses.ts` | Map anonymous responses to `responderId: null`; removed the `ANONYMOUS_UUID` sentinel const + updated doc comment | FIX-007 |
| `handlers/surveys/repos/survey.repo.ts` | Added `SurveyRepository.closeExpiredSurvey(id)` (system close — flips active→closed, leaves `updatedBy` untouched to avoid the person FK) and `SurveyResponseRepository.deleteByResponderAndOrg(responderId, orgId)` | FIX-008, FIX-009 |
| `handlers/surveys/jobs/index.ts` | `survey.expirePending` cron now also fetches active surveys, filters those past `settings.deadline`, and calls `closeExpiredSurvey` for each | FIX-008 |
| `handlers/surveys/deleteMemberResponses.ts` | Require org context (`ValidationError` if absent); delete via `deleteByResponderAndOrg(userId, organizationId)` instead of the unscoped raw `db.delete` | FIX-009 |
| `handlers/surveys/listSurveyResponses.test.ts` | BR-40 test now asserts `null` | FIX-007 |
| `handlers/surveys/jobs/index.test.ts` | +auto-close test (past/future/no-deadline) | FIX-008 |
| `handlers/surveys/deleteMemberResponses.test.ts` (new) | 3 tests: unauth, org-scoped delete, org-required guard | FIX-009 |

### Design notes

- **FIX-008:** auto-close folded into the existing daily `survey.expirePending` cron (related expiry concern) rather than a new cron — keeps the cron count stable (the `registers four cron jobs` test stays green). `closeExpiredSurvey` deliberately omits `updatedBy` because the cron has no person actor and the column FKs to person.
- **FIX-009:** anonymized rows (responderId nulled by the existing `person.deleted` cascade — surveys Batch F half) are naturally excluded because they no longer match the caller's id; documented in the handler + repo. Org context is required rather than defaulting to an unscoped wipe.

### Validation

- Full surveys handler suite: **130 pass / 0 fail** (incl. new/changed tests).
- API typecheck: 0 errors.

### Completion decision — Batch C

**COMPLETE** for FIX-007/008/009. All implemented test-first (RED confirmed for the right reason, then GREEN), minimal correct changes, no weakened assertions, full-suite + typecheck clean. Targeting (FIX-003/004) remains PD-3-gated and untouched.
