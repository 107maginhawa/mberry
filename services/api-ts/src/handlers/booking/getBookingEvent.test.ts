import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBookingEvent } from '@/test-utils/factories';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { getBookingEvent } from './getBookingEvent';

const fakeEvent = fakeBookingEvent();

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
    expect((res as any).body.id).toBe('event-1');
    expect((res as any).body.title).toBe('Dental Consultation');
    expect((res as any).body.status).toBe('active');
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
    expect((res as any).body.id).toBe('event-1');
    expect((res as any).body.owner).toBe('user-1');
  });
});
