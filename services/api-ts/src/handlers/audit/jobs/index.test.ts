/**
 * Tests for audit background jobs (registerAuditJobs)
 *
 * The cron handler is a thin adapter: it imports AuditRepository,
 * calls archiveOldLogs() and purgeArchivedLogs(), and re-throws on failure.
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerAuditJobs } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeContext(overrides: Partial<JobContext> = {}): JobContext {
  const logger = makeLogger();
  return {
    db: {} as any,
    logger: logger as any,
    jobId: 'job-audit-001',
    jobName: 'audit.retention',
    data: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAuditJobs', () => {
  test('registers audit.retention cron job', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerAuditJobs(scheduler);

    expect(registerCron).toHaveBeenCalledTimes(1);
    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('audit.retention');
    expect(schedule).toBe('0 3 * * *');
  });

  test('calls archiveOldLogs and purgeArchivedLogs on execution', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const mockArchive = mock(async () => 42);
    const mockPurge = mock(async () => 3);

    // Mock the dynamic import of AuditRepository
    mock.module('../repos/audit.repo', () => ({
      AuditRepository: class {
        archiveOldLogs = mockArchive;
        purgeArchivedLogs = mockPurge;
      },
    }));

    registerAuditJobs(scheduler);
    const context = makeContext();
    await capturedHandler!(context);

    expect(mockArchive).toHaveBeenCalledWith(365);
    expect(mockPurge).toHaveBeenCalledWith(2555);
  });

  test('logs error and re-throws on failure', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const boom = new Error('database connection lost');

    mock.module('../repos/audit.repo', () => ({
      AuditRepository: class {
        archiveOldLogs = mock(async () => { throw boom; });
        purgeArchivedLogs = mock(async () => 0);
      },
    }));

    registerAuditJobs(scheduler);
    const context = makeContext();

    await expect(capturedHandler!(context)).rejects.toThrow('database connection lost');

    const logger = context.logger as any;
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [errorPayload] = (logger.error as ReturnType<typeof mock>).mock.calls[0];
    expect(errorPayload).toMatchObject({ jobId: 'job-audit-001' });
  });

  test('does not call logger.error on success', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    mock.module('../repos/audit.repo', () => ({
      AuditRepository: class {
        archiveOldLogs = mock(async () => 0);
        purgeArchivedLogs = mock(async () => 0);
      },
    }));

    registerAuditJobs(scheduler);
    const context = makeContext();
    await capturedHandler!(context);

    const logger = context.logger as any;
    expect(logger.error).not.toHaveBeenCalled();
  });
});
