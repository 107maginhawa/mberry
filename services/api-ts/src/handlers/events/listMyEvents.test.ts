import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listMyEvents } from './listMyEvents';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

// Factory N/A: composite join result (registration + event)
const fakeMyEvents = [
  {
    registration: { id: 'reg-1', eventId: 'evt-1', personId: 'user-1', status: 'confirmed' },
    event: { id: 'evt-1', title: 'Conference A', startDate: new Date('2026-06-01') },
  },
  {
    registration: { id: 'reg-2', eventId: 'evt-2', personId: 'user-1', status: 'waitlisted' },
    event: { id: 'evt-2', title: 'Workshop B', startDate: new Date('2026-07-01') },
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('listMyEvents', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns user events with 200', async () => {
    mocks = stubRepo(EventsRepository, {
      listByPerson: async () => fakeMyEvents,
    });

    const ctx = makeCtx({});

    const response = await listMyEvents(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  test('returns empty list when no registrations', async () => {
    mocks = stubRepo(EventsRepository, {
      listByPerson: async () => [],
    });

    const ctx = makeCtx({});

    const response = await listMyEvents(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  test('passes session user id to repo', async () => {
    let capturedPersonId: string = '';
    mocks = stubRepo(EventsRepository, {
      listByPerson: async (personId: string) => { capturedPersonId = personId; return []; },
    });

    const ctx = makeCtx({
      user: { id: 'custom-user-42', role: 'member' },
    });

    await listMyEvents(ctx);
    expect(capturedPersonId).toBe('custom-user-42');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(EventsRepository, {
      listByPerson: async () => [],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
    });

    // session.user.id is accessed for personId lookup
    await expect(listMyEvents(ctx)).rejects.toThrow();
  });
});
