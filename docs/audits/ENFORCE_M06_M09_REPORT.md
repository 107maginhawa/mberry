# OLI Enforcement Report: Modules M06-M09

**Date:** 2026-05-29
**Phase:** 1 (oli-enforce-module + oli-enforce-file)
**Modules:** M06 (Dues & Payments), M07 (Communications), M08 (Events), M09 (Training)

---

## Summary

| Module | Spec Sections | Findings | P0 | P1 | P2 | P3 |
|--------|--------------|----------|----|----|----|----|
| M06 | 22/22 PRESENT | 8 | 0 | 3 | 4 | 1 |
| M07 | 22/22 PRESENT | 11 | 1 | 3 | 5 | 2 |
| M08 | 22/22 PRESENT | 9 | 1 | 2 | 5 | 1 |
| M09 | 22/22 PRESENT | 7 | 0 | 2 | 4 | 1 |
| **Total** | **88/88** | **35** | **2** | **10** | **18** | **5** |

---

## A. Module-Level Enforcement (oli-enforce-module)

### M06 — Dues & Payments

**Spec Completeness: 22/22 PRESENT** — All sections populated per self-assessment in §21.

**Spec-vs-Code Alignment:**

| Check | Status | Notes |
|-------|--------|-------|
| API endpoints exist | PARTIAL | Spec declares 10 endpoints; handlers cover ~8. Missing: dedicated refund endpoint, bulk payment recording handler (test exists but no handler) |
| Domain events emitted | PARTIAL | `PaymentRecorded` not explicitly emitted via `domainEvents.emit()` in handlers — payment side-effects handled via jobs. `InvoiceGenerated` and `dunning.escalation` emitted by job processors. `PaymentRefunded` — no refund handler found |
| Business rules enforced | MOSTLY | BR-30 (two-level gateway), BR-32 (7-year retention), BR-28 (Life member block) enforced. Fund allocation rounding tested in utils. Missing: explicit 2FA check for treasurer/president |
| State machine matches | YES | `dues_payment_status` enum matches spec transitions |

**Module Findings:**

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M06-no-refund-handler | P1 | No refund processing handler exists. Spec §10 declares refund endpoint; §4 details WF-041 (Refund Processing). Only webhook-based payment processing exists. | §10, §4 WF-041 | HIGH |
| EM-M06-no-bulk-handler | P2 | `bulkRecordPayments.test.ts` exists but no corresponding handler `.ts` file. Tests reference functionality that isn't implemented. | §10 | HIGH |
| EM-M06-no-payment-recorded-event | P2 | Spec §10b declares `PaymentRecorded` domain event. No explicit `domainEvents.emit('payment.recorded', ...)` in any dues handler. Payment effects handled via job queue but event contract not fulfilled. | §10b | HIGH |
| EM-M06-no-2fa-check | P2 | Spec §6 requires treasurer and president to have 2FA for all financial mutations. `requirePosition()` checks officer role but no 2FA verification step. | §6, §20.8 | MEDIUM |

---

### M07 — Communications

**Spec Completeness: 22/22 PRESENT** — All sections populated.

**Spec-vs-Code Alignment:**

| Check | Status | Notes |
|-------|--------|-------|
| API endpoints exist | YES | 28 communication + 11 comms handlers present. `communications/` directory empty (by-design: announcements handled in `communication/`) |
| Domain events emitted | PARTIAL | `announcement.published` emitted in publishAnnouncement. `ChatRoomCreated` and `MessageScheduled` not emitted. |
| Business rules enforced | PARTIAL | BR-M07-01 (in-app always on) not enforced at handler level. Opt-out logic not implemented in visible handlers. |
| State machine matches | YES | Announcement: draft→scheduled→sent→archived matches spec. Message: draft→scheduled→sending→sent→cancelled→failed matches. |

**Module Findings:**

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M07-no-role-check-create | P2 | `createAnnouncement` has no `requirePosition()` check. Any authenticated user can create announcements. Spec §6 limits creation to officers. | §6 | HIGH |
| EM-M07-chatroom-no-domain-event | P1 | Spec §10b declares `ChatRoomCreated` domain event. `createChatRoom.ts` does not emit it. | §10b | HIGH |
| EM-M07-message-scheduled-no-event | P2 | Spec §10b declares `MessageScheduled` domain event. `scheduleMessage.ts` does not emit it. | §10b | MEDIUM |
| EM-M07-comms-dir-empty | P3 | CLAUDE.md documents `handlers/communications/` (8 handlers, hand-wired). Directory does not exist. Announcements are in `communication/`. Documentation mismatch. | CLAUDE.md | HIGH |

