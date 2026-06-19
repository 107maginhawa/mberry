# E2E Spec-Writing Brief — M14 / M18 / M19 / M20

Live stack: API `:7213`, memberry `:3004`, admin `:3003`. READ-ONLY research.
Seed org: `ed8e3a96-8126-4341-be42-e6eb7940c562` / slug `pda-metro-manila`.

Helpers:
- memberry: `apps/memberry/tests/e2e/helpers/{auth.ts,api-fetch.ts,real-flow.ts,independent-read.ts}`
- admin: `apps/admin/tests/e2e/helpers/{auth.ts,test-config.ts}`

**Critical x-org-id note:** memberry's `@/lib/api` (`apps/memberry/src/lib/api.ts`) and the SDK transport send **NO `x-org-id` header ever**. The `apiFetch` helper sends `x-org-id` only when `orgId` passed. When an officer UI omits org context, surveys-detail calls 404/403. Drive those via `apiFetch(page, path, { orgId: ORG_ID })`.

Verdict legend: REAL = wired UI+endpoint, assertable. PLACEHOLDER = no UI / shape mismatch / unmounted / unwired. GAP = no existing e2e.

---

## M14 — National Dashboard (ADMIN app)

ONE route only: `apps/admin/src/routes/national-dashboard/index.tsx` (URL `/national-dashboard`). No per-chapter drill-down route. Frontend gate `<RequireRole allowed={['super']}>` (`index.tsx:29`); backend role `["platform_admin","national_officer"]` (handler treats `super`=platform_admin). Sign in via `signInAsAdmin(context)`.

### WF-084 Review Association Health — REAL
- UI: `/national-dashboard`. Calls (raw `fetch`, no x-org-id; association-scoped by path param):
  - `GET /associations?limit=100` (populates association `<Select>`)
  - `GET /api/admin/national-dashboard/{associationId}?snapshotMonth=YYYY-MM` (opId `getNationalDashboard`, `platform-admin-custom.tsp:377-381`, handler `getNationalDashboard.ts`). `enabled` only after association picked. No body.
- Assertable KPI cards (`index.tsx:136-159`): Chapters=`aggregate.chapterCount`, Total Members=`aggregate.totalMembers`, Collection Rate=`formatPercent(collectionRate)`, CPD Compliance=`formatPercent(cpdComplianceRate)`. Caption: `Snapshot: {month} · Chapters with fewer than 5 members...`.
- States: no-selection "Select an association to view chapter metrics" (`index.tsx:88`); loading skeletons; error red banner + Retry; empty "No chapter snapshots found for {month}".
- **Seed gotcha:** snapshots are relative-dated (`monthStr(daysAgo(n))`, 60d + 30d ago). UI defaults to **current** month which may have NO data. **Pick the prior month explicitly** in the month `<Select>` to hit seeded values. Seeded (PDA Metro Manila, `seed/layer-7-platform.ts:304-336`): ~60d ago collectionRate `0.79` cpd `0.72` total 120; ~30d ago collectionRate `0.81` cpd `0.75` total 128. All chapters ≥5 members so NO "Small chapters" row by default.

### WF-085 Chapter Drill-Down — REAL (in-page table, no detail route)
- Rendered as chapter comparison table inside `/national-dashboard`, fed by same `getNationalDashboard` `chapters[]` (`index.tsx:19`). Columns: Chapter, Total Members, Active, Lapsed, Collection Rate, Total Collected, CPD Compliance, Activity(90d).
- M14-R2 suppression assertable only if a chapter <5 members (synthetic row `chapterName:'Small chapters'`, `getNationalDashboard.ts:33-41`). Default seed won't trigger it.
- Second consumer: `apps/admin/src/routes/associations/$associationId.tsx` calls same endpoint, renders aggregate KPI cards (Members KPI). URL `/associations/{id}`.
- **Backend drill-down endpoints exist but UI never calls them** (gap if you want API-level WF-085): `GET /admin/national/chapters` (`listNationalChapters`), `GET /admin/national/chapters/{organizationId}` (`getNationalChapterDetail`), both roles `["platform_admin","national_officer"]` (`platform-admin-custom.tsp:395,418`).

### WF-086 National Data Export — UI is CLIENT-SIDE ONLY (PLACEHOLDER vs backend)
- "Export CSV" button (`index.tsx:35`), disabled when 0 chapters. `exportChaptersCSV()` builds CSV in-browser from loaded `chapters[]` — **hits no API**. No PDF.
- Backend export EXISTS but **unwired in UI**: `POST /admin/national-dashboard/:associationId/export` (hand-wired `app.ts:486`, NOT in TypeSpec → no role extension; handler `association:operations/exportNationalDashboard.ts` enforces BR-36 platform-admin OR national-officer, else 403). Body `{ snapshotMonth?, format?: 'csv'|'json' }`.
- **Spec it as:** assert the in-browser CSV download (verify download filename `national-dashboard-{month}.csv` + button disabled-when-empty). For backend-auth coverage drive `POST .../export` via API as non-admin → expect 403.

