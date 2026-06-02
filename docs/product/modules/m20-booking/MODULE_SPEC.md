# Module Specification: Booking (M20)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 1.0
Last Updated: 2026-05-29
Last Validated Against: DOMAIN_MODEL.md v1.0, EVENT_CONTRACTS.md v1.0
---

## 1. Module Overview

### Purpose
Time-based scheduling system for professional services. Providers create booking events (availability templates with recurrence, duration, and location settings), the system generates time slots, and clients book appointments. Supports video, phone, and in-person locations with configurable booking windows, buffers, and capacity limits.

### Users
- Provider (any authenticated person) — create/manage booking events, view/manage bookings, mark no-shows
- Client (any authenticated person) — browse availability, create/cancel bookings
- System — auto-generate time slots from recurrence rules, manage slot status transitions

### Related Modules
- M02 (Person — provider and client identity)
- M07 (Communications — booking confirmation/cancellation notifications)
- M06 (Dues — potential paid booking fees, future integration)

### In Scope
- Booking event CRUD (availability templates with recurrence, duration, location, capacity)
- Time slot generation from booking event schedules
- Schedule exceptions (blocked dates, modified hours)
- Booking lifecycle: create → confirm → complete / cancel / no-show
- Multi-location support: video, phone, in-person
- Configurable booking windows (min/max advance booking days)
- Buffer times between slots
- Form configuration and billing configuration per event
- Full-text search on booking events (GIN indexes)

### Out of Scope
- Payment processing for paid bookings (future M06 integration)
- Calendar sync (Google Calendar, iCal export)
- Association events (M08 Events — separate domain)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Booking Event | Availability template defining when a provider is bookable. Contains recurrence rules, duration, location, and capacity settings. |
| Time Slot | Individual bookable unit generated from a booking event's schedule. Status: available, booked, blocked. |
| Booking | Client's reservation of a time slot. Status: pending, confirmed, rejected, cancelled, completed, no_show_client, no_show_host. |
| Schedule Exception | Override for a specific date range — blocks slots or modifies availability hours. |
| Buffer Time | Minutes between consecutive slots to prevent back-to-back bookings. |
| Booking Window | Min/max days in advance a client can book (e.g., no sooner than 1 day, no later than 30 days). |
| Recurrence | Pattern for slot generation: daily, weekly, monthly, yearly with day-of-week configuration. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Create Booking Event | WF-115 | Provider | Configure availability template with schedule, duration, location | P0 |
| Manage Schedule Exceptions | WF-116 | Provider | Block dates or modify hours for specific periods | P0 |
| Browse & Book | WF-117 | Client | View available slots, create booking | P0 |
| Confirm/Reject Booking | WF-118 | Provider | Accept or decline pending bookings | P0 |
| Cancel Booking | WF-119 | Client/Provider | Cancel existing booking, release slot | P0 |
| Mark No-Show | WF-120 | Provider | Flag client or host no-show after appointment time | P1 |
| List My Bookings | WF-121 | Client/Provider | View upcoming and past bookings | P0 |

**Cross-cutting workflows referenced by this module (defined in WORKFLOW_MAP.md §1.20):**
- WF-112 — Booking Event Lifecycle (create slots, accept bookings, confirmations)
- WF-113 — Slot Generation (auto-generate time slots from recurrence config)
- WF-114 — Booking Confirmation Timer (auto-reject unconfirmed bookings)

## 4. Business Rules

| Rule ID | Module-Local Alias | Rule | Applies To | Expected Behavior |
|---------|--------------------|------|-----------|-------------------|
| BR-68 | M20-R1 | IF booking event status is not `active` THEN no new bookings allowed | Booking creation | Only active events accept bookings |
| BR-69 | M20-R2 | IF slot status is `booked` or `blocked` THEN reject booking attempt | Slot availability | Prevent double-booking |
| BR-70 | M20-R3 | IF booking within min booking minutes window THEN reject | Booking creation | Enforce minimum advance notice |
| BR-71 | M20-R4 | IF booking beyond max booking days THEN reject | Booking creation | Enforce maximum advance booking |
| BR-72 | M20-R5 | IF schedule exception covers a slot's date THEN mark slot blocked | Slot generation | Exceptions override regular schedule |
| BR-73 | M20-R6 | IF booking cancelled THEN release slot back to `available` | Cancellation | Capacity reclaimed |
| BR-74 | M20-R7 | IF booking event has buffer time THEN slots must not overlap with buffer | Slot generation | Prevent back-to-back without buffer |
| BR-75 | M20-R8 | IF effective_to date set THEN must be after effective_from | Event validation | Date ordering constraint |
| BR-76 | M20-R9 | IF max_booking_days set THEN must be 0-365 | Event validation | DB check constraint |
| BR-77 | M20-R10 | IF min_booking_minutes set THEN must be 0-4320 (72hrs max) | Event validation | DB check constraint |

