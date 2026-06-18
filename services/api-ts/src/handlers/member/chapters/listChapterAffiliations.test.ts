import { describe, test, expect, afterEach } from 'bun:test';
import { listChapterAffiliations } from './listChapterAffiliations';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ChapterAffiliationRepository } from '@/handlers/association:member/repos/chapters.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const affiliation1 = {
  id: 'aff-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  chapterId: 'ch-1',
  isPrimary: true,
  status: 'active',
  joinedAt: '2024-01-01',
};

const affiliation2 = {
  id: 'aff-2',
  organizationId: 'tenant-1',
  personId: 'person-2',
  chapterId: 'ch-2',
  isPrimary: false,
  status: 'active',
  joinedAt: '2024-02-01',
};

function makePaginatedResult(data: any[], totalCount = data.length) {
  return { data, totalCount };
}

// ─── Tests ───────────────────────────────────────────────

describe('listChapterAffiliations', () => {
  afterEach(() => restoreRepo(ChapterAffiliationRepository));

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null });
    await expect(listChapterAffiliations(ctx)).rejects.toThrow(UnauthorizedError);
  });

  test('happy path — returns paginated affiliations with correct shape', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findManyWithPagination: async () => makePaginatedResult([affiliation1, affiliation2]),
    });

    const ctx = makeCtx({ _query: { offset: '0', limit: '20' } });
    const response = await listChapterAffiliations(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([affiliation1, affiliation2]);
    expect(response.body.pagination.totalCount).toBe(2);
    expect(response.body.pagination.count).toBe(2);
    expect(response.body.pagination.offset).toBe(0);
    expect(response.body.pagination.limit).toBe(20);
    expect(response.body.pagination.totalPages).toBe(1);
    expect(response.body.pagination.currentPage).toBe(1);
    expect(response.body.pagination.hasNextPage).toBe(false);
    expect(response.body.pagination.hasPreviousPage).toBe(false);
  });

  test('empty list — returns data:[] with correct pagination zeros', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findManyWithPagination: async () => makePaginatedResult([], 0),
    });

    const ctx = makeCtx({ _query: {} });
    const response = await listChapterAffiliations(ctx) as any;

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalCount).toBe(0);
    expect(response.body.pagination.count).toBe(0);
  });

  test('pagination defaults — offset=0, limit=20 when query omitted', async () => {
    let capturedOpts: any;
    stubRepo(ChapterAffiliationRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        capturedOpts = opts;
        return makePaginatedResult([]);
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listChapterAffiliations(ctx);

    expect(capturedOpts.pagination.offset).toBe(0);
    expect(capturedOpts.pagination.limit).toBe(20);
  });

  test('filters personId and chapterId passed to repo', async () => {
    let capturedFilters: any;
    stubRepo(ChapterAffiliationRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return makePaginatedResult([affiliation1]);
      },
    });

    const ctx = makeCtx({
      _query: { personId: 'person-1', chapterId: 'ch-1', offset: '0', limit: '10' },
    });
    await listChapterAffiliations(ctx);

    expect(capturedFilters.personId).toBe('person-1');
    expect(capturedFilters.chapterId).toBe('ch-1');
    expect(capturedFilters.organizationId).toBe('tenant-1');
  });

  test('pagination math — page 2 of 3 has hasNextPage=true, hasPreviousPage=true', async () => {
    stubRepo(ChapterAffiliationRepository, {
      findManyWithPagination: async () => makePaginatedResult([affiliation1], 30),
    });

    const ctx = makeCtx({ _query: { offset: '10', limit: '10' } });
    const response = await listChapterAffiliations(ctx) as any;

    expect(response.body.pagination.currentPage).toBe(2);
    expect(response.body.pagination.totalPages).toBe(3);
    expect(response.body.pagination.hasNextPage).toBe(true);
    expect(response.body.pagination.hasPreviousPage).toBe(true);
  });
});
