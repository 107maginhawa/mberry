/**
 * recalculateAgingBucket.test.ts
 *
 * Handler is a STUB (deferred to v1.2.0) — no repo calls, pure response shape.
 * Covers:
 *   - Unauthorized (no session)
 *   - Happy path — 200, correct shape, zero values (stub behaviour)
 *   - auditResourceId / auditDescription set on ctx
 *   - organizationId echoed back in response
 *   - asOfDate is today in YYYY-MM-DD format
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx, makeMockDb } from '@/test-utils/make-ctx';
import { recalculateAgingBucket } from './recalculateAgingBucket';

describe('recalculateAgingBucket', () => {
  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, database: makeMockDb() });
    await expect(recalculateAgingBucket(ctx as any)).rejects.toThrow();
  });

  test('returns 200 with zero-value aging bucket shape', async () => {
    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
    });

    const res = await recalculateAgingBucket(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.organizationId).toBe('tenant-1');
    expect(body.current).toBe(0);
    expect(body.thirtyDay).toBe(0);
    expect(body.sixtyDay).toBe(0);
    expect(body.ninetyDay).toBe(0);
    expect(body.overNinety).toBe(0);
    expect(body.totalOutstanding).toBe(0);
  });

  test('asOfDate is today in YYYY-MM-DD format', async () => {
    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
    });

    const today = new Date().toISOString().split('T')[0];
    const res = await recalculateAgingBucket(ctx as any);
    const body = (res as any).body;
    expect(body.asOfDate).toBe(today);
  });

  test('sets auditResourceId on ctx to organizationId', async () => {
    const captured: Record<string, any> = {};
    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-99',
      _params: { organizationId: 'tenant-99' },
    });
    const originalSet = ctx.set.bind(ctx);
    ctx.set = (k: string, v: any) => { captured[k] = v; return originalSet(k, v); };

    await recalculateAgingBucket(ctx as any);
    expect(captured['auditResourceId']).toBe('tenant-99');
    expect(captured['auditDescription']).toBe('Aging bucket recalculated');
  });

  test('echoes param organizationId in response body', async () => {
    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'org-echo',
      _params: { organizationId: 'org-echo' },
    });

    const res = await recalculateAgingBucket(ctx as any);
    const body = (res as any).body;
    expect(body.organizationId).toBe('org-echo');
  });
});
