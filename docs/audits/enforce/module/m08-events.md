# Module Enforcement: m08-events

<!-- oli:enforce-module v2.0 | audited 2026-05-27 | spec: MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md -->

**Score: 5.8/10 — PARTIALLY COMPLIANT (capped at 6.0 by P1 findings)**

**Source directories:**
- `services/api-ts/src/handlers/events/` — 14 handler files (hand-wired routes)
- `services/api-ts/src/handlers/association:operations/` — publishEvent, completeEvent, cancelEventRegistration (TypeSpec-generated routes)
- `services/api-ts/src/handlers/booking/` — 19 handler files (TypeSpec-generated routes)

## Compliance Summary

The events module implementation is **split across two handler directories** (events/ and association:operations/) with **two separate repository classes** that target the same database tables. Core lifecycle endpoints (publish, complete, cancel registration) exist via TypeSpec routes in association:operations/, while CRUD + registration + check-in live in events/ as hand-wired routes. Zero domain events are emitted. No formal VALID_TRANSITIONS map exists for event status. The booking sub-module is significantly more mature.

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 8/10 | 0 | 0 | 2 | 1 |
| 2. Workflow Implementation | 6/10 | 0 | 1 | 2 | 0 |
| 3. Domain Term Consistency | 7/10 | 0 | 0 | 2 | 2 |
| 4. State Machine Enforcement | 5/10 | 0 | 2 | 1 | 0 |
| 5. Event Publishing | 2/10 | 0 | 2 | 1 | 0 |
| 6. Auth/Permission Enforcement | 7/10 | 0 | 1 | 1 | 1 |

**Overall: (8+6+7+5+2+7)/6 = 5.8 — capped at 6.0 (P1 present, no P0)**

## Findings

### P1 — Must Fix

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-f4a1c2e8 | State Machine | `createEvent.ts` accepts `body.status ?? 'draft'`, allowing clients to create events as `published` or `completed` directly, bypassing the spec-mandated draft-first state machine. | `events/createEvent.ts:52` | HIGH |
| EM-M08-3b7d9e0f | State Machine | No formal `VALID_TRANSITIONS` map exists for event status. Transitions are enforced ad-hoc: `publishEvent` checks `status !== 'draft'`, `completeEvent` checks `status !== 'published'`, `cancelEvent` checks individual states. No single source of truth. Unlike booking which has `BOOKING_VALID_TRANSITIONS`. | events/ + association:operations/ | HIGH |
| EM-M08-a2e5c8d1 | Event Publishing | Spec requires 5 domain events: `EventPublished`, `EventCancelled`, `EventCompleted`, `RegistrationConfirmed`, `AttendanceConfirmed`. Zero are emitted. `grep -rn` across all event handlers confirms no emit/domainEvent/EventBus calls. Only `checkIn.ts` triggers a pg-boss job (`attendance.confirmed`) which is partial coverage for one event. | events/, association:operations/ | HIGH |
| EM-M08-d9f0a3b6 | Event Publishing | `cancelEvent.ts` updates status to cancelled without: (a) counting affected registrations, (b) notifying registered members (M8-R3), (c) triggering refunds via M06. `cancelEventRegistration.ts` in association:operations does handle waitlist promotion but also emits no domain event. | `events/cancelEvent.ts`, `association:operations/cancelEventRegistration.ts` | HIGH |
| EM-M08-7c4e1a9b | Workflow | WF-054 (Event Cancellation) requires cascade: cancel event -> notify all registrants -> process refunds. `cancelEvent.ts` only does `repo.update(id, { status: 'cancelled' })`. No registration cancellation cascade, no refund trigger, no notification dispatch. | `events/cancelEvent.ts` | HIGH |
| EM-M08-b5d2f7e4 | Auth/Permission | Spec + Role Matrix grant `admin` and `super` roles event create/update/cancel permissions. Events handlers (`createEvent`, `updateEvent`, `cancelEvent`) only check `OfficerTermRepository.findActiveByPersonAndOrg()`. Platform admins without officer terms are wrongly blocked. The association:operations handlers (`publishEvent`, `completeEvent`) use `requirePosition()` which may also miss admin/super. | `events/createEvent.ts`, `events/updateEvent.ts`, `events/cancelEvent.ts` | HIGH |

### P2 — Should Fix

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-e1a3c5d7 | API Completeness | Spec `DELETE /org/:id/events/:id/register/:regId` maps to cancel registration. The actual implementation is `POST /association/events/registrations/:registrationId/cancel` in association:operations. Route shape mismatch — spec says DELETE on org-scoped path, code uses POST on association-scoped path. | API_CONTRACTS.md vs association:operations/cancelEventRegistration.ts | MEDIUM |
| EM-M08-c8b6a4f2 | API Completeness | Two repository classes target the same `event` table: `events/repos/events.repo.ts` (EventsRepository) and `association:operations/repos/events.repo.ts` (EventRepository). Different method names, different patterns (raw Drizzle vs. DatabaseRepository base class). Risk of inconsistent data access. | Two repo files | HIGH |
| EM-M08-a9d7e5c3 | Workflow | WF-057 (Waitlist Auto-Promotion): `registerForEvent.ts` in events/ sets status to `waitlisted` when at capacity but does NOT create a waitlist_entry record. `cancelEventRegistration.ts` in association:operations uses `WaitlistEntryRepository.promoteNext()`. The two flows are disconnected — registrations via events/ won't appear in the waitlist table that association:operations reads. | `events/registerForEvent.ts` vs `association:operations/cancelEventRegistration.ts` | HIGH |
| EM-M08-f6c4b2a8 | Domain Terms | Spec API uses `fee` in request body. Code maps both `body.fee` and `body.registrationFee` in create/update handlers. `startAt`/`endAt` vs `startDate`/`endDate` dual naming across spec and code. | `events/createEvent.ts`, `events/updateEvent.ts` | MEDIUM |
| EM-M08-2d8a6c0e | Event Publishing | `checkIn.ts` triggers pg-boss job `attendance.confirmed` for credit pipeline but this is not the spec-declared `AttendanceConfirmed` domain event. Downstream consumers expecting the spec contract won't receive it. Partial credit only. | `events/checkIn.ts` | MEDIUM |
| EM-M08-5e1b9d3f | Auth/Permission | `registerForEvent.ts` requires `checkActiveMembership` (active status only). Spec permission table says "All authenticated" for registration, but BR spec says "Active membership required" (BR-02). The spec note also allows Grace status members. Code blocks Grace — only `status === 'active'` passes. | `events/registerForEvent.ts`, `events/utils/membership-check.ts` | MEDIUM |

