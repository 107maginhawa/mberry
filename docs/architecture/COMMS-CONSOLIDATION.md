# Communications Module Consolidation Assessment

> **Status:** Proposal (V-16)
> **Date:** 2026-05-20
> **Author:** Architecture review (automated)

## 1. Current State

Four communication-related handler modules exist under `services/api-ts/src/handlers/`:

| Module | Handlers | Bounded Context | TypeSpec | Database Tables |
|--------|----------|-----------------|----------|-----------------|
| `communication/` | 28 | Async messaging: templates, queuing, announcements, subscriptions, feed | Yes | `communication` schema (messages, templates, announcements, subscriptions) |
| `comms/` | 11 | Real-time: WebSocket chat rooms, video calls (ICE/TURN) | Yes | `comms` schema (chat rooms, messages, video calls, participants) |
| `email/` | 10 | Transactional email: queue, templates, suppression lists, RFC 8058 unsubscribe | Yes | `email` schema (queue items, templates), `suppression` schema |
| `notifs/` | 6 | Push notifications via OneSignal, in-app notification feed | Yes | `notification` schema |

**Total: 55 handlers across 4 modules.**

### What Each Module Does

**communication/** — Application-level messaging. Members send messages to each other or groups. Admins create announcement templates, manage subscription topics, moderate the professional feed. This is the "mailbox" and "bulletin board" of the platform.

**comms/** — Real-time communication infrastructure. WebSocket-based chat rooms and video calls with ICE/TURN server coordination. Stateful connections, presence tracking, recording management. Fundamentally different runtime model (persistent connections vs request/response).

**email/** — Transactional email delivery pipeline. Manages an outbound queue with retry/cancel semantics, email-specific templates (HTML rendering, subject lines), suppression lists for bounce/complaint handling, and RFC 8058 one-click unsubscribe compliance. This is the "mail server interface" — it does not own message content, it delivers it.

**notifs/** — Push notification dispatch via OneSignal. Manages notification records (read/unread state), triggers from other modules, and multi-channel delivery (push, in-app). Notification-specific concerns: batching, read-all, per-device targeting.

## 2. Rationale for Current Separation

The modules are separated along **transport and runtime boundaries**, not arbitrary lines:

### Real-time vs. Request/Response
`comms/` uses WebSocket connections with persistent state (who is in a room, who is on a call). Every other module uses standard HTTP request/response. Mixing WebSocket lifecycle management with REST handlers creates coupling that makes both harder to test, deploy, and scale independently.

### Content Ownership vs. Delivery
`communication/` owns message **content** (what to say, to whom, templates, subscriptions). `email/` owns **delivery** (how to get an email out the door, handle bounces, manage suppression). This is a classic content/transport split. A message in `communication/` might be delivered via email, push, or in-app — the delivery channel is orthogonal to the message itself.

### Platform Service vs. Domain Feature
`notifs/` and `email/` are **platform services** — they serve all other modules. Any handler can trigger a notification or queue an email. `communication/` is a **domain feature** — it implements the messaging product that members interact with directly.

## 3. Consolidation Assessment

### Keep Separate: `comms/` (WebSocket)
**Recommendation: No change.**

WebSocket handlers have fundamentally different concerns: connection lifecycle, presence, media streams, ICE negotiation. Merging them into `communication/` would mix two runtime models and make the module harder to reason about. The CLAUDE.md statement ("separate bounded contexts") is architecturally sound.

### Keep Separate: `notifs/` (Push Notifications)
**Recommendation: No change.**

OneSignal integration is a platform-level concern with its own device registry, app tagging, and multi-channel dispatch logic. It serves every module in the system, not just communications. Merging it would create an inappropriate dependency — booking confirmations should not need to import from a "communications" module.

### Candidate for Merge: `email/` into `communication/`
**Recommendation: Defer. Document as future option.**

The case for merging:
- Email templates in `email/` and message templates in `communication/` share conceptual overlap (both are "templates for outbound content")
- A unified `communication/` module could own all async outbound: messages, announcements, emails
- Reduces module count by one, simplifying navigation

The case against merging (stronger):
- `email/` has **delivery-specific concerns** that do not belong in a content module: SMTP queue management, bounce handling, suppression lists, RFC 8058 compliance. These are transport-layer, not application-layer.
- `email/` serves as a **platform service** — other modules (billing, booking, membership) queue emails directly. Making them import from `communication/` creates a misleading dependency.
- The email schema (queue items with retry counts, suppression entries with bounce reasons) has no overlap with the communication schema (messages, announcements, subscriptions).
- Separate modules allow independent scaling: email queue processing can be extracted to a worker without touching the communication module.

### Summary Matrix

| Module | Merge Target | Verdict | Reason |
|--------|-------------|---------|--------|
| `comms/` | None | **Keep separate** | Different runtime model (WebSocket) |
| `notifs/` | None | **Keep separate** | Platform service, serves all modules |
| `email/` | `communication/` | **Defer** | Transport vs. content boundary is clean; merge adds coupling without reducing complexity |

## 4. Migration Steps (If Email Merge Proceeds)

If a future decision reverses the deferral, here is the migration path:

### Step 1: Move Handlers
```
services/api-ts/src/handlers/email/*.ts
  → services/api-ts/src/handlers/communication/email/
```
Preserve all file names. The `email/` subdirectory within `communication/` maintains the bounded context visually.

### Step 2: Move Schemas
```
services/api-ts/src/handlers/email/repos/email.schema.ts
services/api-ts/src/handlers/email/repos/suppression.schema.ts
  → services/api-ts/src/handlers/communication/repos/
```
No schema changes needed — tables stay the same, only import paths change.

### Step 3: Move Repositories
```
services/api-ts/src/handlers/email/repos/*.repo.ts
  → services/api-ts/src/handlers/communication/repos/
```

### Step 4: Update Route Registration
Update `app.ts` or generated route files to register email routes from the new location. Route paths (`/email/*`) stay identical — no API breaking change.

### Step 5: Update Cross-Module Imports
Search for all imports from `handlers/email/` across the codebase and update paths. Key consumers:
- Any module that queues transactional emails
- Job processors in `email/jobs/`
- Notification triggers that send email

### Step 6: Update TypeSpec
Move email-related TypeSpec definitions under the communication namespace if desired, or keep them in a separate namespace registered from the same module directory.

### Backwards Compatibility
- **API routes**: No change. All `/email/*` endpoints keep their paths.
- **Database**: No change. Tables and migrations untouched.
- **SDK**: No change. Generated client methods remain the same.
- **Only internal import paths change.** This is a refactor, not a feature change.

## 5. Decision

**Recommendation: Maintain current 4-module structure.**

The separation along transport boundaries (WebSocket / HTTP+content / HTTP+email-delivery / HTTP+push) is architecturally sound. Each module has distinct:
- Runtime characteristics (persistent connections vs. queue processing vs. request/response)
- Schema ownership (no table overlap)
- Scaling profiles (email queue can spike independently of chat traffic)
- Compliance requirements (email: RFC 8058, CAN-SPAM; notifs: device consent; comms: none specific)

The compliance report flagged this as a consolidation opportunity based on naming similarity ("communication", "comms", "email" all sound like messaging). On inspection, the boundaries are well-drawn. The 3-handler naming confusion is a documentation problem, not an architecture problem — which this document resolves.

**Action items:**
1. This document serves as the canonical reference for why 4 modules exist.
2. No code changes required.
3. Revisit if `email/` grows beyond delivery concerns into content management (currently it does not).
