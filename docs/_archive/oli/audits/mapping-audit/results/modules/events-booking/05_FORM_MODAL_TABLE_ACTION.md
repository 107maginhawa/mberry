# 05 — Form / Modal / Table Action Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26

---

## 1. Forms

### Event Form (`event-form.tsx`)

| Field | Zod Validation | Backend Validation | Match? |
|-------|---------------|-------------------|--------|
| `title` | `z.string().min(1)` | None (raw `body.title`) | Partial — frontend validates, backend trusts |
| `eventType` | `z.string().min(1)` | Defaults to `'other'` | ✓ |
| `description` | `z.string().optional()` | None | ✓ |
| `startDate` | `z.string().min(1)` | `new Date(body.startAt ?? body.startDate)` | ✓ |
| `endDate` | `z.string().min(1)` | `new Date(body.endAt ?? body.endDate)` | ✓ |
| `location` | `z.string().optional()` | None | ✓ |
| `registrationFee` | `z.number().min(0).optional()` | Stored as-is (`body.fee ?? body.registrationFee ?? 0`) | [NEEDS MANUAL CONFIRMATION] — cents conversion |
| `capacity` | `z.number().min(1).optional()` | None (stored directly) | ✓ |
| `visibility` | `z.string()` (via Select) | Stored directly | ✓ |
| `creditBearing` | `z.boolean()` | Defaults to `false` | ✓ |
| `creditAmount` | `z.number().min(0).max(40)` | Backend: `> 40` rejects, `0.5 increment` check | ✓ |
| `cpdActivityType` | `z.string().optional()` | Stored directly | ✓ |
| `coverImageUrl` | `z.string().optional()` | Stored directly | ✓ |
| `status` | Set programmatically (`'draft'` or `'published'`) | Stored directly on create; blocked on update | See E-INT-01 |

**Finding E-FORM-01 (P2)**: Backend `createEvent` has NO validation on `title` length, `description` length, or `eventType` enum values. Frontend Zod catches `min(1)` but backend accepts anything.

**Finding E-FORM-02 (P2)**: `creditAmount` validation differs slightly — frontend uses `z.number().min(0).max(40)`, backend checks `> 40` (not `>=`) and `0.5 increment` check. Frontend has no increment validation.

### Booking Slot Confirmation (`host.$personId.$slotId.tsx`)

| Field | Frontend Validation | Backend Validation | Match? |
|-------|-------------------|-------------------|--------|
| `slot` (slotId) | Required (from URL param) | Validated via `CreateBookingBody` Zod | ✓ |
| `locationType` | Required (radio selection) | Validated via Zod enum | ✓ |
| `reason` | Optional textarea | None visible | ✓ |

### Cancel/Reject Booking (inline in `$bookingId.tsx`)

| Field | Frontend Validation | Backend Validation | Match? |
|-------|-------------------|-------------------|--------|
| `reason` (cancel) | [NEEDS MANUAL CONFIRMATION] | Required, max 500 chars | [NEEDS MANUAL CONFIRMATION] |
| `reason` (reject) | [NEEDS MANUAL CONFIRMATION] | Optional, max 500 chars | [NEEDS MANUAL CONFIRMATION] |

---

## 2. Modals / Confirmation Dialogs

| Action | Has Confirmation? | Evidence |
|--------|------------------|----------|
| Create event (save draft) | No — immediate submit | `event-form.tsx` |
| Publish event (from form) | No — immediate submit | `event-form.tsx` — `setValue('status', 'published')` |
| Cancel event | [NEEDS MANUAL CONFIRMATION] | Officer event detail page |
| Delete event | [NEEDS MANUAL CONFIRMATION] | Officer event detail page |
| Register for event | No — single click | `events/$eventId.tsx` — `registerMutation.mutate()` |
| Cancel registration | [NEEDS MANUAL CONFIRMATION] | `events/$eventId.tsx` |
| Cancel booking | **No** — immediate fire | `my/bookings/$bookingId.tsx` [P2] |
| Reject booking | **No** — immediate fire | `my/bookings/$bookingId.tsx` [P2] |
| Confirm booking | No — immediate (non-destructive) | `my/bookings/$bookingId.tsx` |
| Mark no-show | [NEEDS MANUAL CONFIRMATION] | `my/bookings/$bookingId.tsx` |

**Finding E-MODAL-01 (P2)**: Booking cancel and reject are destructive actions with no confirmation dialog. Reject releases the slot permanently.

---

## 3. Tables / Lists

### Officer Event List (`event-list.tsx`)

| Column | Sortable? | Filterable? | Action | Evidence |
|--------|----------|------------|--------|----------|
| Event title | [NEEDS MANUAL CONFIRMATION] | Via search | Link to detail | `event-list.tsx` |
| Date | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | — | — |
| Status | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] | Badge display | — |

### Officer Attendance Table (`attendance.tsx`)

| Column | Sortable? | Action | Evidence |
|--------|----------|--------|----------|
| Attendee name | [NEEDS MANUAL CONFIRMATION] | — | `attendance-view.tsx` |
| Check-in time | [NEEDS MANUAL CONFIRMATION] | — | — |
| Method (QR/manual) | [NEEDS MANUAL CONFIRMATION] | — | — |

### Member Event Grid

Uses `EventCard` in `StaggerGrid` — not a table but a card grid with:
- Event card click → navigate to detail
- No bulk actions
- Filter by type + search

### Booking List (`booking-list.tsx`)

| Column | Action | Evidence |
|--------|--------|----------|
| Booking card | Link to detail | `booking-list.tsx` |

### Host Directory (`host-directory.tsx`)

| Element | Action | Evidence |
|---------|--------|----------|
| Host card | Navigate to host profile | `host-directory.tsx` |

---

## 4. Findings Summary

| ID | Finding | Location | Severity |
|----|---------|----------|----------|
| E-FORM-01 | Backend `createEvent` has no validation on title/description length or eventType enum | `createEvent.ts` | P2 |
| E-FORM-02 | `creditAmount` 0.5-increment validation exists only on backend, not frontend | `event-form.tsx` vs `createEvent.ts` | P2 |
| E-MODAL-01 | Booking cancel/reject have no confirmation dialog | `my/bookings/$bookingId.tsx` | P2 |
| E-FORM-03 | Cancel booking reason validation mismatch — backend requires reason + 500 char limit, frontend may not enforce | `cancelBooking.ts` vs frontend | [NEEDS MANUAL CONFIRMATION] P2 |
