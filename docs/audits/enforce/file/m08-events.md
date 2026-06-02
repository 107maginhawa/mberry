# File Enforcement: m08-events

> **Scope:** `services/api-ts/src/handlers/events/` + `services/api-ts/src/handlers/booking/`
> **Specs:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md
> **Generated:** 2026-05-28
> **oli_artifact:** EF-FILE
> **Finding ID format:** `EF-M08-{hash8}` (content-based)

---

## 1. File Inventory

### 1a. `handlers/events/` (15 handlers + 2 utils + 1 repo + 25 tests = 43 files)

| File | Role | Lines | Spec Endpoint |
|------|------|-------|---------------|
| `createEvent.ts` | Handler | 60 | POST /org/:id/events |
| `getEvent.ts` | Handler | ~20 | GET /org/:id/events/:id |
| `getPublicEvent.ts` | Handler | ~20 | GET /public/events/:slug |
| `listEvents.ts` | Handler | ~20 | GET /org/:id/events |
| `listPublicEvents.ts` | Handler | ~40 | GET /public/events |
| `listMyEvents.ts` | Handler | ~15 | GET /my/events |
| `updateEvent.ts` | Handler | 76 | PUT /org/:id/events/:id |
| `cancelEvent.ts` | Handler | ~95 | PUT /org/:id/events/:id/cancel |
| `cancelRegistration.ts` | Handler | ~70 | DELETE /org/:id/events/:id/register/:regId |
| `registerForEvent.ts` | Handler | 43 | POST /org/:id/events/:id/register |
| `checkIn.ts` | Handler | 95 | POST /org/:id/events/:id/checkin |
| `listAttendance.ts` | Handler | ~15 | GET /org/:id/events/:id/attendance |
| `listRegistrations.ts` | Handler | ~15 | GET /org/:id/events/:id/registrations |
| `bulkCreateEventSeries.ts` | Handler | ~80 | POST bulk (not in spec) |
| `serveEventOgMeta.ts` | Handler | 62 | GET /og/events/:slug (not in spec) |
| `repos/events.repo.ts` | Repository | 213 | -- |
| `utils/membership-check.ts` | Utility | ~30 | Cross-context membership seam |
| `utils/event-slug.ts` | Utility | ~30 | Slug generation + uniqueness |
| `*.test.ts` (25 files) | Test | varies | Unit/integration tests |

### 1b. `handlers/booking/` (19 handlers + 3 utils + 4 repos + 3 jobs + 26 tests = 59 files)

| File | Role | Lines | Notes |
|------|------|-------|-------|
| `createBooking.ts` | Handler | ~50 | POST /booking/bookings |
| `getBooking.ts` | Handler | ~60 | GET /booking/bookings/:id |
| `listBookings.ts` | Handler | ~80 | GET /booking/bookings |
| `confirmBooking.ts` | Handler | 131 | POST /booking/bookings/:id/confirm |
| `cancelBooking.ts` | Handler | 154 | POST /booking/bookings/:id/cancel |
| `rejectBooking.ts` | Handler | 167 | POST /booking/bookings/:id/reject |
| `markNoShowBooking.ts` | Handler | 118 | POST /booking/bookings/:id/no-show |
| `createBookingEvent.ts` | Handler | ~60 | POST /booking/events |
| `getBookingEvent.ts` | Handler | ~60 | GET /booking/events/:id |
| `updateBookingEvent.ts` | Handler | ~70 | PUT /booking/events/:id |
| `deleteBookingEvent.ts` | Handler | ~50 | DELETE /booking/events/:id |
| `listBookingEvents.ts` | Handler | ~70 | GET /booking/events |
| `getTimeSlot.ts` | Handler | ~30 | GET /booking/slots/:id |
| `listEventSlots.ts` | Handler | ~60 | GET /booking/events/:id/slots |
| `createScheduleException.ts` | Handler | ~70 | POST /booking/events/:id/exceptions |
| `getScheduleException.ts` | Handler | ~50 | GET /booking/exceptions/:id |
| `updateScheduleException.ts` | Handler | ~40 | PUT /booking/exceptions/:id |
| `deleteScheduleException.ts` | Handler | ~50 | DELETE /booking/exceptions/:id |
| `listScheduleExceptions.ts` | Handler | ~90 | GET /booking/events/:id/exceptions |
| `repos/booking.schema.ts` | Schema | 512 | 4 tables + enums + interfaces |
| `repos/booking.repo.ts` | Repository | ~300 | BookingRepository |
| `repos/bookingEvent.repo.ts` | Repository | ~200 | BookingEventRepository |
| `repos/timeSlot.repo.ts` | Repository | ~250 | TimeSlotRepository |
| `repos/scheduleException.repo.ts` | Repository | ~150 | ScheduleExceptionRepository |
| `utils/status-transitions.ts` | State machine | 33 | BOOKING_VALID_TRANSITIONS map |
| `utils/authorization.ts` | Utility | ~80 | Role-based access checks |
| `utils/ownership.ts` | Utility | ~80 | Booking client/host ownership |
| `utils/slotGeneration.ts` | Utility | ~200 | Slot generation algorithms |
| `jobs/index.ts` | Job registration | ~80 | registerBookingJobs() |
| `jobs/confirmationTimer.ts` | Background job | ~100 | Auto-reject after 15min |
| `jobs/slotGenerator.ts` | Background job | ~100 | Daily slot creation |
| `jobs/slotCleanup.ts` | Background job | ~100 | Slot/booking archival |
| `*.test.ts` (26 files) | Test | varies | Unit/integration tests |

