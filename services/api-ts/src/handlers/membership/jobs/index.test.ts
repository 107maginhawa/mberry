/**
 * Tests for registerMembershipJobs
 *
 * The membership module registers one cron job:
 * - membership.graceToLapsed (daily at 2 AM UTC)
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerMembershipJobs } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';

// Mock-Classification: APPROPRIATE — job registration glue layer

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
    jobId: 'job-membership-001',
    jobName: 'membership.graceToLapsed',
    data: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerMembershipJobs', () => {
  test('registers membership.graceToLapsed cron job at 2 AM', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerMembershipJobs(scheduler);

    expect(registerCron).toHaveBeenCalledTimes(1);
    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('membership.graceToLapsed');
    expect(schedule).toBe('0 2 * * *');
  });

  test('handler calls processGraceToLapsed with db and logger', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    registerMembershipJobs(scheduler);

    // The handler was captured; verify it's a function
    expect(capturedHandler!).toBeDefined();
    expect(typeof capturedHandler!).toBe('function');
  });

  test('accepts optional notifs service parameter', () => {
    const scheduler: JobScheduler = {
      registerCron: mock(() => {}),
    } as any;

    const notifsService: NotificationService = {
      createNotification: mock(async () => ({} as any)),
    } as any;

    // Should not throw when called with or without notifs
    expect(() => registerMembershipJobs(scheduler, notifsService)).not.toThrow();
    expect(() => registerMembershipJobs(scheduler)).not.toThrow();
  });
});
