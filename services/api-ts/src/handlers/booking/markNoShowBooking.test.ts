import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingRepository } from './repos/booking.repo';
import { markNoShowBooking } from './markNoShowBooking';

const pastTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

const fakeBooking = {
  id: 'booking-1',
  client: 'user-1',
  host: 'host-1',
  slot: 'slot-1',
  status: 'confirmed',
  scheduledAt: pastTime,
  locationType: 'video',
  noShowMarkedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('markNoShowBooking', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('throws NotFoundError when booking does not exist', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { booking: 'missing' },
      _body: {},
    });

    await expect(markNoShowBooking(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when user is not participant', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => fakeBooking,
    });
    mock.module('./utils/ownership', () => ({
      getBookingUserType: async () => null,
      checkBookingOwnership: async () => false,
    }));

    const ctx = makeCtx({
      user: { id: 'stranger', role: 'user' },
      _params: { booking: 'booking-1' },
      _body: {},
    });

    await expect(markNoShowBooking(ctx as any)).rejects.toThrow();
  });

  test('throws BusinessLogicError when booking is not confirmed', async () => {
    const pendingBooking = { ...fakeBooking, status: 'pending' };
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => pendingBooking,
    });
    mock.module('./utils/ownership', () => ({
      getBookingUserType: async () => 'client',
    }));

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { booking: 'booking-1' },
      _body: {},
    });

    await expect(markNoShowBooking(ctx as any)).rejects.toThrow();
  });

  test('marks no-show successfully for client (15min past scheduled)', async () => {
    const noShowResult = { ...fakeBooking, status: 'no_show_host', noShowMarkedAt: new Date() };
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => fakeBooking,
      markAsNoShow: async () => noShowResult,
    });
    mock.module('./utils/ownership', () => ({
      getBookingUserType: async () => 'client',
    }));

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { booking: 'booking-1' },
      _body: {},
    });

    const res = await markNoShowBooking(ctx as any);
    expect(res.status).toBe(200);
  });
});