### 1c. Frontend Routes (9 files)

| File | Spec Screen |
|------|-------------|
| `org/$orgSlug/officer/events/index.tsx` | Events Dashboard |
| `org/$orgSlug/officer/events/new.tsx` | Create Event |
| `org/$orgSlug/officer/events/$eventId.tsx` | Officer Event Detail |
| `org/$orgSlug/officer/events/$eventId/attendance.tsx` | Event Check-in |
| `org/$orgSlug/events/index.tsx` | Org Events List |
| `org/$orgSlug/events/$eventId.tsx` | Event Detail |
| `my/events.tsx` | My Events |
| `discover/events.tsx` | Public Events (not in spec) |
| `events/$eventSlug.tsx` | Public Event by Slug (not in spec) |

### 1d. TypeSpec + Contract Tests

| File | Role |
|------|------|
| `specs/api/src/modules/booking.tsp` | Booking TypeSpec (EXISTS) |
| `specs/api/src/modules/events.tsp` | Events TypeSpec (**MISSING**) |
| `specs/api/tests/contract/assoc-events-flow.hurl` | Events CRUD flow |
| `specs/api/tests/contract/assoc-event-lifecycle-flow.hurl` | Event lifecycle |
| `specs/api/tests/contract/assoc-events-checkins-flow.hurl` | Check-in flow |
| `specs/api/tests/contract/assoc-events-registrations-flow.hurl` | Registration flow |
| `specs/api/tests/contract/events-flow.hurl` | Events flow |
| `specs/api/tests/contract/booking-*.hurl` (6 files) | Booking contract tests |

---

## 2. Findings

### Legend

| Severity | Meaning |
|----------|---------|
| **P0** | Security/data-loss -- must fix before release |
| **P1** | Functional -- spec contract violated, user-visible bug |
| **P2** | Correctness -- logic gap, missing guard, inconsistency |
| **P3** | Hygiene -- naming, style, low-risk inconsistency |

---

