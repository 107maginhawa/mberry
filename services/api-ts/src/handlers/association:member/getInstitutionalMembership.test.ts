import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getInstitutionalMembership } from './getInstitutionalMembership';
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

describe('getInstitutionalMembership', () => {
  beforeEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
  });

  afterEach(() => {
    restoreRepo(InstitutionalMembershipRepository);
  });

  test('returns membership by ID (200)', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      _params: { institutionalMembershipId: 'inst-mem-1' },
    });

    const response = await getInstitutionalMembership(ctx);
    expect(response.status).toBe(200);
  });

  test('throws NotFoundError when membership does not exist', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      _params: { institutionalMembershipId: 'missing-id' },
    });

    const { NotFoundError } = await import('@/core/errors');
    await expect(getInstitutionalMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { institutionalMembershipId: 'inst-mem-1' } });
    const response = await getInstitutionalMembership(ctx);
    expect(response.status).toBe(401);
  });

  test('any authenticated user can read (no position required)', async () => {
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeMembership,
    });

    // Regular member, no officer role
    const ctx = makeCtx({
      user: { id: 'member-1', role: 'member', twoFactorEnabled: false },
      _params: { institutionalMembershipId: 'inst-mem-1' },
    });

    const response = await getInstitutionalMembership(ctx);
    expect(response.status).toBe(200);
  });
});
