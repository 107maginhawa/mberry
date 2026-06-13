# AHA Fix-Ready Plan: Surveys & Polls

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Surveys & Polls |
| Module slug | surveys-polls |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/surveys-polls-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/surveys-polls-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS (carried from gap plan §24) |
| Superpowers used | No (organizer reasoning sufficient via gap-plan + targeted code inspection of `getSurvey.ts`, `listSurveys.ts`, `listSurveyResponses.ts`, `publishSurvey.ts`, `survey.repo.ts`; `/using-superpowers` reserved for the 04 fix pass) |
| Organizer decision | PARTIALLY READY |
| Reason | The interlocking publish→respond loop (read-auth, targeting, discovery, publish-notify) is fully evidenced and fix-ready as a single batch. However, several fix *shapes* hinge on open product decisions (V1 intent = NPS-engine vs officer-survey tool; `admin` role semantics; discovery design; create-role breadth; publish-deadline requirement). The safe-to-implement subset is well-scoped; the decision-gated subset is isolated so 04 can proceed on the unblocked work without waiting. |
| Limitations | Static review only; no live DB/runtime RBAC verification (carried from gap plan). KG generated 2026-06-06, partially stale; direct code inspection used and re-confirmed for the four core handlers. No surveys E2E exists in `apps/memberry`/`apps/admin`. Cross-cutting and database-schema audits not yet run (not available as context). |

## 2. Fix Strategy Summary

**Fix first (Batch A — P1 publish→respond loop, the broken core workflow).** The module's officer authoring + results + BR-40 anonymity + deadline + re-edit + poll inline are implemented and well-tested (~109 backend cases). The materially broken slice is the *member-facing distribution loop*: members cannot discover officer-published surveys, no publish notification exists, targeting is collected but never enforced, and `getSurvey`/`listSurveys` leak draft surveys + internal targeting config to any member. These four gaps interlock and must be fixed together so the workflow is coherent; fixing one without the others leaves a half-working loop.

**Sequencing within Batch A.** Read-authorization gates (`getSurvey`, `listSurveys` non-`mine` path) are pure module-local RBAC fixes with confirmed evidence — do these first (lowest risk, immediately testable). Targeting enforcement + discovery-on-publish + publish-notification are coupled (targeting resolution and discovery both need M05 membership data and a chosen discovery design) and carry `[CROSS-MODULE RISK]`; they follow once the discovery design decision (PD-3) is settled. M18-R2 platform-admin exclusion is gated on the `admin` role-semantics decision (PD-2) — keep it in a clearly-flagged Batch B so 04 does not guess role meaning.

**What NOT to fix.** Do not expand the NPS engine, fatigue throttling, retention purge, post-training eval, dismiss, clone, or build the `skipLogic` branching renderer (spec out-of-scope). Do not remodel `/surveys` routes to the spec's `/org/:id/surveys` + `/polls` shape — that is a doc-sync / product-reconciliation question, not a code fix. Do not introduce the M18-001..006 error-code taxonomy now (defer to platform-wide rollout).

**Risks.** Targeting + member-discovery touch a cross-module read of M05 membership/chapter/committee data and depend on the `targetAudience` `string | TargetAudience` union being normalized; the FK `onDelete: restrict` on `responderId`/`createdBy` is a `[CROSS-MODULE RISK]` for person-deletion cascade that must be verified (not necessarily changed). These are isolated into a dependency-gated batch (F) and a cross-module note, not buried inside the RBAC batch.

