/**
 * Tests for slotCleanupJob
 *
 * Tests the daily cleanup job that archives old available/blocked slots
 * and completed bookings. Uses db stubs following the confirmationTimer test pattern.
 */

import { describe, test, expect, mock } from 'bun:test';
import { slotCleanupJob, getCleanupStatistics } from './slotCleanup';
import type { JobContext } from '@/core/jobs';

// Mock-Classification: APPROPRIATE — background job with DB queries

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
    jobId: 'job-cleanup-001',
    jobName: 'booking.slotCleanup',
    data: undefined,
    ...overrides,
  };
}

/**
 * Build a mock db that handles the slotCleanup query chain.
 * selectResponses: array of arrays — each call to select().from().where().limit() returns next item.
 * deleteResponses: array of arrays — each call to delete().where().returning() returns next item.
 */
function buildCleanupDb(options: {
  selectBatches?: any[][];
  deleteResults?: any[][];
  transactionFn?: (fn: any) => Promise<void>;
  executeFn?: () => Promise<void>;
} = {}) {
  const { selectBatches = [[]], deleteResults = [[]], transactionFn, executeFn } = options;
  let selectIdx = 0;
  let deleteIdx = 0;

  return {
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        where: (_conditions?: any) => {
          const batch = selectIdx < selectBatches.length ? selectBatches[selectIdx++]! : [];
          return {
            limit: (_n: number) => Promise.resolve(batch),
            // For count queries (getCleanupStatistics)
            then: (resolve: any) => resolve(batch),
          };
        },
        limit: (_n: number) => {
          const batch = selectIdx < selectBatches.length ? selectBatches[selectIdx++]! : [];
          return Promise.resolve(batch);
        },
      }),
    }),
    delete: (_table: any) => ({
      where: (_conditions?: any) => ({
        returning: (_fields?: any) => {
          const result = deleteIdx < deleteResults.length ? deleteResults[deleteIdx++]! : [];
          return Promise.resolve(result);
        },
      }),
    }),
    transaction: transactionFn ?? (async (fn: any) => fn({
      delete: (_table: any) => ({
        where: (_conditions?: any) => ({
          returning: (_fields?: any) => {
            const result = deleteIdx < deleteResults.length ? deleteResults[deleteIdx++]! : [];
            return Promise.resolve(result);
          },
        }),
      }),
    })),
    execute: executeFn ?? mock(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slotCleanupJob', () => {
  test('completes successfully with no records to clean', async () => {
    const db = buildCleanupDb({
      // All select queries return empty arrays (no old slots/bookings)
      selectBatches: [[], [], []],
    });
    const context = makeContext({ db: db as any });

    await slotCleanupJob(context);

    const logger = context.logger as any;
    // Should log completion
    const infoCalls = logger.info.mock.calls;
    const completionCall = infoCalls.find((call: any) =>
      typeof call[1] === 'string' && call[1].includes('completed') ||
      typeof call[0] === 'object' && call[0]?.totalRecordsProcessed !== undefined
    );
    expect(completionCall).toBeDefined();
  });

  test('archives old available slots in batches', async () => {
    const oldSlots = [{ id: 'slot-1' }, { id: 'slot-2' }];
    const db = buildCleanupDb({
      // First batch of available slots, then empty (end loop), then blocked (empty), then bookings (empty)
      selectBatches: [oldSlots, [], [], []],
      deleteResults: [oldSlots],
    });
    const context = makeContext({ db: db as any });

    await slotCleanupJob(context);

    const logger = context.logger as any;
    // Should have logged archive count
    expect(logger.info).toHaveBeenCalled();
  });

  test('archives old blocked slots', async () => {
    const blockedSlots = [{ id: 'blocked-1' }];
    const db = buildCleanupDb({
      // Available: empty, Blocked: one batch then empty, Bookings: empty
      selectBatches: [[], blockedSlots, [], []],
      deleteResults: [blockedSlots],
    });
    const context = makeContext({ db: db as any });

    await slotCleanupJob(context);

    expect((context.logger as any).info).toHaveBeenCalled();
  });

  test('archives old completed bookings via transaction', async () => {
    const oldBookings = [{ id: 'booking-1' }, { id: 'booking-2' }];
    let transactionCalled = false;
    const db = buildCleanupDb({
      // Available: empty, Blocked: empty, Bookings query returns items
      selectBatches: [[], [], oldBookings],
      transactionFn: async (fn: any) => {
        transactionCalled = true;
        const txStub = {
          delete: () => ({
            where: () => ({
              returning: () => Promise.resolve(oldBookings),
            }),
          }),
        };
        return fn(txStub);
      },
    });
    const context = makeContext({ db: db as any });

    await slotCleanupJob(context);

    expect(transactionCalled).toBe(true);
  });

  test('runs ANALYZE on tables for index optimization', async () => {
    const executeSpy = mock(async () => {});
    const db = buildCleanupDb({
      selectBatches: [[], [], []],
      executeFn: executeSpy,
    });
    const context = makeContext({ db: db as any });

    await slotCleanupJob(context);

    // Should have called execute for ANALYZE statements
    expect(executeSpy).toHaveBeenCalled();
  });

  test('logs error and re-throws on failure', async () => {
    const db = {
      select: () => { throw new Error('DB connection lost'); },
      execute: mock(async () => {}),
      transaction: mock(async () => {}),
    };
    const context = makeContext({ db: db as any });

    await expect(slotCleanupJob(context)).rejects.toThrow('DB connection lost');

    expect((context.logger as any).error).toHaveBeenCalled();
  });

  test('does not throw when ANALYZE fails (non-critical)', async () => {
    const db = buildCleanupDb({
      selectBatches: [[], [], []],
      executeFn: mock(async () => { throw new Error('permission denied'); }),
    });
    const context = makeContext({ db: db as any });

    // Should not throw — ANALYZE failure is non-critical
    await expect(slotCleanupJob(context)).resolves.toBeUndefined();
  });
});

describe('getCleanupStatistics', () => {
  test('returns counts and estimated space usage', async () => {
    const db = {
      select: (_fields?: any) => ({
        from: (_table: any) => ({
          where: (_conditions?: any) => {
            return Promise.resolve([{ count: 10 }]);
          },
        }),
      }),
    };

    const stats = await getCleanupStatistics(db);

    expect(stats.oldAvailableSlots).toBe(10);
    expect(stats.oldBlockedSlots).toBe(10);
    expect(stats.oldBookings).toBe(10);
    expect(stats.estimatedSpaceUsage).toContain('MB');
  });
});
