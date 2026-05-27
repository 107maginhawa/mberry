# File Enforcement: m08-events

> **Scope:** `services/api-ts/src/handlers/events/` + `services/api-ts/src/handlers/booking/`
> **Specs:** MODULE_SPEC.md v2.0, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md
> **Generated:** 2026-05-27
> **oli_artifact:** EF-FILE
> **Finding ID format:** `EF-M08-{hash8}` (content-based)

---

## 1. File Inventory

### 1a. `handlers/events/` (42 files)

| File | Role | Lines | Notes |
|------|------|-------|-------|
| `createEvent.ts` | Handler | 60 | POST /org/:orgId/events |
| `getEvent.ts` | Handler | ~20 | GET /org/:orgId/events/:id |
| `getPublicEvent.ts` | Handler | ~20 | GET /public/events/:slug |
| `listEvents.ts` | Handler | ~20 | GET /org/:orgId/events |
| `listPublicEvents.ts` | Handler | ~40 | GET /public/events |
| `listMyEvents.ts` | Handler | ~15 | GET /my/events |
| `updateEvent.ts` | Handler | 76 | PUT /org/:orgId/events/:id |
| `cancelEvent.ts` | Handler | 30 | PUT /org/:orgId/events/:id/cancel |
| `registerForEvent.ts` | Handler | 43 | POST /org/:orgId/events/:id/register |
| `checkIn.ts` | Handler | 95 | POST /org/:orgId/events/:id/checkin |
| `listAttendance.ts` | Handler | ~15 | GET /org/:orgId/events/:id/attendance |
| `listRegistrations.ts` | Handler | ~15 | GET /org/:orgId/events/:id/registrations |
| `bulkCreateEventSeries.ts` | Handler | ~80 | POST bulk event creation |
| `serveEventOgMeta.ts` | Handler | 62 | GET /og/events/:slug |
| `repos/events.repo.ts` | Repository | 213 | EventsRepository (CRUD + registrations + check-ins) |
| `utils/membership-check.ts` | Utility | ~30 | Cross-context membership seam |
| `utils/event-slug.ts` | Utility | ~30 | Slug generation + uniqueness |
| `*.test.ts` (25 files) | Test | varies | Unit/integration tests |

### 1b. `handlers/booking/` (59 files)

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
| `utils/status-transitions.test.ts` | Test | 132 | Full transition matrix coverage |
| `utils/authorization.ts` | Utility | ~80 | Role-based access checks |
| `utils/ownership.ts` | Utility | ~80 | Booking client/host ownership |
| `utils/slotGeneration.ts` | Utility | ~200 | Slot generation algorithms |
| `jobs/index.ts` | Job registration | ~80 | registerBookingJobs() |
| `jobs/confirmationTimer.ts` | Background job | ~100 | Auto-reject after 15min |
| `jobs/slotGenerator.ts` | Background job | ~100 | Daily slot creation |
| `jobs/slotCleanup.ts` | Background job | ~100 | Slot/booking archival |
| `*.test.ts` (26 files) | Test | varies | Unit/integration tests |

---

## 2. Findings

### Legend

| Severity | Meaning |
|----------|---------|
| **P0** | Security/data-loss — must fix before release |
| **P1** | Functional — spec contract violated, user-visible bug |
| **P2** | Correctness — logic gap, missing guard, inconsistency |
| **P3** | Hygiene — naming, style, low-risk inconsistency |

---

