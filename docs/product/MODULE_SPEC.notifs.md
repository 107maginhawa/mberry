# MODULE_SPEC: notifs

> Generated as part of Step-2 (MODULE_SPEC backfill).

## 1. Purpose

Owns the multi-channel notification surface: persistent in-app notification rows, OneSignal-driven web/mobile push, and (where the queue is configured) email + SMS fan-out, all keyed off person id (`external_id`) so a user with multiple roles sees the same notification in whichever app they happen to be using. The module also owns notification triggers — the integration point between domain modules (dues, booking, events, training, communication) and the fan-out machinery.

## 2. Bounded Context

**Owns:** `notification` table, the `notification-triggers` integration layer (one function per domain module), OneSignal envelope generation, WebSocket push via `core/notifs.ts` (`ws.publishToUser`), read-state lifecycle (`unread` → `read`).

**Out of scope:** notification *content* templates — those live in `communication` (which owns the template, segment, and announcement primitives). Org-wide announcements are a `communication` concern; `notifs` is per-recipient. Also out of scope: notification *preferences* — the read/write surface for those lives at `/persons/me/notification-preferences` and is owned by `person` (a thin facade over the preferences table).

**Adjacent modules:**
- `communication` — owns templates and broadcast / segment logic. `notifs` is the "deliver to one person" tier.
- `email` — separate sink. notifs writes to email queue when channel=email is required, via the `EmailService` injected through context.
- `person` — owns notification preferences and the OneSignal `external_id` mapping.
- `comms` (real-time WS) — distinct module (video + chat). `notifs` uses the same WS infrastructure for in-app push but does not own it.

## 3. Handler Inventory

| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `listNotifications.ts` | GET `/notifs` | `user` / `admin` | (read) | Returns the caller's notifications. Pagination + status filter. |
| `getNotification.ts` | GET `/notifs/:notif` | `user` / `admin` | (read) | Returns 404 (not 403) on cross-user reads to avoid existence leak. |
| `markNotificationAsRead.ts` | POST `/notifs/:notif/read` | `user` | `notification.update` | Idempotent — re-reading is a no-op. |
| `markAllNotificationsAsRead.ts` | POST `/notifs/read-all` | `user` | `notification.update` (batch) | Optional `?type=<category>` query filter. |
| `notification-triggers.ts` | (no HTTP) | n/a | n/a | One factory per integration: `triggerDuesReminder`, `triggerEventConfirmation`, etc. Domain modules call these from their handlers (or from domain-event consumers) to fan out. The functions own channel selection + targetApp gating. |

Test coverage: 4 unit specs for the 4 HTTP handlers, plus `notification-triggers.test.ts` (the trigger surface) and `notifs-handlers.test.ts` aggregator.

## 4. TypeSpec source

`specs/api/src/modules/notifs.tsp` — 4 operations (`listNotifications`, `getNotification`, `markNotificationAsRead`, `markAllNotificationsAsRead`). Notification preferences operations are declared in `specs/api/src/modules/person.tsp` because the preference table is owned by person.

## 5. Database schema

- `services/api-ts/src/handlers/notifs/repos/notification.schema.ts` — `notifications` table; multi-tenant scoped on `organizationId`.

The schema carries: recipient (person id), type (free-text category), channel (in-app / push / email / sms), title, message, payload jsonb (deep-link target), targetApp nullable (web / mobile), status (`unread` / `read`), read-at timestamp.

## 6. Cross-module dependencies

- **Emits domain events:** none today. `notifs` is a sink — events flow *into* it.
- **Consumes events from:**
  - `person.deleted` — consumer in `core/domain-event-consumers.ts` scrubs notifications for the deleted person.
  - Domain modules (dues, booking, events, training, communication) call notification-triggers functions directly when they have transactional intent (immediate side-effect of an action), and via the event bus for cleanup cascades.
- **Calls handlers from:** none. Trigger functions use `notification.repo` directly + the OneSignal client.

## 7. Test coverage status

- Unit tests: 4/4 handlers + triggers covered (`notification-triggers.test.ts`).
- Contract scenarios: `notifs.hurl` + `notifs-extended-flow.hurl` (2 files, all passing as of Step-1 baseline).
- E2E: no dedicated spec. Notifications surface is exercised indirectly through e2e flows that follow a domain action and then assert a notification appears in the UI list.

## 8. Hand-wired routes

None. All 4 HTTP routes go through the generated registry.

## 9. Known gotchas

- **`notifs` vs `communication` — by design.** Per CLAUDE.md, `communication` owns templates + segments + broadcast; `notifs` owns per-recipient delivery + read state. Don't merge them. The temptation is to push template rendering into `notifs` — resist; that creates a dependency cycle with the announcement flow.
- **OneSignal `external_id` IS `person.id`.** The push target is the person, not the device. A person with multiple devices sees the same notification on all of them (mobile, web). `targetApp` is an optional override — when set, the notification is filtered to web-only or mobile-only via OneSignal tags. Most notifications leave `targetApp` null (app-agnostic).
- **`include_unsubscribed: true` is set for transactional email** (see `core/email.ts:217`). This is required for the OneSignal email channel to send reset / verify mails even when the recipient has unsubscribed from marketing. Don't flip this — it is the only thing keeping deliverability on auth flows.
- **Notification-trigger functions are NOT bound to HTTP** — domain modules import them and call inline. They live under `notifs/notification-triggers.ts` so they can be tested independently of the HTTP surface and so the trigger surface is unified (one place to grep for "what triggers what").
- **Notifications survive across orgs.** `organizationId` is on the row, but the list endpoint returns notifications for ALL orgs the caller is a member of — this is intentional, the UI shows one unified inbox.

## 10. AI extension checklist

To add a new notification *type* (no new HTTP endpoint):

1. Add a new trigger function in `services/api-ts/src/handlers/notifs/notification-triggers.ts`. Sign it like the existing triggers — pure args (no ctx), return Promise<void>, internally use the repo + OneSignal client passed in.
2. Call the trigger from the domain module that owns the action (e.g. dues calls `triggerDuesReminder`).
3. Add a unit test in `notification-triggers.test.ts`.
4. No TypeSpec / generator step needed — there is no HTTP surface change.

To add a new HTTP endpoint:

1. `specs/api/src/modules/notifs.tsp` — declare the operation; for mutations add `@extension("x-audit", #{ action: "...", resourceType: "notification" })`.
2. `services/api-ts/src/handlers/notifs/<verbResource>.ts` — implement, follow the listNotifications role-filter pattern.
3. Tests + contract scenarios as normal.
4. Regenerate: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Hand-rolling OneSignal envelope JSON in a handler — use the helpers in `core/email.ts` / `core/notifs.ts`.
- Writing notification *content* into a row without a corresponding template lookup (when applicable) — that defeats internationalization + branding overrides.
- Storing PII in `payload.deepLink` plaintext — `D-03` (W4.5 observability fix) already addressed this for platformadmin; new triggers must follow the masked-PII pattern.
