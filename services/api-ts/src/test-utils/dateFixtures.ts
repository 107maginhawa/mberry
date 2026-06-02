/**
 * Date fixtures for time-sensitive tests.
 *
 * The slot generator filters past slots via `isBefore(slotStartUtc, minBookingTime)`.
 * Tests that hardcode calendar dates rot one day at a time as the system clock drifts
 * past the fixture date. These helpers return dates that are always strictly in the
 * future (>= 1 week ahead), so structural assertions (slot counts, durations, gaps)
 * stay deterministic across calendar drift.
 *
 * Use `futureMonday()` as a baseline Monday in the future. Derive other days from it
 * via `futureSundayAfter(monday)` or `addDays(monday, n)` to keep paired fixtures
 * mutually consistent (never compute two independent literals — they can drift apart).
 */
import { addDays, addWeeks, nextMonday } from 'date-fns';

/**
 * Returns a Monday at least one full week in the future. Stable across runs within a
 * given week; jumps by 7 days when the clock crosses Sunday→Monday.
 */
export function futureMonday(): Date {
  return nextMonday(addWeeks(new Date(), 1));
}

/**
 * Returns the Sunday that closes the week starting at the given Monday (i.e. monday + 6 days).
 */
export function futureSundayAfter(monday: Date): Date {
  return addDays(monday, 6);
}