### Events Module

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M08-3a7f1c02 | **P1** | Error taxonomy | `createEvent.ts` accepts arbitrary `status` from request body (`body.status ?? 'draft'`). Spec mandates new events start as `draft` only. Client can set `status: 'published'` to bypass state machine. | `events/createEvent.ts:53` | API_CONTRACTS 2.1 POST, MODULE_SPEC 8. State Transitions | HIGH |
| EF-M08-9e4b2d18 | **P1** | Domain terms | `cancelEvent.ts` does not emit `EventCancelled` domain event. Spec requires domain event with `{orgId, eventId, title, affectedRegistrations}`. M07 Communications depends on this for member notifications; M06 Dues depends on it for refund trigger. | `events/cancelEvent.ts:28` | API_CONTRACTS 3. Domain Events, MODULE_SPEC 10b | HIGH |
| EF-M08-7c0a3f56 | **P1** | Error taxonomy | `cancelEvent.ts` does not trigger refund flow for paid events with confirmed registrations. Spec WF-054 requires: "Published -> Cancelled triggers refunds + notifications". No integration with M06 Dues. | `events/cancelEvent.ts` | MODULE_SPEC WF-054, WORKFLOW_MAP | HIGH |
| EF-M08-b2d8e4a1 | **P2** | Data shape | `cancelEvent.ts` response is bare `{data: updated}`. API_CONTRACTS spec requires `affectedRegistrations` count in the cancel response so callers know how many members will be notified/refunded. | `events/cancelEvent.ts:29` | API_CONTRACTS 2.1 PUT cancel response | HIGH |
| EF-M08-d5f1a3c7 | **P2** | Error taxonomy | `registerForEvent.ts` does not check if event is in `published` status before allowing registration. A `draft` or `completed` event accepts registrations. State machine: only `published` events should accept registration (WF-052 step 2). | `events/registerForEvent.ts:13-14` | MODULE_SPEC WF-052, 8. State Transitions | HIGH |
| EF-M08-e8c2b6d0 | **P2** | Data shape | `registerForEvent.ts` does not check for duplicate registrations. Same person can register twice for same event. Spec M08-005 requires unique (personId, eventId). DB may enforce but handler gives no user-friendly error. | `events/registerForEvent.ts:33` | MODULE_SPEC M08-005 | MEDIUM |
| EF-M08-f1a7d3e9 | **P2** | Domain terms | `registerForEvent.ts` does not emit `RegistrationConfirmed` or `RegistrationWaitlisted` domain event. Spec 10b requires these for notification pipeline. | `events/registerForEvent.ts:42` | API_CONTRACTS 3. Domain Events | HIGH |
| EF-M08-14b8c5a2 | **P2** | Error taxonomy | `updateEvent.ts` blocks `status` changes but does NOT block updates to completed/cancelled events. Spec state machine says completed and cancelled are terminal. A completed event's title, description, capacity, etc. can still be mutated. | `events/updateEvent.ts:24-30` | MODULE_SPEC 8. State Transitions, M08-006 | MEDIUM |
| EF-M08-27d6e9f3 | **P2** | Naming | `createEvent.ts:40` uses `body.eventType ?? 'other'` without handler-level enum validation. The 8-value pgEnum will reject at DB level, but the error message will be a raw Postgres error, not a user-friendly `VALIDATION_ERROR`. | `events/createEvent.ts:40` | API_CONTRACTS 2.1 POST EventType enum | MEDIUM |
| EF-M08-38e7f0a4 | **P2** | Error taxonomy | `checkIn.ts:14` officer authorization is conditional on `if (orgId)`. If `organizationId` is not set in context (e.g., missing middleware), the officer check is bypassed entirely. Should be mandatory. | `events/checkIn.ts:14-19` | MODULE_SPEC 6. Permissions, ROLE_PERMISSION_MATRIX | MEDIUM |
| EF-M08-49f8a1b5 | **P2** | Data shape | `checkIn.ts` does not verify that `body.personId` is registered for the event before check-in. Spec BR-17/M08-005: "Must be registered for event". An unregistered person can be checked in. | `events/checkIn.ts:37` | MODULE_SPEC 5. Business Rules | MEDIUM |
| EF-M08-5a09b2c6 | **P2** | Domain terms | `checkIn.ts` emits `attendance.confirmed` pg-boss job but not the spec-declared `AttendanceConfirmed` domain event. Job naming differs from spec event naming convention (`attendance.confirmed` vs `AttendanceConfirmed`). | `events/checkIn.ts:64` | API_CONTRACTS 3. Domain Events | MEDIUM |
| EF-M08-6b1ac3d7 | **P2** | Import boundary | Events repo (`events.repo.ts:3-13`) imports schema from `association:operations/repos/events.schema.ts` — this is a cross-bounded-context import. Events handler owns its domain but the schema lives in a different module directory. Acceptable as shared schema, but the ownership boundary is blurred. | `events/repos/events.repo.ts:3-13` | DOMAIN_MODEL bounded contexts | LOW |
| EF-M08-7c2bd4e8 | **P2** | Data shape | Missing `VALID_TRANSITIONS` constant for event status. Booking module has `BOOKING_VALID_TRANSITIONS` in `utils/status-transitions.ts`. Events module has no equivalent. Status transitions are enforced ad-hoc in individual handlers (cancelEvent checks `cancelled`/`completed`, but no centralized map for `{draft: ['published'], published: ['cancelled', 'completed']}`). | `events/` (missing file) | MODULE_SPEC 8. State Transitions | HIGH |
| EF-M08-8d3ce5f9 | **P3** | Naming | `listRegistrations.ts` returns bare registration records. Spec response should include person details (name, email) joined to registrations for display. | `events/listRegistrations.ts` | API_CONTRACTS 2.3 GET registrations | LOW |
| EF-M08-9e4df60a | **P3** | Data shape | `listEvents.ts` delegates to repo with basic filters. Missing spec-declared `upcoming` boolean query param. Uses `type` param name while spec uses `eventType`. | `events/listEvents.ts` | API_CONTRACTS 2.1 GET query params | LOW |
| EF-M08-af5e071b | **P3** | Import boundary | `createEvent.ts` and `cancelEvent.ts` both import `OfficerTermRepository` from `../association:member/repos/governance.repo`. This is a direct cross-bounded-context import (events -> association:member). Should use a local seam like `membership-check.ts` does. | `events/createEvent.ts:4`, `events/cancelEvent.ts:4` | DOMAIN_MODEL bounded contexts | LOW |
| EF-M08-b060182c | **P3** | Naming | `serveEventOgMeta.ts` uses `event.startDate.toLocaleDateString()` which is locale-dependent (server locale). Should use explicit date formatting (e.g., `toISOString().split('T')[0]`) for deterministic output. | `events/serveEventOgMeta.ts:23` | -- | LOW |

