# 07 — Role-Based Journey Map Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26

---

## 1. Events — Officer Journeys

### J-EV-01: Officer Creates and Publishes Event

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. Navigate to officer events | `/org/$orgSlug/officer/events` | — | Officer layout guard | E2E: WEAK |
| 2. Click "Create Event" | Navigate to `/officer/events/new` | — | — | — |
| 3. Fill event form | `event-form.tsx` | — | — | Component test: `event-form.test.tsx` |
| 4. Click "Publish" | Submit with `status: 'published'` | POST `/association/events` | **No officer check in handler** [P1] | Backend: `createEvent.test.ts` |
| 5. View created event | Navigate to detail | GET `/association/events/:eventId` | Membership check only | — |

**Journey Risk**: Any authenticated member can create and publish events via API — officer layout guard is frontend-only. [P1]

### J-EV-02: Officer Manages Attendance (QR Check-in)

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. Navigate to event attendance | `/officer/events/$eventId/attendance` | — | Officer layout | E2E: `event-checkin.spec.ts` WEAK |
| 2. Open QR scanner | Camera modal | — | — | — |
| 3. Scan member QR | Submit check-in | POST `.../check-in` | **Officer check ✓** | Backend: `checkIn.test.ts` STRONG |
| 4. View updated attendance | Refresh list | GET `.../attendance` | **No auth check** [P1] | — |

**Journey Risk**: Check-in itself is properly guarded. Attendance viewing is not. Mixed.

### J-EV-03: Officer Cancels Event

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. View event detail | `/officer/events/$eventId` | GET event | Membership check | — |
| 2. Click cancel | [NEEDS MANUAL CONFIRMATION] | POST `.../cancel` | Membership only, not officer [P1] | Backend: `cancelEvent.test.ts` |

**Journey Risk**: Any member of the org can cancel events via API.

---

## 2. Events — Member Journeys

### J-EV-04: Member Registers for Free Event

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. Browse events | `/org/$orgSlug/events` | GET `/association/events` | Session | E2E: `member/events.spec.ts` |
| 2. Click event card | Navigate to detail | — | — | — |
| 3. Click "Register" | `registerForCustomEventMutation` | POST `.../register` | **Active membership ✓** | Backend: `registerForEvent.test.ts` STRONG |
| 4. See confirmation | Toast + state update | — | — | — |

**Journey Status**: STRONG auth enforcement. Well tested.

### J-EV-05: Member Registers for Paid Event

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1-2. Same as J-EV-04 | — | — | — | — |
| 3. Click "Register & Pay" | `registerAndPayForEventMutation` | POST `.../register-and-pay` | [NEEDS MANUAL CONFIRMATION] | E2E: `event-registration-payment.spec.ts` |
| 4. Payment flow | Stripe redirect or inline | Billing module | — | — |

### J-EV-06: Member Views My Events

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. Navigate to My Events | `/my/events` | GET `/association/event-lifecycle/my` | Session | E2E: `states/events-states.spec.ts` |
| 2. View registered events | List display | — | — | — |
| 3. Click event | Navigate to detail | — | — | — |

### J-EV-07: Event Cancellation by Member [UNCOVERED]

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. View event detail | `/org/$orgSlug/events/$eventId` | GET event | — | — |
| 2. Click "Cancel Registration" | `cancelEventRegistrationMutation` | POST `.../cancel` | [NEEDS MANUAL CONFIRMATION] | **NONE** [E2E GAP] |

---

## 3. Events — Public Journeys

### J-EV-08: Unauthenticated User Discovers Events

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. Navigate to discover | `/discover/events` | GET `/public/events` | None (public) | **NONE** [E2E GAP] |
| 2. Filter/search | Query params | — | — | — |
| 3. Click event card | `/events/$eventSlug` | GET `/public/events/:slug` | None (public) | — |
| 4. **Dead end** — no register CTA | — | — | — | — |

**Journey Risk**: User discovers event but cannot register without auth. No guidance to sign in. [P2]

---

## 4. Booking — Client Journeys

