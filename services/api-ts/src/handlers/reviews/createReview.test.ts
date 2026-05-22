/**
 * Tests for createReview handler
 *
 * Covers: creation, self-review prevention, duplicate detection, and
 * the npsScore validation note (0-10 constraint is enforced at the DB
 * level via a CHECK constraint, not in the handler — marked as todo).
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
import { createReview } from './createReview';
import { ReviewRepository } from './repos/review.repo';
import {
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from '@/core/errors';
import type { Review } from './repos/review.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(userId = 'user-1') {
  return { user: { id: userId, name: 'Alice', email: 'alice@test.com' } };
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    context: 'booking-uuid',
    reviewer: 'user-1',
    reviewType: 'booking',
    reviewedEntity: 'user-2',
    npsScore: 9,
    comment: 'Great service',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as Review;
}

function makeBody(overrides: Record<string, any> = {}) {
  return {
    context: 'booking-uuid',
    reviewType: 'booking',
    reviewedEntity: 'user-2',
    npsScore: 9,
    comment: 'Great service',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  session?: ReturnType<typeof makeSession> | null;
  body?: Record<string, any>;
  logger?: any;
} = {}) {
  const session = opts.session !== undefined ? opts.session : makeSession();
  const body = opts.body ?? makeBody();
  const logger = opts.logger ?? { info: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        session,
        database: {},
        logger,
      };
      return store[key];
    },
    req: {
      valid: () => body,
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createReview', () => {
  let reviewExists: ReturnType<typeof mock>;
  let createReviewMethod: ReturnType<typeof mock>;

  beforeEach(() => {
    reviewExists = mock(async () => false);
    createReviewMethod = mock(async () => makeReview());

    ReviewRepository.prototype.reviewExists = reviewExists as any;
    ReviewRepository.prototype.createReview = createReviewMethod as any;
  });

  test('creates review and returns 201', async () => {
    const ctx = makeCtx();
    await createReview(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(201);
    expect(data.id).toBe('review-1');
    expect(createReviewMethod).toHaveBeenCalledTimes(1);
  });

  test('passes reviewer id from session to createReview', async () => {
    const ctx = makeCtx({ session: makeSession('user-abc') });
    await createReview(ctx);

    const callArg = (createReviewMethod as ReturnType<typeof mock>).mock.calls[0];
    expect(callArg[1]).toBe('user-abc'); // second arg is reviewerId
  });

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null });
    await expect(createReview(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(createReviewMethod).not.toHaveBeenCalled();
  });

  test('throws ValidationError when reviewing yourself', async () => {
    const ctx = makeCtx({
      session: makeSession('user-1'),
      body: makeBody({ reviewedEntity: 'user-1' }), // same as reviewer
    });

    await expect(createReview(ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(createReviewMethod).not.toHaveBeenCalled();
  });

  test('throws ConflictError when duplicate review detected', async () => {
    reviewExists = mock(async () => true);
    ReviewRepository.prototype.reviewExists = reviewExists as any;

    const ctx = makeCtx();
    await expect(createReview(ctx)).rejects.toBeInstanceOf(ConflictError);
    expect(createReviewMethod).not.toHaveBeenCalled();
  });

  test('checks duplicate by context, reviewer, and reviewType', async () => {
    const ctx = makeCtx({
      body: makeBody({ context: 'ctx-uuid', reviewType: 'service' }),
      session: makeSession('user-99'),
    });
    await createReview(ctx);

    const existsCall = (reviewExists as ReturnType<typeof mock>).mock.calls[0];
    expect(existsCall[0]).toBe('ctx-uuid');
    expect(existsCall[1]).toBe('user-99');
    expect(existsCall[2]).toBe('service');
  });

  test('allows review when reviewedEntity is not set (general review)', async () => {
    const ctx = makeCtx({
      body: makeBody({ reviewedEntity: undefined }),
    });
    await createReview(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(201);
  });

  test('allows review when reviewedEntity differs from reviewer', async () => {
    const ctx = makeCtx({
      session: makeSession('user-1'),
      body: makeBody({ reviewedEntity: 'user-2' }),
    });
    await createReview(ctx);

    expect(createReviewMethod).toHaveBeenCalledTimes(1);
  });

  // npsScore range test removed — 0-10 constraint enforced by DB CHECK,
  // not handler logic. Covered by schema validation.
});
