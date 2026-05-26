# 03 — Route Navigation Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26

---

## 1. Frontend Routes Inventory

### Events Routes

| Route | File | Auth Required | Role Guard | Purpose |
|-------|------|---------------|-----------|---------|
| `/org/$orgSlug/events` | `_authenticated/org/$orgSlug/events/index.tsx` | Yes (authenticated layout) | None (any member) | Browse org events |
| `/org/$orgSlug/events/$eventId` | `_authenticated/org/$orgSlug/events/$eventId.tsx` | Yes | None | Event detail + register |
| `/org/$orgSlug/officer/events` | `_authenticated/org/$orgSlug/officer/events/index.tsx` | Yes | Officer layout | Officer event list |
| `/org/$orgSlug/officer/events/new` | `_authenticated/org/$orgSlug/officer/events/new.tsx` | Yes | Officer layout | Create event form |
| `/org/$orgSlug/officer/events/$eventId` | `_authenticated/org/$orgSlug/officer/events/$eventId.tsx` | Yes | Officer layout | Event detail + edit/manage |
| `/org/$orgSlug/officer/events/$eventId/attendance` | `_authenticated/org/$orgSlug/officer/events/$eventId/attendance.tsx` | Yes | Officer layout | Attendance + check-in |
| `/my/events` | `_authenticated/my/events.tsx` | Yes | None | My registered events |
| `/discover/events` | `discover/events.tsx` | **No** | None | Public event discovery |
| `/events/$eventSlug` | `events/$eventSlug.tsx` | **No** | None | Public event detail |

### Booking Routes

| Route | File | Auth Required | Role Guard | Purpose |
|-------|------|---------------|-----------|---------|
| `/my/bookings` | `_authenticated/my/bookings/index.tsx` | Yes | None | Host directory + my bookings |
| `/my/bookings/$bookingId` | `_authenticated/my/bookings/$bookingId.tsx` | Yes | None | Booking detail + actions |
| `/my/bookings/host.$personId` | `_authenticated/my/bookings/host.$personId.tsx` | Yes | None | Host profile + available slots |
| `/my/bookings/host.$personId.$slotId` | `_authenticated/my/bookings/host.$personId.$slotId.tsx` | Yes | None | Slot confirmation page |

---

## 2. Backend Route Registration

### Events API Routes

| API Route | Method | Frontend Caller | Registered? |
|-----------|--------|----------------|------------|
| `/association/events` | POST | Officer new event form | ✓ |
| `/association/events` | GET | Member events page | ✓ |
| `/association/events/:eventId` | GET | Member/officer event detail | ✓ |
| `/association/events/:eventId` | PATCH | Officer event edit | ✓ |
| `/association/events/:eventId` | DELETE | [NEEDS MANUAL CONFIRMATION] | ✓ |
| `/association/events/:eventId/cancel` | POST | Officer event cancel | ✓ |
| `/association/events/:eventId/publish` | POST | Officer publish action | ✓ |
| `/association/events/:eventId/waitlist` | GET | Officer waitlist tab | ✓ |
| `/association/events/:eventId/waitlist/:entryId/promote` | POST | Officer promote action | ✓ |
| `/association/event-lifecycle/my` | GET | My Events page | ✓ |
| `/association/event-lifecycle/:eventId/register` | POST | Member register button | ✓ |
| `/association/event-lifecycle/:eventId/register-and-pay` | POST | Member paid register | ✓ |
| `/association/event-lifecycle/:eventId/check-in` | POST | Officer check-in | ✓ |
| `/association/event-lifecycle/:eventId/attendance` | GET | Officer attendance tab | ✓ |
| `/association/event-lifecycle/:eventId/registrations` | GET | Officer registrations tab | ✓ |
| `/association/event-lifecycle/:eventId/complete` | POST | [NEEDS MANUAL CONFIRMATION] | ✓ |
| `/association/events/registrations` | POST/GET | [NEEDS MANUAL CONFIRMATION] | ✓ |
| `/association/events/checkins` | POST/GET | [NEEDS MANUAL CONFIRMATION] | ✓ |

### Booking API Routes

