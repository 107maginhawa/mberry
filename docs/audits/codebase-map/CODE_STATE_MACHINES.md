---
oli-version: "1.0"
last-modified: 2026-05-30T12:00:00.000Z
last-modified-by: oli-codebase-map
---

# Code State Machines

Detected: 18 (3 useState_union + 15 transition_map; 12 of the 15 wired into mutator call sites this cycle via Wave G1)

<!-- oli:regen:fsm-table:begin -->
| FSM | Module | Method | States | Wired Call Sites |
|---|---|---|---|---|
| events/index.tsx | app-admin | useState_union | details, registrations | n/a (UI tab) |
| dues-config-form.tsx | app-memberry | useState_union | annual, semi-annual, quarterly | n/a (UI radio) |
| application-list.tsx | app-memberry | useState_union | date, name | n/a (UI sort) |
| MEMBERSHIP_VALID_TRANSITIONS | membership | transition_map | pendingPayment, active, gracePeriod, lapsed, expired, suspended, removed, resigned, deceased, expelled | terminateMembership.ts, updateMember.ts |
| BOOKING_VALID_TRANSITIONS | booking | transition_map | pending, confirmed, rejected, cancelled, completed, no_show_client, no_show_host | rejectBooking.ts, booking.repo.ts (confirm/cancel/markAsNoShow) |
| INVOICE_VALID_TRANSITIONS | association:member | transition_map | generated, sent, paid, overdue, cancelled, writtenOff | dues.repo.ts (markPaid), deleteDuesInvoice.ts |
| DUES_PAYMENT_VALID_TRANSITIONS | dues | transition_map | pending, submitted, underReview, confirmed, completed, partiallyRefunded, failed, rejected, refunded, expired | dues-payments.repo.ts |
| EMAIL_QUEUE_VALID_TRANSITIONS | email | transition_map | pending, processing, sent, failed, cancelled | queue.repo.ts (markAsProcessing/Sent/Failed, cancelEmail, retryEmail) |
| MARKETPLACE_VENDOR_VALID_TRANSITIONS | marketplace | transition_map | pending, verified, suspended, rejected | verifyVendor.ts, vendor.repo.ts |
| MARKETPLACE_ORDER_VALID_TRANSITIONS | marketplace | transition_map | pending, confirmed, fulfilled, cancelled, refunded | fulfillOrder.ts |
| TRAINING_VALID_TRANSITIONS | association:operations | transition_map | draft, published, completed, cancelled | publishTraining.ts |
| TRAINING_ENROLLMENT_VALID_TRANSITIONS | association:operations | transition_map | enrolled, completed, cancelled, noShow | completeTrainingEnrollment.ts, updateTrainingEnrollment.ts |
| ELECTION_VALID_TRANSITIONS | elections | transition_map | draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled | updateElectionStatus.ts |
| BOOKING_EVENT_VALID_TRANSITIONS | booking | transition_map | draft, active, paused, archived | (defined; not wired into mutators) |
| FEED_POST_VALID_TRANSITIONS | communication | transition_map | draft, published, flagged, removed | (defined; not wired into mutators) |
| MARKETPLACE_LISTING_VALID_TRANSITIONS | marketplace | transition_map | draft, active, archived | (defined; not wired into mutators) |
| LICENSE_VALID_TRANSITIONS | association:member | transition_map | pending, active, expired, suspended, revoked | (defined; not wired into mutators) |
| TERM_VALID_TRANSITIONS | association:member | transition_map | upcoming, active, completed, resigned, removed | (defined; not wired into mutators) |
<!-- oli:regen:fsm-table:end -->

## Detection notes

- `transition_map` is a regex-fallback extension: detects `export const *_VALID_TRANSITIONS: Record<string, string[]>` literal maps plus call sites of `assertValidTransition(MAP, from, to, name)`. The shipped detector spec lists `useState_union`, `useReducer`, `ref_union`, `enum_switch`, and `assignment_pattern`; `transition_map` is the closest match to the **assignment_pattern** family but is explicit, so emitted at HIGH confidence when wired, MEDIUM when defined-only.
- The pg-enum-based detector extension referenced in the cycle-4 audit was deferred. The wired-call-site evidence above is sufficient for the immediate consumers (oli-check --enforcement, /oli-check --compliance).
- All 18 FSMs are `code_only` (no DOMAIN_MODEL.md SM-NNN matches yet).
