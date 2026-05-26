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

  test('handler delegates to processDeletions with db and logger', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    // Mock the deletionProcessor module
    const mockProcessDeletions = mock(async () => {});
    mock.module('./deletionProcessor', () => ({
      processDeletions: mockProcessDeletions,
    }));

    // Re-import to pick up mock
    const { registerPersonJobs: register } = await import('./index');
    register(scheduler);

    const context = makeContext();
    await capturedHandler!(context);

    expect(mockProcessDeletions).toHaveBeenCalledTimes(1);
    const [args] = mockProcessDeletions.mock.calls[0];
    expect(args).toMatchObject({
      db: context.db,
      logger: context.logger,
    });
  });
});
