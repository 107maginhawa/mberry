import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection, fakeMembership as createFakeMembership, fakeNominee as createFakeNominee } from '@/test-utils/factories';
import { createCandidate } from './createCandidate';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { MembershipRepository } from './repos/membership.repo';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const now = new Date('2026-06-15T12:00:00Z');

const fakeElection = createFakeElection({
  id: 'election-1',
  title: 'Board Election 2026',
  type: 'officer' as const,
  status: 'nominationsOpen' as const,
  votingMode: 'online' as const,
  nominationsOpenAt: new Date('2020-01-01T00:00:00Z'),
  nominationsCloseAt: new Date('2099-12-31T23:59:59Z'),
  votingOpenAt: null,
  votingCloseAt: null,
  passageThreshold: null,
  positions: [{ id: 'pos-1', title: 'President', sortOrder: 1 }],
  publishedAt: null,
});

const fakeActiveMembership = createFakeMembership({
  id: 'mem-1',
  personId: 'person-1',
  tierId: 'tier-1',
  startDate: '2025-01-01',
  duesExpiryDate: '2027-01-01',
  gracePeriodDays: 30,
  status: 'active' as const,
  joinedAt: new Date('2025-01-01'),
  suspendedAt: null,
  removedAt: null,
  memberNumber: 'M-001',
});

const fakeNominee = createFakeNominee({
  electionId: 'election-1',
  positionId: 'pos-1',
  personId: 'person-1',
  nominatedBy: 'user-1',
  status: 'nominated' as const,
});

const defaultBody = {
  electionId: 'election-1',
  positionId: 'pos-1',
  personId: 'person-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('createCandidate — BR-34 nomination eligibility', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  // ─── Auth ─────────────────────────────────────────────

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _body: defaultBody,
    });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  // ─── Election not found ───────────────────────────────

  test('throws NotFoundError when election does not exist', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _body: defaultBody });
    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ─── Non-member nomination rejected ───────────────────

  test('rejects nomination when nominee is not a member of the org', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
    });

    const ctx = makeCtx({ _body: defaultBody });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Suspended member rejected ────────────────────────

  test('rejects nomination when nominee membership is suspended', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        ...fakeActiveMembership,
        suspendedAt: new Date('2026-05-01'),
      }),
    });

    const ctx = makeCtx({ _body: defaultBody });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Removed member rejected ───────────────────────

  test('rejects nomination when nominee membership is removed', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        ...fakeActiveMembership,
        removedAt: new Date('2026-04-01'),
      }),
    });

    const ctx = makeCtx({ _body: defaultBody });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Outside nomination period rejected ───────────────

  test('rejects nomination when current time is before nomination period', async () => {
    const electionNotYetOpen = {
      ...fakeElection,
      nominationsOpenAt: new Date('2026-07-01T00:00:00Z'),
      nominationsCloseAt: new Date('2026-07-31T23:59:59Z'),
    };

    stubRepo(ElectionsRepository, {
      get: async () => electionNotYetOpen,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => fakeActiveMembership,
    });

    const ctx = makeCtx({ _body: defaultBody });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('rejects nomination when current time is after nomination period', async () => {
    const electionClosed = {
      ...fakeElection,
      nominationsOpenAt: new Date('2026-01-01T00:00:00Z'),
      nominationsCloseAt: new Date('2026-01-31T23:59:59Z'),
    };

    stubRepo(ElectionsRepository, {
      get: async () => electionClosed,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => fakeActiveMembership,
    });

    const ctx = makeCtx({ _body: defaultBody });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Lapsed member rejected ───────────────────────────

  test('rejects nomination when nominee membership is lapsed', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        ...fakeActiveMembership,
        duesExpiryDate: '2025-01-01', // expired long ago
        gracePeriodDays: 30,
      }),
    });

    const ctx = makeCtx({ _body: defaultBody });

    await expect(createCandidate(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Happy path ───────────────────────────────────────

  test('creates candidate when active member within nomination period', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => fakeActiveMembership,
    });

    const ctx = makeCtx({ _body: defaultBody });

    const response = await createCandidate(ctx);
    expect(response.status).toBe(201);
    expect((response as any).body.data.id).toBe('nominee-1');
  });

  test('creates candidate when nomination period dates are null (no restriction)', async () => {
    const electionNoPeriod = {
      ...fakeElection,
      nominationsOpenAt: null,
      nominationsCloseAt: null,
    };

    stubRepo(ElectionsRepository, {
      get: async () => electionNoPeriod,
      addNominee: async () => fakeNominee,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => fakeActiveMembership,
    });

    const ctx = makeCtx({ _body: defaultBody });

    const response = await createCandidate(ctx);
    expect(response.status).toBe(201);
  });
});
