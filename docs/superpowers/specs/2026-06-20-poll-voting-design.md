# Poll Voting (+ member-survey foundation) — Design

**Date:** 2026-06-20
**Branch:** design/ui-ux-audit
**Backlog:** D3 — Prior-deferred, item "Poll voting" (`.gstack/qa-reports/qa-remaining-backlog.md`)
**Scope decision:** "Foundation + poll UX" (approved). Order: Poll → NPS → Half-credit.

## Problem

A member should be able to **find an active poll, cast a vote, and see live aggregated results**. The backend already records votes and aggregates poll results — but the member-facing path to reach and use a poll is broken in three places. Two of those breaks are the same gap the next feature (NPS auto-prompt) needs, so we fix them once as a shared foundation.

### Verified current state (file:line)

| Gap | Evidence |
|---|---|
| **Discover** — members can't find an active poll. `mine=true` INNER-JOINs `surveyResponses`, so it returns only surveys the member *already has a response row for*. Those rows are seeded today only by the post-training cron. A freshly published poll is invisible. | `services/api-ts/src/handlers/surveys/repos/survey.repo.ts:116` (innerJoin), `listSurveys.ts:48`, seeding at `jobs/index.ts:157` |
| **Open** — `getSurvey` is officer/admin-gated, so a member gets `403 → "Survey not found"` on the detail page. Its own TypeSpec declares `["user"]`. Handler contradicts its contract. | `getSurvey.ts:41`, route `$surveyId.tsx:23`, spec `specs/api/src/modules/surveys.tsp:461` |
| **See results** — `SurveyFlow` discards the POST response, which already carries `pollResults`, and shows a generic "Thank you." Completed surveys aren't clickable. Dead `PollCard` hardcodes `questionId:'q1'` and is rendered nowhere. | `survey-flow.tsx:197`, `submitSurveyResponse.ts:181`, `index.tsx:159`, `poll-card.tsx:55` |

Backend that **already works** and is reused as-is: `submitSurveyResponse` (member vote, `x-security-required-roles ["user"]`) + `aggregatePollResults` (`submitSurveyResponse.ts:19`).

## Approach (chosen)

**Option B′ — extend the path members already use, on a small shared backend foundation.** Rejected: Option A (resurrect `PollCard`) adds a prototype-grade component + still needs the same backend fixes; Option C (dashboard quick-poll) is a new surface beyond the backlog item.

### 1. Backend foundation (shared with NPS)

**1a. Member discovery query — "active surveys for me, including unanswered."**
Add a repo method `findAvailableForMember(organizationId, responderId, { surveyType?, pagination })`:
- `surveys LEFT JOIN surveyResponses ON surveyResponses.surveyId = surveys.id AND surveyResponses.responderId = :me`
- `WHERE surveys.organizationId = :org AND surveys.status = 'active'` (+ optional `surveyType`)
- returns each active survey with `myResponseStatus = response.status ?? null` (null = unanswered).

Expose via a **new, non-breaking** mode on `listSurveys` — `GET /surveys?mine=true&available=true` (param-gated; the existing `mine=true` answered-history path is untouched). `available=true` routes to `findAvailableForMember`. Member role (`["user"]`), same as `mine`.

> Why a param, not changing `mine` semantics: the existing `mine=true` is the member's answered history (incl. closed surveys they completed). A LEFT-JOIN active-only query would silently drop that history. Add a mode; don't mutate the existing one.

**1b. `getSurvey` member read of active surveys (align handler to its `["user"]` spec).**
- If caller is officer/admin → unchanged (full survey, any status).
- Else (member): allow **only `status === 'active'`** surveys; return a **sanitized** payload — `{ id, title, description, surveyType, status, questions, settings: { deadline, anonymous, allowReedit } }`. Strip `targetAudience`, fatigue/analytics internals, audit columns. Draft/closed → `NotFoundError` for members (no existence leak).
- When `surveyType === 'poll'`, include `pollResults` (current aggregated counts) in the response, computed by the shared aggregator. This gives the poll view its results without a separate endpoint and lets the "already voted" case render results on load.

