import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMembershipTier } from '@/test-utils/factories';
import { listMembershipTiers } from './listMembershipTiers';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { UnauthorizedError } from '@/core/errors';

const fakePaginatedResult = (data: any[], totalCount = data.length) => ({
  data,
  totalCount,
});

describe('listMembershipTiers', () => {
  afterEach(() => {
    restoreRepo(MembershipTierRepository);
  });

  test('returns 200 with paginated tiers list (happy path)', async () => {
    const tier1 = fakeMembershipTier({ id: 'tier-1', name: 'Regular' });
    const tier2 = fakeMembershipTier({ id: 'tier-2', name: 'Associate' });
    stubRepo(MembershipTierRepository, {
      findManyWithPagination: async () => fakePaginatedResult([tier1, tier2], 2),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: { offset: 0, limit: 20 },
    });

    const response = await listMembershipTiers(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(2);
    expect((response as any).body.data[0].id).toBe('tier-1');
    expect((response as any).body.data[1].id).toBe('tier-2');
  });

  test('returns correct pagination shape', async () => {
    const tiers = [fakeMembershipTier()];
    stubRepo(MembershipTierRepository, {
      findManyWithPagination: async () => fakePaginatedResult(tiers, 50),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: { offset: 20, limit: 10 },
    });

    const response = await listMembershipTiers(ctx);
    expect(response.status).toBe(200);
    const pagination = (response as any).body.pagination;
    expect(pagination.offset).toBe(20);
    expect(pagination.limit).toBe(10);
    expect(pagination.totalCount).toBe(50);
    expect(pagination.totalPages).toBe(5);
    expect(pagination.currentPage).toBe(3);
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.hasPreviousPage).toBe(true);
  });

  test('returns empty data array when no tiers exist', async () => {
    stubRepo(MembershipTierRepository, {
      findManyWithPagination: async () => fakePaginatedResult([], 0),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: {},
    });

    const response = await listMembershipTiers(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(0);
    expect((response as any).body.pagination.totalCount).toBe(0);
    expect((response as any).body.pagination.hasNextPage).toBe(false);
    expect((response as any).body.pagination.hasPreviousPage).toBe(false);
  });

  test('passes search query q to repository', async () => {
    let capturedFilter: any;
    stubRepo(MembershipTierRepository, {
      findManyWithPagination: async (filter: any) => {
        capturedFilter = filter;
        return fakePaginatedResult([]);
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _query: { q: 'Regular', offset: 0, limit: 20 },
    });

    await listMembershipTiers(ctx);
    expect(capturedFilter.q).toBe('Regular');
    expect(capturedFilter.organizationId).toBe('org-1');
  });

  test('defaults offset=0 limit=20 when not provided', async () => {
    let capturedPagination: any;
    stubRepo(MembershipTierRepository, {
      findManyWithPagination: async (_filter: any, opts: any) => {
        capturedPagination = opts.pagination;
        return fakePaginatedResult([]);
      },
    });

    const ctx = makeCtx({ organizationId: 'org-1', _query: {} });
    await listMembershipTiers(ctx);
    expect(capturedPagination.offset).toBe(0);
    expect(capturedPagination.limit).toBe(20);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: {} });
    await expect(listMembershipTiers(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('first page has hasPreviousPage=false and hasNextPage=true', async () => {
    stubRepo(MembershipTierRepository, {
      findManyWithPagination: async () => fakePaginatedResult([fakeMembershipTier()], 100),
    });

    const ctx = makeCtx({ organizationId: 'org-1', _query: { offset: 0, limit: 10 } });
    const response = await listMembershipTiers(ctx);
    const pagination = (response as any).body.pagination;
    expect(pagination.hasPreviousPage).toBe(false);
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.currentPage).toBe(1);
  });
});
