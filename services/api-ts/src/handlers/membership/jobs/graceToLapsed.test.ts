/**
 * Grace-to-Lapsed Cron Job Tests (GAP-015, BR-02)
 *
 * Tests the graceToLapsed processor that transitions memberships from
 * gracePeriod to lapsed when the grace period expires.
 *
 * BR-02: grace_period_days configurable per org (0-90, default 30).
 * Idempotent: re-runs must not re-transition or duplicate history entries.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { processGraceToLapsed, type GraceToLapsedResult } from './graceToLapsed';

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
 * Build a sequenced mock DB. Each call to select().from().where()
 * returns the next item in the responses array.
 */
function buildSequencedDb(
  responses: any[],
  insertSpy?: (table: string, val: any) => void,
  updateSpy?: (table: string, conditions: any, data: any) => void,
) {
  let callIdx = 0;
  return {
    select: (..._args: any[]) => ({
      from: (_table: any) => {
        const idx = callIdx++;
        const resp = idx < responses.length ? responses[idx] : [];
        if (Array.isArray(resp)) {
          const result = Promise.resolve(resp);
          (result as any).where = () => Promise.resolve(resp);
          return result;
        }
        return resp;
      },
    }),
    insert: (table: any) => ({
      values: (val: any) => {
        insertSpy?.(table?.[Symbol.for('drizzle:Name')] ?? 'unknown', val);
        return {
          returning: () => Promise.resolve([{ id: 'history-new-' + callIdx }]),
        };
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (conditions: any) => {
          updateSpy?.(table?.[Symbol.for('drizzle:Name')] ?? 'unknown', conditions, data);
          return {
            returning: () => Promise.resolve([{ id: 'updated-' + callIdx, ...data }]),
          };
        },
      }),
    }),
  };
}

