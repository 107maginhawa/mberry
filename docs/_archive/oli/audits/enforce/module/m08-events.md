# Module Enforcement: m08-events

<!-- oli:enforce-module v2.1 | audited 2026-05-28 | spec: MODULE_SPEC.md -->

**Score: 4.0/10 -- NOT COMPLIANT (capped by P0 findings)**

**Source directories:**
- `services/api-ts/src/handlers/events/` -- 14 handler files (hand-wired routes, no TypeSpec)
- `services/api-ts/src/handlers/booking/` -- 19 handler files (TypeSpec-generated routes)
- Schema: `services/api-ts/src/handlers/association:operations/repos/events.schema.ts`

## Compliance Summary

The events module has solid CRUD + registration + check-in foundations with good officer auth patterns. However, **2 of 10 spec-declared endpoints are missing** (publish, complete), the **TypeSpec definition for events does not exist** (all routes hand-wired), **4 of 5 spec-declared domain events are not emitted**, BR-15 is violated (events store/process CPD credits), and M8-R6 post-completion lock is only partially enforced. The booking sub-module (19 handlers) has full TypeSpec coverage and is structurally sound.

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 5/10 | 2 | 1 | 0 | 0 |
| 2. Workflow / State Machine | 3/10 | 0 | 2 | 0 | 0 |
| 3. Domain Events | 2/10 | 0 | 2 | 0 | 0 |
| 4. Business Rules | 5/10 | 0 | 2 | 1 | 0 |
| 5. Auth/Permission | 7/10 | 0 | 0 | 1 | 1 |
| 6. Data Model | 6/10 | 0 | 0 | 2 | 0 |

**Overall: 4.0/10 -- capped by P0 findings**

---

## Findings

### P0 -- Blocking

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-a1b2c3d4 | API | **MISSING: publishEvent handler.** Spec declares `PUT /org/:id/events/:id/publish` -- no handler exists. `updateEvent.ts:27` references "Use publish endpoint" but it doesn't exist. Events cannot transition from `draft` to `published`. The entire lifecycle is broken. | events/ (absent) | HIGH |
| EM-M08-e5f6g7h8 | API | **MISSING: completeEvent handler.** Spec declares `PUT /org/:id/events/:id/complete` -- no handler exists. `checkIn.ts:30` checks `event.status === 'completed'` but nothing ever sets this status. Post-completion locks (M8-R6) have no trigger. State machine `Published -> Completed` is broken. | events/ (absent) | HIGH |

> **Note:** Previous audit (2026-05-27) reported these endpoints in `association:operations/`. Fresh grep confirms NO publishEvent or completeEvent handler exists anywhere in the codebase. The `updateEvent.ts` handler explicitly blocks status changes and references these nonexistent endpoints.

