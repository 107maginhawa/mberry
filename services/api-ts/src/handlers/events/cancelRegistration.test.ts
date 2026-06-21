/**
 * Handler test for cancelRegistration (handlers/events/cancelRegistration.ts).
 * This handler had ZERO tests. Covers the response shape, the BR-27 waitlist
 * promotion ("free a seat"), the cancelled domain event, authz (self / officer /
 * forbidden), the not-found / wrong-event guards, the already-cancelled guard,
 * and the non-fatal promotion failure path.
 *
 * Mock-handler style (stubRepo + makeCtx) for the branch/spy assertions; the
 * real-PG promotion read-back lives in the s6 block below.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent, fakeRegistration } from '@/test-utils/factories';
import { cancelRegistration } from './cancelRegistration';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import { BusinessLogicError, ForbiddenError, NotFoundError } from '@/core/errors';
import { type ScratchDb } from '@/test-utils/pg-scratch';
import { createSchedulingScratch, seedEvent, SCHED_ORG } from '@/test-utils/scheduling-fixtures';

const ORG = 'org-1';
const EVENT = 'evt-1';
const REG = 'reg-1';

function ctxFor(opts: { userId?: string } = {}) {
  const userId = opts.userId ?? 'user-1';
  return makeCtx({
    user: { id: userId, role: 'user', twoFactorEnabled: true },
    _params: { eventId: EVENT, registrationId: REG, orgId: ORG },
  });
}

let cancelledEvents: Record<string, unknown>[] = [];
const captureCancelled = async (p: Record<string, unknown>) => { cancelledEvents.push(p); };

describe('cancelRegistration', () => {
  let mocks: ReturnType<typeof stubRepo> | undefined;
  let officerMocks: ReturnType<typeof stubRepo> | undefined;

  beforeEach(() => {
    cancelledEvents = [];
    domainEvents.on('event.registration.cancelled', captureCancelled);
  });
  afterEach(() => {
    domainEvents.off('event.registration.cancelled', captureCancelled);
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    mocks = undefined;
    officerMocks = undefined;
  });

  test('cancels a confirmed self-registration → 200 cancelled + cancelledAt, emits event once', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'user-1', status: 'confirmed' }),
      updateRegistration: async (id: string, data: Record<string, unknown>) => ({ id, eventId: EVENT, personId: 'user-1', ...data }),
      getFirstWaitlisted: async () => undefined,
    });

    const res = await cancelRegistration(ctxFor()) as unknown as { status: number; body: { data: { status: string; cancelledAt: Date } } };
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.cancelledAt).toBeInstanceOf(Date);

    await Promise.resolve();
    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0]).toMatchObject({
      registrationId: REG, eventId: EVENT, personId: 'user-1', organizationId: ORG, cancelledBy: 'user-1',
    });
  });

  test('[BR-27] promotes the first waitlisted registrant when a confirmed seat is freed', async () => {
    const updateCalls: { id: string; data: Record<string, unknown> }[] = [];
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'user-1', status: 'confirmed' }),
      updateRegistration: async (id: string, data: Record<string, unknown>) => { updateCalls.push({ id, data }); return { id, eventId: EVENT, personId: 'user-1', ...data }; },
      getFirstWaitlisted: async () => fakeRegistration({ id: 'reg-wait', eventId: EVENT, personId: 'p2', status: 'waitlisted' }),
    });

    const res = await cancelRegistration(ctxFor()) as unknown as { status: number };
    expect(res.status).toBe(200);
    // First update cancels the confirmed row; second promotes the waitlisted one.
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]).toMatchObject({ id: REG, data: { status: 'cancelled' } });
    expect(updateCalls[1]).toMatchObject({ id: 'reg-wait', data: { status: 'confirmed' } });
  });

  test('no promotion when the cancelled registration was not confirmed (waitlisted cancel)', async () => {
    const updateCalls: { id: string; data: Record<string, unknown> }[] = [];
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'user-1', status: 'waitlisted' }),
      updateRegistration: async (id: string, data: Record<string, unknown>) => { updateCalls.push({ id, data }); return { id, ...data }; },
      getFirstWaitlisted: async () => fakeRegistration({ id: 'reg-wait', status: 'waitlisted' }),
    });

    await cancelRegistration(ctxFor());
    // Only the cancel write — no promotion, because no confirmed seat was freed.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.id).toBe(REG);
  });

  test('cancelling an already-cancelled registration throws ALREADY_CANCELLED', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'user-1', status: 'cancelled' }),
    });
    let err: unknown;
    try { await cancelRegistration(ctxFor()); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as { code?: string }).code).toBe('ALREADY_CANCELLED');
  });

  test('authz: a non-self, non-officer caller is forbidden', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'owner', status: 'confirmed' }),
    });
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    let err: unknown;
    try { await cancelRegistration(ctxFor({ userId: 'intruder' })); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  test('authz: an officer (not the registrant) may cancel', async () => {
    const updateCalls: { id: string; data: Record<string, unknown> }[] = [];
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'owner', status: 'confirmed' }),
      updateRegistration: async (id: string, data: Record<string, unknown>) => { updateCalls.push({ id, data }); return { id, ...data }; },
      getFirstWaitlisted: async () => undefined,
    });
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1' }] });

    const res = await cancelRegistration(ctxFor({ userId: 'officer-x' })) as unknown as { status: number };
    expect(res.status).toBe(200);
    expect(updateCalls[0]!.data.status).toBe('cancelled');
  });

  test('event not found → NotFoundError', async () => {
    mocks = stubRepo(EventsRepository, { get: async () => undefined });
    await expect(cancelRegistration(ctxFor())).rejects.toBeInstanceOf(NotFoundError);
  });

  test('event belongs to a different org → NotFoundError', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: 'some-other-org' }),
    });
    await expect(cancelRegistration(ctxFor())).rejects.toBeInstanceOf(NotFoundError);
  });

  test('registration on a different event → NotFoundError', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: 'other-evt', personId: 'user-1', status: 'confirmed' }),
    });
    await expect(cancelRegistration(ctxFor())).rejects.toBeInstanceOf(NotFoundError);
  });

  test('waitlist promotion failure is non-fatal — cancel still returns 200', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG }),
      getRegistration: async () => fakeRegistration({ id: REG, eventId: EVENT, personId: 'user-1', status: 'confirmed' }),
      updateRegistration: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      getFirstWaitlisted: async () => { throw new Error('db blip during promotion'); },
    });
    const res = await cancelRegistration(ctxFor()) as unknown as { status: number; body: { data: { status: string } } };
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });
});

/**
 * s6 — cancel → promote → capacity-freed end-to-end against REAL Postgres.
 * Drives the actual cancelRegistration handler with the real EventsRepository
 * (no stubRepo) over a scratch schema, proving the cancel→waitlist-promotion→
 * capacity bookkeeping holds at the SQL layer (the stub test cannot).
 */
