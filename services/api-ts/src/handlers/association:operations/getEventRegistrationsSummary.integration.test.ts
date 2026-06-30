/**
 * getEventRegistrationsSummary — server-side attendee counts (real-PG; skips when DB unreachable).
 * Replaces the door screen's client-side tally (capped at 100, miscounts no-shows). Counts use the
 * REAL registration_status enum values ('noShow'/'cancelled'/'refunded'), not the SDK's 'no_show'.
 * check_in links by (event_id, person_id) — there is no registration_id column.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getEventRegistrationsSummary } from './getEventRegistrationsSummary';
import { EventRepository, EventRegistrationRepository, CheckInRepository } from './repos/events.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let eventRepo: EventRepository;
let regRepo: EventRegistrationRepository;
let checkInRepo: CheckInRepository;
const ORG = '00000000-0000-4000-8000-0000000000d1';
const OTHER_ORG = '00000000-0000-4000-8000-0000000000d2';

async function seedEvent(o: Record<string, unknown> = {}) {
  return eventRepo.createOne({
    organizationId: ORG, title: 'Assembly', startDate: new Date('2030-03-14T01:00:00Z'),
    endDate: new Date('2030-03-14T09:00:00Z'), status: 'published', registrationFee: 1500, currency: 'PHP', ...o,
  } as never);
}
async function seedReg(eventId: string, o: Record<string, unknown> = {}) {
  return regRepo.createOne({
    organizationId: ORG, eventId, personId: crypto.randomUUID(), status: 'confirmed', ...o,
  } as never);
}
async function seedCheckIn(eventId: string, personId: string) {
  return checkInRepo.createOne({ organizationId: ORG, eventId, personId, method: 'manual' } as never);
}
function ctxFor(eventId: string, org = ORG) {
  return makeCtx({ user: { id: 'officer-1' }, organizationId: org, database: H.db, _params: { eventId } });
}

beforeAll(async () => {
  H = await createScratch(['event', 'event_registration', 'check_in']);
  if (!H.dbReachable) return;
  eventRepo = new EventRepository(H.db as never);
  regRepo = new EventRegistrationRepository(H.db as never);
  checkInRepo = new CheckInRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('getEventRegistrationsSummary (real-PG)', () => {
  test('counts attending / paid / checkedIn / noShow correctly; excludes cancelled+refunded', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const paid1 = await seedReg(ev.id, { status: 'confirmed', paidAt: new Date() });
    await seedReg(ev.id, { status: 'confirmed', paidAt: new Date() });   // paid2
    await seedReg(ev.id, { status: 'confirmed' });                        // unpaid confirmed
    const wl = await seedReg(ev.id, { status: 'waitlisted' });            // waitlisted, unpaid
    await seedReg(ev.id, { status: 'cancelled' });                        // excluded
    await seedReg(ev.id, { status: 'refunded' });                         // excluded
    await seedReg(ev.id, { status: 'noShow' });                           // attending + noShow
    // Two distinct people checked in (one is the waitlisted reg — checkedIn counts among attending).
    // paid1 has TWO check-in rows (check_in has no unique on event+person) — checkedIn must still
    // be 2, not 3: proves the COUNT(DISTINCT registration) over the person-join fan-out.
    await seedCheckIn(ev.id, paid1.personId);
    await seedCheckIn(ev.id, paid1.personId);
    await seedCheckIn(ev.id, wl.personId);

    const res = await getEventRegistrationsSummary(ctxFor(ev.id) as never);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual({ totalAttending: 5, paid: 2, checkedIn: 2, noShow: 1 });
  });

  test('empty event → all zeros', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const res = await getEventRegistrationsSummary(ctxFor(ev.id) as never);
    expect((res as any).body).toEqual({ totalAttending: 0, paid: 0, checkedIn: 0, noShow: 0 });
  });

  test('cross-org event → 404 (org must own it)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    await expect(getEventRegistrationsSummary(ctxFor(ev.id, OTHER_ORG) as never)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('unknown event → 404', async () => {
    if (!H.dbReachable) return;
    await expect(getEventRegistrationsSummary(ctxFor(crypto.randomUUID()) as never)).rejects.toMatchObject({ statusCode: 404 });
  });
});