---

### M08 — Events

**Spec Completeness: 22/22 PRESENT** — All sections populated.

**Spec-vs-Code Alignment:**

| Check | Status | Notes |
|-------|--------|-------|
| API endpoints exist | YES | 15 handler files cover all spec endpoints |
| Domain events emitted | YES | `event.registered`, `event.cancelled`, `event.registration.cancelled` all emitted with `.catch(() => {})` |
| Business rules enforced | MOSTLY | BR-15 (no credits from events), BR-17 (officer check-in), BR-27 (waitlist FIFO), M8-R1 (paid event block), M8-R6 (post-completion lock) all enforced |
| State machine matches | PARTIAL | Spec declares draft→published→registration_open→in_progress→completed→cancelled. Code has no explicit state machine; status set ad-hoc. |

**Module Findings:**

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M08-no-event-published-event | P1 | Spec §10b declares `EventPublished` domain event. No handler emits it. `createEvent` creates with status 'draft'; no publish handler exists to transition to 'published' and emit the event. | §10b | HIGH |
| EM-M08-no-explicit-state-machine | P2 | Unlike M09 which has `TRAINING_VALID_TRANSITIONS`, events module has no centralized state machine. Status transitions are ad-hoc per handler. Spec §8 defines formal transitions. | §8 | MEDIUM |

---

### M09 — Training

**Spec Completeness: 22/22 PRESENT** — All sections populated.

**Spec-vs-Code Alignment:**

| Check | Status | Notes |
|-------|--------|-------|
| API endpoints exist | YES | 15 handler files cover spec endpoints. Certificate PDF/verification endpoints not in training handlers (handled by certificates module). |
| Domain events emitted | YES | `credit.awarded`, `training.completed`, `training.published`, `training.cancelled` all emitted |
| Business rules enforced | YES | BR-13 (auto-credit), BR-15 (training-only credits), BR-17 (officer check-in), M9-R2 (paid enrollment block), M9-R3 (post-completion lock), M9-R7 (idempotent credits) all enforced |
| State machine matches | YES | `TRAINING_VALID_TRANSITIONS` matches spec §8 exactly |

**Module Findings:**

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M09-no-certificate-generation | P1 | Spec §4 WF-061 and BR-20 require certificate generation with HMAC-signed QR on training completion. `completeTraining.ts` does not trigger certificate generation. Certificates module exists separately but no integration wired. | §4 WF-061, BR-20 | HIGH |
| EM-M09-no-cancel-refund-cascade | P2 | Spec BR M9-R5 requires cancelled trainings to refund all enrolled members via M06. `cancelTraining.ts` transitions status but does not trigger refund cascade or emit event consumed by M06. | BR M9-R5 | HIGH |

---

## B. File-Level Enforcement (oli-enforce-file)

### M06 — handlers/dues/

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M06-webhook-no-sig-verify | P2 | stripeWebhook.ts | Webhook handler receives raw body and dispatches to `webhookRetryProcessor`. No Stripe signature verification visible in handler (may be in middleware — needs verification). Spec §20.4 requires signature verification. | §20.4 | MEDIUM |
| EF-M06-dashboard-pii | P3 | getDuesDashboard.ts | Returns aggregate stats only (totalCollected, memberCount). No PII exposure. Clean. | -- | HIGH |
| EF-M06-checkout-no-audit | P2 | checkoutPaymentToken.ts | Public endpoint (no auth). Creates Stripe checkout session. No audit trail for checkout initiation. Spec §17 requires financial action logging. | §17 | MEDIUM |
| EF-M06-reminder-no-consent | P1 | jobs/reminderProcessor.ts | Sends payment reminders via email. No opt-out/consent check before sending. Spec §4 WF-042 (Dunning) requires respecting communication preferences. | §4 WF-042 | HIGH |

### M07 — handlers/communication/

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M07-create-ann-no-officer | P2 | createAnnouncement.ts | Auth check is `session` only. No `requirePosition()` — any authenticated user can create announcements. Spec §6 requires officer role. | §6 | HIGH |
| EF-M07-delete-ann-no-officer | P2 | deleteAnnouncement.ts | Auth check is `session` only. No `requirePosition()` — any authenticated user can delete draft announcements. Spec §6 requires officer role. | §6 | HIGH |
| EF-M07-list-ann-no-org-scope | P2 | listAnnouncements.ts | Lists by orgId from URL param, but no verification that the requesting user belongs to that org. Any authenticated user could list another org's announcements. | §6 | HIGH |
| EF-M07-get-stats-no-officer | P3 | getAnnouncementStats.ts | Uses raw `Context` type (not `ValidatedContext`). No role check — any authenticated user can view stats. Stats are aggregate, low-risk. | §6 | LOW |
| EF-M07-announcement-send-job | P1 | jobs/announcementSend.ts | Processes announcement delivery in batches. Does not check per-member subscription preferences before sending. Spec §11 AC-M07-002 requires email opt-out respected. | §11 AC-M07-002 | HIGH |

