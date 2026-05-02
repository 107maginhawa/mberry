import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { registerForEvent } from './registerForEvent';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  capacity: 100,
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const fakeRegistration = {
  id: 'reg-1',
  tenantId: 'org-1',
  eventId: 'evt-1',
  personId: 'user-1',
  status: 'confirmed',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('registerForEvent', () => {
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

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
    expect(response.body.data.eventId).toBe('evt-1');
  });

  test('waitlists when event at capacity', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 50 }),
      getRegistrationCount: async () => 50,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });

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

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('waitlisted');
  });

  test('confirms when no capacity limit (null capacity)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: null }),
      getRegistrationCount: async () => 999,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
  });

  test('confirms when zero capacity (falsy)', async () => {
    // capacity: 0 is falsy, so isWaitlisted = false
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, capacity: 0 }),
      getRegistrationCount: async () => 10,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('confirmed');
  });

  test('allows registration for cancelled event (no status guard)', async () => {
    // Handler does not check event status before registering.
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, status: 'cancelled' }),
      getRegistrationCount: async () => 0,
      register: async (data: any) => ({ ...fakeRegistration, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
  });

  test('allows duplicate registration (no uniqueness guard)', async () => {
    // Handler does not check if user already registered.
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      getRegistrationCount: async () => 5,
      register: async (data: any) => ({ ...fakeRegistration, ...data, id: 'reg-2' }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await registerForEvent(ctx);
    expect(response.status).toBe(201);
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
