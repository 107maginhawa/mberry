import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo, makeMockDb } from '@/test-utils/make-ctx';
import { fakeApplication } from '@/test-utils/factories';
import { listMembershipApplications } from './listMembershipApplications';
import { MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';
import { UnauthorizedError } from '@/core/errors';

const fakePaginatedResult = (data: any[], totalCount = data.length) => ({
  data,
  totalCount,
});

describe('listMembershipApplications', () => {
  afterEach(() => {
    restoreRepo(MembershipApplicationRepository);
  });

  test('returns 200 with enriched applications (happy path)', async () => {
    const app = fakeApplication({ id: 'app-1', personId: 'person-1', status: 'pending' });
    stubRepo(MembershipApplicationRepository, {
      findManyWithPagination: async () => fakePaginatedResult([app], 1),
    });

    // makeMockDb select chain returns [] by default — person enrichment falls back gracefully
    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: { offset: 0, limit: 20 },
      database: makeMockDb(),
    });

    const response = await listMembershipApplications(ctx);
    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('app-1');
    expect(body.data[0].status).toBe('pending');
  });

  test('returns correct pagination shape', async () => {
    const apps = [fakeApplication({ personId: 'p-1' }), fakeApplication({ id: 'app-2', personId: 'p-2' })];
    stubRepo(MembershipApplicationRepository, {
      findManyWithPagination: async () => fakePaginatedResult(apps, 45),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: { offset: 10, limit: 10 },
      database: makeMockDb(),
    });

    const response = await listMembershipApplications(ctx);
    const pagination = (response as any).body.pagination;
    expect(pagination.offset).toBe(10);
    expect(pagination.limit).toBe(10);
    expect(pagination.totalCount).toBe(45);
    expect(pagination.totalPages).toBe(5);
    expect(pagination.currentPage).toBe(2);
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.hasPreviousPage).toBe(true);
  });

  test('returns empty data array when no applications', async () => {
    stubRepo(MembershipApplicationRepository, {
      findManyWithPagination: async () => fakePaginatedResult([], 0),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: {},
      database: makeMockDb(),
    });

    const response = await listMembershipApplications(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(0);
    expect((response as any).body.pagination.totalCount).toBe(0);
  });

  test('passes status filter to repository', async () => {
    let capturedFilter: any;
    stubRepo(MembershipApplicationRepository, {
      findManyWithPagination: async (filter: any) => {
        capturedFilter = filter;
        return fakePaginatedResult([]);
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: { status: 'approved', offset: 0, limit: 20 },
      database: makeMockDb(),
    });

    await listMembershipApplications(ctx);
    expect(capturedFilter.status).toBe('approved');
    expect(capturedFilter.organizationId).toBe('org-1');
  });

  test('defaults offset=0 limit=20 when not provided', async () => {
    let capturedPagination: any;
    stubRepo(MembershipApplicationRepository, {
      findManyWithPagination: async (_filter: any, opts: any) => {
        capturedPagination = opts.pagination;
        return fakePaginatedResult([]);
      },
    });

    const ctx = makeCtx({ organizationId: 'org-1', _query: {}, database: makeMockDb() });
    await listMembershipApplications(ctx);
    expect(capturedPagination.offset).toBe(0);
    expect(capturedPagination.limit).toBe(20);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: {}, database: makeMockDb() });
    await expect(listMembershipApplications(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('applications without a matching person get undefined name/email/avatar', async () => {
    const app = fakeApplication({ id: 'app-x', personId: 'unknown-person' });
    stubRepo(MembershipApplicationRepository, {
      findManyWithPagination: async () => fakePaginatedResult([app]),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: {},
      database: makeMockDb(), // select returns [] → no persons found
    });

    const response = await listMembershipApplications(ctx);
    const enriched = (response as any).body.data[0];
    expect(enriched.name).toBeUndefined();
    expect(enriched.email).toBeUndefined();
    expect(enriched.avatar).toBeUndefined();
  });
});
