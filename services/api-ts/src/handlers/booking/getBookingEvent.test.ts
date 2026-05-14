import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { getBookingEvent } from './getBookingEvent';

const fakeEvent = {
  id: 'event-1',
  owner: 'user-1',
  title: 'Dental Consultation',
  status: 'active',
  organizationId: 'org-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getBookingEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns booking event by ID (public endpoint)', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { event: 'event-1' },
      _query: {},
    });

    const res = await getBookingEvent(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when event does not exist', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      _params: { event: 'missing-event' },
      _query: {},
    });

    await expect(getBookingEvent(ctx as any)).rejects.toThrow();
  });

  test('resolves "me" parameter — requires auth', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findMany: async () => [fakeEvent],
      findOneById: async () => fakeEvent,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { event: 'me' },
      _query: {},
    });

    // "me" without auth should throw UnauthorizedError
    await expect(getBookingEvent(ctx as any)).rejects.toThrow();
  });

  test('resolves "me" with authenticated user', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findMany: async () => [fakeEvent],
      findOneById: async () => fakeEvent,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'me' },
      _query: {},
    });

    const res = await getBookingEvent(ctx as any);
    expect(res.status).toBe(200);
  });
});