## 5. Permissions

| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| Create booking event | Any authenticated | Provider creates own events |
| Update/delete booking event | Owner only | Provider manages own events |
| List booking events | Public (optional auth) | Browsing availability |
| Get booking event | Public (optional auth) | Viewing event details |
| Create booking | Any authenticated | Client books a slot |
| Confirm/reject booking | Event owner | Provider manages bookings |
| Cancel booking | Booking creator or event owner | Either party can cancel |
| Mark no-show | Event owner | Provider marks after appointment |
| Manage schedule exceptions | Event owner | Provider blocks dates |

## 6. Data Requirements

### Entity: BookingEvent (20+ columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| owner | Yes | Provider person FK | Auto-set to authenticated user |
| title | Yes | Event name | Max 300 chars |
| description | No | Event description | Text |
| slug | Yes | URL-friendly identifier | Unique |
| status | Yes | draft/active/paused/archived | Enum |
| duration | Yes | Slot duration in minutes | Positive integer |
| bufferBefore/bufferAfter | No | Buffer minutes | Default 0 |
| locationType | Yes | video/phone/in-person | Enum |
| locationDetails | No | Address or meeting link | JSONB |
| timezone | Yes | IANA timezone | String |
| recurrenceType | No | daily/weekly/monthly/yearly | Enum |
| dailyConfig | No | Day-of-week schedule | JSONB |
| effectiveFrom/effectiveTo | Yes/No | Active date range | Date ordering enforced |
| maxBookingDays | No | Max days in advance | 0-365 |
| minBookingMinutes | No | Min minutes in advance | 0-4320 |
| capacity | No | Slots per time block | Default 1 |
| keywords/tags | No | Searchable metadata | JSONB arrays, GIN indexed |
| formConfig | No | Custom intake form fields | JSONB |
| billingConfig | No | Payment settings | JSONB |

### Entity: TimeSlot (10+ columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| owner | Yes | Slot owner (person FK) | From event |
| event | Yes | Booking event FK | Cascade delete |
| context | No | Optional context ID | From event |
| startTime | Yes | Slot start datetime | Timestamptz |
| endTime | Yes | Slot end datetime | After startTime |
| status | Yes | available/booked/blocked | Enum |
| bookedBy | No | Client person FK | Set on booking |
| metadata | No | Additional slot data | JSONB |

### Entity: Booking (8+ columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| slot | Yes | Time slot FK | Cascade delete |
| event | Yes | Booking event FK | Cascade delete |
| bookedBy | Yes | Client person FK | Authenticated user |
| status | Yes | pending/confirmed/rejected/cancelled/completed/no_show_client/no_show_host | Enum |
| notes | No | Client notes | Text |
| confirmedAt/cancelledAt/completedAt | No | Status timestamps | Auto-set |

### Entity: ScheduleException (6+ columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| event | Yes | Booking event FK | Cascade delete |
| startDate | Yes | Exception start | Date |
| endDate | Yes | Exception end | After startDate |
| isBlocked | Yes | Block or modify | Boolean |
| modifiedHours | No | Alternative hours | JSONB |
| reason | No | Exception reason | Text |

## 7. State Transitions

### Booking Event Status
```
Draft ──activate──► Active ──pause──► Paused ──activate──► Active
Draft ──activate──► Active ──archive──► Archived
Draft ──archive──► Archived
Paused ──archive──► Archived
```

### Booking Status
```
Pending ──confirm──► Confirmed ──complete──► Completed
Pending ──reject──► Rejected
Pending ──cancel──► Cancelled
Confirmed ──cancel──► Cancelled
Confirmed ──no_show──► NoShowClient | NoShowHost
```

### Slot Status
```
Available ──book──► Booked ──cancel──► Available
Available ──block──► Blocked ──unblock──► Available
```

## 8. API Expectations

Each endpoint anchors to one or more spec IDs (BR-* business rules from §4, WF-* workflows from §3 or WORKFLOW_MAP.md §1.20). This satisfies the traceability contract: spec → handler → test.