### M14 existing e2e vs gaps
- `apps/admin/tests/e2e/wave7-routes.spec.ts:14-26` — loads page, asserts heading + "Select association". SHALLOW (no association select, no KPI value).
- `:86-101` — association detail Members KPI (conditional).
- `wave7-role-gate.spec.ts:5-27` — unauth blocked.
- **GAPS:** WF-084 KPI value assertions against seed (select prior month); WF-085 table rows / chapter names; WF-086 export (both client CSV + backend 403).

### Idempotency (M14)
All GETs idempotent. Export POST writes a log row + audit + domain event each call (not idempotent), but no UI path triggers it.

---

## M18 — Surveys/Polls (memberry)

Routes: officer `/org/$orgSlug/officer/surveys{,/new,/$surveyId}`, member `/my/surveys{,/$surveyId}` (member NOT org-scoped in URL). Endpoints via raw `@/lib/api` (literal `/api` prefix; Vite proxy strips it).

### WF-102 Survey Results — **PLACEHOLDER (analytics tab broken); Responses tab REAL**
- UI: `apps/memberry/src/routes/.../officer/surveys/$surveyId.tsx` → `features/surveys/components/survey-results.tsx`.
- Endpoints: `GET /api/surveys/{id}` (opId `getSurvey`, `surveys.tsp:457` role `["user"]` but handler officer/admin-gated), `GET /api/surveys/{id}/responses?offset&limit=10` (`listSurveyResponses`, roles `["officer","admin"]`), `GET /api/surveys/{id}/export?format=csv` (`exportSurveyResponses`, `["officer","admin"]`).
- **MISMATCH:** UI Analytics tab expects aggregated per-question stats (`npsBreakdown`, `ratingDistribution`, `responseCount`...) but `getSurvey.ts:58` returns the raw Survey row (no aggregation). Real aggregation is `getSurveyAnalytics` (`/surveys/{id}/analytics`, `surveys.tsp:568`) which the **UI never calls**. → Analytics charts render nothing; header shows "undefined responses". **Do NOT assert NPS gauge / rating bars / response count via UI.**
- **403/404 gotcha:** officer detail `GET /api/surveys/{id}` sends NO query/header → org context undefined → 404/403. **Drive officer detail/responses/export via `apiFetch(page, '/surveys/{id}', { orgId: ORG_ID })`.** Officer LIST works through UI (sends `?organizationId`).
- **Spec it as:** assert Responses tab (REAL) — seeded NPS survey "Member Satisfaction — Q2 2026" has **7 completed responses** (scores `[10,9,9,8,7,6,3]`). For aggregated analytics use API `GET /surveys/{id}/analytics` directly with `x-org-id`.

### WF-103 Quick Poll — **PLACEHOLDER (unmounted)**
- `features/surveys/components/poll-card.tsx` referenced ONLY by its own test. Not rendered in any route/announcement. Shape-mismatches `getSurvey`; would 403 for members. No `poll`-type survey seeded.
- **Recommendation:** tag `@placeholder`/deferred. Cannot be UI-tested. Underlying vote = `POST /api/surveys/{id}/responses` body `{answers:[{questionId,value}]}` (`submitSurveyResponse`, role `["user"]`) if API-only desired.

### Member take-survey (context) — likely REAL BUG
- `/my/surveys/$surveyId.tsx` → `SurveyFlow`. Loads via officer-gated `getSurvey` → **members get 403 → "Survey not found"**. Flag as bug, don't write happy-path UI take-survey expecting success. Submit `POST /surveys/{id}/responses` is REAL. `/my/surveys` list via `listSurveysOptions({query:{mine:true}})` is REAL.

### Seed (M18) — `seed/layer-5-gap-fill.ts:1092`, look up by title (UUIDs runtime)
1. "Member Satisfaction — Q2 2026" — nps, active, anonymous:false. q1 nps + q2 text. **7 completed responses** → 3 promoters/2 passives/2 detractors.
2. "Annual Convention Feedback" — general, draft, anonymous:true. rating + 2 text. No responses.
3. "Continuing Education Needs — 2026" — satisfaction, active, deadline +14d. rating + multi_choice. **One `pending` response per member** (drives /my/surveys Pending card).
- No poll-type seeded.