### Booking Module

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M08-c171293d | **P2** | Error taxonomy | `rejectBooking.ts` uses inline status check (`booking.status !== 'pending'`) instead of the shared `isValidBookingTransition()` function. `cancelBooking.ts` and `markNoShowBooking.ts` also use inline checks. The `BOOKING_VALID_TRANSITIONS` map exists but is not called by any handler. State machine is duplicated rather than centralized. | `booking/rejectBooking.ts:62`, `booking/cancelBooking.ts:72`, `booking/markNoShowBooking.ts:71` | booking status-transitions.ts | HIGH |
| EF-M08-d282304e | **P2** | Error taxonomy | `rejectBooking.ts:76-81` updates booking with `cancelledBy: 'host'` and `cancelledAt` fields for a rejection. These fields are semantically for cancellation, not rejection. Creates confusion in audit trail — a rejection looks like a cancellation in the data. | `booking/rejectBooking.ts:76-81` | DOMAIN_MODEL booking entity | MEDIUM |
| EF-M08-e393415f | **P2** | Import boundary | `rejectBooking.ts:85-86` uses dynamic `import()` for `booking.schema` and `drizzle-orm` inside the handler function to release the slot. This is a deferred import pattern that breaks standard import conventions and may cause issues with bundling. Should be a repository method. | `booking/rejectBooking.ts:85-93` | Code conventions | MEDIUM |
| EF-M08-f4a45260 | **P2** | Data shape | `confirmBooking.ts:63` delegates to `repo.confirmBooking()` for timing validation. The 15-minute confirmation window is enforced in the repository, not the handler. Handler has no timing guard itself. If repo method changes, the business rule could silently break. Defence-in-depth gap. | `booking/confirmBooking.ts:63` | API_CONTRACTS booking.confirmationTimer | LOW |
| EF-M08-05b56371 | **P3** | Naming | `confirmBooking.ts:130` returns `ctx.json(confirmedBooking, 200)` — no `{data: ...}` wrapper. Events handlers use `{data: ...}` envelope. Inconsistent response shape between events and booking modules. | `booking/confirmBooking.ts:130` vs `events/createEvent.ts:59` | API_CONTRACTS response format | MEDIUM |
| EF-M08-16c67482 | **P3** | Naming | `rejectBooking.ts:166`, `cancelBooking.ts:154`, `markNoShowBooking.ts:117` also return unwrapped responses. All booking action handlers skip the `{data: ...}` envelope used by events handlers. | `booking/*.ts` | API_CONTRACTS response format | MEDIUM |
| EF-M08-27d78593 | **P3** | Domain terms | `markNoShowBooking.ts` does not send notifications when marking no-show. `confirmBooking.ts`, `cancelBooking.ts`, and `rejectBooking.ts` all send notifications. No-show notification is missing — the other party is not informed. | `booking/markNoShowBooking.ts` | API_CONTRACTS notification contracts | MEDIUM |
| EF-M08-38e896a4 | **P3** | Data shape | `booking/jobs/index.ts:48-55` `triggerSlotGeneration()` throws `DeferredScopeError` for both ownerId and full-job cases. Dead code — any caller will always get an exception. Should be clearly documented or removed. | `booking/jobs/index.ts:48-55` | -- | LOW |
| EF-M08-49f9a7b5 | **OK** | Data shape | `booking/utils/status-transitions.ts` — state machine is correct: 7 statuses, all transitions match DOMAIN_MODEL. Terminal states (rejected, cancelled, completed, no_show_client, no_show_host) have empty arrays. Test coverage is comprehensive (132 lines, matrix + integrity checks). | `booking/utils/status-transitions.ts` | DOMAIN_MODEL 13. State Machines | HIGH |
| EF-M08-5a0ab8c6 | **OK** | Data shape | `booking/repos/booking.schema.ts` — 4 tables (booking_event, time_slot, booking, schedule_exception) with proper enums, FK constraints, check constraints, and indexes. Matches TypeSpec API definition. | `booking/repos/booking.schema.ts` | API_CONTRACTS schema | HIGH |
| EF-M08-6b1bc9d7 | **OK** | Import boundary | `booking/utils/ownership.ts` — clean utility with no cross-bounded-context imports. Uses only local schema types. Good seam pattern. | `booking/utils/ownership.ts` | -- | HIGH |
| EF-M08-7c2cdae8 | **OK** | Domain terms | `booking/jobs/` — three background jobs (slotGenerator, confirmationTimer, slotCleanup) match API_CONTRACTS job contract specs exactly. Registered via `registerBookingJobs()` with correct cron/interval schedules. | `booking/jobs/index.ts` | API_CONTRACTS 2. Job Contracts | HIGH |
| EF-M08-8d3debf9 | **OK** | Error taxonomy | `booking/utils/authorization.ts` — role-based access with admin/support bypass, owner-check, and `requireBookingEventAuthorization` for RBAC. Uses `ForbiddenError` correctly. | `booking/utils/authorization.ts` | ROLE_PERMISSION_MATRIX | HIGH |

