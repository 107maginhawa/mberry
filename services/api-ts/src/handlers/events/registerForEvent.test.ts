// Business Rules: [BR-02] [BR-27]
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent, fakeRegistration as createFakeRegistration } from '@/test-utils/factories';
import { registerForEvent } from './registerForEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { ConflictError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = createFakeEvent({ capacity: 100 });

const fakeRegistration = createFakeRegistration({
  organizationId: 'org-1',
  eventId: 'evt-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
});

// ─── Tests ──────────────────────────────────────────────

describe('[BR-27] registerForEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // NOTE: capacity / waitlist / duplicate-guard logic now lives in the
  // ATOMIC repo method registerAtomic (event-row lock + count + guarded
  // insert in one tx). The handler is a thin relay: it forwards capacity and
  // surfaces the repo's status, and maps a 23505 to a friendly ConflictError.
  // These tests therefore stub registerAtomic directly.

  test('registers for event and returns 201 confirmed', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async (input: any) => ({ ...fakeRegistration, eventId: input.eventId, status: 'confirmed' }),
    });
    const memMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    expect(response.body.data.eventId).toBe('evt-1');
    Object.values(memMocks).forEach(m => m.mockRestore());
  });

  test('[BR-27] waitlists when registerAtomic returns waitlisted (at capacity)', async () => {
    let seenCapacity: number | null = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 50 }),
      registerAtomic: async (input: any) => {
        seenCapacity = input.capacity;
        return { ...fakeRegistration, status: 'waitlisted' };
      },
    });
    const memMocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('waitlisted');
    // Handler forwards event capacity to the atomic repo method.
    expect(seenCapacity).toBe(50);
    Object.values(memMocks).forEach(m => m.mockRestore());
  });

  test('[BR-27] confirms when no capacity limit (null capacity forwarded)', async () => {
    let seenCapacity: number | null = -1;
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: null }),
      registerAtomic: async (input: any) => {
        seenCapacity = input.capacity;
        return { ...fakeRegistration, status: 'confirmed' };
      },
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    expect(seenCapacity).toBeNull();
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('allows registration for cancelled event (no event status guard)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, status: 'cancelled' }),
      registerAtomic: async (input: any) => ({ ...fakeRegistration, eventId: input.eventId, status: 'confirmed' }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    Object.values(mm).forEach(m => m.mockRestore());
  });

  // P0 RACE REGRESSION: a duplicate ACTIVE registration now violates the
  // partial unique index uq_event_reg_active → Postgres 23505 → the handler
  // must surface a friendly ConflictError ("already registered"), NOT a
  // silent second row. (Old behaviour: "allows duplicate registration".)
  test('[P0] duplicate active registration (23505) → ConflictError', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => {
        const err = new Error('duplicate key value violates unique constraint "uq_event_reg_active"') as Error & { code: string };
        err.code = '23505';
        throw err;
      },
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toBeInstanceOf(ConflictError);
    await expect(registerForEvent(ctx)).rejects.toThrow('already registered');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  // P0 RACE REGRESSION: capacity overflow under the event-row lock degrades to
  // 'waitlisted' atomically — capacity can never be exceeded by a concurrent
  // registrant. Modelled here by registerAtomic returning 'waitlisted'.
  test('[P0] concurrent registrant past capacity is waitlisted, never over-confirmed', async () => {
    const capacity = 1;
    let confirmedHanded = false;
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity }),
      // First caller confirmed, every subsequent caller waitlisted — mirrors
      // the FOR UPDATE serialised count in the real repo.
      registerAtomic: async () => {
        if (!confirmedHanded) {
          confirmedHanded = true;
          return { ...fakeRegistration, status: 'confirmed' };
        }
        return { ...fakeRegistration, status: 'waitlisted' };
      },
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctxA = makeCtx({ _params: { id: 'evt-1' } });
    const ctxB = makeCtx({ _params: { id: 'evt-1' } });
    const [resA, resB] = await Promise.all([registerForEvent(ctxA), registerForEvent(ctxB)]);
    const statuses = [resA.body.data.status, resB.body.data.status].sort();
    expect(statuses).toEqual(['confirmed', 'waitlisted']);
    Object.values(mm).forEach(m => m.mockRestore());
  });

  // ─── P1 single-row transition semantics (outcome discriminator) ─────────

  test('[P1] noShow member re-registers → 201 reactivated confirmed', async () => {
    let seenCapacity: number | null = -1;
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 100 }),
      registerAtomic: async (input: any) => {
        seenCapacity = input.capacity;
        // terminal noShow row transitioned back to active in the same row
        return { ...fakeRegistration, status: 'confirmed', outcome: 'reactivated' };
      },
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    // outcome is an internal discriminator, not part of the wire payload
    expect(response.body.data.outcome).toBeUndefined();
    expect(seenCapacity).toBe(100); // capacity respected
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[P1] cancelled member re-registers → 201 reactivated confirmed', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => ({ ...fakeRegistration, status: 'confirmed', outcome: 'reactivated' }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[P1] already-confirmed member re-registers → ConflictError (already registered)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => ({ ...fakeRegistration, status: 'confirmed', outcome: 'idempotent' }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toBeInstanceOf(ConflictError);
    const ctx2 = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx2)).rejects.toThrow('already registered');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[P1] waitlisted member re-registers → graceful 200 waitlist state, no 23505', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => ({ ...fakeRegistration, status: 'waitlisted', outcome: 'idempotent' }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    // graceful: current waitlist state, not an error
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('waitlisted');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('throws NotFoundError for non-existent event', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      registerAtomic: async () => fakeRegistration,
    });

    const ctx = makeCtx({
      _params: { id: 'evt-missing' },
    });

    await expect(registerForEvent(ctx)).rejects.toThrow('Event not found');
  });

  // ─── [BR-02] Grace Period Registration Guard ───────────

  test('[BR-02] blocks grace period member from registering', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => fakeRegistration,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'gracePeriod' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-02] blocks lapsed member from registering', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => fakeRegistration,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'lapsed' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-02] blocks non-member from registering', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => fakeRegistration,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      registerAtomic: async () => fakeRegistration,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
    });

    // session.user.id is accessed for personId/createdBy/updatedBy
    await expect(registerForEvent(ctx)).rejects.toThrow();
  });
});
