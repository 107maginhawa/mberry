import { describe, test, expect, mock } from 'bun:test';
import { processCreditIssue } from './creditIssue';
import type { JobContext } from '@/core/jobs';

function mockLogger() { return { info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}), debug: mock(() => {}) }; }

function buildMockDb(selectResponses: any[][], insertBehavior: 'success' | 'duplicate' = 'success') {
  let selectIdx = 0;
  const insertSpy = mock((_v: any) => {});
  const executeSpy = mock((_s: any) => Promise.resolve());
  const db = {
    select: (..._a: any[]) => ({ from: (_t: any) => { const idx = selectIdx++; const result = idx < selectResponses.length ? selectResponses[idx] : [];
      const w = { limit: (_n: number) => Promise.resolve(result), then: (r: any, j?: any) => Promise.resolve(result).then(r, j) };
      return { where: (_c: any) => w, limit: (_n: number) => Promise.resolve(result), then: (r: any, j?: any) => Promise.resolve(result).then(r, j) }; } }),
    insert: (_t: any) => ({ values: (v: any) => { insertSpy(v); if (insertBehavior === 'duplicate') { const e: any = new Error('uq_credit_source_person'); e.code = '23505'; return Promise.reject(e); } return Promise.resolve(); } }),
    execute: executeSpy,
  };
  return { db, insertSpy, executeSpy };
}

function ctx(data: any, db: any, logger?: any): JobContext { return { db, logger: logger ?? mockLogger(), jobId: 'test-1', jobName: 'credit.issue', data }; }

const payload = { sourceType: 'event_checkin' as const, sourceId: '550e8400-e29b-41d4-a716-446655440000', personId: '660e8400-e29b-41d4-a716-446655440001', organizationId: '770e8400-e29b-41d4-a716-446655440002', creditAmount: 5, cpdActivityType: 'seminar' };

describe('processCreditIssue', () => {
  test('creates credit entry', async () => { const { db, insertSpy } = buildMockDb([[{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60 }], [{ total: 5 }]]); const result = await processCreditIssue(ctx(payload, db)); expect(insertSpy).toHaveBeenCalledTimes(1); expect(result).not.toBeNull(); expect(result!.thresholdMet).toBe(false); });
  test('idempotent on duplicate', async () => { const { db } = buildMockDb([[{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60 }]], 'duplicate'); expect(await processCreditIssue(ctx(payload, db))).toBeNull(); });
  test('null when fields missing', async () => { const { db } = buildMockDb([]); expect(await processCreditIssue(ctx({ sourceType: 'event_checkin' }, db))).toBeNull(); });
  test('null when creditAmount 0', async () => { const { db } = buildMockDb([]); expect(await processCreditIssue(ctx({ ...payload, creditAmount: 0 }, db))).toBeNull(); });
  test('detects threshold met', async () => { const { db } = buildMockDb([[{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60 }], [{ total: 65 }]]); expect((await processCreditIssue(ctx(payload, db)))!.thresholdMet).toBe(true); });
  test('defaults when no org config', async () => { const { db } = buildMockDb([[], [{ total: 10 }]]); expect((await processCreditIssue(ctx(payload, db)))!.requiredCredits).toBe(60); });
  test('refreshes view', async () => { const { db, executeSpy } = buildMockDb([[{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60 }], [{ total: 5 }]]); await processCreditIssue(ctx(payload, db)); expect(executeSpy).toHaveBeenCalled(); });
  test('handles missing view', async () => { const { db } = buildMockDb([[{ cycleStartMonth: 1, cycleLengthYears: 3, requiredCredits: 60 }], [{ total: 5 }]]); db.execute = mock(() => Promise.reject(new Error('no relation'))); expect(await processCreditIssue(ctx(payload, db))).not.toBeNull(); });
});
