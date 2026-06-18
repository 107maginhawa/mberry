# C4 — Scheduling Cluster Review (booking / events / elections)

Reviewer: senior code review pass, 2026-06-16. Grounded in real `file:line`.
Scope: `services/api-ts/src/handlers/{booking,events,elections}`.

---

## Module: booking

### `booking/repos/booking.repo.ts:151,215-220` — **[P0][Intra]** Double-booking race: check-then-act with no atomic guard or transaction.
`createBooking` reads slot status at L151 (`if (slot.status !== 'available')`), then later inserts the booking (L215) and *unconditionally* flips the slot to `booked` (L218-220) in a **separate, non-transactional** statement. Two concurrent `POST /booking/bookings` for the same slot both pass the L151 check, both create `bookings` rows (there is **no unique constraint on `bookings.slot`** — schema only has `bookings_slot_id_idx`, a non-unique index, `booking.schema.ts:43`), and the second update silently overwrites `slot.booking`. Result: two confirmed bookings for one slot, one orphaned, plus two invoices if billing is configured.

Why it matters: the slot `unique(event, startTime)` constraint (`booking.schema.ts:213`) prevents duplicate *slots*, not duplicate *bookings on a slot*. Nothing serializes the booking write.

Fix — make the slot claim atomic and conditional, inside a transaction; let the DB arbitrate:
```ts
return await this.db.transaction(async (tx) => {
  // Atomic compare-and-swap: only succeeds if still available
  const claimed = await tx.update(timeSlots)
    .set({ status: 'booked', booking: bookingId })
    .where(and(eq(timeSlots.id, slotId), eq(timeSlots.status, 'available')))
    .returning();
  if (claimed.length === 0) throw new ConflictError('Time slot is not available');
  // ...create invoice + booking with the same tx, using pre-generated bookingId
});
```
Also add a partial unique index on `bookings.slot WHERE status NOT IN ('cancelled','rejected')` as belt-and-suspenders.

### `booking/repos/timeSlot.repo.ts:86-88` — **[P1][Intra]** `sql.raw` with naive single-quote wrapping of `locationTypes`.
```ts
sql`${timeSlots.locationTypes} && ARRAY[${sql.raw(
  filters.locationTypes.map(t => `'${t}'`).join(',')
)}]::text[]`
```
`sql.raw` bypasses parameterization entirely. Each value is wrapped in `'...'` with **no escaping** — a value containing `'` breaks out (`a','b'); DROP ...`). **Currently low exploitability** because the only caller path types `locationTypes` as the enum `('video'|'phone'|'in-person')[]` (`booking.schema.ts:459,474`) and `findAvailableSlots` feeds `query.locationType` from that enum. But the repo method is public and the guarantee is upstream/by-convention, not enforced here. If the enum is widened, a new caller is added, or validation is skipped, this is a SQL-injection sink.

Fix — drop `sql.raw`; use Drizzle's array operator with bound params:
```ts
import { arrayOverlaps } from 'drizzle-orm';
conditions.push(arrayOverlaps(timeSlots.locationTypes, filters.locationTypes));
```
Or, if keeping raw SQL, parameterize each element: `sql`${timeSlots.locationTypes} && ${filters.locationTypes}`` (Drizzle binds the JS array). Never interpolate user strings into `sql.raw`.

### `booking/utils/slotGeneration.ts:110-111,137-138` — **[P2][Intra]** DST gap/fold ambiguity in slot generation.
Local wall-clock slot times are built with `setHours/setMinutes` on a `Date` (L110-111) then converted via `fromZonedTime(slotStart, timezone)` (L137). On a DST spring-forward day, a wall-clock time inside the skipped hour (e.g. 02:30 in a zone that jumps 02:00→03:00) is non-existent; `fromZonedTime` resolves it to *an* instant, but the loop arithmetic (`addMinutes(slotStart, totalSlotTime)` in local time, L169) does not account for the 23/25-hour DST day. Slots near the transition can be misaligned by one hour or silently shifted. The `while (slotStart < dayEnd)` boundary (L128) is also evaluated in naive local time, so a block that straddles the fold can over/under-generate.

Why it matters: PH (Asia/Manila) has no DST so production is unaffected *today*, but the code is timezone-generic (`event.timezone`) and the platform targets global expansion (medical/global per CLAUDE.md). Any DST zone mis-generates twice a year.

