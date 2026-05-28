/**
 * Unit tests for revokeSeat handler
 *
 * Covers: happy path, auth, position check, not-found, wrong membership, already revoked
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { revokeSeat } from './revokeSeat';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeActiveSeat = {
  id: 'seat-1',
  institutionalMembershipId: 'inst-1',
  personId: 'person-2',
  allocatedBy: 'user-1',
  allocatedAt: new Date(),
  revokedAt: null,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

const fakeRevokedSeat = {
  ...fakeActiveSeat,
  id: 'seat-2',
  status: 'revoked' as const,
  revokedAt: new Date(),
};

const fakeInstMembership = {
  id: 'inst-1',
  organizationId: 'org-1',
  parentOrganizationId: 'parent-org-1',
  tierId: 'tier-1',
  totalSeats: 10,
  usedSeats: 3,
  primaryContactId: 'person-1',
  billingContactId: null,
  startDate: '2025-01-01',
  duesExpiryDate: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

// ─── Helpers ─────────────────────────────────────────────

function makeSecretaryCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    organizationId: 'org-1',
    _params: {
      institutionalMembershipId: 'inst-1',
      seatAllocationId: 'seat-1',
    },
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────

describe('revokeSeat — happy path', () => {
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

  test('revokes seat and returns 200', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SeatAllocationRepository, {
      findOneById: async () => fakeActiveSeat,
      updateOneById: async (_id: string, data: any) => ({ ...fakeActiveSeat, ...data }),
    });
    stubRepo(InstitutionalMembershipRepository, {
      decrementUsedSeats: async () => ({ ...fakeInstMembership, usedSeats: 2 }),
    });

    const ctx = makeSecretaryCtx();
    const response = await revokeSeat(ctx as any);

    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.status).toBe('revoked');
  });

  test('President can also revoke seats', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(SeatAllocationRepository, {
      findOneById: async () => fakeActiveSeat,
      updateOneById: async (_id: string, data: any) => ({ ...fakeActiveSeat, ...data }),
    });
    stubRepo(InstitutionalMembershipRepository, {
      decrementUsedSeats: async () => ({ ...fakeInstMembership, usedSeats: 2 }),
    });

    const ctx = makeSecretaryCtx();
    const response = await revokeSeat(ctx as any);
    expect(response.status).toBe(200);
  });
});

describe('revokeSeat — auth', () => {
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

  test('returns 401 when no user session', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({ user: null, session: null });
    const response = await revokeSeat(ctx as any);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user has no officer term', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeSecretaryCtx();
    const response = await revokeSeat(ctx as any);
    expect(response.status).toBe(403);
  });

  test('returns 403 when user has wrong position (Treasurer)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
    });

    const ctx = makeSecretaryCtx();
    const response = await revokeSeat(ctx as any);
    expect(response.status).toBe(403);
  });
});

describe('revokeSeat — business logic errors', () => {
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

  test('throws NotFoundError when seat not found', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SeatAllocationRepository, {
      findOneById: async () => null,
    });

    const ctx = makeSecretaryCtx();
    await expect(revokeSeat(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when seat belongs to different membership', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SeatAllocationRepository, {
      findOneById: async () => ({
        ...fakeActiveSeat,
        institutionalMembershipId: 'different-inst',
      }),
    });

    const ctx = makeSecretaryCtx();
    await expect(revokeSeat(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError(ALREADY_REVOKED) when seat is not active', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SeatAllocationRepository, {
      findOneById: async () => fakeRevokedSeat,
    });

    const ctx = makeSecretaryCtx();
    const err = await revokeSeat(ctx as any).catch(e => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('ALREADY_REVOKED');
  });
});
