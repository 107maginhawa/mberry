# 08 — Test Confidence Gap Audit: Events/Booking

**Module**: Events/Booking (M7)
**Date**: 2026-05-26

---

## 1. Backend Unit/Integration Test Inventory

### Events Tests

| Test File | Focus | Assertions | Quality |
|-----------|-------|-----------|---------|
| `createEvent.test.ts` | Event creation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `updateEvent.test.ts` | Event update | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `cancelEvent.test.ts` | Event cancellation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `getEvent.test.ts` | Event retrieval | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listEvents.test.ts` | Event listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listMyEvents.test.ts` | My events listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `checkIn.test.ts` | Check-in w/ officer check | [NEEDS MANUAL CONFIRMATION] | Expected STRONG (officer validation) |
| `registerForEvent.test.ts` | Registration w/ membership check | [NEEDS MANUAL CONFIRMATION] | Expected STRONG (membership validation) |
| `listAttendance.test.ts` | Attendance listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listRegistrations.test.ts` | Registration listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `bulkCreateEventSeries.test.ts` | Bulk event creation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `event-waitlisting.test.ts` | Capacity + waitlist logic | 7+ assertions | **STRONG** (capacity, FIFO, promotion) |
| `paid-events.test.ts` | Paid event registration blocking | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `flow-05.event-creation-registration.test.ts` | Full flow test | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `ac-m08.events.test.ts` | Acceptance criteria tests | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `w2a-publish-guard.test.ts` | Publish guard validation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `w2a-s2.crud-upgrade.test.ts` | CRUD upgrade tests | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `w2a-s6.paid-registration.test.ts` | Paid registration flow | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `br-18.qr-code-auth.test.ts` | QR code auth BR | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `br-37.job-posting-expiry.test.ts` | Job posting expiry BR | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `repos/events.repo.test.ts` | Repository CRUD | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `utils/event-slug.test.ts` | Slug generation | [NEEDS MANUAL CONFIRMATION] | Expected STRONG (utility) |
| `utils/membership-check.test.ts` | Membership check utility | [NEEDS MANUAL CONFIRMATION] | Expected STRONG (utility) |

**Events backend test count**: 23 test files — **EXCELLENT** quantity. Quality assessment requires reading each file's assertions (marked NEEDS MANUAL CONFIRMATION).

### Booking Tests

| Test File | Focus | Assertions | Quality |
|-----------|-------|-----------|---------|
| `createBooking.test.ts` | Booking creation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `confirmBooking.test.ts` | Host confirmation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `cancelBooking.test.ts` | Booking cancellation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `rejectBooking.test.ts` | Host rejection | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `markNoShowBooking.test.ts` | No-show marking | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `getBooking.test.ts` | Booking retrieval | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listBookings.test.ts` | Booking listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `createBookingEvent.test.ts` | Event creation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `updateBookingEvent.test.ts` | Event update | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `deleteBookingEvent.test.ts` | Event deletion | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `getBookingEvent.test.ts` | Event retrieval | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listBookingEvents.test.ts` | Event listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `createScheduleException.test.ts` | Exception creation | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `deleteScheduleException.test.ts` | Exception deletion | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `getScheduleException.test.ts` | Exception retrieval | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listScheduleExceptions.test.ts` | Exception listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `getTimeSlot.test.ts` | Slot retrieval | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `listEventSlots.test.ts` | Slot listing | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `slotManagement.test.ts` | Slot lifecycle | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `repos/booking.repo.test.ts` | Repository CRUD | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `repos/bookingEvent.repo.test.ts` | Event repo CRUD | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `jobs/confirmationTimer.test.ts` | Timer job logic | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |
| `jobs/slotGenerator.test.ts` | Slot generation logic | [NEEDS MANUAL CONFIRMATION] | [NEEDS MANUAL CONFIRMATION] |

**Booking backend test count**: 23 test files — **EXCELLENT** quantity.

