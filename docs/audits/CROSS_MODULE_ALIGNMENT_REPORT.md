# Cross-Module Contract Alignment Report

**Phase:** oli-enforce-cross-module  
**Date:** 2026-05-29  
**Scope:** 19 modules, 25 handler directories  
**Artifacts reviewed:** MODULE_MAP.md, EVENT_CONTRACTS.md, DOMAIN_MODEL.md, 19 API_CONTRACTS.md files, domain-events.registry.ts, domain-event-consumers.ts, notification.schema.ts, all handler imports

---

## Summary

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Event Contract | 0 | 4 | 1 | 0 | 5 |
| Notification Enum | 1 | 1 | 0 | 0 | 2 |
| Import Direction | 0 | 3 | 0 | 0 | 3 |
| Shared Schema | 0 | 1 | 0 | 0 | 1 |
| Domain Terminology | 0 | 0 | 2 | 0 | 2 |
| **Total** | **1** | **9** | **3** | **0** | **13** |

---

## Findings

### 1. Event Contract Alignment

#### EX-EVENT-orphan-batch1 | P1 | Orphan Events — Emitted but Never Consumed

**Description:** 13 domain events are emitted by handler code but have no registered consumer in `domain-event-consumers.ts`. These events fire into the void — any downstream side effects declared in EVENT_CONTRACTS.md or MODULE_SPECs are silently not happening.

**Orphan events:**

| Event | Emitting Module | Expected Consumer (per EVENT_CONTRACTS) |
|-------|----------------|----------------------------------------|
| `booking.created` | booking/createBooking.ts | Notification service (booking confirmation to host) |
| `booking.rejected` | booking/rejectBooking.ts | Notification service (rejection notice to client) |
| `person.created` | person/createPerson.ts | M02 profile init, M05 membership seed |
| `person.updated` | person/updatePerson.ts | M11 credential/card regeneration |
| `event.cancelled` | (implied by EVENT_CONTRACTS) | M06 refunds, M07 notification |
| `event.registration.cancelled` | association:operations/cancelEventRegistration.ts | Waitlist promotion, refund |
| `membership.status.changed` | (emitted in handler code) | Dues recalculation, notification |
| `announcement.published` | (emitted in handler code) | Email queue, push service |
| `training.completed` | training/markComplete.ts, training/completeTraining.ts | Credit tracking, certificate generation |
| `subscription.upgraded` | association:member/ | Billing audit |
| `subscription.cancelled` | association:member/ | Billing audit, membership status |
| `election.deleted` | (emitted in handler code) | Audit trail |
| `ticket.created` | (emitted in handler code) | Support notification |

**Impact:** `booking.created` and `booking.rejected` are the most critical — hosts and clients get no notification for new bookings or rejections. `training.completed` means no auto-certificate generation on training completion. `person.created` means profile/membership initialization doesn't cascade.

**Evidence:** `grep domainEvents.emit` in handlers vs `domainEvents.on` in `core/domain-event-consumers.ts`

---

#### EX-EVENT-training-dup | P1 | Duplicate Training Completion Emitters

**Description:** `training.completed` is emitted from 3 separate files:
- `training/markComplete.ts` (line 158)
- `training/completeTraining.ts` (line 55)
- `association:operations/completeCustomTraining.ts` (line 55)

Yet there is **no consumer** registered for `training.completed`. If a consumer is added later, it must handle being called from all three paths with potentially different payload shapes.

**Affected modules:** training, association:operations  
**Evidence:** grep for `domainEvents.emit('training.completed'` across handlers

---

#### EX-EVENT-booking-notify-gap | P1 | Booking Created/Rejected Have No Notification Consumer

**Description:** While `booking.confirmed` and `booking.cancelled` have consumers that create notifications, `booking.created` (host should be notified of new booking request) and `booking.rejected` (client should be notified) have no consumer. The booking handlers (`rejectBooking.ts`, `confirmBooking.ts`) do call `notificationService.createNotification` directly **in addition** to emitting domain events, creating a dual-path: confirmed/cancelled have both direct calls AND event consumers, while created/rejected only have the domain event emit (which goes nowhere).

**Affected modules:** booking, notifs  
**Evidence:**
- `booking/createBooking.ts` emits `booking.created` — no consumer
- `booking/rejectBooking.ts` emits `booking.rejected` — no consumer
- `booking/confirmBooking.ts` emits `booking.confirmed` — HAS consumer + direct notif call (redundant)

---

