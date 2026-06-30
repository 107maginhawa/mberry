/**
 * Money-critical seam: settleEventRegistrationPayment (the PayMongo paid-event settle the
 * webhook calls). Real-PG via createScratch; skips when DB unreachable.
 *
 * Proves: a verified paid event stamps paid_at exactly once (idempotent); a cross-org or
 * wrong-amount event NEVER settles (tamper); an unknown registration is reported, not stamped.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { settleEventRegistrationPayment } from './settle-event-registration';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let eventRepo: EventRepository;
let regRepo: EventRegistrationRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';
const OTHER_ORG = '00000000-0000-4000-8000-0000000000b2';
const FEE = 5000;

async function seedEvent(o: Record<string, unknown> = {}) {
  return eventRepo.createOne({
    organizationId: ORG, title: 'Paid Gala', startDate: new Date('2030-05-01T09:00:00Z'),
    endDate: new Date('2030-05-01T17:00:00Z'), status: 'published', registrationFee: FEE,
    currency: 'PHP', capacity: 10, ...o,
  } as never);
}
async function seedReg(eventId: string, o: Record<string, unknown> = {}) {
  return regRepo.createOne({ organizationId: ORG, eventId, personId: crypto.randomUUID(), status: 'confirmed', ...o } as never);
}
async function readReg(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT paid_at, version FROM "${H.schema}".event_registration WHERE id = $1`, [id]);
  return rows[0];
}

beforeAll(async () => {
  H = await createScratch(['event', 'event_registration']);
  if (!H.dbReachable) return;
  eventRepo = new EventRepository(H.db as never);
  regRepo = new EventRegistrationRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('settleEventRegistrationPayment (real-PG)', () => {
  test('stamps paid_at once for a correct-amount, correct-org event; a redelivery is idempotent', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const reg = await seedReg(ev.id);
    expect((await readReg(reg.id)).paid_at).toBeNull();

    const first = await settleEventRegistrationPayment(H.db as never, { registrationId: reg.id, orgId: ORG, amount: FEE });
    expect(first.action).toBe('processed');
    const afterFirst = await readReg(reg.id);
    expect(afterFirst.paid_at).not.toBeNull();
    expect(afterFirst.version).toBe(2); // updateOneById bumped it once

    // Redelivery: still processed-shaped but NO second stamp (paid_at already set → no version bump).
    const second = await settleEventRegistrationPayment(H.db as never, { registrationId: reg.id, orgId: ORG, amount: FEE });
    expect(second.action).toBe('processed');
    expect((await readReg(reg.id)).version).toBe(2); // unchanged — no double settle
  });

  test('NEVER settles a cross-org event (tamper)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const reg = await seedReg(ev.id);
    const out = await settleEventRegistrationPayment(H.db as never, { registrationId: reg.id, orgId: OTHER_ORG, amount: FEE });
    expect(out).toMatchObject({ action: 'tamper' });
    expect((await readReg(reg.id)).paid_at).toBeNull();
  });

  test('NEVER settles a wrong-amount event (tamper)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const reg = await seedReg(ev.id);
    const out = await settleEventRegistrationPayment(H.db as never, { registrationId: reg.id, orgId: ORG, amount: FEE + 1 });
    expect(out).toMatchObject({ action: 'tamper' });
    expect((await readReg(reg.id)).paid_at).toBeNull();
  });

  test('NEVER settles a wrong-currency event (tamper)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(); // PHP
    const reg = await seedReg(ev.id);
    const out = await settleEventRegistrationPayment(H.db as never, { registrationId: reg.id, orgId: ORG, amount: FEE, currency: 'USD' });
    expect(out).toMatchObject({ action: 'tamper' });
    expect((await readReg(reg.id)).paid_at).toBeNull();
  });

  test('reports an unknown registration without stamping anything', async () => {
    if (!H.dbReachable) return;
    const out = await settleEventRegistrationPayment(H.db as never, { registrationId: crypto.randomUUID(), orgId: ORG, amount: FEE });
    expect(out.action).toBe('unknown_registration');
  });

  test('ignores a missing registrationId', async () => {
    if (!H.dbReachable) return;
    const out = await settleEventRegistrationPayment(H.db as never, { registrationId: undefined, orgId: ORG, amount: FEE });
    expect(out.action).toBe('ignored');
  });
});