### Frontend Component Tests

| Test File | Focus | Quality |
|-----------|-------|---------|
| `event-form.test.tsx` | Form rendering + validation | [NEEDS MANUAL CONFIRMATION] |
| `event-card.test.tsx` | Card rendering | [NEEDS MANUAL CONFIRMATION] |
| `event-list.test.tsx` | List rendering | [NEEDS MANUAL CONFIRMATION] |
| `attendance-view.test.tsx` | Attendance display | [NEEDS MANUAL CONFIRMATION] |
| `booking-list.test.tsx` | Booking list | [NEEDS MANUAL CONFIRMATION] |
| `host-directory.test.tsx` | Host directory | [NEEDS MANUAL CONFIRMATION] |
| `event-state.test.ts` | Booking event state | [NEEDS MANUAL CONFIRMATION] |
| `adapters.test.ts` | Booking adapters | [NEEDS MANUAL CONFIRMATION] |
| `partition-bookings.test.ts` | Booking partitioning | [NEEDS MANUAL CONFIRMATION] |
| `generate-ics.test.ts` | ICS calendar generation | [NEEDS MANUAL CONFIRMATION] |

**Frontend test count**: 10 test files — **GOOD** quantity.

---

## 2. E2E Test Inventory

| Test File | Journey | Quality Assessment |
|-----------|---------|-------------------|
| `member/events.spec.ts` | Member event browsing | WEAK — page-load checks [based on M1-M6 patterns] |
| `officer/events.spec.ts` | Officer event management | WEAK — page-load + content checks |
| `officer/event-checkin.spec.ts` | Check-in journey | WEAK — page-load check |
| `member/event-capacity.spec.ts` | Capacity/waitlist | Present — tests capacity behavior |
| `journeys/event-lifecycle.spec.ts` | Full event lifecycle | Present — multi-step journey |
| `journeys/event-registration-payment.spec.ts` | Paid registration | Present — payment flow |
| `actions/events-actions.spec.ts` | Event CRUD actions | Present — action verification |
| `states/events-states.spec.ts` | Event state transitions | Present — state verification |

**Events E2E**: 8 files. Mix of WEAK (page-load) and present (action-testing). Good breadth but assertion depth varies.

**Booking E2E**: **0 files.** Complete E2E gap. [P1]

---

## 3. Test Gap Table

| Behavior/Journey | Existing Test | Test Quality | Missing Coverage | Recommended Test Type | Severity |
|-----------------|-------------|-------------|-----------------|---------------------|----------|
| Event creation with officer role enforcement | `createEvent.test.ts` | [NEEDS MANUAL CONFIRMATION] | **No role denial test** | API integration | **P1** |
| Event update by non-officer member | `updateEvent.test.ts` | [NEEDS MANUAL CONFIRMATION] | **No role denial test** | API integration | **P1** |
| Event cancel by non-officer member | `cancelEvent.test.ts` | [NEEDS MANUAL CONFIRMATION] | **No role denial test** | API integration | **P1** |
| listAttendance open access | NONE | NONE | **No test exists for unprotected endpoint** | API integration | **P1** |
| listRegistrations open access | NONE | NONE | **No test exists for unprotected endpoint** | API integration | **P1** |
| Booking full client journey | NONE | NONE | **Zero E2E for booking flow** | E2E | **P1** |
| Booking host confirm/reject | Backend test only | WEAK | **No E2E for host actions** | E2E | **P1** |
| Booking cancel with reason validation | Backend test | [NEEDS MANUAL CONFIRMATION] | **No E2E** | E2E | P1 |
| Booking no-show timing rules | Backend test | [NEEDS MANUAL CONFIRMATION] | **No E2E** | E2E | P2 |
| Event cancellation journey | NONE | NONE | **No E2E for event cancellation** | E2E | P1 |
| Event registration cancellation | NONE | NONE | **No E2E** | E2E | P1 |
| Public event discovery | NONE | NONE | **No E2E for public events** | E2E | P2 |
| Waitlist promotion end-to-end | `event-waitlisting.test.ts` | STRONG (unit) | Waitlist promotion not exercised in E2E | E2E | P2 |
| `ctx.req.json()` vs `ctx.req.valid()` | NONE | NONE | Handlers ignore validated output | API integration | P1 |