### Events Module

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M08-a1b2c3d4 | **P1** | Missing file | `publishEvent.ts` does not exist. Spec declares `PUT /org/:id/events/:id/publish` endpoint. `updateEvent.ts:24-28` explicitly references "publish endpoint" but no handler implements it. State transition `draft -> published` has no handler. | `events/` (missing) | MODULE_SPEC 10. API Expectations, 8. State Transitions | HIGH |
| EF-M08-b2c3d4e5 | **P1** | Missing file | `completeEvent.ts` does not exist. Spec declares `PUT /org/:id/events/:id/complete` endpoint. `updateEvent.ts:24-28` references "complete endpoint" but no handler implements it. State transition `published -> completed` has no handler. | `events/` (missing) | MODULE_SPEC 10. API Expectations, 8. State Transitions | HIGH |
| EF-M08-c3d4e5f6 | **P1** | Missing file | `events.tsp` TypeSpec file does not exist. Spec AI Instruction #2: "Define TypeSpec in `specs/api/src/modules/events.tsp`." Events handlers use raw `Context` with `ctx.req.json()` instead of generated validators. Only `booking.tsp` exists. | `specs/api/src/modules/` (missing) | MODULE_SPEC 20. AI Instructions #2 | HIGH |
| EF-M08-3a7f1c02 | **P1** | Error taxonomy | `createEvent.ts:57` uses `body.status ?? 'draft'`. Client can set `status: 'published'` to bypass state machine. Spec: new events must start as `draft`. | `events/createEvent.ts:57` | MODULE_SPEC 8. State Transitions | HIGH |
| EF-M08-d5f1a3c7 | **P2** | Error taxonomy | `registerForEvent.ts` does not check if event is in `published` status. Draft, cancelled, or completed events accept registrations. Spec WF-052 step 2: registration only for published events. | `events/registerForEvent.ts:13-14` | MODULE_SPEC WF-052, 8. State Transitions | HIGH |
| EF-M08-e8c2b6d0 | **P2** | Data shape | `registerForEvent.ts` does not check for duplicate registrations. Same person can register twice. Spec: unique (personId, eventId). DB may enforce but handler gives raw Postgres error, not user-friendly message. | `events/registerForEvent.ts:33` | MODULE_SPEC 7. Data Requirements EventRegistration | MEDIUM |
| EF-M08-38e7f0a4 | **P2** | Error taxonomy | `checkIn.ts:12-18` officer authorization is conditional: `if (orgId)`. If `organizationId` not set in context (missing middleware), officer check is bypassed. Should be mandatory per BR-17. | `events/checkIn.ts:12-18` | MODULE_SPEC 5. BR-17, 6. Permissions | MEDIUM |
| EF-M08-49f8a1b5 | **P2** | Data shape | `checkIn.ts` does not verify `body.personId` is registered for the event before check-in. Spec BR-18: "require registered member". Unregistered person can be checked in. | `events/checkIn.ts:37` | MODULE_SPEC 5. BR-18 | MEDIUM |
| EF-M08-d4e5f6a7 | **P2** | Domain terms | `cancelRegistration.ts:58-63` promotes waitlisted registrant but does NOT emit `WaitlistPromoted` domain event. Spec 10b requires `WaitlistPromoted` event with `{eventId, personId}` for M07 notification. Promoted member is never notified. | `events/cancelRegistration.ts:58-63` | MODULE_SPEC 10b. Domain Events | HIGH |
| EF-M08-e5f6a7b8 | **P2** | Domain terms | No handler emits `EventPublished` domain event. Spec 10b: `EventPublished` triggers M07 announcement. Since `publishEvent.ts` doesn't exist, this event is never emitted. | `events/` (missing handler) | MODULE_SPEC 10b. Domain Events | HIGH |
| EF-M08-f6a7b8c9 | **P2** | Domain terms | No handler emits `EventCompleted` domain event. Spec 10b: `EventCompleted` with `{eventId, orgId, attendanceCount}`. Since `completeEvent.ts` doesn't exist, this event is never emitted. | `events/` (missing handler) | MODULE_SPEC 10b. Domain Events | HIGH |
| EF-M08-14b8c5a2 | **P2** | Error taxonomy | `updateEvent.ts` blocks `status` changes but does NOT block updates to completed/cancelled events. Spec: completed and cancelled are terminal -- no field changes allowed. A completed event's title, capacity, etc. can still be mutated. | `events/updateEvent.ts:24-30` | MODULE_SPEC 8. State Transitions, AC-M08-006 | MEDIUM |
| EF-M08-7c2bd4e8 | **P2** | Data shape | Missing `events/utils/status-transitions.ts`. Booking module has centralized `BOOKING_VALID_TRANSITIONS`. Events module enforces transitions ad-hoc in individual handlers. No single source of truth for `{draft: ['published'], published: ['cancelled', 'completed']}`. | `events/` (missing file) | MODULE_SPEC 8. State Transitions | HIGH |
| EF-M08-a7b8c9d0 | **P2** | Data shape | No feature flags used in any events handler. Spec 18 declares 4 flags: `events_waitlist_enabled`, `events_qr_checkin`, `events_network_visibility`, `events_paid_registration`. None checked in code. All features are unconditionally active. | `events/*.ts` | MODULE_SPEC 18. Feature Flags | MEDIUM |
| EF-M08-27d6e9f3 | **P2** | Naming | `createEvent.ts:40` uses `body.eventType ?? 'other'` without handler-level enum validation. The 8-value pgEnum rejects bad values at DB level, producing raw Postgres error instead of user-friendly `VALIDATION_ERROR`. | `events/createEvent.ts:40` | MODULE_SPEC 7. Data Requirements Event.eventType | MEDIUM |
| EF-M08-b8c9d0e1 | **P2** | Import boundary | `createEvent.ts:51-52` accepts `creditBearing` and `creditAmount` fields. Spec BR-15: "events never award CPD credits." Events should not store credit data. This leaks M09 Training concerns into the event entity. | `events/createEvent.ts:51-52` | MODULE_SPEC 5. BR-15 | MEDIUM |
| EF-M08-6b1ac3d7 | **P2** | Import boundary | Events repo imports schema from `association:operations/repos/events.schema.ts`. Cross-bounded-context import. Schema ownership lives outside events handler directory. | `events/repos/events.repo.ts:3-13` | MODULE_SPEC 20. AI Instructions #1 | LOW |
| EF-M08-af5e071b | **P3** | Import boundary | `createEvent.ts:4`, `cancelEvent.ts:5`, `updateEvent.ts:4`, `checkIn.ts:4` all import `OfficerTermRepository` from `../association:member/repos/governance.repo`. Direct cross-bounded-context import. Should use a local seam like `membership-check.ts`. | `events/*.ts` | Code conventions | LOW |
| EF-M08-8d3ce5f9 | **P3** | Naming | `listRegistrations.ts` returns bare registration records. Spec response should include person details (name, email) joined to registrations. | `events/listRegistrations.ts` | MODULE_SPEC 10. API Expectations | LOW |
| EF-M08-9e4df60a | **P3** | Data shape | `listEvents.ts` missing spec-declared `upcoming` boolean query param. Uses `type` param name while spec uses `eventType`. | `events/listEvents.ts` | MODULE_SPEC 10. API Expectations | LOW |
| EF-M08-b060182c | **P3** | Naming | `serveEventOgMeta.ts:23` uses `toLocaleDateString()` which is server-locale dependent. Should use explicit date formatting for deterministic output. | `events/serveEventOgMeta.ts:23` | -- | LOW |
| EF-M08-c9d0e1f2 | **P3** | Data shape | `cancelEvent.ts` response is bare `{data: updated}`. Spec expects `affectedRegistrations` count in cancel response. Cascade runs async, so count not available at response time. | `events/cancelEvent.ts:34` | MODULE_SPEC 10. API Expectations | LOW |

