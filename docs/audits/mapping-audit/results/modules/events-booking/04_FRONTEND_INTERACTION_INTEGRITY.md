# 04 — Frontend Interaction Integrity Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26

---

## 1. Events — Interactive Elements

### Officer Event Management

| Element | File | Action | API Call | Backend Handler | Works? |
|---------|------|--------|---------|----------------|--------|
| "Create Event" link | `officer/events/index.tsx` | Navigate to new event form | — | — | ✓ |
| Event form submit (Save Draft) | `event-form.tsx` | `createEventMutation` / `updateEventMutation` | POST `/association/events` | `createEvent` | ✓ |
| Event form submit (Publish) | `event-form.tsx` | Sets `status: 'published'` in body | POST `/association/events` | `createEvent` | [CURRENT BEHAVIOR] status set inline |
| "Edit" button | `officer/events/$eventId.tsx` | Toggle edit mode inline | — | — | ✓ |
| "Duplicate" button | `officer/events/$eventId.tsx` | Navigate to `/new` with state | — | — | ✓ |
| Status badge | `officer/events/$eventId.tsx` | Display only | — | — | ✓ |
| Tab navigation (Details/Registrations/Attendance/Waitlist) | `officer/events/$eventId.tsx` | Toggle tab content | — | — | ✓ |
| Cancel event button | `officer/events/$eventId.tsx` | [NEEDS MANUAL CONFIRMATION] | POST `.../cancel` | `cancelEvent` | [NEEDS MANUAL CONFIRMATION] |
| Publish event button | `officer/events/$eventId.tsx` | [NEEDS MANUAL CONFIRMATION] | POST `.../publish` | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| QR scanner (attendance) | `officer/events/$eventId/attendance.tsx` | Opens camera scanner | POST `.../check-in` | `checkIn` | ✓ |
| Manual check-in search | `officer/events/$eventId/attendance.tsx` | Search + check-in | POST `.../check-in` | `checkIn` | ✓ |

### Member Event Interaction

| Element | File | Action | API Call | Backend Handler | Works? |
|---------|------|--------|---------|----------------|--------|
| Event type filter | `org/$orgSlug/events/index.tsx` | Filter event list | GET `/association/events` query | `searchEvents` | ✓ |
| Search input | `org/$orgSlug/events/index.tsx` | Search events | GET `/association/events` query | `searchEvents` | ✓ |
| Event card click | `event-card.tsx` | Navigate to detail | — | — | ✓ |
| "Register" button (free) | `org/$orgSlug/events/$eventId.tsx` | `registerForCustomEventMutation` | POST `.../register` | `registerForEvent` | ✓ |
| "Register & Pay" button (paid) | `org/$orgSlug/events/$eventId.tsx` | `registerAndPayForEventMutation` | POST `.../register-and-pay` | [NEEDS MANUAL CONFIRMATION] | ✓ |
| "Cancel Registration" button | `org/$orgSlug/events/$eventId.tsx` | `cancelEventRegistrationMutation` | POST `.../cancel` | [NEEDS MANUAL CONFIRMATION] | ✓ |
| "Add to Calendar" button | `org/$orgSlug/events/$eventId.tsx` | `downloadIcsFile()` | Client-side only | — | ✓ |

### Public Event Interaction

| Element | File | Action | API Call | Backend Handler | Works? |
|---------|------|--------|---------|----------------|--------|
| Search input | `discover/events.tsx` | Filter public events | GET `/public/events` query | `listPublicEvents` | ✓ |
| Event type filter | `discover/events.tsx` | Filter by type | GET `/public/events` query | `listPublicEvents` | ✓ |
| Pricing filter | `discover/events.tsx` | Filter free/paid | GET `/public/events` query | `listPublicEvents` | ✓ |
| Event card link | `discover/events.tsx` | Navigate to `/events/$eventSlug` | — | — | ✓ |
| Public event detail | `events/$eventSlug.tsx` | View only (no register button for unauth) | GET `/public/events/:slug` | `getPublicEvent` | ✓ |

---

## 2. Booking — Interactive Elements

### Host Management

| Element | File | Action | API Call | Backend Handler | Works? |
|---------|------|--------|---------|----------------|--------|
| Booking event editor | `booking-event-editor.tsx` | Create/edit booking event config | POST/PATCH `/booking/events` | `createBookingEvent`/`updateBookingEvent` | ✓ |

### Client Booking Flow

