import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingRepository } from './repos/booking.repo';
import { cancelBooking } from './cancelBooking';

// Stub the ownership util
import * as ownership from './utils/ownership';
import { mock } from 'bun:test';

const BOOKING = {
  id: 'booking-1',
  client: 'user-1',
  host: 'host-1',
  slot: 'slot-1',
  status: 'confirmed',
  cancelledAt: null,
};

const CANCELLED = {
  ...BOOKING,
  status: 'cancelled',
  cancelledAt: new Date().toISOString(),
};

function makeBookingCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    _params: { booking: 'booking-1' },
    _body: { reason: 'Schedule conflict' },
    notifs: {
      createNotification: async () => ({}),
    },
    ws: {
      publishToUser: async () => {},
    },
    ...overrides,
  });
}

describe('cancelBooking', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  let ownershipMock: ReturnType<typeof mock>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    if (ownershipMock) ownershipMock.mockRestore();
  });

  test('cancels booking when user is client', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => BOOKING,
      cancelBooking: async () => CANCELLED,
    });
    ownershipMock = mock.module('./utils/ownership', () => ({
      getBookingUserType: async () => 'client',
    }));

    const ctx = makeBookingCtx();
    const res = await cancelBooking(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ValidationError when reason is empty', async () => {
    const ctx = makeBookingCtx({ _body: { reason: '' } });
    await expect(cancelBooking(ctx)).rejects.toThrow('Cancellation reason is required');
  });

  test('throws ValidationError when reason exceeds 500 chars', async () => {
    const ctx = makeBookingCtx({ _body: { reason: 'x'.repeat(501) } });
    await expect(cancelBooking(ctx)).rejects.toThrow('500 characters or less');
  });

  test('throws NotFoundError when booking does not exist', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeBookingCtx();
    await expect(cancelBooking(ctx)).rejects.toThrow('Booking not found');
  });

  test('throws ForbiddenError when user is not client or host', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => BOOKING,
    });
    ownershipMock = mock.module('./utils/ownership', () => ({
      getBookingUserType: async () => null,
    }));

    const ctx = makeBookingCtx();
    await expect(cancelBooking(ctx)).rejects.toThrow('You can only cancel your own bookings');
  });
});
