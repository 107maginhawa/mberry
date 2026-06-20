# NPS Auto-Prompt — Design & Plan

**Date:** 2026-06-20 · **Branch:** `design/ui-ux-audit` · **Trio:** poll voting ✅ → **NPS auto-prompt (this)** → half-credit CPD
**Status:** PLAN — implementing subagent-driven, live member verify before done.

## Problem

Members never get asked "would you recommend us?" The NPS slide-in modal is fully built but **dead**: nothing mounts `NpsProvider`, and `usePendingNps` queries `mine=true` (inner-join = already-answered) so it can't surface a *pending* NPS. Dev seed's NPS survey is unsubmittable. Goal: member logs in → active NPS they haven't answered → slide-in modal once → rate 0-10 + optional comment, or dismiss → never re-prompt.

## Verified against source (6 claims, brief corrections)

- FE built, `NpsProvider` unmounted — CONFIRMED (zero imports).
- `usePendingNps` uses `mine=true` answered-only + stale dead comment (line 33) — CONFIRMED.
- `dismissSurveyResponse` x-org-id 404 bug — CONFIRMED but **latent** (`api.ts` auto-injects x-org-id when active org set; modal swallows error→localStorage). Test blind spot: never tests no-header.
- `findAvailableForMember` membership-scoped, surveyType filter, no x-org-id — CONFIRMED, **but returns ALL active member surveys** annotated `myResponseStatus` (null=unanswered), NOT unanswered-only → caller must filter.
- `targetAudience`/`fatigueThreshold` unused — CONFIRMED unused (they're `settings` JSONB sub-fields, not columns; fatigue logic exists but uses hardcoded const `=2`).
- **NEW BLOCKER:** seeded NPS survey question ids are `'q1'/'q2'`, but submit validator requires UUID → submit 400s; all seed responses `completed` → no pending row; bogus `surveyType:'general'`.
- Confirmed: available-mode list item ships `questions[{id,type}]` (whole survey row) + `myResponseStatus`.

## Decisions

- **A1** fetch via existing `listSurveys` available-mode (flip query param), not a new endpoint. Zero backend.
- **B1** v1 simple: prompt any active unanswered+undismissed NPS, one at a time. Defer `targetAudience`/`fatigueThreshold` gating (low NPS volume, audience gating infra doesn't exist).
- **C1** fix `dismissSurveyResponse` to mirror `a03c7196` (optional org + `personBelongsToOrg`) — member-facing endpoint should follow membership boundary like its siblings.
- **D** fix seed so there's a real pending NPS to dogfood.

## Plan / Ledger

| # | Task | Where | Status |
|---|---|---|---|
| 1 | Fix `dismissSurveyResponse` (org `string\|undefined`, guard equality, `personBelongsToOrg` membership check, write `survey.organizationId`) + no-header regression test | `services/api-ts/src/handlers/surveys/dismissSurveyResponse.ts` (+ `.test.ts`) | ☑ 7/7 tests; new no-header test fails vs old code |
| 2 | Fix seed NPS survey: UUID question ids, member@memberry.ph has NO response (pending), drop `surveyType:'general'` | `services/api-ts/src/seed/layer-5-gap-fill.ts` | ☑ Miguel=memberPersonIds[0], loop i=1; UUIDs; `general`→`satisfaction` |
| 3 | Fix `usePendingNps` (`available=true`, add `myResponseStatus` to type, filter `==null && !dismissed`, delete dead comments) + mount `<NpsProvider/>` in `_authenticated` layout | `apps/memberry/src/features/surveys/hooks/use-pending-nps.ts`, `routes/_authenticated*` | ☑ mounted both branches, not __root |
| 4 | Restart API + reseed + live `/browse` as member: modal shows → submit 0-10+comment → gone → reload no re-prompt; dismiss path | — | ☑ submit 201+toast+persist; dismiss 204+persist(org set); 0 console errors |

## Result (verified live 2026-06-20)

As member@memberry.ph (Miguel) on dashboard: NPS modal slide-in appeared. **Submit** score 9 + comment → `POST /responses 201` → "Thanks for your feedback" → modal gone → reload returns `myResponseStatus:completed`, no re-prompt. **Dismiss** (after reset) → `POST /responses/dismiss 204` → modal gone → reload no re-prompt; server row `status=dismissed`, `organization_id` persisted (create-path fix). Surveys API suite 182/0. FE typecheck clean. Zero console errors. Backend `available`-mode membership-scoped, no x-org-id sent.

**Deferred (documented):** `targetAudience`/`fatigueThreshold` server gating; available-mode `settings` sanitization.

## Verify (DoD)

Live as member@memberry.ph (NOT officer): modal appears post-login → submit persists (201) → disappears → reload shows no re-prompt. Dismiss → gone → reload no re-prompt. Surveys API suite green. FE typecheck clean.
