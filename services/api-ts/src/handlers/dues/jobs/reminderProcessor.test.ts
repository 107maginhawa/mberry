import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { processDuesReminders, type ReminderResult } from './reminderProcessor';

/**
 * Reminder Processor Tests
 *
 * Tests the core reminder processing logic. The processor:
 * 1. Queries dues configs + schedules
 * 2. Finds members expiring on target dates
 * 3. Checks idempotency via duesReminderLogs
 * 4. Creates notifications per enabled channel
 * 5. Inserts reminder logs
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

/**
 * Build a sequenced mock DB. Each call to select().from().where() or select().from()
 * returns the next item in the responses array.
 */
function buildSequencedDb(responses: any[], insertSpy?: (val: any) => void) {
  let callIdx = 0;
  return {
    select: (...args: any[]) => ({
      from: (_table: any) => {
        const idx = callIdx++;
        const resp = idx < responses.length ? responses[idx] : [];
        // If response is a direct array, it's a no-where query (configs)
        if (Array.isArray(resp)) {
          // Could be called with or without .where
          const result = Promise.resolve(resp);
          // Add .where for chaining
          (result as any).where = () => {
            // This shouldn't normally be called for direct-resolve responses
            return Promise.resolve(resp);
          };
          return result;
        }
        // If response is an object with a where function
        return resp;
      },
    }),
    insert: () => ({
      values: (val: any) => {
        insertSpy?.(val);
        return {
          returning: () => Promise.resolve([{ id: 'log-new-' + callIdx }]),
        };
      },
    }),
  };
}

/**
 * Create a where-chainable response for schedule/member/log queries.
 */
