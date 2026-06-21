/**
 * Inter-module CONTRACT test for registerForEvent (handlers/events/registerForEvent.ts).
 *
 * Pins the `event.registered` domain-event fan-out trigger (notification + credit
 * consumers key off it) and the paid-vs-free boundary. The verification blob warns
 * the emit "may silently stop firing" — these tests capture the real bus payload so
 * a regression turns them red.
 *
 * The paid HAPPY path lives in association:operations/registerAndPayForEvent
 * (w2a-s6) and the settle in member/duesspecialassessments/
 * event-registration-settlement.integration.test.ts — out of scope here; this
 * slice owns only the FREE emit contract + the PAYMENT_REQUIRED guard.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent, fakeRegistration } from '@/test-utils/factories';
import { registerForEvent } from './registerForEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { domainEvents } from '@/core/domain-events';
import { BusinessLogicError, ConflictError } from '@/core/errors';

const ORG = 'org-1';
const EVENT = 'evt-1';
const USER = 'user-1';

function ctx() {
  return makeCtx({ user: { id: USER, role: 'user', twoFactorEnabled: true }, _params: { id: EVENT } });
}

let registered: Record<string, unknown>[] = [];
const capture = async (p: Record<string, unknown>) => { registered.push(p); };

function activeMembership() {
  return stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });
}

describe('registerForEvent — event.registered contract + paid boundary', () => {
  let mocks: ReturnType<typeof stubRepo> | undefined;
  let memMocks: ReturnType<typeof stubRepo> | undefined;

  beforeEach(() => {
    registered = [];
    domainEvents.on('event.registered', capture);
  });
  afterEach(() => {
    domainEvents.off('event.registered', capture);
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memMocks) Object.values(memMocks).forEach((m) => m.mockRestore());
    mocks = undefined; memMocks = undefined;
  });

  test('free event, created → emits event.registered once with the full payload, 201', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG, registrationFee: 0, capacity: 100 }),
      registerAtomic: async () => ({ ...fakeRegistration({ id: 'reg-1', eventId: EVENT, personId: USER }), status: 'confirmed', outcome: 'created' }),
    });
    memMocks = activeMembership();

    const res = await registerForEvent(ctx()) as unknown as { status: number };
    expect(res.status).toBe(201);

    await Promise.resolve();
    expect(registered).toHaveLength(1);
    expect(registered[0]).toMatchObject({ eventId: EVENT, personId: USER, organizationId: ORG, status: 'confirmed' });
  });

  test('free event, reactivated terminal row → also emits event.registered', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG, registrationFee: 0, capacity: 100 }),
      registerAtomic: async () => ({ ...fakeRegistration({ id: 'reg-1', eventId: EVENT, personId: USER }), status: 'confirmed', outcome: 'reactivated' }),
    });
    memMocks = activeMembership();

    const res = await registerForEvent(ctx()) as unknown as { status: number };
    expect(res.status).toBe(201);
    await Promise.resolve();
    expect(registered).toHaveLength(1);
  });

  test('idempotent + confirmed → 409 ConflictError, NO duplicate event.registered', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG, registrationFee: 0, capacity: 100 }),
      registerAtomic: async () => ({ ...fakeRegistration({ id: 'reg-1', eventId: EVENT, personId: USER }), status: 'confirmed', outcome: 'idempotent' }),
    });
    memMocks = activeMembership();

    await expect(registerForEvent(ctx())).rejects.toBeInstanceOf(ConflictError);
    await Promise.resolve();
    expect(registered).toHaveLength(0);
  });

  test('idempotent + waitlisted → 200, NO event.registered emitted', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG, registrationFee: 0, capacity: 1 }),
      registerAtomic: async () => ({ ...fakeRegistration({ id: 'reg-1', eventId: EVENT, personId: USER }), status: 'waitlisted', outcome: 'idempotent' }),
    });
    memMocks = activeMembership();

    const res = await registerForEvent(ctx()) as unknown as { status: number; body: { data: { status: string } } };
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('waitlisted');
    await Promise.resolve();
    expect(registered).toHaveLength(0);
  });

  test('paid event (fee > 0) → PAYMENT_REQUIRED BEFORE any membership check or registerAtomic', async () => {
    let registerAtomicCalled = false;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent({ id: EVENT, organizationId: ORG, registrationFee: 5000, capacity: 100 }),
      registerAtomic: async () => { registerAtomicCalled = true; return {} as never; },
    });
    // Membership check must NOT be reached — make it explode if it is.
    memMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => { throw new Error('membership check must not run before the paid guard'); },
    });

    let err: unknown;
    try { await registerForEvent(ctx()); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as { code?: string }).code).toBe('PAYMENT_REQUIRED');
    expect(registerAtomicCalled).toBe(false);
    await Promise.resolve();
    expect(registered).toHaveLength(0);
  });
});
