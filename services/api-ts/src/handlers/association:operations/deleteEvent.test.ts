import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteEvent } from './deleteEvent';
import { EventRepository } from './repos/events.repo';
import { NotFoundError } from '@/core/errors';

describe('deleteEvent — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await deleteEvent(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteEvent — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
  });

  test('returns success on delete', async () => {
    const existing = { id: 'evt-1', title: 'Conference', status: 'published', organizationId: 'org-1' };
    mocks = stubRepo(EventRepository, {
      findOneById: async () => existing,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await deleteEvent(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.success).toBe(true);
  });

  test('throws NotFoundError when event not found', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { eventId: 'no-such-event' } });
    await expect(deleteEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('calls deleteOneById with correct eventId', async () => {
    const existing = { id: 'evt-99', title: 'Event', status: 'draft', organizationId: 'org-1' };
    let deletedId = '';
    mocks = stubRepo(EventRepository, {
      findOneById: async () => existing,
      deleteOneById: async (id: string) => { deletedId = id; return undefined; },
    });

    const ctx = makeCtx({ _params: { eventId: 'evt-99' } });
    await deleteEvent(ctx);
    expect(deletedId).toBe('evt-99');
  });
});
