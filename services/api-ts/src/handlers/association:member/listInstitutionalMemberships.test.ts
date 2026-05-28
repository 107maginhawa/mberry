import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listInstitutionalMemberships } from './listInstitutionalMemberships';
import { InstitutionalMembershipRepository } from './repos/institutional-membership.repo';

const fakeMembership = {
  id: 'inst-mem-1',
  organizationId: 'org-1',
  parentOrganizationId: 'parent-org-1',
  tierId: 'tier-1',
  totalSeats: 10,
  usedSeats: 3,
  primaryContactId: 'person-1',
  billingContactId: null,
  startDate: '2026-01-01',
  duesExpiryDate: '2027-01-01',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('listInstitutionalMemberships', () => {
  beforeEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
  });

  afterEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
  });

  test('returns paginated list with correct pagination metadata (200)', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findManyWithPagination: async () => ({ data: [fakeMembership], totalCount: 1 }),
    });

    const ctx = makeCtx({ _query: { offset: 0, limit: 20 } });
    const response = await listInstitutionalMemberships(ctx);
    expect(response.status).toBe(200);

    const body = (response as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.totalCount).toBe(1);
    expect(body.pagination.count).toBe(1);
    expect(body.pagination.offset).toBe(0);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.hasNextPage).toBe(false);
    expect(body.pagination.hasPreviousPage).toBe(false);
    expect(body.pagination.currentPage).toBe(1);
    expect(body.pagination.totalPages).toBe(1);
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const response = await listInstitutionalMemberships(ctx);
    expect(response.status).toBe(401);
  });

  test('hasNextPage is true when more records exist', async () => {
    const manyItems = Array.from({ length: 5 }, (_, i) => ({ ...fakeMembership, id: `inst-mem-${i}` }));
    stubRepo(InstitutionalMembershipRepository, {
      findManyWithPagination: async () => ({ data: manyItems, totalCount: 50 }),
    });

    const ctx = makeCtx({ _query: { offset: 0, limit: 5 } });
    const response = await listInstitutionalMemberships(ctx);
    const body = (response as any).body;
    expect(body.pagination.hasNextPage).toBe(true);
    expect(body.pagination.hasPreviousPage).toBe(false);
  });

  test('hasPreviousPage is true when offset > 0', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findManyWithPagination: async () => ({ data: [fakeMembership], totalCount: 50 }),
    });

    const ctx = makeCtx({ _query: { offset: 20, limit: 20 } });
    const response = await listInstitutionalMemberships(ctx);
    const body = (response as any).body;
    expect(body.pagination.hasPreviousPage).toBe(true);
    expect(body.pagination.currentPage).toBe(2);
  });

  test('defaults to offset=0 limit=20 when query is empty', async () => {
    let capturedOptions: any = null;
    stubRepo(InstitutionalMembershipRepository, {
      findManyWithPagination: async (_filters: any, options: any) => {
        capturedOptions = options;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({ _query: {} });
    await listInstitutionalMemberships(ctx);
    expect(capturedOptions.pagination.offset).toBe(0);
    expect(capturedOptions.pagination.limit).toBe(20);
  });
});