describe('cancelRegistration — real-PG cancel→promote→capacity-freed', () => {
  test('cancelling the confirmed seat promotes the waitlisted registrant; capacity stays at 1', async () => {
    const H = await createSchedulingScratch();
    if (!H.dbReachable) { await H.teardown(); return; }
    const repo = new EventsRepository(H.db as never);
    try {
      const ev = await seedEvent(H, { capacity: 1, organizationId: SCHED_ORG });
      const personA = crypto.randomUUID();
      const personB = crypto.randomUUID();

      // Build state through the REAL atomic path: A confirmed, B waitlisted.
      const a = await repo.registerAtomic({ eventId: ev.id, personId: personA, organizationId: SCHED_ORG, capacity: 1, createdBy: personA, updatedBy: personA });
      const b = await repo.registerAtomic({ eventId: ev.id, personId: personB, organizationId: SCHED_ORG, capacity: 1, createdBy: personB, updatedBy: personB });
      expect(a.status).toBe('confirmed');
      expect(b.status).toBe('waitlisted');
      expect(await repo.getRegistrationCount(ev.id)).toBe(1);

      // Person A cancels their own confirmed registration (self → no officer lookup).
      const ctx = makeCtx({
        database: H.db,
        user: { id: personA, role: 'user', twoFactorEnabled: true },
        _params: { eventId: ev.id, registrationId: a.id, orgId: SCHED_ORG },
      });
      const res = await cancelRegistration(ctx) as unknown as { status: number };
      expect(res.status).toBe(200);

      // Read REAL rows back: A cancelled, B promoted to confirmed.
      const { rows: aRows } = await H.scopedPool.query(
        `SELECT status FROM "${H.schema}".event_registration WHERE id = $1`, [a.id]);
      const { rows: bRows } = await H.scopedPool.query(
        `SELECT status FROM "${H.schema}".event_registration WHERE id = $1`, [b.id]);
      expect(aRows[0]?.status).toBe('cancelled');
      expect(bRows[0]?.status).toBe('confirmed');

      // Capacity bookkeeping: exactly one confirmed seat — never silently lost.
      expect(await repo.getRegistrationCount(ev.id)).toBe(1);
    } finally {
      await H.teardown();
    }
  });
});
