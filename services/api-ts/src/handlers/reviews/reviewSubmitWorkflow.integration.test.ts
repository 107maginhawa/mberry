/**
 * Real-PG NPS review submit WORKFLOW e2e (B2 content, reviews Slice 5).
 *
 * Drives the FOUR real reviews handlers — createReview → getReview →
 * listReviews → deleteReview — back-to-back against ONE `createContentScratch`
 * scratch schema, with a REAL `ReviewRepository` injected via ctx.get('database')
 * (NO prototype mocking). This is the member's full NPS lifecycle: submit a
 * score, read it back, see it in their own list, and (hard-)delete it.
 *
 * Every assertion is a REAL outcome: the response envelope the handler emitted,
 * a row read back via H.scopedPool, a count, or a Postgres SQLSTATE — never a
 * 200-only / toBeDefined tautology.
 *
 * Asserts (per §5.6 Slice 5):
 *  - Submit npsScore=9 reviewType='nps' comment='great' → 201, persisted row has
 *    those EXACT values (read-back).
 *  - Read-own: getReview as the reviewer → 200, data.npsScore===9, comment==='great'.
 *  - List-own RBAC: listReviews as the same non-admin (no filters → defaults
 *    reviewer=userId) → data.data[0].id===created.id, pagination.totalCount===1
 *    (the handler's buildPaginationMeta key; §5.6's `pagination.total` is shorthand).
 *  - Range guard at the workflow boundary: npsScore=12 → no persisted row
 *    (count unchanged). The DB CHECK reviews_nps_score_check (0..10) is the
 *    enforcing layer; the handler does not pre-validate (createReview.test.ts:186),
 *    so the out-of-range submit raises 23514 and leaks NO row.
 *  - Delete-own: deleteReview as the reviewer → 204; read-back count=0 — confirms
 *    the HARD delete (deleteOneById), characterizing the misleading "excludes
 *    soft-deleted" comment in review.repo.ts.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createReview } from './createReview';
import { getReview } from './getReview';
import { listReviews } from './listReviews';
import { deleteReview } from './deleteReview';
import { ReviewRepository } from './repos/review.repo';
import { createContentScratch, CONTENT_ORG } from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

/** Capture the Postgres SQLSTATE off a thrown drizzle/pg error (direct or wrapped). */
function pgCode(e: unknown): string | undefined {
  return (
    (e as { code?: string; cause?: { code?: string } }).code ??
    (e as { cause?: { code?: string } }).cause?.code
  );
}

/** A no-op pino-shaped logger (DatabaseRepository calls debug/info; child must self-return). */
function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  l['child'] = () => l;
  return l;
}

interface CtxOpts {
  userId: string;
  role?: string;
  /** request body for createReview */
  json?: unknown;
  /** path params: { review: id } */
  param?: Record<string, string>;
  /** query string params for listReviews */
  query?: Record<string, unknown>;
}

/**
 * Build a handler ctx wired to the REAL scratch db. `valid(kind)` dispatches by
 * kind so a single ctx serves create (json), get/delete (param) and list (query).
 * `json`/`body` capture the emitted response so we assert the real envelope.
 */
function makeCtx(opts: CtxOpts) {
  let captured: { data: unknown; status: number } = { data: null, status: 0 };
  const logger = makeLogger();
  const store: Record<string, unknown> = {
    session: {
      user: { id: opts.userId, name: 'Member', email: 'm@test.com', role: opts.role },
    },
    database: H.db,
    logger,
    requestId: 'trace-wf',
    organizationId: CONTENT_ORG,
  };
  const ctx = {
    get: (key: string) => store[key],
    req: {
      valid: (kind: 'json' | 'param' | 'query') => {
        if (kind === 'param') return opts.param ?? {};
        if (kind === 'query') return opts.query ?? {};
        return opts.json ?? {};
      },
    },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    body: (_: unknown, status: number) => {
      captured = { data: null, status };
      return new Response(null, { status });
    },
    _captured: () => captured,
  };
  return ctx as never;
}

function capture(ctx: never): { data: unknown; status: number } {
  return (ctx as unknown as { _captured: () => { data: unknown; status: number } })._captured();
}

async function countById(id: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".review WHERE id=$1`,
    [id],
  );
  return rows[0].n as number;
}