**One pass or multiple.** Multiple batches. Batch A (read-auth subset) is safe to run now. The targeting/discovery/notify subset of A runs after PD-3 (discovery design) is decided. Batch B (M18-R2) runs after PD-2. Batches C/D are smaller V1-completeness + test-hardening passes. Batch F (schema/cascade verification) gates the targeting fix.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Officer-gate `getSurvey` (officer survey-detail read) so members cannot read draft surveys + internal `targetAudience`/settings; provide members a scoped respond-view path | P1 | V1 REQUIRED | A | Confidential drafts + targeting config exposed to all org members; undermines officer-only management | `getSurvey.ts:18-40` (only auth + org-scope, no role gate — confirmed); `surveys.tsp:461` `x-security-required-roles: ["user"]`; gap §5, §10, §14 |
| FIX-002 | Officer-gate `listSurveys` non-`mine` path so members cannot list org surveys incl. `?status=draft`; restrict member access to `mine=true` view | P1 | V1 REQUIRED | A | Same draft/config exposure as FIX-001 for the list view | `listSurveys.ts:50-58` (no role gate on non-`mine` path — confirmed); gap §5, §10, §14 |
| FIX-003 | Enforce M18-R5 targeting on member read + submit: resolve member tier/chapter/committee vs `settings.targetAudience`; 403 for non-targeted members | P1 | V1 REQUIRED | A | `targetAudience` is collected by the builder but never enforced — distribution controls are a no-op; results data integrity at risk | `submitSurveyResponse.ts` (no targeting branch); `survey-builder.tsx:180-194` collects targetAudience; gap §5, §10, §11, §14; depends on M05 query `[CROSS-MODULE RISK]` |
| FIX-004 | Member discovery of published surveys: on publish create `pending` response rows for targeted members OR change member-list query to return active+targeted surveys regardless of prior response row | P1 | V1 REQUIRED | A | `findMineWithPagination` inner-joins on existing response rows; officer-published surveys never surface in `/my/surveys` — primary WF-101 loop broken | `survey.repo.ts:95-136` (inner join on `surveyResponses` — confirmed); only `postTrainingEval` writes pending rows; gap §5, §8, §10, §11 — design choice gated by PD-3 |
| FIX-005 | Emit `SurveyPublished` notification to targeted members on publish (reuse `notifs` already wired in `registerSurveyJobs`) | P1 | V1 REQUIRED | A | Members get no signal a survey exists; compounds the discovery gap | `publishSurvey.ts:65-72` (publishes + returns, no event/notification — confirmed); gap §5, §10; spec §10b `SurveyPublished → M07` |
| FIX-006 | M18-R2 platform-admin exclusion: platform `admin` must not pass the officer gate to individual identified responses; admin → aggregate-only | P1 | V1 RECOMMENDED | B | `hasRole(user,'admin')` short-circuits the officer check, letting platform admin deanonymize identified surveys — privacy-contract (BR-40/M18-R2) violation | `listSurveyResponses.ts:39` (confirmed); also `getSurveyAnalytics`/`exportSurveyResponses` share the gate; gap §5, §10, §11, §14 — gated by PD-2 |
| FIX-007 | Return `null` (not zeros-UUID sentinel `00000000-…-0`) for anonymous responses in `listSurveyResponses` | P2 | V1 RECOMMENDED | C | Client may treat the sentinel as a real person id; TypeSpec expects nullable `responderId?` | `listSurveyResponses.ts:14,76-78` (confirmed `ANONYMOUS_UUID` sentinel mapped onto rows); gap §5, §10, §13 |
| FIX-008 | Auto-close survey at deadline (cron flips survey `status` → `closed`); today the job only skips pending *responses* | P2 | V1 RECOMMENDED | C | Survey lists/UX show "active" past deadline; only submit-time guard prevents new responses — misleading state | `jobs/index.ts` `survey.expirePending` skips responses, never flips survey status; gap §8, §10, §11, §13 |
| FIX-009 | Scope `deleteMemberResponses` to org (or require explicit confirmation); document anonymized-row exclusion | P2 | V1 RECOMMENDED | C | Currently deletes ALL responses by `responderId` across every org with no scoping/confirmation — silent over-deletion | `deleteMemberResponses.ts:30-33`; gap §5, §10, §14 |
| FIX-010 | Add RBAC + workflow regression tests for the publish→respond loop (member-draft-read-denied, non-`mine` list denied, non-targeted-submit-403, publish→target-member-list-appears + non-target-absent, publish-notification-created, platform-admin-403-on-responses) | P1 (test gap) | V1 REQUIRED | D | These RED tests do not exist today (`getSurvey.test.ts`/`listSurveys.test.ts` have no RBAC case) and are the safety net for FIX-001..006 | gap §19 (no RBAC test in `getSurvey.test.ts`/`listSurveys.test.ts`; `listSurveyResponses.test.ts` lacks platform-admin-block), §20, §26 `[TEST GAP]` |
| FIX-011 | Re-label the mislabeled `submitSurveyResponse.test.ts` "M18-R5" case (it tests not-active state, not targeting) and add the real targeting assertion | P3→folded into D | V1 RECOMMENDED | D | Prevents a false-green: the only "M18-R5"-named test does not exercise targeting | `submitSurveyResponse.test.ts:101` (gap §13); pairs with FIX-003/FIX-010 |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A | P1 publish→respond core-workflow loop (read-auth + targeting + discovery + publish-notify) | FIX-001, FIX-002, FIX-003, FIX-004, FIX-005 | Medium–High (FIX-003/004/005 cross-module; FIX-001/002 low) | Run read-auth subset (FIX-001, FIX-002) in current `04` pass now. Run FIX-003/004/005 after PD-3 (discovery design) is decided and Batch F (schema/cascade) is verified — same `04` pass if decisions land, else a follow-up pass. |
| B | P1 privacy / permission: M18-R2 platform-admin exclusion on identified individual responses | FIX-006 | Medium (touches shared officer/role gate; role-semantics ambiguous) | Requires product decision first (PD-2: does `admin` mean platform-admin or org-admin). Run after PD-2. |
| C | Selected P2 V1-completeness gaps | FIX-007, FIX-008, FIX-009 | Low–Medium | Run later, after Batch A read-auth subset lands. FIX-008 touches the jobs cron; FIX-009 is module-local data scoping. |
| D | Test hardening / regression coverage for the loop | FIX-010, FIX-011 | Low (tests only) | Write FIRST (RED) as part of the Batch A `04` pass — these tests gate and prove FIX-001..006. |
| E | Shared/platform dependency fix | (none — no shared/platform *file change* required; FIX-005 reuses existing wired `notifs`, FIX-003 reads existing M05 repos) | — | Not applicable as a standalone batch. Documented in §7 as consumed dependencies, not modifications. |
| F | Database/schema dependency: normalize `targetAudience` `string \| TargetAudience` union to enable targeting; verify person-deletion cascade vs FK `onDelete: restrict` on `responderId`/`createdBy` | (gates FIX-003; verification task, possible migration) | Medium (schema migration + cross-module cascade) | Run/verify BEFORE FIX-003. Normalization may need a migration; cascade is a *verification* of `core/domain-event-consumers.ts` (likely no change). Isolate from module-local batches. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Member (non-officer) `getSurvey` on a `draft` survey → denied (403/404) | permission/RBAC | Officer-only survey detail; member cannot read draft questions/settings/targetAudience | Extend `handlers/surveys/getSurvey.test.ts` (currently no RBAC case) |
| FIX-002 | Member `listSurveys?status=draft` (non-`mine`) → denied; member `mine=true` allowed | permission/RBAC | Officer-gate on non-`mine` list path; member restricted to assigned view | Extend `handlers/surveys/listSurveys.test.ts` (currently no RBAC case) |
| FIX-003 | Non-targeted member `submitSurveyResponse` → 403; targeted member → 200 | integration / domain workflow | M18-R5 targeting enforced at submit (and read) against tier/chapter/committee | Extend `handlers/surveys/submitSurveyResponse.test.ts` (add real targeting case; pairs with FIX-011 relabel) |
| FIX-004 | Publish targeted survey → appears in target member `mine` list, absent for non-target member | integration / domain workflow | Member discovery of officer-published surveys works for the targeted audience only | Extend `handlers/surveys/listSurveys.test.ts` + `publishSurvey.test.ts` (or new `handlers/surveys/publish-discovery.test.ts`) |
| FIX-005 | Publish targeted survey → notification created for each targeted member | integration | `SurveyPublished` notification fan-out reuses wired `notifs` | Extend `handlers/surveys/publishSurvey.test.ts`; assert against the notifs creation path |
| FIX-006 | Platform-admin (non-officer) `listSurveyResponses` on identified survey → 403; org-officer → 200 | permission/RBAC | Platform admin cannot deanonymize identified individual responses (M18-R2) | Extend `handlers/surveys/listSurveyResponses.test.ts` (currently no platform-admin-block case) |
| FIX-007 | Anonymous survey `listSurveyResponses` returns `responderId: null` (not zeros-UUID) | backend/unit | Anonymous rows carry `null`, matching TypeSpec `responderId?: UUID` | Extend `handlers/surveys/listSurveyResponses.test.ts` |
| FIX-008 | Advance time past deadline → survey `status` becomes `closed` in list/detail | backend/unit + job | Survey auto-closes at deadline; lists no longer show stale "active" | Extend `handlers/surveys/jobs/index.test.ts` (add auto-close case) + assert via `getSurvey`/`listSurveys` |
| FIX-009 | `deleteMemberResponses` deletes only the caller's org responses; anonymized rows untouched | backend/unit | Deletion is org-scoped; anonymized rows excluded; no silent cross-org wipe | New/extended `handlers/surveys/deleteMemberResponses.test.ts` (no test file exists today) |
| FIX-010 | (Aggregates the RBAC + workflow RED cases above into the suite as the safety net) | regression / permission/RBAC / domain workflow | The full broken-loop journeys are protected before code changes; prevents regressions | The `handlers/surveys/*.test.ts` files named per-fix above; reserve Playwright/E2E only if a member-facing browser journey is later deemed core (out of scope for this pass) |
| FIX-011 | Relabel `submitSurveyResponse.test.ts:101` "M18-R5" → not-active-state; add separate real M18-R5 targeting case | regression | The targeting requirement is actually exercised, not falsely green | Edit `handlers/surveys/submitSurveyResponse.test.ts` |

