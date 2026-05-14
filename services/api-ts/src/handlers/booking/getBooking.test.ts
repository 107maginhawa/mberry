import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingRepository } from './repos/booking.repo';
import { getBooking } from './getBooking';

const fakeBooking = {
  id: 'booking-1',
  client: 'user-1',
  host: 'host-1',
  slot: 'slot-1',
  status: 'pending',
  scheduledAt: new Date('2026-06-01T10:00:00Z'),
  locationType: 'video',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getBooking', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('returns booking when owner accesses it', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => fakeBooking,
    });
    mock.module('./utils/ownership', () => ({
      checkBookingOwnership: async () => true,
    }));

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { booking: 'booking-1' },
      _query: {},
    });

    const res = await getBooking(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when booking does not exist', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { booking: 'missing' },
      _query: {},
    });

    await expect(getBooking(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when user does not own booking', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => fakeBooking,
    });
    mock.module('./utils/ownership', () => ({
      checkBookingOwnership: async () => false,
    }));

    const ctx = makeCtx({
      user: { id: 'other-user', role: 'user' },
      _params: { booking: 'booking-1' },
      _query: {},
    });

    await expect(getBooking(ctx as any)).rejects.toThrow();
  });
});
