/**
 * Real-PG WORKFLOW integration — `listAuditLogs` handler over the REAL
 * AuditRepository (createScratch, NOT stubRepo). W3 audit S5.
 *
 * The existing `listAuditLogs.test.ts` drives a stubbed repo, so the handler's
 * org-scope boundary (`filters.organizationId = orgId`, listAuditLogs.ts:46) and
 * its self-audit side effect (listAuditLogs.ts:78-98) are proven only as
 * "argument forwarded to a stub" — never as real SQL against real rows. This
 * suite seeds rows in TWO orgs in a scratch schema, calls the real handler, and
 * asserts on PERSISTED data:
 *   - the response contains ONLY ORG_A rows (ids) + totalCount = ORG_A count
 *     (tenant boundary at SQL, not in a fake-db),
 *   - querying audit logs is ITSELF audited (a new row lands in the store),
 *   - startDate>endDate throws ValidationError BEFORE any repo call (no read,
 *     no self-audit row written),
 *   - pagination (limit/offset) returns the correct page over real rows.
 *
 * Guarded with `if (!H.dbReachable) return` — skips cleanly when PG is down.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { listAuditLogs } from './listAuditLogs';
import { AuditRepository } from './repos/audit.repo';
import { ValidationError } from '@/core/errors';

let H: ScratchDb;

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b2';

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

/**
 * Build a handler ctx that points at the REAL scratch db. Mirrors the fields
 * `listAuditLogs` actually reads: user, organizationId, database, logger,
 * requestId, and `req.valid('query')` / headers.
 */
function makeRealCtx(opts: { userId: string; organizationId?: string; query?: Record<string, any> }) {
  const query = opts.query ?? {};
  const vars: Record<string, any> = {
    user: { id: opts.userId, role: 'admin' },
    organizationId: opts.organizationId,
    database: H.db,
    logger: noopLogger,
    requestId: 'test-req',
  };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      valid: (t: string) => (t === 'query' ? query : {}),
      header: () => null,
    },
    json: (body: any, status: number) => ({ status, body }) as any,
  } as any;
}

/** Seed one audit row directly via the real repo. Returns the persisted id. */
async function seedRow(opts: {
  organizationId: string;
  user?: string;
  resource: string;
  createdAt?: Date;
}): Promise<string> {
  const repo = new AuditRepository(H.db as never, noopLogger);
  const entry = await repo.logEvent(
    {
      eventType: 'data-access',
      category: 'hipaa',
      action: 'read',
      outcome: 'success',
      organizationId: opts.organizationId,
      user: opts.user ?? opts.organizationId, // any uuid is fine
      userType: 'admin',
      resourceType: 'patient_record',
      resource: opts.resource,
      description: 'seed row',
    },
    opts.user ?? opts.organizationId,
  );
  // logEvent sets createdAt = now; for ordered-pagination tests we need control,
  // so optionally override created_at directly.
  if (opts.createdAt) {
    await H.scopedPool.query(
      `UPDATE "${H.schema}".audit_log_entry SET created_at=$1 WHERE id=$2`,
      [opts.createdAt.toISOString(), entry.id],
    );
  }
  return entry.id;
}