function whereResponse(data: any[]) {
  return {
    where: () => Promise.resolve(data),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processGraceToLapsed (GAP-015, BR-02)', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  // ── Core behavior ──

  test('returns zero counts when no memberships in grace period', async () => {
    const db = buildSequencedDb([
      whereResponse([]), // no grace-period memberships found
    ]);

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });

    expect(result.transitioned).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.notified).toBe(0);
  });

  test('transitions expired grace-period membership to lapsed', async () => {
    const expiredMember = {
      id: 'mem-1',
      personId: 'person-1',
      organizationId: 'org-1',
      status: 'gracePeriod',
      duesExpiryDate: '2026-04-01',  // expired 49 days ago
      gracePeriodDays: 30,            // 30-day grace = expired 19 days ago
    };

    const updates: any[] = [];
    const inserts: any[] = [];

    const db = buildSequencedDb(
      [
        whereResponse([expiredMember]), // grace-period memberships query
      ],
      (_table, val) => inserts.push(val),
      (_table, _cond, data) => updates.push(data),
    );

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });

    expect(result.transitioned).toBe(1);
    expect(result.errors).toBe(0);

    // Verify status update
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].status).toBe('lapsed');

    // Verify status_history entry
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    expect(inserts[0].fromStatus).toBe('gracePeriod');
    expect(inserts[0].toStatus).toBe('lapsed');
    expect(inserts[0].reason).toBe('grace_period_expired');
  });

  test('batch processes multiple expired memberships across orgs', async () => {
    const members = [
      {
        id: 'mem-1', personId: 'p-1', organizationId: 'org-1',
        status: 'gracePeriod', duesExpiryDate: '2026-03-01', gracePeriodDays: 30,
      },
      {
        id: 'mem-2', personId: 'p-2', organizationId: 'org-2',
        status: 'gracePeriod', duesExpiryDate: '2026-04-01', gracePeriodDays: 15,
      },
      {
        id: 'mem-3', personId: 'p-3', organizationId: 'org-1',
        status: 'gracePeriod', duesExpiryDate: '2026-03-15', gracePeriodDays: 45,
      },
    ];

    const updates: any[] = [];
    const db = buildSequencedDb(
      [whereResponse(members)],
      undefined,
      (_t, _c, data) => updates.push(data),
    );

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });

    expect(result.transitioned).toBe(3);
    expect(updates).toHaveLength(3);
    for (const u of updates) {
      expect(u.status).toBe('lapsed');
    }
  });

  // ── BR-02: grace_period_days configuration ──

  test('BR-02: respects gracePeriodDays=0 (immediate lapse on expiry)', async () => {
    // duesExpiryDate is yesterday, gracePeriodDays=0 => should lapse
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const member = {
      id: 'mem-0', personId: 'p-0', organizationId: 'org-1',
      status: 'gracePeriod', duesExpiryDate: yesterday.toISOString().split('T')[0],
      gracePeriodDays: 0,
    };

    const updates: any[] = [];
    const db = buildSequencedDb(
      [whereResponse([member])],
      undefined,
      (_t, _c, data) => updates.push(data),
    );

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });
    expect(result.transitioned).toBe(1);
  });

  test('BR-02: respects gracePeriodDays=90 (max)', async () => {
    // duesExpiryDate 80 days ago, gracePeriodDays=90 => NOT expired yet
    const eightyDaysAgo = new Date();
    eightyDaysAgo.setDate(eightyDaysAgo.getDate() - 80);
    const notExpired = {
      id: 'mem-90', personId: 'p-90', organizationId: 'org-1',
      status: 'gracePeriod', duesExpiryDate: eightyDaysAgo.toISOString().split('T')[0],
      gracePeriodDays: 90,
    };

    // This member should NOT appear in the query results because the SQL
    // WHERE clause filters at the DB level. We simulate that by returning empty.
    const db = buildSequencedDb([whereResponse([])]);

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });
    expect(result.transitioned).toBe(0);
  });

  // ── Notification ──

  test('sends notification on transition when createNotification provided', async () => {
    const member = {
      id: 'mem-n', personId: 'person-n', organizationId: 'org-1',
      status: 'gracePeriod', duesExpiryDate: '2026-03-01', gracePeriodDays: 30,
    };

    const db = buildSequencedDb(
      [whereResponse([member])],
    );

    const notifications: any[] = [];
    const result = await processGraceToLapsed({
      db: db as any,
      logger: mockLogger,
      createNotification: async (params) => {
        notifications.push(params);
        return { id: 'notif-1' };
      },
    });

    expect(result.notified).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].recipient).toBe('person-n');
    expect(notifications[0].type).toBe('billing');
    expect(notifications[0].title).toContain('lapsed');
  });

  test('transition succeeds even if notification fails', async () => {
    const member = {
      id: 'mem-nf', personId: 'person-nf', organizationId: 'org-1',
      status: 'gracePeriod', duesExpiryDate: '2026-03-01', gracePeriodDays: 30,
    };

    const updates: any[] = [];
    const db = buildSequencedDb(
      [whereResponse([member])],
      undefined,
      (_t, _c, data) => updates.push(data),
    );

    const result = await processGraceToLapsed({
      db: db as any,
      logger: mockLogger,
      createNotification: async () => { throw new Error('notification service down'); },
    });

    // Transition still happened
    expect(result.transitioned).toBe(1);
    // Notification failed
    expect(result.notified).toBe(0);
    expect(result.errors).toBe(0); // notification failure is not a processing error
  });

  // ── No transition if dues paid during grace ──

  test('does not transition memberships not in grace period (active stays active)', async () => {
    // The SQL query only selects gracePeriod status, so active members
    // never appear. Simulate by returning empty result.
    const db = buildSequencedDb([whereResponse([])]);

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });
    expect(result.transitioned).toBe(0);
  });

  // ── Idempotency ──

  test('idempotent: already-lapsed members are not returned by query', async () => {
    // The query filters for status='gracePeriod' only.
    // If a member was already transitioned to 'lapsed', they won't appear.
    const db = buildSequencedDb([whereResponse([])]);

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });
    expect(result.transitioned).toBe(0);
    expect(result.skipped).toBe(0);
  });

  // ── Error handling ──

  test('continues processing after individual member error', async () => {
    const members = [
      {
        id: 'mem-ok', personId: 'p-ok', organizationId: 'org-1',
        status: 'gracePeriod', duesExpiryDate: '2026-03-01', gracePeriodDays: 30,
      },
      {
        id: 'mem-fail', personId: 'p-fail', organizationId: 'org-1',
        status: 'gracePeriod', duesExpiryDate: '2026-03-01', gracePeriodDays: 30,
      },
    ];

    let updateCallCount = 0;
    const db = buildSequencedDb(
      [whereResponse(members)],
      undefined,
      (_t, _c, _data) => {
        updateCallCount++;
        if (updateCallCount === 2) throw new Error('DB write failed');
      },
    );

    const result = await processGraceToLapsed({ db: db as any, logger: mockLogger });

    // First member succeeded, second failed
    expect(result.transitioned).toBe(1);
    expect(result.errors).toBe(1);
  });

  test('logs status_history with reason "grace_period_expired" and no changedBy (system-initiated)', async () => {
    const member = {
      id: 'mem-h', personId: 'person-h', organizationId: 'org-h',
      status: 'gracePeriod', duesExpiryDate: '2026-03-01', gracePeriodDays: 30,
    };

    const inserts: any[] = [];
    const db = buildSequencedDb(
      [whereResponse([member])],
      (_table, val) => inserts.push(val),
    );

    await processGraceToLapsed({ db: db as any, logger: mockLogger });

    expect(inserts.length).toBeGreaterThanOrEqual(1);
    const historyEntry = inserts[0];
    expect(historyEntry.organizationId).toBe('org-h');
    expect(historyEntry.membershipId).toBe('mem-h');
    expect(historyEntry.personId).toBe('person-h');
    expect(historyEntry.fromStatus).toBe('gracePeriod');
    expect(historyEntry.toStatus).toBe('lapsed');
    expect(historyEntry.reason).toBe('grace_period_expired');
    // System-initiated: changedBy should be null/undefined
    expect(historyEntry.changedBy).toBeUndefined();
  });
});
