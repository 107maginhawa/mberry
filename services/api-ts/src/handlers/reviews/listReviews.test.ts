import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeReview as createFakeReview } from '@/test-utils/factories';
import { ReviewRepository } from './repos/review.repo';
import { listReviews } from './listReviews';

const fakeReview = createFakeReview({
  reviewer: 'user-1',
  reviewedEntity: 'user-2',
  reviewType: 'nps',
  context: 'booking',
  rating: 5,
  comment: 'Great session',
  deletedAt: null,
  updatedAt: new Date(),
});

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

  // FIX-011 (G-12): org-scope listReviews from ctx.get('organizationId').
  test('FIX-011: org-scopes a non-admin caller to their organization', async () => {
    let capturedFilters: any;
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      organizationId: 'org-A',
      _query: {},
    });

    await listReviews(ctx as any);
    expect(capturedFilters.organizationId).toBe('org-A');
  });

  test('FIX-011: platform admin without org context lists cross-org (no org filter)', async () => {
    let capturedFilters: any;
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      session: { id: 'session-1', userId: 'admin-1', user: { id: 'admin-1', role: 'admin' } },
      organizationId: undefined,
      _query: {},
    });

    await listReviews(ctx as any);
    expect(capturedFilters.organizationId).toBeUndefined();
  });

  test('FIX-011: multi-role admin recognized via hasRole; still org-scoped when org context present', async () => {
    let capturedFilters: any;
    mocks = stubRepo(ReviewRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    // role string carries multiple comma-separated roles — the buggy `=== 'admin'`
    // check would mis-classify this admin as a non-admin and 403 on the cross-user filter.
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin,platform_admin' },
      session: { id: 'session-1', userId: 'admin-1', user: { id: 'admin-1', role: 'admin,platform_admin' } },
      organizationId: 'org-B',
      _query: { reviewer: 'someone-else' },
    });

    await listReviews(ctx as any);
    expect(capturedFilters.organizationId).toBe('org-B');
  });
});
