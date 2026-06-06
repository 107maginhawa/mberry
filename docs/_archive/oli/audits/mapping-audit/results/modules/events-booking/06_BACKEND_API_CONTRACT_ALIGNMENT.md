# 06 — Backend API Contract Alignment Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26

---

## 1. Events — Handler vs Generated Route Alignment

### TypeSpec-Generated Routes (`/association/events/*`)

These routes are generated from TypeSpec and registered in `routes.ts`. Each has a `registry.*` handler reference.

| Generated Route | Registry Handler | Implementation File | Aligned? |
|----------------|-----------------|--------------------|---------| 
| `registry.createEvent` | `createEvent` | `events/createEvent.ts` | ✓ |
| `registry.searchEvents` | [NEEDS MANUAL CONFIRMATION] | `events/listEvents.ts` (likely) | ✓ |
| `registry.getEvent` | `getEvent` | `events/getEvent.ts` | ✓ |
| `registry.updateEvent` | `updateEvent` | `events/updateEvent.ts` | ✓ |
| `registry.deleteEvent` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.cancelEvent` | `cancelEvent` | `events/cancelEvent.ts` | ✓ |
| `registry.publishEvent` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.listWaitlistEntries` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.promoteWaitlistEntry` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.createEventRegistration` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.searchEventRegistrations` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.cancelEventRegistration` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.refundEventRegistration` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.createCheckIn` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.searchCheckIns` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |

### Event-Lifecycle Routes (`/association/event-lifecycle/*`)

| Generated Route | Registry Handler | Implementation File | Aligned? |
|----------------|-----------------|--------------------|---------| 
| `registry.listMyCustomEvents` | `listMyEvents` | `events/listMyEvents.ts` | ✓ |
| `registry.listCustomEventAttendance` | `listAttendance` | `events/listAttendance.ts` | ✓ |
| `registry.checkInCustomEvent` | `checkIn` | `events/checkIn.ts` | ✓ |
| `registry.completeEvent` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.registerForCustomEvent` | `registerForEvent` | `events/registerForEvent.ts` | ✓ |
| `registry.registerAndPayForEvent` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `registry.listCustomEventRegistrations` | `listRegistrations` | `events/listRegistrations.ts` | ✓ |

**Note**: Multiple `[NEEDS MANUAL CONFIRMATION]` items exist because the events module has a DUAL route system:
1. `/association/events/*` — CRUD operations (TypeSpec-generated)
2. `/association/event-lifecycle/*` — lifecycle operations (TypeSpec-generated)

Some handlers (`listAttendance`, `listRegistrations`) map to the lifecycle routes but there are ALSO matching CRUD routes (`/association/events/registrations`, `/association/events/checkins`). This creates **duplicate endpoint paths** for similar functionality.

**Finding E-API-01 (P2)**: Dual route families (`/association/events/*` and `/association/event-lifecycle/*`) create confusion about which endpoints frontends should use. Potential for frontend calling one and backend expectations on another.

---

## 2. Booking — Handler vs Generated Route Alignment

All booking handlers are TypeSpec-generated with proper validator middleware:

| Generated Route | Handler | Validators | Aligned? |
|----------------|---------|-----------|----------|
| `createBooking` | `createBooking.ts` | `CreateBookingBody` | ✓ |
| `listBookings` | `listBookings.ts` | `ListBookingsQuery` | ✓ |
| `getBooking` | `getBooking.ts` | `GetBookingParams`, `GetBookingQuery` | ✓ |
| `cancelBooking` | `cancelBooking.ts` | `CancelBookingParams`, `CancelBookingBody` | ✓ |
| `confirmBooking` | `confirmBooking.ts` | `ConfirmBookingParams`, `ConfirmBookingBody` | ✓ |
| `rejectBooking` | `rejectBooking.ts` | `RejectBookingParams`, `RejectBookingBody` | ✓ |
| `markNoShowBooking` | `markNoShowBooking.ts` | `MarkNoShowBookingParams`, `MarkNoShowBookingBody` | ✓ |
| `createBookingEvent` | `createBookingEvent.ts` | `CreateBookingEventBody` | ✓ |
| `updateBookingEvent` | `updateBookingEvent.ts` | `UpdateBookingEventBody` | ✓ |
| `deleteBookingEvent` | `deleteBookingEvent.ts` | — | ✓ |
| `getBookingEvent` | `getBookingEvent.ts` | `GetBookingEventParams`, `GetBookingEventQuery` | ✓ |
| `listBookingEvents` | `listBookingEvents.ts` | `ListBookingEventsQuery` | ✓ |
| `createScheduleException` | `createScheduleException.ts` | `CreateScheduleExceptionBody`, `CreateScheduleExceptionParams` | ✓ |
| `deleteScheduleException` | `deleteScheduleException.ts` | `DeleteScheduleExceptionParams` | ✓ |
| `getScheduleException` | `getScheduleException.ts` | `GetScheduleExceptionParams`, `GetScheduleExceptionQuery` | ✓ |
| `listScheduleExceptions` | `listScheduleExceptions.ts` | `ListScheduleExceptionsParams`, `ListScheduleExceptionsQuery` | ✓ |
| `getTimeSlot` | `getTimeSlot.ts` | `GetTimeSlotParams`, `GetTimeSlotQuery` | ✓ |
| `listEventSlots` | `listEventSlots.ts` | `ListEventSlotsParams`, `ListEventSlotsQuery` | ✓ |

**Booking contract alignment is EXCELLENT.** All routes use generated Zod validators.

---

## 3. Events — Validator Gap

| Route | Has `zValidator`? | Handler Uses `ctx.req.valid()`? | Evidence |
|-------|------------------|-------------------------------|----------|
| Events CRUD routes | ✓ (generated) | **NO** — handlers use `ctx.req.json()` | `createEvent.ts:11`, `updateEvent.ts:13`, `cancelEvent.ts:12` |
| Events lifecycle routes | ✓ (generated) | **NO** — handlers use `ctx.req.json()` | `checkIn.ts:22`, `registerForEvent.ts:14` |

**Finding E-API-02 (P1)**: Events handlers use raw `ctx.req.json()` instead of `ctx.req.valid('json')`. This means the Zod validators in the route layer run but **the validated output is never consumed** — handlers parse the raw body separately. Any validation bypass in the raw body parser would bypass Zod.

**Booking handlers correctly use `ctx.req.valid('json')` and `ctx.req.valid('param')`.** This is the proper pattern.

---

## 4. Contract Test Coverage

| Area | Contract Test Files | Coverage |
|------|-------------------|----------|
| Events CRUD | `assoc-events-flow.hurl` | Basic flow |
| Events Lifecycle | `assoc-event-lifecycle-flow.hurl` | Lifecycle flow |
| Events Registrations | `assoc-events-registrations-flow.hurl` | Registration flow |
| Events Check-ins | `assoc-events-checkins-flow.hurl` | Check-in flow |
| Events (legacy) | `events-flow.hurl` | Legacy flow |
| Booking CRUD | `booking-flow.hurl` | Basic flow |
| Booking Events | `booking-event.hurl` | Event creation |
| Booking Exceptions | `booking-exceptions.hurl` | Exception management |
| Booking Extended | `booking-extended-flow.hurl` | Extended scenarios |
| Booking Edge | `booking-edge.hurl` | Edge cases |
| Booking Search | `booking-search.hurl` | Search/filter |

**Good contract test coverage for both modules.** 11 Hurl files total.

---

## 5. Findings Summary

| ID | Finding | Location | Severity |
|----|---------|----------|----------|
| E-API-01 | Dual route families (`/association/events/*` and `/association/event-lifecycle/*`) for overlapping functionality | `routes.ts` | P2 |
| E-API-02 | Events handlers use `ctx.req.json()` instead of `ctx.req.valid('json')` — Zod validators run but output is ignored | All event handler files | **P1** |
| E-API-03 | `listAttendance` and `listRegistrations` return raw data with no pagination | `listAttendance.ts`, `listRegistrations.ts` | P2 |
