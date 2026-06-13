/**
 * Tests for registerDuesJobs (association:member jobs index)
 *
 * Registers multiple jobs:
 * - dues.reminderProcessor (cron, daily at midnight)
 * - dues.webhookRetryProcessor (interval, every 60s)
 * - attendance.confirmed (delayed)
 * - credit.issue (delayed)
 * - compliance.threshold_met (delayed)
 * - certificate.bulk_generate (delayed)
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerDuesJobs } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';

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
    jobId: 'job-dues-001',
    jobName: 'dues.reminderProcessor',
    data: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDuesJobs', () => {
  test('registers dues.reminderProcessor as daily midnight cron', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const registerDelayed = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval, registerDelayed } as any;

    registerDuesJobs(scheduler);

    const reminderCall = registerCron.mock.calls.find((c: any) => c[0] === 'dues.reminderProcessor');
    expect(reminderCall).toBeDefined();
    expect(reminderCall![1]).toBe('0 0 * * *');
  });

  test('registers member.licenseRenewalProcessor as a daily cron (FIX-007)', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const registerDelayed = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval, registerDelayed } as any;

    registerDuesJobs(scheduler);

    const licenseCall = registerCron.mock.calls.find((c: any) => c[0] === 'member.licenseRenewalProcessor');
    expect(licenseCall).toBeDefined();
    expect(licenseCall![1]).toBe('0 1 * * *');
  });

  test('registers dues.webhookRetryProcessor as 60s interval', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const registerDelayed = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval, registerDelayed } as any;

    registerDuesJobs(scheduler);

    expect(registerInterval).toHaveBeenCalledTimes(1);
    const [name, interval] = registerInterval.mock.calls[0];
    expect(name).toBe('dues.webhookRetryProcessor');
    expect(interval).toBe(60_000);
  });

  test('registers four delayed jobs for credit pipeline', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const registerDelayed = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval, registerDelayed } as any;

    registerDuesJobs(scheduler);

    expect(registerDelayed).toHaveBeenCalledTimes(4);

    const delayedNames = registerDelayed.mock.calls.map((c: any) => c[0]);
    expect(delayedNames).toContain('attendance.confirmed');
    expect(delayedNames).toContain('credit.issue');
    expect(delayedNames).toContain('compliance.threshold_met');
    expect(delayedNames).toContain('certificate.bulk_generate');
  });

  test('attendance.confirmed handler triggers credit.issue job', async () => {
    const handlers: Record<string, (ctx: JobContext) => Promise<void>> = {};
    const triggerMock = mock(async () => 'triggered-job-id');
    const scheduler: JobScheduler = {
      registerCron: mock(() => {}),
      registerInterval: mock(() => {}),
      registerDelayed: mock((_n: string, _d: number, handler: any) => {
        handlers[_n] = handler;
      }),
      trigger: triggerMock,
    } as any;

    registerDuesJobs(scheduler);

    const context = makeContext({
      data: {
        checkinId: 'checkin-1',
        personId: 'person-1',
        organizationId: 'org-1',
        creditAmount: 5,
        cpdActivityType: 'lecture',
        attestation: { verified: true },
      },
    });

    await handlers['attendance.confirmed']!(context);

    expect(triggerMock).toHaveBeenCalledWith('credit.issue', expect.objectContaining({
      sourceType: 'event_checkin',
      sourceId: 'checkin-1',
      personId: 'person-1',
      organizationId: 'org-1',
      creditAmount: 5,
    }));
  });

  test('compliance.threshold_met handler runs processComplianceThreshold without error', async () => {
    const handlers: Record<string, (ctx: JobContext) => Promise<void>> = {};
    const scheduler: JobScheduler = {
      registerCron: mock(() => {}),
      registerInterval: mock(() => {}),
      registerDelayed: mock((_n: string, _d: number, handler: any) => {
        handlers[_n] = handler;
      }),
      trigger: mock(async () => 'job-id'),
    } as any;

    registerDuesJobs(scheduler);

    // Provide valid payload so processComplianceThreshold logs info, not error
    const context = makeContext({
      data: {
        personId: 'p-1',
        organizationId: 'o-1',
        totalCredits: 65,
        requiredCredits: 60,
      },
    });

    // Should complete without throwing
    await expect(handlers['compliance.threshold_met']!(context)).resolves.toBeUndefined();
  });

  test('credit.issue handler is registered and callable', async () => {
    const handlers: Record<string, (ctx: JobContext) => Promise<void>> = {};
    const scheduler: JobScheduler = {
      registerCron: mock(() => {}),
      registerInterval: mock(() => {}),
      registerDelayed: mock((_n: string, _d: number, handler: any) => {
        handlers[_n] = handler;
      }),
      trigger: mock(async () => 'triggered-job-id'),
    } as any;

    registerDuesJobs(scheduler);

    // Verify the handler exists
    expect(handlers['credit.issue']).toBeDefined();
    expect(typeof handlers['credit.issue']).toBe('function');
  });
});