### Booking Module

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M08-c171293d | **P2** | Error taxonomy | `rejectBooking.ts`, `cancelBooking.ts`, and `markNoShowBooking.ts` use inline status checks instead of the shared `isValidBookingTransition()`. The `BOOKING_VALID_TRANSITIONS` map exists and is tested but is not called by any handler. State machine duplicated. | `booking/rejectBooking.ts:62`, `booking/cancelBooking.ts:72`, `booking/markNoShowBooking.ts:71` | booking status-transitions.ts | HIGH |
| EF-M08-d282304e | **P2** | Error taxonomy | `rejectBooking.ts:76-81` sets `cancelledBy: 'host'` and `cancelledAt` for a rejection. Semantically wrong -- rejection is not cancellation. Creates audit trail confusion. | `booking/rejectBooking.ts:76-81` | DOMAIN_MODEL booking entity | MEDIUM |
| EF-M08-e393415f | **P2** | Import boundary | `rejectBooking.ts:85-86` uses dynamic `import()` inside handler for schema + drizzle-orm to release slot. Should be a repository method. Breaks standard import conventions. | `booking/rejectBooking.ts:85-93` | Code conventions | MEDIUM |
| EF-M08-f4a45260 | **P2** | Data shape | `confirmBooking.ts:63` delegates timing validation to repo. 15-minute confirmation window enforced only in repo, not handler. Defence-in-depth gap. | `booking/confirmBooking.ts:63` | API_CONTRACTS booking.confirmationTimer | LOW |
| EF-M08-05b56371 | **P3** | Naming | `confirmBooking.ts:130` returns `ctx.json(confirmedBooking, 200)` -- no `{data: ...}` wrapper. Events handlers use `{data: ...}` envelope. Inconsistent response shape. | `booking/confirmBooking.ts:130` | API_CONTRACTS response format | MEDIUM |
| EF-M08-16c67482 | **P3** | Naming | `rejectBooking.ts`, `cancelBooking.ts`, `markNoShowBooking.ts` all return unwrapped responses. All booking action handlers skip the `{data: ...}` envelope. | `booking/*.ts` | API_CONTRACTS response format | MEDIUM |
| EF-M08-27d78593 | **P3** | Domain terms | `markNoShowBooking.ts` does not send notifications. Other action handlers (confirm, cancel, reject) do. No-show party is not informed. | `booking/markNoShowBooking.ts` | API_CONTRACTS notification contracts | MEDIUM |
| EF-M08-49f9a7b5 | **OK** | Data shape | `booking/utils/status-transitions.ts` -- state machine correct: 7 statuses, all transitions match DOMAIN_MODEL. Terminal states have empty arrays. Test coverage comprehensive. | `booking/utils/status-transitions.ts` | DOMAIN_MODEL 13. State Machines | HIGH |
| EF-M08-5a0ab8c6 | **OK** | Data shape | `booking/repos/booking.schema.ts` -- 4 tables with proper enums, FK constraints, check constraints, indexes. Matches TypeSpec API definition. | `booking/repos/booking.schema.ts` | API_CONTRACTS schema | HIGH |
| EF-M08-6b1bc9d7 | **OK** | Import boundary | `booking/utils/ownership.ts` -- clean utility, no cross-bounded-context imports. Good seam pattern. | `booking/utils/ownership.ts` | -- | HIGH |
| EF-M08-7c2cdae8 | **OK** | Domain terms | `booking/jobs/` -- three jobs (slotGenerator, confirmationTimer, slotCleanup) match API_CONTRACTS. Registered with correct cron/interval schedules. | `booking/jobs/index.ts` | API_CONTRACTS 2. Job Contracts | HIGH |
| EF-M08-8d3debf9 | **OK** | Error taxonomy | `booking/utils/authorization.ts` -- role-based access with admin/support bypass, owner-check, RBAC. Uses `ForbiddenError` correctly. | `booking/utils/authorization.ts` | ROLE_PERMISSION_MATRIX | HIGH |
| EF-M08-d0e1f2a3 | **OK** | Data shape | `booking/jobs/index.ts:52` `triggerSlotGeneration()` -- DeferredScopeError stubs replaced with working implementations (commit 556bba29). Now properly iterates events and regenerates slots. | `booking/jobs/index.ts:52` | -- | HIGH |

