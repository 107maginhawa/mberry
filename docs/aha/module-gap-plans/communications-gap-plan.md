# AHA Module/Group Gap Plan: Communications (+ feed)

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Communications (+ professional-feed surface) |
| Module slug | `communications` |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/communications-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m07-communications/MODULE_SPEC.md` (v2.0, 2026-05-21); `docs/architecture/COMMS-CONSOLIDATION.md` |
| Supporting PRDs/specs used | `docs/product/modules/m13-professional-feed/MODULE_SPEC.md` (feed surface only); `docs/quality/HAND_WIRED_ROUTES.yaml`; m07 `API_CONTRACTS.md`/`NAVIGATION_MAP.md` (located, not load-bearing for findings) |
| PRD/spec coverage quality | Strong (m07) / Partial (m13 feed — ranking/moderation rules open) |
| Paths inspected | `services/api-ts/src/handlers/communication/` (all handlers, repos, jobs), `specs/api/src/association/core/communication.tsp`, `specs/api/src/association/operations/announcements.tsp`, `services/api-ts/src/generated/openapi/{routes,registry,validators}.ts`, `services/api-ts/src/app.ts`, `services/api-ts/src/core/{domain-event-consumers.ts,domain-events.registry.ts}`, `services/api-ts/src/middleware/{auth.ts,require-position.ts}`, `services/api-ts/src/seed/{layer-2-users.ts,layer-7-comms.ts}`, `apps/memberry/src/features/communications/`, `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications/`, `apps/memberry/src/routes/_authenticated/dashboard.tsx`, `apps/admin/src/routes/communications/`, `specs/api/tests/contract/{communications-flow,communications-extended-flow,communication-gaps-flow,feed-moderation,assoc-message-templates-flow,assoc-subscriptions-flow}.hurl`, `apps/memberry/tests/e2e/{journeys/communication-delivery,officer/communications}.spec.ts` |
| PRDs/specs inspected | m07 MODULE_SPEC, m13 MODULE_SPEC, COMMS-CONSOLIDATION.md, HAND_WIRED_ROUTES.yaml |
| KG used | Yes (status doc as context; all findings verified by direct code inspection) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status doc only; product docs richer) |
| `/understand-domain` refreshed | No |
| Webwright used | No — Static review sufficient; browser tooling skipped for batch run. |
| Playwright/E2E inspected | Yes (inspected existing specs only; none executed, none modified) |
| Existing tests inspected | 26 unit test files in `handlers/communication/`, 6+ Hurl contract files, 4+ E2E/component spec files |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | Static review sufficient; browser tooling skipped for batch run. Runtime behavior (HTTP capture, cron firing) not executed — wiring conclusions drawn statically from registration code; `orgContextMiddleware` x-org-id validation depth marked `[NEEDS CONFIRMATION]`. Realtime comms (`handlers/comms/`) explicitly excluded (separate audit). Email/notifs delivery internals treated as `[SHARED DEPENDENCY]`. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M07 Communications spec | `docs/product/modules/m07-communications/MODULE_SPEC.md` | PRD/module spec | Current (2026-05-21) but §10 TypeSpec note is **stale** — claims 28 broadcast handlers "hand-wired, no TypeSpec"; in reality `association/core/communication.tsp` + `association/operations/announcements.tsp` define them and they are generated-route registered | Primary requirements: WF-046..050, M7-R1..R6, BR-26/BR-28, ACs 001–006 |
| M13 Professional Feed spec | `docs/product/modules/m13-professional-feed/MODULE_SPEC.md` | PRD/module spec | Current but pre-implementation (says "No existing handler code — scaffold `handlers/feed/`"); actual partial code lives in `handlers/communication/` | Feed surface noted here; feed audit itself deferred per index §20 |
| Comms consolidation | `docs/architecture/COMMS-CONSOLIDATION.md` | architecture decision | Current | Confirms 4-module boundary (communication/comms/email/notifs); validates scope cut |
| Hand-wired route allowlist | `docs/quality/HAND_WIRED_ROUTES.yaml` | API contract | **Stale for this module** — entries 107–109 say schedule/stats "not in TypeSpec"; both ARE in `announcements.tsp` and generated `routes.ts` | Drives duplicate-registration finding |
| m07 API_CONTRACTS / NAVIGATION_MAP | `docs/product/modules/m07-communications/` | API contract / nav spec | Current | Secondary |
| Module audit index | `docs/aha/outputs/module-audit-index.md` | audit index | Current | Scope: §5 row "Communications", §15 fan-out journey, §16 row 9, §20 feed deferral |

## 3. Expected vs Actual

**Expected (m07):** Officers compose announcements, target an audience, send now or schedule; the system delivers in-app (always), email/push per member preference, skips suppressed members, tracks sent/delivered/opened stats; members manage per-topic per-channel preferences; templates with Handlebars variables support reuse; scheduled items fire within 5 minutes via pg-boss.

**Actual:**

- **The announcement delivery pipeline is dead end-to-end.** `publishAnnouncement` (`handlers/communication/publishAnnouncement.ts`) flips status to `sent` and emits `announcement.published`, but **no subscriber exists** for any `announcement.*` event (`core/domain-event-consumers.ts` has zero `domainEvents.on('announcement…')`), and `processAnnouncementSend` (the only fan-out implementation, `handlers/communication/jobs/announcementSend.ts`) is never called on publish. The scheduled path is equally dead: `registerCommunicationJobs` (`announcementSend.ts:265`) is **never invoked** — `app.ts` initialization (lines 671–683) registers email/notifs/audit/booking/dues/person/membership/survey/breach/ticket jobs but **not communication**. Result: no in-app notifications, no email, no push, no stats — ever. (Verified: `grep registerCommunicationJobs` → 1 definition, 0 call sites.)
- **The officer compose UI cannot actually send.** `apps/memberry/src/features/communications/components/compose-form.tsx` "Send Now" POSTs `status:'sent'` in the create body; `createAnnouncement.ts:31` force-sets `status:'draft'` (verified: `status: 'draft'` is literal in the repo.create call). The "Schedule" button likewise never calls `/communications/announcements/:id/schedule`; `AnnouncementUpdateRequestSchema` (validators.ts:583) strips `status` on PATCH. Officer sees success and navigates away believing the announcement went out.
- **Member notification preferences are broken both directions.** Frontend (`notification-preferences.tsx`) reads `data.data` but the handler returns `{items,total,offset,limit}` (verified at `listPersonSubscriptions.ts:32`) — violating its own OpenAPI contract (`PersonSubscriptionListResponseSchema` = `{data,pagination}`, validators.ts:7603); and saves synthetic topicIds like `"dues-email"` into a `uuid` column (`personSubscriptions.topicId`, communication.schema.ts:111) → runtime uuid-cast failure.
- Templates/messages/subscription-topics/saved-segments endpoints are generated with **legacy roles `["admin","coordinator"]`** (verified: `communication.tsp` lines 377/391/404/433/446/464/478/491/520/533/548/564/582/759/771/784 use `x-security-required-roles #["admin","coordinator"]`) that no officer holds (seeded officers get `association:admin,association:member,association:officer` — `seed/layer-2-users.ts:141`; no `coordinator` role exists anywhere) → officers 403 on the very flows the spec assigns them (WF-047).
- Messages subsystem (14 `/association/messages*` endpoints) is registered and tested but has **zero frontend consumers**, and `sendMessage.ts` only flips status `draft→sending→sent` — no actual channel delivery, no `message.sent` subscriber.
- **Feed (m13 surface):** `createFeedPost/listFeedPosts/getFeedPost/deleteFeedPost/muteAuthor/reportFeedPost` handlers + `feed-post.schema.ts` (4 tables, migrated, seeded by `seed/layer-7-comms.ts`) exist but appear in **no TypeSpec, no OpenAPI path, no registry, no app.ts route** — fully unwired dead code (verified: `grep feed` in `routes.ts` → 0 hits; `registry.ts` → 0 hits). No feed UI exists in memberry; `apps/admin/src/routes/communications/moderation.tsx` renders placeholder data. Feed contract test `feed-moderation.hurl` is self-marked "FULLY ORPHANED". Feed work is deferred `[NEEDS PRODUCT DECISION]` per index §20.
- What does work: announcement CRUD + state guards (draft-only update/delete, publish from draft/scheduled, archive), template CRUD + preview merge fields, message CRUD with real BR-28 dedup (`createMessage.ts:33-45`), suppression filtering (M7-R5) inside `sendMessage.ts` and `resolveRecipients`, member dashboard pull-surface (`dashboard.tsx:113` fetches `?status=sent`), contract tests for endpoint surface.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-046 Send Announcement | Compose→target→send/schedule→delivery per channel | CRUD works; delivery never fires (no job registration, no event subscriber, no direct call); compose UI never invokes publish/schedule endpoints | `compose-form.tsx:79-103,229-245` | `publishAnnouncement.ts`; `announcementSend.ts:265` uncalled; `app.ts:671-683` | `announcement` table OK | `announcementSend.test.ts` tests fan-out fn in isolation only | Partially Implemented | **Yes — P0** |
| WF-047 Message Templates | Officers create/edit templates | Handlers + UI exist; routes require `admin/coordinator` roles officers don't have | `template-form.tsx:132-134` | `routes.ts:1924-1930`; `communication.tsp:377` | `message_template` | `015-announcements-templates.test.ts`; hurl runs as super-admin | Partially Implemented | **Yes — P1** |
| WF-048 Delivery Stats | Sent/delivered/opened per announcement | Stats rows only created inside dead fan-out; analytics page reads `stats` off list endpoint which never joins stats | `analytics.tsx:55-63` | `communication.repo.ts:262-276` (list has no stats join); `getAnnouncementStats.ts` | `announcement_stats` | none asserting stats populated on publish | Missing (at runtime) | **Yes — P1** |
| WF-049 Communications Dashboard | Officer list, drafts, scheduled | Implemented | `officer/communications/index.tsx`, `sent.tsx`, `$announcementId.tsx` | `listAnnouncements.ts` | — | `officer/communications.spec.ts` | Implemented | No |
| WF-050 Email Opt-Out Mgmt | Member per-topic per-channel toggles | UI exists; load broken (response-shape mismatch), save broken (string topicId vs uuid column) | `notification-preferences.tsx:74-116` | `listPersonSubscriptions.ts:32` vs `PersonSubscriptionListResponseSchema` (validators.ts:7603); `bulkUpdatePersonSubscriptions.ts:28-36`; `communication.repo.ts:238-247` | `person_subscription.topic_id uuid` | `bulkUpdatePersonSubscriptions.test.ts` (uuid inputs — masks bug) | Partially Implemented | **Yes — P0** |
| M7-R1 in-app mandatory | Cannot disable in-app | Cron path hardcodes `inApp:true` (announcementSend.ts:282); no guard in subscription handlers; prefs UI offers an In-App toggle freely | `notification-preferences.tsx:49` | `updatePersonSubscription.ts` (no channel guard) | topic has single `channel` column | `ac-m07.communications.test.ts` tests inline reimplementation only | Partially Implemented | Yes — P2 |
| M7-R2 email opt-out respected | Skip opted-out members | Filter exists in fan-out (announcementSend.ts:146-171) but keys on any `enabled=false` row (not per-topic/channel) and pref rows can never be written (see WF-050) | — | `announcementSend.ts:150-166` | — | `announcementSend.test.ts` | Partially Implemented | Yes — P2 |
| M7-R3 scheduled delivery ≤5min | Cron processes scheduled | Cron handler written (`*/5` cron) but never registered | — | `announcementSend.ts:271`; `app.ts:671-683` | `scheduledAt` column | none for registration | Missing (at runtime) | **Yes — P0 (same root as WF-046)** |
| M7-R4 missing var → placeholder | Graceful render fallback | `renderMergeFields` Handlebars `strict:false` (missing var → empty, not placeholder); preview leaves `{{var}}` literal; no Handlebars syntax validation on template save | — | `announcementSend.ts:28-36`; `previewMessageTemplate.ts:37`; `createMessageTemplate.ts` (no validation) | — | `communication.test.ts:237` | Partially Implemented | Yes — P3 |
| M7-R5 suppressed members skipped | Deceased/suppressed get nothing | Implemented in `resolveRecipients` (status filter) and `sendMessage.ts:52-85` | — | `announcementSend.ts:58-62` | membership.status | `announcementSend.test.ts`, `sendMessage.test.ts` | Implemented | No |
| M7-R6 high-priority push override | Push regardless of prefs | No `priority` field on schema, no override logic anywhere | — | `communication.schema.ts:150-168` (no priority) | spec §7 expects `priority` | `ac-m07` inline-only | Missing | Yes — P2 |
| BR-26 channel prefs per category | Per-category toggles honored | Topic/category model exists; enforcement coarse + prefs pipeline broken | — | see WF-050 / M7-R2 | `subscription_topic.category` | `br-26.session-management.test.ts` (misnamed; session scope) | Partially Implemented | Yes — P2 |
| BR-28 dedup window | Suppress duplicate sends | Real implementation in `createMessage.ts:33-45` + `repo.findDuplicatesSentToday` | — | `createMessage.ts` | `message.recipients` jsonb | `communication.test.ts:261` (inline logic) + handler tests | Implemented | Test-quality note only |
| AC-M07-001..006 | Six acceptance criteria | 001/006 implemented only in test-local reimplementations; 002 partial; 003 dead; 004 dead; 005 implemented | — | as above | — | `ac-m07.communications.test.ts` (pure inline domain fns — does not exercise handlers) | Implemented but Untested (005) / Missing (003,004,006) | Yes |
| Spec §8 Announcement `Cancelled` state | Draft/Scheduled → Cancelled | Enum `announcement_status` has no `cancelled`; no cancel endpoint for announcements | — | `communication.schema.ts:142-144`; OpenAPI has no announcement cancel path | enum | — | Missing | Yes — P3 |
| Spec §7 title ≤300 chars | Title max 300 | Schema + validator cap at 200 | `compose-form.tsx maxLength=200` | `validators.ts:484` | `title varchar(200)` | — | Unclear (spec vs code mismatch) | P3 |
| Spec §7 template name unique per org | Unique name/org | No unique index, no handler check | — | `createMessageTemplate.ts` | `message_template` (only org/category idx) | — | Missing | P3 |
| Spec §10 TypeSpec coverage note | "28 handlers hand-wired, no TypeSpec" | False — all broadcast ops in `communication.tsp`/`announcements.tsp`, generated-registered | — | `routes.ts:1924-2840` | — | — | Stale spec text | P3 doc fix |
| m13 feed (surface note) | Org feed, posts, moderation, mute | Handlers/tables/seeds exist; zero routes, zero UI; admin moderation page placeholder | `apps/admin/src/routes/communications/moderation.tsx:22` | no OpenAPI feed/poll paths (verified against `dist/openapi/openapi.json`; `grep feed routes.ts` = 0) | `feed_post`+3 tables migrated & seeded | `ac-m13`/`m13`/`br-35` tests are inline-only | Missing (deferred) | V2 DEFERRED + dead-code cleanup |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| WF-046/M7-R3/AC-M07-003/004 | Entire announcement delivery dead: `registerCommunicationJobs` never called; no `announcement.published` subscriber; `processAnnouncementSend` uncalled on publish | P0 | V1 REQUIRED | `app.ts:670-683`; `announcementSend.ts:265,271`; `grep domainEvents.on('announcement` → 0 hits; `grep registerCommunicationJobs` → 0 call sites | Register communication jobs at init AND invoke fan-out on publish (direct call or event subscriber in `domain-event-consumers.ts`) |
| WF-046 (UI) | "Send Now"/"Schedule" buttons create a draft and never publish/schedule; server silently ignores requested status | P0 | V1 REQUIRED | `compose-form.tsx:79-103,229-245`; `createAnnouncement.ts:31` (`status:'draft'` literal); `validators.ts:583` (update strips status) | Compose flow must chain create → `/publish` or `/schedule`; or detail-page-only publish with honest UX copy |
| WF-050/BR-26 | Preferences load broken (`{items}` vs contract `{data,pagination}`) and save broken (string topicId → uuid column) | P0 | V1 REQUIRED | `listPersonSubscriptions.ts:32`; `validators.ts:7603`; `notification-preferences.tsx:77,103,52-54`; `communication.schema.ts:111` | Fix handler response shape to contract; map UI category-channel keys to seeded topic UUIDs (or add slug column) |
| Spec §6 permissions | Officers cannot reach templates/messages/topics/segments: routes demand literal `admin`/`coordinator` roles that don't exist in role model | P1 | V1 REQUIRED | `communication.tsp:377,464,582,759`; `routes.ts:1926,2061,2829`; `seed/layer-2-users.ts:141`; `utils/auth.ts:86-105` | Re-role TypeSpec extensions to `association:officer`/`x-require-position` and regenerate |
| Tenant isolation (implied; spec §6 GA+HG) | Announcement mutations fetch by id with no org match; position check resolves org from caller's header, not the announcement's org → cross-org publish/update/delete/archive | P1 | V1 REQUIRED | `publishAnnouncement.ts:25` (`repo.get(params.id)` no orgId; org read from `ctx.get('organizationId')`); same shape in `updateAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts` | Add org match to fetch (`repo.get(id, orgId)` or post-fetch assert `existing.organizationId === ctxOrgId`) before status mutation |
| WF-048 Delivery Stats | Analytics page reads stats off list endpoint which never joins/populates stats; stats only written by dead fan-out | P1 | V1 REQUIRED | `analytics.tsx:55-63`; `communication.repo.ts:262-276`; `getAnnouncementStats.ts` | Once delivery is wired, ensure list/stats endpoints surface populated `announcement_stats`; add stats-on-publish assertion test |
| M7-R6 high-priority push override | No `priority` field, no override of member prefs for urgent push | P2 | V2 DEFERRED | `communication.schema.ts:150-168` (no priority col); spec §7 | Add `priority` column + override branch in fan-out; defer until delivery pipeline lives |
| M7-R1 in-app mandatory | In-app toggle freely offered to members; no server guard preventing in-app opt-out for announcements | P2 | V1 RECOMMENDED | `notification-preferences.tsx:49`; `updatePersonSubscription.ts` (no channel guard) | Guard in subscription handler: reject/ignore in-app=false for mandatory topics; gray out toggle in UI |
| Spec §8 `Cancelled` announcement state | No cancel transition/endpoint; enum lacks `cancelled` | P3 | V2 DEFERRED | `communication.schema.ts:142-144`; OpenAPI lacks cancel path | Add enum value + cancel endpoint when scheduling is real |
| Spec §10 stale TypeSpec note | Spec text claims handlers hand-wired/no TypeSpec; false | P3 | V1 RECOMMENDED | `m07 MODULE_SPEC §10`; `communication.tsp` exists | Doc-only correction (not code) |
| m13 feed surface | Handlers/tables/seeds exist but fully unwired; placeholder admin moderation page; orphaned contract test | P2 | V2 DEFERRED | `feed-post.schema.ts`; `grep feed routes.ts`=0; `moderation.tsx:22`; `feed-moderation.hurl` ("FULLY ORPHANED") | Decide: scaffold per m13 OR remove dead code. `[NEEDS PRODUCT DECISION]` per index §20 |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Messages subsystem (14 `/association/messages*` endpoints: create/get/list/update/delete/send/schedule/cancel) | `handlers/communication/{createMessage,sendMessage,scheduleMessage,cancelMessage,...}.ts`; `routes.ts` ~`/association/messages`; `assoc-messages-flow.hurl` | m07 spec describes "Message Template" + "Scheduled Message" terms but WF list (WF-046..050) is announcement-centric; no member/officer UI consumes messages | Dead surface — registered + tested but **zero frontend consumers**; `sendMessage` flips status only, no channel delivery, no `message.sent` subscriber | Keep but clarify — confirm whether messages are the intended fan-out primitive (then wire one path) or announcement is. `[NEEDS PRODUCT DECISION]` — do not expand both in parallel `[DO NOT OVERBUILD]` |
| Saved segments (`createSavedSegment`/`listSavedSegments`/`audience-picker.tsx`) | `handlers/communication/savedSegment*.ts`; `audience-picker.tsx` | m07 WF-046 mentions "target audience" but no segment-persistence requirement | Adds CRUD + storage surface without a delivery pipeline to consume it | Keep but clarify; do not expand until WF-046 delivery is real |
| Feed posts / mute / report (m13 surface) | `feed-post.schema.ts` (4 tables), `createFeedPost.ts` etc., `seed/layer-7-comms.ts` | m13 spec says "no existing handler code — scaffold `handlers/feed/`"; reality contradicts spec | Dead code in wrong module; 4 unused tables; orphaned contract test | Move to V2 / Consider removal later — `[NEEDS PRODUCT DECISION]` per index §20 |
| `delivery-funnel.tsx` analytics component | `apps/memberry/src/features/communications/components/delivery-funnel.tsx` | Implies a populated delivery funnel; stats never populated | Misleading "looks done" UI bound to empty data | Keep but clarify — only meaningful once stats pipeline lives |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-046 Send Announcement | Officer | "Send Now"/"Schedule" in compose | compose → target audience → send/schedule → fan-out per channel → stats | CRUD + state guards work; fan-out + scheduling fully dead; UI never publishes | **Yes — P0** | `compose-form.tsx`; `publishAnnouncement.ts`; `announcementSend.ts:265,271`; `app.ts:671-683` |
| WF-047 Message Templates | Officer | Template editor | create/edit template, Handlebars vars, preview | Handlers + UI + preview work, but officers 403 (role mismatch) | **Yes — P1** | `template-form.tsx`; `communication.tsp:377`; `seed/layer-2-users.ts:141` |
| WF-048 Delivery Stats | Officer | View announcement analytics | list/aggregate sent/delivered/opened | Page renders; data never populated (stats path dead) | **Yes — P1** | `analytics.tsx:55-63`; `communication.repo.ts:262-276` |
| WF-049 Comms Dashboard | Officer | Open communications nav | list drafts/scheduled/sent | Implemented | No | `officer/communications/index.tsx`; `listAnnouncements.ts` |
| WF-050 Email Opt-Out | Member | Open notification settings | view topics, toggle channels, save | UI present; load + save both broken | **Yes — P0** | `notification-preferences.tsx`; `listPersonSubscriptions.ts:32`; `communication.schema.ts:111` |
| Announcement fan-out (index §15 journey) | System | publish event / cron | resolve recipients → filter suppressed/opted-out → enqueue email+push+in-app → write stats | Implementation exists in `announcementSend.ts` but never reached at runtime | **Yes — P0** | `announcementSend.ts`; no subscriber; no job registration |
| Professional Feed (m13 surface) | Member/Officer/Moderator | Post / view feed / report | post → list ranked → moderate/mute | Handlers + tables exist; zero routes/UI | V2 DEFERRED | `feed-post.schema.ts`; `grep feed routes.ts`=0; `moderation.tsx` placeholder |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Compose announcement (draft) | Save draft | Implemented | `createAnnouncement.ts` | V1 REQUIRED | Force-drafts (correct for create) |
| Publish (send now) | Status→sent + trigger fan-out | Partially Implemented | `publishAnnouncement.ts` emits event with no subscriber | V1 REQUIRED | Event has no consumer → no delivery |
| Schedule announcement | Set scheduledAt; cron fires ≤5min | Missing (at runtime) | `announcementSend.ts:271` cron unregistered | V1 REQUIRED | Cron handler exists, never registered |
| Resolve recipients | Audience → person list, suppress filtered | Implemented | `resolveRecipients` / `announcementSend.ts:58-62` | V1 REQUIRED | Logic correct but unreachable |
| Apply opt-out prefs | Skip per-topic/per-channel opted-out | Partially Implemented | `announcementSend.ts:150-166` keys on coarse `enabled=false` | V1 REQUIRED | Coarse + pref rows can't be written (WF-050) |
| Enqueue email/push/in-app | Dispatch per channel via email/notifs | Partially Implemented | `announcementSend.ts:200+` calls email/notifs services | V1 REQUIRED | Unreachable; `[SHARED DEPENDENCY]` on email/notifs |
| Write delivery stats | Persist sent/delivered/opened | Missing (at runtime) | `announcement_stats` only written in dead fan-out | V1 REQUIRED | Stats forever empty |
| Member adjusts prefs | Load topics, toggle, save | Partially Implemented | `notification-preferences.tsx`; `listPersonSubscriptions.ts:32` | V1 REQUIRED | Load shape + save type both broken |
| In-app mandatory guard | In-app not disableable for announcements | Partially Implemented | UI offers toggle; no server guard | V1 RECOMMENDED | M7-R1 |
| Template create/preview | Handlebars vars, missing-var fallback | Partially Implemented | `previewMessageTemplate.ts:37`; `renderMergeFields` strict:false | V1 RECOMMENDED | Missing var → empty, not placeholder (M7-R4) |
| Officer role access | Officers reach templates/topics/segments | Missing | `communication.tsp` admin/coordinator roles | V1 REQUIRED | 403 for real officers |
| Feed post/list/moderate | Org feed surface | Missing | unwired handlers | V2 DEFERRED | Deferred per index §20 |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Create announcement draft | Officer | Persist draft | Implemented | No | V1 REQUIRED | `createAnnouncement.ts` |
| Send announcement immediately | Officer | Deliver to audience now | Partially Implemented | **Yes** | V1 REQUIRED | `publishAnnouncement.ts`; no subscriber |
| Schedule announcement | Officer | Deliver later via cron | Missing (runtime) | **Yes** | V1 REQUIRED | `announcementSend.ts:271` unregistered |
| Target audience / segment | Officer | Choose recipients | Partially Implemented | Yes | V1 REQUIRED | `audience-picker.tsx`; `resolveRecipients` |
| View delivery stats | Officer | sent/delivered/opened | Missing (runtime) | **Yes** | V1 REQUIRED | `analytics.tsx`; empty stats |
| Manage notification prefs | Member | Toggle per channel/topic | Partially Implemented | **Yes** | V1 REQUIRED | `notification-preferences.tsx` broken both ways |
| Receive in-app announcement | Member | See in dashboard | Partially Implemented | Yes | V1 REQUIRED | `dashboard.tsx:113` pulls `?status=sent`; relies on dead fan-out for notif rows |
| Create/edit template | Officer | Reusable templates | Partially Implemented | **Yes** | V1 REQUIRED | `template-form.tsx`; role 403 |
| Preview template | Officer | Render with sample vars | Implemented | Minor | V1 RECOMMENDED | `previewMessageTemplate.ts` (missing-var fallback weak) |
| Save/reuse segments | Officer | Persisted audience | Implemented (unconsumed) | Possible overbuild | V2 DEFERRED | `savedSegment*.ts` |
| Send direct message | Officer | Messaging primitive | Implemented (no delivery, no UI) | Possible overbuild | V2 DEFERRED | `sendMessage.ts` flips status only |
| Feed post / moderate | Member/Mod | Org feed | Missing | Deferred | V2 DEFERRED | unwired |
| Cancel announcement | Officer | Cancel scheduled | Missing | Minor | V2 DEFERRED | no enum/endpoint |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| Announcement delivery pipeline entirely dead | Backend wiring (jobs + events) | `P0` | V1 REQUIRED | `app.ts:671-683` (no `registerCommunicationJobs`); `announcementSend.ts:265,271`; 0 `announcement.published` subscribers | Core product promise (broadcast to members) never executes; no email/push/in-app/stats ever | Register communication jobs at init; subscribe to `announcement.published` in `domain-event-consumers.ts` (or direct call in `publishAnnouncement`) |
| Compose UI cannot send/schedule | Frontend → API | `P0` | V1 REQUIRED | `compose-form.tsx:79-103,229-245`; `createAnnouncement.ts:31`; `validators.ts:583` | Officer believes announcement sent; it silently stays a draft → trust + operational failure | Chain create→publish/schedule; or restrict send to detail page with honest UX |
| Notification preferences load + save broken | Frontend ↔ API ↔ schema | `P0` | V1 REQUIRED | `listPersonSubscriptions.ts:32` vs `validators.ts:7603`; `bulkUpdatePersonSubscriptions.ts`; `communication.schema.ts:111` (uuid col) | Members cannot opt out → legal/trust risk; save throws uuid cast error | Fix response shape to contract; map UI keys to seeded topic UUIDs (or add slug) |
| Officer role mismatch blocks WF-047/topics/segments | Permissions/RBAC | `P1` | V1 REQUIRED | `communication.tsp` `["admin","coordinator"]` (18 ops); `seed/layer-2-users.ts:141`; no `coordinator` role exists | Spec assigns these flows to Officers; officers get 403 → workflows unusable | Re-role to `association:officer` / `x-require-position`, regenerate |
| Cross-org announcement mutation (no tenant match on fetch) | Permissions/tenant isolation | `P1` | V1 REQUIRED | `publishAnnouncement.ts:25` (`repo.get(id)` no org); position check uses caller header org | Officer of Org A could publish/delete Org B's announcement by id | Add org match to fetch / assert `existing.organizationId === ctxOrgId` before mutate `[NEEDS CONFIRMATION on `repo.get` signature]` |
| Delivery stats never populated | Backend/state | `P1` | V1 REQUIRED | `analytics.tsx:55-63`; `communication.repo.ts:262-276`; stats only in dead fan-out | WF-048 dashboard shows empty/misleading data | Surface populated `announcement_stats` once delivery wired; add assertion test |
| Template missing-var renders empty (not placeholder) | Backend render | `P3` | V1 RECOMMENDED | `announcementSend.ts:28-36`; `previewMessageTemplate.ts:37` (Handlebars strict:false) | M7-R4 fallback wrong; silent blank content | Set graceful placeholder; validate Handlebars syntax on save |
| Feed dead code in communication module | Dead code / module boundary | `P2` | V2 DEFERRED | `feed-post.schema.ts`; `grep feed routes.ts`=0; `moderation.tsx` placeholder | 4 unused tables + orphaned test create confusion; m13 spec contradicts reality | Decide scaffold-vs-remove `[NEEDS PRODUCT DECISION]` per index §20 |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Officer "Send Now" announcement | Announcement delivered to members | Saved as draft; nothing sent; success toast shown | `compose-form.tsx:79-103`; `createAnnouncement.ts:31` | `P0` | E2E: create→send→assert recipient sees in-app + email enqueued; assert status=sent |
| Officer "Schedule" announcement | Fires at scheduledAt | scheduledAt stored but cron unregistered → never fires | `compose-form.tsx:229-245`; `announcementSend.ts:271`; `app.ts:671-683` | `P0` | Integration: register job, advance clock/poll, assert send |
| Member opens notification settings | Topics + toggles load | `data.data` undefined (handler returns `{items}`) → empty/blank UI | `notification-preferences.tsx:77`; `listPersonSubscriptions.ts:32` | `P0` | Component/integration: assert topics render from contract shape |
| Member saves preferences | Persist toggle | uuid cast error (string topicId → uuid column) | `bulkUpdatePersonSubscriptions.ts:28-36`; `communication.schema.ts:111` | `P0` | Integration: save with real topic UUID; assert persisted + reload reflects |
| Officer edits a template | Template saved | 403 (officer lacks admin/coordinator role) | `template-form.tsx`; `communication.tsp:377`; `seed/layer-2-users.ts:141` | `P1` | RBAC test: officer role → 2xx on template CRUD |
| Officer views delivery analytics | Sent/open rates shown | Empty/zero data (stats never written) | `analytics.tsx:55-63`; `delivery-funnel.tsx` | `P1` | Integration: publish→assert stats populated→assert analytics renders |
| Cross-org publish by id | 403/404 for foreign org | Likely succeeds (no org match on fetch) | `publishAnnouncement.ts:25` | `P1` | RBAC test: Org A officer publishes Org B announcement → expect 403/404 |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `registerCommunicationJobs` | Service not called | `announcementSend.ts:265` defined; 0 call sites; `app.ts:671-683` omits it | Entire scheduled-delivery + fan-out infra never runs | Wire into `app.ts` init (P0) |
| `processAnnouncementSend` fan-out | Service not called | `announcementSend.ts`; no `announcement.published` subscriber | Core delivery never executes | Invoke via subscriber/direct call (P0) |
| Messages subsystem (14 endpoints) | APIs with no frontend consumers | `assoc-messages-flow.hurl`; no memberry/admin UI imports `useSendMessage` etc. | Maintained surface that does nothing user-facing | Clarify intent; do not expand `[DO NOT OVERBUILD]` |
| Saved segments | APIs/UI with no downstream enforcement | `savedSegment*.ts`; `audience-picker.tsx`; no fan-out consumes saved segment | Stored audiences never used to deliver | Keep but clarify; gate behind real delivery |
| Feed handlers + 4 tables + seed | Dead code (no routes/registry/UI) | `feed-post.schema.ts`; `grep feed routes.ts`=0; `registry.ts`=0; `seed/layer-7-comms.ts` | Dead schema/seed/test confusion; module-boundary leak | Remove or scaffold per product decision |
| `announcement_stats` writes | Fields saved but never populated at runtime | only written inside dead fan-out | Analytics shows misleading empty data | Populate once delivery wired |
| `feed-moderation.hurl` | Dead/orphaned test | file self-marked "FULLY ORPHANED" | False signal in contract suite | Quarantine/remove with feed decision |
| In-app toggle in prefs UI | UI with no backend enforcement | `notification-preferences.tsx:49`; no server guard | Member can opt out of mandatory in-app (M7-R1) | Add server guard + UI disable |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `person_subscription.topic_id` is `uuid` but UI sends synthetic string keys (`"dues-email"`) | schema/model + UI | `communication.schema.ts:111`; `notification-preferences.tsx:52-54`; `bulkUpdatePersonSubscriptions.ts:28-36` | `P0` | Map UI keys → seeded topic UUIDs, or add `slug` column + lookup |
| `listPersonSubscriptions` returns `{items,total,offset,limit}` violating `PersonSubscriptionListResponseSchema` (`{data,pagination}`) | API contract | `listPersonSubscriptions.ts:32`; `validators.ts:7603` | `P0` | Conform handler to generated response schema |
| Announcement fetch lacks org scoping in mutation handlers | API/backend | `publishAnnouncement.ts:25`; analog in update/delete/archive | `P1` | Org-scoped fetch / explicit org assertion |
| `announcement_status` enum has no `cancelled` | schema/model | `communication.schema.ts:142-144`; spec §8 | `P3` | Add enum value when scheduling real |
| `title varchar(200)` vs spec §7 "≤300" | schema/model | `validators.ts:484`; spec §7 | `P3` | Reconcile spec vs code (likely spec wins, but confirm) |
| `message_template` no unique (name, org) constraint | schema/model | `createMessageTemplate.ts`; schema indexes | `P3` | Add unique index + handler pre-check (V2) |
| Handlebars `strict:false` → missing var renders empty | backend/service | `announcementSend.ts:28-36` | `P3` | Placeholder fallback per M7-R4 |
| Survey schema co-located in `communication/repos` | module boundary | index §16 row 180 `[NEEDS CONFIRMATION]` | `P3` | Note for db-schema audit; out of scope here `[CROSS-MODULE RISK]` |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 18 communication ops require `["admin","coordinator"]`; `coordinator` role does not exist; officers lack `admin` | Officer access to templates/topics/segments/messages | `communication.tsp:377,391,404,433,446,464,478,491,520,533,548,564,759,771,784`; `seed/layer-2-users.ts:141`; `utils/auth.ts:86-105` | `P1` | Re-role to `association:officer` / `x-require-position`; regenerate routes |
| Announcement mutations not org-scoped on fetch; position check derives org from caller header, not the record | Tenant isolation | `publishAnnouncement.ts:25`; `updateAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts` | `P1` | Enforce org match before mutate `[NEEDS CONFIRMATION on repo.get signature]` |
| In-app mandatory channel not enforced server-side | Member preference integrity (M7-R1) | `updatePersonSubscription.ts` (no channel guard); `notification-preferences.tsx:49` | `P2` | Server guard rejecting in-app opt-out for mandatory topics |
| `listPersonSubscriptions` allows any `personId` query within org? | PII access scope | `listPersonSubscriptions.ts` (org check present; no self/officer check on `query.personId`) | `P2` `[NEEDS CONFIRMATION]` | Verify a member cannot read another member's subscriptions by passing arbitrary `personId` |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Publish/update/delete/archive emit audit via `ctx.set('auditResourceId'...)` extension pattern | Announcement lifecycle audit | `publishAnnouncement.ts:42-44`; `createAnnouncement.ts:43-45` | OK / `P3` | Confirmed wired; verify audit middleware actually composes event (`x-audit` extension present in tsp) `[NEEDS CONFIRMATION]` |
| Member opt-out changes — no audit/history of consent toggles | Consent/preference record (legal) | `updatePersonSubscription.ts` / `bulkUpdatePersonSubscriptions.ts` (no audit set) | `P2` | Add audit entry on preference change (opt-out is consent-relevant) |
| Delivery stats are the only delivery record; never populated | Delivery proof/record | `announcement_stats` empty (dead fan-out) | `P1` | No durable proof a member was/wasn't contacted; fix with delivery wiring |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| KG (`.understand-anything/knowledge-graph.json`, 3.2MB, commit `0178b7c`, gen 2026-06-06) partially stale; used as secondary only | `kg/knowledge-graph-status.md` | Recent doc-restructure not represented; module boundaries still valid | All wiring claims verified by direct code inspection, not KG |
| `communication` module owns feed-post + survey schemas (boundary leak) | index §16 rows 154/180; `feed-post.schema.ts`, survey schema in `communication/repos` | Mega-module concern; feed/survey logically separate | Note for cross-cutting/db audit; do not refactor here `[CROSS-MODULE RISK]` |
| Fan-out journey spans communication → email → notifs | index §15 row 134 | Blast radius of fixing delivery touches email/notifs job registration patterns | Treat email/notifs delivery internals as `[SHARED DEPENDENCY]`; only wire the communication trigger |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| m07 is the org→member broadcast backbone; WF-046..050 all P0 priority | `m07 MODULE_SPEC §3` | Module is core; current dead delivery = core failure | Prioritize delivery + prefs wiring as V1 |
| m13 feed ranking/curation/moderation rules undefined | index §17; `m13 MODULE_SPEC` ("ranking unspecified") | Cannot scaffold feed reliably without product decision | Defer feed; `[NEEDS PRODUCT DECISION]` |
| Two parallel broadcast primitives (announcements + messages) coexist with no single source of truth | `announcements.tsp` + `communication.tsp` messages; both have send/schedule | Duplicate-source-of-truth risk; doubles the fix surface | Decide canonical primitive before wiring delivery `[DO NOT OVERBUILD]` |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| E2E specs exist but not executed in this audit | Playwright (inspected only) | `apps/memberry/tests/e2e/officer/communications.spec.ts`; `journeys/communication-delivery.spec.ts` | `communication-delivery.spec.ts` likely passes on UI navigation while real delivery is dead (selector-depth risk) | During fix: convert to real-flow E2E asserting recipient receipt + status=sent, not just navigation |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/communication/announcement-handlers.test.ts` | backend/unit | Announcement CRUD + state guards | High |
| `handlers/communication/createAnnouncement.test.ts` / `deleteAnnouncement.test.ts` / `archiveAnnouncement.test.ts` / `getAnnouncement.test.ts` / `listAnnouncements.test.ts` / `getAnnouncementStats.test.ts` | backend/unit | Per-handler announcement ops | Medium |
| `handlers/communication/jobs/announcementSend.test.ts` | backend/unit | Fan-out fn in isolation (suppress/opt-out filter) | Medium — tests dead-at-runtime fn; no registration/trigger test |
| `handlers/communication/createMessage.test.ts` / `getMessage.test.ts` / `deleteMessage.test.ts` / `cancelMessage.test.ts` | backend/unit | Messages subsystem (BR-28 dedup) | Medium — unconsumed surface |
| `handlers/communication/createMessageTemplate.test.ts` / `getMessageTemplate.test.ts` / `deleteMessageTemplate.test.ts` / `015-announcements-templates.test.ts` | backend/unit | Template CRUD; runs as super-admin (masks role gap) | Medium |
| `handlers/communication/createSubscriptionTopic.test.ts` / `getSubscriptionTopic.test.ts` / `deleteSubscriptionTopic.test.ts` | backend/unit | Topic CRUD | Medium |
| `handlers/communication/listPersonSubscriptions.test.ts` / `bulkUpdatePersonSubscriptions.test.ts` | backend/unit | Subscriptions — uses uuid inputs, **masks** string-topicId bug | Low (false-green for WF-050) |
| `handlers/communication/ac-m07.communications.test.ts` | backend/unit | AC-M07 via **inline domain fn reimplementations** — does not exercise handlers | Low |
| `handlers/communication/br-26.session-management.test.ts` / `br-35.feed-moderation.test.ts` / `br-40.survey-anonymity.test.ts` | backend/unit | BR checks, mostly inline; br-26 misnamed (session scope) | Low |
| `handlers/communication/ac-m13.professional-feed.test.ts` | backend/unit | Feed BRs inline-only; feature unwired | Low |
| `handlers/communication/communication.test.ts` | backend/unit | Mixed inline domain logic (render, dedup) | Low-Medium |
| `apps/memberry/.../communications/__tests__/{compose,preferences-view,templates,analytics-dashboard,analytics-segments,template-preview-split}.test.tsx` | frontend/component | UI render tests (likely mocked SDK — won't catch contract-shape break) | Low-Medium |
| `specs/api/tests/contract/{communications-flow,communications-extended-flow,communication-gaps-flow,assoc-message-templates-flow,assoc-messages-flow,assoc-subscriptions-flow}.hurl` | contract | Endpoint surface as super-admin | Medium — wrong-role for officer flows; no delivery assertion |
| `specs/api/tests/contract/feed-moderation.hurl` | contract | Feed — self-marked "FULLY ORPHANED" | Unknown (dead) |
| `apps/memberry/tests/e2e/officer/communications.spec.ts`, `journeys/communication-delivery.spec.ts` | E2E | Officer comms UI / delivery journey | Low — likely nav-only, doesn't assert real delivery |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Publish triggers fan-out (job registered + subscriber fires) | integration | Proves P0 delivery wiring actually runs end-to-end | Before/During (RED first) |
| Scheduled announcement fires via cron registration | integration | Proves M7-R3 ≤5min path is live, not just defined | During |
| Compose "Send Now" reaches sent state + enqueues delivery | E2E/Playwright | Catches the silent-draft P0 (UI never publishes) | During |
| Notification prefs load against real contract shape (`{data,pagination}`) | integration/component | Catches `{items}` mismatch (no mock that hides it) | Before (RED) |
| Notification prefs save with real topic UUID persists + reloads | integration | Catches uuid-cast P0; current test uses uuid inputs and masks it | Before (RED) |
| Officer (real role) can CRUD templates/topics/segments | permission/RBAC | Catches admin/coordinator role-mismatch P1; existing hurl runs as super-admin | Before (RED) |
| Cross-org announcement mutation rejected (Org A → Org B by id) | permission/RBAC | Catches tenant-isolation P1 | During |
| Delivery stats populated after publish; analytics renders real data | integration + component | Catches empty-stats P1 (WF-048) | During |
| AC-M07-001..006 exercised through handlers (not inline reimplementations) | backend/regression | Current AC tests prove nothing about real code paths | During |
| In-app mandatory opt-out rejected server-side | permission/data | Enforces M7-R1 | During (V1 RECOMMENDED) |
| `listPersonSubscriptions` blocks reading another member's subs | permission/RBAC | Confirms PII scoping | Before `[NEEDS CONFIRMATION]` |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Email job/queue (`handlers/email/jobs`) | shared/platform | `app.ts:671`; `announcementSend.ts` email dispatch | Delivery fan-out enqueues email | `[SHARED DEPENDENCY]` — wire trigger only; do not modify email internals |
| Notifs/push (`handlers/notifs/jobs`, OneSignal) | shared/platform | `app.ts:672`; `announcementSend.ts` push dispatch | Push + in-app rows come from notifs | `[SHARED DEPENDENCY]` — same |
| Domain event bus + `domain-event-consumers.ts` | shared/platform | `core/domain-events.ts`; `core/domain-event-consumers.ts` | Subscriber must be added here to consume `announcement.published` | Add subscriber (module-owned block) per CLAUDE.md P1.6 pattern |
| pg-boss job registry + `app.ts` init | shared/platform | `app.ts:670-683` | Must add `registerCommunicationJobs(jobs, ...)` line | Module-local fix touching shared init `[SHARED DEPENDENCY]` |
| Role model / `x-security-required-roles` generator | shared/platform | `communication.tsp`; `services/api-ts/scripts/generate.ts` | Re-roling requires TypeSpec edit + regen | module-local TypeSpec edit; regen routes |
| `person_subscription` topic UUID seed | database/schema | `seed/layer-7-comms.ts`; `communication.schema.ts:111` | UI must reference seeded topic UUIDs | module-local; coordinate UI ↔ seed |
| Feed tables in communication module | cross-module | `feed-post.schema.ts`; index §16 | Module-boundary leak; m13 scope | `[CROSS-MODULE RISK]` `[NEEDS PRODUCT DECISION]` |
| Survey schema in `communication/repos` | database/schema | index §16 row 180 | Boundary/db concern | flag for db-schema audit `[CROSS-MODULE RISK]` |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Add `registerCommunicationJobs(jobs, app.email, app.notifs)` to `app.ts` init | Dead delivery | `P0` | V1 REQUIRED | integration: cron fires | Single-line wiring + verify dependencies passed |
| Subscribe to `announcement.published` in `domain-event-consumers.ts` → call `processAnnouncementSend` | Dead delivery | `P0` | V1 REQUIRED | integration: publish→delivery | Per P1.6 module-owned subscriber block |
| Chain compose create→publish/schedule in `compose-form.tsx` | Silent-draft | `P0` | V1 REQUIRED | E2E: send→sent | Or move send to detail page + honest copy |
| Conform `listPersonSubscriptions` to `{data,pagination}` | Prefs load | `P0` | V1 REQUIRED | component/integration | Match generated schema |
| Map prefs UI keys → topic UUIDs (or add `slug` column) | Prefs save | `P0` | V1 REQUIRED | integration: save+reload | Avoid uuid cast error |
| Re-role 18 comm ops from admin/coordinator → officer/position; regenerate | RBAC | `P1` | V1 REQUIRED | RBAC: officer 2xx | TypeSpec edit + regen |
| Org-scope announcement fetch in mutation handlers | Tenant isolation | `P1` | V1 REQUIRED | RBAC: cross-org 403 | `repo.get(id, orgId)` or post-fetch assert |
| Populate + surface `announcement_stats` post-delivery | Stats | `P1` | V1 REQUIRED | integration: stats populated | Depends on delivery wiring |
| Handlebars graceful placeholder for missing var | M7-R4 | `P3` | V1 RECOMMENDED | unit: missing var → placeholder | Plus syntax validation on save |
| Server guard: reject in-app opt-out for mandatory topics | M7-R1 | `P2` | V1 RECOMMENDED | data/RBAC | Plus UI disable |
| Quarantine/remove feed dead code + orphaned hurl, OR scaffold per m13 | Feed | `P2` | V2 DEFERRED | n/a | `[NEEDS PRODUCT DECISION]` per index §20 |
| Decide canonical broadcast primitive (announcements vs messages) | Duplicate source of truth | `P2` | V2 DEFERRED | n/a | Avoid wiring both `[DO NOT OVERBUILD]` |
| Add `cancelled` enum + cancel endpoint | Spec §8 | `P3` | V2 DEFERRED | unit | After scheduling is real |
| Fix stale m07 §10 TypeSpec note | Doc | `P3` | V1 RECOMMENDED | n/a | Doc-only |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Professional feed (posts/ranking/moderation/mute) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | m13 ranking/curation rules undefined; deferred per index §20; do not scaffold without spec |
| Messages subsystem expansion / its own delivery pipeline | `[DO NOT OVERBUILD]` | Parallel to announcements; pick one canonical primitive first |
| Saved-segment-driven smart audiences | `V2 DEFERRED` | No delivery consumer yet; premature |
| M7-R6 high-priority push override | `V2 DEFERRED` | Needs `priority` field; only meaningful after delivery lives |
| Announcement `Cancelled` state | `V2 DEFERRED` | Useful only once scheduling is real |
| Unique template name index | `V2 DEFERRED` | Minor; no current collision evidence |
| Build a second analytics warehouse / open-rate pixel tracking | `DO NOT ADD` | Overbuild; basic sent/delivered stats suffice for V1 |
| Refactor communication module to split feed/survey schemas | `DO NOT ADD` (here) | Cross-module/db concern; belongs to db-schema/cross-cutting audit, not this fix pass |

## 24. Audit Decision

`FAIL`

Static review sufficient; browser tooling skipped for batch run. The module fails its V1 scope because the **core product workflow — delivering an announcement to members — never executes at runtime**. Three independent P0 defects each break the spine: (1) the fan-out + scheduled-delivery infrastructure is fully unwired (`registerCommunicationJobs` never called, no `announcement.published` subscriber, `processAnnouncementSend` never invoked on publish — verified by direct inspection of `app.ts:671-683` and `announcementSend.ts:265,271`); (2) the officer compose UI silently saves a draft instead of sending (`createAnnouncement.ts:31` forces `status:'draft'`, compose UI never hits publish/schedule); (3) member notification preferences are broken in both directions (response-shape contract violation on load, string-topicId-into-uuid-column on save). Two P1 issues compound it: officers are 403-blocked from templates/topics/segments by a nonexistent `coordinator` role, and announcement mutations are not org-scoped on fetch (cross-org publish/delete risk). Delivery stats (WF-048) are consequently always empty. CRUD scaffolding, state guards, dedup, and suppression logic are well-built but unreachable. This is a `FAIL` until the P0 delivery spine and prefs pipeline are wired and the P1 RBAC/tenant issues are closed.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Is `announcement` (broadcast) or `message` the canonical delivery primitive? Both have full send/schedule surfaces. | `[NEEDS PRODUCT DECISION]` | Determines which pipeline to wire; avoids double-building | Product + Eng |
| Should the feed (m13) be scaffolded now or its dead code removed from `handlers/communication/`? | `[NEEDS PRODUCT DECISION]` `[BLOCKED BY MISSING SPEC]` | Ranking/moderation rules undefined; 4 unused tables + orphaned test | Product |
| Does `repo.get(id)` accept an org param, or must mutation handlers add an explicit org assertion? | `[NEEDS CONFIRMATION]` | Shapes the tenant-isolation fix | Eng |
| Can a member call `listPersonSubscriptions` with another member's `personId`? | `[NEEDS CONFIRMATION]` | PII access scope; potential P1 if unscoped | Eng |
| Is title max 200 (code) or 300 (spec §7) correct? | `[NEEDS PRODUCT DECISION]` | Minor schema/spec reconciliation | Product |
| Does the `x-audit` extension actually compose audit events for announcement transitions at runtime? | `[NEEDS CONFIRMATION]` | Confirms record-history completeness | Eng |
| Should preference (consent) changes be audited? | `[NEEDS PRODUCT DECISION]` | Opt-out is consent-relevant (legal/trust) | Product + Compliance |

## 26. Notes for Gap Plan Organizer

For `03-organize-gap-plan-for-fixing.md`, prioritize as follows.

**True-V1 P0 batch (wire the delivery spine — fix together, share one E2E):**
1. Register `registerCommunicationJobs` in `app.ts` init **and** subscribe to `announcement.published` (or direct-call fan-out) — without this, every other delivery fix is cosmetic.
2. Fix the compose UI so "Send Now"/"Schedule" actually call publish/schedule (`compose-form.tsx`), since the backend create force-drafts.
3. Fix notification preferences load (`{data,pagination}` contract) and save (topicId UUID mapping) — independent of delivery wiring, can be a parallel sub-batch.

**True-V1 P1 batch (RBAC + tenant + stats — fixable after spine):**
4. Re-role 18 communication ops off `admin/coordinator` to `association:officer`/`x-require-position` (TypeSpec edit + regenerate).
5. Org-scope announcement mutation fetches (tenant isolation) — pending `repo.get` signature confirmation.
6. Surface populated `announcement_stats` (WF-048) — depends on #1.

**Tests to write FIRST (RED):** prefs load/save (existing test masks the bug with uuid inputs), officer-role template CRUD (existing hurl runs as super-admin), publish→fan-out integration. Existing `ac-m07.*` tests are inline reimplementations and prove nothing about handlers — do not trust them as coverage.

**Selected P2 for V1 completeness:** M7-R1 in-app mandatory server guard (consent integrity).

**Do NOT expand / defer:** feed (dead code, `[NEEDS PRODUCT DECISION]`), messages-vs-announcements duplicate primitive (`[DO NOT OVERBUILD]` — decide one), saved-segment smart audiences, M7-R6 priority push, announcement cancel state.

**Risky shared dependencies:** email/notifs job registration and the domain-event bus are `[SHARED DEPENDENCY]` — wire the communication trigger only; do not refactor email/notifs internals. The `app.ts` init line touches shared bootstrap.

**Database/schema dependencies:** `person_subscription.topic_id uuid` mapping (module-local), and feed/survey schema co-location in the communication module (cross-module — route to db-schema audit, do not refactor in this fix pass).

**Blocked by product decisions before fixing:** canonical broadcast primitive, feed scaffold-vs-remove, consent-change audit requirement, title length reconciliation.

---

Next recommended step:
```
Module/group: Communications (+ feed)
Module slug: communications
Primary PRD/spec: docs/product/modules/m07-communications/MODULE_SPEC.md (+ COMMS-CONSOLIDATION.md; m13 feed surface)
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/communications-gap-plan.md
```