Fix: anchor iteration in UTC instants from the start, or generate against the zoned date and explicitly handle the transition (date-fns-tz `fromZonedTime` returns the post-transition instant for gaps — assert duration via the UTC delta and skip/clamp slots whose `endUtc - startUtc` ≠ `slotDuration`). At minimum, run `validateSlotBoundaries` (L210) using the UTC `startTime/endTime` deltas (it already does, L225) and reject mismatches instead of dropping them silently.

### `booking/utils/slotGeneration.ts:128-134` — **[P3][Intra]** Off-by-one is handled correctly; partial trailing slot guarded.
`while (slotStart < dayEnd)` (strict `<`) plus the `if (slotEnd > dayEnd) break` (L132) correctly excludes a slot that starts exactly at `dayEnd` and prevents partial trailing slots. No bug — noting it was checked. The `getNextBookableTime` sub-minute ceil fix (L257-285) is correct: a time already on a 15-min boundary with seconds/ms is pushed to the next boundary (avoids landing in the past).

### `booking/utils/slotGeneration.ts:119,123` — **[P3][Intra]** `now`/`maxBookingDate` recomputed per time-block, not per generation run.
`const now = new Date()` (L119) inside the `for (timeBlock)` loop. Harmless (sub-ms drift) but wasteful and makes the min-booking-time cutoff non-deterministic across blocks. Hoist `now` to `generateSlotsForEvent`.

### `booking/utils/slotGeneration.ts:147` — **[P2][Intra]** Dedup key is weak and redundant with the DB unique constraint.
The `slotKey` uses `timeBlock.startTime` + local `getHours():getMinutes()`, not the UTC instant that actually drives the `unique(event, startTime)` constraint. Cross-block or DST-shifted slots can collide on key or evade dedup, but `bulkCreateSlots` (`timeSlot.repo.ts:287` `onConflictDoNothing` on `(event, startTime)`) is the real guard. The in-memory dedup is therefore best-effort cosmetic — fine, but don't rely on it for correctness.

### Cross / Performance (booking)
- `booking/confirmBooking.ts:84-134` — **[OK][Cross]** Notification + WebSocket sends are wrapped in `try/catch` (L85/L131) and explicitly non-blocking; a notif failure does **not** roll back the confirmation. Correct contract. Domain event in `createBooking.ts:47-52` is fire-and-forget with `.catch(() => {})`. Correct.
- `booking/repos/timeSlot.repo.ts:152-159` — **[P2][Perf]** `findAvailableSlots` duration filter runs in JS after fetching all rows, not in SQL. For large slot sets this over-fetches. Push `duration` into the where clause (`endTime - startTime` interval) or filter in DB.

---

## Module: events

### `events/registerForEvent.ts:31-41` + `association:operations/repos/events.schema.ts:92-104` — **[P0][Intra]** Capacity-overflow race AND duplicate-registration: count-then-insert with no unique constraint and no lock.
`registerForEvent` computes `regCount = getRegistrationCount(eventId)` (L31), decides `isWaitlisted = regCount >= capacity` (L32), then inserts (L34). Two concurrent registrations near capacity both read the same count, both decide `confirmed`, both insert → capacity exceeded. The `event_registration` table (`events.schema.ts:92`) has **only non-unique indexes** `idx_event_reg_event` / `idx_event_reg_person` (L12-13) — **no unique on (eventId, personId)**, so the same member can also register twice (double-confirm, double-waitlist).

Fix:
1. Add `uniqueIndex('event_reg_unique').on(eventId, personId)` to prevent double registration; catch `23505` in the handler and return idempotent/conflict.
2. For capacity, serialize: do the count + insert inside a transaction with `SELECT ... FOR UPDATE` on the event row (or a conditional insert that counts atomically), or accept an over-capacity row and let a DB-level check/trigger reconcile. Minimal:
```ts
await db.transaction(async (tx) => {
  // lock the event row to serialize concurrent registrants
  const [ev] = await tx.select().from(events).where(eq(events.id, eventId)).for('update');
  const count = await getRegistrationCount(eventId, tx);
  const waitlisted = ev.capacity ? count >= ev.capacity : false;
  await tx.insert(eventRegistrations).values({ ...status: waitlisted ? 'waitlisted':'confirmed' });
});
```

### `events/registerForEvent.ts:43-48` — **[OK][Cross]** `event.registered` domain event is `.catch(() => {})` fire-and-forget; registration is not rolled back on notification failure. Correct contract.

### `events/registerForEvent.ts:18-23` — **[P3][Intra]** Paid-event guard uses `registrationFee > 0` truthiness; confirm `registrationFee` is stored as integer minor-units (not float currency) to avoid `0.00`-vs-`0` edge. Low risk; verify schema type.

