/**
 * RED tests for createMembership — BR-01 compliance
 *
 * Bug: createMembership sets duesExpiryDate to 1-year future even when
 * status=pendingPayment. This creates a false "active" window before
 * any payment exists. duesExpiryDate must be null until payment settles.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createMembership } from './createMembership';
import { MembershipTierRepository, MembershipRepository } from './repos/membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeTier = {
  id: 'tier-1',
  organizationId: 'org-1',
  name: 'Regular',
  code: 'REG',
  annualFee: 100_00,
  currency: 'PHP',
  status: 'active',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-01] createMembership — pendingPayment must have null duesExpiryDate', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipTierRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipTierRepository);
    restoreRepo(MembershipRepository);
  });

  test('sets duesExpiryDate to null when creating pendingPayment membership', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeTier,
    });

    let capturedData: any = null;
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'mem-1', ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        personId: 'person-1',
        tierId: 'tier-1',
      },
    });

    const response = await createMembership(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.status).toBe('pendingPayment');
    expect(capturedData.duesExpiryDate).toBeNull();
  });

  test('does not set future expiry date before payment exists', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeTier,
    });

    let capturedData: any = null;
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'mem-2', ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        personId: 'person-2',
        tierId: 'tier-1',
      },
    });

    await createMembership(ctx);

    // duesExpiryDate must NOT be a future date — it should be null
    if (capturedData.duesExpiryDate !== null) {
      const expiry = new Date(capturedData.duesExpiryDate);
      expect(expiry.getTime()).not.toBeGreaterThan(Date.now());
    }
  });

  test('respects explicit duesExpiryDate when provided in body (e.g. life member)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(MembershipTierRepository, {
      findOneById: async () => fakeTier,
    });

    let capturedData: any = null;
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'mem-3', ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        personId: 'person-3',
        tierId: 'tier-1',
        duesExpiryDate: '2030-12-31',
      },
    });

    await createMembership(ctx);
    // When explicitly provided, respect the caller's value
    expect(capturedData.duesExpiryDate).toBe('2030-12-31');
  });
});

// ─── Cross-Org Tenant Isolation Tests ──────────────────

describe('[CODEX-P1-3] createMembership — cross-org tier isolation', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipTierRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipTierRepository);
    restoreRepo(MembershipRepository);
  });

  test('rejects tier from a different organization (400)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });

    // Tier belongs to 'other-org', but ctx orgId is 'org-1'
    const crossOrgTier = { ...fakeTier, organizationId: 'other-org' };
    stubRepo(MembershipTierRepository, {
      findOneById: async () => crossOrgTier,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'mem-x', ...data }),
    });

    const ctx = makeCtx({
      _body: { personId: 'person-1', tierId: 'tier-1' },
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(createMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('accepts tier from the same organization (201)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });

    // Tier belongs to 'org-1', same as ctx orgId
    const sameOrgTier = { ...fakeTier, organizationId: 'org-1' };
    stubRepo(MembershipTierRepository, {
      findOneById: async () => sameOrgTier,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'mem-ok', ...data }),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'person-1', tierId: 'tier-1' },
    });

    const response = await createMembership(ctx);
    expect(response.status).toBe(201);
  });
});