### P3 — Nice to Have

| ID | Dimension | Finding | Location | Confidence |
|----|-----------|---------|----------|------------|
| EM-M08-4f2a8d6c | API Completeness | Spec declares `GET /org/:id/events/:id/attendees` for attendee list. Code has `listAttendance.ts` which returns check-in records (not attendee profiles). Functional overlap but response shape may differ from spec contract. | `events/listAttendance.ts` | LOW |
| EM-M08-8c0e4b2a | Domain Terms | `session` appears 30+ times in event handler grep results. All are `ctx.get('session')` — auth session, not domain concept. No forbidden synonym usage detected (`meeting`, `appointment` absent). Clean. | events/ | LOW |
| EM-M08-1b9d3f5e | Domain Terms | Event type enum includes `boardMeeting` and `committeeMeeting`. These are valid eventType enum values, not forbidden synonyms. However, they use `Meeting` suffix which could cause confusion in domain discussions. | `association:operations/repos/events.schema.ts` | LOW |
| EM-M08-6d4c2b0a | Auth/Permission | Spec requires president 2FA for cancel event. No 2FA enforcement found in `cancelEvent.ts` — only officer term check. | `events/cancelEvent.ts` | LOW |

## Stabilization Plan

### Phase 1: State Machine + Auth (P1, ~2 days)
1. Create `events/utils/status-transitions.ts` with `EVENT_VALID_TRANSITIONS` map matching spec: `{draft: ['published'], published: ['cancelled', 'completed']}`. Add `isValidEventTransition()` + tests.
2. Fix `createEvent.ts`: hardcode `status: 'draft'`, remove `body.status` acceptance.
3. Fix auth in events/ handlers: add admin/super role fallback alongside officer term check. Use `requirePosition()` pattern from association:operations or add `hasMinimumRole('admin')` check.

### Phase 2: Domain Events (P1, ~2 days)
4. Add domain event emission to `publishEvent.ts`: emit `EventPublished` with `{eventId, orgId, visibility, eventType}`.
5. Add domain event emission to `completeEvent.ts`: emit `EventCompleted` with `{eventId, orgId, attendanceCount}`.
6. Add domain event emission to `cancelEvent.ts`: emit `EventCancelled` with `{eventId, orgId, affectedRegistrations}`.
7. Add `RegistrationConfirmed` emission to `registerForEvent.ts` (or association:operations equivalent).

### Phase 3: Workflow Gaps (P1+P2, ~2 days)
8. Fix `cancelEvent.ts` cascade: on cancel, fetch all confirmed registrations, bulk-cancel them, count affected, trigger refund jobs for paid events, emit cancellation notifications.
9. Fix waitlist disconnect: `registerForEvent.ts` should create waitlist_entry records when capacity exceeded, OR consolidate on association:operations flow that uses WaitlistEntryRepository.
10. Decide handler consolidation: events/ vs association:operations/ split causes confusion. Recommend migrating events/ hand-wired handlers to TypeSpec-generated routes in association:operations/.

### Phase 4: Route + Naming Cleanup (P2-P3, ~1 day)
11. Align cancel-registration route shape with spec contract (DELETE vs POST).
12. Consolidate dual repository classes into single EventRepository.
13. Normalize field naming: pick `fee`/`registrationFee` and `startAt`/`startDate`.

## Audit Scope

| Artifact | Files Read | Coverage |
|----------|-----------|----------|
| MODULE_SPEC.md | Full (22 sections) | All business rules, workflows, permissions, state machines, domain events |
| API_CONTRACTS.md | Full (5 sections) | All 10 endpoints, domain events, shared types |
| DOMAIN_MODEL.md | Sections 4a, 9, 11, 13 | Events bounded context, state machines, domain events |
| WORKFLOW_MAP.md | Section 1.8, 2.4, 5.3-5.4, 6.4 | All 7 WF-IDs, entity lifecycle, cross-module flows |
| ROLE_PERMISSION_MATRIX.md | Section 3.10 | Events module actions x roles |
| events/ handlers | 14 .ts files (non-test) | All handler, repo, util files |
| association:operations/ | publishEvent, completeEvent, cancelEventRegistration | 3 lifecycle handlers |
| booking/ handlers | File list reviewed, status-transitions.ts read | Booking state machine verified |

**Previous audit date:** Pre-2026-05-27 (scored 6.2)
**Delta:** publishEvent, completeEvent, cancelEventRegistration discovered in association:operations/ (were reported missing). Dim 1 improved 6->8. Dim 5 still critical. Overall score adjusted to 5.8 (more precise weighting).