#### EX-EVENT-confirm-redundant | P2 | Redundant Notification: Direct Call + Event Consumer

**Description:** `booking/confirmBooking.ts` and `booking/cancelBooking.ts` both:
1. Call `notificationService.createNotification()` directly (lines ~90-130)
2. Emit a domain event that is consumed by `domain-event-consumers.ts` which ALSO inserts a notification

This means **two notifications are created** for every booking confirmation and cancellation — one via direct call, one via the event consumer.

**Affected modules:** booking, notifs  
**Evidence:** `confirmBooking.ts` direct `notificationService.createNotification` call + `domain-event-consumers.ts` consumer for `booking.confirmed`

---

#### EX-EVENT-payload-mismatch | P1 | EVENT_CONTRACTS Payload Shape vs Registry Mismatch

**Description:** EVENT_CONTRACTS.md declares payload shapes for cross-module events (e.g., `EventCancelled` should carry `{ eventId, registrantIds[], amounts[] }` for refund processing), but the actual `DomainEventMap` in `domain-events.registry.ts` may define different shapes. Since there are no consumers for many of these events, the mismatch is latent — it will surface as type errors when consumers are wired.

**Example:** EVENT_CONTRACTS declares `PaymentRefunded` should carry `{ reversedExpiryDate, registrationId? }` — but the registry type may not include these fields.

**Affected modules:** All modules with declared but unconsumed events

---

### 2. Notification Enum Alignment

#### EX-NOTIF-enum-drift | P0 | DOMAIN_MODEL Missing 4 Notification Types Present in Schema

**Description:** The `notificationTypeEnum` in `notification.schema.ts` has 18 values, but `DOMAIN_MODEL.md` (Complete Enum Index, row 69) only lists 14 — missing:
- `waitlist.promoted`
- `event.late-cancellation`
- `dunning.escalation`
- `task.overdue`

These 4 were added in Slice 027 (cross-cutting notifications) but DOMAIN_MODEL.md was not updated. Any spec-driven code generation or validation referencing DOMAIN_MODEL.md will reject these notification types.

**Severity rationale:** P0 because DOMAIN_MODEL.md is the declared single source of truth for the schema. Downstream tools and contract tests that rely on it will produce false negatives.

**Affected files:**
- `docs/product/DOMAIN_MODEL.md` — row 69 notification_type enum
- `services/api-ts/src/handlers/notifs/repos/notification.schema.ts` — authoritative schema

---

#### EX-NOTIF-missing-types | P1 | High-Volume Domain Events Use Generic 'system' Notification Type

**Description:** Several important domain events lack a dedicated `notificationTypeEnum` value and fall back to `type: 'system'`:
- `dues.payment.recorded` → should be `dues.payment-confirmed` or similar
- `membership.created` → should be `membership.created`
- `training.completed` → should be `training.completed`
- `election.status.changed` → should be `election.status-changed`

This prevents users from filtering/managing notifications by category and makes notification preferences ineffective for these event types.

**Affected modules:** dues, membership (association:member), training, elections  
**Evidence:** `domain-event-consumers.ts` uses `type: 'system'` for these events

---

### 3. Import Direction Violations

#### EX-IMPORT-cross-context-high | P1 | High-Risk Cross-Context Direct Mutations

**Description:** Two handler-to-handler import paths involve one module directly mutating another module's state — violating bounded context boundaries:

1. **dues → association:member**: `dues/utils/settle-payment.ts` imports `membershipLifecycle` from `association:member/utils/membership-lifecycle` to directly mutate membership expiry dates within a Financial context transaction
2. **association:member → dues**: `association:member/confirmPaymentProof.ts` imports `settlePayment` from `dues/utils/settle-payment.ts` — Membership context triggering Financial settlement

These create a **bidirectional coupling** between Financial and Membership contexts.

**Affected modules:** dues, association:member  
**Evidence:** settle-payment.ts import chain; confirmPaymentProof.ts imports

---

#### EX-IMPORT-events-membership | P1 | Events Module Directly Imports Membership Repository

**Description:** 4 files in `events/` directly import `MembershipRepository` from two different paths:
- `events/listRegistrations.ts` → `@/handlers/membership/repos/membership.repo`
- `events/getEvent.ts` → `@/handlers/membership/repos/membership.repo`
- `events/listAttendance.ts` → `@/handlers/membership/repos/membership.repo`
- `events/utils/membership-check.ts` → `../../association:member/repos/membership.repo`

