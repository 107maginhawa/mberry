/**
 * Real-PG integration suite for the createReview HANDLER (B2 content, Slice 3).
 *
 * Drives the REAL `createReview` handler with a REAL ReviewRepository backed by
 * a `createContentScratch` scratch schema (injected via ctx.get('database')) —
 * NO prototype mocking. Every assertion is against a persisted row read back via
 * H.scopedPool, a thrown AppError, or a real Postgres SQLSTATE.
 *
 * Proves the handler BRs as they behave end-to-end through SQL:
 *  - happy path: 201 + persisted reviewer_id/org_id/nps_score/created_by/updated_by
 *  - self-review guard (createReview.ts:46) → ValidationError, zero rows
 *  - app-level dup guard (createReview.ts:51 reviewExists) → ConflictError, count stays 1
 *  - NPS-range escalation: the handler does NOT validate range (createReview.test.ts:186
 *    punted on it), so npsScore=99 reaches the DB CHECK reviews_nps_score_check and
 *    surfaces as a raw Postgres 23514 — NOT a clean 4xx. This is the range-bypass the
 *    plan flagged as a bug-watch; documented in notes (see the describe block below).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createReview } from './createReview';
import { ReviewRepository } from './repos/review.repo';
import { ValidationError, ConflictError } from '@/core/errors';
import {
  createContentScratch,
  CONTENT_ORG,
  seedReview,
} from '@/test-utils/content-fixtures';
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

interface ReviewBody {
  context: string;
  reviewType: string;
  reviewedEntity?: string;
  npsScore: number;
  comment?: string;
}

/**
 * Build a handler ctx wired to the REAL scratch db. `database` returns H.db so
 * `new ReviewRepository(db)` inside the handler runs real SQL. `organizationId`
 * is CONTENT_ORG. Mirrors the createReview.test.ts ctx shape but with NO mocked
 * repo prototype.
 */
function makeCtx(opts: { userId?: string; body: ReviewBody }) {
  const userId = opts.userId ?? crypto.randomUUID();
  let captured: { data: unknown; status: number } = { data: null, status: 0 };
  // Full no-op logger: the real ReviewRepository (via DatabaseRepository) calls
  // logger.debug/info; `child` must return the same shape.
  const noopLogger: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  noopLogger['child'] = () => noopLogger;
  const ctx = {
    get: (key: string) => {
      const store: Record<string, unknown> = {
        session: { user: { id: userId, name: 'Tester', email: 't@test.com' } },
        database: H.db,
        logger: noopLogger,
        requestId: 'trace-1',
        organizationId: CONTENT_ORG,
      };
      return store[key];
    },
    req: { valid: () => opts.body },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };
  return { ctx: ctx as never, userId };
}

