import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBooking as fakeBookingFactory } from '@/test-utils/factories';
import { BookingRepository } from './repos/booking.repo';
import { listBookings } from './listBookings';

const fakeBooking = fakeBookingFactory({ client: 'user-1' });

describe('listBookings', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns own bookings for user', async () => {
    mocks = stubRepo(BookingRepository, {
      findMany: async () => [fakeBooking],
      count: async () => 1,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _query: {},
    });

    const res = await listBookings(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.pagination).toBeDefined();
  });

  test('throws ForbiddenError when filtering by another user as host', async () => {
    mocks = stubRepo(BookingRepository, {
      findMany: async () => [],
      count: async () => 0,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _query: { host: 'other-user' },
    });

    await expect(listBookings(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when filtering by another user as client', async () => {
    mocks = stubRepo(BookingRepository, {
      findMany: async () => [],
      count: async () => 0,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _query: { client: 'other-user' },
    });

    await expect(listBookings(ctx as any)).rejects.toThrow();
  });

  test('defaults to clientOrHost filter when no specific filter given', async () => {
    let capturedFilters: any;
    mocks = stubRepo(BookingRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
      count: async () => 0,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _query: {},
    });

    await listBookings(ctx as any);
    expect(capturedFilters.clientOrHost).toBe('user-1');
  });
});