---

## Module: elections

### `elections/castVote.ts:56-75` + `elections/repos/elections.schema.ts:59` — **[OK][Intra]** Double-vote prevention is correctly defended.
`hasVoted` pre-check (L56) is the soft path; the hard guarantee is `uniqueIndex('election_vote_unique').on(electionId, voterId, positionId)` (`elections.schema.ts:59`). The handler catches the `23505` unique-violation on the concurrent race (L68-74) and converts to `ConflictError`. This is the **correct** pattern (DB-arbitrated, not check-then-act) — contrast with booking/events above which lack it. No transaction needed because the single insert + unique index is atomic.

### `elections/castVote.ts:29,43-54` — **[OK][Intra]** Eligibility checks present: voting-open status gate (L29), org-membership check (L37), and active-membership recompute via `computeMembershipStatus` (L43-54). Sound.

### `elections/repos/elections.repo.ts:94-100` — **[P3][Intra]** Tally correctness: `getVoteTallies` groups by `(positionId, nomineeId)` with `count(*)::int`. Correct given the unique constraint guarantees one vote per voter per position. `getVoterCount` (L102) uses `count(DISTINCT voterId)`. Both fine. Note: tally does **not** filter out voided nominees — if `voidVotesForNominee` (L141) deletes rows, the tally self-corrects; but ensure tally is only read after voting closes (no row for a withdrawn-but-not-voided nominee). Minor.

### `elections/repos/elections.repo.ts:127-138` — **[OK][Intra]** `withdrawAllNominees` uses `sql.join` with bound `sql`${s}`` params (not `sql.raw`) for the `NOT IN` list. Safe.

### Performance (elections)
- `elections/repos/elections.repo.ts:36-37,81-92` — **[P3][Perf]** `listNominees`/`listAnonymizedVotes`/`listVotesForVoter` hard-cap at `.limit(100)` with no pagination cursor. For large elections this silently truncates results (tally is aggregated server-side so unaffected, but list endpoints under-report). Add pagination.

---

## Cross-cutting (datetime serialization)

- Slot `startTime`/`endTime` are stored as UTC `Date` (timestamptz) and flow to `bookings.scheduledAt` (`booking.repo.ts:184,206`). Serialization across the booking→billing boundary (`paymentDueAt: slot.startTime`, L184) passes the `Date` directly — consistent. No string/Date mismatch found. **[OK]**
- `confirmBooking` publishes `confirmedAt: confirmedBooking.confirmationTimestamp` over WebSocket (`confirmBooking.ts:108`) as a raw `Date`; ensure the WS layer JSON-serializes to ISO-8601 (it does via `JSON.stringify`). Low risk.

---

## Top 3 Critical (C4)

1. **`booking/repos/booking.repo.ts:151,215-220` — P0 double-booking race.** Check-then-act on slot status across two non-transactional statements, **no unique constraint on `bookings.slot`**. Two concurrent requests book the same slot (+ duplicate invoices). Fix: conditional `UPDATE ... WHERE status='available' RETURNING` inside a transaction; add partial unique index on `bookings.slot`.

2. **`events/registerForEvent.ts:31-41` — P0 capacity overflow + duplicate registration.** `getRegistrationCount` then insert with no lock and **no unique(eventId, personId)** index (`events.schema.ts:92`). Concurrent registrants exceed `capacity`; same member registers twice. Fix: unique index + `SELECT FOR UPDATE` on event row (or atomic conditional insert).

3. **`booking/repos/timeSlot.repo.ts:86-88` — P1 `sql.raw` injection sink.** User-typed `locationTypes` interpolated into `sql.raw` with naive `'${t}'` quoting and zero escaping. Currently constrained by an upstream enum, but the guarantee is by-convention, not enforced at the sink. Fix: replace with `arrayOverlaps(timeSlots.locationTypes, filters.locationTypes)` (bound params).

### Test gaps (uncovered logic)
- **DST/timezone edge in `slotGeneration.ts`** — no test generates slots for a DST-transition day in a DST zone (e.g. `America/New_York` spring-forward); current tests likely only exercise Asia/Manila (no DST). Spring-forward gap and fall-back fold are untested.
- **Double-booking race (`createBooking`)** — no concurrent test fires two simultaneous `createBooking` calls on one slot to assert exactly one succeeds. The missing atomic guard would pass all current sequential tests.
- **Event capacity / double-registration race (`registerForEvent`)** — no test for concurrent registration at `capacity-1` (overflow) nor for a member registering twice (missing unique index). Sequential tests don't expose it.
