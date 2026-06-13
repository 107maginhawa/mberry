# AHA Module/Group Gap Plan: Notifications & Email

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Notifications & Email |
| Module slug | notifications-email |
| Type | API/Integration Group (delivery layer: in-app/push notifications + transactional/bulk email) |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/notifications-email-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m22-email/MODULE_SPEC.md` (M22) + `docs/product/MODULE_SPEC.notifs.md` |
| Supporting PRDs/specs used | `docs/product/modules/m22-email/API_CONTRACTS.md`, `docs/product/modules/m22-email/NAVIGATION_MAP.md`, `docs/ver-3/business/br-registry.json` (BR-52..BR-59), CLAUDE.md OneSignal multi-app pattern, `docs/quality/HAND_WIRED_ROUTES.yaml` |
| PRD/spec coverage quality | Strong for email (M22); Partial for notifs (handler-level spec only, with verified drift) |
| Paths inspected | `services/api-ts/src/handlers/notifs/` (15 files), `services/api-ts/src/handlers/email/` (24 root .ts + repos + jobs + templates), `services/api-ts/src/core/{email.ts,notifs.ts,domain-event-consumers.ts,config.ts}`, `specs/api/src/modules/{email.tsp,notifs.tsp}`, `services/api-ts/src/generated/openapi/routes.ts`, `services/api-ts/src/app.ts`, `services/api-ts/src/handlers/person/` (notification-preferences), `services/api-ts/src/handlers/communication/jobs/announcementSend.ts`, `apps/memberry/src/{features/notifications,features/communications,components/notification-drawer.tsx,routes/_authenticated/my/notifications.tsx,routes/_authenticated/org/$orgSlug/my-notifications.tsx}`, `apps/memberry/package.json`, `services/api-ts/src/seed/layer-4-cross-module.ts`, `specs/api/tests/contract/{email,email-extended-flow,notifs,notifs-extended-flow}.hurl` |
| PRDs/specs inspected | M22 MODULE_SPEC (workflows WF-110, WF-122..127; BR-52..59; AC-M22-001..008), M22 API_CONTRACTS, M22 NAVIGATION_MAP, MODULE_SPEC.notifs §1–10 |
| KG used | Yes (status notes only; `docs/aha/kg/knowledge-graph-status.md`) — direct code inspection primary, per KG status decision |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes only; product docs primary per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No — Static review sufficient; browser tooling skipped for batch run. |
| Playwright/E2E inspected | Yes (inspected only; none executed) — `apps/memberry/tests/e2e/journeys/communication-delivery.spec.ts`, `tests/e2e/officer/dues-reminders.spec.ts`, `tests/e2e/settings.spec.ts` |
| Existing tests inspected | 12 email handler `.test.ts` + 3 repo tests + 2 jobs tests; 6 notifs test files; `core/email.test.ts`; 4 Hurl contract files |
| Cross-cutting audit reviewed | Not Available (prompt 05 not yet run) |
| Database/schema audit reviewed | Not Available (prompt 06 not yet run) |
| Limitations | Static review only — no server boot, no Hurl execution, no browser verification. Whether dunning-escalation / task-overdue notifications fire via an alternate path (direct repo insert in dunning/committee jobs) was not exhaustively traced — marked `[NEEDS CONFIRMATION]`. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M22 Email MODULE_SPEC | `docs/product/modules/m22-email/MODULE_SPEC.md` | PRD/module spec | Current but internally inconsistent (§8 endpoint table vs its own handler mapping) | Primary spec: workflows, BR-52..59, AC-M22-001..008, entities |
| M22 API_CONTRACTS | `docs/product/modules/m22-email/API_CONTRACTS.md` | API contract | Current | Wire contract; documents hand-wired unsubscribe at `app.ts` |
| M22 NAVIGATION_MAP | `docs/product/modules/m22-email/NAVIGATION_MAP.md` | UI map | Current | Explicitly: "no frontend routes" — backend-only module by design |
| MODULE_SPEC.notifs | `docs/product/MODULE_SPEC.notifs.md` | handler-level spec | Stale in places (status lifecycle, sms channel, trigger inventory — see §5) | Primary notifs reference |
| br-registry.json | `docs/ver-3/business/br-registry.json` | business rules | Current | BR-52..BR-59 registered, all with empty test arrays |
| CLAUDE.md OneSignal pattern | `CLAUDE.md` §OneSignal Multi-App Architecture | convention | Partially stale (describes frontend init that does not exist) | external_id targeting, targetApp tagging |
| HAND_WIRED_ROUTES.yaml | `docs/quality/HAND_WIRED_ROUTES.yaml` | API contract | Current | Allowlists `/email/unsubscribe` GET+POST and `/email/suppressions` GET |

## 3. Expected vs Actual

**Expected (per M22 + MODULE_SPEC.notifs):** A two-sink delivery layer. `notifs` owns per-recipient in-app rows, OneSignal push keyed on `external_id` = person id, read-state lifecycle, and a `notification-triggers` integration surface. `email` owns Handlebars templates, a guarded queue (suppression check BR-52, active-template BR-53, retry cap BR-54, transactional override BR-57, variable validation BR-58, cancellation audit BR-59), bounce/complaint auto-suppression (BR-55/56, WF-124), and RFC 8058 public unsubscribe. Admin manages templates/queue/suppressions via API (no UI, per NAVIGATION_MAP). Members control channels via notification preferences.

**Actual:** The core read path works end-to-end: 4 notifs HTTP handlers (TypeSpec-generated, registered at `routes.ts:3048-3069`) feed a real memberry inbox (`notification-inbox.tsx`, `notification-drawer.tsx`, routes `/my/notifications` + `/org/$orgSlug/my-notifications`). Email queue processing works: `core/email.ts` `processEmail()` runs a 3-guard pipeline (suppression → blocked-membership → bulk rate limit), Handlebars render, multi-provider send (SMTP/Postmark/OneSignal), RFC 8058 headers + HMAC-signed unsubscribe (`handlers/email/unsubscribeEmail.ts`), retry with backoff capped at 3 (`queue.repo.ts:325`), cancellation audit trail (`queue.repo.ts` `cancelEmail`).

Material divergences: (a) bounce/complaint ingestion (WF-124/BR-55/BR-56) has **no code path at all**; (b) transactional suppression override (BR-57) is **not implemented** — Guard 1 suppresses all categories; (c) notification preferences exist as schema + endpoints + UI but are **never consulted at delivery time**, and the UI writes to a *different* table (`person_subscriptions`) than the person-owned `notification_preference` table; (d) web push is **unwired in the frontend** — `react-onesignal` is a dependency (`apps/memberry/package.json:82`) but never imported, so no browser ever subscribes; (e) M22 §8 lists 3 endpoints (DELETE template, POST /email/send, DELETE suppression) that exist nowhere; (f) all 8 M22 BRs have zero registered tests in br-registry.json.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BR-52 / AC-M22-001 suppression drops delivery | Suppressed recipients skipped at send | Guard 1 in `processEmail()` marks suppressed items failed | n/a | `core/email.ts` Guard 1 (`suppressionRepo.isSuppressed`) | `email_suppression` table, org-scoped | `suppression.repo.test.ts` exists; **no BR-52-tagged test**; br-registry tests empty | Implemented but Untested | Yes (test) |
| BR-53 / AC-M22-002 inactive template rejected **at enqueue** with 400 `TEMPLATE_INACTIVE` | Enqueue API rejects | `queueEmail()` (`core/email.ts`) only checks `templateTags` non-empty; active check deferred to process time via `resolveTemplateByTags({status:'active'})` → item fails silently at send, no 400 | n/a | `core/email.ts` queueEmail + resolveTemplateByTags | `template_status` enum draft/active/archived | none for enqueue rejection | Partially Implemented | Yes |
| BR-54 / AC-M22-003 max retries → terminal failed | Stop retrying after threshold | Auto-retry: `getPendingEmails` picks failed only when `attempts < 3` (`queue.repo.ts:153`); manual retry throws `MAX_RETRIES_EXCEEDED` at `attempts >= 3` (`queue.repo.ts:325-327`) | n/a | `queue.repo.ts` | `attempts` int, `next_retry_at` | `retryEmailQueueItem.test.ts`, `queue.repo.test.ts`; not BR-tagged | Implemented but Untested (BR registry) | Yes (test) |
| BR-55 / AC-M22-004 hard bounce auto-suppress | Provider bounce → suppression `hard_bounce` | **No bounce webhook/ingestion anywhere.** grep for bounce/complaint hits only schema enum + tests of unrelated paths | n/a | absent (no handler, no TypeSpec op, no job) | `suppression_reason` enum includes `hard_bounce` (dead value) | none | Missing | Yes |
| BR-56 / AC-M22-005 complaint auto-suppress (CAN-SPAM) | Provider complaint → suppression `complaint` | **Missing** (same as BR-55) | n/a | absent | enum includes `complaint` (dead value) | none | Missing | Yes |
| BR-57 / AC-M22-006 transactional bypasses marketing suppression | `transactional` category checked-but-overridable | Guard 1 suppresses **all** categories; only Guard 3 (bulk rate limit) is category-aware. `include_unsubscribed: true` exists only in the OneSignal email provider path (`core/email.ts:217`) — not a suppression-list override | n/a | `core/email.ts` processEmail Guard 1 vs Guard 3 | `email_category` enum bulk/transactional exists (`email.schema.ts:62`) | none | Missing | Yes |
| BR-58 / AC-M22-007 required variables validated before enqueue (400 `MISSING_REQUIRED_VARIABLES`) | Enqueue rejects missing vars | Deferred to render time during processing; no enqueue-time 400 | n/a | `core/email.ts` queueEmail comment: "validation will happen during processing" | template `variables` definitions | `template.repo.test.ts` covers render validation only | Partially Implemented | Yes |
| BR-59 / AC-M22-008 cancellation audit trail | `cancelled_by/reason/at` persisted; only from `pending` | `cancelEmail()` persists all three; transition guarded by `EMAIL_QUEUE_VALID_TRANSITIONS` | n/a | `queue.repo.ts` cancelEmail | `cancelled_at/by/cancellation_reason` columns | `cancelEmailQueueItem.test.ts`; not BR-tagged | Implemented but Untested (BR registry) | Yes (test) |
| M22 §8: 12-endpoint table incl. DELETE /email/templates/:id, POST /email/send, DELETE /email/suppressions/:id | All 12 exist | TypeSpec `email.tsp` defines a *different* 12 ops (adds testTemplate + unsubscribe GET/POST; omits delete-template, direct-send, remove-suppression). Generated routes match TypeSpec (`routes.ts:2888-2967`) | n/a | `specs/api/src/modules/email.tsp:442-651` | n/a | email.hurl covers existing ops only | Partially Implemented (spec internally inconsistent) | Yes |
| WF-125 Manage Suppressions (P0): "View/**remove** suppressed addresses" | Admin can list and remove | List only (`listEmailSuppressions`, hand-wired after `/email/*` auth per `app.ts:86-88`, allowlisted in HAND_WIRED_ROUTES.yaml). No remove endpoint/handler | n/a | `handlers/email/listEmailSuppressions.ts`; no delete handler | suppression table supports it | `listEmailSuppressions.test.ts` (list only) | Partially Implemented | Yes |
| WF-124 Handle Bounce (P0) | System processes bounces | Missing (see BR-55) | n/a | absent | enum only | none | Missing | Yes |
| M22 §9 domain events EmailSent/EmailFailed/EmailBounced/EmailComplaint | Events published | None of the four are emitted by `core/email.ts` or email jobs — outcomes are logged only | n/a | `core/email.ts` processEmail (logs, no `domainEvents.emit`) | n/a | none | Missing | Yes (low severity — consumers listed as "logging"/M07 alert only) |
| RFC 8058 unsubscribe (public, signed token) | GET+POST before auth middleware | Implemented: HMAC verify (`unsubscribeEmail.ts`, `utils/unsub-token`), registered before `/email/*` auth (`app.ts:84-88`), allowlisted | n/a | `app.ts`, `unsubscribeEmail.ts` | suppression reason `unsubscribe` | `unsubscribeEmail.test.ts` + hurl §8/§9 | Implemented | No |
| MODULE_SPEC.notifs: 4 HTTP ops, owner-scoped, 404-not-403 on cross-user | List/get/mark-read/mark-all | All 4 implemented + TypeSpec'd (`notifs.tsp:161-215`) + registered (`routes.ts:3048-3069`); repo has `findOneByIdAndRecipient` ownership check | inbox + drawer + header badge | `handlers/notifs/*.ts` | `notification` table | 4 handler tests + aggregator + 2 hurl files | Implemented | No |
| MODULE_SPEC.notifs: status lifecycle "unread → read", channels incl. sms | Schema matches spec | Actual enum: queued/sent/delivered/read/failed/expired; channels email/push/in-app (**no sms**), yet `InternalNotificationRequest.channels` accepts `'sms'` (`notification.schema.ts`) | n/a | `notification.schema.ts` enums | pgEnums | n/a | Unclear (spec drift) | Yes (doc) |
| MODULE_SPEC.notifs: triggers "one factory per domain module: triggerDuesReminder, triggerEventConfirmation, etc." | Broad trigger surface | Actual file (Slice 027) has exactly 4: waitlist promotion, late cancellation, dunning escalation, task overdue | n/a | `handlers/notifs/notification-triggers.ts` header comment | n/a | `notification-triggers.test.ts` | Unclear (spec drift) | Yes (doc) |
| Slice 027 GAP-012/GAP-017: dunning escalation + task overdue notifications fire | Triggers called by owning modules | Only `cancelEventRegistration.ts` and `promoteWaitlistEntry.ts` (association:operations) import `notifs/notification-triggers`. No caller for `triggerDunningEscalation` / `triggerTaskOverdue` `[NEEDS CONFIRMATION]` (alternate direct-insert path not exhaustively traced) | n/a | grep: 2 importers only | seed fakes these rows (`seed/layer-4-cross-module.ts:70-73`) | trigger unit tests only (call functions directly) | Partially Implemented | Yes |
| CLAUDE.md OneSignal pattern: frontend sets `VITE_ONESIGNAL_APP_ID`, apps auto-tag on init | Web push subscription works | `react-onesignal@^3.4.0` in `apps/memberry/package.json:82` but **zero imports**; no `VITE_ONESIGNAL_*` usage in either app; no OneSignal service worker in `apps/memberry/public/` | compose-form copy promises "Send to member devices via OneSignal" (`compose-form.tsx:179`) | backend push send exists (`notification.repo.ts:442-457`) | n/a | none | Missing (frontend half) | Yes |
| Notification preferences honored on delivery (M02-R8: in-app always on; push/email per category) | Delivery path consults prefs | `notification_preference` table + GET/PATCH `/persons/me/notification-preferences` (`routes.ts:3226-3232`) exist, but the table is read only by seed + person-deletion cleanup (`core/domain-event-consumers.ts`). `notification.repo`/`core/notifs` never query it. Announcement fan-out gates on a different table (`person_subscriptions`, `announcementSend.ts:153-158`) | prefs UI exists but writes `person_subscriptions` (`notification-preferences.tsx` → `/api/association/person-subscriptions`) | absent in send path | two parallel tables | `updateMyNotificationPreferences.test.ts` (CRUD only) | Partially Implemented | Yes |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| BR-55/BR-56, WF-124, AC-M22-004/005 | No bounce/complaint ingestion path (webhook or provider poll); auto-suppression can never happen; CAN-SPAM posture spec'd P0 | P1 | V1 REQUIRED | grep across `services/api-ts/src` — `hard_bounce`/`complaint` appear only in `suppression.schema.ts` enum + unrelated tests; no handler, no TypeSpec op, no job | Add provider webhook handler (public, signature-verified, hand-wired like Stripe `/webhooks/stripe` precedent at `app.ts`) that maps hard bounce → `addSuppression(reason:'hard_bounce')`, complaint → `'complaint'`. TDD per AC-M22-004/005 |
| BR-57, AC-M22-006 | Transactional emails are blocked by marketing/unsubscribe suppressions: member who clicks unsubscribe loses dues invoices, security notices, receipts | P1 | V1 REQUIRED | `core/email.ts` processEmail Guard 1 has no `emailCategory` check; suppression reasons not differentiated; unsubscribe writes blanket `unsubscribe` suppression (`unsubscribeEmail.ts`) | In Guard 1: if `email.emailCategory === 'transactional'` and suppression reason is `unsubscribe`, allow send (still block `hard_bounce`/`complaint`). Requires `isSuppressed` to return reason |
| M02-R8 / preference contract | Notification preferences never enforced at delivery; person-owned endpoints have no consumer; prefs UI writes a different table | P1 | V1 REQUIRED | §4 row "Notification preferences honored on delivery"; `notification-preferences.tsx:586-588` hits `/association/person-subscriptions`; `notificationPreferences` read only by seed + deletion consumer | Decide single source of truth (`[NEEDS PRODUCT DECISION]` — see §25 Q3), enforce in `NotificationRepository` push/email branch, point UI at the chosen endpoints |
| CLAUDE.md OneSignal frontend init | Web push unreachable: no browser subscribes, but officer compose UI offers push channel | P1 | V1 REQUIRED (or explicit descope) | `react-onesignal` dep unused; no `VITE_ONESIGNAL_APP_ID` reads; `compose-form.tsx:179` promises device push | Either wire `react-onesignal` init (login → `OneSignal.login(personId)` for external_id) or remove/disable the push option in compose UI and document mobile-only `[NEEDS PRODUCT DECISION]` |
| br-registry BR-52..BR-59 | All 8 M22 rules registered with empty `tests.backend/contract/e2e` arrays; `bun run test:br` coverage gate sees 0% for M22 | P1 | V1 REQUIRED | `docs/ver-3/business/br-registry.json` entries BR-52..59; grep `BR-5[2-9]` in `handlers/email`, `handlers/notifs`, `core/email.test.ts` → no output | Tag existing tests (BR-52, 54, 59 already have de-facto coverage) and write the missing ones (BR-53, 55, 56, 57, 58) during fix phase |
| WF-125 (P0 in spec) | No `DELETE /email/suppressions/:id` — admin cannot unblock a wrongly suppressed address (e.g., after a member re-subscribes) | P2 | V1 RECOMMENDED | `email.tsp:645-651` has only GET; no delete handler in `handlers/email/` | Add TypeSpec op + handler `deleteEmailSuppression` (admin), audit via `x-audit` |
| BR-53/BR-58, AC-M22-002/007 | Enqueue-time rejection (400 TEMPLATE_INACTIVE / MISSING_REQUIRED_VARIABLES) not implemented; failures surface only as failed queue items at process time | P2 | V1 RECOMMENDED | `core/email.ts` queueEmail; AC text demands API 400s | Validate template status + required variables inside `queueEmail()` before insert. Note: enqueue is internal-only today (no public POST /email/send), so impact is internal correctness, not API contract |
| Slice 027 GAP-012/GAP-017 | `triggerDunningEscalation` / `triggerTaskOverdue` have no callers — escalation/overdue notifications likely never fire; seed data masks this in demos | P2 | V1 RECOMMENDED | grep importers of `notifs/notification-triggers` → only `cancelEventRegistration.ts`, `promoteWaitlistEntry.ts`; seed rows at `seed/layer-4-cross-module.ts:70-73` `[NEEDS CONFIRMATION]` alternate path | Confirm whether dunning job / committee-task job notifies via another path; if not, wire the triggers at the dunning-stage transition and task-overdue sweep |
| M22 §8 / §12 self-claims | Spec table lists DELETE template, POST /email/send, DELETE suppression and claims "12/12 anchored", "TypeSpec COMPLETE (all 12)" while its own handler mapping lists a different 13 | P2 | V1 RECOMMENDED (doc fix) | `m22-email/MODULE_SPEC.md` §8 vs handler-mapping note; `email.tsp` op list | Reconcile spec §8 with actual op set; decide fate of the 3 phantom endpoints (suppression delete → build; template delete + direct send → V2/Not Required, see §23) |
| M22 §9 domain events | EmailSent/EmailFailed/EmailBounced/EmailComplaint never emitted | P3 | V2 DEFERRED | no `domainEvents.emit` in `core/email.ts`/email jobs | Defer until a real consumer exists (spec lists only logging/M07 alert) `[DO NOT OVERBUILD]` |
| MODULE_SPEC.notifs §5/§3 | Spec says status `unread/read` + sms channel + per-module trigger factories; code differs on all three | P3 | V1 RECOMMENDED (doc fix) | `notification.schema.ts` enums vs MODULE_SPEC.notifs | Sync MODULE_SPEC.notifs to actual enums and the 4-trigger inventory |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `consentValidated` boolean on notifications + "medical notification" warning branch | `notification.schema.ts` (default false); `notification.repo.ts:124-131` `isMedicalNotification` warning; only seed sets it true | CLAUDE.md: consent management **not implemented**; healthcare-template residue | Misleading compliance signal — field stored, never enforced | Keep but clarify; do not expand `[DO NOT OVERBUILD]` |
| `InternalNotificationRequest.channels[]` + `priority` multi-channel/priority hints | `notification.schema.ts` interface; `createNotificationForModule` uses only `channels?.[0]` (`notification.repo.ts:148`); priority unused | Not in MODULE_SPEC.notifs API contract (explicitly marked "not part of the public API contract") | Callers may believe multi-channel fan-out happens; it does not | Keep but clarify (document single-channel behavior) or trim fields; do not expand |
| `sms` channel in internal types | `InternalNotificationRequest.channels` accepts `'sms'`; pgEnum `notification_channel` lacks it — insert would fail | MODULE_SPEC.notifs mentions sms "(where the queue is configured)" | Latent runtime error if any caller passes sms | Keep but clarify; remove `'sms'` from the type until schema supports it |
| OneSignal as an *email* provider (3-provider abstraction smtp/postmark/onesignal) | `core/email.ts` OneSignalProvider; `email_provider` enum | M22 §11 AI instructions mention multi-provider | Low — working | Keep |
| Blocked-membership send guard (deceased/resigned/expelled) | `core/email.ts` Guard 2, `BLOCKED_MEMBERSHIP_STATUSES` | Not in M22 BRs (likely from another module's rule) | Low — sensible | Keep but clarify (anchor to a BR id) `[NEEDS CONFIRMATION]` |
| Notification email bridge via global app singleton | `notification.repo.ts` `AppGlobal` interface (`globalThis.app.email.queueEmail`) | No spec | Fragile DI bypass; silent no-op if global unset | Keep but clarify; consider injecting EmailService later — do not refactor now `[DO NOT OVERBUILD]` |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Announcement/notification fan-out (audit-index §7) | Officer, Member | Compose announcement | compose → segment → queue → email/push delivery → member sees in inbox | Working for email + in-app; push leg dead on web (no browser subscription); opt-outs honored via `person_subscriptions` only | Partial | `announcementSend.ts`, `compose-form.tsx`, §4 push row |
| WF-110 Process Queue | System | 30s interval job | pick pending → guards → render → send → sent/failed | Implemented (`email/jobs/index.ts` interval, `processor.ts`, `core/email.ts`) | No | `registerEmailJobs`, `EMAIL_PROCESSOR_INTERVAL_MS` |
| WF-122 Create Template | Admin | API call | create/update/test template with variables | Implemented (create/update/test handlers + `templates/initializer` defaults incl. auth hbs templates) | No (no delete — see §5) | `createEmailTemplate.ts`, `updateEmailTemplate.ts`, `testEmailTemplate.ts` |
| WF-123 Enqueue Email | System | module call | validate → insert pending | Implemented minus enqueue-time validation (BR-53/58) | Partial | `core/email.ts` queueEmail |
| WF-124 Handle Bounce | System | provider event | bounce → suppression | **Missing entirely** | Yes | §5 row 1 |
| WF-125 Manage Suppressions | Admin | API | view / remove | View only | Partial | §5 WF-125 row |
| WF-126 Cancel Queued Email | Admin | API | cancel pending w/ audit | Implemented | No | `cancelEmailQueueItem.ts`, `queue.repo.ts` |
| WF-127 Retry Failed Email | System/Admin | retry schedule or API | bounded re-attempt | Implemented (cap 3, backoff 5m/30m/2h) | No | `queue.repo.ts:309-334`, `calculateNextRetryTime` |
| Member reads + manages notifications | Member | open inbox/drawer | list → filter → mark read → deep link | Implemented | No | `notification-drawer.tsx:143-174`, `notification-inbox.tsx`, routes |
| Member sets notification preferences | Member | settings UI | toggle category×channel → delivery respects it | UI saves, delivery ignores (and saves to the *other* table) | Yes | §4 preference row |
| Person deletion cascade (notif leg) | System | `person.deleted` | scrub notifications + preferences | Implemented (`core/domain-event-consumers.ts` imports `notifications`, `notificationPreferences`) | No | `domain-event-consumers.ts:14,40` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Bounce received → suppression added | Auto-suppress `hard_bounce` | Missing | no handler/job | V1 REQUIRED | Spec P0 (WF-124) |
| Complaint received → suppression added | Auto-suppress `complaint` | Missing | no handler/job | V1 REQUIRED | CAN-SPAM |
| Suppressed + transactional → still deliver | Override per BR-57 | Missing | Guard 1 category-blind | V1 REQUIRED | |
| Unsubscribe link → marketing suppressed | HMAC-verified, idempotent | Implemented | `unsubscribeEmail.ts` | — | Good |
| Queue item retried ≤3 then terminal | Bounded retries | Implemented | `queue.repo.ts` | — | Cap hardcoded 3; spec has no explicit number — acceptable |
| Push delivered to member browser | OneSignal web SDK subscribed, external_id set | Missing (frontend) | no `react-onesignal` import | V1 REQUIRED or descope | Backend half works (`notification.repo.ts:442`) |
| Push respects per-category preference | `pushEnabled` checked | Missing | no `notificationPreferences` read in send path | V1 REQUIRED | |
| Email channel notification → email queue | Bridge to EmailService | Implemented | `notification.repo.ts` AppGlobal bridge | — | Fragile pattern, works |
| Scheduled notifications processed | 5-min cron | Implemented | `notifs/jobs/index.ts` (`*/5 * * * *`) | — | |
| 90-day notification cleanup | Daily cron | Implemented | `notifs.cleanup` cron | — | M22 mentions 30-day *queue* cleanup — different object; verify queue cleanup exists `[NEEDS CONFIRMATION]` |
| Dunning escalation notifies member | Trigger fires at stage transition | Unclear | no caller of `triggerDunningEscalation` | V1 RECOMMENDED | `[NEEDS CONFIRMATION]` alternate path |
| Committee task overdue notifies assignee | Trigger fires on overdue sweep | Unclear | no caller of `triggerTaskOverdue` | V1 RECOMMENDED | `[NEEDS CONFIRMATION]` |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| See unified notification inbox across orgs | Member | One list, all orgs | Implemented | No | — | `listNotifications` + MODULE_SPEC.notifs gotcha "survive across orgs" |
| Mark one/all read (idempotent) | Member | Read-state lifecycle | Implemented | No | — | `markNotificationAsRead.ts`, `markAllNotificationsAsRead.ts` (+`?type=` filter) |
| Unread badge in header | Member | Count of unread | Implemented (client-derived) | No | — | `member-header.tsx:35` |
| Deep-link from notification to entity | Member | relatedEntity navigation | Implemented | No | — | `notification-drawer.tsx` navigate |
| Receive web push | Member | Browser push via OneSignal | Missing (frontend unwired) | Yes | V1 REQUIRED or descope | §5 |
| Control channels per category | Member | Toggles enforced | Partially Implemented (UI saves, not enforced) | Yes | V1 REQUIRED | §4 |
| Unsubscribe from marketing email via link | Member | RFC 8058 | Implemented | No | — | `unsubscribeEmail.ts` |
| Still receive dues invoice after unsubscribe | Member | BR-57 | Missing | Yes | V1 REQUIRED | §5 |
| Manage email templates | Admin | CRUD + test send | Implemented minus delete | Minor | V2 DEFERRED (delete) | `email.tsp:442-516` |
| Inspect/cancel/retry queue | Admin | Queue ops | Implemented | No | — | handlers + hurl extended flow |
| View suppressions | Admin | List | Implemented | No | — | `listEmailSuppressions.ts` |
| Remove suppression | Admin | Unblock address | Missing | Yes | V1 RECOMMENDED | §5 |
| Admin UI for email ops | Admin | Screens in apps/admin | Not Required for V1 (NAVIGATION_MAP: "no frontend routes") | No | V2 DEFERRED | `m22-email/NAVIGATION_MAP.md`; zero matches for "notification" in `apps/admin/src` |
| Send SMS notifications | System | sms channel | Not Required for V1 | No | V2 DEFERRED | schema lacks enum value |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| No bounce/complaint ingestion → BR-55/BR-56/WF-124 dead | email backend | P1 | V1 REQUIRED | grep: `hard_bounce`/`complaint` only in enum; no webhook handler; M22 marks WF-124 P0 | Repeated sends to dead/complaining addresses destroy sender reputation and violate the spec'd CAN-SPAM posture | Provider webhook (public, signature-verified, hand-wired pre-auth like `/webhooks/stripe`) → `SuppressionRepository.addSuppression` |
| Transactional email blocked by unsubscribe suppression (BR-57 missing) | email backend | P1 | V1 REQUIRED | `core/email.ts` Guard 1 category-blind; `unsubscribeEmail.ts` blanket suppression | Members who unsubscribe from announcements silently stop receiving dues invoices, receipts, security mail — financial/trust risk | Reason-aware Guard 1: transactional bypasses `unsubscribe` reason, never bypasses `hard_bounce`/`complaint` |
| Notification preferences not enforced + duplicate preference stores | notifs backend + person + communication | P1 | V1 REQUIRED | `notification_preference` table read by nobody in send path; UI writes `person_subscriptions` (`notification-preferences.tsx:586-588`); endpoints `routes.ts:3226-3232` consumer-less | Settings UI is decorative for push/email; two tables can disagree; trust + DPA expectation mismatch | `[SHARED DEPENDENCY]` person + communication. Pick one store, enforce in `NotificationRepository` channel dispatch, repoint UI |
| Web push frontend unwired | memberry frontend | P1 | V1 REQUIRED (or explicit descope) | `react-onesignal` dep never imported; no VITE_ONESIGNAL reads; backend sends to OneSignal anyway (`notification.repo.ts:442`) | Push-channel sends are paid OneSignal calls that no web user can ever receive; compose UI misleads officers | Init OneSignal SDK on login with person-id external_id, or hide push channel in compose UI + doc as mobile-only |
| All 8 M22 BRs untested per br-registry | tests | P1 | V1 REQUIRED | br-registry.json BR-52..59 `tests:{backend:[],contract:[],e2e:[]}`; no `BR-5[2-9]` tags in module tests | `[TEST GAP]` BR coverage gate (`bun run test:br`) reports 0% for M22; fixes here can't be safely verified | Tag existing tests for BR-52/54/59; write BR-53/55/56/57/58 tests first in fix phase |
| No remove-suppression endpoint (WF-125 half-missing) | email API | P2 | V1 RECOMMENDED | `email.tsp:645-651` GET only | Wrong suppression (typo bounce, member changes mind) is permanent without DB surgery | TypeSpec DELETE op + handler + audit extension |
| Enqueue-time validation missing (BR-53/BR-58) | email backend | P2 | V1 RECOMMENDED | `core/email.ts` queueEmail | Bad enqueues become silent failed queue items instead of caller-visible errors | Validate template status + variables in `queueEmail()` |
| Dunning/task-overdue triggers unwired | notifs integration | P2 | V1 RECOMMENDED | only 2 importers of `notification-triggers`; seed fakes the rows | Slice 027 GAP-012/GAP-017 regress silently; members miss overdue warnings | `[CROSS-MODULE RISK]` confirm alternate path, else wire triggers in dunning/committee jobs |
| M22 spec §8 phantom endpoints + false "COMPLETE" claims | spec | P2 | V1 RECOMMENDED | §4 matrix row | Future agents will "implement to spec" and re-add endpoints product may not want | Reconcile spec; record decisions for the 3 phantom ops |
| `organizationId: request.organizationId \|\| ''` on uuid column | notifs backend | P3 | V1 RECOMMENDED | `notification.repo.ts:145`; `InternalNotificationRequest.organizationId?` optional | Internal callers omitting orgId hit a Postgres uuid cast error at runtime | Validate orgId presence; throw ValidationError early `[NEEDS CONFIRMATION]` whether any caller omits it |
| Push marked `delivered` on OneSignal accept | notifs backend | P3 | V2 DEFERRED | `notification.repo.ts:454-456` | Status overstates delivery (accepted ≠ delivered); minor analytics distortion | Defer until delivery receipts matter `[DO NOT OVERBUILD]` |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Member toggles "Dues / Email" OFF in settings → stops getting dues emails | Preference enforced | Toggle saved to `person_subscriptions`; dues email path never reads it (only announcement fan-out reads opt-outs); person-table prefs never read at all | `notification-preferences.tsx`, `announcementSend.ts:153-158`, no reads elsewhere | P1 | backend test: notification with channel=email for category dues respects pref; E2E: toggle → trigger → assert no email queued |
| Officer composes announcement with Push channel → members' devices buzz | Web push delivered | OneSignal called server-side; no web client ever subscribed → zero recipients | `compose-form.tsx:179`, no react-onesignal import | P1 | E2E (after fix): subscription registered on login; backend test: push send targets external_id |
| Member clicks "Unsubscribe" in newsletter → later dues invoice still arrives | BR-57 override | Invoice email marked failed "Recipient is suppressed" | `core/email.ts` Guard 1 | P1 | backend test AC-M22-006 |
| Provider hard-bounces an address → future sends stop | Auto-suppression | Sends keep retrying/failing per item; address never suppressed | absent WF-124 path | P1 | backend test AC-M22-004/005 via webhook payload fixture |
| Member with overdue committee task gets nudged | task.overdue notification | Trigger exists, nobody calls it `[NEEDS CONFIRMATION]` | grep importers | P2 | integration test: overdue sweep → notification row |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `react-onesignal` dependency | frontend dep, never imported | `apps/memberry/package.json:82`; zero imports | Dead weight + implies feature exists | Wire or remove with descope decision |
| `triggerDunningEscalation`, `triggerTaskOverdue` | service functions w/o callers | grep: 2 importers only (waitlist + late-cancel) | Slice-027 gaps regress silently | Wire in owning jobs `[NEEDS CONFIRMATION]` |
| GET/PATCH `/persons/me/notification-preferences` | API w/o frontend consumer | `routes.ts:3226-3232`; UI uses `/association/person-subscriptions` | Duplicate source of truth | Converge (see §10) |
| `notification_preference` table in send path | fields saved but not enforced | read only by seed + deletion consumer | Decorative settings | Enforce or remove UI promise |
| `hard_bounce`/`complaint` enum values | schema values w/o writers | `suppression.schema.ts` enum; no ingestion | Dead schema until WF-124 built | Build WF-124 |
| `consentValidated` | field saved, never enforced | §6 row 1 | Compliance theater | Keep but clarify |
| `InternalNotificationRequest.priority`, `channels[1..n]`, `'sms'` | type fields ignored/unsupported | `notification.repo.ts:148` uses `channels?.[0]` | Caller confusion; sms would crash insert | Document/trim |
| Phantom M22 endpoints (DELETE template / POST send / DELETE suppression) | spec'd APIs w/o code | `m22-email/MODULE_SPEC.md` §8 | Spec-driven re-implementation risk | Reconcile spec; build only suppression delete |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `notification_channel` enum lacks `sms` while internal types accept it | schema/model | `notification.schema.ts` | P3 | Trim type until schema supports |
| `notification.organizationId` notNull but internal request type makes it optional and code falls back to `''` | backend/service | `notification.repo.ts:145` | P3 | Early ValidationError |
| Two preference tables (`notification_preference` person-owned; `person_subscriptions` communication-owned) with different category vocabularies (`dues/events/trainings/announcements/credits` vs UI's `dues/events/training/announcements/comms`) | schema + UI | `notification-preferences.schema.ts` NOTIFICATION_CATEGORIES vs `notification-preferences.tsx` CATEGORIES | P1 (part of §10 preference gap) | Single source of truth + shared category constants `[SHARED DEPENDENCY]` |
| Notification status `unread` is virtual (filter maps to sent/delivered) — spec describes it as a stored state | API/schema | `notifs.tsp:101,172` vs `notification_status` enum | P3 | Doc sync |
| Retry cap hardcoded `3` in two places (auto + manual) | backend | `queue.repo.ts:153,325` | P3 | Extract constant when touched; no schema change needed `[DO NOT OVERBUILD]` |
| Template resolution by tag-overlap picks first match of *any* tag — ambiguous when multiple active templates share a tag | backend | `core/email.ts` resolveTemplateByTags | P3 | Document ordering or match-all semantics when touched |
| Email queue cleanup ("30-day" per WF-110) — `subDays` imported in queue.repo; cleanup job existence not verified | backend/job | `queue.repo.ts` imports `subDays`; only `notifs.cleanup` cron seen | P3 `[NEEDS CONFIRMATION]` | Verify in fix phase; add if absent |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| All `/email/*` admin ops carry `x-security-required-roles: ["admin"]` in TypeSpec + in-handler role re-check | admin | `email.tsp` extensions; `testEmailTemplate.ts:1217-1220` | OK | None |
| Unsubscribe is public by design, HMAC-token-gated (T-25-07), registered pre-auth | public surface | `unsubscribeEmail.ts` verifyUnsubToken; `app.ts:84-88`; HAND_WIRED_ROUTES.yaml | OK | None |
| Hurl verifies 401 anonymous + 403 non-admin on `/email/templates` | contract | `email.hurl:15-23` | OK | None |
| Cross-user notification read returns 404 not 403 (existence-leak protection) | member | MODULE_SPEC.notifs §3; `findOneByIdAndRecipient` | OK (assert in test) | Keep; add explicit cross-user contract test (see §20) |
| Future bounce webhook must be signature-verified public route | public surface | n/a (to build) | P1 design constraint | Follow `/webhooks/stripe` precedent; allowlist in HAND_WIRED_ROUTES.yaml |
| M22 §5 says all email mgmt "Admin"; `app.ts:86` comment calls listEmailSuppressions "officer-only" | admin vs officer wording | `app.ts:86` vs M22 §5 | P3 | Align wording; behavior is admin-gated `[NEEDS CONFIRMATION]` |

## 15. Record Safety / Audit History Findings

(Module handles communication-compliance records: suppression list, queue audit trail.)

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Cancellation audit trail complete (`cancelled_by/at/reason`) + state-machine guard | email queue | `queue.repo.ts` cancelEmail | OK | Tag test to BR-59 |
| Suppression rows record `suppressedBy` (null = system) + reason + notes | suppression | `suppression.schema.ts` | OK | None |
| Unsubscribe events logged with email+orgId (PII in logs?) | logging | `unsubscribeEmail.ts` `logger.info({ email, orgId ... })` | P3 | Check against "never log PII" convention (CLAUDE.md Data Security) — email address in info log `[NEEDS CONFIRMATION]` |
| Guard skips logged for audit (T-25-04) | email queue | `core/email.ts` guard log lines | OK | None |
| Mark-read ops carry `notification.update` audit action per MODULE_SPEC.notifs §3 | notifs | spec claim; generated audit middleware | OK `[NEEDS CONFIRMATION]` (extension not directly inspected in notifs.tsp output) | Verify x-audit extensions during fix phase |

## 16. Knowledge Graph Findings

KG used as context only (`docs/aha/kg/knowledge-graph-status.md`); not regenerated. Wiring below verified by direct grep/inspection, consistent with KG module boundaries.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| `notifs` consumers: booking, comms, events (association:operations), dues refund consumer, communication announcementSend create notifications; only 2 files import the trigger layer | grep importers; `domain-event-consumers.ts:116-129` (dues.payment.refunded inserts notification directly) | Two parallel creation idioms (direct table insert in event consumers vs repo vs triggers) — fragmented integration surface | Note for fix phase: don't add a 4th idiom; prefer triggers/repo |
| Email service consumed via context injection in handlers and via `globalThis.app.email` in notification repo | `app.ts:195-199`; `notification.repo.ts` AppGlobal | Blast radius of EmailService changes includes a hidden global consumer | Keep in mind when fixing BR-57 (suppression API shape change) |
| `/email/suppressions` is both TypeSpec-generated (`routes.ts:2917`) and hand-wired (`app.ts:88`) — allowlisted | HAND_WIRED_ROUTES.yaml lines 53-54 | Intentional middleware-ordering duplicate; safe but must stay in sync | No action; documented |
| Person-deletion cascade covers notifications + notification preferences | `domain-event-consumers.ts:14,40` | PII cleanup intact for this module | None |

## 17. Domain Knowledge Findings

Domain references: `docs/product/WORKFLOW_MAP.md` §1.20 (WF-110), M22 workflows, audit-index §7 fan-out journey. Domain graph not regenerated.

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Delivery layer sits downstream of dues, events, training, communication — audit-index sequenced it after producers (order #12) | `docs/aha/outputs/module-audit-index.md` §16 | Gaps here (preferences, push) silently degrade every producer's UX | Fix preference enforcement once, centrally, in notification repo |
| For PH dental associations, dues + CPD reminders are the highest-value notifications | MASTER_PRD personas; seed content (dues overdue, convention waitlist) | BR-57 gap (unsubscribed member misses dues invoice) directly hits the core "stay current on dues" value prop | Prioritize BR-57 + dunning trigger wiring |
| Spec deliberately keeps notifs (per-recipient) separate from communication (templates/segments) | MODULE_SPEC.notifs §9 gotchas | Do not merge during fixes; dependency-cycle risk documented | Respect boundary in all fixes |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; existing E2E specs inspected only (see §19). No evidence files saved.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| — (not used) | — | — | — | — |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/email/*.test.ts` (12 files: cancel/create/get×2/list×3/retry/test/unsubscribe/update) | backend/unit | Per-handler auth gating + happy/error paths | Medium |
| `handlers/email/repos/{queue,suppression,template}.repo.test.ts` | backend/unit | Transitions, retry cap, suppression idempotency, render validation | High |
| `handlers/email/jobs/{index,processor}.test.ts` | backend/unit | Job registration + processor delegation | Medium |
| `core/email.test.ts` | backend/unit | Provider abstraction, service behavior | Medium |
| `handlers/notifs/{getNotification,listNotifications,markNotificationAsRead,markAllNotificationsAsRead}.test.ts` | backend/unit | 4 HTTP handlers incl. ownership | Medium |
| `handlers/notifs/notification-triggers.test.ts` + `notifs-handlers.test.ts` | backend/unit | Trigger functions called directly (not wiring) | Medium |
| `handlers/notifs/jobs/index.test.ts` | backend/unit | Cron registration | Medium |
| `specs/api/tests/contract/email.hurl` | contract | 401 anon, 403 non-admin, template list/create | Medium |
| `specs/api/tests/contract/email-extended-flow.hurl` | contract | test-send, queue get/cancel/retry — but cancel/retry use placeholder UUID `00000000-...` with `HTTP *` (route-exists assertions only) | Low |
| `specs/api/tests/contract/notifs.hurl` + `notifs-extended-flow.hurl` | contract | 401, empty list, read-all noop, 404 single/read | Medium |
| `apps/memberry/tests/e2e/journeys/communication-delivery.spec.ts` | E2E | announcement → delivery journey | Unknown (not executed) |
| `apps/memberry/src/.../notification-inbox.test.tsx`, `notification-drawer.test.tsx`, `preferences-view.test.tsx` | frontend/component | Inbox/drawer/prefs rendering | Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| BR-52 suppression-drop test, BR-tagged + registered in br-registry | backend/unit | Registry shows 0 coverage; behavior exists | Before (tag existing) |
| BR-53 inactive-template enqueue rejection | backend/unit | Drives the enqueue-validation fix | Before (failing first) |
| BR-54 max-retry terminal + manual-retry bound, BR-tagged | backend/unit | Tag existing `retryEmailQueueItem.test.ts` coverage | Before (tag) |
| BR-55/BR-56 bounce/complaint webhook → suppression | backend/unit + contract | New WF-124 surface; must be TDD'd | Before |
| BR-57 transactional bypasses `unsubscribe` suppression but not `hard_bounce` | backend/unit | Core fix proof | Before |
| BR-58 missing-variable enqueue rejection | backend/unit | Drives fix | Before |
| BR-59 cancellation audit fields, BR-tagged | backend/unit | Tag existing | Before |
| Preference enforcement: pref off → channel skipped; in-app always on | backend/unit + integration | Proves §10 preference fix | Before |
| Cross-user notification GET → 404 (not 403) | contract (hurl, 2-user) | Existence-leak protection currently asserted only in unit tests | During |
| Real queue-item cancel/retry contract flow (replace placeholder-UUID `HTTP *` steps) | contract | email-extended-flow currently proves routes exist, not transitions | During |
| Dunning escalation / task overdue → notification row created | integration | Wiring proof for unwired triggers | During |
| Notification inbox E2E (action → notification appears → mark read → badge decrements) | E2E/Playwright | MODULE_SPEC.notifs admits "no dedicated spec" | During/after |
| Web push subscription init (if push wired) | E2E | Prevent silent regression of OneSignal init | After push decision |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `person_subscriptions` (communication module) vs `notification_preference` (person module) | cross-module | §10 preference gap | Preference fix spans 3 modules (notifs, person, communication) + memberry UI | `[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]` — decide owner first (§25 Q3) |
| `core/email.ts` EmailService | shared/platform | consumed by auth mails, communication jobs, notification repo bridge, dues dunning | Guard changes (BR-57) affect every email producer | `[SHARED DEPENDENCY]` — change `isSuppressed` additively (return reason; keep boolean wrapper) |
| `core/domain-event-consumers.ts` | shared/platform | notif cleanup + dues-refund notification insert | Fix-phase edits must not disturb other subscribers | `[SHARED DEPENDENCY]` |
| Better-Auth email delivery (verify/reset/2FA templates under `handlers/email/templates/auth/`) | cross-module | `templates/initializer.ts` wired in `app.ts:36` | BR-57/Guard changes must never block auth mail (MODULE_SPEC.notifs gotcha re `include_unsubscribed`) | `[CROSS-MODULE RISK]` — regression-test auth email path |
| New bounce webhook route | shared/platform | must be hand-wired pre-auth + allowlisted | Touches `app.ts` + HAND_WIRED_ROUTES.yaml + contract CI | Document in HAND_WIRED_ROUTES.yaml when built |
| Suppression-reason-aware Guard 1 | database/schema | needs `isSuppressed` → reason lookup (no migration; reason column exists) | No schema change required | Module-local |
| Dunning job / committee-task job (association:member / association:operations) | cross-module | trigger wiring targets live outside this module | Wiring fix edits other modules' jobs | `[CROSS-MODULE RISK]` — minimal, additive calls only |
| OneSignal env config (`ONESIGNAL_APP_ID/API_KEY`, `VITE_ONESIGNAL_APP_ID`) | environment/tooling | `core/config.ts`; CLAUDE.md pattern | Push fix unverifiable without real/sandbox OneSignal app | `[BLOCKED BY ENVIRONMENT]` for live verification |

## 22. Raw Recommended Fix Ideas

(Not the final fix order — organizer prompt 03 sequences these.)

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Reason-aware suppression guard: transactional bypasses `unsubscribe`-reason suppressions | BR-57 | P1 | V1 REQUIRED | BR-57 unit tests (4 cases: bulk/transactional × unsubscribe/hard_bounce) | Smallest fix: `suppressionRepo.getSuppression()` returning reason; keep `isSuppressed` for other callers |
| Bounce/complaint webhook handler → auto-suppression | BR-55/56, WF-124 | P1 | V1 REQUIRED | webhook fixture tests + contract test | Provider choice affects payload shape — confirm provider (Postmark vs OneSignal) first (§25 Q2) |
| Enforce notification preferences in `NotificationRepository` channel dispatch (in-app always on) | preference gap | P1 | V1 REQUIRED | enforcement unit tests | Blocked by §25 Q3 (which table wins) |
| Converge preference UI onto chosen endpoint; unify category constants | preference gap | P1 | V1 REQUIRED | component test + E2E toggle journey | |
| Wire OneSignal web SDK init in memberry (login → external_id) OR remove push option from compose UI | push gap | P1 | V1 REQUIRED (path per product decision) | E2E init test or UI assertion | §25 Q1 |
| Tag + register BR-52/54/59 tests; write BR-53/55/56/57/58 tests | BR registry | P1 | V1 REQUIRED | the tests themselves | First batch in fix plan |
| `DELETE /email/suppressions/:id` (TypeSpec + handler + x-audit) | WF-125 | P2 | V1 RECOMMENDED | handler test + hurl | |
| Enqueue-time template-active + required-variable validation in `queueEmail()` | BR-53/58 | P2 | V1 RECOMMENDED | failing-first unit tests | Internal API only; no TypeSpec change |
| Wire `triggerDunningEscalation` + `triggerTaskOverdue` in owning jobs (after confirming no alternate path) | Slice 027 | P2 | V1 RECOMMENDED | integration tests | `[CROSS-MODULE RISK]` |
| Reconcile M22 §8/§12 with actual op set; sync MODULE_SPEC.notifs (status enum, no sms, 4 triggers) | spec drift | P2/P3 | V1 RECOMMENDED | n/a (doc) | Cheap, prevents future mis-implementation |
| Validate `organizationId` presence in `createNotificationForModule` | data finding | P3 | V1 RECOMMENDED | unit test | |
| Remove `'sms'` from internal channel types; document `channels[0]`-only behavior | type drift | P3 | V1 RECOMMENDED | type-level | |
| Verify/add email queue 30-day cleanup job | WF-110 | P3 | V1 RECOMMENDED | job test | `[NEEDS CONFIRMATION]` may already exist |
| Strengthen email-extended-flow.hurl with real queue item lifecycle | test gap | P2 | V1 RECOMMENDED | hurl rewrite | |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Admin UI screens for email queue/templates/suppressions | `V2 DEFERRED` | NAVIGATION_MAP explicitly declares no frontend routes; API-only is the spec'd V1 |
| `POST /email/send` direct-send endpoint | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | In spec §8 but absent from spec's own handler mapping; all real senders queue; adding a synchronous public send invites abuse |
| `DELETE /email/templates/:id` | `V2 DEFERRED` | `archived` status via PATCH covers retirement; hard delete risks dangling queue references |
| SMS channel | `V2 DEFERRED` | No schema support, no provider, no spec'd requirement beyond a parenthetical |
| Domain events EmailSent/EmailFailed/EmailBounced/EmailComplaint emission | `V2 DEFERRED` | No real consumer; logging already covers audit need `[DO NOT OVERBUILD]` |
| Delivery receipts / true `delivered` status from OneSignal callbacks | `V2 DEFERRED` | Analytics nicety; no V1 workflow depends on it |
| Multi-channel fan-out from `channels[]` array | `V2 DEFERRED` `[DO NOT OVERBUILD]` | Callers can issue one request per channel; building fan-out duplicates trigger-layer logic |
| Replacing the `globalThis.app.email` bridge with injected EmailService | `DO NOT ADD` (now) `[DO NOT OVERBUILD]` | Works; refactor is broad-blast-radius churn not justified by any active gap |
| Expanding `consentValidated` into a real consent engine | `DO NOT ADD` (now) `[NEEDS PRODUCT DECISION]` | CLAUDE.md: consent management deliberately not yet implemented; keep field dormant |
| Configurable per-template retry limits | `DO NOT ADD` | Hardcoded 3 with backoff meets BR-54; config adds surface without demand |
| Merging notifs into communication module | `DO NOT ADD` | MODULE_SPEC.notifs §9 documents the dependency-cycle risk; boundary is by design |

## 24. Audit Decision

**PARTIAL PASS**

The read path (in-app inbox, drawer, mark-read, unread badge) and the email queue engine (guarded processing, retries, cancellation audit, RFC 8058 unsubscribe, admin auth gating) are solidly implemented, TypeSpec-routed, and unit-tested. No P0: no core workflow is fully blocked and no data-loss/security hole was found.

It is not a PASS because five P1 gaps undermine V1 reliability and trust: (1) bounce/complaint auto-suppression (spec'd P0 workflow WF-124) does not exist; (2) the missing transactional-override means unsubscribed members silently lose dues/security email; (3) notification preferences are stored in two competing tables and enforced by neither delivery path; (4) web push is dead end-to-end on the frontend while the compose UI advertises it; (5) all 8 M22 business rules show zero registered test coverage, so none of the above can be fixed safely without test-first work.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Is web push in scope for V1 (wire `react-onesignal`) or mobile-only/deferred (hide push channel in compose UI)? | `[NEEDS PRODUCT DECISION]` | Determines whether the push gap is a build or a descope+UI fix | Product (Elad) |
| Q2: Which email provider is authoritative in production (SMTP / Postmark / OneSignal), and does it deliver bounce/complaint webhooks? | `[NEEDS CONFIRMATION]` `[BLOCKED BY ENVIRONMENT]` | Webhook payload shape and signature scheme for the WF-124 fix depend on it | Eng + Product |
| Q3: Which preference store wins — person-owned `notification_preference` (category × push/email) or communication-owned `person_subscriptions`? | `[NEEDS PRODUCT DECISION]` | Blocks the preference-enforcement fix; affects 3 modules + UI | Product + Eng |
| Q4: Do dunning-stage transitions and committee-task overdue sweeps create notifications through any path other than the unwired trigger functions? | `[NEEDS CONFIRMATION]` | If yes, §10 trigger finding downgrades to dead code removal; if no, members miss escalations | Eng |
| Q5: Were `DELETE /email/templates/:id` and `POST /email/send` consciously dropped from scope (spec table stale) or accidentally never built? | `[BLOCKED BY MISSING SPEC]` | Settles whether spec or code is the bug for the phantom endpoints | Product |
| Q6: Does an email-queue 30-day cleanup job exist (WF-110 claims it)? | `[NEEDS CONFIRMATION]` | Unbounded queue table growth otherwise | Eng |
| Q7: Is logging recipient email addresses at info level (`unsubscribeEmail.ts`) acceptable under the "never log PII" convention? | `[NEEDS CONFIRMATION]` | DPA 2012 posture | Eng/Compliance |

## 26. Notes for Gap Plan Organizer

- **Truly-V1 PRD gaps:** WF-124 bounce/complaint auto-suppression (BR-55/56); BR-57 transactional override; preference enforcement; push wire-or-descope; BR test registration. These five are the P1 backbone of the fix-ready plan.
- **Likely P0/P1 fixes:** none P0. P1 order suggestion: (1) BR test tagging/writing first (everything else needs it), (2) BR-57 reason-aware guard (smallest blast radius, highest member-trust payoff), (3) WF-124 webhook (blocked on Q2 provider confirmation), (4) preference enforcement (blocked on Q3), (5) push decision (blocked on Q1).
- **Selected P2s worth pulling into V1 completeness:** `DELETE /email/suppressions/:id`; enqueue-time BR-53/58 validation; dunning/task-overdue trigger wiring (after Q4); hurl placeholder-UUID hardening; M22 + MODULE_SPEC.notifs doc reconciliation.
- **Implemented-but-not-in-PRD items not to expand:** `consentValidated`, `channels[]`/`priority`/`sms` internal fields, global-app email bridge, OneSignal-as-email-provider. All Keep-but-clarify or DO NOT ADD.
- **Risky shared dependencies:** `core/email.ts` guard changes touch auth mail (Better-Auth verify/reset/2FA) — regression-test that path; preference fix spans person + communication + notifs + memberry UI; bounce webhook touches `app.ts` + HAND_WIRED_ROUTES.yaml.
- **Database/schema dependencies:** none require migrations for the P1 set (suppression `reason` column and `email_category` already exist). Preference convergence may eventually deprecate one table — flag for prompt 06, do not do it in module fix.
- **Tests to write first:** BR-53/55/56/57/58 failing tests; preference-enforcement tests; trigger-wiring integration tests. Tag BR-52/54/59 onto existing tests and register all in `br-registry.json`.
- **Product decisions that block fixing:** Q1 (push scope), Q2 (provider/webhooks), Q3 (preference store), Q5 (phantom endpoints).
- **Must NOT be implemented yet:** everything in §23 — especially admin email UI, direct-send endpoint, SMS, domain-event emission, multi-channel fan-out, and the email-service DI refactor.

---

Next recommended step:
Module/group: Notifications & Email
Module slug: notifications-email
Primary PRD/spec: docs/product/modules/m22-email/MODULE_SPEC.md + docs/product/MODULE_SPEC.notifs.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/notifications-email-gap-plan.md
