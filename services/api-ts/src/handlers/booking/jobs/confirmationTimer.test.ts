/**
 * Tests for confirmationTimer job
 *
 * Tests cover:
 *   - isEligibleForAutoRejection (pure function)
 *   - getTimeUntilAutoRejection (pure function)
 *   - confirmationTimerJob orchestration logic via a db stub
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import {
  confirmationTimerJob,
  isEligibleForAutoRejection,
  getTimeUntilAutoRejection,
} from './confirmationTimer';
import { subMinutes, addMinutes } from 'date-fns';
import { notificationTypeEnum } from '@/handlers/notifs/repos/notification.schema';

// Mock-Classification: APPROPRIATE — background job with external scheduler
// ---------------------------------------------------------------------------
// isEligibleForAutoRejection — pure function, no DB
// ---------------------------------------------------------------------------

describe('isEligibleForAutoRejection', () => {
  test('returns false for non-pending booking', () => {
    const booking = {
      status: 'confirmed',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 20),
    };
    expect(isEligibleForAutoRejection(booking)).toBe(false);
  });

  test('returns false when already confirmed (has confirmationTimestamp)', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: new Date(),
      bookedAt: subMinutes(new Date(), 20),
    };
    expect(isEligibleForAutoRejection(booking)).toBe(false);
  });

  test('returns false when within the confirmation window (5 minutes ago)', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 5), // Only 5 min ago, window is 15
    };
    expect(isEligibleForAutoRejection(booking, 15)).toBe(false);
  });

  test('returns true when confirmation window has expired', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 20), // 20 min ago, window is 15
    };
    expect(isEligibleForAutoRejection(booking, 15)).toBe(true);
  });

  test('returns true exactly at the boundary (same as cutoff time)', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 15), // exactly 15 min ago
    };
    // bookedAt <= cutoffTime (which is 15 min ago from now)
    expect(isEligibleForAutoRejection(booking, 15)).toBe(true);
  });

  test('respects custom confirmationWindowMinutes', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 5),
    };
    // 5-minute window → booking is eligible after 5 min
    expect(isEligibleForAutoRejection(booking, 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTimeUntilAutoRejection — pure function, no DB
// ---------------------------------------------------------------------------

describe('getTimeUntilAutoRejection', () => {
  test('returns null for non-pending booking', () => {
    const booking = {
      status: 'confirmed',
      confirmationTimestamp: null,
      bookedAt: new Date(),
    };
    expect(getTimeUntilAutoRejection(booking)).toBeNull();
  });

  test('returns null when already confirmed', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: new Date(),
      bookedAt: new Date(),
    };
    expect(getTimeUntilAutoRejection(booking)).toBeNull();
  });

  test('returns 0 when window has already expired', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 30), // 30 min ago, window 15
    };
    expect(getTimeUntilAutoRejection(booking, 15)).toBe(0);
  });

  test('returns positive seconds when window is still open', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 5), // 5 min ago, window 15 → ~10 min left
    };
    const remaining = getTimeUntilAutoRejection(booking, 15);
    expect(remaining).toBeGreaterThan(0);
    // Roughly 10 minutes = 600 seconds (allow some drift)
    expect(remaining).toBeLessThanOrEqual(610);
    expect(remaining).toBeGreaterThanOrEqual(580);
  });

  test('returns seconds (not milliseconds) as integer', () => {
    const booking = {
      status: 'pending',
      confirmationTimestamp: null,
      bookedAt: subMinutes(new Date(), 2),
    };
    const remaining = getTimeUntilAutoRejection(booking, 15);
    // Should be a whole number (Math.floor)
    expect(Number.isInteger(remaining)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// confirmationTimerJob — orchestration
// ---------------------------------------------------------------------------

describe('confirmationTimerJob', () => {
  function makeLogger() {
    return {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    };
  }

  function makeNotificationService() {
    return {
      createNotification: mock(async () => {}),
    };
  }

  test('does nothing when there are no expired pending bookings', async () => {
    const logger = makeLogger();
    const notificationService = makeNotificationService();

    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]), // no expired bookings
          }),
        }),
      }),
      transaction: async (fn: any) => fn({}),
    };

    await confirmationTimerJob({ db, logger, jobId: 'test-job', notificationService } as any);

    // No error should be thrown, notification should not have been called
    expect(notificationService.createNotification.mock.calls.length).toBe(0);
  });

  test('auto-rejects expired pending bookings', async () => {
    const logger = makeLogger();
    const notificationService = makeNotificationService();

    const expiredBooking = {
      id: 'b-expired',
      client: 'client-1',
      host: 'host-1',
      slot: 'slot-1',
      status: 'pending',
      bookedAt: subMinutes(new Date(), 20),
      scheduledAt: addMinutes(new Date(), 60),
    };

    let updateCalled = false;
    const txStub: any = {
      update: () => ({
        set: () => ({
          where: () => {
            updateCalled = true;
            return Promise.resolve();
          },
        }),
      }),
    };

    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([expiredBooking]),
          }),
        }),
      }),
      transaction: async (fn: any) => fn(txStub),
    };

    await confirmationTimerJob({ db, logger, jobId: 'test-job', notificationService } as any);

    expect(updateCalled).toBe(true);
  });

  test('sends notifications to both client and host after auto-rejection', async () => {
    const logger = makeLogger();
    const notificationService = makeNotificationService();

    const expiredBooking = {
      id: 'b-2',
      client: 'client-2',
      host: 'host-2',
      slot: 'slot-2',
      status: 'pending',
      bookedAt: subMinutes(new Date(), 20),
      scheduledAt: addMinutes(new Date(), 120),
    };

    const txStub: any = {
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    };

    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([expiredBooking]),
          }),
        }),
      }),
      transaction: async (fn: any) => fn(txStub),
    };

    await confirmationTimerJob({ db, logger, jobId: 'test-job', notificationService } as any);

    // Should have notified both client and host (2 calls)
    expect(notificationService.createNotification.mock.calls.length).toBe(2);

    const recipients = notificationService.createNotification.mock.calls.map(
      (call: any) => call[0].recipient
    );
    expect(recipients).toContain('client-2');
    expect(recipients).toContain('host-2');
  });

  test('[EX-BOOK-NOTF] auto-rejection notifications use enum-valid notification types', async () => {
    const logger = makeLogger();
    const notificationService = makeNotificationService();

    const expiredBooking = {
      id: 'b-enum',
      client: 'client-e',
      host: 'host-e',
      slot: 'slot-e',
      status: 'pending',
      bookedAt: subMinutes(new Date(), 20),
      scheduledAt: addMinutes(new Date(), 90),
    };

    const txStub: any = {
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    };
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([expiredBooking]) }),
        }),
      }),
      transaction: async (fn: any) => fn(txStub),
    };

    await confirmationTimerJob({ db, logger, jobId: 'test-job', notificationService } as any);

    const validTypes = notificationTypeEnum.enumValues as readonly string[];
    const emittedTypes = notificationService.createNotification.mock.calls.map(
      (call: any) => call[0].type,
    );
    expect(emittedTypes.length).toBe(2);
    for (const t of emittedTypes) {
      expect(validTypes).toContain(t);
    }
  });

  test('continues processing remaining bookings when one fails', async () => {
    const logger = makeLogger();
    const notificationService = makeNotificationService();

    const goodBooking = {
      id: 'b-good',
      client: 'c-good',
      host: 'h-good',
      slot: 's-good',
      status: 'pending',
      bookedAt: subMinutes(new Date(), 20),
    };
    const badBooking = {
      id: 'b-bad',
      client: 'c-bad',
      host: 'h-bad',
      slot: 's-bad',
      status: 'pending',
      bookedAt: subMinutes(new Date(), 20),
    };

    let txCallCount = 0;
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([badBooking, goodBooking]),
          }),
        }),
      }),
      transaction: async (fn: any) => {
        txCallCount++;
        if (txCallCount === 1) throw new Error('DB error on first booking');
        const txStub: any = {
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return fn(txStub);
      },
    };

    // Should not throw even though first booking fails
    await expect(
      confirmationTimerJob({ db, logger, jobId: 'test-job', notificationService } as any)
    ).resolves.toBeUndefined();

    // Warn should have been called about failed bookings
    expect(logger.warn.mock.calls.length).toBeGreaterThan(0);
  });

  test('releases associated slot when auto-rejecting', async () => {
    const logger = makeLogger();
    const notificationService = makeNotificationService();

    const expiredBooking = {
      id: 'b-3',
      client: 'c-3',
      host: 'h-3',
      slot: 'slot-to-release',
      status: 'pending',
      bookedAt: subMinutes(new Date(), 20),
    };

    // Count how many times update().set().where() is invoked inside the transaction
    let updateCallCount = 0;
    const txStub: any = {
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: () => {
            updateCallCount++;
            return Promise.resolve();
          },
        }),
      }),
    };

    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([expiredBooking]),
          }),
        }),
      }),
      transaction: async (fn: any) => fn(txStub),
    };

    await confirmationTimerJob({ db, logger, jobId: 'test-job', notificationService } as any);

    // Two updates inside the transaction: one for booking status, one for slot release
    expect(updateCallCount).toBe(2);
  });
});