Note: `membership-check.ts` imports from `association:member` while the other 3 import from `membership` — this is also a consistency issue (two different paths to the same logical repo).

**Affected modules:** events, membership, association:member

---

#### EX-IMPORT-schema-spider | P1 | Widespread Schema Cross-Imports (28+ Occurrences)

**Description:** Multiple modules import schema definitions from other handler directories for JOIN queries. While schema imports are lower risk than repository/function imports (read-only type references), the volume indicates missing shared abstractions:

**Most connected schemas:**
- `platformadmin/repos/platform-admin.schema` (organizations) — imported by 8+ modules
- `person/repos/person.schema` (persons) — imported by 6+ modules
- `association:member/repos/membership.schema` — imported by 4+ modules

**Recommendation:** Extract shared FK-referenced tables (organizations, persons) to `core/schema-registry.ts` (which partially exists) and import from there instead of reaching into handler directories.

**Affected modules:** Almost all — dues, person, association:member, membership, events, documents

---

### 4. Shared Schema Alignment

#### EX-SCHEMA-template-status | P1 | Duplicate pgEnum Name 'template_status' Across Modules

**Description:** Two separate schema files define `pgEnum('template_status', ...)`:
- `communication/repos/communication.schema.ts` line 34: `pgEnum('template_status', ['draft', 'active', 'archived'])`
- `email/repos/email.schema.ts` line 45: `pgEnum('template_status', ['draft', 'active', 'archived'])`

Both export `templateStatusEnum` with the same DB enum name `template_status`. PostgreSQL enums are database-global — this will cause a migration collision if both modules are migrated together. Currently works only because the values are identical, but divergence would cause a runtime crash.

**Note:** DOMAIN_MODEL.md already flags this: *"template_status is defined in two separate schema files... Two pgEnum definitions sharing the same name may cause migration conflicts"*

**Affected modules:** communication, email  
**Evidence:** `grep 'template_status' across *.schema.ts`

---

### 5. Domain Terminology Consistency

#### EX-TERM-user-person | P2 | M01 Auth Spec Uses "user" Instead of "person"

**Description:** M01 (Auth & Onboarding) MODULE_SPEC.md consistently uses "user" to refer to individuals (20+ occurrences: "user lands on /register", "User enters email", "Any registered user"). The rest of the system uses "person" as the canonical entity. M01 should use "person" when referring to the domain entity and "user" only in UX copy context.

**Affected modules:** m01-auth-onboarding  
**Evidence:** `grep -i '\buser\b' m01-auth-onboarding/MODULE_SPEC.md` — 20+ hits

---

#### EX-TERM-membership-path | P2 | Inconsistent Membership Repository Import Paths

**Description:** The `events` module imports `MembershipRepository` from two different handler directories:
- `@/handlers/membership/repos/membership.repo` (3 files)
- `../../association:member/repos/membership.repo` (1 file — `membership-check.ts`)

The `membership/` and `association:member/` handler directories appear to be separate modules but share membership logic. This creates confusion about which is the canonical membership module.

**Affected modules:** events, membership, association:member  
**Evidence:** grep results in events/ handler imports

---

## Recommendations (Priority Order)

1. **P0 — Fix DOMAIN_MODEL.md enum drift** (EX-NOTIF-enum-drift): Add `waitlist.promoted`, `event.late-cancellation`, `dunning.escalation`, `task.overdue` to the notification_type enum in DOMAIN_MODEL.md
2. **P1 — Wire orphan event consumers** (EX-EVENT-orphan-batch1): Add consumers for at minimum `booking.created`, `booking.rejected`, `training.completed`, `person.created`
3. **P1 — Fix duplicate notification on confirm/cancel** (EX-EVENT-confirm-redundant + EX-EVENT-booking-notify-gap): Choose one notification path (direct call OR event consumer) and remove the other
4. **P1 — Extract shared schemas** (EX-IMPORT-schema-spider): Move `organizations`, `persons` to a shared location all modules import from
5. **P1 — Rename duplicate pgEnum** (EX-SCHEMA-template-status): Rename email's `template_status` to `email_template_status`
6. **P1 — Add missing notification types** (EX-NOTIF-missing-types): Add `dues.payment-confirmed`, `membership.created`, `training.completed`, `election.status-changed` to notificationTypeEnum
7. **P1 — Decouple dues/membership** (EX-IMPORT-cross-context-high): Route financial→membership state changes through domain events instead of direct imports
8. **P2 — Standardize M01 terminology** (EX-TERM-user-person): Replace "user" with "person" in domain entity references