### J-BK-01: Client Books a Session [CROSS-MODULE JOURNEY]

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. Navigate to bookings | `/my/bookings` | — | Auth layout | **NONE** [E2E GAP] |
| 2. Browse host directory | HostDirectory tab | GET `/booking/events` | Public | — |
| 3. Click host | Navigate to `/my/bookings/host.$personId` | GET `/booking/events/:event` | Public | — |
| 4. Select time slot | Slot list | GET `/booking/events/:event/slots` | Public | — |
| 5. Confirm booking | `/my/bookings/host.$personId.$slotId` | POST `/booking/bookings` | `authMiddleware(["user"])` ✓ | — |
| 6. View booking detail | `/my/bookings/$bookingId` | GET `/booking/bookings/:booking` | Ownership ✓ | — |

**Journey Status**: Auth is properly enforced. ZERO E2E coverage. [P1]

### J-BK-02: Host Confirms Booking

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. View booking detail | `/my/bookings/$bookingId` | GET booking | Ownership ✓ | — |
| 2. Click "Confirm" | `confirmBookingMutation` | POST `.../confirm` | `authMiddleware(["host:owner", "admin"])` ✓ | Backend: `confirmBooking.test.ts` |
| 3. Status updates | — | — | — | — |

**Journey Status**: ZERO E2E coverage. [P1]

### J-BK-03: Booking Cancellation

| Step | Route/Action | API | Auth Enforced? | Test? |
|------|-------------|-----|---------------|-------|
| 1. View booking | `/my/bookings/$bookingId` | GET booking | Ownership ✓ | — |
| 2. Click "Cancel" | `cancelBookingMutation` | POST `.../cancel` | `authMiddleware(["client:owner", "host:owner", "admin"])` ✓ | Backend: `cancelBooking.test.ts` |
| 3. Reason required | Body validation | — | Backend validates ✓ | — |

**Journey Status**: Well-authorized. No confirmation dialog. ZERO E2E. [P1]

---

## 5. E2E Journey Coverage Table

| Journey | Role | Start Route | Existing E2E | Coverage Quality | Severity |
|---------|------|------------|-------------|-----------------|----------|
| J-EV-01: Create+Publish Event | Officer | `/officer/events/new` | `officer/events.spec.ts` | WEAK (page-load check) | P1 |
| J-EV-02: QR Check-in | Officer | `/officer/events/$id/attendance` | `officer/event-checkin.spec.ts` | WEAK (page-load check) | P1 |
| J-EV-03: Cancel Event | Officer | `/officer/events/$id` | NONE | **NONE** [E2E GAP] | P1 |
| J-EV-04: Register Free Event | Member | `/org/$slug/events/$id` | `member/events.spec.ts` | WEAK | P2 |
| J-EV-05: Register Paid Event | Member | `/org/$slug/events/$id` | `event-registration-payment.spec.ts` | Present | P2 |
| J-EV-06: My Events | Member | `/my/events` | `states/events-states.spec.ts` | WEAK | P2 |
| J-EV-07: Cancel Registration | Member | `/org/$slug/events/$id` | NONE | **NONE** [E2E GAP] | P1 |
| J-EV-08: Discover Events | Unauth | `/discover/events` | NONE | **NONE** [E2E GAP] | P2 |
| J-BK-01: Book Session | Client | `/my/bookings` | NONE | **NONE** [E2E GAP] | **P1** |
| J-BK-02: Host Confirms | Host | `/my/bookings/$id` | NONE | **NONE** [E2E GAP] | **P1** |
| J-BK-03: Cancel Booking | Client/Host | `/my/bookings/$id` | NONE | **NONE** [E2E GAP] | **P1** |

---

## 6. E2E Framework Assessment

| Module/Area | E2E Framework Found? | Existing E2E Tests | Critical Journeys Needing E2E | Navigation Smoke Coverage | Role Access E2E Coverage | Gap Severity |
|------------|---------------------|-------------------|------------------------------|--------------------------|-------------------------|-------------|
| Events | Playwright ✓ | 8 test files | Cancel event, cancel registration, discover | Partial (officer+member pages) | NONE (no role denial tests) | **P1** |
| Booking | Playwright ✓ | **0 test files** | Book session, confirm, cancel, no-show | **NONE** | **NONE** | **P1** |
