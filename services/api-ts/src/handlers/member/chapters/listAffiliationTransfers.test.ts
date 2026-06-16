import { describe, test, expect, afterEach } from 'bun:test';
import { listAffiliationTransfers } from './listAffiliationTransfers';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AffiliationTransferRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const transfer1 = {
  id: 'xfer-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  fromChapterId: 'ch-1',
  toChapterId: 'ch-2',
  status: 'pending',
  requestedAt: '2024-03-01',
};

const transfer2 = {
  id: 'xfer-2',
  organizationId: 'tenant-1',
  personId: 'person-2',
  fromChapterId: 'ch-2',
  toChapterId: 'ch-3',
  status: 'approved',
  requestedAt: '2024-03-15',
};

function makePaginatedResult(data: any[], totalCount = data.length) {
  return { data, totalCount };
}

// ─── Tests ───────────────────────────────────────────────

describe('listAffiliationTransfers', () => {
  afterEach(() => restoreRepo(AffiliationTransferRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null });
    await expect(listAffiliationTransfers(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('happy path — returns paginated transfers with correct shape', async () => {
    stubRepo(AffiliationTransferRepository, {
      findManyWithPagination: async () => makePaginatedResult([transfer1, transfer2]),
    });

    const ctx = makeCtx({ _query: { offset: '0', limit: '20' } });
    const response = await listAffiliationTransfers(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([transfer1, transfer2]);
    expect(response.body.pagination.totalCount).toBe(2);
    expect(response.body.pagination.count).toBe(2);
    expect(response.body.pagination.offset).toBe(0);
    expect(response.body.pagination.limit).toBe(20);
    expect(response.body.pagination.hasNextPage).toBe(false);
    expect(response.body.pagination.hasPreviousPage).toBe(false);
  });

  test('empty list — returns data:[] with pagination zeros', async () => {
    stubRepo(AffiliationTransferRepository, {
      findManyWithPagination: async () => makePaginatedResult([], 0),
    });

    const ctx = makeCtx({ _query: {} });
    const response = await listAffiliationTransfers(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalCount).toBe(0);
  });

  test('filters personId and status passed to repo', async () => {
    let capturedFilters: any;
    stubRepo(AffiliationTransferRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return makePaginatedResult([transfer1]);
      },
    });

    const ctx = makeCtx({
      _query: { personId: 'person-1', status: 'pending', offset: '0', limit: '10' },
    });
    await listAffiliationTransfers(ctx);

    expect(capturedFilters.personId).toBe('person-1');
    expect(capturedFilters.status).toBe('pending');
    expect(capturedFilters.organizationId).toBe('tenant-1');
  });

  test('pagination defaults — offset=0, limit=20 when query omitted', async () => {
    let capturedOpts: any;
    stubRepo(AffiliationTransferRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        capturedOpts = opts;
        return makePaginatedResult([]);
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listAffiliationTransfers(ctx);

    expect(capturedOpts.pagination.offset).toBe(0);
    expect(capturedOpts.pagination.limit).toBe(20);
  });

  test('pagination math — page 2 of 4 has hasNextPage=true, hasPreviousPage=true', async () => {
    stubRepo(AffiliationTransferRepository, {
      findManyWithPagination: async () => makePaginatedResult([transfer1], 40),
    });

    const ctx = makeCtx({ _query: { offset: '10', limit: '10' } });
    const response = await listAffiliationTransfers(ctx) as any;

    expect(response.body.pagination.currentPage).toBe(2);
    expect(response.body.pagination.totalPages).toBe(4);
    expect(response.body.pagination.hasNextPage).toBe(true);
    expect(response.body.pagination.hasPreviousPage).toBe(true);
  });
});
