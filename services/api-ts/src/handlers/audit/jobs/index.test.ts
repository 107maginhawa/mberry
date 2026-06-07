/**
 * Tests for audit background jobs (registerAuditJobs)
 *
 * The cron handler is a thin adapter: it imports AuditRepository,
 * calls archiveOldLogs() and purgeArchivedLogs(), and re-throws on failure.
 */

import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import { registerAuditJobs } from './index';
import type { JobScheduler, JobContext } from '@/core/jobs';
import { AuditRepository } from '../repos/audit.repo';

// Stub archiveOldLogs / purgeArchivedLogs on the real AuditRepository
// prototype using spyOn rather than mock.module — the latter is
// process-wide and would leak into audit.repo.test.ts via Bun's
// shared module registry, replacing the real class with a stub that
// lacks the methods under test there.
let archiveSpy: ReturnType<typeof spyOn> | null = null;
let purgeSpy: ReturnType<typeof spyOn> | null = null;
afterEach(() => {
  archiveSpy?.mockRestore();
  purgeSpy?.mockRestore();
  archiveSpy = null;
  purgeSpy = null;
});

// Mock-Classification: APPROPRIATE — audit logging infrastructure boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
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

    archiveSpy = spyOn(AuditRepository.prototype, 'archiveOldLogs')
      .mockResolvedValue(42);
    purgeSpy = spyOn(AuditRepository.prototype, 'purgeArchivedLogs')
      .mockResolvedValue(3);

    registerAuditJobs(scheduler);
    const context = makeContext();
    await capturedHandler!(context);

    expect(archiveSpy).toHaveBeenCalledWith(365);
    expect(purgeSpy).toHaveBeenCalledWith(2555);
  });

  test('logs error and re-throws on failure', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        capturedHandler = handler;
      }),
    } as any;

    const boom = new Error('database connection lost');

    archiveSpy = spyOn(AuditRepository.prototype, 'archiveOldLogs')
      .mockRejectedValue(boom);
    purgeSpy = spyOn(AuditRepository.prototype, 'purgeArchivedLogs')
      .mockResolvedValue(0);

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

    archiveSpy = spyOn(AuditRepository.prototype, 'archiveOldLogs')
      .mockResolvedValue(0);
    purgeSpy = spyOn(AuditRepository.prototype, 'purgeArchivedLogs')
      .mockResolvedValue(0);

    registerAuditJobs(scheduler);
    const context = makeContext();
    await capturedHandler!(context);

    const logger = context.logger as any;
    expect(logger.error).not.toHaveBeenCalled();
  });
});