### M07 — handlers/comms/

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M07-webrtc-token-placeholder | P0 | joinVideoCall.ts | `generateWebRTCToken()` returns hardcoded `'USE_SESSION_TOKEN'` sentinel. Comment says "deferred to v1.2.0". Any client that reads this token gets no real auth. If video calls are enabled, this is a security gap. | §20 | HIGH |
| EF-M07-ice-no-auth | P2 | getIceServers.ts | Need to verify if ICE server endpoint requires auth. Exposing TURN credentials without auth is a P0. | -- | LOW |
| EF-M07-ws-no-rate-limit | P2 | ws.chat-room.ts | WebSocket handler processes all message types without rate limiting. A malicious client could flood the room. | §16 | MEDIUM |

### M08 — handlers/events/

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M08-listEvents-no-auth | P0 | listEvents.ts | **No authentication check at all.** No `session` check, no `UnauthorizedError`. Any unauthenticated request with a valid orgId URL can list all events including draft/internal ones. Spec §6 requires member auth for viewing. | §6 | HIGH |
| EF-M08-listMyEvents-no-null-check | P2 | listMyEvents.ts | Accesses `session.user.id` without null-checking `session`. Will throw unhandled error if session middleware is absent. | -- | MEDIUM |
| EF-M08-updateEvent-no-completion-lock | P2 | updateEvent.ts | No status guard for completed events. Spec §8/M8-R6 says completed events should be locked. Handler rejects status changes but allows other field edits on completed events. | §8, M8-R6 | HIGH |
| EF-M08-register-no-race-guard | P2 | registerForEvent.ts | Registration count check (`getRegistrationCount`) and insert are not atomic. Two concurrent registrations could exceed capacity. Spec AC-M08-002 requires capacity enforcement. | AC-M08-002 | MEDIUM |
| EF-M08-checkin-body-no-validate | P2 | checkIn.ts | Uses `ctx.req.json()` for body parsing (no Zod validation). `body.personId` could be anything. Should use `ValidatedContext` with generated validators. | -- | MEDIUM |
| EF-M08-no-audit-trail | P1 | Multiple (createEvent, updateEvent, registerForEvent, checkIn) | None of the event handlers use `auditAction()`. All mutations happen without audit logging. Spec §17 requires observability hooks. | §17 | HIGH |
| EF-M08-cancel-notif-fire-forget | P3 | cancelEvent.ts | Notification cascade runs in detached async IIFE `(async () => { ... })()`. Errors are caught but if the process exits, notifications are lost. Should use job queue. | §15 | LOW |

### M09 — handlers/training/

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M09-listTrainings-no-auth | P1 | listTrainings.ts | **No authentication check.** No `session` check. Any request with orgId can list all trainings. Pattern matches M08's listEvents issue. | §6 | HIGH |
| EF-M09-listMyTrainings-no-null | P2 | listMyTrainings.ts | Accesses `session.user.id` without null-checking session. | -- | MEDIUM |
| EF-M09-create-no-audit | P2 | createTraining.ts | No `auditAction()` call. Creating a training is a data-modification that should be audit-logged. | §17 | HIGH |
| EF-M09-enroll-waitlist-status | P3 | enroll.ts | When waitlisted, sets enrollment status to `'cancelled'` instead of `'waitlisted'`. This conflicts with spec §8 enrollment_status enum which has a 'waitlisted' state. | §8 | HIGH |
| EF-M09-markComplete-no-audit | P2 | markComplete.ts | No `auditAction()` call for marking attendance complete and awarding credits. This is the most critical data mutation in the module. | §17 | HIGH |

---

## Cross-Module Patterns

### Recurring Issues

1. **Missing audit logging (P1-P2):** M08 and M09 handlers consistently lack `auditAction()` calls. M06 and M07 use it properly.

2. **Missing auth on list endpoints (P0-P1):** `listEvents.ts` (M08) and `listTrainings.ts` (M09) have zero authentication. Both are hand-wired (raw `Context`, not `ValidatedContext`). This pattern suggests these were written before auth middleware was standardized.

