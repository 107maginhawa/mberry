import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { ReviewRepository } from './repos/review.repo';
import { deleteReview } from './deleteReview';

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

describe('deleteReview', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { review: 'review-1' } });
    await expect(deleteReview(ctx as any)).rejects.toThrow();
  });

  test('deletes review and returns 204 when owner', async () => {
    let deleteCalled = false;
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => fakeReview,
      deleteReview: async () => { deleteCalled = true; },
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      session: { id: 'session-1', userId: 'user-1', user: { id: 'user-1', role: 'user' } },
      _params: { review: 'review-1' },
    });

    const res = await deleteReview(ctx as any);
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  test('throws NotFoundError when review does not exist', async () => {
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => null,
      deleteReview: async () => {},
    });

    const ctx = makeCtx({
      _params: { review: 'missing-review' },
    });

    await expect(deleteReview(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-owner tries to delete', async () => {
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => fakeReview,
      deleteReview: async () => {},
    });

    const ctx = makeCtx({
      user: { id: 'other-user', role: 'user' },
      session: { id: 'session-1', userId: 'other-user', user: { id: 'other-user', role: 'user' } },
      _params: { review: 'review-1' },
    });

    await expect(deleteReview(ctx as any)).rejects.toThrow();
  });

  test('admin can delete any review', async () => {
    let deleteCalled = false;
    mocks = stubRepo(ReviewRepository, {
      getActiveReviewById: async () => fakeReview,
      deleteReview: async () => { deleteCalled = true; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      session: { id: 'session-1', userId: 'admin-1', user: { id: 'admin-1', role: 'admin' } },
      _params: { review: 'review-1' },
    });

    const res = await deleteReview(ctx as any);
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });
});
