/**
 * Tests for registerEmailJobs
 *
 * The email module registers two jobs:
 * - email.processor (interval, default 30s)
 * - email.cleanup (cron, daily at 4 AM)
 */

import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import { registerEmailJobs } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';
import type { EmailService } from '@/core/email';
import { EmailQueueRepository } from '../repos/queue.repo';

// Stub `cleanupOldEmails` on the real EmailQueueRepository prototype
// using spyOn — this avoids `mock.module('../repos/queue.repo')` which
// is process-wide and leaks across test files (notably into
// queue.repo.test.ts, which dynamic-imports the same module from
// registerEmailJobs at runtime and would observe the stub class).
// Each test below installs + restores the spy locally; the afterEach
// hook guarantees any test that throws still cleans up.
let cleanupSpy: ReturnType<typeof spyOn> | null = null;
afterEach(() => {
  cleanupSpy?.mockRestore();
  cleanupSpy = null;
});

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
    jobId: 'job-email-001',
    jobName: 'email.processor',
    data: undefined,
    ...overrides,
  };
}

function makeEmailService(): EmailService {
  return {
    processPendingEmails: mock(async () => {}),
    initializeDefaultTemplates: mock(async () => {}),
    queueEmail: mock(async () => ({} as any)),
    sendEmail: mock(async () => ({ success: true, provider: 'smtp' as const })),
    previewTemplate: mock(async () => ({} as any)),
    renderTemplate: mock(async () => ({} as any)),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerEmailJobs', () => {
  test('registers email.processor as interval job', () => {
    const registerInterval = mock(() => {});
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerInterval, registerCron } as any;

    // The dev/contract .env sets EMAIL_PROCESSOR_INTERVAL_MS=1000 (tighter loop
    // for auth-email latency); clear it here so this unit test verifies the
    // documented 30s default deterministically, regardless of ambient env.
    const prevInterval = process.env['EMAIL_PROCESSOR_INTERVAL_MS'];
    delete process.env['EMAIL_PROCESSOR_INTERVAL_MS'];
    try {
      registerEmailJobs(scheduler, makeEmailService());
    } finally {
      if (prevInterval !== undefined) process.env['EMAIL_PROCESSOR_INTERVAL_MS'] = prevInterval;
    }

    expect(registerInterval).toHaveBeenCalledTimes(1);
    const [name, interval] = registerInterval.mock.calls[0];
    expect(name).toBe('email.processor');
    expect(interval).toBe(30000); // default 30s
  });

  test('registers email.cleanup as cron job at 4 AM', () => {
    const registerInterval = mock(() => {});
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerInterval, registerCron } as any;

    registerEmailJobs(scheduler, makeEmailService());

    expect(registerCron).toHaveBeenCalledTimes(1);
    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('email.cleanup');
    expect(schedule).toBe('0 4 * * *');
  });

  test('cleanup handler calls cleanupOldEmails with 30 days', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const registerCron = mock((_n: string, _s: string, handler: any) => {
      capturedHandler = handler;
    });
    const scheduler: JobScheduler = {
      registerInterval: mock(() => {}),
      registerCron,
    } as any;

    cleanupSpy = spyOn(EmailQueueRepository.prototype, 'cleanupOldEmails')
      .mockResolvedValue(5);

    registerEmailJobs(scheduler, makeEmailService());

    const context = makeContext();
    await capturedHandler!(context);

    expect(cleanupSpy).toHaveBeenCalledWith(30);
  });

  test('cleanup handler logs error and re-throws on failure', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const registerCron = mock((_n: string, _s: string, handler: any) => {
      capturedHandler = handler;
    });
    const scheduler: JobScheduler = {
      registerInterval: mock(() => {}),
      registerCron,
    } as any;

    cleanupSpy = spyOn(EmailQueueRepository.prototype, 'cleanupOldEmails')
      .mockRejectedValue(new Error('DB error'));

    registerEmailJobs(scheduler, makeEmailService());

    const context = makeContext();
    await expect(capturedHandler!(context)).rejects.toThrow('DB error');

    expect((context.logger as any).error).toHaveBeenCalled();
  });

  test('cleanup handler does not call logger.error on success', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const registerCron = mock((_n: string, _s: string, handler: any) => {
      capturedHandler = handler;
    });
    const scheduler: JobScheduler = {
      registerInterval: mock(() => {}),
      registerCron,
    } as any;

    cleanupSpy = spyOn(EmailQueueRepository.prototype, 'cleanupOldEmails')
      .mockResolvedValue(0);

    registerEmailJobs(scheduler, makeEmailService());

    const context = makeContext();
    await capturedHandler!(context);

    expect((context.logger as any).error).not.toHaveBeenCalled();
  });
});
