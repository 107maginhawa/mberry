/**
 * Tests for registerPersonJobs
 *
 * The person module registers two cron jobs:
 * - person.deletionProcessor (daily at midnight)
 * - person.dataExportPurge (daily at 03:00) — FIX-009
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerPersonJobs } from './index';
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
    jobId: 'job-person-001',
    jobName: 'person.deletionProcessor',
    data: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerPersonJobs', () => {
  test('registers person.deletionProcessor cron job', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerPersonJobs(scheduler);

    expect(registerCron).toHaveBeenCalledTimes(2);
    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('person.deletionProcessor');
    expect(schedule).toBe('0 0 * * *');
  });

  // FIX-009: export-payload purge job is registered alongside the deletion processor.
  test('registers person.dataExportPurge cron job', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerPersonJobs(scheduler);

    expect(registerCron).toHaveBeenCalledTimes(2);
    const [name, schedule] = registerCron.mock.calls[1];
    expect(name).toBe('person.dataExportPurge');
    expect(schedule).toBe('0 3 * * *');
  });

  test('handler is a callable function', () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    registerPersonJobs(scheduler);

    // The handler was captured; verify it's a function
    expect(capturedHandler!).toBeDefined();
    expect(typeof capturedHandler!).toBe('function');
  });
});
