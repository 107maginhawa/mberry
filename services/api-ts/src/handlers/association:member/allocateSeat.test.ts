/**
 * Unit tests for allocateSeat handler
 *
 * Covers: happy path, auth, position check, not-found, duplicate, seats full
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { allocateSeat } from './allocateSeat';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { NotFoundError, ConflictError, BusinessLogicError } from '@/core/errors';

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

const fakeSeat = {
  id: 'seat-1',
  institutionalMembershipId: 'inst-1',
  personId: 'person-2',
  allocatedBy: 'user-1',
  allocatedAt: new Date(),
  revokedAt: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

// ─── Helpers ─────────────────────────────────────────────

function makeSecretaryCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    organizationId: 'org-1',
    _params: { institutionalMembershipId: 'inst-1' },
    _body: { personId: 'person-2' },
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────

describe('allocateSeat — happy path', () => {
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

  test('allocates seat and returns 201', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
      incrementUsedSeats: async () => ({ ...fakeInstMembership, usedSeats: 3 }),
    });

    let captured: any = null;
    stubRepo(SeatAllocationRepository, {
      findActiveByMembershipAndPerson: async () => null,
      createOne: async (data: any) => {
        captured = data;
        return { id: 'seat-new', ...data };
      },
    });

    const ctx = makeSecretaryCtx();
    const response = await allocateSeat(ctx as any);

    expect(response.status).toBe(201);
    expect(captured.institutionalMembershipId).toBe('inst-1');
    expect(captured.personId).toBe('person-2');
    expect(captured.status).toBe('active');
    expect(captured.allocatedBy).toBe('user-1');
  });
});

describe('allocateSeat — auth', () => {
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
    const response = await allocateSeat(ctx as any);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user has no officer term', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeSecretaryCtx();
    const response = await allocateSeat(ctx as any);
    expect(response.status).toBe(403);
  });

  test('returns 403 when user has wrong position', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
    });

    const ctx = makeSecretaryCtx();
    const response = await allocateSeat(ctx as any);
    expect(response.status).toBe(403);
  });
});

describe('allocateSeat — business logic errors', () => {
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

  test('throws NotFoundError when institutional membership not found', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => null,
    });
    stubRepo(SeatAllocationRepository, {
      findActiveByMembershipAndPerson: async () => null,
    });

    const ctx = makeSecretaryCtx();
    await expect(allocateSeat(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError when person already has active seat', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
    });
    stubRepo(SeatAllocationRepository, {
      findActiveByMembershipAndPerson: async () => fakeSeat,
    });

    const ctx = makeSecretaryCtx();
    await expect(allocateSeat(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws BusinessLogicError(SEATS_FULL) when no capacity', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(InstitutionalMembershipRepository, {
      findOneById: async () => fakeInstMembership,
      incrementUsedSeats: async () => {
        throw new BusinessLogicError('No available seats', 'SEATS_FULL');
      },
    });
    stubRepo(SeatAllocationRepository, {
      findActiveByMembershipAndPerson: async () => null,
    });

    const ctx = makeSecretaryCtx();
    const err = await allocateSeat(ctx as any).catch(e => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('SEATS_FULL');
  });
});
