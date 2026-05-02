/**
 * Tests for confirmBooking handler
 *
 * The handler:
 *   1. Resolves the booking by param ID
 *   2. Enforces host-only ownership (checkBookingHostOwnership)
 *   3. Calls repo.confirmBooking to transition pending → confirmed
 *   4. Sends notifications (non-blocking)
 *   5. Returns 200 JSON
 *
 * We patch BookingRepository prototype methods to avoid a real DB.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { confirmBooking } from './confirmBooking';
import { NotFoundError, ForbiddenError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    client: 'client-1',
    host: 'host-1',
    slot: 'slot-1',
    status: 'pending',
    scheduledAt: new Date('2026-06-01T10:00:00Z'),
    confirmationTimestamp: null,
    ...overrides,
  };
}

function makeCtx({
  userId = 'host-1',
  bookingParam = 'booking-1',
  notificationService = {
    createNotification: mock(async () => {}),
  },
  wsService = {
    publishToUser: mock(async () => {}),
  },
}: {
  userId?: string;
  bookingParam?: string;
  notificationService?: any;
  wsService?: any;
} = {}) {
  const store: Record<string, any> = {
    user: { id: userId },
    database: {},
    logger: {
      info: () => {},
      debug: () => {},
      error: () => {},
    },
    auth: {},
    notifs: notificationService,
    ws: wsService,
  };

  return {
    get: (key: string) => store[key],
    req: {
      valid: (type: string) => {
        if (type === 'param') return { booking: bookingParam };
        if (type === 'json') return { reason: 'Confirming appointment' };
        return {};
      },
      header: (_name: string) => undefined,
    },
    json: (data: any, status: number) => ({ data, status }),
  };
}

// ---------------------------------------------------------------------------
// State transition: pending → confirmed
// ---------------------------------------------------------------------------

describe('confirmBooking handler — state transition', () => {
  test('returns 200 with confirmed booking when host owns the booking', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;
    const origConfirm = BookingRepository.prototype.confirmBooking;

    const pending = makeBooking({ status: 'pending', host: 'host-1' });
    const confirmed = makeBooking({ status: 'confirmed', confirmationTimestamp: new Date() });

    BookingRepository.prototype.findOneById = mock(async () => pending);
    BookingRepository.prototype.confirmBooking = mock(async () => confirmed);

    const ctx = makeCtx({ userId: 'host-1' });
    const response = await confirmBooking(ctx as any);

    expect(response.status).toBe(200);
    expect(response.data.status).toBe('confirmed');
    expect(response.data.confirmationTimestamp).toBeTruthy();

    BookingRepository.prototype.findOneById = origFind;
    BookingRepository.prototype.confirmBooking = origConfirm;
  });

  test('calls repo.confirmBooking with the booking id from params', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;
    const origConfirm = BookingRepository.prototype.confirmBooking;

    let capturedId: string | undefined;
    BookingRepository.prototype.findOneById = mock(async () =>
      makeBooking({ host: 'host-1' })
    );
    BookingRepository.prototype.confirmBooking = mock(async (id: string) => {
      capturedId = id;
      return makeBooking({ status: 'confirmed', host: 'host-1' });
    });

    const ctx = makeCtx({ userId: 'host-1', bookingParam: 'booking-abc' });
    await confirmBooking(ctx as any);

    expect(capturedId).toBe('booking-abc');

    BookingRepository.prototype.findOneById = origFind;
    BookingRepository.prototype.confirmBooking = origConfirm;
  });
});

// ---------------------------------------------------------------------------
// NotFoundError when booking doesn't exist
// ---------------------------------------------------------------------------

describe('confirmBooking handler — not found', () => {
  test('throws NotFoundError when booking does not exist', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;

    BookingRepository.prototype.findOneById = mock(async () => null);

    const ctx = makeCtx({ userId: 'host-1', bookingParam: 'nonexistent' });
    await expect(confirmBooking(ctx as any)).rejects.toThrow(NotFoundError);

    BookingRepository.prototype.findOneById = origFind;
  });
});

// ---------------------------------------------------------------------------
// Permission check: only host can confirm
// ---------------------------------------------------------------------------

describe('confirmBooking handler — permission check', () => {
  test('throws ForbiddenError when authenticated user is the client, not host', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;

    BookingRepository.prototype.findOneById = mock(async () =>
      makeBooking({ host: 'host-1', client: 'client-1' })
    );

    // Authenticated as client, not as the host
    const ctx = makeCtx({ userId: 'client-1' });
    await expect(confirmBooking(ctx as any)).rejects.toThrow(ForbiddenError);

    BookingRepository.prototype.findOneById = origFind;
  });

  test('throws ForbiddenError when authenticated user is an unrelated third party', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;

    BookingRepository.prototype.findOneById = mock(async () =>
      makeBooking({ host: 'host-1', client: 'client-1' })
    );

    const ctx = makeCtx({ userId: 'stranger-99' });
    await expect(confirmBooking(ctx as any)).rejects.toThrow(ForbiddenError);

    BookingRepository.prototype.findOneById = origFind;
  });
});

// ---------------------------------------------------------------------------
// Notification sending (non-blocking)
// ---------------------------------------------------------------------------

describe('confirmBooking handler — notifications', () => {
  test('sends in-app notification to client after confirmation', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;
    const origConfirm = BookingRepository.prototype.confirmBooking;

    BookingRepository.prototype.findOneById = mock(async () =>
      makeBooking({ host: 'host-1', client: 'client-1' })
    );
    BookingRepository.prototype.confirmBooking = mock(async () =>
      makeBooking({ status: 'confirmed', host: 'host-1', client: 'client-1' })
    );

    const notificationService = { createNotification: mock(async () => {}) };
    const wsService = { publishToUser: mock(async () => {}) };

    const ctx = makeCtx({ userId: 'host-1', notificationService, wsService });
    await confirmBooking(ctx as any);

    // Should have sent at least 2 notifications (client + host)
    expect(notificationService.createNotification.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('does not throw if notification service fails', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const origFind = BookingRepository.prototype.findOneById;
    const origConfirm = BookingRepository.prototype.confirmBooking;

    BookingRepository.prototype.findOneById = mock(async () =>
      makeBooking({ host: 'host-1', client: 'client-1' })
    );
    BookingRepository.prototype.confirmBooking = mock(async () =>
      makeBooking({ status: 'confirmed', host: 'host-1', client: 'client-1' })
    );

    const failingNotifService = {
      createNotification: mock(async () => {
        throw new Error('notification service down');
      }),
    };
    const wsService = {
      publishToUser: mock(async () => {
        throw new Error('ws down');
      }),
    };

    const ctx = makeCtx({ userId: 'host-1', notificationService: failingNotifService, wsService });
    // Should NOT throw — notification failures are non-blocking
    const response = await confirmBooking(ctx as any);
    expect(response.status).toBe(200);

    BookingRepository.prototype.findOneById = origFind;
    BookingRepository.prototype.confirmBooking = origConfirm;
  });
});
