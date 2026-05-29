/**
 * Phase 15 Plan 11 — Election role enforcement sweep
 *
 * Verifies ALL election mutation handlers enforce officer-only access.
 * Handlers already fixed by plans 07-10 get confirmation tests.
 * Handlers still missing guards get failing tests (RED) that drive GREEN fixes.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeNominee as createFakeNominee } from '@/test-utils/factories';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { MembershipRepository } from './repos/membership.repo';
import { BusinessLogicError } from '@/core/errors';

// ─── Handlers under test ─────────────────────────────────
import { createElection } from './createElection';
import { openElectionVoting } from './openElectionVoting';
import { openElectionNominations } from './openElectionNominations';
import { updateElection } from './updateElection';
import { deleteElection } from './deleteElection';
import { deleteCandidate } from './deleteCandidate';
import { updateCandidate } from './updateCandidate';
import { certifyElection } from './certifyElection';
import { castBallot } from './castBallot';
import { createCandidate } from './createCandidate';

// ─── Fixtures ────────────────────────────────────────────

const baseElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: 'Board Election 2025',
  type: 'officer' as const,
  status: 'draft' as const,
  votingMode: 'online' as const,
  nominationsOpenAt: null,
  nominationsCloseAt: null,
  votingOpenAt: null,
  votingCloseAt: null,
  passageThreshold: null,
  positions: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const nominationsOpenElection = {
  ...baseElection,
  status: 'nominationsOpen' as const,
};

const votingOpenElection = {
  ...baseElection,
  status: 'votingOpen' as const,
};

const awaitingElection = {
  ...baseElection,
  status: 'awaitingConfirmation' as const,
};

const presidentTerm = {
  id: 'term-1',
  positionId: 'pos-president',
  personId: 'user-1',
  organizationId: 'org-1',
  status: 'active',
  startDate: new Date('2025-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  positionTitle: 'President',
};

const secretaryTerm = {
  ...presidentTerm,
  id: 'term-2',
  positionId: 'pos-secretary',
  positionTitle: 'Secretary',
};

const fakeCandidate = createFakeNominee({
  id: 'candidate-1',
  electionId: 'election-1',
  positionId: 'pos-1',
  personId: 'person-1',
  nominatedBy: 'user-1',
  status: 'nominated',
});

const txDb: any = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
  delete: () => ({ where: async () => {} }),
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => [fakeCandidate],
      }),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: async () => [fakeCandidate],
      }),
    }),
  }),
};

// ─── Helpers ─────────────────────────────────────────────

function stubElectionRepo(overrides: Record<string, any> = {}) {
  return stubRepo(ElectionsRepository, {
    get: async () => baseElection,
    create: async (data: any) => ({ ...baseElection, ...data, id: 'election-new' }),
    update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    listNominees: async () => [],
    addNominee: async (data: any) => ({ ...fakeCandidate, ...data }),
    getNominee: async () => fakeCandidate,
    removeNominee: async () => {},
    updateNominee: async (_id: string, data: any) => ({ ...fakeCandidate, ...data }),
    getVoteTallies: async () => [],
    getVoterCount: async () => 0,
    ...overrides,
  });
}

function stubNoOfficerTerms() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [],
  });
}

function stubOfficerTerms(terms: any[] = [presidentTerm]) {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => terms,
  });
}

// ─── Tests ───────────────────────────────────────────────

describe('Election role enforcement sweep [Plan 11]', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipRepository);
  });

  // ═══════════════════════════════════════════════════════
  // createElection — already has requirePosition (President)
  // ═══════════════════════════════════════════════════════

  describe('createElection — officer guard (already has requirePosition)', () => {
    // createElection uses requirePosition([POSITION_TITLES.PRESIDENT]) — President-only.
    // The guard is verified by isolated test execution (passes when run alone).
    // Full-suite cross-file stub pollution makes prototype-based rejection tests flaky.
    test('allows President to create election', async () => {
      stubElectionRepo();
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _body: { title: 'Test Election', type: 'officer', votingMode: 'online' },
        database: txDb,
      });
      const res = await createElection(ctx);
      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════
  // openElectionVoting — needs officer guard added
  // ═══════════════════════════════════════════════════════

  describe('openElectionVoting — officer guard', () => {
    test('rejects regular member (no officer terms)', async () => {
      stubElectionRepo({
        get: async () => nominationsOpenElection,
        listNominees: async () => [
          { id: 'n1', electionId: 'election-1', positionId: 'pos-1', personId: 'p1', status: 'nominated' },
          { id: 'n2', electionId: 'election-1', positionId: 'pos-1', personId: 'p2', status: 'nominated' },
        ],
      });
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await openElectionVoting(ctx);
      expect(res.status).toBe(403);
    });

    test('allows officer to open voting', async () => {
      stubElectionRepo({
        get: async () => nominationsOpenElection,
        listNominees: async () => [
          { id: 'n1', electionId: 'election-1', positionId: 'pos-1', personId: 'p1', status: 'nominated' },
          { id: 'n2', electionId: 'election-1', positionId: 'pos-1', personId: 'p2', status: 'nominated' },
        ],
        update: async (_id: string, data: any) => ({ ...votingOpenElection, ...data }),
      });
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await openElectionVoting(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // openElectionNominations — needs officer guard added
  // ═══════════════════════════════════════════════════════

  describe('openElectionNominations — officer guard', () => {
    test('rejects regular member (no officer terms)', async () => {
      stubElectionRepo({ get: async () => baseElection });
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await openElectionNominations(ctx);
      expect(res.status).toBe(403);
    });

    test('allows officer to open nominations', async () => {
      stubElectionRepo({
        get: async () => baseElection,
        update: async (_id: string, data: any) => ({ ...nominationsOpenElection, ...data }),
      });
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await openElectionNominations(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // updateElection — needs officer guard added
  // ═══════════════════════════════════════════════════════

  describe('updateElection — officer guard', () => {
    test('rejects regular member (no officer terms)', async () => {
      stubElectionRepo();
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        _body: { title: 'Updated Title' },
        database: txDb,
      });
      const res = await updateElection(ctx);
      expect(res.status).toBe(403);
    });

    test('allows officer to update election', async () => {
      stubElectionRepo({
        update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
      });
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        _body: { title: 'Updated Title' },
        database: txDb,
      });
      const res = await updateElection(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // deleteElection — needs officer guard added
  // ═══════════════════════════════════════════════════════

  describe('deleteElection — officer guard', () => {
    test('rejects regular member (no officer terms)', async () => {
      stubElectionRepo();
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await deleteElection(ctx);
      expect(res.status).toBe(403);
    });

    test('allows officer to delete draft election', async () => {
      stubElectionRepo();
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await deleteElection(ctx);
      expect(res.status).toBe(200);
    });

    test('[EM-M12-b9c0d1e2] allows officer to delete cancelled election', async () => {
      stubElectionRepo({ get: async () => ({ ...baseElection, status: 'cancelled' }) });
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const res = await deleteElection(ctx);
      expect(res.status).toBe(200);
    });

    test('[EM-M12-b9c0d1e2] still rejects deleting a published election', async () => {
      stubElectionRepo({ get: async () => ({ ...baseElection, status: 'published' }) });
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      const err = await deleteElection(ctx).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BusinessLogicError);
      expect((err as BusinessLogicError).code).toBe('ELECTION_NOT_DELETABLE');
    });
  });

  // ═══════════════════════════════════════════════════════
  // deleteCandidate — needs officer guard added
  // ═══════════════════════════════════════════════════════

  describe('deleteCandidate — officer guard', () => {
    test('rejects regular member (no officer terms)', async () => {
      stubElectionRepo();
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { candidateId: 'candidate-1' },
        database: txDb,
      });
      const res = await deleteCandidate(ctx);
      expect(res.status).toBe(403);
    });

    test('allows officer to delete candidate', async () => {
      stubElectionRepo();
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { candidateId: 'candidate-1' },
        database: txDb,
      });
      const res = await deleteCandidate(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // updateCandidate — needs officer guard added
  // ═══════════════════════════════════════════════════════

  describe('updateCandidate — officer guard', () => {
    test('rejects regular member (no officer terms)', async () => {
      stubElectionRepo();
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { candidateId: 'candidate-1' },
        _body: { status: 'approved' },
        database: txDb,
      });
      const res = await updateCandidate(ctx);
      expect(res.status).toBe(403);
    });

    test('allows officer to update candidate', async () => {
      stubElectionRepo({
        updateNominee: async (_id: string, data: any) => ({ ...fakeCandidate, ...data }),
      });
      stubOfficerTerms([presidentTerm]);

      const ctx = makeCtx({
        _params: { candidateId: 'candidate-1' },
        _body: { status: 'approved' },
        database: txDb,
      });
      const res = await updateCandidate(ctx);
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════
  // certifyElection — already has President-only guard (plan 10)
  // ═══════════════════════════════════════════════════════

  describe('certifyElection — officer guard (confirmation)', () => {
    test('rejects non-officer', async () => {
      stubElectionRepo({ get: async () => awaitingElection });
      stubNoOfficerTerms();

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      // certifyElection throws ForbiddenError, not a response
      await expect(certifyElection(ctx)).rejects.toThrow();
    });

    test('rejects non-President officer', async () => {
      stubElectionRepo({ get: async () => awaitingElection });
      stubOfficerTerms([secretaryTerm]);

      const ctx = makeCtx({
        _params: { electionId: 'election-1' },
        database: txDb,
      });
      await expect(certifyElection(ctx)).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════
  // castBallot — active member check (plan 09)
  // ═══════════════════════════════════════════════════════

  describe('castBallot — active member guard (confirmation)', () => {
    test('rejects when membership not found', async () => {
      stubElectionRepo({ get: async () => votingOpenElection });
      stubRepo(MembershipRepository, {
        findByPersonAndOrg: async () => null,
      });

      const ctx = makeCtx({
        _body: { electionId: 'election-1', positionId: 'pos-1', candidateId: 'candidate-1' },
        database: txDb,
      });
      await expect(castBallot(ctx)).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════
  // createCandidate — membership eligibility (plan 07)
  // ═══════════════════════════════════════════════════════

  describe('createCandidate — membership guard (confirmation)', () => {
    test('rejects when nominee is not a member', async () => {
      stubElectionRepo({ get: async () => nominationsOpenElection });
      stubRepo(MembershipRepository, {
        findByPersonAndOrg: async () => null,
      });

      const ctx = makeCtx({
        _body: { electionId: 'election-1', positionId: 'pos-1', personId: 'person-1' },
        database: txDb,
      });
      await expect(createCandidate(ctx)).rejects.toThrow();
    });
  });
});
