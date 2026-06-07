import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createInstitutionalMembership } from './createInstitutionalMembership';
import { InstitutionalMembershipRepository } from '@/handlers/association:member/repos/institutional-membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const fakeMembership = {
  id: 'inst-mem-1',
  organizationId: 'org-1',
  parentOrganizationId: 'parent-org-1',
  tierId: 'tier-1',
  totalSeats: 10,
  usedSeats: 0,
  primaryContactId: 'person-1',
  billingContactId: null,
  startDate: '2026-01-01',
  duesExpiryDate: null,
  status: 'pendingPayment',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('createInstitutionalMembership', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(InstitutionalMembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(InstitutionalMembershipRepository);
  });

  test('creates membership with pendingPayment status and usedSeats=0 (201)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });

    let capturedData: any = null;
    stubRepo(InstitutionalMembershipRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { ...fakeMembership, ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        parentOrganizationId: 'parent-org-1',
        tierId: 'tier-1',
        totalSeats: 10,
        primaryContactId: 'person-1',
        startDate: '2026-01-01',
        duesExpiryDate: '2027-01-01',
      },
    });

    const response = await createInstitutionalMembership(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.status).toBe('pendingPayment');
    expect(capturedData.usedSeats).toBe(0);
    expect(capturedData.organizationId).toBe('org-1');
  });

  test('returns 401 when no user session', async () => {
    const ctx = makeCtx({ user: null, session: null, _body: {} });
    const response = await createInstitutionalMembership(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks required position', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Member' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        parentOrganizationId: 'parent-org-1',
        tierId: 'tier-1',
        totalSeats: 5,
        primaryContactId: 'person-1',
        startDate: '2026-01-01',
        duesExpiryDate: '2027-01-01',
      },
    });

    const response = await createInstitutionalMembership(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 403 when no org context', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });

    const ctx = makeCtx({ organizationId: undefined, _body: {} });
    const response = await createInstitutionalMembership(ctx);
    expect(response.status).toBe(403);
  });

  test('President can also create institutional memberships', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      createOne: async (data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        parentOrganizationId: 'parent-org-1',
        tierId: 'tier-1',
        totalSeats: 5,
        primaryContactId: 'person-1',
        startDate: '2026-01-01',
        duesExpiryDate: '2027-01-01',
      },
    });

    const response = await createInstitutionalMembership(ctx);
    expect(response.status).toBe(201);
  });
});
