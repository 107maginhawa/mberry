/**
 * BR-48: Bulk payment recording with per-record validation.
 *
 * Source lives at association:member/bulkRecordPayments.ts — tested here
 * at the path registered in br-registry.json for BR-48.
 *
 * Tests the handler's input validation logic, batch size cap, and
 * per-row error handling without requiring a real database.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { bulkRecordPayments } from '../association:member/bulkRecordPayments';

// ─── Minimal context factory ───────────────────────────

function makeCtx(overrides: {
  user?: any;
  orgId?: string;
  session?: any;
  body?: any;
  database?: any;
}) {
  const responses: any[] = [];
  return {
    get(key: string) {
      if (key === 'user') return overrides.user ?? null;
      if (key === 'organizationId') return overrides.orgId ?? null;
      if (key === 'session') return overrides.session ?? { user: { id: 'u-1' } };
      if (key === 'database') return overrides.database ?? {};
      return undefined;
    },
    req: {
      valid(_type: string) {
        return overrides.body ?? {};
      },
    },
    json(data: any, status?: number) {
      return new Response(JSON.stringify(data), {
        status: status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  } as any;
}

async function parseRes(res: Response) {
  return { status: res.status, body: await res.json() };
}

// ─── Auth guards [BR-48] ───────────────────────────────

describe('[BR-48] bulkRecordPayments — auth', () => {
  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(401);
    expect(body.error).toContain('Unauthorized');
  });

  test('returns 403 when no org context', async () => {
    const ctx = makeCtx({ user: { id: 'u-1' }, orgId: undefined });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(403);
    expect(body.error).toContain('Organization');
  });
});

// ─── Input validation [BR-48] ──────────────────────────

describe('[BR-48] bulkRecordPayments — input validation', () => {
  test('returns 400 when payments is missing', async () => {
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {},
    });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(400);
    expect(body.error).toContain('payments array');
  });

  test('returns 400 when payments is empty array', async () => {
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments: [] },
    });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(400);
    expect(body.error).toContain('must not be empty');
  });

  test('returns 400 when batch exceeds MAX_BATCH_SIZE (50)', async () => {
    const payments = Array.from({ length: 51 }, (_, i) => ({
      personId: `p-${i}`,
      amount: 1000,
      paymentMethod: 'cash',
    }));
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments },
    });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(400);
    expect(body.error).toContain('maximum of 50');
  });

  test('exactly 50 payments does not trigger batch limit', async () => {
    const payments = Array.from({ length: 50 }, (_, i) => ({
      personId: `p-${i}`,
      amount: 1000,
      paymentMethod: 'cash',
    }));
    // Will fail later (no DB), but should NOT return batch size error
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    // Should get past validation — errors from processing, not batch limit
    expect(body.error).toBeUndefined();
  });
});

// ─── Per-row validation [BR-48] ────────────────────────

describe('[BR-48] bulkRecordPayments — per-row validation', () => {
  test('rows missing personId are flagged as error', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {
        payments: [
          { personId: '', amount: 1000, paymentMethod: 'cash' },
        ],
      },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    const errorRow = body.results?.find((r: any) => r.status === 'error');
    expect(errorRow).toBeDefined();
    expect(errorRow.error).toContain('personId');
  });

  test('rows with zero amount are flagged as error', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {
        payments: [
          { personId: 'p-1', amount: 0, paymentMethod: 'cash' },
        ],
      },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    const errorRow = body.results?.find((r: any) => r.status === 'error');
    expect(errorRow).toBeDefined();
    expect(errorRow.error).toContain('amount');
  });

  test('rows with negative amount are flagged as error', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {
        payments: [
          { personId: 'p-1', amount: -500, paymentMethod: 'cash' },
        ],
      },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    const errorRow = body.results?.find((r: any) => r.status === 'error');
    expect(errorRow).toBeDefined();
    expect(errorRow.error).toContain('amount');
  });

  test('rows missing paymentMethod are flagged as error', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {
        payments: [
          { personId: 'p-1', amount: 1000, paymentMethod: '' },
        ],
      },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    const errorRow = body.results?.find((r: any) => r.status === 'error');
    expect(errorRow).toBeDefined();
    expect(errorRow.error).toContain('paymentMethod');
  });

  test('multiple validation errors combined in single row', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {
        payments: [
          { personId: '', amount: -1, paymentMethod: '' },
        ],
      },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    const errorRow = body.results?.[0];
    expect(errorRow?.status).toBe('error');
    // Should contain multiple errors separated by semicolons
    expect(errorRow?.error).toContain(';');
  });
});

// ─── Summary response shape [BR-48] ───────────────────

describe('[BR-48] bulkRecordPayments — response summary', () => {
  test('all-invalid batch returns 400 with summary', async () => {
    const fakeDb = {
      transaction: async () => {
        throw new Error('no real db');
      },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: {
        payments: [
          { personId: '', amount: 0, paymentMethod: '' },
          { personId: '', amount: -1, paymentMethod: '' },
        ],
      },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(400);
    expect(body.summary.total).toBe(2);
    expect(body.summary.success).toBe(0);
    expect(body.summary.errors).toBe(2);
  });
});

// ─── [BR-48] batch-size boundary table ─────────────────────────────────
// Source: services/api-ts/src/handlers/association:member/bulkRecordPayments.ts
//   const MAX_BATCH_SIZE = 50; if (payments.length > MAX_BATCH_SIZE) { ... 400 ... }
//
// Rule (br-registry.json#BR-48): the bulk endpoint must reject any batch
// with length > 50 with a 400 BEFORE any DB transaction is opened. This
// protects against DoS-via-megabatch and keeps per-batch latency bounded.
//
// Table-driven boundary coverage so a future tweak of MAX_BATCH_SIZE will
// fail this test rather than silently shipping. The earlier tests at L97
// cover the 51-reject and 50-accept cases; this block adds 1, 49, 100, and
// an explicit assertion that DB is never touched on overflow.
describe('[BR-48] bulkRecordPayments — batch-size boundary table', () => {
  const makePayments = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      personId: `p-${i}`,
      amount: 1000,
      paymentMethod: 'cash',
    }));

  test('[BR-48] size=1 passes batch-size gate', async () => {
    const fakeDb = { transaction: async () => { throw new Error('no real db'); } };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments: makePayments(1) },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    // No size-limit error — it should fail later on the fake DB
    if (typeof body.error === 'string') {
      expect(body.error).not.toContain('maximum');
    }
  });

  test('[BR-48] size=49 passes batch-size gate', async () => {
    const fakeDb = { transaction: async () => { throw new Error('no real db'); } };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments: makePayments(49) },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { body } = await parseRes(res);
    if (typeof body.error === 'string') {
      expect(body.error).not.toContain('maximum');
    }
  });

  test('[BR-48] size=100 is rejected with 400 and DB is never opened', async () => {
    let dbOpened = false;
    const fakeDb = {
      transaction: async () => { dbOpened = true; throw new Error('should not open'); },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments: makePayments(100) },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { status, body } = await parseRes(res);
    expect(status).toBe(400);
    expect(body.error).toContain('maximum of 50');
    expect(dbOpened).toBe(false);
  });

  test('[BR-48] size=1000 is rejected (worst-case DoS attempt)', async () => {
    let dbOpened = false;
    const fakeDb = {
      transaction: async () => { dbOpened = true; throw new Error('should not open'); },
    };
    const ctx = makeCtx({
      user: { id: 'u-1' },
      orgId: 'org-1',
      body: { payments: makePayments(1000) },
      database: fakeDb,
    });
    const res = await bulkRecordPayments(ctx);
    const { status } = await parseRes(res);
    expect(status).toBe(400);
    expect(dbOpened).toBe(false);
  });
});

// CONTRACT-LAYER NOTE: br-registry#BR-48 lists `contract: []`. The
// bulkRecordPayments handler is implemented at
// services/api-ts/src/handlers/association:member/bulkRecordPayments.ts but
// is not currently wired to an HTTP route (no router registration, no
// OpenAPI path). Adding a Hurl contract scenario for this BR is blocked on
// the route being registered. Once registered, the contract test should
// POST a 51-row batch and assert 400. Deferred until the endpoint is
// exposed.
