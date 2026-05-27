/**
 * Tests for registerNotifsJobs
 *
 * The notification module registers two cron jobs:
 * - notifs.processScheduled (every 5 minutes)
 * - notifs.cleanup (daily at midnight)
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerNotifsJobs } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';

// Mock-Classification: APPROPRIATE — notification infrastructure boundary

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeContext(overrides: Partial<JobContext> = {}): JobContext {
  return {
    db: {} as any,
    logger: makeLogger() as any,
    jobId: 'job-notifs-001',
    jobName: 'notifs.processScheduled',
    data: undefined,
    ...overrides,
  };
}

function makeNotifsService(): NotificationService {
  return {
    processScheduledNotifications: mock(async () => {}),
    cleanupExpiredNotifications: mock(async (_days: number) => {}),
    createNotification: mock(async () => ({} as any)),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerNotifsJobs', () => {
  test('registers two cron jobs', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;
    const notifsService = makeNotifsService();

    registerNotifsJobs(scheduler, notifsService);

    expect(registerCron).toHaveBeenCalledTimes(2);
  });

  test('registers notifs.processScheduled with 5-minute cron', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;
    const notifsService = makeNotifsService();

    registerNotifsJobs(scheduler, notifsService);

    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('notifs.processScheduled');
    expect(schedule).toBe('*/5 * * * *');
  });

  test('registers notifs.cleanup with daily midnight cron', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;
    const notifsService = makeNotifsService();

    registerNotifsJobs(scheduler, notifsService);

    const [name, schedule] = registerCron.mock.calls[1];
    expect(name).toBe('notifs.cleanup');
    expect(schedule).toBe('0 0 * * *');
  });

  test('processScheduled handler calls notifsService.processScheduledNotifications', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        if (_n === 'notifs.processScheduled') capturedHandler = handler;
      }),
    } as any;
    const notifsService = makeNotifsService();

    registerNotifsJobs(scheduler, notifsService);
    await capturedHandler!(makeContext());

    expect(notifsService.processScheduledNotifications).toHaveBeenCalledTimes(1);
  });

  test('cleanup handler calls cleanupExpiredNotifications with 90 days', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        if (_n === 'notifs.cleanup') capturedHandler = handler;
      }),
    } as any;
    const notifsService = makeNotifsService();

    registerNotifsJobs(scheduler, notifsService);
    await capturedHandler!(makeContext());

    expect(notifsService.cleanupExpiredNotifications).toHaveBeenCalledWith(90);
  });
});