async function countReviews(context: string, reviewer: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".review
       WHERE context_id=$1 AND reviewer_id=$2`,
    [context, reviewer],
  );
  return rows[0].n as number;
}

describe('createReview handler — happy path persists a real row', () => {
  test('201 + persisted reviewer_id/org_id/nps_score/created_by/updated_by', async () => {
    if (!H.dbReachable) return;
    const context = crypto.randomUUID();
    const { ctx, userId } = makeCtx({
      body: { context, reviewType: 'nps', npsScore: 9, comment: 'great' },
    });

    await createReview(ctx);
    const { data, status } = (ctx as unknown as { _captured: () => { data: { id: string }; status: number } })._captured();

    expect(status).toBe(201);
    const { rows } = await H.scopedPool.query(
      `SELECT reviewer_id, organization_id, nps_score, comment, review_type,
              created_by, updated_by
         FROM "${H.schema}".review WHERE id=$1`,
      [data.id],
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.reviewer_id).toBe(userId);
    expect(r.organization_id).toBe(CONTENT_ORG);
    expect(r.nps_score).toBe(9);
    expect(r.comment).toBe('great');
    expect(r.review_type).toBe('nps');
    expect(r.created_by).toBe(userId);
    expect(r.updated_by).toBe(userId);
  });
});

describe('createReview handler — self-review guard (createReview.ts:46)', () => {
  test('reviewedEntity === userId throws ValidationError and persists nothing', async () => {
    if (!H.dbReachable) return;
    const context = crypto.randomUUID();
    const reviewer = crypto.randomUUID();
    const { ctx } = makeCtx({
      userId: reviewer,
      // reviewedEntity points at the reviewer himself → self-review
      body: { context, reviewType: 'nps', reviewedEntity: reviewer, npsScore: 8 },
    });

    await expect(createReview(ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(await countReviews(context, reviewer)).toBe(0);
  });
});

describe('createReview handler — app-level dup guard (reviewExists, createReview.ts:51)', () => {
  test('second identical (context, reviewer, reviewType) throws ConflictError; count stays 1', async () => {
    if (!H.dbReachable) return;
    const context = crypto.randomUUID();
    const reviewer = crypto.randomUUID();
    // seed an existing review for the same triple, authored by `reviewer`
    await seedReview(H, { organizationId: CONTENT_ORG, context, reviewerId: reviewer, reviewType: 'nps' });
    expect(await countReviews(context, reviewer)).toBe(1);

    const { ctx } = makeCtx({
      userId: reviewer,
      body: { context, reviewType: 'nps', npsScore: 7 },
    });

    await expect(createReview(ctx)).rejects.toBeInstanceOf(ConflictError);
    // no second row inserted — app-level guard short-circuits before createOne
    expect(await countReviews(context, reviewer)).toBe(1);
  });
});

describe('createReview handler — NPS range escalation (bug-watch)', () => {
  // BUG-WATCH FINDING (characterization, not a code change): the handler performs
  // NO npsScore range check — createReview.test.ts:186 explicitly removed it,
  // deferring entirely to the DB CHECK reviews_nps_score_check (0..10). So an
  // out-of-range body that bypasses the Zod validator (as a directly-invoked
  // handler does, exactly like a malformed/forged payload would at the repo seam)
  // reaches the INSERT and surfaces as a RAW Postgres 23514 error — it is NOT
  // mapped to a clean ValidationError/4xx by the handler; the global error
  // handler would render it 500. We assert the REAL outcome: the error carries
  // SQLSTATE 23514 and NO row is persisted (the range is still enforced at the
  // DB, so no bad data leaks — hence characterization, not realBugFound). The
  // layer-correct upgrade (a handler-level range guard returning 4xx) is left to
  // product per the plan's "if DB CHECK is the agreed contract, keep as
  // characterization" branch.
  test('npsScore=99 raises raw 23514 and persists no row', async () => {
    if (!H.dbReachable) return;
    const context = crypto.randomUUID();
    const reviewer = crypto.randomUUID();
    const { ctx } = makeCtx({
      userId: reviewer,
      body: { context, reviewType: 'nps', npsScore: 99 },
    });

    let code: string | undefined;
    let mappedToAppError = false;
    try {
      await createReview(ctx);
    } catch (e) {
      code = pgCode(e);
      mappedToAppError = e instanceof ValidationError || e instanceof ConflictError;
    }
    // raw DB CHECK code propagates (handler does not translate it)
    expect(code).toBe('23514');
    // and it is NOT a handler-mapped 4xx — documents the escalation surface
    expect(mappedToAppError).toBe(false);
    // but the range is still enforced: no bad row leaked
    expect(await countReviews(context, reviewer)).toBe(0);
  });

  test('npsScore=-1 (low out-of-range) also raises 23514, no row', async () => {
    if (!H.dbReachable) return;
    const context = crypto.randomUUID();
    const reviewer = crypto.randomUUID();
    const { ctx } = makeCtx({
      userId: reviewer,
      body: { context, reviewType: 'nps', npsScore: -1 },
    });
    let code: string | undefined;
    try {
      await createReview(ctx);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23514');
    expect(await countReviews(context, reviewer)).toBe(0);
  });
});
