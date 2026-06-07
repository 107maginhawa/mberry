// Business Rules: [BR-33, BR-34]
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection, fakeNominee as createFakeNominee, fakeMembership as createFakeMembership, fakeVote as createFakeVote } from '@/test-utils/factories';
import { castBallot } from './castBallot';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = createFakeElection({
  id: 'election-1',
  title: 'Board Election 2025',
  status: 'votingOpen',
  type: 'officer',
  positions: [
    { id: 'pos-president', title: 'President', sortOrder: 1 },
    { id: 'pos-treasurer', title: 'Treasurer', sortOrder: 2 },
  ],
});

const fakeNominee = createFakeNominee({
  electionId: 'election-1',
  positionId: 'pos-president',
  personId: 'candidate-person-1',
  status: 'accepted',
});

const fakeNomineeWrongPosition = createFakeNominee({
  id: 'nominee-2',
  electionId: 'election-1',
  positionId: 'pos-treasurer',
  personId: 'candidate-person-2',
  status: 'accepted',
});

const fakeNomineeOtherElection = createFakeNominee({
  id: 'nominee-3',
  electionId: 'election-other',
  positionId: 'pos-president',
  personId: 'candidate-person-3',
  status: 'accepted',
});

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  personId: 'user-1',
});

const fakeVote = createFakeVote({
  electionId: 'election-1',
  positionId: 'pos-president',
  nomineeId: 'nominee-1',
  voterId: 'user-1',
});

/** Fake DB that passes tx through to callback (simulates transaction) */
const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-33] Voter eligibility — active member check', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('non-member cannot vote — rejects with VOTER_NOT_ELIGIBLE', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNominee }),
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-1',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Only active members are eligible to vote');
  });

  test('lapsed member cannot vote — rejects with VOTER_NOT_ELIGIBLE', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNominee }),
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      // lapsed: duesExpiryDate in past beyond grace period
      findByPersonAndOrg: async () => ({ ...fakeMembership, status: 'lapsed', duesExpiryDate: '2020-01-01', suspendedAt: null, removedAt: null }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-1',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Only active members are eligible to vote');
  });

  test('suspended member cannot vote — rejects with VOTER_NOT_ELIGIBLE', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNominee }),
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      // suspended: suspendedAt flag is set
      findByPersonAndOrg: async () => ({ ...fakeMembership, status: 'suspended', suspendedAt: new Date('2025-01-01'), removedAt: null }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-1',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Only active members are eligible to vote');
  });
});

describe('[BR-34] Nominee-election consistency', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('cannot vote for nominee not in this election — rejects with NOMINEE_NOT_FOUND', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => null, // nominee not found
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ ...fakeMembership }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-nonexistent',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Nominee not found');
  });

  test('cannot vote for nominee whose electionId differs — rejects with NOMINEE_NOT_IN_ELECTION', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNomineeOtherElection }), // wrong election
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ ...fakeMembership }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-3',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Nominee does not belong to this election');
  });

  test('cannot vote for nominee running for different position — rejects with NOMINEE_WRONG_POSITION', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNomineeWrongPosition }), // pos-treasurer, not pos-president
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ ...fakeMembership }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-2',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Nominee is not running for this position');
  });
});

describe('[BR-33/34] Duplicate vote prevention', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('cannot vote twice for same position — rejects with DUPLICATE_VOTE', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNominee }),
      hasVoted: async () => true, // already voted
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ ...fakeMembership }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-1',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('already voted');
  });
});

describe('[BR-33/34] Happy path — valid ballot cast', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('active member votes for valid nominee in correct position — 201', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection }),
      getNominee: async () => ({ ...fakeNominee }),
      hasVoted: async () => false,
      castVote: async () => ({ ...fakeVote }),
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ ...fakeMembership }),
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-1',
      },
    });

    const response = await castBallot(ctx);
    expect(response.status).toBe(201);
  });

  test('unauthenticated user cannot vote — throws UnauthorizedError', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      database: txDb,
      _body: {
        electionId: 'election-1',
        positionId: 'pos-president',
        candidateId: 'nominee-1',
      },
    });

    await expect(castBallot(ctx)).rejects.toThrow('Unauthorized');
  });
});