### Frontend Routes

| ID | Sev | Check | Finding | File | Spec Source | Confidence |
|----|-----|-------|---------|------|-------------|------------|
| EF-M08-e1f2a3b4 | **OK** | Screen coverage | All 5 spec screens mapped to frontend routes: Events Dashboard, Create Event, Event Check-in/Attendance, Event Detail, My Events. | `apps/memberry/src/routes/` | MODULE_SPEC 9. UI/UX Requirements | HIGH |
| EF-M08-f2a3b4c5 | **P3** | Data shape | `discover/events.tsx` and `events/$eventSlug.tsx` exist but are not declared in spec. Bonus functionality (public event discovery). Not a violation but undocumented. | `apps/memberry/src/routes/discover/events.tsx` | -- | LOW |

---

## 3. Spec Endpoint Traceability Matrix

| Spec Endpoint | Handler File | Status |
|---------------|-------------|--------|
| POST /org/:id/events | `createEvent.ts` | EXISTS |
| PUT /org/:id/events/:id | `updateEvent.ts` | EXISTS |
| PUT /org/:id/events/:id/publish | -- | **MISSING** (EF-M08-a1b2c3d4) |
| PUT /org/:id/events/:id/cancel | `cancelEvent.ts` | EXISTS |
| PUT /org/:id/events/:id/complete | -- | **MISSING** (EF-M08-b2c3d4e5) |
| POST /org/:id/events/:id/register | `registerForEvent.ts` | EXISTS |
| DELETE /org/:id/events/:id/register/:regId | `cancelRegistration.ts` | EXISTS |
| POST /org/:id/events/:id/checkin | `checkIn.ts` | EXISTS |
| GET /org/:id/events | `listEvents.ts` | EXISTS |
| GET /my/events | `listMyEvents.ts` | EXISTS |