Notes: Prefer extending existing backend unit/integration tests (15 files already present). Do NOT add per-issue Playwright E2E; reserve browser-level proof for a single core publish→member-respond journey only if explicitly prioritized in 04 (gap §18 flagged it `[BLOCKED BY ENVIRONMENT]` for the batch run). Do not create or modify tests during this organize pass.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/handlers/surveys/getSurvey.ts`; `specs/api/src/modules/surveys.tsp` (`x-security-required-roles` for officer-detail); possibly a new member respond-view path | module-local (+ TypeSpec regen) | Survey detail consumers; regen routes/validators if TypeSpec changes |
| FIX-002 | `services/api-ts/src/handlers/surveys/listSurveys.ts`; possibly `surveys.tsp` | module-local (+ TypeSpec regen) | Survey list consumers (officer dashboard + `/my/surveys`) |
| FIX-003 | `services/api-ts/src/handlers/surveys/submitSurveyResponse.ts`; `getSurvey.ts`/member respond-view; M05 membership read (tier/chapter/committee) | cross-module (reads M05) | Submit + member-read paths; depends on membership query path |
| FIX-004 | `services/api-ts/src/handlers/surveys/publishSurvey.ts`; `repos/survey.repo.ts` (`findMineWithPagination` query OR a pending-row writer) | module-local (data flow), schema-adjacent | Member discovery list; if pending-rows approach, write path on publish |
| FIX-005 | `services/api-ts/src/handlers/surveys/publishSurvey.ts`; `handlers/surveys/jobs/index.ts` (notifs already imported there) | cross-module (consumes wired `notifs`) | Notification fan-out on publish; no notifs *service* change needed |
| FIX-006 | `services/api-ts/src/handlers/surveys/listSurveyResponses.ts` (+ `getSurveyAnalytics.ts`/`exportSurveyResponses.ts` share the gate); officer/role check helper | module-local (RBAC logic) | Individual-response + analytics + export endpoints |
| FIX-007 | `services/api-ts/src/handlers/surveys/listSurveyResponses.ts` (`ANONYMOUS_UUID` sentinel → `null`) | module-local | Response-list consumers; verify TypeSpec response type allows null |
| FIX-008 | `services/api-ts/src/handlers/surveys/jobs/index.ts` (add `survey.autoClose` or flip status in expiry job); `repos/survey.repo.ts` | module-local | Survey status lifecycle; cron registry |
| FIX-009 | `services/api-ts/src/handlers/surveys/deleteMemberResponses.ts`; `repos/survey.repo.ts` (scope by org) | module-local | Member right-to-deletion path |
| FIX-010 / FIX-011 | `services/api-ts/src/handlers/surveys/*.test.ts` (getSurvey, listSurveys, submitSurveyResponse, publishSurvey, listSurveyResponses, deleteMemberResponses) | module-local (tests) | Test suite only |
| Batch F | `services/api-ts/src/handlers/surveys/repos/survey.schema.ts` (`targetAudience` normalization, possible migration); verify `services/api-ts/src/core/domain-event-consumers.ts` (person-deletion cascade vs FK restrict) | database/schema + cross-module | Schema/migration blast radius if normalization needed; cascade verification likely read-only |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001/002/006/ (officer gates) | cross-module | `OfficerTermRepository.findActiveByPersonAndOrg` from `handlers/association:member/repos/governance.repo` | All officer gates read governance officer-term data; confirmed imported in `listSurveyResponses.ts:10`, `publishSurvey.ts:11` | No — already wired; ensure governance audit/refactor does not break this import |
| FIX-003 | cross-module + database/schema | M05 membership tier/chapter/committee read to resolve eligibility vs `settings.targetAudience` | Targeting enforcement cannot work without resolving the member's audience membership | Yes — need the M05 read path identified before implementing |
| FIX-003 | database/schema | `targetAudience` stored as `string \| TargetAudience` union (`survey.schema.ts:46-49`) | Legacy string rows must normalize to object form before reliable targeting checks | Yes (Batch F) — normalize/migrate first |
| FIX-004 | cross-module | M05 targeted-member set (if pending-rows-on-publish approach) | Need the targeted-member list to create pending rows or to query active+targeted | Yes if pending-rows design chosen (PD-3) |
| FIX-005 | shared/platform (consumed, not modified) | `notifs.createNotification` already wired in `handlers/surveys/jobs/index.ts` (`registerSurveyJobs`) | Publish notification reuses the already-wired notifs path; no notifs service change | No — consume existing wiring |
| FIX-005 | cross-module | M07 notification semantics (`SurveyPublished`) | Notification fan-out targets the same audience as FIX-003/004 | Coupled with FIX-003/004 |
| Batch F | database/schema + cross-module | Person FK `onDelete: restrict` on `createdBy`/`responderId` (`survey.schema.ts:109-110,127-128`) vs `core/domain-event-consumers.ts` | Person-deletion may be blocked by non-anon survey responses if no subscriber cleanup exists | Verify before relying on cascade; likely read-only check `[CROSS-MODULE RISK]` |
| FIX-001..003 | shared/platform | `x-org-id` / `orgContextMiddleware` (`app.ts` survey prefix) | All survey org scoping depends on this middleware; org context already available via `ctx.get('organizationId')` | No — already wired |
| FIX-003/postTrainingEval | cross-module | Training session completion (m09) event consumed by `postTrainingEval` | `postTrainingEval` is the de-facto pending-row writer today; generalizing assignment must not break the training path | Verify event contract is preserved `[CROSS-MODULE RISK]` |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| PD-1: Is the shipped NPS/feedback engine the intended V1, or is the officer-survey distribution tool (m18 spec) the V1? | `[NEEDS PRODUCT DECISION]` | FIX-003, FIX-004, FIX-005 (whole loop) | Determines whether the targeting/discovery/notify gaps are V1-blocking to fix as-is, or the spec should be amended to the shipped contract | Confirm V1 intent. Recommendation: treat the distribution loop as V1-required (gap §24 PARTIAL PASS rests on it) and fix; reconcile spec wording separately (doc-only) |
| PD-2: Does `hasRole(user,'admin')` mean platform-admin or org-admin in survey handlers? | `[NEEDS PRODUCT DECISION]` | FIX-006 | Drives the M18-R2 fix shape — platform admin must not deanonymize; org-admin may legitimately be an officer-equivalent | Resolve role semantics before Batch B; map platform-admin → aggregate-only |
| PD-3: For member discovery, create `pending` rows on publish for all targeted members, OR query active+targeted directly in the member list? | `[NEEDS PRODUCT DECISION]` | FIX-004 (and FIX-003 read path) | Two valid designs with different write/read costs; affects fix shape and Batch F scope | Eng decision. Recommendation: query active+targeted directly (avoids fan-out write amplification) unless reminders need per-member rows |
| PD-4: Is a deadline truly required at publish, given NPS/open-ended survey types? | `[NEEDS PRODUCT DECISION]` | (publish-deadline gate — deferred, see §10) | Determines whether a publish deadline-gate is a fix or the spec is amended for open-ended NPS | Product call. Deferred from active scope until decided (NPS surveys are intentionally open-ended) |
| PD-5: Can any active officer term create/manage surveys, or only president/VP/secretary per RBAC §3.27? | `[NEEDS PRODUCT DECISION]` | FIX-001, FIX-002 (gate breadth) | Current impl allows any officer term; spec restricts. Affects how tight the officer gate should be | Confirm breadth. Until decided, FIX-001/002 should match the existing "any active officer term" gate used by sibling handlers (consistent, not a regression) |
| PD-6: Who owns member NPS — surveys (m18) or reviews (M04)? | `[NEEDS PRODUCT DECISION]` | (none active — affects future consolidation) | Spec §1 says reviews owns NPS; code centers it on surveys (duplicate source of truth) | Product call; out of active fix scope (do not consolidate now) |
| PD-7: Is per-member dedup intended for anonymous surveys (unique index ineffective on null)? | `[NEEDS CONFIRMATION]` | (none active — schema note) | Anonymous surveys allow multiple submissions per member by design today | Confirm intended; document either way; no code change unless confirmed undesired |
| PD-8: Does person-deletion cascade handle non-anon survey responses (FK `restrict`)? | `[NEEDS CONFIRMATION]` | Batch F | Could block person deletion if no subscriber cleans up survey responses | Verify `core/domain-event-consumers.ts` covers survey responses |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-003 targeting enforcement (full) | `[CROSS-MODULE RISK]` + database/schema | Needs M05 membership audience read path AND `targetAudience` union normalization | Identify M05 read path; complete Batch F normalization |
| FIX-004 discovery design | `[NEEDS PRODUCT DECISION]` (PD-3) | Two valid designs (pending-rows vs active+targeted query) change the fix shape | Resolve PD-3 |
| FIX-006 platform-admin exclusion | `[NEEDS PRODUCT DECISION]` (PD-2) | `admin` role meaning is ambiguous; fixing without it risks locking out legitimate org-admins or leaving platform-admin deanonymization | Resolve PD-2 |
| Person-deletion cascade vs survey FK `restrict` | `[CROSS-MODULE RISK]` (PD-8) | Cannot safely assert cascade behavior without verifying the consumer | Verify `core/domain-event-consumers.ts` (Batch F) |
| Member-facing E2E confirmation of the loop | `[BLOCKED BY ENVIRONMENT]` | Batch run skipped browser tooling; runtime confirmation recommended but not required to ship backend fixes | Optional Playwright pass during 04 if a core journey is prioritized; backend integration tests are the primary gate |

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Require deadline at publish | §5, §10, §22 | `[NEEDS PRODUCT DECISION]` (PD-4) | NPS/open-ended survey types are intentionally deadline-less; gating publish on a deadline may be wrong for the shipped engine — decide PD-4 first |
| Sync m18 spec/API_CONTRACTS to shipped NPS-engine contract (types, routes, error codes, `/polls`) | §5, §17, §22 | `[NEEDS PRODUCT DECISION]` (PD-1) | Doc-only reconciliation, not a code fix; depends on V1-intent decision |
| Structured error codes M18-001..006 mapping | §5, §22, §23 | V2 DEFERRED | Cosmetic vs platform error-taxonomy rollout; tests assert error classes today |
| Audit logging (`x-audit`) for identified individual-response views/exports | §15, §22 | V2 DEFERRED | Privacy-sensitive access logging; add when platform audit extension standardizes for read/export |
| Observability metrics (counters/gauges per spec §17) | §15 | V2 DEFERRED | Add when platform observability standardizes |
| Word-cloud free-text visualization | §23 | V2 DEFERRED | Text-list aggregation suffices for V1 |
| Generalize manual/category targeting builder UX beyond core enforcement | §23 | V2 DEFERRED | Core fix (FIX-003) enforces targeting; advanced builder UX can follow |
| Remove or register dead `survey.aggregateAnalytics` trigger | §12, §22 | `[DO NOT OVERBUILD]` | Dead-coded by design (try/catch swallows; analytics computed on read); cleanup only, no workflow impact — optionally fold into Batch C as low-priority |
| `archived` 4th status reconciliation | §6, §12 | `[NEEDS CONFIRMATION]` | Document or drop the extra state; no transition path sets it; not workflow-blocking |
| Reminders-before-deadline expansion | §9 | V2 DEFERRED | Already implemented as a cron; no gap |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Skip-logic / conditional branching renderer | §6, §9, §12, §23 | Spec §1 explicitly out-of-scope ("complex branching logic"); schema stub exists, renderer absent — building it now is overbuild `[DO NOT OVERBUILD]` |
| Survey templates marketplace | §23 | Spec §1 out-of-scope |
| External (non-member) survey distribution | §23 | Spec §1 out-of-scope |
| Expanding the NPS engine / NPS trends beyond current scope | §6, §17 | NPS is implemented richly already; spec §1 says reviews (M04) owns NPS — resolve ownership (PD-6) before any consolidation, do not add more NPS surface |
| Building out fatigue throttling / retention purge / post-training eval / dismiss / clone | §6 | All already implemented as sensible extensions; keep, do not expand |
| Remodeling `/surveys` routes to spec's `/org/:id/surveys` + separate `/polls` resource | §3, §5 | The `/surveys` + `x-org-id` shape is the shipped platform convention; remodeling is a spec-reconciliation/doc decision (PD-1), not a code fix `[DO NOT OVERBUILD]` |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | TypeSpec marks `getSurvey` as `x-security-required-roles: ["user"]` and the handler adds no officer gate — the generated middleware never officer-gates it. Fix the gate (handler and/or TypeSpec), not just hide drafts |
| FIX-002 | Root cause | Same root as FIX-001: no role gate on the non-`mine` list path; `mine=true` is the only member-safe view |
| FIX-003 | Root cause | `settings.targetAudience` is collected by the builder but no read/submit handler ever resolves it against membership — targeting is a structural no-op, not a transient bug |
| FIX-004 | Root cause | `findMineWithPagination` inner-joins on `surveyResponses`, so a survey without a pre-existing response row is structurally invisible to members; only `postTrainingEval` writes those rows — the assignment mechanism is missing for manual publish |
| FIX-005 | Root cause | `publishSurvey` has no event/notification emission; the publish→notify edge of the workflow was never wired |
| FIX-006 | Root cause | `hasRole(user,'admin')` short-circuits the officer check, conflating platform-admin with org-officer; the privacy boundary (M18-R2) was never encoded — root cause, but fix shape gated by role-semantics decision (PD-2) |
| FIX-007 | Symptom | The zeros-UUID sentinel is a presentation workaround for anonymity; storage is correct (`null`). Returning `null` aligns API with storage and TypeSpec — low-risk symptom fix |
| FIX-008 | Root cause | No `survey.autoClose` cron exists; expiry job operates on responses not the survey row — the lifecycle transition at deadline was never implemented |
| FIX-009 | Root cause | `deleteMemberResponses` deletes by `responderId` with no org predicate — missing scoping, not a transient bug |
| FIX-010 | Root cause (test gap) | RBAC + workflow cases were never written; the loop is untested at the permission/discovery boundary |
| FIX-011 | Symptom | A test is mislabeled "M18-R5" but exercises not-active state; relabel + add the real targeting assertion to remove false-green |

## 13. Recommended First Fix Batch

**Batch A (read-authorization subset) — run first.**

- **Batch name:** Batch A — P1 publish→respond loop (read-authorization subset).
- **Included Fix IDs:** FIX-001 (officer-gate `getSurvey`), FIX-002 (officer-gate `listSurveys` non-`mine`), plus FIX-010/FIX-011 test scaffolding (write the RED RBAC tests for these two first).
- **Why this batch comes first:** It is fully evidenced (confirmed by direct inspection of `getSurvey.ts` and `listSurveys.ts`), pure module-local RBAC, has the smallest blast radius, requires no cross-module data or product decision, and immediately closes a real confidentiality leak (members reading draft surveys + internal `targetAudience`). It de-risks the rest of the loop without waiting on PD-2/PD-3 or Batch F.
- **Tests to write first (RED):**
  1. Member (non-officer) `getSurvey` on a draft → denied (extend `getSurvey.test.ts`).
  2. Member `listSurveys?status=draft` (non-`mine`) → denied; `mine=true` allowed (extend `listSurveys.test.ts`).
- **Explicit out-of-scope for this first batch:**
  - FIX-003 targeting, FIX-004 discovery, FIX-005 publish-notify (wait for PD-3 + Batch F; same loop, later in the pass).
  - FIX-006 M18-R2 platform-admin exclusion (wait for PD-2 → Batch B).
  - FIX-007/008/009 (Batch C, later).
  - Anything in §10 Deferred and §11 Do Not Build — especially do NOT remodel routes, do NOT build skip-logic, do NOT expand NPS, do NOT add the publish-deadline gate (PD-4 pending).

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Surveys & Polls
- **Exact module slug:** `surveys-polls`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/surveys-polls-fix-ready-plan.md`
- **Exact batch to execute first:** Batch A — P1 publish→respond loop (read-authorization subset): FIX-001, FIX-002, with FIX-010/FIX-011 RED tests written first.
- **Tests to prioritize (write RED before code):**
  1. Member-non-officer `getSurvey` on draft → denied — extend `services/api-ts/src/handlers/surveys/getSurvey.test.ts`.
  2. Member `listSurveys?status=draft` (non-`mine`) → denied; `mine=true` allowed — extend `services/api-ts/src/handlers/surveys/listSurveys.test.ts`.
  Then, for the later loop subset (FIX-003/004/005, after PD-3 + Batch F): non-targeted-submit-403, publish→target-member-list-appears + non-target-absent, publish-notification-created — extend `submitSurveyResponse.test.ts`, `listSurveys.test.ts`, `publishSurvey.test.ts`.
- **Files likely to touch (Batch A first subset):** `services/api-ts/src/handlers/surveys/getSurvey.ts`, `services/api-ts/src/handlers/surveys/listSurveys.ts`, possibly `specs/api/src/modules/surveys.tsp` (`x-security-required-roles` for officer-detail — if changed, regenerate via `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`), and the two `*.test.ts` files above.
- **Shared/database cautions:**
  - Officer gates depend on `OfficerTermRepository.findActiveByPersonAndOrg` from `handlers/association:member/repos/governance.repo` (already wired) — match the existing "any active officer term" gate used by sibling handlers (`publishSurvey.ts`, `listSurveyResponses.ts`) unless PD-5 says otherwise.
  - Do NOT touch the database schema or `core/domain-event-consumers.ts` in the first subset — those belong to Batch F (targeting normalization + person-deletion cascade verification) and gate FIX-003.
  - FIX-005 reuses the already-wired `notifs` in `handlers/surveys/jobs/index.ts` — do not modify the notifs service.
- **Items NOT to implement in this pass:**
  - FIX-006 (M18-R2 platform-admin exclusion) — blocked by PD-2 (role semantics).
  - FIX-004 discovery design — blocked by PD-3 (pending-rows vs active+targeted query).
  - Publish-deadline gate — blocked by PD-4 (NPS open-ended).
  - All §10 Deferred items (spec/route reconciliation, error-code taxonomy, audit logging, observability metrics, word-cloud) and all §11 Do Not Build items (skip-logic renderer, templates marketplace, external distribution, NPS expansion, route remodel).
  - Do not consolidate NPS ownership (PD-6) or change anonymous dedup behavior (PD-7) without confirmation.

Next recommended step:
```txt
Module/group: Surveys & Polls
Module slug: surveys-polls
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/surveys-polls-fix-ready-plan.md
Recommended batch: Batch A — P1 publish→respond loop (read-authorization subset: FIX-001, FIX-002, with FIX-010/FIX-011 RED tests first)
```
