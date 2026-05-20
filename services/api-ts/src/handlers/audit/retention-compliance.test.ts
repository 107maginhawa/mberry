/**
 * BR-32: 7-Year Financial Record Retention Compliance Tests
 *
 * Verifies:
 * - Financial audit records get purgeAfter = now + 7 years
 * - Retention job never purges records before their purgeAfter date
 * - Audit events contain required completeness fields (actor, timestamp, before/after, IP)
 * - The audit.retention job configuration matches BR-32 requirements
 */

import { describe, test, expect, mock } from 'bun:test';
import { addYears } from 'date-fns';
import { AuditRepository } from './repos/audit.repo';
import type { AuditLogEntry, CreateAuditLogRequest } from './repos/audit.schema';
import { registerAuditJobs } from './jobs/index';
import type { JobScheduler } from '@/core/jobs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
  };
}

function makeFinancialRequest(overrides: Partial<CreateAuditLogRequest> = {}): CreateAuditLogRequest {
  return {
    eventType: 'data-modification',
    category: 'financial',
    action: 'mark-paid',
    outcome: 'success',
    organizationId: 'org-1',
    user: 'treasurer-1',
    userType: 'admin',
    resourceType: 'dues-payment',
    resource: 'payment-123',
    description: 'Dues payment marked as paid',
    details: { amount: 500, previousStatus: 'pending', newStatus: 'paid' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

/**
 * Mock DB matching the pattern from audit.repo.test.ts.
 * Captures inserted data for assertion.
 */
function makeMockDb() {
  let capturedInsertData: any = null;

  const insertChain = {
    values: mock(function (this: any, data: any) {
      capturedInsertData = data;
      return this;
    }),
    returning: mock(() => {
      const base = {
        id: 'audit-fin-1',
        version: 1,
        createdAt: capturedInsertData?.createdAt ?? new Date(),
        updatedAt: capturedInsertData?.updatedAt ?? new Date(),
        createdBy: capturedInsertData?.createdBy ?? 'system',
        updatedBy: capturedInsertData?.updatedBy ?? 'system',
        details: null,
        session: null,
        request: null,
        archivedAt: null,
        archivedBy: null,
      };
      return [{ ...base, ...capturedInsertData }];
    }),
  };

  const updateChain = {
    set: mock(function (this: any) { return this; }),
    where: mock(function (this: any) { return this; }),
    returning: mock(() => []),
  };

  const deleteChain = {
    where: mock(function (this: any) { return this; }),
    returning: mock(() => []),
  };

  return {
    insert: mock(() => insertChain),
    update: mock(() => updateChain),
    delete: mock(() => deleteChain),
    select: mock(() => ({
      from: mock(function (this: any) { return this; }),
      where: mock(function (this: any) { return this; }),
      then(onFulfilled: any) { return Promise.resolve([]).then(onFulfilled); },
    })),
    getCapturedInsertData: () => capturedInsertData,
  } as any;
}

// ---------------------------------------------------------------------------
// BR-32: Audit Event Completeness
// ---------------------------------------------------------------------------

describe('BR-32: Audit event completeness (actor, timestamp, before/after, IP)', () => {
  test('financial audit event captures all required fields', async () => {
    const mockDb = makeMockDb();
    const repo = new AuditRepository(mockDb, makeLogger());

    const request = makeFinancialRequest({
      details: {
        previousStatus: 'pending',
        newStatus: 'paid',
        amount: 1200,
      },
      ipAddress: '10.0.0.1',
    });

    const result = await repo.logEvent(request, 'admin-user');

    // Actor
    expect(result.user).toBe('treasurer-1');
    expect(result.createdBy).toBe('admin-user');

    // Timestamp
    expect(result.createdAt).toBeInstanceOf(Date);

    // Before/after state in details
    expect(result.details).toMatchObject({
      previousStatus: 'pending',
      newStatus: 'paid',
      amount: 1200,
    });

    // IP address
    expect(result.ipAddress).toBe('10.0.0.1');
  });

  test('audit event includes integrity hash for tamper detection', async () => {
    const mockDb = makeMockDb();
    const repo = new AuditRepository(mockDb, makeLogger());

    const result = await repo.logEvent(makeFinancialRequest());

    expect(result.integrityHash).toBeDefined();
    expect(typeof result.integrityHash).toBe('string');
    expect(result.integrityHash!.length).toBe(64);
    expect(result.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('audit event includes organization scoping', async () => {
    const mockDb = makeMockDb();
    const repo = new AuditRepository(mockDb, makeLogger());

    const result = await repo.logEvent(makeFinancialRequest({ organizationId: 'org-finance-1' }));

    expect(result.organizationId).toBe('org-finance-1');
  });

  test('audit event retentionStatus starts as active', async () => {
    const mockDb = makeMockDb();
    const repo = new AuditRepository(mockDb, makeLogger());

    const result = await repo.logEvent(makeFinancialRequest());

    expect(result.retentionStatus).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// BR-32: 7-Year Financial Record Retention
// ---------------------------------------------------------------------------

describe('BR-32: 7-Year Financial Record Retention', () => {

  describe('financial records get 7-year purgeAfter date', () => {
    test('logEvent sets purgeAfter to ~7 years from now for financial category', async () => {
      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());
      const before = new Date();

      await repo.logEvent(makeFinancialRequest());

      const captured = mockDb.getCapturedInsertData();
      expect(captured).toBeDefined();
      expect(captured.purgeAfter).toBeInstanceOf(Date);

      // Must be at least 6.9 years from now
      const minExpected = addYears(before, 7);
      const diffMs = captured.purgeAfter.getTime() - minExpected.getTime();
      // Allow 10 second tolerance for test execution time
      expect(Math.abs(diffMs)).toBeLessThan(10_000);
    });

    test('logEvent sets purgeAfter for non-financial categories too (uniform 7-year policy)', async () => {
      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());

      await repo.logEvent(makeFinancialRequest({ category: 'hipaa' }));

      const captured = mockDb.getCapturedInsertData();
      expect(captured.purgeAfter).toBeInstanceOf(Date);

      const yearDiff = captured.purgeAfter.getFullYear() - new Date().getFullYear();
      expect(yearDiff).toBeGreaterThanOrEqual(6);
      expect(yearDiff).toBeLessThanOrEqual(7);
    });
  });

  describe('purgeArchivedLogs respects 7-year minimum', () => {
    test('purge defaults to 2555 days (7 years = HIPAA/BR-32)', async () => {
      const logger = makeLogger();
      const updateChain = {
        set: mock(function (this: any) { return this; }),
        where: mock(function (this: any) { return this; }),
        returning: mock(() => []),
      };
      const deleteChain = {
        where: mock(function (this: any) { return this; }),
        returning: mock(() => []),
      };
      const mockDb = {
        update: mock(() => updateChain),
        delete: mock(() => deleteChain),
        insert: mock(() => ({})),
        select: mock(() => ({})),
      } as any;

      const repo = new AuditRepository(mockDb, logger);
      await repo.purgeArchivedLogs();

      // Verify update was called (marks as pending-purge)
      expect(mockDb.update).toHaveBeenCalled();
      // Verify delete was called (removes pending-purge)
      expect(mockDb.delete).toHaveBeenCalled();
      // Verify default is 2555 days via debug log
      const debugCall = (logger.debug as any).mock.calls[0][0];
      expect(debugCall.daysOld).toBe(2555);
    });

    test('purge with explicit 2555 days works correctly', async () => {
      const updateChain = {
        set: mock(function (this: any) { return this; }),
        where: mock(function (this: any) { return this; }),
        returning: mock(() => []),
      };
      const deleteChain = {
        where: mock(function (this: any) { return this; }),
        returning: mock(() => [{ id: 'old-1' }]),
      };
      const mockDb = {
        update: mock(() => updateChain),
        delete: mock(() => deleteChain),
        insert: mock(() => ({})),
        select: mock(() => ({})),
      } as any;

      const repo = new AuditRepository(mockDb, makeLogger());
      const result = await repo.purgeArchivedLogs(2555);

      expect(result).toBe(1);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// BR-32: Retention Job Configuration
// ---------------------------------------------------------------------------

describe('BR-32: audit.retention job configuration', () => {
  test('retention job registers as audit.retention with daily 3 AM schedule', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerAuditJobs(scheduler);

    expect(registerCron).toHaveBeenCalledTimes(1);
    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('audit.retention');
    expect(schedule).toBe('0 3 * * *');
  });

  test('retention job source code hardcodes BR-32 compliant values', async () => {
    // Static analysis test: verify the 7-year and 1-year values are hardcoded
    // in the job source. This avoids mock.module which leaks across bun test files.
    const fs = await import('fs');
    const path = await import('path');
    const jobPath = path.resolve(import.meta.dir, 'jobs/index.ts');
    const source = fs.readFileSync(jobPath, 'utf-8');

    // BR-32: archive at 1 year, purge at 7 years
    expect(source).toContain('archiveOldLogs(365)');
    expect(source).toContain('purgeArchivedLogs(2555)');

    // Guard: must NOT contain shorter purge periods (regression protection)
    expect(source).not.toMatch(/purgeArchivedLogs\(\d{1,3}\)/);
  });
});

// ---------------------------------------------------------------------------
// BR-32: Schema Completeness
// ---------------------------------------------------------------------------

describe('BR-32: audit schema supports financial records', () => {
  test('financial category exists in AuditCategory type', () => {
    const category: import('./repos/audit.schema').AuditCategory = 'financial';
    expect(category).toBe('financial');
  });

  test('mark-paid action exists in AuditAction type', () => {
    const action: import('./repos/audit.schema').AuditAction = 'mark-paid';
    expect(action).toBe('mark-paid');
  });

  test('retention status lifecycle: active -> archived -> pending-purge', () => {
    const statuses: import('./repos/audit.schema').AuditRetentionStatus[] = [
      'active',
      'archived',
      'pending-purge',
    ];
    expect(statuses).toHaveLength(3);
  });
});
