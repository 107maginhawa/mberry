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

  test('handler delegates to processGraceToLapsed with db and logger', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const mockProcess = mock(async () => ({
      transitioned: 0, skipped: 0, errors: 0, notified: 0,
    }));
    mock.module('./graceToLapsed', () => ({
      processGraceToLapsed: mockProcess,
    }));

    const { registerMembershipJobs: register } = await import('./index');
    register(scheduler);

    const context = makeContext();
    await capturedHandler!(context);

    expect(mockProcess).toHaveBeenCalledTimes(1);
    const [args] = mockProcess.mock.calls[0];
    expect(args.db).toBe(context.db);
    expect(args.logger).toBe(context.logger);
  });

  test('passes createNotification callback when notifs service provided', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const mockProcess = mock(async () => ({
      transitioned: 0, skipped: 0, errors: 0, notified: 0,
    }));
    mock.module('./graceToLapsed', () => ({
      processGraceToLapsed: mockProcess,
    }));

    const notifsService: NotificationService = {
      createNotification: mock(async () => ({} as any)),
    } as any;

    const { registerMembershipJobs: register } = await import('./index');
    register(scheduler, notifsService);

    const context = makeContext();
    await capturedHandler!(context);

    const [args] = mockProcess.mock.calls[0];
    expect(args.createNotification).toBeDefined();
    expect(typeof args.createNotification).toBe('function');
  });

  test('does not pass createNotification when notifs service is absent', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const mockProcess = mock(async () => ({
      transitioned: 0, skipped: 0, errors: 0, notified: 0,
    }));
    mock.module('./graceToLapsed', () => ({
      processGraceToLapsed: mockProcess,
    }));

    const { registerMembershipJobs: register } = await import('./index');
    register(scheduler); // no notifs

    const context = makeContext();
    await capturedHandler!(context);

    const [args] = mockProcess.mock.calls[0];
    expect(args.createNotification).toBeUndefined();
  });
});
