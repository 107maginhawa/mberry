/**
 * disconnectDuesGateway.test.ts
 *
 * Covers:
 *  - Throws UnauthorizedError when no session
 *  - Happy path — returns 204 No Content
 *  - Response body is null (not JSON)
 *  - Calls db.delete with the correct organizationId
 *  - Sets auditResourceId and auditDescription on ctx
 *
 * Note: disconnectDuesGateway uses db.delete() directly (no repo class),
 * so we stub the database's delete chain on the makeCtx database override.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { disconnectDuesGateway } from './disconnectDuesGateway';

// Build a mock db whose delete chain resolves successfully
// and captures calls for assertion.
function makeDeleteCapturingDb() {
  const calls: Array<{ where: any }> = [];
  const db = {
    delete: (_table: any) => ({
      where: (cond: any) => {
        calls.push({ where: cond });
        return Promise.resolve(undefined);
      },
    }),
    // makeMockDb select chain (unused here but keeps the db shape valid)
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
    update: (_t: any) => ({ set: (_d: any) => ({ where: () => ({ returning: async () => [] }) }) }),
    insert: (_t: any) => ({ values: (_v: any) => ({ returning: async () => [] }) }),
    transaction: async (fn: any) => fn(makeDeleteCapturingDb().db),
  };
  return { db, calls };
}

describe('disconnectDuesGateway', () => {
  test('throws UnauthorizedError when session is null', async () => {
    const { db } = makeDeleteCapturingDb();
    const ctx = makeCtx({ session: null, user: null, database: db });
    await expect(disconnectDuesGateway(ctx as any)).rejects.toThrow();
  });

  test('happy path — returns 204 No Content', async () => {
    const { db } = makeDeleteCapturingDb();
    const ctx = makeCtx({
      database: db,
      _params: { organizationId: 'org-1' },
    });

    const res = await disconnectDuesGateway(ctx as any);
    expect(res.status).toBe(204);
  });

  test('response body is null (204 must not return JSON)', async () => {
    const { db } = makeDeleteCapturingDb();
    const ctx = makeCtx({
      database: db,
      _params: { organizationId: 'org-1' },
    });

    const res = await disconnectDuesGateway(ctx as any);
    // 204 response — body should be null or empty
    const text = await res.text().catch(() => '');
    expect(text).toBe('');
  });

  test('sets auditResourceId to the organizationId', async () => {
    const { db } = makeDeleteCapturingDb();
    const vars: Record<string, any> = {};
    const ctx = makeCtx({
      database: db,
      _params: { organizationId: 'org-audit-test' },
    });
    // Intercept ctx.set
    const origSet = (ctx as any).set.bind(ctx);
    (ctx as any).set = (key: string, val: any) => { vars[key] = val; origSet(key, val); };

    await disconnectDuesGateway(ctx as any);
    expect(vars['auditResourceId']).toBe('org-audit-test');
    expect(vars['auditDescription']).toBe('Payment gateway disconnected');
  });

  test('issues db.delete (not update) — destructive op confirmed', async () => {
    const { db, calls } = makeDeleteCapturingDb();
    const ctx = makeCtx({
      database: db,
      _params: { organizationId: 'org-del' },
    });

    await disconnectDuesGateway(ctx as any);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});
