import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { cancelEvent } from './cancelEvent';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('cancelEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('cancels event and returns 200', async () => {
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

  test('throws NotFoundError for non-existent event', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => undefined,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'evt-missing' },
    });

    await expect(cancelEvent(ctx)).rejects.toThrow('Event not found');
  });

  test('no session does not crash (no auth in handler)', async () => {
    // cancelEvent does not access session — auth middleware handles access control.
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (_id: string, data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'evt-1' },
    });

    const response = await cancelEvent(ctx);
    expect(response.status).toBe(200);
  });
});
