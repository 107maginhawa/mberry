import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { processDuesReminders, type ReminderResult } from './reminderProcessor';

/**
 * Reminder Processor Tests
 *
 * Tests the core reminder processing logic. The processor:
 * 1. Queries dues configs + schedules
 * 2. Finds members expiring on target dates via membershipRepo
 * 3. Checks idempotency via duesReminderLogs
 * 4. Creates notifications per enabled channel
 */

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockLogger() {
  return {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  };
}

// Build a chainable mock DB that returns configs on first select,
// schedules on second (with .where), and handles subsequent queries.
function buildMockDb(opts: {
  configs: any[];
  schedulesByConfig: Record<string, any[]>;
  membersByOrgDate?: Record<string, any[]>; // key: "orgId:date"
  existingLogs?: Array<{ personId: string; scheduleId: string; periodKey: string; daysOffset: number }>;
}) {
  let selectCallIndex = 0;

  const db: any = {
    select: () => {
      const callIdx = selectCallIndex++;
      return {
        from: (table: any) => {
          // First call: configs table
          if (callIdx === 0) {
            return Promise.resolve(opts.configs);
          }
          // Subsequent calls with .where: could be schedules, members, or logs
          return {
            where: (condition: any) => {
              // We determine what to return based on call order within each config loop
              // schedules are queried right after configs
              // After implementation, members and logs will also be queried
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    insert: () => ({
      values: (val: any) => ({
        returning: () => Promise.resolve([{ id: 'log-new' }]),
      }),
    }),
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests — existing behavior
// ---------------------------------------------------------------------------

describe('processDuesReminders', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('returns zero counts when no configs exist', async () => {
    const mockDb = {
      select: () => ({
        from: () => Promise.resolve([]),
      }),
    };

    const result = await processDuesReminders({ db: mockDb as any, logger: mockLogger });

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('processes enabled schedules for each config', async () => {
    const mockConfigs = [
      { id: 'config-1', organizationId: 'org-1' },
    ];
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: true, channelEmail: true },
      { id: 'sched-2', duesConfigId: 'config-1', daysOffset: -7, enabled: true, channelInapp: true, channelPush: false, channelEmail: true },
    ];

    let callCount = 0;
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve(mockConfigs);
          }
          return {
            where: () => Promise.resolve(mockSchedules),
          };
        },
      }),
    };

    const result = await processDuesReminders({ db: mockDb as any, logger: mockLogger });

    expect(result.processed).toBe(2);
    // With real implementation, sent depends on whether members found
    expect(typeof result.sent).toBe('number');
    expect(result.errors).toBe(0);
  });

  test('counts errors without stopping processing', async () => {
    const mockConfigs = [{ id: 'config-1', organizationId: 'org-1' }];

    let callCount = 0;
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve(mockConfigs);
          }
          return {
            where: () => {
              throw new Error('simulated DB error');
            },
          };
        },
      }),
    };

    const result = await processDuesReminders({ db: mockDb as any, logger: mockLogger });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Tests — new behavior (idempotency, notifications, channels)
  // ---------------------------------------------------------------------------

  test('skips already-sent reminders (idempotency via duesReminderLogs)', async () => {
    // When duesReminderLogs already has an entry for person+schedule+period+offset,
    // the processor should increment skipped, not sent
    const mockConfigs = [{ id: 'config-1', organizationId: 'org-1' }];
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: new Date('2026-06-12') },
    ];
    const existingLog = { personId: 'person-1', scheduleId: 'sched-1', periodKey: '2026', daysOffset: -30 };

    // Build DB that returns configs -> schedules -> members -> existing log
    let selectCall = 0;
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          selectCall++;
          if (selectCall === 1) return Promise.resolve(mockConfigs);
          return {
            where: () => {
              if (selectCall === 2) return Promise.resolve(mockSchedules);
              if (selectCall === 3) return Promise.resolve(mockMembers);
              if (selectCall === 4) return Promise.resolve([existingLog]); // existing reminder log
              return Promise.resolve([]);
            },
          };
        },
      }),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([{ id: 'should-not-be-called' }]),
        }),
      }),
    };

    const result = await processDuesReminders({
      db: mockDb as any,
      logger: mockLogger,
    });

    expect(result.skipped).toBeGreaterThanOrEqual(1);
    // Should NOT have sent since already exists
    expect(result.sent).toBe(0);
  });

  test('creates notification for members expiring on target date', async () => {
    // With real implementation, the processor should create a notification
    // for each member expiring on the target date for each enabled channel
    const mockConfigs = [{ id: 'config-1', organizationId: 'org-1' }];
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: new Date('2026-06-12') },
    ];

    let selectCall = 0;
    const insertedValues: any[] = [];
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          selectCall++;
          if (selectCall === 1) return Promise.resolve(mockConfigs);
          return {
            where: () => {
              if (selectCall === 2) return Promise.resolve(mockSchedules);
              if (selectCall === 3) return Promise.resolve(mockMembers);
              if (selectCall === 4) return Promise.resolve([]); // no existing logs
              return Promise.resolve([]);
            },
          };
        },
      }),
      insert: () => ({
        values: (val: any) => {
          insertedValues.push(val);
          return {
            returning: () => Promise.resolve([{ id: 'log-1' }]),
          };
        },
      }),
    };

    const result = await processDuesReminders({
      db: mockDb as any,
      logger: mockLogger,
    });

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);
    // Should have inserted at least one reminder log
    expect(insertedValues.length).toBeGreaterThanOrEqual(1);
  });

  test('handles empty member list (no errors, sent=0)', async () => {
    const mockConfigs = [{ id: 'config-1', organizationId: 'org-1' }];
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: true },
    ];

    let selectCall = 0;
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          selectCall++;
          if (selectCall === 1) return Promise.resolve(mockConfigs);
          return {
            where: () => {
              if (selectCall === 2) return Promise.resolve(mockSchedules);
              if (selectCall === 3) return Promise.resolve([]); // No members
              return Promise.resolve([]);
            },
          };
        },
      }),
    };

    const result = await processDuesReminders({
      db: mockDb as any,
      logger: mockLogger,
    });

    expect(result.sent).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.processed).toBeGreaterThan(0); // schedules were still processed
  });

  test('respects channel flags — only sends for enabled channels', async () => {
    // Only channelInapp=true, others false
    const mockConfigs = [{ id: 'config-1', organizationId: 'org-1' }];
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: new Date('2026-06-12') },
    ];

    let selectCall = 0;
    const insertedValues: any[] = [];
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          selectCall++;
          if (selectCall === 1) return Promise.resolve(mockConfigs);
          return {
            where: () => {
              if (selectCall === 2) return Promise.resolve(mockSchedules);
              if (selectCall === 3) return Promise.resolve(mockMembers);
              if (selectCall === 4) return Promise.resolve([]); // no existing logs
              return Promise.resolve([]);
            },
          };
        },
      }),
      insert: () => ({
        values: (val: any) => {
          insertedValues.push(val);
          return {
            returning: () => Promise.resolve([{ id: 'log-1' }]),
          };
        },
      }),
    };

    const result = await processDuesReminders({
      db: mockDb as any,
      logger: mockLogger,
    });

    // With only in-app enabled, should create exactly 1 notification per member
    // (not 3 for email+push+inapp)
    expect(result.sent).toBe(1);

    // All inserted logs should have channel 'in-app'
    for (const val of insertedValues) {
      expect(val.channel).toBe('in-app');
    }
  });
});
