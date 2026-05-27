/**
 * Tests for registerBookingJobs and booking job utilities
 *
 * The booking module registers three jobs:
 * - booking.slotGenerator (cron, daily at 2 AM)
 * - booking.confirmationTimer (interval, every 60s)
 * - booking.slotCleanup (cron, daily at 3 AM)
 *
 * Also tests getBookingJobsHealth utility.
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerBookingJobs, getBookingJobsHealth } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';

// Mock-Classification: APPROPRIATE — job registration glue layer

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotifsService(): NotificationService {
  return {
    createNotification: mock(async () => ({} as any)),
    processScheduledNotifications: mock(async () => {}),
    cleanupExpiredNotifications: mock(async () => {}),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerBookingJobs', () => {
  test('registers booking.slotGenerator as cron at 2 AM', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    registerBookingJobs(scheduler, makeNotifsService());

    // Should have 2 cron registrations (slotGenerator + slotCleanup)
    expect(registerCron).toHaveBeenCalledTimes(2);

    const slotGenCall = registerCron.mock.calls.find((c: any) => c[0] === 'booking.slotGenerator');
    expect(slotGenCall).toBeDefined();
    expect(slotGenCall![1]).toBe('0 2 * * *');
  });

  test('registers booking.confirmationTimer as interval every 60s', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    registerBookingJobs(scheduler, makeNotifsService());

    expect(registerInterval).toHaveBeenCalledTimes(1);
    const [name, interval] = registerInterval.mock.calls[0];
    expect(name).toBe('booking.confirmationTimer');
    expect(interval).toBe(60000);
  });

  test('registers booking.slotCleanup as cron at 3 AM', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    registerBookingJobs(scheduler, makeNotifsService());

    const cleanupCall = registerCron.mock.calls.find((c: any) => c[0] === 'booking.slotCleanup');
    expect(cleanupCall).toBeDefined();
    expect(cleanupCall![1]).toBe('0 3 * * *');
  });

  test('confirmationTimer handler is registered as a callable function', () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const registerCron = mock(() => {});
    const registerInterval = mock((_n: string, _i: number, handler: any) => {
      capturedHandler = handler;
    });
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    const notifsService = makeNotifsService();
    registerBookingJobs(scheduler, notifsService);

    // The handler was captured; verify it's a function
    expect(capturedHandler!).toBeDefined();
    expect(typeof capturedHandler!).toBe('function');
  });
});

describe('getBookingJobsHealth', () => {
  test('returns healthy when scheduler reports healthy', async () => {
    const scheduler: JobScheduler = {
      getHealth: mock(async () => ({ healthy: true, queues: {} })),
    } as any;

    const result = await getBookingJobsHealth(scheduler);

    expect(result.overallHealth).toBe('healthy');
  });

  test('returns unhealthy when scheduler reports unhealthy', async () => {
    const scheduler: JobScheduler = {
      getHealth: mock(async () => ({ healthy: false, queues: {} })),
    } as any;

    const result = await getBookingJobsHealth(scheduler);

    expect(result.overallHealth).toBe('unhealthy');
  });

  test('returns unhealthy on scheduler error', async () => {
    const scheduler: JobScheduler = {
      getHealth: mock(async () => { throw new Error('connection refused'); }),
    } as any;

    const result = await getBookingJobsHealth(scheduler);

    expect(result.overallHealth).toBe('unhealthy');
    expect(result.details?.error).toBe('connection refused');
  });
});