| API Route | Method | Frontend Caller | Registered? |
|-----------|--------|----------------|------------|
| `/booking/events` | POST/GET | Host creates booking event / host directory | ✓ |
| `/booking/events/:event` | GET/PATCH/DELETE | Host manages event | ✓ |
| `/booking/events/:event/exceptions` | POST/GET | Host manages schedule | ✓ |
| `/booking/events/:event/exceptions/:exception` | GET/DELETE | Host manages exceptions | ✓ |
| `/booking/events/:event/slots` | GET | Client views available slots | ✓ |
| `/booking/slots/:slotId` | GET | Slot confirmation page | ✓ |
| `/booking/bookings` | POST/GET | Client creates booking / lists bookings | ✓ |
| `/booking/bookings/:booking` | GET | Booking detail page | ✓ |
| `/booking/bookings/:booking/cancel` | POST | Cancel booking button | ✓ |
| `/booking/bookings/:booking/confirm` | POST | Host confirm button | ✓ |
| `/booking/bookings/:booking/reject` | POST | Host reject button | ✓ |
| `/booking/bookings/:booking/no-show` | POST | No-show button | ✓ |

---

## 3. Navigation Links

| Source | Link Target | Works? | Evidence |
|--------|------------|--------|----------|
| Officer sidebar → Events | `/org/$orgSlug/officer/events` | ✓ | Officer layout nav |
| Member sidebar → Events | `/org/$orgSlug/events` | ✓ | Org member layout nav |
| Officer events → New Event | `/org/$orgSlug/officer/events/new` | ✓ | `officer/events/index.tsx` Link |
| Officer events → Event Detail | `/org/$orgSlug/officer/events/$eventId` | ✓ | EventList component links |
| Officer event → Attendance | `/org/$orgSlug/officer/events/$eventId/attendance` | ✓ | Tab navigation |
| My sidebar → Events | `/my/events` | ✓ | My layout nav |
| My sidebar → Bookings | `/my/bookings` | ✓ | My layout nav |
| Discover → Events | `/discover/events` | ✓ | Discover layout nav |
| Discover events → Public detail | `/events/$eventSlug` | ✓ | PublicEventCard Link |
| Bookings → Host profile | `/my/bookings/host.$personId` | ✓ | HostDirectory links |
| Host profile → Slot confirmation | `/my/bookings/host.$personId.$slotId` | ✓ | Slot click handler |
| Booking list → Detail | `/my/bookings/$bookingId` | ✓ | BookingList links |

---

## 4. Findings

| ID | Finding | Location | Severity |
|----|---------|----------|----------|
| E-NAV-01 | No admin app pages for events | `apps/admin/src/routes` — no event routes found | P2 |
| E-NAV-02 | No admin app pages for bookings | `apps/admin/src/routes` — no booking routes found | P2 |
| E-NAV-03 | Officer event detail has "Duplicate" button that navigates to `/new` with state — works but no E2E coverage | `officer/events/$eventId.tsx` | P3 |
| E-NAV-04 | Public event page links to `/events/$eventSlug` but registration requires auth — no "sign in to register" CTA for unauthenticated users | `events/$eventSlug.tsx` | P2 |

---

## 5. Dead Routes / Orphan Pages

No dead routes detected. All frontend routes map to working API endpoints.

---

## 6. E2E Navigation Coverage

| Navigation Path | E2E Test? | Quality |
|----------------|-----------|---------|
| Officer → Events list → New Event → Create | `officer/events.spec.ts` | WEAK (page-load check) |
| Officer → Event Detail → Edit | `officer/events.spec.ts` | WEAK |
| Officer → Event → Attendance → Check-in | `officer/event-checkin.spec.ts` | WEAK (page-load) |
| Member → Events list → Event detail → Register | `member/events.spec.ts` | WEAK |
| My → Events → View registered events | `states/events-states.spec.ts` | WEAK |
| Discover → Events → Public detail | NONE | **NONE** [P2] |
| My → Bookings → Host directory → Slot → Book | NONE | **NONE** [P1] |
| My → Bookings → Detail → Confirm/Reject/Cancel | NONE | **NONE** [P1] |
