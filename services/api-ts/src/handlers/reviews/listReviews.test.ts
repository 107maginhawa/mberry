import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { ReviewRepository } from './repos/review.repo';
import { listReviews } from './listReviews';

const fakeReview = {
  id: 'review-1',
  reviewer: 'user-1',
  reviewedEntity: 'user-2',
  reviewType: 'nps',
  context: 'booking',
  rating: 5,
  comment: 'Great session',
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('listReviews', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(listReviews(ctx as any)).rejects.toThrow();
  });

  test('returns reviews for authenticated user (own reviews)', async () => {
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async () => ({ data: [fakeReview], totalCount: 1 }),
    });

    const ctx = makeCtx({
      _query: {},
    });

    const res = await listReviews(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.pagination).toBeDefined();
  });

  test('throws ForbiddenError when non-admin filters by another reviewer', async () => {
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _query: { reviewer: 'other-user' },
    });

    await expect(listReviews(ctx as any)).rejects.toThrow();
  });

  test('admin can list all reviews', async () => {
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async () => ({ data: [fakeReview], totalCount: 1 }),
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      session: { id: 'session-1', userId: 'admin-1', user: { id: 'admin-1', role: 'admin' } },
      _query: { reviewer: 'other-user' },
    });

    const res = await listReviews(ctx as any);
    expect(res.status).toBe(200);
  });

  test('pagination defaults applied', async () => {
    let capturedPaginationOpts: any;
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        capturedPaginationOpts = opts;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listReviews(ctx as any);
    expect(capturedPaginationOpts.pagination.limit).toBe(20);
    expect(capturedPaginationOpts.pagination.offset).toBe(0);
  });
});