### P1 -- Must Fix

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-i9j0k1l2 | API | **MISSING: TypeSpec definition.** `specs/api/src/modules/events.tsp` does not exist. Only `events/job-board.tsp` found. All 10+ event routes are hand-wired, violating spec-first mandate. No generated validators, no OpenAPI docs. | specs/api/src/modules/ | HIGH |
| EM-M08-m3n4o5p6 | Rules | **BR-15 VIOLATED: Events store CPD credit fields.** BR-15: "Events never generate credit entries." Schema has `creditBearing`, `creditAmount`, `cpdActivityType`. `createEvent.ts` validates/stores credits. `checkIn.ts:63` triggers `attendance.confirmed` job with `creditAmount` when `creditBearing=true`. Events actively generate credit entries. | events.schema.ts, createEvent.ts, checkIn.ts | HIGH |
| EM-M08-q7r8s9t0 | Rules | **M8-R6 PARTIAL: registerForEvent missing post-completion lock.** Check-in is locked (checkIn.ts:30) but registerForEvent.ts has NO status check. Users can register for completed/cancelled events. | events/registerForEvent.ts | HIGH |
| EM-M08-u1v2w3x4 | Events | **4 of 5 published domain events missing.** Only `event.cancelled` is emitted. `EventPublished` (no handler), `EventCompleted` (no handler), `AttendanceConfirmed` (pg-boss job only, not domain event), `WaitlistPromoted` (promotes but no event). Downstream M07/M06 consumers broken. | events/ | HIGH |
| EM-M08-y5z6a7b8 | Events | **0 of 2 consumed domain events wired.** `PaymentRecorded` (M06) and `RefundCompleted` (M06) have no handlers. Paid event registration flow incomplete -- payment never confirms registration, refund never updates status. | events/ | HIGH |
| EM-M08-f4a1c2e8 | State | **createEvent accepts arbitrary status.** `createEvent.ts:52` uses `body.status ?? 'draft'`, allowing clients to create events as `published` or `completed` directly, bypassing draft-first state machine. | events/createEvent.ts:52 | HIGH |
| EM-M08-3b7d9e0f | State | **No VALID_TRANSITIONS map.** Transitions enforced ad-hoc across scattered handlers. No single source of truth. Booking has `BOOKING_VALID_TRANSITIONS`; events does not. | events/ | HIGH |

### P2 -- Should Fix

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-c9d0e1f2 | Auth | **M8-R4 NOT ENFORCED: Visibility access control missing.** `getEvent.ts` checks membership but not `event.visibility`. `listEvents.ts` returns all org events. No handler differentiates `internal` vs `network` access. | events/getEvent.ts, listEvents.ts | MEDIUM |
| EM-M08-g3h4i5j6 | Model | **Missing paymentId on EventRegistration.** Spec declares `paymentId` (Payment FK) on EventRegistration. Schema has `organizationId`, `eventId`, `personId`, `status`, `registeredAt`, `cancelledAt`, `refundedAt` -- no `paymentId`. Cannot link registrations to payments. | events.schema.ts | HIGH |
| EM-M08-k7l8m9n0 | Model | **Missing unique constraint (eventId, personId).** Spec declares unique composite. Schema has separate indexes. Check-in idempotency handled in app code (`isCheckedIn`) not DB. Race condition risk for duplicate registrations/check-ins. | events.schema.ts | MEDIUM |

### P3 -- Nice to Have

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-6d4c2b0a | Auth | **President 2FA for cancel event missing.** Spec: "Officer (president 2FA)" for cancel trigger. No 2FA enforcement in `cancelEvent.ts`. | events/cancelEvent.ts | LOW |

---

## Business Rules Compliance Matrix

| Rule | Status | Notes |
|---|---|---|
| BR-15 (no CPD credits on events) | VIOLATED | Events store creditBearing/creditAmount/cpdActivityType, checkIn triggers credit job |
| BR-16 (default visibility = internal) | COMPLIANT | Schema default `'internal'` |
| BR-17 (officer-only check-in) | COMPLIANT | checkIn.ts validates officer terms |
| BR-18 (QR 3-factor auth) | COMPLIANT | Auth + valid event + registered member checked |
| BR-27 (waitlist FIFO) | COMPLIANT | registerForEvent uses capacity check, cancelRegistration promotes next |
| M8-R1 (capacity -> waitlist) | COMPLIANT | registerForEvent.ts capacity check |
| M8-R2 (paid event payment-first) | COMPLIANT | Blocks registration for paid events |
| M8-R3 (cancel -> notify + refund) | PARTIAL | Notifies registrants inline; refund mentioned in message text but no M06 billing integration |
| M8-R4 (visibility access control) | NOT ENFORCED | No visibility check in any handler |
| M8-R5 (cancel reg -> promote waitlist) | COMPLIANT | cancelRegistration.ts promotes next waitlisted |
| M8-R6 (post-completion lock) | PARTIAL | Check-in locked; registration NOT locked |

---

## State Machine Compliance