### M18 existing e2e vs gaps
- `officer-surveys.spec.ts` — officer list loads, stats cards, tab filters (WF-100). `member-surveys.spec.ts` — /my/surveys loads (WF-101). `stubs/survey-anonymity.spec.ts` stub.
- **GAPS:** WF-102 results detail (Responses tab + export); WF-103 (placeholder); survey create submit; member take-survey (bug-blocked); officer row actions (publish/close/delete/clone — `PATCH/DELETE/POST /surveys/{id}{,/clone}`).

---

## M19 — Committees (memberry) — **ALL GENUINE GAPS**

The "1 route + 3 specs" note is WRONG. Reality:
- **ZERO committee routes in memberry** (only an event-type dropdown label `committee_meeting` in `events/index.tsx:30`).
- **ONE committee e2e spec**, a stub: `apps/memberry/tests/e2e/stubs/committee-dissolution.spec.ts` — 1 real test (`unauthenticated → 401` against non-existent `/association/committees/dissolution`) + **5 `test.fixme` placeholders** (don't run). So WF-108 only has an unauth-401 assertion; WF-104..107 have NOTHING.
- **No member-facing committee SDK hooks.** SDK exposes only `GET /admin/committees{,/{id}}` (platform_admin, admin app, read-only).

Two divergent backend models, neither buildable as memberry UI today:
- **(A) `governance.tsp`** — full CRUD spec (`/association/member/committees`, `/committee-seats`, `/committee-meetings`) but **NOT in generated SDK** → no app hooks. Roles: create/update/delete committee + seats = `association:admin`; meetings create = `association:admin`|`committee:chair`.
- **(B) `association:operations/` handlers** (createCommittee/dissolveCommittee/createCommitteeTask...) — **imported nowhere, not wired to any route**. Dead code. This is the model the seed + dissolution stub reference.

Per-flow: all WF-104 (`POST /association/member/committees`), WF-105 (`POST/DELETE /committee-seats`), WF-106 (orphan task handlers, no TypeSpec), WF-107 (`POST /committee-meetings`), WF-108 (orphan `dissolveCommittee`, stub hits non-existent path) → **PLACEHOLDER, no UI, no SDK.**

### Seed (M19) — `seedCommittees` IS run (`seed.ts:159` → `seed/layer-4-cross-module.ts:938`)
Lives in operations-model tables (`committee`/`committee_member`/`committee_task`), visible ONLY via `platform_admin` `GET /admin/committees` (admin app):
- 3 committees: "Executive Board" (active, 4 members), "Events & Programs Committee" (active, 4 members), "Special Projects — Outreach" (completed/dissolved, dissolvedAt -10d, reason "Project completed — outreach program launched successfully.", 3 inactive members). 11 members total.
- 8 tasks (2 completed, 2 in-progress, 2 pending, 1 overdue "Finalize catering arrangements" due -3d, 1 cancelled). No meetings seeded.

### M19 recommendation
Treat WF-104..108 as **all genuine gaps**. Only assertable today: (1) the unauth-401 (already covered), (2) seeded committees via admin-app `GET /admin/committees` as platform_admin. Functional memberry committee e2e requires backend wiring + SDK + UI that do not exist. **Do not write memberry click-through committee specs.** Option: admin-app read spec asserting the 3 seeded committees / dissolved state via `GET /admin/committees`.

### Idempotency (M19)
`dissolveCommittee` guards re-dissolution (`COMMITTEE_ALREADY_DISSOLVED`); `createCommitteeTask` blocks on dissolved committee (`COMMITTEE_DISSOLVED`); create committee/task have no dedupe. `seedCommittees` idempotent (skips if table populated). All academic — endpoints unwired.

---

## M20 — Booking (memberry) — **person-scoped, NOT org-scoped**

Routes under `/my/...`. Booking SDK sends NO x-org-id; API filters by `owner`/`client` personId, roles `event:owner`/`client:owner`/`host:owner`. **No org-header 403 risk.** All seeded booking artifacts owned by **President "Maria Santos" (`president@memberry.ph`)** — use `signInAsOfficer` for owner-scoped assertions; fresh members own nothing. Spec: `booking.tsp`.

### WF-115 Create Booking Event — **REAL (write this one, UI-driven)**
- UI: `apps/memberry/src/routes/_authenticated/my/schedule.tsx` (URL `/my/schedule`) → `features/booking/components/booking-event-editor.tsx`; body builders `features/booking/lib/event-state.ts`.
- GET on load: `getBookingEvent` → `GET /booking/events/me` (404 = no event → empty state). Save: create `POST /booking/events` (`BookingEventCreateRequest`, role `["user"]`) OR update `PATCH /booking/events/{event}` (role `["event:owner","admin"]`).
- Create body: `{title(req), description?, timezone, locationTypes:[video|phone|in-person], status:draft|active, dailyConfigs:{mon..sun:{enabled,timeBlocks:[{startTime"09:00",endTime"17:00",slotDuration 15-480,bufferTime 0-120}]}}, billingConfig?:{price,currency,cancellationThresholdMinutes}}`. UI emits one timeBlock per enabled day. billingConfig omitted when free.
- **Spec it as:** sign in as **fresh member** (gets 404→create path; President owns seeded events). goto `/my/schedule`, assert empty-state subtitle "Publish your weekly availability...", fill title + enable a day + times + toggle Publish, submit, watch `POST /booking/events` → 201, assert toast "Schedule published". Update path → toast "Schedule updated".
- Idempotency: create NOT idempotent (each POST new event); update PATCH idempotent.

### WF-116 Manage Schedule Exceptions — **NO UI (API-only / defer)**
- Grep confirms zero exception UI. Backend: `POST /booking/events/{event}/exceptions` (`createScheduleException`, roles `["event:owner","admin"]`), list/get/delete exist. Body `{startDatetime,endDatetime,timezone?,reason?(max500),recurring,recurrencePattern?}`.
- **Spec it as:** defer or API-only against a President-owned event id (resolve at runtime), authed as President/admin. Not a click-through. Seeded: 3 exceptions on "Member Consultation Slots" (Independence Day +14d, Annual Congress +30d, weekly Monday blackout). Create NOT idempotent (seed dedupes by event+reason; API does not).

### WF-120 Mark No-Show — **NO UI + seed insufficient (defer / backend-shaped)**
- Grep: zero no-show UI (`$bookingId.tsx`/`active-booking-card.tsx` only confirm/reject/cancel/pay). Backend: `POST /booking/bookings/{booking}/no-show` (`markNoShowBooking`, roles `["client:owner","host:owner","admin"]`), body `{reason?}`.
- Preconditions (handler): status MUST be `confirmed`; not already no-show; timing gate — client waits 5min past `scheduledAt`, host waits 10min (`NO_SHOW_TOO_EARLY`). client→`no_show_host`, host→`no_show_client`.
- **Blocker:** NO bookings seeded at all (`layer-7-misc.ts:304` "bookings remain user-generated... empty by design") AND seeded slots are all FUTURE (dayOffset 2-5) → a freshly created booking can't satisfy the past-`scheduledAt` timing gate without DB backdating. **Not testable through normal flows.** Flag as backend/contract test, not UI E2E.

### Booking detail routes (context)
- `my/calendar.tsx`, `my/bookings/host.$personId.tsx`, `my/bookings/host.$personId.$slotId.tsx` — book-a-slot flow (WF-117), person-scoped, auth required.

### Seed (M20) — `seed/layer-7-misc.ts:228-374` (all owned by President)
- 2 events: "Member Consultation Slots" (active, Asia/Manila, video+in-person, Mon-Fri 09:00-17:00 30min), "CPD Advisory Sessions" (draft). IDs runtime (dedupe by title+orgId).
- 8 time_slots on active event, dayOffset 2-5, 09:00 & 10:00 Asia/Manila, 30min, status `available`, all FUTURE.
- 3 schedule_exceptions (above). **NO bookings.**

### M20 existing e2e vs gaps
- `journeys/booking-flow.spec.ts` (WF-117/121, soft `if(hasHosts)`), `booking-host-actions.spec.ts` (WF-118 confirm/reject, soft `if(isHost)`/`if(hasPending)` — vacuous since no pending seeded), `booking-cancel.spec.ts` (WF-119).
- **GAPS:** WF-115 (`/my/schedule` — REAL, write it); WF-116 (no UI → API/defer); WF-120 (no UI + unreachable → defer/contract).

---

## Summary table

| WF | Module | Verdict | Spec approach |
|----|--------|---------|---------------|
| WF-084 | M14 | REAL | admin UI, select prior month, assert KPI vs seed |
| WF-085 | M14 | REAL (in-page table) | assert chapter rows in same page |
| WF-086 | M14 | PLACEHOLDER (client CSV) | assert browser CSV download; API 403 for backend export |
| WF-102 | M18 | Analytics PLACEHOLDER / Responses REAL | assert Responses tab (7 seeded); analytics via API `/analytics` + x-org-id |
| WF-103 | M18 | PLACEHOLDER (unmounted) | defer/@placeholder |
| WF-104..108 | M19 | ALL GAPS (no UI/SDK) | defer memberry; optional admin `GET /admin/committees` read spec |
| WF-115 | M20 | REAL | memberry `/my/schedule` UI, fresh member, assert POST 201 + toast |
| WF-116 | M20 | NO UI | API-only/defer (President-owned event) |
| WF-120 | M20 | NO UI + unreachable | defer/contract (needs backdated booking) |