---

## 3. Special: `booking/utils/status-transitions.ts` Deep Review

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

- `confirmBooking.ts` — delegates to `repo.confirmBooking()` (repo handles internally)
- `rejectBooking.ts` — inline `booking.status !== 'pending'` check
- `cancelBooking.ts` — delegates to `repo.cancelBooking()` (repo handles internally)
- `markNoShowBooking.ts` — inline `booking.status !== 'confirmed'` check

The state machine utility exists as a tested artifact but is not wired into the enforcement path. Handlers duplicate the logic inline. This means a refactor could introduce inconsistency between the canonical map and the actual enforcement.

---

## 4. Summary

### By Severity

| Severity | Count | Events | Booking |
|----------|-------|--------|---------|
| P0 | 0 | 0 | 0 |
| P1 | 3 | 3 | 0 |
| P2 | 14 | 10 | 4 |
| P3 | 8 | 4 | 4 |
| OK | 5 | 0 | 5 |
| **Total** | **30** | **17** | **9** |

### Top 5 Action Items

1. **[P1] Fix `createEvent.ts` status bypass** — hardcode `status: 'draft'`, ignore client-supplied status. (EF-M08-3a7f1c02)
2. **[P1] Add domain event emission to `cancelEvent.ts`** — emit `EventCancelled` with `affectedRegistrations` count. Wire to M07 notifications and M06 refund pipeline. (EF-M08-9e4b2d18, EF-M08-7c0a3f56)
3. **[P2] Add published-status guard to `registerForEvent.ts`** — reject registration for draft/cancelled/completed events. (EF-M08-d5f1a3c7)
4. **[P2] Create `events/utils/status-transitions.ts`** — centralized `EVENT_VALID_TRANSITIONS` map matching booking pattern. Wire into all event status change handlers. (EF-M08-7c2bd4e8)
5. **[P2] Wire `BOOKING_VALID_TRANSITIONS` into booking handlers** — replace inline status checks with `isValidBookingTransition()` calls. (EF-M08-c171293d)

### Cross-Module Observations

- **Events vs Booking consistency gap**: Booking handlers use `ValidatedContext` with generated validators; events handlers use raw `Context` with `ctx.req.json()`. Booking follows the generated-types pattern; events handlers bypass it.
- **Notification asymmetry**: Booking handlers (confirm, cancel, reject) send notifications via `NotificationService`. Events handlers (cancel, register, check-in) do not. Only `checkIn.ts` emits a pg-boss job for downstream processing.
- **Response envelope inconsistency**: Events uses `{data: ...}` wrapper. Booking action endpoints return unwrapped objects. Should be standardized.
- **Import boundary health**: Booking module has clean boundaries (local repos, utils, schema). Events module has 3 cross-bounded-context imports (OfficerTermRepository from association:member, schema from association:operations).