**1c. Extract `aggregatePollResults`** from `submitSurveyResponse.ts` into a shared spot (repo method or `surveys/utils`) so both `submitSurveyResponse` and `getSurvey` use it. No behavior change.

TypeSpec: `getSurvey` already declares `["user"]` — no contract change needed for auth. Add `available?: boolean` query param + `myResponseStatus`/`pollResults` to the relevant response models, then regenerate (`specs/api build` → `api-ts generate` → `sdk-ts generate`).

### 2. Poll UX (frontend, `apps/memberry`)

- **`my/surveys` list** (`routes/_authenticated/my/surveys/index.tsx`): call the new `available` mode; add an **"Available"** section for `myResponseStatus == null` (clickable, includes polls). Keep Pending/Completed. Make completed **poll** cards clickable → results view.
- **`SurveyFlow`** (`features/surveys/components/survey-flow.tsx`): add `surveyType` to the `Survey` type; on submit, **capture** the response and, when `surveyType === 'poll'`, render an aggregated-results view (per-option count + percentage bars) instead of the generic thank-you. If the member has already voted (detail loads with `pollResults` + completed status), show results immediately in read-only mode.
- **Detail page** (`$surveyId.tsx`): now succeeds for members (getSurvey fix). Pass `surveyType`/`pollResults` through to `SurveyFlow`.
- **Delete** dead `poll-card.tsx` + `poll-card.test.tsx`.

## Data flow (member voting on a poll)

```
my/surveys ──GET /surveys?mine=true&available=true──▶ [active surveys, myResponseStatus]
   │ click "Available" poll
   ▼
$surveyId ──GET /surveys/{id}──▶ sanitized active poll { questions, pollResults }  (member read)
   │ SurveyFlow renders single choice question
   ▼ vote
POST /surveys/{id}/responses ──▶ 201 { ...response, pollResults }   (existing handler)
   │
   ▼ SurveyFlow shows result bars from pollResults
```

## Edge cases / guards

- **Anonymous polls** (`settings.anonymous`): `submitResponse` already nulls `responderId`. Results aggregate by answer value, not responder — unaffected. Member's own answered-state for an anonymous survey may not resolve via response row; acceptable for v1 (polls are typically non-anonymous).
- **Deadline passed / not active**: `submitSurveyResponse` already 400s; member read is active-only so an expired-but-active poll still loads and the submit guard handles the race.
- **Duplicate vote**: existing 409 unless `allowReedit`. Results view is the natural landing for an already-voted member.
- **Draft leak**: member `getSurvey` returns `NotFound` for non-active — no draft questions/targetAudience exposure (preserves the FIX-001 intent for drafts while honoring the `["user"]` contract for active surveys).
- **Empty poll results**: `total === 0` → render "No votes yet" rather than a divide-by-zero bar.

## Testing (vertical, per VERTICAL_TDD)

- **Contract (Hurl):** member `getSurvey` 200 on active + 403/404 on draft; `?mine=true&available=true` returns active unanswered for member; `submitSurveyResponse` echoes `pollResults`.
- **Unit (bun):** `findAvailableForMember` LEFT-JOIN — member with no response sees the active survey (`myResponseStatus: null`); answered member sees their status; closed/draft excluded. `getSurvey` sanitization strips `targetAudience`.
- **E2E (Playwright, as the MEMBER):** member@memberry.ph → my/surveys shows an Available poll → opens → votes → sees result bars; revisiting shows results read-only. Verify member can no longer 403 on a survey detail.

## Out of scope (own later cycles)

- **NPS auto-prompt** — consumes 1a (filter `surveyType=nps`) + the existing built-but-unmounted `NpsProvider`/`nps-modal`/`use-pending-nps`. Near-zero backend after this foundation. Separate spec.
- **Half-credit CPD** — unrelated domain (credits/training); DB `integer→numeric` migration. Separate spec. (`db:generate` is NOT broken — stale note; migration 0074 generated 2026-06-20.)
- **`targetAudience` eligibility gating** — unused everywhere today (all org members see all active surveys). Deferred; not built.