**Coverage: 8/10 endpoints (80%)**

---

## 4. Domain Event Traceability

| Spec Domain Event | Emitted? | Handler | Notes |
|-------------------|----------|---------|-------|
| EventPublished | NO | -- | No `publishEvent.ts` handler exists |
| EventCancelled | YES | `cancelEvent.ts:35` | Emits `event.cancelled` |
| EventCompleted | NO | -- | No `completeEvent.ts` handler exists |
| AttendanceConfirmed | PARTIAL | `checkIn.ts:~65` | Emits via pg-boss job, not domain event bus |
| WaitlistPromoted | NO | `cancelRegistration.ts:58-63` | Promotes but does not emit domain event |

**Coverage: 1/5 domain events properly emitted (20%)**

---

## 5. Business Rule Traceability

| Rule ID | Rule | Enforced? | Handler | Notes |
|---------|------|-----------|---------|-------|
| BR-15 | Events never award CPD credits | VIOLATED | `createEvent.ts` | Accepts `creditBearing` and `creditAmount` fields |
| BR-16 | Default visibility = internal | YES | `createEvent.ts:58` | `body.visibility ?? 'internal'` |
| BR-17 | Check-in by officer only | PARTIAL | `checkIn.ts:12-18` | Conditional on `if (orgId)` -- can be bypassed |
| BR-18 | QR check-in: 3-factor validation | PARTIAL | `checkIn.ts` | Missing registration check (factor 3) |
| BR-27 | Capacity -> waitlist FIFO | YES | `registerForEvent.ts:30-32` | Capacity check + waitlist status |
| M8-R1 | Paid event requires payment | YES | `registerForEvent.ts:17-22` | Blocks with PAYMENT_REQUIRED |
| M8-R2 | Payment confirmation before confirmed | PARTIAL | -- | Blocks registration but no PaymentRecorded consumer |
| M8-R3 | Cancellation -> notify + refund | PARTIAL | `cancelEvent.ts` | Notifies in-app but no M06 refund integration |
| M8-R4 | Visibility access control | PARTIAL | `listPublicEvents.ts` | Public endpoint exists but internal-only filtering unclear |
| M8-R5 | Cancel registration -> reclaim + promote | YES | `cancelRegistration.ts:55-63` | Promotes but missing notification |
| M8-R6 | Completed -> lock everything | PARTIAL | `checkIn.ts:31-35` | Blocks check-in but no publish/cancel/complete guards |

**Coverage: 3/11 fully enforced (27%), 6/11 partial (55%), 2/11 violated/missing (18%)**

---

## 6. Special: `booking/utils/status-transitions.ts` Deep Review

### State Machine Definition

```typescript
BOOKING_VALID_TRANSITIONS = {
  pending:         ['confirmed', 'rejected', 'cancelled'],
  confirmed:       ['cancelled', 'completed', 'no_show_client', 'no_show_host'],
  rejected:        [],  // terminal
  cancelled:       [],  // terminal
  completed:       [],  // terminal
  no_show_client:  [],  // terminal
  no_show_host:    [],  // terminal
}
```