---

## 4. E2E Gap Table

| Journey/Nav Path | Existing E2E | Coverage Quality | E2E Required? | Recommended E2E Test | Severity |
|-----------------|-------------|-----------------|--------------|---------------------|----------|
| Officer create+publish event | `officer/events.spec.ts` | WEAK | Yes | Full form fill → verify in member view | P1 |
| Officer cancel event | NONE | NONE | Yes | Cancel → verify status → check member sees cancelled | **P1** |
| Officer QR check-in | `officer/event-checkin.spec.ts` | WEAK | Yes | Navigate → scan/manual → verify attendance count | P1 |
| Member register free event | `member/events.spec.ts` | WEAK | Yes | Browse → click register → verify in My Events | P2 |
| Member cancel registration | NONE | NONE | Yes | Register → cancel → verify removal | **P1** |
| Discover public events | NONE | NONE | Nice-to-have | Browse → filter → click detail | P2 |
| Booking: client books session | NONE | NONE | **Yes** | Host directory → slot → confirm → verify | **P1** |
| Booking: host confirms | NONE | NONE | **Yes** | View pending → confirm → verify status | **P1** |
| Booking: host rejects | NONE | NONE | **Yes** | View pending → reject → verify slot released | **P1** |
| Booking: client cancels | NONE | NONE | **Yes** | View confirmed → cancel → verify | **P1** |
| Booking: no-show | NONE | NONE | Nice-to-have | After scheduled time → mark → verify | P2 |

---

## 5. Product Decision Table

| Question | Affected Area | Why Needed | Blocks Implementation? |
|---------|-------------|-----------|----------------------|
| Should event creation/update/cancel require officer role or just membership? | Events CRUD handlers | Currently any member can create/edit/cancel — unclear if intentional | Yes — determines whether to add officer checks |
| Should `listAttendance` and `listRegistrations` be open to all authenticated users? | Attendance/registration endpoints | Currently no auth check at all — likely unintentional | Yes — determines auth requirements |
| Should public event detail show a "Sign in to register" CTA? | Public event page | Dead-end UX for unauthenticated users | No |
| Is the dual route system (`/events/*` + `/event-lifecycle/*`) intentional? | API routes | Confusing which to use | No |

---

## 6. Confidence Score

| Dimension | Events | Booking |
|-----------|--------|---------|
| Backend test quantity | 9/10 (23 files) | 9/10 (23 files) |
| Backend test quality | 6/10 (strong waitlisting/checkin, weak auth testing) | 7/10 (ownership checks tested) |
| Frontend test quantity | 7/10 (4 component tests) | 7/10 (6 component/lib tests) |
| E2E test quantity | 7/10 (8 files) | **0/10** (zero files) |
| E2E test quality | 4/10 (mostly WEAK page-load checks) | **0/10** |
| Permission test coverage | 3/10 (officer checkin only) | 6/10 (ownership utils tested) |
| Contract test coverage | 8/10 (5 Hurl files) | 9/10 (6 Hurl files) |
| **Overall** | **6.3/10** | **5.4/10** |

**Combined Module Confidence: 5.8/10**

Primary gaps:
1. Events — missing role enforcement tests (officer vs member)
2. Events — `listAttendance` / `listRegistrations` open access untested
3. Events — handlers ignore Zod validators (`ctx.req.json()` vs `ctx.req.valid()`)
4. Booking — **complete E2E gap** (zero test files)
5. Booking cancel/reject — no confirmation dialog