/** Count rows for a resource within an org (used to find the self-audit row). */
async function countSelfAuditRows(organizationId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".audit_log_entry
       WHERE resource='audit_logs_query' AND organization_id=$1`,
    [organizationId],
  );
  return rows[0].n as number;
}

beforeAll(async () => {
  H = await createScratch(['audit_log_entry']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('listAuditLogs — REAL repo org-scope boundary (S5)', () => {
  test('returns ONLY ORG_A rows; totalCount = ORG_A count', async () => {
    if (!H.dbReachable) return;

    const callerId = '00000000-0000-4000-8000-00000000ca11';
    const a1 = await seedRow({ organizationId: ORG_A, resource: 'a-rec-1' });
    const a2 = await seedRow({ organizationId: ORG_A, resource: 'a-rec-2' });
    const b1 = await seedRow({ organizationId: ORG_B, resource: 'b-rec-1' });

    const ctx = makeRealCtx({ userId: callerId, organizationId: ORG_A });
    const res = await listAuditLogs(ctx);
    expect(res.status).toBe(200);

    const ids: string[] = res.body.data.map((r: any) => r.id);
    // ORG_A seeded rows are present.
    expect(ids).toContain(a1);
    expect(ids).toContain(a2);
    // ORG_B row is NOT leaked.
    expect(ids).not.toContain(b1);

    // Every returned row is org-scoped to ORG_A at the SQL level.
    for (const row of res.body.data) {
      expect(row.organizationId).toBe(ORG_A);
    }

    // totalCount counts ONLY ORG_A rows. At this point ORG_A has a1 + a2 = 2
    // (the self-audit row from THIS call is written AFTER findMany/count).
    expect(res.body.pagination.totalCount).toBe(2);
  });
});

describe('listAuditLogs — querying audit logs is itself audited (S5)', () => {
  test('a self-audit row is PERSISTED with the documented shape', async () => {
    if (!H.dbReachable) return;

    const callerId = '00000000-0000-4000-8000-00000000ca22';
    const org = '00000000-0000-4000-8000-0000000000c3';
    const before = await countSelfAuditRows(org);

    const ctx = makeRealCtx({ userId: callerId, organizationId: org });
    await listAuditLogs(ctx);

    const after = await countSelfAuditRows(org);
    expect(after).toBe(before + 1);

    // Read the persisted self-audit row back and assert its real column values.
    const { rows } = await H.scopedPool.query(
      `SELECT event_type, category, action, outcome, resource_type, resource,
              "user", organization_id, retention_status, integrity_hash
         FROM "${H.schema}".audit_log_entry
        WHERE resource='audit_logs_query' AND organization_id=$1
        ORDER BY created_at DESC LIMIT 1`,
      [org],
    );
    const r = rows[0];
    expect(r.event_type).toBe('data-access');
    expect(r.category).toBe('administrative');
    expect(r.action).toBe('read');
    expect(r.outcome).toBe('success');
    expect(r.resource_type).toBe('audit_log');
    expect(r.resource).toBe('audit_logs_query');
    expect(r.user).toBe(callerId);
    expect(r.organization_id).toBe(org);
    expect(r.retention_status).toBe('active');
    // logEvent computed + persisted a real SHA-256 integrity hash.
    expect(r.integrity_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('listAuditLogs — startDate>endDate rejects before any repo call (S5)', () => {
  test('throws ValidationError and writes NO self-audit row', async () => {
    if (!H.dbReachable) return;

    const callerId = '00000000-0000-4000-8000-00000000ca33';
    const org = '00000000-0000-4000-8000-0000000000d4';
    const before = await countSelfAuditRows(org);

    const ctx = makeRealCtx({
      userId: callerId,
      organizationId: org,
      query: {
        startDate: '2025-12-01T00:00:00.000Z',
        endDate: '2025-01-01T00:00:00.000Z',
      },
    });

    await expect(listAuditLogs(ctx)).rejects.toBeInstanceOf(ValidationError);

    // The validation guard runs BEFORE findMany/count/logEvent — no row leaked,
    // no self-audit row written.
    const after = await countSelfAuditRows(org);
    expect(after).toBe(before);
  });
});

describe('listAuditLogs — pagination over real rows (S5)', () => {
  test('limit=10 offset=20 over 30 rows returns the correct page; totalCount=30', async () => {
    if (!H.dbReachable) return;

    const callerId = '00000000-0000-4000-8000-00000000ca44';
    const org = '00000000-0000-4000-8000-0000000000e5';

    // Seed 30 rows with strictly increasing created_at so findMany's default
    // ORDER BY created_at ASC gives a deterministic page.
    const base = new Date('2026-01-01T00:00:00.000Z').getTime();
    const orderedIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const id = await seedRow({
        organizationId: org,
        resource: `page-rec-${i}`,
        createdAt: new Date(base + i * 60_000), // +1min each
      });
      orderedIds.push(id);
    }

    const ctx = makeRealCtx({
      userId: callerId,
      organizationId: org,
      query: { limit: '10', offset: '20' },
    });
    const res = await listAuditLogs(ctx);
    expect(res.status).toBe(200);

    // Exactly 10 rows on this page.
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.offset).toBe(20);

    // The page is rows 21..30 in created_at-ascending order (indices 20..29).
    const pageIds: string[] = res.body.data.map((r: any) => r.id);
    expect(pageIds).toEqual(orderedIds.slice(20, 30));

    // totalCount = the 30 seeded rows (the self-audit row from THIS call is
    // written AFTER count, so it does not inflate this number).
    expect(res.body.pagination.totalCount).toBe(30);
  });
});
