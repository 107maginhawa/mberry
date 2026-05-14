import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { ReviewRepository } from './repos/review.repo';
import { getReview } from './getReview';

const fakeReview = {
  id: 'review-1',
  reviewer: 'user-1',
  reviewedEntity: 'user-2',
  reviewType: 'nps',
  context: 'booking',
  rating: 5,
  comment: 'Great',
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getReview', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { review: 'review-1' } });
    await expect(getReview(ctx as any)).rejects.toThrow();
  });

  test('returns review when owner accesses it', async () => {
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => fakeReview,
      canUserAccessReview: (_review: any, _userId: string) => true,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      session: { id: 'session-1', userId: 'user-1', user: { id: 'user-1', role: 'user' } },
      _params: { review: 'review-1' },
    });

    const res = await getReview(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when review does not exist', async () => {
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => null,
      canUserAccessReview: () => false,
    });

    const ctx = makeCtx({
      _params: { review: 'missing-review' },
    });

    await expect(getReview(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-owner accesses review', async () => {
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => fakeReview,
      canUserAccessReview: () => false,
    });

    const ctx = makeCtx({
      user: { id: 'other-user', role: 'user' },
      session: { id: 'session-1', userId: 'other-user', user: { id: 'other-user', role: 'user' } },
      _params: { review: 'review-1' },
    });

    await expect(getReview(ctx as any)).rejects.toThrow();
  });

  test('admin can access any review', async () => {
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => fakeReview,
      canUserAccessReview: () => false, // doesn't matter for admin
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      session: { id: 'session-1', userId: 'admin-1', user: { id: 'admin-1', role: 'admin' } },
      _params: { review: 'review-1' },
    });

    const res = await getReview(ctx as any);
    expect(res.status).toBe(200);
  });
});
