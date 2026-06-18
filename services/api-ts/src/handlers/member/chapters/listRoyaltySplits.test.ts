import { describe, test, expect, afterEach } from 'bun:test';
import { listRoyaltySplits } from './listRoyaltySplits';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { RoyaltySplitRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const split1 = {
  id: 'rs-1',
  organizationId: 'tenant-1',
  membershipId: 'mem-1',
  nationalOrgId: 'nat-1',
  chapterId: 'ch-1',
  splitPercentNational: 70,
  splitPercentChapter: 30,
  effectiveDate: '2024-01-01',
};

const split2 = {
  id: 'rs-2',
  organizationId: 'tenant-1',
  membershipId: 'mem-2',
  nationalOrgId: 'nat-1',
  chapterId: 'ch-2',
  splitPercentNational: 60,
  splitPercentChapter: 40,
  effectiveDate: '2024-02-01',
};

function makePaginatedResult(data: any[], totalCount = data.length) {
  return { data, totalCount };
}

// ─── Tests ───────────────────────────────────────────────

describe('listRoyaltySplits', () => {
  afterEach(() => restoreRepo(RoyaltySplitRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null });
    await expect(listRoyaltySplits(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('happy path — returns paginated royalty splits with correct shape', async () => {
    stubRepo(RoyaltySplitRepository, {
      findManyWithPagination: async () => makePaginatedResult([split1, split2]),
    });

    const ctx = makeCtx({ _query: { offset: '0', limit: '20' } });
    const response = await listRoyaltySplits(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([split1, split2]);
    expect(response.body.pagination.totalCount).toBe(2);
    expect(response.body.pagination.count).toBe(2);
    expect(response.body.pagination.hasNextPage).toBe(false);
    expect(response.body.pagination.hasPreviousPage).toBe(false);
  });

  test('empty list — returns data:[] with pagination zeros', async () => {
    stubRepo(RoyaltySplitRepository, {
      findManyWithPagination: async () => makePaginatedResult([], 0),
    });

    const ctx = makeCtx({ _query: {} });
    const response = await listRoyaltySplits(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalCount).toBe(0);
  });

  test('filters chapterId and membershipId passed to repo', async () => {
    let capturedFilters: any;
    stubRepo(RoyaltySplitRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return makePaginatedResult([split1]);
      },
    });

    const ctx = makeCtx({
      _query: { chapterId: 'ch-1', membershipId: 'mem-1', offset: '0', limit: '10' },
    });
    await listRoyaltySplits(ctx);

    expect(capturedFilters.chapterId).toBe('ch-1');
    expect(capturedFilters.membershipId).toBe('mem-1');
    expect(capturedFilters.organizationId).toBe('tenant-1');
  });

  test('pagination defaults — offset=0, limit=20 when query omitted', async () => {
    let capturedOpts: any;
    stubRepo(RoyaltySplitRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        capturedOpts = opts;
        return makePaginatedResult([]);
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listRoyaltySplits(ctx);

    expect(capturedOpts.pagination.offset).toBe(0);
    expect(capturedOpts.pagination.limit).toBe(20);
  });

  test('pagination math — page 3 of 5 correctness', async () => {
    stubRepo(RoyaltySplitRepository, {
      findManyWithPagination: async () => makePaginatedResult([split1], 50),
    });

    const ctx = makeCtx({ _query: { offset: '20', limit: '10' } });
    const response = await listRoyaltySplits(ctx) as any;

    expect(response.body.pagination.currentPage).toBe(3);
    expect(response.body.pagination.totalPages).toBe(5);
    expect(response.body.pagination.hasNextPage).toBe(true);
    expect(response.body.pagination.hasPreviousPage).toBe(true);
  });
});
