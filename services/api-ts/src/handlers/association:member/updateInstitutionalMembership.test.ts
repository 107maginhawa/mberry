import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateInstitutionalMembership } from './updateInstitutionalMembership';
import { InstitutionalMembershipRepository } from './repos/institutional-membership.repo';
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

describe('updateInstitutionalMembership', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(InstitutionalMembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(InstitutionalMembershipRepository);
  });

  test('updates membership successfully (200)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
      _body: { totalSeats: 15 },
    });

    const response = await updateInstitutionalMembership(ctx);
    expect(response.status).toBe(200);
  });

  test('throws BusinessLogicError when totalSeats < usedSeats', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    // usedSeats=3, requesting totalSeats=2
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, usedSeats: 3 }),
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
      _body: { totalSeats: 2 },
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(updateInstitutionalMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws NotFoundError when membership does not exist', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => null,
      updateOneById: async (_id: string, data: any) => data,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'missing' },
      _body: { totalSeats: 5 },
    });

    const { NotFoundError } = await import('@/core/errors');
    await expect(updateInstitutionalMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: {}, _body: {} });
    const response = await updateInstitutionalMembership(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks required position', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
      _body: { totalSeats: 15 },
    });

    const response = await updateInstitutionalMembership(ctx);
    expect(response.status).toBe(403);
  });

  test('allows totalSeats equal to usedSeats (boundary case)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, usedSeats: 3 }),
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { institutionalMembershipId: 'inst-mem-1' },
      _body: { totalSeats: 3 },
    });

    const response = await updateInstitutionalMembership(ctx);
    expect(response.status).toBe(200);
  });
});
