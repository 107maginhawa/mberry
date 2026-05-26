/**
 * Tests for registerDuesJobs (dues module)
 *
 * The dues module registers three jobs:
 * - dues.reminderProcessor (cron, daily at midnight)
 * - dues.autoInvoiceGenerator (cron, daily at 1 AM)
 * - dues.webhookRetryProcessor (interval, every 60s)
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
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    registerDuesJobs(scheduler);

    const reminderCall = registerCron.mock.calls.find((c: any) => c[0] === 'dues.reminderProcessor');
    expect(reminderCall).toBeDefined();
    expect(reminderCall![1]).toBe('0 0 * * *');
  });

  test('registers dues.autoInvoiceGenerator as daily 1 AM cron', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    registerDuesJobs(scheduler);

    const autoInvoiceCall = registerCron.mock.calls.find((c: any) => c[0] === 'dues.autoInvoiceGenerator');
    expect(autoInvoiceCall).toBeDefined();
    expect(autoInvoiceCall![1]).toBe('0 1 * * *');
  });

  test('registers dues.webhookRetryProcessor as 60s interval', () => {
    const registerCron = mock(() => {});
    const registerInterval = mock(() => {});
    const scheduler: JobScheduler = { registerCron, registerInterval } as any;

    registerDuesJobs(scheduler);

    expect(registerInterval).toHaveBeenCalledTimes(1);
    const [name, interval] = registerInterval.mock.calls[0];
    expect(name).toBe('dues.webhookRetryProcessor');
    expect(interval).toBe(60_000);
  });

  test('reminderProcessor handler delegates to processDuesReminders', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        if (_n === 'dues.reminderProcessor') capturedHandler = handler;
      }),
      registerInterval: mock(() => {}),
    } as any;

    const mockProcessReminders = mock(async () => {});
    mock.module('./reminderProcessor', () => ({
      processDuesReminders: mockProcessReminders,
    }));

    const { registerDuesJobs: register } = await import('./index');
    register(scheduler);

    const context = makeContext();
    await capturedHandler!(context);

    expect(mockProcessReminders).toHaveBeenCalledTimes(1);
    const [args] = mockProcessReminders.mock.calls[0];
    expect(args).toMatchObject({
      db: context.db,
      logger: context.logger,
    });
  });

  test('autoInvoiceGenerator handler delegates to generateAutoInvoices', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        if (_n === 'dues.autoInvoiceGenerator') capturedHandler = handler;
      }),
      registerInterval: mock(() => {}),
    } as any;

    const mockGenerate = mock(async () => {});
    mock.module('./autoInvoiceGenerator', () => ({
      generateAutoInvoices: mockGenerate,
    }));

    const { registerDuesJobs: register } = await import('./index');
    register(scheduler);

    const context = makeContext();
    await capturedHandler!(context);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const [args] = mockGenerate.mock.calls[0];
    expect(args).toMatchObject({
      db: context.db,
      logger: context.logger,
    });
  });

  test('webhookRetryProcessor handler delegates to processWebhookRetry', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock(() => {}),
      registerInterval: mock((_n: string, _i: number, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const mockProcessRetry = mock(async () => {});
    mock.module('./webhookRetryProcessor', () => ({
      processWebhookRetry: mockProcessRetry,
    }));

    const { registerDuesJobs: register } = await import('./index');
    register(scheduler);

    const context = makeContext();
    await capturedHandler!(context);

    expect(mockProcessRetry).toHaveBeenCalledTimes(1);
    const [args] = mockProcessRetry.mock.calls[0];
    expect(args.db).toBe(context.db);
    expect(args.logger).toBe(context.logger);
    expect(args.now).toBeInstanceOf(Date);
    expect(typeof args.processPayment).toBe('function');
  });
});