| API Need | Method | Route | Auth | Spec-IDs | Notes |
|----------|--------|-------|------|----------|-------|
| List booking events | GET | /booking/events | Optional | WF-117 | Public browsing |
| Create booking event | POST | /booking/events | Required | WF-115, WF-112, BR-75, BR-76, BR-77 | Owner auto-set; validates date ordering + booking-window bounds |
| Get booking event | GET | /booking/events/:id | Optional | WF-117 | Public view |
| Update booking event | PUT | /booking/events/:id | Required | WF-115, BR-75, BR-76, BR-77 | Owner only; re-validates bounds |
| Delete booking event | DELETE | /booking/events/:id | Required | WF-115 | Owner only |
| List event slots | GET | /booking/events/:id/slots | Optional | WF-117, WF-113, BR-72, BR-74 | Slots reflect exceptions + buffer rules |
| Get time slot | GET | /booking/slots/:id | Optional | WF-117 | Slot details |
| Create booking | POST | /booking/bookings | Required | WF-117, WF-112, BR-68, BR-69, BR-70, BR-71 | Client books; enforces event-active, slot-availability, booking-window |
| Get booking | GET | /booking/bookings/:id | Required | WF-121 | Owner or booker |
| List bookings | GET | /booking/bookings | Required | WF-121 | Filtered by role |
| Confirm booking | PUT | /booking/bookings/:id/confirm | Required | WF-118, WF-112, WF-114 | Event owner; stops confirmation timer |
| Reject booking | PUT | /booking/bookings/:id/reject | Required | WF-118, BR-73 | Event owner; releases slot |
| Cancel booking | PUT | /booking/bookings/:id/cancel | Required | WF-119, BR-73 | Either party; releases slot |
| Mark no-show | PUT | /booking/bookings/:id/no-show | Required | WF-120 | Event owner; post-appointment flag |
| Create exception | POST | /booking/events/:id/exceptions | Required | WF-116, BR-72 | Owner only; blocks affected slots |
| Get exception | GET | /booking/exceptions/:id | Required | WF-116 | Owner only |
| Update exception | PUT | /booking/exceptions/:id | Required | WF-116, BR-72 | Owner only; re-applies blocking |
| Delete exception | DELETE | /booking/exceptions/:id | Required | WF-116 | Owner only; restores slots |
| List exceptions | GET | /booking/events/:id/exceptions | Required | WF-116 | Owner only |

**TypeSpec:** `specs/api/src/modules/booking.tsp` — COMPLETE (all 19 operations defined)

## 9. Domain Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| BookingCreated | New booking | bookingId, slotId, eventId, bookedBy | M07 (notification to provider) |
| BookingConfirmed | Provider confirms | bookingId, bookedBy | M07 (confirmation to client) |
| BookingCancelled | Either party cancels | bookingId, cancelledBy | M07 (notification) |
| BookingCompleted | Appointment finished | bookingId | — |

## 10. Dependencies

| Module | Why Needed |
|--------|------------|
| person (M02) | Provider and client identity via person.id |
| communications (M07) | Booking confirmation/cancellation notifications |

## 11. AI Instructions

When implementing this module:
1. **Schema location:** `services/api-ts/src/handlers/booking/repos/booking.schema.ts` — all tables defined here.
2. **TypeSpec:** `specs/api/src/modules/booking.tsp` — fully defined, generate routes/validators before handlers.
3. **Slot generation:** Complex recurrence logic in `repos/timeSlot.repo.ts`. Use `generateSlotsForEvent()` and `batchGenerateSlots()`.
4. **Public routes:** `listBookingEvents` and `getBookingEvent` support optional auth (`bearerAuth | Http.NoAuth`).
5. **GIN indexes:** Full-text search on title+description, array ops on keywords and tags.
6. **Multi-tenant:** All queries must scope by `organizationId`.
7. **Handler pattern:** Router → Validators → Handlers → Repositories.
8. **19 handlers** already implemented — CRUD for events, slots, bookings, and schedule exceptions.

## 12. Section Completeness

| Section | Status |
|---------|--------|
| 1. Module Overview | COMPLETE |
| 2. Domain Terms | COMPLETE |
| 3. Workflows | COMPLETE |
| 4. Business Rules | COMPLETE (10 rules, BR-68..BR-77) |
| 5. Permissions | COMPLETE |
| 6. Data Requirements | COMPLETE (4 entities) |
| 7. State Transitions | COMPLETE (3 state machines) |
| 8. API Expectations | COMPLETE (19 endpoints, TypeSpec COMPLETE, all anchored to BR/WF IDs) |
| 9. Domain Events | COMPLETE |
| 10. Dependencies | COMPLETE |
| 11. AI Instructions | COMPLETE |

## 13. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | Claude | Initial spec from existing codebase (Wave 8 coverage) |
| 1.1 | 2026-06-02 | Claude | Added spec-ID anchors to all 19 API endpoints: assigned BR-68..BR-77 (global aliases of M20-R1..R10; BR-52..BR-66 were claimed by parallel m21/m22 fixes for TR-P1-002/003, BR-67 by BR-42 split for TR-P1-004), allocated WF-115..WF-121 for the 7 user-facing workflows, and added a Spec-IDs column to §8. Resolves TR-P1-001 from TRACEABILITY_REPORT.md. |