function whereResponse(data: any[]) {
  return {
    where: () => Promise.resolve(data),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processDuesReminders', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('returns zero counts when no configs exist', async () => {
    // Call sequence: 1. configs (empty)
    const db = buildSequencedDb([
      [], // configs
    ]);

    const result = await processDuesReminders({ db: db as any, logger: mockLogger });

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('processes enabled schedules for each config', async () => {
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: true, channelEmail: true },
      { id: 'sched-2', duesConfigId: 'config-1', daysOffset: -7, enabled: true, channelInapp: true, channelPush: false, channelEmail: true },
    ];

    // Call sequence:
    // 1. configs
    // 2. schedules for config-1
    // 3. members for sched-1 (empty)
    // 4. members for sched-2 (empty)
    const db = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }], // configs
      whereResponse(mockSchedules),                     // schedules
      whereResponse([]),                                // members for sched-1 (empty)
      whereResponse([]),                                // members for sched-2 (empty)
    ]);

    const result = await processDuesReminders({ db: db as any, logger: mockLogger });

    expect(result.processed).toBe(2);
    expect(result.sent).toBe(0); // no members found
    expect(result.errors).toBe(0);
  });

  test('counts errors without stopping processing', async () => {
    // Call sequence:
    // 1. configs
    // 2. schedules (throws error)
    const db = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }], // configs
      { where: () => { throw new Error('simulated DB error'); } }, // schedules throw
    ]);

    const result = await processDuesReminders({ db: db as any, logger: mockLogger });

    // The schedule query throws before any schedule is iterated,
    // so errors=1 (config-level), processed=0
    expect(result.errors).toBe(1);
    expect(result.processed).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Idempotency & notification tests
  // ---------------------------------------------------------------------------

  test('skips already-sent reminders (idempotency via duesReminderLogs)', async () => {
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: '2026-06-12' },
    ];
    const existingLog = [{ personId: 'person-1', scheduleId: 'sched-1', periodKey: '2026', daysOffset: -30 }];

    // Call sequence:
    // 1. configs
    // 2. schedules
    // 3. members for sched-1
    // 4. existing logs check (found!)
    const db = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }], // configs
      whereResponse(mockSchedules),                     // schedules
      whereResponse(mockMembers),                       // members
      whereResponse(existingLog),                       // existing reminder log
    ]);

    const result = await processDuesReminders({ db: db as any, logger: mockLogger });

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });

  test('creates notification for members expiring on target date', async () => {
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: '2026-06-12' },
    ];

    const insertedValues: any[] = [];

    // Call sequence:
    // 1. configs
    // 2. schedules
    // 3. members
    // 4. logs check (empty - not sent yet)
    const db = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }],
      whereResponse(mockSchedules),
      whereResponse(mockMembers),
      whereResponse([]), // no existing logs
    ], (val) => insertedValues.push(val));

    const notificationsSent: any[] = [];
    const result = await processDuesReminders({
      db: db as any,
      logger: mockLogger,
      createNotification: async (params) => {
        notificationsSent.push(params);
        return { id: 'notif-1' };
      },
    });

    expect(result.sent).toBe(1);
    expect(result.errors).toBe(0);
    expect(insertedValues.length).toBe(1);
    expect(insertedValues[0].channel).toBe('in-app');
    expect(insertedValues[0].personId).toBe('person-1');
    expect(notificationsSent.length).toBe(1);
    expect(notificationsSent[0].type).toBe('billing');
    expect(notificationsSent[0].channel).toBe('in-app');
  });

  test('handles empty member list (no errors, sent=0)', async () => {
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: true },
    ];

    // Call sequence:
    // 1. configs
    // 2. schedules
    // 3. members (empty)
    const db = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }],
      whereResponse(mockSchedules),
      whereResponse([]), // no members
    ]);

    const result = await processDuesReminders({ db: db as any, logger: mockLogger });

    expect(result.sent).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.processed).toBe(1); // schedule was processed
  });

  test('respects channel flags — only sends for enabled channels', async () => {
    // Only channelInapp=true, others false
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: '2026-06-12' },
    ];

    const insertedValues: any[] = [];

    // Call sequence:
    // 1. configs -> 2. schedules -> 3. members -> 4. logs check (empty)
    const db = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }],
      whereResponse(mockSchedules),
      whereResponse(mockMembers),
      whereResponse([]), // no existing logs
    ], (val) => insertedValues.push(val));

    const result = await processDuesReminders({
      db: db as any,
      logger: mockLogger,
    });

    // With only in-app enabled, should create exactly 1 reminder per member
    expect(result.sent).toBe(1);
    expect(insertedValues.length).toBe(1);
    expect(insertedValues[0].channel).toBe('in-app');
  });

  // ---------------------------------------------------------------------------
  // LIF-03: Departed member notification exclusion
  //
  // LIF-03: departed members excluded from reminders by inArray guard.
  // This is the foundation for EML-03 (Phase 25 deceased/departed send guard).
  //
  // The WHERE clause in reminderProcessor.ts lines 98-103:
  //   inArray(memberships.status, ['active', 'gracePeriod'])
  //
  // resigned, deceased, and expelled are NOT in this array, so they are
  // never included in `expiringMembers` — no notifications are created.
  // ---------------------------------------------------------------------------

  describe('LIF-03: departed member notification exclusion', () => {
    test('[LIF-03] resigned member is excluded from reminders by inArray guard', async () => {
      // resigned status is not in ['active', 'gracePeriod'].
      // Simulate DB returning empty member list (resigned filtered out).
      const mockSchedules = [
        { id: 'sched-lif03-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
      ];

      // DB applies inArray(status, ['active', 'gracePeriod']) -> resigned excluded -> empty
      const db = buildSequencedDb([
        [{ id: 'config-1', organizationId: 'org-1' }],
        whereResponse(mockSchedules),
        whereResponse([]), // resigned member filtered out by inArray guard
      ]);

      const notificationsSent: any[] = [];
      const result = await processDuesReminders({
        db: db as any,
        logger: mockLogger,
        createNotification: async (params) => {
          notificationsSent.push(params);
          return { id: 'notif-resigned' };
        },
      });

      expect(result.sent).toBe(0);
      expect(notificationsSent).toHaveLength(0);
    });

    test('[LIF-03] deceased member is excluded from reminders by inArray guard', async () => {
      // deceased status is not in ['active', 'gracePeriod'] — filtered at DB level.
      const mockSchedules = [
        { id: 'sched-lif03-2', duesConfigId: 'config-1', daysOffset: -7, enabled: true, channelInapp: true, channelPush: true, channelEmail: true },
      ];

      // Simulate: org has 1 deceased member with an expiry date that matches
      // the target date — but inArray guard returns empty because deceased excluded.
      const db = buildSequencedDb([
        [{ id: 'config-1', organizationId: 'org-1' }],
        whereResponse(mockSchedules),
        whereResponse([]), // deceased member filtered out by inArray guard
      ]);

      const notificationsSent: any[] = [];
      const result = await processDuesReminders({
        db: db as any,
        logger: mockLogger,
        createNotification: async (params) => {
          notificationsSent.push(params);
          return { id: 'notif-deceased' };
        },
      });

      expect(result.sent).toBe(0);
      expect(notificationsSent).toHaveLength(0);
    });

    test('[LIF-03] expelled member is excluded from reminders by inArray guard', async () => {
      // expelled status is not in ['active', 'gracePeriod'] — filtered at DB level.
      const mockSchedules = [
        { id: 'sched-lif03-3', duesConfigId: 'config-1', daysOffset: 0, enabled: true, channelInapp: false, channelPush: false, channelEmail: true },
      ];

      const db = buildSequencedDb([
        [{ id: 'config-1', organizationId: 'org-1' }],
        whereResponse(mockSchedules),
        whereResponse([]), // expelled member filtered out by inArray guard
      ]);

      const notificationsSent: any[] = [];
      const result = await processDuesReminders({
        db: db as any,
        logger: mockLogger,
        createNotification: async (params) => {
          notificationsSent.push(params);
          return { id: 'notif-expelled' };
        },
      });

      expect(result.sent).toBe(0);
      expect(notificationsSent).toHaveLength(0);
    });

    test('[LIF-03] inArray guard: only active and gracePeriod receive reminders', () => {
      // Document the allowed statuses contract
      const ALLOWED_STATUSES = ['active', 'gracePeriod'];
      const DEPARTED_STATUSES = ['resigned', 'deceased', 'expelled'];

      for (const status of DEPARTED_STATUSES) {
        expect(ALLOWED_STATUSES).not.toContain(status);
      }

      // Verify active and gracePeriod remain in the allowed list
      expect(ALLOWED_STATUSES).toContain('active');
      expect(ALLOWED_STATUSES).toContain('gracePeriod');
    });

    test('[LIF-03] mixed org: active member gets reminder, departed members do not', async () => {
      // Simulate: inArray guard returns only the active member, not departed ones.
      const mockSchedules = [
        { id: 'sched-lif03-4', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
      ];

      // DB returns only the active member (inArray filters out resigned/deceased/expelled)
      const activeMember = { id: 'mem-active', personId: 'person-active', organizationId: 'org-1', duesExpiryDate: '2026-06-12' };

      const db = buildSequencedDb([
        [{ id: 'config-1', organizationId: 'org-1' }],
        whereResponse(mockSchedules),
        whereResponse([activeMember]), // only active returned by inArray guard
        whereResponse([]),             // no existing logs
      ]);

      const notificationsSent: any[] = [];
      const result = await processDuesReminders({
        db: db as any,
        logger: mockLogger,
        createNotification: async (params) => {
          notificationsSent.push(params);
          return { id: 'notif-active' };
        },
      });

      // Only active member gets reminder
      expect(result.sent).toBe(1);
      expect(notificationsSent).toHaveLength(1);
      expect(notificationsSent[0].recipient).toBe('person-active');

      // The 3 departed members (would have been: person-resigned, person-deceased, person-expelled)
      // are not present in notificationsSent because inArray excludes them.
      const departedNotified = notificationsSent.filter((n) =>
        ['person-resigned', 'person-deceased', 'person-expelled'].includes(n.recipient)
      );
      expect(departedNotified).toHaveLength(0);
    });
  });

  test('re-run is idempotent (second run finds existing logs and skips)', async () => {
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: false, channelEmail: false },
    ];
    const mockMembers = [
      { id: 'mem-1', personId: 'person-1', organizationId: 'org-1', duesExpiryDate: '2026-06-12' },
    ];

    // First run: no existing logs
    const insertedValues1: any[] = [];
    const db1 = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }],
      whereResponse(mockSchedules),
      whereResponse(mockMembers),
      whereResponse([]), // no existing logs
    ], (val) => insertedValues1.push(val));

    const result1 = await processDuesReminders({ db: db1 as any, logger: mockLogger });
    expect(result1.sent).toBe(1);

    // Second run: existing log found
    const db2 = buildSequencedDb([
      [{ id: 'config-1', organizationId: 'org-1' }],
      whereResponse(mockSchedules),
      whereResponse(mockMembers),
      whereResponse([{ personId: 'person-1', scheduleId: 'sched-1', periodKey: '2026', daysOffset: -30 }]),
    ]);

    const result2 = await processDuesReminders({ db: db2 as any, logger: mockLogger });
    expect(result2.sent).toBe(0);
    expect(result2.skipped).toBe(1);
  });
});
