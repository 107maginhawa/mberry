import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listCredentialTemplates } from './listCredentialTemplates';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';
import { UnauthorizedError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeTemplate = {
  id: 'tmpl-1',
  organizationId: 'tenant-1',
  name: 'CPD Certificate',
  type: 'cpd',
  design: null,
  validityPeriod: 12,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakePaginationResult = (data: any[], totalCount = data.length) => ({
  data,
  totalCount,
});

// ─── Tests ──────────────────────────────────────────────

describe('listCredentialTemplates', () => {
  beforeEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  afterEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: {} });
    await expect(listCredentialTemplates(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('happy path — returns templates with pagination', async () => {
    stubRepo(CredentialTemplateRepository, {
      findManyWithPagination: async () => fakePaginationResult([fakeTemplate]),
    });

    const ctx = makeCtx({ _query: { offset: 0, limit: 20 } });
    const res = await listCredentialTemplates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('tmpl-1');
    expect(res.body.pagination.totalCount).toBe(1);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.offset).toBe(0);
    expect(res.body.pagination.limit).toBe(20);
  });

  test('empty result returns correct pagination', async () => {
    stubRepo(CredentialTemplateRepository, {
      findManyWithPagination: async () => fakePaginationResult([]),
    });

    const ctx = makeCtx({ _query: {} });
    const res = await listCredentialTemplates(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalCount).toBe(0);
    expect(res.body.pagination.count).toBe(0);
  });

  test('calculates hasNextPage correctly when more pages exist', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ ...fakeTemplate, id: `tmpl-${i}` }));
    stubRepo(CredentialTemplateRepository, {
      findManyWithPagination: async () => fakePaginationResult(items, 25),
    });

    const ctx = makeCtx({ _query: { offset: 0, limit: 10 } });
    const res = await listCredentialTemplates(ctx);

    expect(res.body.pagination.hasNextPage).toBe(true);
    expect(res.body.pagination.hasPreviousPage).toBe(false);
    expect(res.body.pagination.totalPages).toBe(3);
  });

  test('calculates hasPreviousPage correctly on page 2', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ ...fakeTemplate, id: `tmpl-${i}` }));
    stubRepo(CredentialTemplateRepository, {
      findManyWithPagination: async () => fakePaginationResult(items, 15),
    });

    const ctx = makeCtx({ _query: { offset: 10, limit: 5 } });
    const res = await listCredentialTemplates(ctx);

    expect(res.body.pagination.hasPreviousPage).toBe(true);
    expect(res.body.pagination.currentPage).toBe(3);
  });

  test('defaults offset to 0 and limit to 20 when not provided', async () => {
    let capturedOpts: any;
    stubRepo(CredentialTemplateRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        capturedOpts = opts;
        return fakePaginationResult([]);
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listCredentialTemplates(ctx);

    expect(capturedOpts.pagination.offset).toBe(0);
    expect(capturedOpts.pagination.limit).toBe(20);
  });

  test('passes filter params to repo', async () => {
    let capturedFilters: any;
    stubRepo(CredentialTemplateRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return fakePaginationResult([]);
      },
    });

    const ctx = makeCtx({ _query: { type: 'cpd', status: 'active', q: 'cert' } });
    await listCredentialTemplates(ctx);

    expect(capturedFilters.type).toBe('cpd');
    expect(capturedFilters.status).toBe('active');
    expect(capturedFilters.q).toBe('cert');
    expect(capturedFilters.organizationId).toBe('tenant-1');
  });
});
