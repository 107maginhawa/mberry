/**
 * listTickets — characterization tests (AHA FIX-002 backfill)
 *
 * Path: GET /admin/tickets
 * Auth: session + platformAdmin required.
 * Returns computed slaStatus per row; supports status/priority/assignee filters.
 *
 * Honest-baseline note (FIX-017 / G17): the handler currently orders by
 * `createdAt` ASC only — NOT priority-then-age as PA-8 step 1 requires. These
 * tests assert the REAL current behavior (insertion/`createdAt` order preserved
 * by the mock DB). The priority-sort fix is a separate gated batch (Batch B,
 * FIX-006); see fix report §9.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listTickets } from './listTickets';

const FAKE_ADMIN = { id: 'pa-1', userId: 'user-1', role: 'super' };

function ticket(overrides: Record<string, any> = {}) {
  return {
    id: 'ticket-1',
    status: 'open',
    priority: 'medium',
    assignedTo: null,
    firstRespondedAt: null,
    slaFirstResponseDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
    slaResolutionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeListDb(rows: any[], capture?: { where?: unknown }) {
  return {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          if (capture) capture.where = cond;
          return { orderBy: async () => rows };
        },
      }),
    }),
  };
}

/**
 * The handler calls `ctx.req.query()` with NO argument, expecting Hono's
 * "return all query params as a record" behavior. makeCtx only models the
 * keyed form, so we patch the no-arg form to return `queryRecord`.
 */
function withQueryRecord(ctx: any, queryRecord: Record<string, string>) {
  ctx.req.query = () => queryRecord;
  return ctx;
}

/**
 * FIX-006 (G17): captures the exact arguments passed to `.orderBy(...)` so the
 * test can assert priority-desc-then-createdAt-asc ordering (PA-8 step 1).
 */
function makeOrderCapturingDb(rows: any[], capture: { orderBy?: any[] }) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async (...args: any[]) => {
            capture.orderBy = args;
            return rows;
          },
        }),
      }),
    }),
  };
}

/**
 * Inspect a Drizzle `asc()`/`desc()` order term: pull the column DB name and
 * the sort direction out of its SQL chunks. `desc(col)` builds
 * sql`${col} desc` → queryChunks = [Column(name), StringChunk(' desc')].
 */
function orderInfo(term: any): { col?: string; dir: 'asc' | 'desc' } {
  const chunks = term?.queryChunks ?? [];
  let col: string | undefined;
  let dir: 'asc' | 'desc' = 'asc';
  for (const c of chunks) {
    if (c && typeof c === 'object' && typeof (c as any).name === 'string') {
      col = (c as any).name;
    }
    const v = (c as any)?.value;
    const s = Array.isArray(v) ? v.join('') : typeof v === 'string' ? v : '';
    if (s.includes('desc')) dir = 'desc';
    else if (s.includes('asc')) dir = 'asc';
  }
  return { col, dir };
}

describe('listTickets (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    const res = await listTickets(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' } });
    const res = await listTickets(ctx);
    expect(res.status).toBe(403);
  });

  test('returns rows with computed slaStatus for an admin', async () => {
    const ctx = withQueryRecord(makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      database: makeListDb([ticket()]),
      _query: {},
    }), {});
    const res = await listTickets(ctx);
    expect(res.status ?? 200).toBe(200);
    const data = (res as any).body?.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].slaStatus).toBe('on_track');
  });

  test('marks an overdue open ticket as breached', async () => {
    const overdue = ticket({
      slaFirstResponseDeadline: new Date(Date.now() - 60 * 60 * 1000),
      slaResolutionDeadline: new Date(Date.now() - 30 * 60 * 1000),
    });
    const ctx = withQueryRecord(makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      database: makeListDb([overdue]),
      _query: {},
    }), {});
    const res = await listTickets(ctx);
    expect((res as any).body?.data[0].slaStatus).toBe('breached');
  });

  test('resolved tickets report on_track regardless of deadlines', async () => {
    const resolved = ticket({
      status: 'resolved',
      slaResolutionDeadline: new Date(Date.now() - 60 * 60 * 1000),
    });
    const ctx = withQueryRecord(makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      database: makeListDb([resolved]),
      _query: {},
    }), {});
    const res = await listTickets(ctx);
    expect((res as any).body?.data[0].slaStatus).toBe('on_track');
  });

  // FIX-006 (G17): PA-8 step 1 requires the inbox sorted by priority (highest
  // first) then age (oldest first). The ticket_priority enum is declared
  // low → standard → high → critical, so Postgres orders it by severity and
  // `desc(priority)` surfaces critical first. This asserts the handler issues
  // ORDER BY priority DESC, created_at ASC — not the old createdAt-only order.
  test('FIX-006: orders by priority DESC then createdAt ASC (PA-8 step 1)', async () => {
    const capture: { orderBy?: any[] } = {};
    const ctx = withQueryRecord(makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: FAKE_ADMIN,
      database: makeOrderCapturingDb([], capture),
      _query: {},
    }), {});

    await listTickets(ctx);

    expect(capture.orderBy).toHaveLength(2);
    expect(orderInfo(capture.orderBy![0])).toEqual({ col: 'priority', dir: 'desc' });
    expect(orderInfo(capture.orderBy![1])).toEqual({ col: 'created_at', dir: 'asc' });
  });
});
