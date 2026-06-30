/**
 * registerAndPayForEventViaPaymongo guards (real-PG; skips when DB unreachable).
 * The happy-path checkout-URL needs a live PayMongo adapter and is covered by the contract
 * suite; here we prove the guards that protect the money path fire correctly + leave no orphan
 * registration. With no dues_gateway_config seeded, resolveCheckoutAdapter throws naturally →
 * the handler maps it to PAYMONGO_NOT_CONFIGURED (no mocking required).
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { registerAndPayForEventViaPaymongo } from './registerAndPayForEventViaPaymongo';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let eventRepo: EventRepository;
let regRepo: EventRegistrationRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';

let activeMocks: { mockRestore: () => void }[] = [];
afterEach(() => { activeMocks.forEach((m) => m.mockRestore()); activeMocks = []; });

function stubActive(active = true) {
  activeMocks.push(...Object.values(stubRepo(MembershipRepository, {
    findByPersonAndOrg: async () => (active ? { status: 'active' } : null),
  })));
}
async function seedEvent(o: Record<string, unknown> = {}) {
  return eventRepo.createOne({
    organizationId: ORG, title: 'Paid Gala', startDate: new Date('2030-05-01T09:00:00Z'),
    endDate: new Date('2030-05-01T17:00:00Z'), status: 'published', registrationFee: 5000,
    currency: 'PHP', capacity: 10, ...o,
  } as never);
}
function ctxFor(eventId: string, person = crypto.randomUUID()) {
  return makeCtx({ user: { id: person }, database: H.db, config: { auth: { secret: 'test-secret' } }, _params: { eventId } });
}

beforeAll(async () => {
  H = await createScratch(['event', 'event_registration']);
  if (!H.dbReachable) return;
  eventRepo = new EventRepository(H.db as never);
  regRepo = new EventRegistrationRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('registerAndPayForEventViaPaymongo guards (real-PG)', () => {
  test('FREE_EVENT (before any side effect)', async () => {
    if (!H.dbReachable) return;
    const free = await seedEvent({ registrationFee: 0 });
    stubActive();
    await expect(registerAndPayForEventViaPaymongo(ctxFor(free.id) as never)).rejects.toMatchObject({ code: 'FREE_EVENT' });
  });

  test('ForbiddenError when not an active member', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    stubActive(false);
    await expect(registerAndPayForEventViaPaymongo(ctxFor(ev.id) as never)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('EVENT_FULL leaves no extra registration', async () => {
    if (!H.dbReachable) return;
    const full = await seedEvent({ capacity: 1 });
    await regRepo.createOne({ organizationId: ORG, eventId: full.id, personId: crypto.randomUUID(), status: 'confirmed' } as never);
    stubActive();
    await expect(registerAndPayForEventViaPaymongo(ctxFor(full.id) as never)).rejects.toMatchObject({ code: 'EVENT_FULL' });
    expect(await regRepo.count({ eventId: full.id } as never)).toBe(1);
  });

  test('PAYMONGO_NOT_CONFIGURED when the org has no gateway — and NO orphan registration is created', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    stubActive();
    await expect(registerAndPayForEventViaPaymongo(ctxFor(ev.id) as never)).rejects.toMatchObject({ code: 'PAYMONGO_NOT_CONFIGURED' });
    // adapter resolves BEFORE the registration insert → no orphan unpaid row left behind.
    expect(await regRepo.count({ eventId: ev.id } as never)).toBe(0);
  });
});
