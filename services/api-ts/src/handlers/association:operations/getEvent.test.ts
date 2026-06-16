import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotFoundError } from '@/core/errors';
import { getEvent } from './getEvent';
import { EventRepository } from './repos/events.repo';

describe('getEvent', () => {
  afterEach(() => restoreRepo(EventRepository));

  test('returns 401 when unauthorized', async () => {
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await getEvent(ctx);
    expect(response.status).toBe(401);
  });

  test('throws NotFoundError when event missing', async () => {
    stubRepo(EventRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { eventId: 'missing' } });
    await expect(getEvent(ctx)).rejects.toThrow(NotFoundError);
  });

  test('returns 200 with event on happy path', async () => {
    const event = { id: 'evt-1', title: 'Annual Conference' };
    stubRepo(EventRepository, { findOneById: async () => event });
    const ctx = makeCtx({ _params: { eventId: 'evt-1' } });
    const response = await getEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(event);
  });
});
