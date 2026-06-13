import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { renewMembership } from './renewMembership';
import { computeNewExpiry } from './utils/expiry-extension';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────
//
// A fixed current expiry keeps the billing-frequency assertions deterministic
// (well in the future → not severely lapsed → standard "extend from current
// expiry" branch of computeNewExpiry).

const CURRENT_EXPIRY = '2027-01-01';

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  tierId: 'tier-1',
  duesExpiryDate: CURRENT_EXPIRY,
  suspendedAt: null,
  removedAt: null,
  resignedAt: null,
  dateOfDeath: null,
  gracePeriodDays: 30,
});

describe('renewMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let duesMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (duesMocks) Object.values(duesMocks).forEach((m) => m.mockRestore());
  });

  // ─── FIX-014 / G-16: honor org billing frequency ───

  test('extends by the org billing frequency (quarterly), not a hardcoded +1 year (FIX-014)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });
    duesMocks = stubRepo(DuesRepository, { getConfig: async () => ({ billingFrequency: 'quarterly' }) });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    const response = await renewMembership(ctx);

    const expectedQuarterly = computeNewExpiry({ currentExpiry: new Date(CURRENT_EXPIRY), billingCycle: 'quarterly' })
      .toISOString().split('T')[0];
    const annualResult = computeNewExpiry({ currentExpiry: new Date(CURRENT_EXPIRY), billingCycle: 'annual' })
      .toISOString().split('T')[0];

    expect(response.status).toBe(200);
    expect(response.body.duesExpiryDate).toBe(expectedQuarterly);
    // Proves the hardcoded +1-year path is gone (annual ≠ quarterly).
    expect(response.body.duesExpiryDate).not.toBe(annualResult);
  });

  test('extends by 12 months for an annual-billing org (FIX-014)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });
    duesMocks = stubRepo(DuesRepository, { getConfig: async () => ({ billingFrequency: 'annual' }) });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    const response = await renewMembership(ctx);

    const expectedAnnual = computeNewExpiry({ currentExpiry: new Date(CURRENT_EXPIRY), billingCycle: 'annual' })
      .toISOString().split('T')[0];
    expect(response.body.duesExpiryDate).toBe(expectedAnnual);
  });

  test('defaults to annual when no dues config exists (FIX-014)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });
    duesMocks = stubRepo(DuesRepository, { getConfig: async () => undefined });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    const response = await renewMembership(ctx);

    const expectedAnnual = computeNewExpiry({ currentExpiry: new Date(CURRENT_EXPIRY), billingCycle: 'annual' })
      .toISOString().split('T')[0];
    expect(response.body.duesExpiryDate).toBe(expectedAnnual);
  });

  // ─── FIX-006 / G-08: status-history audit row ───

  test('writes a membership_status_history row on renew (FIX-006)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });
    duesMocks = stubRepo(DuesRepository, { getConfig: async () => ({ billingFrequency: 'annual' }) });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    await renewMembership(ctx);

    const inserts = (ctx.get('database') as any)._inserted as any[];
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    const row = inserts[inserts.length - 1];
    expect(row.membershipId).toBe('mem-1');
    expect(row.personId).toBe('person-1');
    expect(row.toStatus).toBe('active');
    expect(row.reason).toBe('renewed');
    expect(row.changedBy).toBe('user-1');
  });

  // ─── Guards ───

  test('throws NotFoundError for non-existent membership', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => undefined });
    const ctx = makeCtx({ _params: { membershipId: 'nope' } });
    await expect(renewMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => fakeMembership });
    const ctx = makeCtx({ user: null, session: null, _params: { membershipId: 'mem-1' } });
    await expect(renewMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws BusinessLogicError when renewing a terminal (resigned) membership', async () => {
    const resigned = createFakeMembership({
      id: 'mem-1', organizationId: 'tenant-1', personId: 'person-1',
      resignedAt: new Date('2025-01-01'), removedAt: null, suspendedAt: null, dateOfDeath: null,
    });
    mocks = stubRepo(MembershipRepository, { findOneById: async () => resigned });
    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    await expect(renewMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
