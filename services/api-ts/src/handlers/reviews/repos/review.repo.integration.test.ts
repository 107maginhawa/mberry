/**
 * Real-PG integration suite for the reviews module (B2 content, Slice 2).
 *
 * Proves the 4 live DB CHECK/UNIQUE constraints + the org_id NOT-NULL invariant
 * fire real Postgres SQLSTATE codes through the ReviewRepository insert path —
 * replacing the fake-db illusion in createReview.test.ts / reviews-handlers.test.ts
 * (which mock the repo and never exercise real SQL). In particular this nails the
 * nps-range gap that createReview.test.ts:186 explicitly punted on: the handler
 * does NOT validate range, so the DB CHECK is the only enforcement layer.
 *
 * Tables via createContentScratch (FKs dropped by LIKE … INCLUDING ALL; the
 * UNIQUE + CHECK constraints ARE copied). Guard every body with H.dbReachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ReviewRepository } from './review.repo';
import {
  createContentScratch,
  CONTENT_ORG,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: ReviewRepository;

beforeAll(async () => {
  H = await createContentScratch();
  if (!H.dbReachable) return;
  repo = new ReviewRepository(H.db as never);
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

/**
 * Insert one review row through the real repo insert path with full control over
 * the constraint-relevant columns. createReview() forces npsScore/comment from a
 * request DTO, so for boundary/violation values we go through createOne directly
 * (same `db.insert(reviews)` path, no app-layer coercion).
 */
function reviewRow(o: Partial<Record<string, unknown>> = {}) {
  return {
    organizationId: CONTENT_ORG,
    context: crypto.randomUUID(),
    reviewer: crypto.randomUUID(),
    reviewType: 'nps',
    reviewedEntity: null,
    npsScore: 5,
    comment: null,
    createdBy: null,
    updatedBy: null,
    ...o,
  } as never;
}

describe('reviews_nps_score_check — CHECK (nps_score 0..10) → 23514', () => {
  test('nps_score=-1 raises 23514', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.createOne(reviewRow({ npsScore: -1 }));
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23514');
  });

  test('nps_score=11 raises 23514', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.createOne(reviewRow({ npsScore: 11 }));
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23514');
  });

  test('nps_score=0 (low boundary) inserts and reads back 0', async () => {
    if (!H.dbReachable) return;
    const row = await repo.createOne(reviewRow({ npsScore: 0 }));
    const { rows } = await H.scopedPool.query(
      `SELECT nps_score FROM "${H.schema}".review WHERE id=$1`,
      [row.id],
    );
    expect(rows[0].nps_score).toBe(0);
  });

  test('nps_score=10 (high boundary) inserts and reads back 10', async () => {
    if (!H.dbReachable) return;
    const row = await repo.createOne(reviewRow({ npsScore: 10 }));
    const { rows } = await H.scopedPool.query(
      `SELECT nps_score FROM "${H.schema}".review WHERE id=$1`,
      [row.id],
    );
    expect(rows[0].nps_score).toBe(10);
  });
});

describe('reviews_comment_check — CHECK (length(comment) <= 1000) → 23514', () => {
  test('comment length 1001 raises 23514', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.createOne(reviewRow({ comment: 'x'.repeat(1001) }));
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23514');
  });

  test('comment length 1000 inserts and reads back length=1000', async () => {
    if (!H.dbReachable) return;
    const row = await repo.createOne(reviewRow({ comment: 'x'.repeat(1000) }));
    const { rows } = await H.scopedPool.query(
      `SELECT length(comment) AS len FROM "${H.schema}".review WHERE id=$1`,
      [row.id],
    );
    expect(Number(rows[0].len)).toBe(1000);
  });
});

describe('review_type over-length is rejected (varchar(50) cap precedes the redundant CHECK)', () => {
  // FINDING: the plan predicted 23514 (reviews_review_type_check) for length 51,
  // but `review_type` is declared `varchar('review_type', { length: 50 })`. The
  // varchar length limit fires FIRST, so a 51-char value is rejected with 22001
  // (string_data_right_truncation), never reaching the CHECK. The CHECK
  // (length(review_type) <= 50) is therefore redundant — it can only ever match
  // values the varchar cap already admits. Asserting the REAL outcome (22001),
  // which still proves over-length review_type cannot persist.
  test('review_type length 51 is rejected with 22001 (varchar truncation)', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.createOne(reviewRow({ reviewType: 'r'.repeat(51) }));
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('22001');
  });

  test('review_type length 50 inserts', async () => {
    if (!H.dbReachable) return;
    const row = await repo.createOne(reviewRow({ reviewType: 'r'.repeat(50) }));
    const { rows } = await H.scopedPool.query(
      `SELECT length(review_type) AS len FROM "${H.schema}".review WHERE id=$1`,
      [row.id],
    );
    expect(Number(rows[0].len)).toBe(50);
  });
});

describe('reviews_context_reviewer_type_unique — UNIQUE (context_id, reviewer_id, review_type) → 23505', () => {
  test('duplicate (context, reviewer, review_type) raises 23505; differing review_type inserts (3-tuple key)', async () => {
    if (!H.dbReachable) return;
    const context = crypto.randomUUID();
    const reviewer = crypto.randomUUID();
    await repo.createOne(reviewRow({ context, reviewer, reviewType: 'nps' }));

    let code: string | undefined;
    try {
      await repo.createOne(reviewRow({ context, reviewer, reviewType: 'nps' }));
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23505');

    // Same (context, reviewer) but different review_type → admitted (proves the
    // 3rd tuple column is load-bearing, not just (context, reviewer)).
    await repo.createOne(reviewRow({ context, reviewer, reviewType: 'csat' }));

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".review
         WHERE context_id=$1 AND reviewer_id=$2`,
      [context, reviewer],
    );
    expect(rows[0].n).toBe(2);
  });
});

describe('organization_id NOT NULL → 23502 (characterization)', () => {
  test('null organization_id raises 23502', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.createOne(reviewRow({ organizationId: null }));
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });
});