### Verification Against DOMAIN_MODEL

| Transition | DOMAIN_MODEL | Code | Match |
|-----------|-------------|------|-------|
| pending -> confirmed | yes | yes | PASS |
| pending -> rejected | yes | yes | PASS |
| pending -> cancelled | yes | yes | PASS |
| confirmed -> cancelled | yes | yes | PASS |
| confirmed -> completed | yes | yes | PASS |
| confirmed -> no_show_client | yes | yes | PASS |
| confirmed -> no_show_host | yes | yes | PASS |
| All terminals have no outgoing | yes | yes | PASS |

**Status: ALIGNED with spec.** All 7 statuses present, all transitions correct, no spurious edges.

### Critical Gap: Not Used by Handlers

Despite being correctly defined, **no handler imports `isValidBookingTransition()`**:

- `confirmBooking.ts` -- delegates to `repo.confirmBooking()` (repo handles internally)
- `rejectBooking.ts` -- inline `booking.status !== 'pending'` check
- `cancelBooking.ts` -- delegates to `repo.cancelBooking()` (repo handles internally)
- `markNoShowBooking.ts` -- inline `booking.status !== 'confirmed'` check

State machine utility exists as tested artifact but is not wired into enforcement.

---

## 7. Summary

### By Severity

| Severity | Count | Events | Booking | Frontend |
|----------|-------|--------|---------|----------|
| P0 | 0 | 0 | 0 | 0 |
| P1 | 4 | 4 | 0 | 0 |
| P2 | 16 | 12 | 4 | 0 |
| P3 | 7 | 4 | 3 | 0 |
| OK | 7 | 0 | 6 | 1 |
| **Total** | **34** | **20** | **13** | **1** |

### Top 5 Action Items

1. **[P1] Create `publishEvent.ts` handler** -- implement `PUT /org/:id/events/:id/publish` with draft->published transition, field-completeness guard, `EventPublished` domain event. (EF-M08-a1b2c3d4, EF-M08-e5f6a7b8)
2. **[P1] Create `completeEvent.ts` handler** -- implement `PUT /org/:id/events/:id/complete` with published->completed transition, end-date guard, `EventCompleted` domain event, registration lock. (EF-M08-b2c3d4e5, EF-M08-f6a7b8c9)
3. **[P1] Create `events.tsp` TypeSpec** -- define all 10 spec endpoints in TypeSpec, generate validators. Migrate handlers from raw `ctx.req.json()` to generated `ValidatedContext`. (EF-M08-c3d4e5f6)
4. **[P1] Fix `createEvent.ts` status bypass** -- hardcode `status: 'draft'`, ignore client-supplied status. Remove `creditBearing`/`creditAmount` fields per BR-15. (EF-M08-3a7f1c02, EF-M08-b8c9d0e1)
5. **[P2] Add published-status guard to `registerForEvent.ts`** -- reject registration for draft/cancelled/completed events. Add duplicate registration check. (EF-M08-d5f1a3c7, EF-M08-e8c2b6d0)

### Cross-Module Observations

- **Events vs Booking consistency gap**: Booking handlers use `ValidatedContext` with generated validators from TypeSpec; events handlers use raw `Context` with `ctx.req.json()`. Booking follows the generated-types pattern; events handlers bypass it entirely because `events.tsp` does not exist.
- **Notification asymmetry**: Booking handlers (confirm, cancel, reject) send notifications via `NotificationService`. Events handlers send in-app notifications only during cancel cascade. Waitlist promotion has no notification.
- **Response envelope inconsistency**: Events uses `{data: ...}` wrapper. Booking action endpoints return unwrapped objects. Should be standardized.
- **Import boundary health**: Booking module has clean boundaries (local repos, utils, schema). Events module has 4+ cross-bounded-context imports (OfficerTermRepository from association:member, schema from association:operations).
- **Two missing handlers block 40% of state machine**: Without publish and complete, only draft->cancelled (via cancel) is possible. The entire event lifecycle is incomplete.
- **Domain event coverage critically low**: Only 1 of 5 spec domain events is properly emitted. M07 Communications and M06 Dues integrations are broken.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
