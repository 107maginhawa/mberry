/**
 * Tests for registerPersonJobs
 *
 * The person module registers one cron job:
 * - person.deletionProcessor (daily at midnight)
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

    expect(registerCron).toHaveBeenCalledTimes(1);
    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('person.deletionProcessor');
    expect(schedule).toBe('0 0 * * *');
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
