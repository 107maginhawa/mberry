# Module 7: Events/Booking — Audit Summary

**Date**: 2026-05-26
**Confidence Score**: 5.8/10
**P0 Findings**: 0
**P1 Findings**: 18
**P2 Findings**: 9
**P3 Findings**: 2

---

## P1 Findings (18)

| ID | Finding | Area |
|----|---------|------|
| E-PERM-01 | `createEvent` has no officer/role check — any authenticated user can create events | Auth |
| E-PERM-02 | `updateEvent` checks membership but not officer role — any member can edit events | Auth |
| E-PERM-03 | `cancelEvent` checks membership but not officer role — any member can cancel events | Auth |
| E-PERM-04 | `listAttendance` has ZERO auth/permission checks | Auth |
| E-PERM-05 | `listRegistrations` has ZERO auth/permission checks | Auth |
| E-PERM-06 | `bulkCreateEventSeries` has no officer check | Auth |
| E-INT-01 | Event form sends `status: 'published'` directly on create — bypasses publish endpoint | Frontend |
| E-INT-03 | `registrationFee` cents conversion mismatch between frontend and backend | Frontend/Backend |
| E-API-02 | Events handlers use `ctx.req.json()` instead of `ctx.req.valid('json')` — Zod validators ignored | Backend |
| E-NAV-06 | Zero E2E for booking client flow (browse→book→confirm) | E2E Gap |
| E-NAV-07 | Zero E2E for booking host actions (confirm/reject/cancel) | E2E Gap |
| E-J-01 | Event cancellation journey has no E2E coverage | E2E Gap |
| E-J-02 | Event registration cancellation has no E2E coverage | E2E Gap |
| E-J-03 | No role denial tests for event CRUD operations | Test Gap |
| E-J-04 | `listAttendance`/`listRegistrations` open access untested | Test Gap |
| E-J-05 | Booking module has complete E2E gap (0 test files) | E2E Gap |
| E-J-06 | Officer event create+publish E2E is WEAK (page-load only) | E2E Quality |
| E-J-07 | Officer check-in E2E is WEAK (page-load only) | E2E Quality |

## P2 Findings (9)

| ID | Finding | Area |
|----|---------|------|
| E-NAV-01 | No admin app pages for events | Navigation |
| E-NAV-02 | No admin app pages for bookings | Navigation |
| E-NAV-04 | Public event page has no "sign in to register" CTA | UX |
| E-INT-02 | Public event detail is dead end for unauthenticated users | UX |
| E-INT-05 | No confirmation dialog before cancel/reject booking | UX |
| E-FORM-01 | Backend `createEvent` has no title/description length validation | Validation |
| E-FORM-02 | `creditAmount` 0.5-increment validation only on backend | Validation |
| E-API-01 | Dual route families for events (confusion) | Architecture |
| E-API-03 | `listAttendance`/`listRegistrations` no pagination | Performance |

## Product Decisions Needed

1. Should event CRUD require officer role or just org membership?
2. Should `listAttendance`/`listRegistrations` be auth-protected?
3. Is dual event route system intentional?

## Key Architecture Notes

- **Events auth model is WEAK**: No route-level auth middleware, handler-level checks are membership-only (not officer)
- **Booking auth model is STRONG**: Two-layer enforcement (route middleware + handler ownership)
- **Events have 23 backend test files** but missing role denial coverage
- **Booking has 23 backend test files** but zero E2E coverage
- **11 contract test files** (Hurl) across both modules — good
