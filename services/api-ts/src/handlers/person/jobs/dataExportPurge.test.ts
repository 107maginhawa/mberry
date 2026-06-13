/**
 * Tests for processExpiredDataExports job (FIX-009 / §13)
 *
 * DPA data-minimization: the full-PII `data_export.payload` JSONB must NOT
 * persist past the 7-day download-link TTL (`expiresAt`). This scheduled job
 * nulls the payload (and downloadUrl) of every expired export and flips its
 * status to 'expired'. Fresh (not-yet-expired) exports are retained untouched.
 */

import { describe, test, expect } from 'bun:test';
import { processExpiredDataExports } from './dataExportPurge';

// ─── Helpers ─────────────────────────────────────────────

function makeDb(rows: any[], capturedSets: any[]) {
  return {
    select: () => ({
      from: (_t: any) => ({
        where: async (_cond: any) => rows,
      }),
    }),
    update: (_t: any) => ({
      set: (data: any) => {
        capturedSets.push(data);
        return { where: async (_cond: any) => [] };
      },
    }),
  } as any;
}

function makeLogger() {
  const logs: { level: string; args: any[] }[] = [];
  return {
    info: (...args: any[]) => logs.push({ level: 'info', args }),
    warn: (...args: any[]) => logs.push({ level: 'warn', args }),
    error: (...args: any[]) => logs.push({ level: 'error', args }),
    _logs: logs,
  };
}

const PAST = new Date(Date.now() - 1000);
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

describe('processExpiredDataExports', () => {
  test('purges an expired export payload and retains a fresh one', async () => {
    const capturedSets: any[] = [];
    const rows = [
      { id: 'exp-1', expiresAt: PAST, payload: { person: { firstName: 'Alice' } } },
      { id: 'fresh-1', expiresAt: FUTURE, payload: { person: { firstName: 'Bob' } } },
    ];

    const result = await processExpiredDataExports({ db: makeDb(rows, capturedSets), logger: makeLogger() });

    // Exactly ONE row updated → the fresh export is retained untouched.
    expect(capturedSets).toHaveLength(1);
    // The expired payload (and download link) is nulled; status flips to 'expired'.
    expect(capturedSets[0]).toMatchObject({ payload: null, downloadUrl: null, status: 'expired' });
    expect(result.purged).toBe(1);
  });

  test('retains exports that are not yet expired', async () => {
    const capturedSets: any[] = [];
    const rows = [{ id: 'fresh-1', expiresAt: FUTURE, payload: { person: {} } }];

    const result = await processExpiredDataExports({ db: makeDb(rows, capturedSets), logger: makeLogger() });

    expect(capturedSets).toHaveLength(0);
    expect(result.purged).toBe(0);
  });

  test('no-ops when there are no candidate exports', async () => {
    const capturedSets: any[] = [];

    const result = await processExpiredDataExports({ db: makeDb([], capturedSets), logger: makeLogger() });

    expect(capturedSets).toHaveLength(0);
    expect(result.purged).toBe(0);
  });
});
