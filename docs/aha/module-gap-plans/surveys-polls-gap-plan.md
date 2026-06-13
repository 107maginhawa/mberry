# AHA Module/Group Gap Plan: Surveys & Polls

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Surveys & Polls |
| Module slug | surveys-polls |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/surveys-polls-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m18-surveys-polls/MODULE_SPEC.md` (Spec v2.0, 2026-05-21) |
| Supporting PRDs/specs used | `docs/product/modules/m18-surveys-polls.md`; `docs/product/modules/m18-surveys-polls/API_CONTRACTS.md`; `docs/product/ROLE_PERMISSION_MATRIX.md` §3.27; `specs/api/src/modules/surveys.tsp` |
| PRD/spec coverage quality | Partial (spec is Strong/detailed, but implementation re-interprets it as an NPS-first engine — see §3) |
| Paths inspected | `services/api-ts/src/handlers/surveys/**` (all handlers + repo + schema + utils + jobs + tests); `services/api-ts/src/generated/openapi/routes.ts` (survey routes); `services/api-ts/src/app.ts` (hand-wired survey routes); `specs/api/src/modules/surveys.tsp`; `apps/memberry/src/routes/_authenticated/my/surveys/**`; `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/surveys/**`; `apps/memberry/src/features/surveys/**` (component/hook names); `apps/admin/src/routes/surveys/index.tsx`; `specs/api/tests/contract/surveys-flow.hurl` |
| PRDs/specs inspected | m18 MODULE_SPEC, m18 API_CONTRACTS, m18 overview, ROLE_PERMISSION_MATRIX §3.27 |
| KG used | Yes (secondary — index §2; `.understand-anything/` graph, generated 2026-06-06, partially stale) |
| KG refreshed | No (direct code inspection was sufficient for this module's wiring) |
| `/understand-domain` used | No (product specs richer; per index §3 decision) |
| `/understand-domain` refreshed | No |
| Webwright used | No |
| Playwright/E2E inspected | No (Static review sufficient; browser tooling skipped for batch run) |
| Existing tests inspected | 15 backend test files under `handlers/surveys/` (~109 cases); 1 Hurl flow `surveys-flow.hurl` (14 steps). No E2E specs for surveys found in `apps/memberry`/`apps/admin`. |
| Cross-cutting audit reviewed | Not Available (no `cross-cutting-pattern-audit.md` yet) |
| Database/schema audit reviewed | Not Available (no `database-schema-audit.md` yet) |
| Limitations | Static review only; no live DB/run-time verification of RBAC behavior. KG partially stale (post-2026-06-06 changes not represented). Member-facing E2E was not executed (batch run). Findings on member draft-read and targeting are based on handler code paths, marked where confirmation by runtime test is advisable. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M18 Module Spec | `docs/product/modules/m18-surveys-polls/MODULE_SPEC.md` | PRD / module spec | Current (v2.0, 2026-05-21) | Primary contract: workflows WF-100..103, BR-40 + M18-R1..R5, permissions, data model, ACs |
| M18 API Contracts | `docs/product/modules/m18-surveys-polls/API_CONTRACTS.md` | API contract | Current (but diverges from shipped routes — see §3) | Endpoint shapes, error codes M18-001..006, `/polls` endpoints |
| M18 Overview | `docs/product/modules/m18-surveys-polls.md` | PRD overview | Current | Survey/poll concepts, anonymity default, distribution, reminders |
| Role/Permission Matrix §3.27 | `docs/product/ROLE_PERMISSION_MATRIX.md` | acceptance criteria | Current | Create=GA+HG (officer roles); Respond=GA (member); View results=GA+HG |
| TypeSpec source | `specs/api/src/modules/surveys.tsp` | API contract (shipped) | Current | The actual implemented contract — NPS-first reinterpretation; source of truth for routes/validators |

## 3. Expected vs Actual

**Expected (m18 spec):** An officer-authored survey tool. Officers create surveys at `/org/:id/surveys` with question types `multiple_choice` / `rating_scale` / `free_text` / `checkbox`, set `type` = `anonymous`/`identified`, choose distribution (`all`/`category`/`manual`), set a required deadline, publish (emitting `SurveyPublished` → M07 notifies targeted members). Members respond at `/my/surveys/:id`; targeting (M18-R5) prevents non-targeted members from accessing. Officers view aggregated results + CSV export; identified surveys allow officer-only individual response viewing (M18-R2). Quick polls (`/org/:id/polls`) are single-question with inline results.

**Actual (shipped):** A broader **NPS/satisfaction-first feedback engine** that re-interprets the spec.
- Routes are `/surveys/*` (org via `x-org-id`/`orgContextMiddleware`), not `/org/:id/surveys/*`. [INFERRED — platform convention; consistent with other modules.]
- Question types: `nps`, `rating`, `single_choice`, `multi_choice`, `text`, `yes_no` (schema `survey.schema.ts:30`). Survey types: `nps`, `satisfaction`, `poll`, `custom` (`surveys.tsp:157`). Polls are modeled as `surveyType: 'poll'` (no separate `/polls` resource).
- Anonymity is a `settings.anonymous` boolean (not a top-level `type` enum). **BR-40 storage guarantee is correctly implemented**: `submitSurveyResponse.ts:143-149` stores `responderId: null` for anonymous surveys (not store-then-mask).
- Deadline (M18-R1) enforced in `submitSurveyResponse.ts:83-90`. Re-edit (M18-R3/AC-M18-004) enforced via `settings.allowReedit`. Duplicate prevention via unique `(surveyId, responderId)` index (`survey.schema.ts:142`).
- Distribution/targeting (M18-R5) is **collected but NOT enforced** (see §5/§10). Member discovery relies on pre-created `pending` response rows; officer-published surveys do not auto-create those rows, so they never appear in `/my/surveys?mine=true`.
- Rich extras beyond spec: fatigue throttling, retention purge, post-training auto-eval triggers, NPS trends, clone, dismiss, server-side delete-my-responses. These are [INFERRED] product extensions; partly traceable to "NPS handled by M04 reviews module" being out-of-scope per spec §1 (conflict — see §6).

Net: core CRUD + lifecycle + BR-40 + deadline + re-edit are implemented and well-tested. The **member-discovery + targeting + read-authorization** slice is the materially incomplete part. `[NEEDS PRODUCT DECISION]` on whether the shipped NPS-engine reinterpretation is the intended V1 (it is richer than spec but misses spec's officer-survey distribution loop).

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-100 Create survey (draft) | Officer creates draft | Implemented (officer/admin gate) | `officer/surveys/new.tsx`, `survey-builder.tsx` | `createSurvey.ts:37-43` | `surveys` table | `createSurvey.test.ts` (5) | Implemented | No |
| WF-100 Publish (≥1 question + deadline) | draft→active; questions required; deadline required | Partial — questions required (`publishSurvey.ts:60-63`); **deadline NOT required at publish** | builder | `publishSurvey.ts` | — | `publishSurvey.test.ts` (9) | Partially Implemented | Yes (deadline gate) |
| WF-100 Notify targeted members on publish | `SurveyPublished` → M07 notification | **Missing** — no event/notification on publish | — | grep: no `createNotification`/event in `publishSurvey.ts`/`createSurvey.ts` | — | none | Missing | Yes |
| WF-101 Respond | Targeted active member submits | Partial — any authenticated member can submit; no targeting/eligibility check | `my/surveys/$surveyId.tsx`, `survey-flow.tsx` | `submitSurveyResponse.ts` | `survey_response` | `submitSurveyResponse.test.ts` (22) | Partially Implemented | Yes (M18-R5) |
| WF-101 Member survey list | Member sees assigned surveys | Partial — `mine=true` only lists surveys the member already has a response row for | `my/surveys/index.tsx` | `listSurveys.ts:40-48`, `repo.findMineWithPagination` (inner join on responses) | — | `listSurveys.test.ts` (6) | Partially Implemented | Yes (no targeting-driven assignment) |
| WF-102 Aggregated results | Per-question aggregation | Implemented (`computeAnalytics`) | `survey-results.tsx`, `nps-trend-chart.tsx` | `getSurveyAnalytics.ts`, `utils/computeAnalytics.ts` | `analyticsSnapshot` | `getSurveyAnalytics.test.ts` (5), `computeAnalytics.test.ts` | Implemented | No |
| WF-102 CSV export | Officer-only CSV; anonymous omits respondent | Implemented (officer/admin gate; anonymous omits respondent col) | results page | `exportSurveyResponses.ts:82-98` | — | `exportSurveyResponses.test.ts` (8) | Implemented | No |
| WF-102 Individual responses (identified) | Officer-only; platform-admin blocked from mapping | Partial — `listSurveyResponses` officer/admin gated; anonymous masked to zeros-UUID; **M18-R2 platform-admin-vs-officer distinction not enforced** (admin role passes the same gate) | — | `listSurveyResponses.ts:39-44, 76-78` | — | `listSurveyResponses.test.ts` (7) | Partially Implemented | Yes (M18-R2) |
| WF-103 Quick poll + inline results | Single-question poll, inline results after vote | Implemented as `surveyType:'poll'`; inline counts returned on submit | `poll-card.tsx` | `submitSurveyResponse.ts:133-138,180-185` (`aggregatePollResults`) | — | `submitSurveyResponse.test.ts` AC-M18-006 (4) | Implemented (re-shaped) | No (model differs) |
| BR-40 Anonymity (no respondent mapping) | No `respondentId` stored for anonymous | Implemented at storage (`responderId: null`) | builder anonymous toggle | `submitSurveyResponse.ts:143-149` | nullable `responder_id` | `submitSurveyResponse.test.ts` BR-40 (3) | Implemented | No |
| M18-R1 Deadline enforcement | Reject after deadline | Implemented | — | `submitSurveyResponse.ts:83-90` | `settings.deadline` JSONB | `submitSurveyResponse.test.ts` M18-R1 | Implemented | No |
| M18-R2 Identified privacy (admin blocked) | Platform admin cannot view individual responses | Missing/weak — `hasRole(user,'admin')` *grants* access; no platform-admin exclusion | — | `listSurveyResponses.ts:39` | — | none for admin-block | Missing | Yes |
| M18-R3 Re-edit until deadline | Per-survey config | Implemented | builder | `submitSurveyResponse.ts:93-106`, repo `updateResponseAnswers` | `settings.allowReedit` | `submitSurveyResponse.test.ts` AC-M18-004 (5) | Implemented | No |
| M18-R4 Poll inline results | Show results after vote | Implemented | `poll-card.tsx` | `aggregatePollResults` | — | AC-M18-006 tests | Implemented | No |
| M18-R5 Distribution / non-targeted cannot access | Non-targeted members cannot see/respond | **Missing** — no eligibility filter on read or submit | builder collects tiers/chapters | none (no targeting check in `getSurvey`/`submitSurveyResponse`) | `settings.targetAudience` stored | none | Missing | Yes |
| Survey detail read = officer | `GET /org/:id/surveys/:id` officer-gated | **Missing gate** — `getSurvey.ts` has no officer check; any member reads any org survey incl. drafts | — | `getSurvey.ts:18-39` (no role gate) | — | `getSurvey.test.ts` (4) — no RBAC test | Missing | Yes |
| Survey list (officer) | Officer sees all; member sees assigned | Partial — `listSurveys` (officer path) has **no officer gate**; member could pass `?status=draft` | — | `listSurveys.ts:50-58` (no role gate) | — | `listSurveys.test.ts` — no RBAC test | Partially Implemented | Yes |
| Error codes M18-001..006 | Structured error codes | Missing — handlers throw generic `BusinessLogicError`/`ConflictError`; M18-* codes unused | — | `submitSurveyResponse.ts:80,88,98` | — | tests assert error *classes*, not codes | Partially Implemented | Yes (P3) |
| State machine: closed immutable | No reverse transitions; closed immutable | Implemented (draft→active→closed via WHERE-status guards) | — | repo `publish`/`close`/`updateDraftSurvey` use `eq(status, ...)` guards | — | close/publish/update tests | Implemented | No |
| Feature flags (`surveys_enabled`, `surveys_polls`, `surveys_csv_export`) | Gate module/features | Not Required for V1 [INFERRED] — no flag wiring found in handlers | — | none | — | none | Unclear | No (V2) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Survey detail read authorization | `getSurvey` (`GET /surveys/:survey`) has no officer gate; any authenticated member in the org can read any survey including `draft` (full questions + settings + targetAudience) | P1 | V1 REQUIRED | `getSurvey.ts:18-39` (no `hasRole`/officer check, unlike sibling handlers); spec §6 "Get survey detail = officers"; M18-R5 | Add officer/admin gate for officer-survey detail, OR split into officer-detail (`getSurvey`) vs member-respond-view (`/my/surveys/:id`) that returns only targeted/active surveys and omits internal config |
| Survey list authorization | `listSurveys` officer path (non-`mine`) has no officer gate; member can list org surveys incl. `?status=draft` | P1 | V1 REQUIRED | `listSurveys.ts:50-58` (no role gate); TypeSpec marks `listSurveys` as `x-security-required-roles: ["user"]` so generated middleware does not officer-gate it | Officer-gate the non-`mine` list path; restrict member access to the `mine=true` (assigned) view only |
| M18-R5 distribution/targeting enforcement | `submitSurveyResponse` allows ANY org member to respond to ANY active survey; `settings.targetAudience` (tiers/chapters/committees) collected by builder but never enforced | P1 | V1 REQUIRED | `submitSurveyResponse.ts` (no eligibility/targeting branch); `survey-builder.tsx:180-194` collects targetAudience; spec M18-R5, AC error "You are not eligible" (§15) | Enforce targeting at submit (and member-read): resolve member's tier/chapter/committee vs `targetAudience`; 403 if not targeted |
| Member discovery of published surveys | Officer-published surveys never appear in members' `/my/surveys` because `findMineWithPagination` inner-joins on existing response rows; only the post-training job pre-creates `pending` rows | P1 | V1 REQUIRED | `survey.repo.ts:95-136` (inner join `surveyResponses`); `jobs/index.ts` postTrainingEval is the only writer of pending rows | On publish, either (a) emit `SurveyPublished` and create `pending` response rows for targeted members, or (b) change member list to query active+targeted surveys regardless of prior response row |
| `SurveyPublished` notification (WF-100 / §10b) | No domain event or M07 notification emitted on publish; members not alerted | P1 | V1 REQUIRED | `publishSurvey.ts` (no event/notification); grep found no `createNotification`/`SurveyPublished` in surveys handlers; spec §10b lists `SurveyPublished → M07` | Emit notification on publish to targeted members (reuse `notifs` already wired into `registerSurveyJobs`) |
| Publish requires deadline | Spec WF-100 + API_CONTRACTS: publish 400 "no deadline"; impl only checks ≥1 question | P2 | V1 RECOMMENDED | `publishSurvey.ts:60-63` (only questions guard); spec §4 exception "No deadline set — validation error" | Add deadline presence check at publish (or document deadline-optional decision) — note many shipped survey types (NPS) are intentionally open-ended; `[NEEDS PRODUCT DECISION]` |
| M18-R2 platform-admin exclusion | Platform `admin` role *passes* the officer gate on `listSurveyResponses`/`getSurveyAnalytics`/export — spec says platform admin must NOT see individual response→member mappings even for identified surveys | P1 | V1 RECOMMENDED | `listSurveyResponses.ts:39` `hasRole(user,'admin')` short-circuits to allow; spec M18-R2 / AC-M18-003 / API_CONTRACTS `/responses` "NOT platform admin" | Distinguish platform-admin from org-officer for individual-response endpoints; platform admin gets aggregate-only. `[NEEDS PRODUCT DECISION]` on whether `admin` here means org-admin vs platform-admin |
| BR-40 API masking sentinel | Anonymous responses are returned with `responderId = 00000000-…-0` (zeros UUID) rather than `null` in `listSurveyResponses` | P2 | V1 RECOMMENDED | `listSurveyResponses.ts:14,76-78` | Return `null` (matches TypeSpec `responderId?: UUID`) so clients don't treat the sentinel as a real person id |
| Structured error codes M18-001..006 | Handlers use generic error classes, not the M18-* / VALIDATION-* codes in API_CONTRACTS | P3 | V2 DEFERRED | `submitSurveyResponse.ts:80,88,98`; tests assert classes not codes | Map to taxonomy codes when error-taxonomy enforcement lands platform-wide `[DO NOT OVERBUILD]` |
| Question types / route-shape spec drift | Implemented question/survey-type enums and `/surveys` route shape differ from m18 spec/API_CONTRACTS (`multiple_choice`/`rating_scale`/`checkbox` vs `single_choice`/`multi_choice`/`yes_no`; `/org/:id/surveys` vs `/surveys`) | P2 | V1 RECOMMENDED | `survey.schema.ts:30`, `surveys.tsp:80-98` vs API_CONTRACTS §2 | Reconcile spec ↔ implementation (update spec/API_CONTRACTS to the shipped NPS-engine contract, or vice-versa) — primarily a doc-sync fix; `[NEEDS PRODUCT DECISION]` |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| NPS as first-class survey type + NPS trends endpoint | `surveys.tsp:157` (`nps` type), `getNpsTrends.ts`, `nps-trend-chart.tsx`, `nps-modal.tsx`, `nps-provider.tsx` | Spec §1 explicitly says **"NPS system (handled by M04 reviews module)" is Out of Scope** — direct conflict | Medium (duplicate source of truth with reviews/NPS) | Keep but clarify — reconcile m18 vs M04 reviews ownership of NPS; `[NEEDS PRODUCT DECISION]` |
| Fatigue throttling (max N surveys/member/week) | `jobs/index.ts` `countRecentForMemberInWindow`, `DEFAULT_SURVEY_FATIGUE_THRESHOLD`; `settings.fatigueThreshold` | Not in m18 spec | Low | Keep — sensible UX guard; do not expand |
| Retention purge (`settings.retentionDays`) + `survey.retentionPurge` cron | `jobs/index.ts` retentionPurge; `survey.schema.ts:50` | Not in m18 spec (compliance-adjacent) | Low | Keep — supports right-to-deletion intent |
| Post-training auto-eval trigger (`survey.postTrainingEval`) | `jobs/index.ts` postTrainingEval; reads `training.session.completed` context | Not in m18 spec; cross-module to training (m09) | Medium ([CROSS-MODULE RISK]) | Keep but clarify — this is the only writer of member `pending` rows; verify it does not become the *de facto* targeting mechanism |
| `dismissSurveyResponse` (server-side dismiss across devices) | `dismissSurveyResponse.ts` | Not in m18 spec | Low | Keep — NPS-prompt UX feature |
| `cloneSurvey` | `cloneSurvey.ts`, route `/surveys/:survey/clone` | Not in m18 spec | Low | Keep — officer convenience |
| `skipLogic` schema field (conditional branching) | `survey.schema.ts:23-37`, `surveys.tsp:66-77` | Spec §1 "complex branching logic" is **Out of Scope**; field is schema-prep only (renderer not implemented) | Low | Move to V2 — leave schema stub, do not build renderer now `[DO NOT OVERBUILD]` |
| `archived` status (4th state) | `surveys.tsp:152` | Spec state machine is draft/active/closed only | Low | Keep but clarify — document the extra state or drop |
| `listAdminSurveys` cross-org platform-admin dashboard | `listAdminSurveys.ts`, `apps/admin/src/routes/surveys/index.tsx` | Not in m18 spec; tension with BR-40/M18-R2 (admin should not deanonymize) | Medium | Keep but clarify — confirm it returns aggregate-only (it does: `AdminSurveyListItem` has no respondent data) and never exposes individual identified responses |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-100 Create & publish survey | Officer/Admin | Officer opens builder | create draft → add questions → set distribution/deadline → publish | Implemented except deadline-gate, targeting-on-publish, and publish notification | Yes (notify + targeting) | `createSurvey.ts`, `publishSurvey.ts`, `survey-builder.tsx` |
| WF-101 Respond to survey | Member | Notification / `/my/surveys` | open → answer → submit → confirm; re-edit before deadline | Implemented submit/re-edit; **discovery + targeting broken** | Yes | `submitSurveyResponse.ts`, `my/surveys/*` |
| WF-102 View results | Officer/Admin | Opens results page | aggregated charts per question + CSV export + individual (identified) | Implemented; M18-R2 admin-exclusion weak | Yes (M18-R2) | `getSurveyAnalytics.ts`, `exportSurveyResponses.ts`, `listSurveyResponses.ts` |
| WF-103 Quick poll | Officer creates / Member votes | Officer creates poll | create poll → members vote → inline results | Implemented as `surveyType:'poll'` with inline counts | No | `submitSurveyResponse.ts` (`aggregatePollResults`), `poll-card.tsx` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Officer creates draft | Officer-gated create | Implemented | `createSurvey.ts:37-43` | V1 REQUIRED | OK |
| Officer adds questions/distribution/deadline | Builder collects all | Implemented | `survey-builder.tsx` | V1 REQUIRED | targetAudience collected but unused downstream |
| Publish (validate questions + deadline) | Both required | Partially Implemented | `publishSurvey.ts:60-63` (no deadline) | V1 RECOMMENDED | deadline gate missing |
| Publish → notify targeted members | Event + M07 notification | Missing | no event in `publishSurvey.ts` | V1 REQUIRED | members can't discover surveys |
| Member discovers assigned survey | List of targeted/pending surveys | Partially Implemented | `findMineWithPagination` requires pre-existing response row | V1 REQUIRED | published officer surveys never surface |
| Member reads survey to respond | Targeted member only; active only | Missing guard | `getSurvey.ts` (no targeting/officer gate) | V1 REQUIRED | non-targeted members can read drafts |
| Member submits response | Active + targeted + deadline + dedup | Partially Implemented | `submitSurveyResponse.ts` (no targeting) | V1 REQUIRED | targeting/eligibility not enforced |
| Anonymous storage (BR-40) | `responderId` null | Implemented | `submitSurveyResponse.ts:143-149` | V1 REQUIRED | correct |
| Re-edit before deadline | Per-survey allowReedit | Implemented | `submitSurveyResponse.ts:93-106` | V1 REQUIRED | correct |
| Officer views aggregated results | Per-question aggregation | Implemented | `computeAnalytics.ts` | V1 REQUIRED | correct |
| Officer views individual (identified) | Officer-only, not platform admin | Partially Implemented | `listSurveyResponses.ts:39` | V1 RECOMMENDED | M18-R2 admin exclusion |
| CSV export | Officer-only; anonymous omits respondent | Implemented | `exportSurveyResponses.ts` | V1 REQUIRED | correct |
| Survey closes at deadline | Auto-close on deadline | Partially Implemented | `jobs/index.ts` expires *pending responses* (skips them) but does NOT flip survey `status` to `closed` at deadline | V1 RECOMMENDED | deadline enforced at submit-time; survey row stays `active` past deadline |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Create/edit/publish/close survey | Officer | Full CRUD + lifecycle | Implemented | No | V1 REQUIRED | create/update/publish/close/delete handlers |
| Question types store + aggregate | Officer | All 6 types aggregate correctly | Implemented | No | V1 REQUIRED | `computeAnalytics.ts`, tests |
| Respond + re-edit + deadline + dedup | Member | Submit, edit, blocked after deadline / on duplicate | Implemented | No | V1 REQUIRED | `submitSurveyResponse.ts` (22 tests) |
| Targeting (only eligible members) | Member | Non-targeted cannot access/respond | Missing | Yes | V1 REQUIRED | no targeting enforcement |
| Member discovers published surveys | Member | Published targeted surveys appear in /my/surveys | Missing | Yes | V1 REQUIRED | `findMineWithPagination` join gap |
| Publish notification | Member | Notified on publish | Missing | Yes | V1 REQUIRED | no event/notification |
| Aggregated results + export | Officer | Charts + CSV | Implemented | No | V1 REQUIRED | results page, export handler |
| Individual identified responses (officer-only) | Officer | View; platform admin blocked | Partially Implemented | Yes | V1 RECOMMENDED | `listSurveyResponses.ts` |
| Quick poll inline results | Member | Vote → see results | Implemented | No | V1 REQUIRED | `aggregatePollResults` |
| Anonymity guarantee (BR-40) | All | No respondent mapping for anonymous | Implemented | No | V1 REQUIRED | null responderId |
| Right-to-deletion (delete my responses) | Member | Purge own responses | Implemented (cross-org, broad) | Partial | V1 RECOMMENDED | `deleteMemberResponses.ts` |
| Auto-close survey at deadline | System | Survey flips to closed | Missing | Yes | V1 RECOMMENDED | jobs skip responses, not survey |
| Reminders before deadline | System | Notify pending responders | Implemented (cron) | No | V2 DEFERRED | `survey.responseReminder` job |
| Conditional/branching logic | Officer | Skip logic renderer | Missing (schema stub only) | No | DO NOT ADD | spec out-of-scope; `[DO NOT OVERBUILD]` |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| `getSurvey` lacks officer gate — member can read any org survey incl. drafts (full questions/settings/targetAudience) | Permission/RBAC | P1 | V1 REQUIRED | `getSurvey.ts:18-39`; `surveys.tsp:461` `x-security-required-roles: ["user"]` | Confidential draft surveys + internal targeting config exposed to all members; undermines officer-only management | Officer-gate officer-detail; give members a scoped `/my` respond-view |
| `listSurveys` officer path lacks officer gate — member can list drafts via `?status=draft` | Permission/RBAC | P1 | V1 REQUIRED | `listSurveys.ts:50-58` (no role check) | Same exposure as above for the list view | Officer-gate non-`mine` path |
| M18-R5 targeting not enforced — any member responds to any active survey | Workflow/trust | P1 | V1 REQUIRED | `submitSurveyResponse.ts` (no targeting branch); `settings.targetAudience` stored, unused | Distribution controls are a no-op; surveys not actually scoped to intended audience; data integrity of results | Enforce targeting on read + submit |
| Published officer surveys never reach members | Workflow | P1 | V1 REQUIRED | `survey.repo.ts:95-136` inner-join requires pre-existing response row; only postTrainingEval job creates them | The primary WF-101 loop (publish → member responds) is broken for officer-authored surveys | Create pending rows / emit notification on publish, or query active+targeted in member list |
| No `SurveyPublished` notification | Workflow/integration | P1 | V1 REQUIRED | `publishSurvey.ts` (no event/notification) | Members have no signal a survey exists; compounds discovery gap | Notify targeted members on publish (notifs already wired in jobs) |
| M18-R2 platform-admin can pass officer gate to individual identified responses | Permission/privacy | P1 | V1 RECOMMENDED | `listSurveyResponses.ts:39` `hasRole(user,'admin')` allows | BR-40/M18-R2: platform admin must not deanonymize; potential privacy-contract violation | Separate platform-admin from org-officer; admin → aggregate-only; `[NEEDS PRODUCT DECISION]` on role meaning |
| Survey not auto-closed at deadline (status stays `active`) | State/lifecycle | P2 | V1 RECOMMENDED | `jobs/index.ts` `survey.expirePending` skips responses, never flips survey status; no `survey.autoClose` cron | Survey lists/UX show "active" past deadline; only submit-time guard prevents new responses | Add deadline-driven auto-close (or document submit-time-only enforcement) |
| BR-40 list response returns zeros-UUID sentinel not null | Data/API | P2 | V1 RECOMMENDED | `listSurveyResponses.ts:14,76-78` | Client may treat sentinel as real person; spec/TypeSpec expect nullable | Return null |
| `deleteMemberResponses` is unscoped cross-org bulk delete | Data/API | P2 | V1 RECOMMENDED | `deleteMemberResponses.ts:30-33` (deletes ALL by responderId, no org filter) | Deletes responses across every org silently; also cannot touch anonymized rows (acceptable) but no confirmation/scoping | Scope to org or require explicit confirmation; document anonymized-rows exclusion |
| Publish does not require deadline | Validation | P2 | V1 RECOMMENDED | `publishSurvey.ts:60-63` | Spec WF-100 requires deadline; deadline-less surveys never auto-close | Add deadline gate or document NPS open-ended exception `[NEEDS PRODUCT DECISION]` |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Officer publishes survey → targeted member sees it in /my/surveys | Survey appears in member's pending list; member notified | Survey does NOT appear (no pending row, no notification); member has no path to it except a direct link | `survey.repo.ts:95-136`; `publishSurvey.ts` (no notify); `my/surveys/index.tsx` reads `mine=true` | P1 | E2E/integration: publish targeted survey → assert it appears in target member's list and not in non-target's |
| Non-targeted member opens a survey link | 403 "You are not eligible" | 200 — can read full survey and submit | `getSurvey.ts`, `submitSurveyResponse.ts` (no targeting) | P1 | Integration: non-targeted member GET/POST → expect 403 |
| Member opens draft survey by id | 403/404 (drafts officer-only) | 200 — reads draft incl. internal config | `getSurvey.ts:35-39` (only org-scope check) | P1 | Integration: member GET draft → expect 403/404 |
| Survey past deadline shown to member | Status shows "closed" | Status still "active" in lists; only submit blocked | `jobs/index.ts` (no status flip) | P2 | Integration: advance time past deadline → assert survey status closed in list |
| Platform admin views identified individual responses | Denied (M18-R2) | Allowed (admin passes officer gate) | `listSurveyResponses.ts:39` | P1 | RBAC test: platform-admin (non-officer) → expect 403 on `/responses` |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `settings.targetAudience` (tiers/chapters/committees) | field saved but not enforced | stored in `survey-builder.tsx:180-194`; never read by submit/read handlers | Medium — gives false impression distribution works | Wire targeting enforcement (§5) |
| `survey.aggregateAnalytics` job trigger | API call with no consumer | `submitSurveyResponse.ts:112-125,159-171` triggers a job that is **not registered** (`jobs/index.ts` registers expirePending/responseReminder/postTrainingEval/retentionPurge only) | Low (errors swallowed; analytics computed on read) | Either register the job or remove the dead trigger (currently dead-codes by design with try/catch) |
| `skipLogic` (conditional branching) | schema/TypeSpec field, no renderer | `survey.schema.ts:23-37`, `surveys.tsp:66-77` | Low | Leave as V2 stub; `[DO NOT OVERBUILD]` |
| `archived` status | enum value, no transition path | `surveys.tsp:152`; no handler sets `archived` | Low | Document or remove |
| `contextId` on responses | populated only by postTrainingEval | `submitSurveyResponse.ts:151`, `jobs/index.ts` | Low | Keep (training linkage) |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `targetAudience` stored as `string | TargetAudience` union for backwards-compat | schema/model | `survey.schema.ts:46-49` (`targetAudience?: string | TargetAudience`) | P3 | Migrate legacy string rows; normalize to object to enable targeting enforcement |
| Anonymity stored correctly (null `responder_id`) but unique index `(survey_id, responder_id)` does not dedup anonymous responses (null != null in Postgres unique) | schema/migration | `survey.schema.ts:142` | P2 | By design (anonymous allows multiple), but means anonymous surveys have no per-member dedup — confirm intended; document |
| `createdBy` FK `onDelete: restrict`; `responderId` FK `onDelete: restrict` | schema | `survey.schema.ts:109-110,127-128` | P2 | Person deletion cascade: restrict will block person delete if they have non-anon responses unless surveys subscriber handles it — verify `core/domain-event-consumers.ts` covers survey responses `[CROSS-MODULE RISK]` |
| `survey.expirePending` flips *responses* to skipped but never closes the *survey* | backend/job | `jobs/index.ts` | P2 | Add survey auto-close at deadline |
| Generated route `submitSurveyResponse` test labeled "M18-R5" actually tests not-active state, not targeting | test fixture | `submitSurveyResponse.test.ts:101` | P3 | Re-label; real M18-R5 (targeting) untested |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `getSurvey` no officer gate — TypeSpec `x-security-required-roles: ["user"]` | Survey read | `getSurvey.ts`, `surveys.tsp:461` | P1 | Officer-gate officer-detail; member uses scoped respond-view |
| `listSurveys` officer path no officer gate | Survey list | `listSurveys.ts`, `surveys.tsp:443` | P1 | Officer-gate non-`mine` path |
| Officer gate uses "any active officer term" (not title-filtered) | Create/manage/results | `createSurvey.ts:38-42` etc. via `OfficerTermRepository.findActiveByPersonAndOrg` | P2 | Spec §6/RBAC §3.27 restrict create to president/VP/secretary; current impl allows any officer term. Confirm intended breadth `[NEEDS PRODUCT DECISION]` |
| Platform `admin` short-circuit grants individual-response access | Identified privacy (M18-R2) | `listSurveyResponses.ts:39` | P1 | Distinguish platform-admin from org-officer for individual responses |
| Submit has no targeting/eligibility/active-membership check | Respond authorization (M18-R5) | `submitSurveyResponse.ts` | P1 | Enforce targeting + active-member status |
| `deleteMemberResponses` unscoped (all orgs) | Right-to-deletion | `deleteMemberResponses.ts:30-33` | P2 | Scope/confirm |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Survey responses contain member feedback (PII-adjacent for identified surveys) but handlers do not emit `x-audit` / audit events on read/export of individual responses | Compliance / access logging | no `x-audit` extension on survey ops in `surveys.tsp`; `listSurveyResponses`/`export` lack audit | P2 | Add audit logging for individual-response views/exports of identified surveys (privacy-sensitive access) |
| BR-40 anonymity is enforced at storage (null) — strong | Anonymity guarantee | `submitSurveyResponse.ts:143-149` | — (good) | Keep; fix API sentinel (§5) |
| Retention purge deletes responses by `retentionDays` with no audit trail of deletion | Data retention | `jobs/index.ts` retentionPurge | P3 | Log purge counts (already logged) — consider per-survey audit entry |
| Observability hooks in spec §17 (`survey.published`, `survey.results.exported`, metrics) not wired as metrics | Observability | spec §17; handlers log via Pino but no counters/gauges | P3 | V2 DEFERRED — add metrics when platform observability standardizes |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Index §8 lists surveys = 16 handlers / 13 tests; actual = 19 non-test handler files + 15 test files (incl. jobs/utils) | `find handlers/surveys` (this audit) | Minor doc drift in index | Note in index refresh; not blocking |
| Survey/feed/communication schemas co-located note (index §10 `[NEEDS CONFIRMATION]`) is resolved: survey schema lives in `handlers/surveys/repos/survey.schema.ts`, NOT in communication | `survey.schema.ts` path | Clears an open index question | Update index/domain notes |
| KG generated 2026-06-06; surveys handlers show recent privacy/re-edit/poll work (comments reference "P0 privacy fix", AC-M18-004/006) likely post-graph | handler comments | KG may not represent latest survey wiring | Direct inspection used (this audit); refresh KG before cross-cutting prompt 05 |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Shipped module is an NPS/CSAT feedback engine, not the officer-survey distribution tool the m18 spec describes | `surveys.tsp` doc header "Structured Feedback & NPS Collection"; NPS-first types; event-triggered pending responses | Spec ↔ code mismatch on the *primary use case*; targeting/distribution loop underbuilt because NPS surveys are event-triggered, not manually distributed | `[NEEDS PRODUCT DECISION]`: confirm V1 intent — feedback engine vs officer-survey tool — then close targeting/discovery gaps accordingly |
| Spec §1 says NPS is out-of-scope (M04 reviews owns it) yet NPS is the implemented module's centerpiece | spec §1 vs `surveys.tsp` | Duplicate NPS source of truth (reviews + surveys) | Reconcile ownership; document which module owns member NPS |
| postTrainingEval job is the de-facto member-assignment mechanism (only writer of pending rows) | `jobs/index.ts` | Targeting works only for the training path; manual distribution has no assignment path | Generalize assignment-on-publish for manual/officer surveys |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed. No survey-specific E2E specs were found under `apps/memberry` or `apps/admin` (grep of route groups + `apps/admin` near-zero E2E per index §13/§18). The member-discovery, draft-read-authorization, and targeting gaps above are derived from handler code paths and would benefit from runtime/E2E confirmation during the fix phase.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| No surveys E2E coverage (member respond flow, officer create/publish/results) | (none — static) | absence under `apps/memberry/e2e`, `apps/admin` | Member-facing journeys unverified end-to-end | Add E2E for publish→member-respond and draft-read-denied during fix phase |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/surveys/submitSurveyResponse.test.ts` (22) | backend/unit | submit, deadline (M18-R1), dedup, re-edit (AC-M18-004), anonymity (BR-40), poll inline (AC-M18-006), analytics trigger | High |
| `handlers/surveys/publishSurvey.test.ts` (9) | backend/unit | publish gate, draft-only, ≥1 question | High |
| `handlers/surveys/listSurveyResponses.test.ts` (7) | backend/unit | officer gate, anonymous masking, pagination | Medium (no platform-admin-block test) |
| `handlers/surveys/closeSurvey.test.ts` (7) | backend/unit | close gate, active-only | High |
| `handlers/surveys/deleteSurvey.test.ts` (7) | backend/unit | delete gate, draft-only | High |
| `handlers/surveys/updateSurvey.test.ts` (7) | backend/unit | update gate, draft-only, deadline coercion | High |
| `handlers/surveys/exportSurveyResponses.test.ts` (8) | backend/unit | CSV format, anonymous column omission, accreditation format | High |
| `handlers/surveys/cloneSurvey.test.ts` (6) | backend/unit | clone → new draft | High |
| `handlers/surveys/listSurveys.test.ts` (6) | backend/unit | list, filters, `mine=true` routing | Medium (no officer-gate/RBAC test) |
| `handlers/surveys/createSurvey.test.ts` (5) | backend/unit | create draft, officer gate | High |
| `handlers/surveys/dismissSurveyResponse.test.ts` (5) | backend/unit | dismiss states | High |
| `handlers/surveys/getSurveyAnalytics.test.ts` (5) | backend/unit | snapshot vs on-the-fly, officer gate | High |
| `handlers/surveys/getSurvey.test.ts` (4) | backend/unit | get by id, org-scope, not-found | Medium (no RBAC/member-draft-read test) |
| `handlers/surveys/jobs/index.test.ts` | backend/unit | cron jobs (expire/reminder/postTrainingEval/retention) | Medium |
| `handlers/surveys/utils/computeAnalytics.test.ts` | backend/unit | per-question aggregation (all 6 types) | High |
| `specs/api/tests/contract/surveys-flow.hurl` (14 steps) | contract | full officer lifecycle + admin/nps/responses smoke (`HTTP *` lenient) | Medium (lenient asserts; marked "UNVERIFIED") |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Member (non-officer) GET `/surveys/:id` on draft → expect denied | permission/RBAC | Confirms officer-gate fix; current `getSurvey.test.ts` has no RBAC case | Before fix (RED) |
| Member GET `/surveys?status=draft` → expect denied | permission/RBAC | Confirms officer-gate on list | Before fix (RED) |
| Non-targeted member POST `/surveys/:id/responses` → 403 | integration/domain workflow | Confirms M18-R5 targeting enforcement | Before fix (RED) |
| Publish targeted survey → appears in target member `mine` list, absent for non-target | integration/domain workflow | Confirms discovery + targeting fix | Before fix (RED) |
| Publish → notification created for targeted members | integration | Confirms `SurveyPublished` notification | Before fix (RED) |
| Platform-admin (non-officer) GET `/surveys/:id/responses` → 403 | permission/RBAC | Confirms M18-R2 admin exclusion | Before fix (RED) |
| Anonymous list response returns `responderId: null` (not zeros) | backend/unit | Confirms sentinel fix | During fix |
| Survey auto-closed at deadline (status=closed) | backend/unit + job | Confirms auto-close | During fix |
| `deleteMemberResponses` scoped to org / leaves anonymized rows | backend/unit | Confirms scoped deletion | During fix |
| Person-deletion cascade for non-anon survey responses (FK restrict) | regression/cross-module | Verify person delete not blocked by survey FK | During fix `[CROSS-MODULE RISK]` |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Officer term lookup | cross-module | `createSurvey.ts:10` imports `OfficerTermRepository` from `association:member/repos/governance.repo` | All officer gates depend on governance module's officer-term data | `[SHARED DEPENDENCY]` — keep; ensure governance audit doesn't break this |
| Notification service (M07) for publish/reminders | cross-module | `jobs/index.ts` uses `notifs.createNotification`; publish path does NOT | Publish notification fix reuses already-wired notifs | `[SHARED DEPENDENCY]` |
| Member tier/chapter/committee data (M05) for targeting | cross-module | `settings.targetAudience` needs membership queries to resolve eligibility | Targeting enforcement requires reading membership/chapter data | `[CROSS-MODULE RISK]` — fix needs M05 membership query path |
| Training session completion (m09) trigger | cross-module | `jobs/index.ts` postTrainingEval reads `training.session.completed` context | Survey assignment partly driven by training | `[CROSS-MODULE RISK]` — verify event contract |
| Person FK `onDelete: restrict` on `createdBy`/`responderId` | database/schema | `survey.schema.ts:109-110,127-128` | Person-deletion cascade must handle survey responses or delete blocks | `[CROSS-MODULE RISK]` — confirm `core/domain-event-consumers.ts` |
| `x-org-id` / `orgContextMiddleware` for org scoping | shared/platform | `app.ts:437` survey prefix in org-context list | All survey org scoping depends on this middleware | `[SHARED DEPENDENCY]` |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Officer-gate `getSurvey` (officer detail) + add scoped member respond-view | §5 read auth | P1 | V1 REQUIRED | RBAC member-draft-read test | Also fix TypeSpec `x-security-required-roles` for officer detail |
| Officer-gate `listSurveys` non-`mine` path | §5 list auth | P1 | V1 REQUIRED | RBAC list test | member restricted to `mine` |
| Enforce M18-R5 targeting on read + submit (resolve member tier/chapter/committee vs `targetAudience`) | §5 targeting | P1 | V1 REQUIRED | non-targeted 403 test | needs M05 query |
| On publish: create `pending` rows for targeted members (or change member-list query) + emit notification | §5 discovery + notify | P1 | V1 REQUIRED | publish→member-list + notification tests | reuses notifs |
| Distinguish platform-admin from org-officer on individual-response endpoints | §5 M18-R2 | P1 | V1 RECOMMENDED | platform-admin 403 test | `[NEEDS PRODUCT DECISION]` on role semantics |
| Return `null` instead of zeros-UUID for anonymous list responses | §5 sentinel | P2 | V1 RECOMMENDED | unit test | matches TypeSpec |
| Add survey auto-close at deadline (cron flips status) | §10 lifecycle | P2 | V1 RECOMMENDED | job test | aligns list UX |
| Require deadline at publish (or document NPS open-ended exception) | §5 publish validation | P2 | V1 RECOMMENDED | publish-no-deadline 400 test | `[NEEDS PRODUCT DECISION]` |
| Scope `deleteMemberResponses` to org / add confirmation | §14 deletion | P2 | V1 RECOMMENDED | scoped-delete test | document anon exclusion |
| Remove or register the dead `survey.aggregateAnalytics` trigger | §12 unwired | P3 | V1 RECOMMENDED | n/a | currently dead-coded by design |
| Sync m18 spec/API_CONTRACTS to shipped NPS-engine contract (types, routes, error codes, `/polls`) | §5 spec drift | P2 | V1 RECOMMENDED | n/a (doc) | doc-only `[NEEDS PRODUCT DECISION]` |
| Add audit logging for identified individual-response views/exports | §15 record safety | P2 | V2 DEFERRED | n/a | privacy-sensitive access |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Skip-logic / conditional branching renderer | DO NOT ADD | Spec §1 explicitly out-of-scope; schema stub exists; building it now is overbuild `[DO NOT OVERBUILD]` |
| Word-cloud free-text visualization | V2 DEFERRED | Spec UI mentions it; text-list aggregation suffices for V1 |
| Structured error codes M18-001..006 mapping | V2 DEFERRED | Cosmetic vs platform error-taxonomy rollout; tests assert classes today |
| Observability metrics (counters/gauges per spec §17) | V2 DEFERRED | Add when platform observability standardizes |
| Survey templates marketplace | DO NOT ADD | Spec §1 out-of-scope |
| External (non-member) survey distribution | DO NOT ADD | Spec §1 out-of-scope |
| Reconcile NPS ownership (surveys vs M04 reviews) | `[NEEDS PRODUCT DECISION]` | Spec says reviews owns NPS; code centers surveys on NPS — needs product call before any consolidation |
| Generalize manual/category targeting beyond training trigger | V2 DEFERRED (beyond core fix) | Core fix should enforce targeting; advanced category builder UX can follow |

## 24. Audit Decision

**PARTIAL PASS.**

The module's officer-facing CRUD + lifecycle, BR-40 anonymity (storage-level), deadline enforcement (M18-R1), re-edit (M18-R3), poll inline results (M18-R4), aggregation, and CSV export are implemented and well-tested (~109 backend cases). However, multiple **P1** gaps block reliable V1 use of the core publish→respond loop: (1) `getSurvey`/`listSurveys` lack officer gates so members can read draft surveys + internal targeting config; (2) M18-R5 distribution/targeting is collected but never enforced — any member can respond to any active survey; (3) officer-published surveys never reach members (member list requires a pre-existing response row) and (4) no publish notification exists. There is also a P1 privacy concern that platform `admin` can pass the officer gate to individual identified responses (M18-R2). These are functional/trust/permission gaps, not mere polish, so the module is usable for NPS/event-triggered flows but not for the spec's officer-survey distribution workflow. Not a FAIL because nothing causes data loss or breaks the storage-level anonymity guarantee, and the officer authoring/results path works.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Is the shipped NPS/feedback-engine the intended V1, or should the officer-survey distribution tool (m18 spec) be the V1? | `[NEEDS PRODUCT DECISION]` | Determines whether targeting/discovery gaps are V1-blocking or the spec should be rewritten to the shipped contract | Product |
| Does `hasRole(user,'admin')` mean platform-admin or org-admin in survey handlers? | `[NEEDS PRODUCT DECISION]` | Drives the M18-R2 fix (platform admin must not deanonymize) | Product + Eng |
| Should manual/officer-published surveys auto-create pending rows for all targeted members, or should member list query active+targeted directly? | `[NEEDS PRODUCT DECISION]` | Two valid discovery designs; affects fix shape | Eng |
| Who owns member NPS — surveys (m18) or reviews (M04)? Spec §1 says reviews; code centers it on surveys | `[NEEDS PRODUCT DECISION]` | Duplicate source of truth; affects consolidation | Product |
| Is deadline truly required at publish, given NPS/open-ended survey types? | `[NEEDS PRODUCT DECISION]` | Determines whether publish deadline-gate is a fix or the spec is amended | Product |
| Can any active officer term create surveys, or only president/VP/secretary per RBAC §3.27? | `[NEEDS PRODUCT DECISION]` | Current impl allows any officer term; spec restricts | Product |
| Does person-deletion cascade handle non-anon survey responses (FK `restrict`)? | `[NEEDS CONFIRMATION]` | Could block person deletion; verify `core/domain-event-consumers.ts` | Eng |
| Is per-member dedup intended for anonymous surveys (unique index ineffective on null)? | `[NEEDS CONFIRMATION]` | Anonymous surveys allow multiple submissions per member by design | Product |
| Should member-facing journeys be E2E-verified before claiming the fix complete? | `[BLOCKED BY ENVIRONMENT]` | Batch run skipped browser tooling; runtime confirmation recommended | Eng |

## 26. Notes for Gap Plan Organizer

For `03-organize-gap-plan-for-fixing.md`, prioritize:

- **Truly-V1 P1 fixes (the broken publish→respond loop), batch them together** since they interlock:
  1. Officer-gate `getSurvey` + `listSurveys` (read authorization) — `getSurvey.ts`, `listSurveys.ts`, and TypeSpec `x-security-required-roles`.
  2. Enforce M18-R5 targeting on member read + submit (`submitSurveyResponse.ts`) — depends on M05 membership query `[CROSS-MODULE RISK]`.
  3. Fix member discovery (pending-row-on-publish OR active+targeted query) + emit `SurveyPublished` notification (`publishSurvey.ts`, `survey.repo.ts`) — reuses already-wired `notifs`.
  4. M18-R2 platform-admin exclusion on individual identified responses (`listSurveyResponses.ts`) — gated on the role-semantics product decision.
- **Tests to write FIRST (RED):** member-draft-read-denied, non-targeted-submit-403, publish→member-list-appears + notification, platform-admin-403-on-responses. These protect the P1 fixes and are currently absent (RBAC tests missing from `getSurvey.test.ts`/`listSurveys.test.ts`).
- **Selected P2 that may be needed for V1 completeness:** survey auto-close at deadline (UX correctness), `null` vs zeros-UUID sentinel (contract correctness), scope `deleteMemberResponses`.
- **Implemented-but-not-in-PRD — do NOT expand:** NPS engine, fatigue throttling, retention purge, post-training eval, dismiss, clone, skipLogic. Keep; resolve NPS-ownership via product decision, don't build branching.
- **Risky shared/cross-module deps:** officer-term lookup (governance), M05 membership (targeting), M07 notifs (publish), training event (postTrainingEval), person-FK cascade. Targeting + cascade are the two `[CROSS-MODULE RISK]` items.
- **Database/schema deps:** `targetAudience` string|object union normalization (needed before targeting enforcement); person FK `onDelete: restrict` cascade verification.
- **Product decisions that may block fixing:** V1 intent (NPS-engine vs officer-survey tool), admin role semantics, NPS ownership, publish-deadline requirement, create-role breadth. Several P1 fix shapes depend on these — surface them at the organizer stage.
- **Must not implement yet:** skip-logic renderer, templates marketplace, external distribution, error-code taxonomy mapping, observability metrics (all V2/DO NOT ADD).

---

Next recommended step:
```txt
Module/group: Surveys & Polls
Module slug: surveys-polls
Primary PRD/spec: docs/product/modules/m18-surveys-polls/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/surveys-polls-gap-plan.md
```