describe('reviews submit workflow — full member NPS lifecycle on real PG', () => {
  test('submit → read-own → list-own → delete-own round-trips through real SQL', async () => {
    if (!H.dbReachable) return;
    const userId = crypto.randomUUID();
    const context = crypto.randomUUID();

    // ── submit (createReview) ──────────────────────────────────────────────
    const createCtx = makeCtx({
      userId,
      json: { context, reviewType: 'nps', npsScore: 9, comment: 'great' },
    });
    await createReview(createCtx);
    const created = capture(createCtx);
    expect(created.status).toBe(201);
    const createdId = (created.data as { id: string }).id;

    // persisted row carries the EXACT submitted values
    const { rows } = await H.scopedPool.query(
      `SELECT reviewer_id, organization_id, nps_score, comment, review_type
         FROM "${H.schema}".review WHERE id=$1`,
      [createdId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].reviewer_id).toBe(userId);
    expect(rows[0].organization_id).toBe(CONTENT_ORG);
    expect(rows[0].nps_score).toBe(9);
    expect(rows[0].comment).toBe('great');
    expect(rows[0].review_type).toBe('nps');

    // ── read-own (getReview) ───────────────────────────────────────────────
    const getCtx = makeCtx({ userId, param: { review: createdId } });
    await getReview(getCtx);
    const got = capture(getCtx);
    expect(got.status).toBe(200);
    const gotReview = got.data as { id: string; npsScore: number; comment: string; reviewer: string };
    expect(gotReview.id).toBe(createdId);
    expect(gotReview.npsScore).toBe(9);
    expect(gotReview.comment).toBe('great');
    expect(gotReview.reviewer).toBe(userId);

    // ── list-own RBAC (listReviews, no filters → defaults reviewer=userId) ──
    const listCtx = makeCtx({ userId, query: {} });
    await listReviews(listCtx);
    const listed = capture(listCtx);
    expect(listed.status).toBe(200);
    // NOTE: the handler's buildPaginationMeta emits `totalCount` (the §5.6 plan's
    // `pagination.total` is a shorthand — the real envelope key is totalCount; we
    // assert the actual shape the handler produces, not the planning shorthand).
    const listBody = listed.data as { data: Array<{ id: string }>; pagination: { totalCount: number; count: number } };
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].id).toBe(createdId);
    expect(listBody.pagination.totalCount).toBe(1);
    expect(listBody.pagination.count).toBe(1);

    // ── delete-own (deleteReview) → 204, HARD delete ───────────────────────
    const deleteCtx = makeCtx({ userId, param: { review: createdId } });
    await deleteReview(deleteCtx);
    const deleted = capture(deleteCtx);
    expect(deleted.status).toBe(204);
    // hard delete: row is GONE (characterizes the misleading soft-delete comment)
    expect(await countById(createdId)).toBe(0);

    // and getReview now 404s on the deleted id (NotFoundError thrown)
    const getGoneCtx = makeCtx({ userId, param: { review: createdId } });
    await expect(getReview(getGoneCtx)).rejects.toThrow();
  });

  test('range guard at workflow boundary: npsScore=12 raises 23514 and leaks no row', async () => {
    if (!H.dbReachable) return;
    const userId = crypto.randomUUID();
    const context = crypto.randomUUID();

    const ctx = makeCtx({
      userId,
      json: { context, reviewType: 'nps', npsScore: 12 },
    });

    let code: string | undefined;
    try {
      await createReview(ctx);
    } catch (e) {
      code = pgCode(e);
    }
    // DB CHECK reviews_nps_score_check (0..10) is the enforcing layer
    expect(code).toBe('23514');

    // no out-of-range row persisted for this (context, reviewer)
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".review
         WHERE context_id=$1 AND reviewer_id=$2`,
      [context, userId],
    );
    expect(rows[0].n).toBe(0);
  });

  test('delete-own RBAC: a non-owner non-admin cannot delete; row survives', async () => {
    if (!H.dbReachable) return;
    const owner = crypto.randomUUID();
    const context = crypto.randomUUID();

    // owner submits via the real handler
    const createCtx = makeCtx({
      userId: owner,
      json: { context, reviewType: 'nps', npsScore: 6 },
    });
    await createReview(createCtx);
    const createdId = (capture(createCtx).data as { id: string }).id;
    expect(await countById(createdId)).toBe(1);

    // a different, non-admin user tries to delete it → ForbiddenError, row stays
    const stranger = crypto.randomUUID();
    const delCtx = makeCtx({ userId: stranger, param: { review: createdId } });
    await expect(deleteReview(delCtx)).rejects.toThrow();
    expect(await countById(createdId)).toBe(1);

    // verify the repo really still holds the row (not just the count helper)
    const repo = new ReviewRepository(H.db as never);
    const survivor = await repo.getActiveReviewById(createdId);
    expect(survivor?.reviewer).toBe(owner);
  });
});