| Element | File | Action | API Call | Backend Handler | Works? |
|---------|------|--------|---------|----------------|--------|
| Host directory (tab) | `my/bookings/index.tsx` | Browse available hosts | GET `/booking/events` | `listBookingEvents` | ✓ |
| My bookings (tab) | `my/bookings/index.tsx` | View own bookings | GET `/booking/bookings` | `listBookings` | ✓ |
| Host card click | `host-directory.tsx` | Navigate to host profile | — | — | ✓ |
| Slot selection | `host.$personId.tsx` | Select available time | — | — | ✓ |
| "Book" confirm button | `host.$personId.$slotId.tsx` | `createBookingMutation` | POST `/booking/bookings` | `createBooking` | ✓ |
| Location type selector | `host.$personId.$slotId.tsx` | Select video/phone/in-person | — | — | ✓ |
| Reason textarea | `host.$personId.$slotId.tsx` | Optional booking reason | — | — | ✓ |
| Confirm booking button | `my/bookings/$bookingId.tsx` | `confirmBookingMutation` | POST `.../confirm` | `confirmBooking` | ✓ |
| Reject booking button | `my/bookings/$bookingId.tsx` | `rejectBookingMutation` | POST `.../reject` | `rejectBooking` | ✓ |
| Cancel booking button | `my/bookings/$bookingId.tsx` | `cancelBookingMutation` | POST `.../cancel` | `cancelBooking` | ✓ |
| Pay invoice button | `my/bookings/$bookingId.tsx` | `payInvoiceMutation` | [linked to billing] | [billing handler] | ✓ |
| Chat thread | `my/bookings/$bookingId.tsx` | In-booking chat | WebSocket via `ChatThread` | `comms` module | ✓ |
| Video call panel | `my/bookings/$bookingId.tsx` | In-booking video | WebRTC via `VideoCallPanel` | `comms` module | ✓ |

---

## 3. Findings

| ID | Finding | Location | Severity |
|----|---------|----------|----------|
| E-INT-01 | Event form sends `status: 'published'` directly on create — bypasses the dedicated `/publish` endpoint. [CURRENT BEHAVIOR] May create events that skip publish validation. | `event-form.tsx` — `setValue('status', 'published')` | **P1** |
| E-INT-02 | Public event detail page has no "Sign in to register" CTA — dead end for unauthenticated users | `events/$eventSlug.tsx` | P2 |
| E-INT-03 | Event form `registrationFee` sends cents conversion (`* 100`) but `createEvent` handler stores raw value — potential 100x price inflation | `event-form.tsx` vs `createEvent.ts:36` — form sends `fee * 100`, handler stores `body.fee ?? body.registrationFee ?? 0` | **P1** [NEEDS MANUAL CONFIRMATION] |
| E-INT-04 | Booking detail auto-creates chat room on load — could create orphan rooms if user navigates away quickly | `my/bookings/$bookingId.tsx` | P3 |
| E-INT-05 | No confirmation dialog before cancel/reject booking — destructive actions fire immediately | `my/bookings/$bookingId.tsx` | P2 |

---

## 4. Frontend/Backend Mismatch Table

| Frontend Field | Frontend Sends | Backend Expects | Match? |
|----------------|---------------|----------------|--------|
| `title` | `string` | `body.title` | ✓ |
| `eventType` | `string` | `body.eventType` | ✓ |
| `startDate` | datetime-local string | `body.startAt ?? body.startDate` | ✓ (aliased) |
| `endDate` | datetime-local string | `body.endAt ?? body.endDate` | ✓ (aliased) |
| `location` | `string` | `body.location ?? body.locationDetails` | ✓ (aliased) |
| `registrationFee` | `number * 100` (cents) | `body.fee ?? body.registrationFee ?? 0` | [NEEDS MANUAL CONFIRMATION] |
| `capacity` | `number \| undefined` | `body.capacity` | ✓ |
| `visibility` | `'internal' \| 'network'` | `body.visibility` | ✓ |
| `creditBearing` | `boolean` | `body.creditBearing` | ✓ |
| `creditAmount` | `number` | `body.creditAmount` | ✓ |
| `cpdActivityType` | `string` | `body.cpdActivityType` | ✓ |
| `coverImageUrl` | `string \| null` | `body.coverImageUrl` | ✓ |
| `status` | `'draft' \| 'published'` | `body.status` | ✓ but see E-INT-01 |