### Event Status
```
Spec:     Draft --publish--> Published --complete--> Completed
                             Published --cancel---> Cancelled

Actual:   Draft --[NO HANDLER]--> Published (only settable at creation via body.status)
          Published --cancelEvent--> Cancelled (OK)
          [NO completeEvent HANDLER]
```
**Gap:** `publish` and `complete` transitions have no implementation.

### Registration Status
```
Spec:     Confirmed --cancel--> Cancelled       (OK via cancelRegistration)
          Confirmed --refund--> Refunded         (MISSING -- no RefundCompleted consumer)
          Confirmed --noshow--> NoShow           (MISSING -- no noshow handler)
          Waitlisted --promote--> Confirmed      (OK via cancelRegistration FIFO)
          Waitlisted --cancel--> Cancelled       (OK via cancelEvent cascade)
```

---

## Extra Handlers (not in spec, not violations)

| Handler | Purpose |
|---|---|
| `getPublicEvent.ts` | Public slug-based event access |
| `listPublicEvents.ts` | Public event discovery (network visibility) |
| `bulkCreateEventSeries.ts` | Recurring event series creation |
| `serveEventOgMeta.ts` | OG meta tags for social media sharing |
| `listRegistrations.ts` | Officer registration list view |
| `listAttendance.ts` | Attendance records |

---

## Stabilization Plan

### Phase 1: P0 -- Unblock State Machine (~2 days)
1. Create `publishEvent.ts`: validate draft status + required fields filled, transition to `published`, set `publishedAt`, emit `EventPublished` domain event.
2. Create `completeEvent.ts`: validate published status + endDate passed, transition to `completed`, emit `EventCompleted` domain event.
3. Fix `createEvent.ts`: hardcode `status: 'draft'`, remove `body.status` acceptance.

### Phase 2: P1 -- TypeSpec + Domain Events (~3 days)
4. Author `specs/api/src/modules/events.tsp` covering all 10 declared endpoints.
5. Emit all 5 domain events from appropriate handlers.
6. Wire consumed events: `PaymentRecorded` -> confirm paid registration, `RefundCompleted` -> set status refunded.
7. Create `EVENT_VALID_TRANSITIONS` map in `events/utils/status-transitions.ts`.

### Phase 3: P1 -- Business Rule Fixes (~1 day)
8. Add post-completion lock to `registerForEvent.ts`: block if event completed/cancelled.
9. Resolve BR-15: either remove credit fields from events OR update spec to acknowledge events carry credit metadata for M09.

### Phase 4: P2 Cleanup (~1 day)
10. Add `paymentId` column to EventRegistration schema.
11. Add unique composite constraints `(eventId, personId)` on registrations and check-ins.
12. Enforce visibility access control (M8-R4) in getEvent/listEvents.

---

## Booking Sub-Module Assessment

The booking module (19 handlers) has full TypeSpec coverage (`booking.tsp`), proper state machine with `BOOKING_VALID_TRANSITIONS`, complete CRUD lifecycle, role-based access control, and schedule exception management. No P0 findings. Operates as separate 1:1 scheduling system distinct from association events (1:many). Structurally sound.

---

## Audit Scope

| Artifact | Files Read | Coverage |
|----------|-----------|----------|
| MODULE_SPEC.md | Full (22 sections) | All BRs, workflows, permissions, state machines, domain events, data model |
| events/ handlers | 14 .ts files + repos + utils | All non-test handler, repo, util files |
| events.schema.ts | Full | 4 tables: event, event_registration, check_in, waitlist_entry |
| booking.tsp | Full | TypeSpec definition for booking module |
| booking/ handlers | File list + key files | State machine, CRUD verified |

**Previous audit:** 2026-05-27 (scored 5.8). That audit reported publishEvent/completeEvent in association:operations/. Fresh investigation confirms these handlers do NOT exist -- previous audit was incorrect. Score revised down from 5.8 to 4.0.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
