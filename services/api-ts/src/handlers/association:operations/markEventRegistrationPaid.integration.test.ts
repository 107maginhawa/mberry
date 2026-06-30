/**
 * markEventRegistrationPaid — walk-up cash mark-paid guards (real-PG; skips when DB unreachable).
 * Money path: an officer stamps paid_at for cash collected at the door. Proves the guards + the
 * idempotency invariant (double-tap = one settlement) on real Postgres.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { markEventRegistrationPaid } from './markEventRegistrationPaid';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let eventRepo: EventRepository;
let regRepo: EventRegistrationRepository;
const ORG = '00000000-0000-4000-8000-0000000000c1';
const OTHER_ORG = '00000000-0000-4000-8000-0000000000c2';
const OFFICER = '00000000-0000-4000-8000-0000000000cf';

async function seedEvent(o: Record<string, unknown> = {}) {
  return eventRepo.createOne({
    organizationId: ORG, title: 'Annual Assembly', startDate: new Date('2030-03-14T01:00:00Z'),
    endDate: new Date('2030-03-14T09:00:00Z'), status: 'published', registrationFee: 1500,
    currency: 'PHP', ...o,
  } as never);
}
async function seedReg(eventId: string, o: Record<string, unknown> = {}) {
  return regRepo.createOne({
    organizationId: ORG, eventId, personId: crypto.randomUUID(), status: 'confirmed', ...o,
  } as never);
}
function ctxFor(registrationId: string, org = ORG) {
  return makeCtx({ user: { id: OFFICER }, organizationId: org, database: H.db, _params: { registrationId } });
}

beforeAll(async () => {
  H = await createScratch(['event', 'event_registration']);
  if (!H.dbReachable) return;
  eventRepo = new EventRepository(H.db as never);
  regRepo = new EventRegistrationRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('markEventRegistrationPaid (real-PG)', () => {
  test('stamps paid_at for an unpaid paid-event registration', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const reg = await seedReg(ev.id);
    expect(reg.paidAt).toBeNull();

    const res = await markEventRegistrationPaid(ctxFor(reg.id) as never);
    expect(res.status).toBe(200);

    const after = await regRepo.findOneById(reg.id);
    expect(after?.paidAt).not.toBeNull();
    expect(after?.updatedBy).toBe(OFFICER);
  });

  test('idempotent — a second sequential call does not re-stamp (paid_at preserved)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const reg = await seedReg(ev.id);

    await markEventRegistrationPaid(ctxFor(reg.id) as never);
    const first = await regRepo.findOneById(reg.id);
    const res2 = await markEventRegistrationPaid(ctxFor(reg.id) as never);
    expect(res2.status).toBe(200);
    const second = await regRepo.findOneById(reg.id);

    expect(second?.paidAt?.getTime()).toBe(first?.paidAt?.getTime());
  });

  test('rejects a FREE event (fee 0) → 400, no paid_at', async () => {
    if (!H.dbReachable) return;
    const free = await seedEvent({ registrationFee: 0 });
    const reg = await seedReg(free.id);
    await expect(markEventRegistrationPaid(ctxFor(reg.id) as never)).rejects.toMatchObject({ statusCode: 400 });
    expect((await regRepo.findOneById(reg.id))?.paidAt ?? null).toBeNull();
  });

  test('rejects a terminal (cancelled / refunded) registration → 409', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const cancelled = await seedReg(ev.id, { status: 'cancelled' });
    await expect(markEventRegistrationPaid(ctxFor(cancelled.id) as never)).rejects.toMatchObject({ statusCode: 409 });
    const refunded = await seedReg(ev.id, { status: 'refunded' });
    await expect(markEventRegistrationPaid(ctxFor(refunded.id) as never)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('cross-org registration → 404 (org must own it)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const reg = await seedReg(ev.id);
    await expect(markEventRegistrationPaid(ctxFor(reg.id, OTHER_ORG) as never)).rejects.toMatchObject({ statusCode: 404 });
    expect((await regRepo.findOneById(reg.id))?.paidAt ?? null).toBeNull();
  });

  test('unknown registration → 404', async () => {
    if (!H.dbReachable) return;
    await expect(markEventRegistrationPaid(ctxFor(crypto.randomUUID()) as never)).rejects.toMatchObject({ statusCode: 404 });
  });
});
