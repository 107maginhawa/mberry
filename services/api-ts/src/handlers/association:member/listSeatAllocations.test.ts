/**
 * Unit tests for listSeatAllocations handler
 *
 * Covers: happy path, auth, not-found, pagination, status filter
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listSeatAllocations } from './listSeatAllocations';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeInstMembership = {
  id: 'inst-1',
  organizationId: 'org-1',
  parentOrganizationId: 'parent-org-1',
  tierId: 'tier-1',
  totalSeats: 10,
  usedSeats: 2,
  primaryContactId: 'person-1',
  billingContactId: null,
  startDate: '2025-01-01',
  duesExpiryDate: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

function makeSeats(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `seat-${i + 1}`,
    institutionalMembershipId: 'inst-1',
    personId: `person-${i + 2}`,
    allocatedBy: 'user-1',
    allocatedAt: new Date(),
    revokedAt: null,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  }));
}

// ─── Helpers ─────────────────────────────────────────────

function makeListCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    organizationId: 'org-1',
    _params: { institutionalMembershipId: 'inst-1' },
    _query: { offset: 0, limit: 20 },
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────

describe('listSeatAllocations — happy path', () => {
  beforeEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  afterEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  test('returns paginated list of seat allocations', async () => {
    const seats = makeSeats(3);

    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
    });
    stubRepo(SeatAllocationRepository, {
      findManyWithPagination: async () => ({ data: seats, totalCount: 3 }),
    });

    const ctx = makeListCtx();
    const response = await listSeatAllocations(ctx as any);

    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.data).toHaveLength(3);
    expect(body.pagination.totalCount).toBe(3);
    expect(body.pagination.count).toBe(3);
  });

  test('returns empty list when no seats allocated', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
    });
    stubRepo(SeatAllocationRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeListCtx();
    const response = await listSeatAllocations(ctx as any);

    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.data).toHaveLength(0);
    expect(body.pagination.totalCount).toBe(0);
    expect(body.pagination.hasNextPage).toBe(false);
    expect(body.pagination.hasPreviousPage).toBe(false);
  });

  test('passes status filter to repo', async () => {
    let capturedFilters: any = null;
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
    });
    stubRepo(SeatAllocationRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeListCtx({ _query: { offset: 0, limit: 20, status: 'revoked' } });
    await listSeatAllocations(ctx as any);

    expect(capturedFilters.status).toBe('revoked');
    expect(capturedFilters.institutionalMembershipId).toBe('inst-1');
  });

  test('computes pagination metadata correctly', async () => {
    const seats = makeSeats(5);
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
    });
    stubRepo(SeatAllocationRepository, {
      findManyWithPagination: async () => ({ data: seats, totalCount: 25 }),
    });

    const ctx = makeListCtx({ _query: { offset: 10, limit: 5 } });
    const response = await listSeatAllocations(ctx as any);

    const body = (response as any).body;
    expect(body.pagination.currentPage).toBe(3);
    expect(body.pagination.totalPages).toBe(5);
    expect(body.pagination.hasNextPage).toBe(true);
    expect(body.pagination.hasPreviousPage).toBe(true);
  });
});

describe('listSeatAllocations — auth', () => {
  beforeEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  afterEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const response = await listSeatAllocations(ctx as any);
    expect(response.status).toBe(401);
  });

  test('allows any authenticated user (no position check)', async () => {
    // Regular member, no officer role needed for read
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
    });
    stubRepo(SeatAllocationRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeListCtx({ user: { id: 'member-1', role: 'member', twoFactorEnabled: false } });
    const response = await listSeatAllocations(ctx as any);
    expect(response.status).toBe(200);
  });
});

describe('listSeatAllocations — not found', () => {
  beforeEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  afterEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  test('throws NotFoundError when institutional membership not found', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => null,
    });

    const ctx = makeListCtx();
    await expect(listSeatAllocations(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });
});
