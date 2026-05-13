/**
 * Tests for getReview, listReviews, and deleteReview handlers
 *
 * Covers: auth guards, happy paths, not-found, RBAC (admin, owner,
 * reviewed entity), and listReviews filtering/pagination.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { getReview } from './getReview';
import { listReviews } from './listReviews';
import { deleteReview } from './deleteReview';
import { ReviewRepository } from './repos/review.repo';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/core/errors';
import type { Review } from './repos/review.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(userId = 'user-1', role = 'user') {
  return { user: { id: userId, name: 'Alice', email: 'alice@test.com', role } };
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
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as Review;
}

// ---------------------------------------------------------------------------
// Context builder — mirrors createReview.test.ts pattern, extended for
// params and query support needed by get/list/delete handlers.
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  session?: ReturnType<typeof makeSession> | null;
  params?: Record<string, any>;
  query?: Record<string, any>;
  logger?: any;
} = {}) {
  const session = opts.session !== undefined ? opts.session : makeSession();
  const params = opts.params ?? { review: 'review-1' };
  const query = opts.query ?? {};
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
      valid: (target: string) => {
        if (target === 'param') return params;
        if (target === 'query') return query;
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    body: (_body: any, status: number) => {
      captured = { data: null, status };
      return new Response(null, { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

// ===========================================================================
// getReview
// ===========================================================================

describe('getReview', () => {
  let getActiveReviewById: ReturnType<typeof mock>;
  let canUserAccessReview: ReturnType<typeof mock>;

  beforeEach(() => {
    getActiveReviewById = mock(async () => makeReview());
    canUserAccessReview = mock(() => true);

    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;
    ReviewRepository.prototype.canUserAccessReview = canUserAccessReview as any;
  });

  test('returns review with 200 for owner', async () => {
    const ctx = makeCtx();
    await getReview(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('review-1');
  });

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null });
    await expect(getReview(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws NotFoundError when review does not exist', async () => {
    getActiveReviewById = mock(async () => null);
    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;

    const ctx = makeCtx();
    await expect(getReview(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when non-admin lacks access', async () => {
    canUserAccessReview = mock(() => false);
    ReviewRepository.prototype.canUserAccessReview = canUserAccessReview as any;

    const ctx = makeCtx({ session: makeSession('stranger') });
    await expect(getReview(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows admin to access any review', async () => {
    canUserAccessReview = mock(() => false); // would block non-admin
    ReviewRepository.prototype.canUserAccessReview = canUserAccessReview as any;

    const ctx = makeCtx({ session: makeSession('admin-1', 'admin') });
    await getReview(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
  });

  test('allows reviewed entity to access the review', async () => {
    canUserAccessReview = mock(() => true);
    ReviewRepository.prototype.canUserAccessReview = canUserAccessReview as any;

    const ctx = makeCtx({ session: makeSession('user-2') });
    await getReview(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
    expect(canUserAccessReview).toHaveBeenCalledTimes(1);
  });

  test('passes correct reviewId from path params to repo', async () => {
    const ctx = makeCtx({ params: { review: 'rev-xyz' } });
    await getReview(ctx);

    const call = (getActiveReviewById as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0]).toBe('rev-xyz');
  });
});

// ===========================================================================
// listReviews
// ===========================================================================

describe('listReviews', () => {
  let findManyWithPagination: ReturnType<typeof mock>;

  beforeEach(() => {
    findManyWithPagination = mock(async () => ({
      data: [makeReview()],
      totalCount: 1,
    }));

    ReviewRepository.prototype.findManyWithPagination = findManyWithPagination as any;
  });

  test('returns paginated reviews with 200', async () => {
    const ctx = makeCtx();
    await listReviews(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.pagination).toBeDefined();
  });

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null });
    await expect(listReviews(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('defaults reviewer filter to current user for non-admins', async () => {
    const ctx = makeCtx({ session: makeSession('user-1') });
    await listReviews(ctx);

    const call = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0];
    const filters = call[0];
    expect(filters.reviewer).toBe('user-1');
  });

  test('allows admin to list all reviews without restriction', async () => {
    const ctx = makeCtx({ session: makeSession('admin-1', 'admin') });
    await listReviews(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
    // Admin: filters.reviewer should not be force-set
    const call = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0];
    const filters = call[0];
    expect(filters.reviewer).toBeUndefined();
  });

  test('throws ForbiddenError when non-admin filters by another reviewer', async () => {
    const ctx = makeCtx({
      session: makeSession('user-1'),
      query: { reviewer: 'user-other' },
    });
    await expect(listReviews(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws ForbiddenError when non-admin filters by another reviewedEntity', async () => {
    const ctx = makeCtx({
      session: makeSession('user-1'),
      query: { reviewedEntity: 'user-other' },
    });
    await expect(listReviews(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('allows non-admin to filter own reviews as reviewer', async () => {
    const ctx = makeCtx({
      session: makeSession('user-1'),
      query: { reviewer: 'user-1' },
    });
    await listReviews(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
  });

  test('allows non-admin to filter reviews about themselves', async () => {
    const ctx = makeCtx({
      session: makeSession('user-1'),
      query: { reviewedEntity: 'user-1' },
    });
    await listReviews(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(200);
  });

  test('passes pagination params to repo', async () => {
    const ctx = makeCtx({
      query: { page: '2', limit: '10' },
      session: makeSession('admin-1', 'admin'),
    });
    await listReviews(ctx);

    const call = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0];
    const options = call[1];
    expect(options.pagination.limit).toBe(10);
    expect(options.pagination.offset).toBe(10); // (page 2 - 1) * 10
  });

  test('passes filter params to repo', async () => {
    const ctx = makeCtx({
      session: makeSession('admin-1', 'admin'),
      query: { context: 'ctx-1', reviewType: 'service' },
    });
    await listReviews(ctx);

    const call = (findManyWithPagination as ReturnType<typeof mock>).mock.calls[0];
    const filters = call[0];
    expect(filters.context).toBe('ctx-1');
    expect(filters.reviewType).toBe('service');
  });
});

// ===========================================================================
// deleteReview
// ===========================================================================

describe('deleteReview', () => {
  let getActiveReviewById: ReturnType<typeof mock>;
  let deleteReviewMethod: ReturnType<typeof mock>;

  beforeEach(() => {
    getActiveReviewById = mock(async () => makeReview());
    deleteReviewMethod = mock(async () => {});

    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;
    ReviewRepository.prototype.deleteReview = deleteReviewMethod as any;
  });

  test('deletes review and returns 204', async () => {
    const ctx = makeCtx({ session: makeSession('user-1') });
    await deleteReview(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(204);
    expect(deleteReviewMethod).toHaveBeenCalledTimes(1);
  });

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null });
    await expect(deleteReview(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(deleteReviewMethod).not.toHaveBeenCalled();
  });

  test('throws NotFoundError when review does not exist', async () => {
    getActiveReviewById = mock(async () => null);
    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;

    const ctx = makeCtx();
    await expect(deleteReview(ctx)).rejects.toBeInstanceOf(NotFoundError);
    expect(deleteReviewMethod).not.toHaveBeenCalled();
  });

  test('throws ForbiddenError when non-admin tries to delete others review', async () => {
    getActiveReviewById = mock(async () => makeReview({ reviewer: 'other-user' }));
    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;

    const ctx = makeCtx({ session: makeSession('user-1') });
    await expect(deleteReview(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteReviewMethod).not.toHaveBeenCalled();
  });

  test('allows admin to delete any review', async () => {
    getActiveReviewById = mock(async () => makeReview({ reviewer: 'other-user' }));
    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;

    const ctx = makeCtx({ session: makeSession('admin-1', 'admin') });
    await deleteReview(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(204);
    expect(deleteReviewMethod).toHaveBeenCalledTimes(1);
  });

  test('passes correct reviewId to deleteReview repo method', async () => {
    const ctx = makeCtx({ params: { review: 'rev-abc' } });
    await deleteReview(ctx);

    const call = (deleteReviewMethod as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0]).toBe('rev-abc');
  });

  test('owner can delete their own review', async () => {
    getActiveReviewById = mock(async () => makeReview({ reviewer: 'user-5' }));
    ReviewRepository.prototype.getActiveReviewById = getActiveReviewById as any;

    const ctx = makeCtx({ session: makeSession('user-5') });
    await deleteReview(ctx);

    const { status } = ctx._captured();
    expect(status).toBe(204);
  });
});
