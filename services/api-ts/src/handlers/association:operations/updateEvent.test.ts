import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateEvent } from './updateEvent';
import { EventRepository } from './repos/events.repo';
import { NotFoundError } from '@/core/errors';

describe('updateEvent — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' }, _body: {} });
    const response = await updateEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { eventId: 'evt-1' }, _body: {} });
    const response = await updateEvent(ctx);
    expect(response.status).toBe(403);
  });
});

describe('updateEvent — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
  });

  test('returns updated event on success', async () => {
    const existing = { id: 'evt-1', title: 'Old Title', status: 'published', organizationId: 'org-1' };
    const updated = { ...existing, title: 'New Title' };
    mocks = stubRepo(EventRepository, {
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _body: { title: 'New Title' },
    });
    const response = await updateEvent(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.title).toBe('New Title');
    expect((response as any).body.id).toBe('evt-1');
  });

  test('throws NotFoundError for non-existent event', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { eventId: 'no-such-event' },
      _body: { title: 'Whatever' },
    });
    await expect(updateEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('partial update passes only provided fields to repo', async () => {
    const existing = { id: 'evt-1', title: 'Original', location: 'Hall A', organizationId: 'org-1' };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(EventRepository, {
      findOneById: async () => existing,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...existing, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _body: { location: 'Hall B' },
    });
    await updateEvent(ctx);
    expect(capturedUpdates['location']).toBe('Hall B');
    // title was not in body so should not be set explicitly
    expect(capturedUpdates['title']).toBeUndefined();
  });
});
