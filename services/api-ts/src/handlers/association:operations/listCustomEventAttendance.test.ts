import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listCustomEventAttendance } from './listCustomEventAttendance';
import { EventRepository, CheckInRepository } from './repos/events.repo';
import { NotFoundError } from '@/core/errors';

describe('listCustomEventAttendance — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listCustomEventAttendance(ctx);
    expect(response.status).toBe(401);
  });
});

describe('listCustomEventAttendance — business logic', () => {
  let eventMocks: ReturnType<typeof stubRepo>;
  let checkInMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
  });

  afterEach(() => {
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    if (checkInMocks) Object.values(checkInMocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(CheckInRepository);
  });

  test('returns attendance list for existing event', async () => {
    const event = { id: 'evt-1', title: 'Annual Meet', status: 'published', organizationId: 'org-1' };
    const checkIns = [
      { id: 'ci-1', eventId: 'evt-1', personId: 'p-1' },
      { id: 'ci-2', eventId: 'evt-1', personId: 'p-2' },
    ];
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => event,
    });
    checkInMocks = stubRepo(CheckInRepository, {
      findMany: async () => checkIns,
    });

    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await listCustomEventAttendance(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(2);
    expect((response as any).body.total).toBe(2);
  });

  test('throws NotFoundError when event not found', async () => {
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { eventId: 'no-such-event' } });
    await expect(listCustomEventAttendance(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns empty attendance when no check-ins', async () => {
    const event = { id: 'evt-2', title: 'Workshop', status: 'published', organizationId: 'org-1' };
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => event,
    });
    checkInMocks = stubRepo(CheckInRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({ _params: { eventId: 'evt-2' } });
    const response = await listCustomEventAttendance(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toEqual([]);
    expect((response as any).body.total).toBe(0);
  });

  test('filters check-ins by eventId', async () => {
    const event = { id: 'evt-42', title: 'Seminar', status: 'published', organizationId: 'org-1' };
    let capturedFilters: Record<string, unknown> = {};
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => event,
    });
    checkInMocks = stubRepo(CheckInRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
    });

    const ctx = makeCtx({ _params: { eventId: 'evt-42' } });
    await listCustomEventAttendance(ctx);
    expect(capturedFilters['eventId']).toBe('evt-42');
  });
});