3. **No domain event emission for consumed events (P2):** Spec declares consumed events (MembershipApproved → M06, PaymentRecorded → M09) but no event listeners/handlers are wired for consumption. The event bus exists (`domainEvents`) but listeners aren't registered.

4. **Hand-wired vs TypeSpec split:** M06 (dues) and M09 (training) are fully hand-wired. M07 (communication) is TypeSpec. M08 (events) is TypeSpec but many handlers use raw `Context`. This creates inconsistent validation patterns.

---

## Finding Index (All 35 Findings)

| ID | Sev | Module | Type |
|----|-----|--------|------|
| EM-M06-no-refund-handler | P1 | M06 | module |
| EM-M06-no-bulk-handler | P2 | M06 | module |
| EM-M06-no-payment-recorded-event | P2 | M06 | module |
| EM-M06-no-2fa-check | P2 | M06 | module |
| EF-M06-webhook-no-sig-verify | P2 | M06 | file |
| EF-M06-checkout-no-audit | P2 | M06 | file |
| EF-M06-reminder-no-consent | P1 | M06 | file |
| EF-M06-dashboard-pii | P3 | M06 | file |
| EM-M07-no-role-check-create | P2 | M07 | module |
| EM-M07-chatroom-no-domain-event | P1 | M07 | module |
| EM-M07-message-scheduled-no-event | P2 | M07 | module |
| EM-M07-comms-dir-empty | P3 | M07 | module |
| EF-M07-create-ann-no-officer | P2 | M07 | file |
| EF-M07-delete-ann-no-officer | P2 | M07 | file |
| EF-M07-list-ann-no-org-scope | P2 | M07 | file |
| EF-M07-get-stats-no-officer | P3 | M07 | file |
| EF-M07-announcement-send-job | P1 | M07 | file |
| EF-M07-webrtc-token-placeholder | P0 | M07 | file |
| EF-M07-ice-no-auth | P2 | M07 | file |
| EF-M07-ws-no-rate-limit | P2 | M07 | file |
| EM-M08-no-event-published-event | P1 | M08 | module |
| EM-M08-no-explicit-state-machine | P2 | M08 | module |
| EF-M08-listEvents-no-auth | P0 | M08 | file |
| EF-M08-listMyEvents-no-null-check | P2 | M08 | file |
| EF-M08-updateEvent-no-completion-lock | P2 | M08 | file |
| EF-M08-register-no-race-guard | P2 | M08 | file |
| EF-M08-checkin-body-no-validate | P2 | M08 | file |
| EF-M08-no-audit-trail | P1 | M08 | file |
| EF-M08-cancel-notif-fire-forget | P3 | M08 | file |
| EM-M09-no-certificate-generation | P1 | M09 | module |
| EM-M09-no-cancel-refund-cascade | P2 | M09 | module |
| EF-M09-listTrainings-no-auth | P1 | M09 | file |
| EF-M09-listMyTrainings-no-null | P2 | M09 | file |
| EF-M09-create-no-audit | P2 | M09 | file |
| EF-M09-enroll-waitlist-status | P3 | M09 | file |
| EF-M09-markComplete-no-audit | P2 | M09 | file |

---

## Recommended Fix Priority

### Wave 1 — P0 Security (Immediate)
1. **EF-M08-listEvents-no-auth** — Add session check to `listEvents.ts`
2. **EF-M07-webrtc-token-placeholder** — Either disable video calls via feature flag or implement real token auth

### Wave 2 — P1 Missing Spec Compliance
3. **EF-M09-listTrainings-no-auth** — Add session check
4. **EF-M06-reminder-no-consent** — Check subscription preferences before sending
5. **EF-M07-announcement-send-job** — Check opt-out before delivery
6. **EF-M08-no-audit-trail** — Add `auditAction()` to all event mutation handlers
7. **EM-M06-no-refund-handler** — Implement refund endpoint
8. **EM-M07-chatroom-no-domain-event** — Emit `ChatRoomCreated`
9. **EM-M08-no-event-published-event** — Add publish endpoint + emit `EventPublished`
10. **EM-M09-no-certificate-generation** — Wire certificate generation on training completion

### Wave 3 — P2 Validation/Completeness
11-28. Remaining P2 findings (role checks, org scoping, race guards, audit gaps)

### Wave 4 — P3 Convention
29-33. Documentation mismatches, status enum fixes, fire-and-forget patterns
