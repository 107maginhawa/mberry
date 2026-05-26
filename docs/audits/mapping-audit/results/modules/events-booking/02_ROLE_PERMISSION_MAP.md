# 02 — Role Permission Map Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26
**Auditor**: Claude (automated)

---

## 1. Roles Involved

| Role | Events Access | Booking Access |
|------|--------------|----------------|
| Unauthenticated | Public event listing/detail (by design) | Public slot listing (by design) |
| Member (authenticated) | Browse org events, register, view my events | Create bookings, view own bookings |
| Officer | Create/update/cancel/publish events, check-in, attendance | N/A (booking is person-to-person) |
| Host (booking) | N/A | Create booking events, manage schedule, confirm/reject bookings |
| Client (booking) | N/A | Book slots, cancel bookings, mark no-show |
| Admin | All | All |
| Support | N/A | View bookings, view schedule exceptions |

---

## 2. Events — Route-Level Auth Middleware

### CRITICAL FINDING: Most `/association/events/*` and `/association/event-lifecycle/*` routes have NO `authMiddleware()` in the generated route registration.

| Route | Method | authMiddleware? | Handler-Level Auth? | Severity |
|-------|--------|----------------|---------------------|----------|
| `/association/events` | POST (create) | **NO** | Session only, no role check | **P1** |
| `/association/events` | GET (search) | **NO** | None visible | **P1** |
| `/association/events/:eventId` | GET | **NO** | Membership check | P2 |
| `/association/events/:eventId` | PATCH (update) | **NO** | Membership check (not officer) | **P1** |
| `/association/events/:eventId` | DELETE | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/:eventId/cancel` | POST | **NO** | Membership check (not officer) | **P1** |
| `/association/events/:eventId/publish` | POST | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/:eventId/waitlist` | GET | **NO** | [NEEDS MANUAL CONFIRMATION] | P2 |
| `/association/events/:eventId/waitlist/:entryId/promote` | POST | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/registrations` | POST/GET | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/registrations/:id` | GET/PATCH/DELETE | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/registrations/:id/cancel` | POST | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/registrations/:id/refund` | POST | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/events/checkins` | POST/GET | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/event-lifecycle/my` | GET | **NO** | Session only | P2 |
| `/association/event-lifecycle/:eventId/attendance` | GET | **NO** | None visible | **P1** |
| `/association/event-lifecycle/:eventId/check-in` | POST | **NO** | Officer check in handler ✓ | P2 |
| `/association/event-lifecycle/:eventId/complete` | POST | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/event-lifecycle/:eventId/register` | POST | **NO** | Active membership check ✓ | P2 |
| `/association/event-lifecycle/:eventId/register-and-pay` | POST | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |
| `/association/event-lifecycle/:eventId/registrations` | GET | **NO** | [NEEDS MANUAL CONFIRMATION] | **P1** |

**Evidence**: `services/api-ts/src/generated/openapi/routes.ts` — event routes registered without `authMiddleware()` call, unlike booking routes which all have it.

**Note**: [CURRENT BEHAVIOR] — The lack of route-level auth does NOT necessarily mean the endpoints are unprotected. Better-Auth session middleware may exist at the app level. However, the inconsistency with booking routes (which explicitly declare `authMiddleware({ roles: [...] })`) means **role-based access is NOT enforced at the route layer** for events.

---

## 3. Events — Handler-Level Auth Analysis

| Handler | Auth Check | Role Check | Evidence |
|---------|-----------|------------|----------|
| `createEvent` | `ctx.get('session')` | **NONE** — any session user can create | `createEvent.ts:9` |
| `updateEvent` | `ctx.get('session')` + membership check | Membership only, not officer | `updateEvent.ts:17-19` |
| `cancelEvent` | `ctx.get('session')` + membership check | Membership only, not officer | `cancelEvent.ts:14-17` |
| `getEvent` | `ctx.get('session')` + membership check | Membership only | `getEvent.ts:13-16` |
| `checkIn` | `ctx.get('session')` + **officer check** ✓ | Officer via `OfficerTermRepository` | `checkIn.ts:15-21` |
| `registerForEvent` | `ctx.get('session')` + **active membership** ✓ | Active member only | `registerForEvent.ts:21-24` |
| `listAttendance` | `ctx.get('database')` only | **NONE** | `listAttendance.ts:5-9` [LIKELY BUG] |
| `listRegistrations` | `ctx.get('database')` only | **NONE** | `listRegistrations.ts:5-9` [LIKELY BUG] |
| `bulkCreateEventSeries` | `ctx.get('session')` | **NONE** — any session user can create series | `bulkCreateEventSeries.ts:12` |
| `getPublicEvent` | None (public) | None (by design) | `getPublicEvent.ts` |
| `listPublicEvents` | None (public) | None (by design) | `listPublicEvents.ts` |
| `serveEventOgMeta` | None (public) | None (by design) | `serveEventOgMeta.ts` |

### P1 Findings

| ID | Finding | Evidence | Severity |
|----|---------|----------|----------|
| E-PERM-01 | `createEvent` has no officer/role check — any authenticated user in any org can create events | `createEvent.ts` — only reads `session`, no role validation | **P1** |
| E-PERM-02 | `updateEvent` checks membership but not officer role — any member can edit any event in their org | `updateEvent.ts:17-19` | **P1** |
| E-PERM-03 | `cancelEvent` checks membership but not officer role — any member can cancel any event | `cancelEvent.ts:14-17` | **P1** |
| E-PERM-04 | `listAttendance` has ZERO auth/permission checks — any request with DB access can read attendance | `listAttendance.ts:5-9` | **P1** |
| E-PERM-05 | `listRegistrations` has ZERO auth/permission checks — any request can read registrations | `listRegistrations.ts:5-9` | **P1** |
| E-PERM-06 | `bulkCreateEventSeries` has no officer check — any session user can bulk-create events | `bulkCreateEventSeries.ts:12` | **P1** |

---

## 4. Booking — Route-Level Auth Middleware

All booking routes have proper `authMiddleware()` with role-based access:

| Route | Method | Roles | Handler Ownership Check |
|-------|--------|-------|------------------------|
| `/booking/bookings` | POST | `["user"]` | Client = self | 
| `/booking/bookings` | GET | `["client:owner", "host:owner", "admin", "support"]` | Filtered by role |
| `/booking/bookings/:booking` | GET | `["client:owner", "host:owner", "admin", "support"]` | `checkBookingOwnership()` ✓ |
| `/booking/bookings/:booking/cancel` | POST | `["client:owner", "host:owner", "admin"]` | `getBookingUserType()` ✓ |
| `/booking/bookings/:booking/confirm` | POST | `["host:owner", "admin"]` | `checkBookingHostOwnership()` ✓ |
| `/booking/bookings/:booking/reject` | POST | `["host:owner", "admin"]` | `checkBookingHostOwnership()` ✓ |
| `/booking/bookings/:booking/no-show` | POST | `["client:owner", "host:owner", "admin"]` | `getBookingUserType()` ✓ |
| `/booking/events` | POST | auth required | Ownership = self |
| `/booking/events/:event` | PATCH | `["event:owner", "admin"]` | `event.owner !== user.id` ✓ |
| `/booking/events/:event` | DELETE | `["event:owner", "admin"]` | `event.owner !== user.id` ✓ |
| `/booking/events/:event/exceptions` | POST | `["event:owner", "admin"]` | Event ownership ✓ |
| `/booking/events/:event/exceptions` | GET | `["event:owner", "admin", "support"]` | — |
| `/booking/events/:event/exceptions/:id` | GET | `["event:owner", "admin", "support"]` | — |
| `/booking/events/:event/exceptions/:id` | DELETE | `["event:owner", "admin"]` | Exception ownership ✓ |
| `/booking/slots/:slotId` | GET | None (public) | By design |
| `/booking/events/:event/slots` | GET | None (public) | By design |
| `/booking/events` | GET | None (public) | By design |
| `/booking/events/:event` | GET | None (public) | By design |

**Booking permission model is STRONG.** Two-layer enforcement: route middleware + handler ownership.

---

## 5. Permission Test Coverage

| Permission Rule | Backend Test? | E2E Test? | Quality |
|----------------|--------------|-----------|---------|
| Officer-only check-in | `checkIn.test.ts` | `officer/event-checkin.spec.ts` | STRONG |
| Active member registration | `registerForEvent.test.ts` | `member/events.spec.ts` | STRONG |
| Paid event payment gate | `paid-events.test.ts` | `event-registration-payment.spec.ts` | STRONG |
| Member-only event update | NONE | NONE | **NONE** [P1] |
| Member-only event cancel | NONE | NONE | **NONE** [P1] |
| listAttendance open access | NONE | NONE | **NONE** [P1] |
| listRegistrations open access | NONE | NONE | **NONE** [P1] |
| Booking host ownership | `booking.repo.test.ts` | NONE | WEAK |
| Booking client cancellation | `cancelBooking.test.ts` | NONE | WEAK |
| Booking host confirm/reject | `confirmBooking.test.ts`, `rejectBooking.test.ts` | NONE | WEAK |
| No-show timing rules | `markNoShowBooking.test.ts` | NONE | WEAK |

---

## 6. Summary

| Area | Route Auth | Handler Auth | Permission Tests | Overall |
|------|-----------|-------------|-----------------|---------|
| Events (association) | **MISSING** (no authMiddleware) | Partial (officer check-in good, rest weak) | Partial | **WEAK** |
| Events (public) | N/A (public by design) | N/A | N/A | OK |
| Booking | **STRONG** (all routes have role middleware) | **STRONG** (ownership checks) | WEAK (backend only, no E2E) | **GOOD** |
