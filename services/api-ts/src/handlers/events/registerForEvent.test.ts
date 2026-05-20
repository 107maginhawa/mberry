// Business Rules: [BR-02] [BR-27]
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { registerForEvent } from './registerForEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  capacity: 100,
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const fakeRegistration = {
  id: 'reg-1',
  organizationId: 'org-1',
  eventId: 'evt-1',
  personId: 'user-1',
  status: 'confirmed',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-27] registerForEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('registers for event and returns 201 confirmed', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 10,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
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

  test('[BR-27] waitlists when event at capacity', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 50 }),
      getRegistrationCount: async () => 50,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });
    const memMocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('waitlisted');
  });

  test('waitlists when over capacity', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 10 }),
      getRegistrationCount: async () => 15,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('waitlisted');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-27] confirms when no capacity limit (null capacity)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: null }),
      getRegistrationCount: async () => 999,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('confirms when zero capacity (falsy)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 0 }),
      getRegistrationCount: async () => 10,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('allows registration for cancelled event (no event status guard)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, status: 'cancelled' }),
      getRegistrationCount: async () => 0,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('allows duplicate registration (no uniqueness guard)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 5,
      register: async (data: any) => ({ ...fakeRegistration, ...data, id: 'reg-2' }),
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'active' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('throws NotFoundError for non-existent event', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      getRegistrationCount: async () => 0,
      register: async (data: any) => fakeRegistration,
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
      getRegistrationCount: async () => 0,
      register: async (data: any) => fakeRegistration,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'gracePeriod' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-02] blocks lapsed member from registering', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 0,
      register: async (data: any) => fakeRegistration,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ status: 'lapsed' }) });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('[BR-02] blocks non-member from registering', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 0,
      register: async (data: any) => fakeRegistration,
    });
    const mm = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(registerForEvent(ctx)).rejects.toThrow('Active membership required');
    Object.values(mm).forEach(m => m.mockRestore());
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 0,
      register: async (data: any) => fakeRegistration,
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
