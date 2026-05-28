import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteInstitutionalMembership } from './deleteInstitutionalMembership';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';

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

describe('deleteInstitutionalMembership', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(InstitutionalMembershipRepository);
    restoreRepo(SeatAllocationRepository);
  });

  test('soft-deletes membership and revokes seats (200)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });

    let revokeCalledWith: string | null = null;
    let updateCalledWith: { id: string; data: any } | null = null;

    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (id: string, data: any) => {
        updateCalledWith = { id, data };
        return { ...fakeMembership, ...data };
      },
    });
    stubRepo(SeatAllocationRepository, {
      revokeAllActive: async (id: string) => {
        revokeCalledWith = id;
        return 3;
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
    });

    const response = await deleteInstitutionalMembership(ctx);
    expect(response.status).toBe(200);
    expect(revokeCalledWith).toBe('inst-mem-1');
    expect(updateCalledWith?.data.status).toBe('removed');
  });

  test('throws NotFoundError when membership does not exist', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => null,
      updateOneById: async (_id: string, data: any) => data,
    });
    stubRepo(SeatAllocationRepository, {
      revokeAllActive: async () => 0,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'missing-id' },
    });

    const { NotFoundError } = await import('@/core/errors');
    await expect(deleteInstitutionalMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { institutionalMembershipId: 'inst-mem-1' } });
    const response = await deleteInstitutionalMembership(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks required position', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Member' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
    });

    const response = await deleteInstitutionalMembership(ctx);
    expect(response.status).toBe(403);
  });

  test('revoke is called before status update (order check)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const callOrder: string[] = [];

    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => {
        callOrder.push('update');
        return { ...fakeMembership, ...data };
      },
    });
    stubRepo(SeatAllocationRepository, {
      revokeAllActive: async () => {
        callOrder.push('revoke');
        return 3;
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
    });

    await deleteInstitutionalMembership(ctx);
    expect(callOrder[0]).toBe('revoke');
    expect(callOrder[1]).toBe('update');
  });
});
