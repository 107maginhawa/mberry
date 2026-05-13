import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { cancelEvent } from './cancelEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  organizationId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('cancelEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  const stubMembership = () => stubRepo(MembershipRepository, {
    getMember: async () => ({ id: 'mem-1', personId: 'user-1', organizationId: 'org-1', status: 'active' }),
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('cancels event and returns 200', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await cancelEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });

  test('passes cancelled status to repo.update', async () => {
    memberMocks = stubMembership();
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    await cancelEvent(ctx);
    expect(capturedData).toEqual({ status: 'cancelled' });
  });

  test('cancels event even with registrations (no guard in handler)', async () => {
    // Handler does not check for existing registrations before cancelling.
    // This documents the current behavior.
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, registrationCount: 50 }),
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-1' },
    });

    const response = await cancelEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });

  test('throws EVENT_ALREADY_CANCELLED if event is already cancelled', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, status: 'cancelled' }),
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(cancelEvent(ctx)).rejects.toMatchObject({ code: 'EVENT_ALREADY_CANCELLED' });
  });

  test('throws EVENT_COMPLETED if event is completed', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => ({ ...fakeEvent, status: 'completed' }),
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'evt-1' } });
    await expect(cancelEvent(ctx)).rejects.toMatchObject({ code: 'EVENT_COMPLETED' });
  });

  test('throws NotFoundError for non-existent event', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-missing' },
    });

    await expect(cancelEvent(ctx)).rejects.toThrow('Event not found');
  });

  test('crashes without session (org ownership requires session)', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
    });

    // session.user.id is accessed for org ownership check
    await expect(cancelEvent(ctx)).rejects.toThrow();
  });
});
