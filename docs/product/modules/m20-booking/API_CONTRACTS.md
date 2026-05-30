<!-- oli:api-contracts v0.1 | generated 2026-05-30 | source: TypeSpec → OpenAPI -->
# API Contracts — Booking (M20)

> Source: TypeSpec at `specs/api/src/modules/booking.tsp` → OpenAPI at `specs/api/dist/openapi/openapi.json`
> Conventions: `API_CONVENTIONS.md` | Errors: `ERROR_TAXONOMY.md`
> Audit-grade scaffold (Wave G6). Promote to v1.0 with per-endpoint detail when the module reaches full coverage parity with m05.

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/booking` |
| Auth default | GA (session cookie or Bearer token) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Session orgContext middleware on `/booking/*` (`app.ts:429`) |
| Generated routes | Registered via `generated/openapi/routes.ts` |

---

## 2. Endpoints

### 2.1 Bookings (member-facing)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/booking/bookings` | listBookings | user |
| POST | `/booking/bookings` | createBooking | user |
| GET | `/booking/bookings/{booking}` | getBooking | user |
| POST | `/booking/bookings/{booking}/cancel` | cancelBooking | user (own) / officer |
| POST | `/booking/bookings/{booking}/confirm` | confirmBooking | officer |
| POST | `/booking/bookings/{booking}/reject` | rejectBooking | officer |
| POST | `/booking/bookings/{booking}/no-show` | markNoShowBooking | officer |

### 2.2 Booking events (officer-managed)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/booking/events` | listBookingEvents | user |
| POST | `/booking/events` | createBookingEvent | officer |
| GET | `/booking/events/{event}` | getBookingEvent | user |
| PATCH | `/booking/events/{event}` | updateBookingEvent | officer |
| DELETE | `/booking/events/{event}` | deleteBookingEvent | officer |

### 2.3 Schedule exceptions

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/booking/events/{event}/exceptions` | listScheduleExceptions | officer |
| POST | `/booking/events/{event}/exceptions` | createScheduleException | officer |
| GET | `/booking/events/{event}/exceptions/{exception}` | getScheduleException | officer |
| DELETE | `/booking/events/{event}/exceptions/{exception}` | deleteScheduleException | officer |

### 2.4 Slots (read-only)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/booking/events/{event}/slots` | listEventSlots | user |
| GET | `/booking/slots/{slotId}` | getTimeSlot | user |

---

## 3. Domain Events Published

Audit-grade stub. See `docs/audits/codebase-map/events.json` for the authoritative ledger.

- `booking.created`, `booking.cancelled`, `booking.confirmed`, `booking.rejected`, `booking.no_show`
- `booking_event.created`, `booking_event.updated`, `booking_event.deleted`
- `schedule_exception.created`, `schedule_exception.deleted`

## 4. Domain Events Consumed

- `person.deleted` (cascade booking cancellation)
- `organization.suspended` (freeze new bookings)

## 5. Shared Types

- `Booking`, `BookingEvent`, `TimeSlot`, `ScheduleException` — see OpenAPI `#/components/schemas/`
- State transitions: see `MODULE_SPEC.md §7`
