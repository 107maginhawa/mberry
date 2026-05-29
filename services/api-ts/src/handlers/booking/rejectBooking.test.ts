import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBooking as fakeBookingFactory } from '@/test-utils/factories';
import { ConflictError } from '@/core/errors';
import { BookingRepository } from './repos/booking.repo';
import { rejectBooking } from './rejectBooking';

const fakeBooking = fakeBookingFactory({ cancelledAt: null });

const fakeNotificationService = {
  createNotification: async () => ({ id: 'notif-1' }),
};

const fakeWsService = {
  publishToUser: async () => {},
};

describe('rejectBooking', () => {
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
      user: { id: 'host-1', role: 'user' },
      _params: { booking: 'missing' },
      _body: {},
    });

    await expect(rejectBooking(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-host tries to reject', async () => {
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => fakeBooking,
    });
    mock.module('./utils/ownership', () => ({
      checkBookingHostOwnership: async () => false,
    }));

    const ctx = makeCtx({
      user: { id: 'client-1', role: 'user' },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Not available' },
    });

    await expect(rejectBooking(ctx as any)).rejects.toThrow();
  });

  test('rejects booking and returns 200 when host', async () => {
    const rejectedBooking = {
      ...fakeBooking,
      status: 'rejected',
      cancelledAt: new Date(),
      cancellationReason: 'Not available',
    };

    // Mock DB for slot update in rejectBooking
    const mockUpdate = {
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
    };

    mocks = stubRepo(BookingRepository, {
      findOneById: async () => fakeBooking,
      updateOneById: async () => rejectedBooking,
    });
    mock.module('./utils/ownership', () => ({
      checkBookingHostOwnership: async () => true,
    }));

    const ctx = makeCtx({
      user: { id: 'host-1', role: 'user' },
      database: mockUpdate,
      notifs: fakeNotificationService,
      ws: fakeWsService,
      organizationId: 'org-1',
      _params: { booking: 'booking-1' },
      _body: { reason: 'Not available' },
    });

    const res = await rejectBooking(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('booking-1');
    expect((res as any).body.status).toBe('rejected');
    expect((res as any).body.cancelledAt).toBeDefined();
  });

  test('throws ConflictError when booking is not pending', async () => {
    const confirmedBooking = { ...fakeBooking, status: 'confirmed' };
    mocks = stubRepo(BookingRepository, {
      findOneById: async () => confirmedBooking,
    });
    mock.module('./utils/ownership', () => ({
      checkBookingHostOwnership: async () => true,
    }));

    const ctx = makeCtx({
      user: { id: 'host-1', role: 'user' },
      _params: { booking: 'booking-1' },
      _body: {},
    });

    await expect(rejectBooking(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });
});
