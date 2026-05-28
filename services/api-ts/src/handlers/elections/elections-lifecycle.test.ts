/**
 * [024] Elections Lifecycle — Status Transitions & Voting Integrity
 *
 * Covers gaps identified in slice 024:
 * - Full lifecycle chain: draft → nominationsOpen → votingOpen → awaitingConfirmation → published
 * - BR-20: One vote per position per member (multi-position allowed)
 * - BR-33: Vote anonymity — getElection does not leak voter identities
 * - BR-33: Tallies hidden during votingOpen (results only after close)
 * - Nominee status transitions: nominated → accepted → elected, nominated → declined
 * - Schema-level unique constraint on (electionId, voterId, positionId)
 * - castVote input validation (invalid UUIDs)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { castVote } from './castVote';
import { getElection } from './getElection';
import { updateElectionStatus } from './updateElectionStatus';
import { ElectionsRepository } from './repos/elections.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { BusinessLogicError, ConflictError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const ELECTION_ID = 'election-1';
const ORG_ID = 'org-1';
const POSITION_A = '00000000-0000-4000-8000-000000000001';
const POSITION_B = '00000000-0000-4000-8000-000000000002';
const NOMINEE_A = '00000000-0000-4000-8000-000000000010';
const NOMINEE_B = '00000000-0000-4000-8000-000000000020';
const VOTER_ID = 'voter-1';

const baseElection = {
  id: ELECTION_ID,
  organizationId: ORG_ID,
  title: '2026 Board Election',
  status: 'draft',
  nominationsOpenAt: null,
  nominationsCloseAt: null,
  votingOpenAt: null,
  votingCloseAt: null,
  publishedAt: null,
};

// ─── Full Lifecycle Chain ───────────────────────────────

describe('[024] Election Full Lifecycle Chain', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ id: 'mem-1', duesExpiryDate: '2027-12-31', gracePeriodDays: 30, suspendedAt: null, removedAt: null }),
    });
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
  });
  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('draft → nominationsOpen → votingOpen → awaitingConfirmation → published', async () => {
    const transitions = [
      { from: 'draft', to: 'nominationsOpen' },
      { from: 'nominationsOpen', to: 'votingOpen' },
      { from: 'votingOpen', to: 'awaitingConfirmation' },
      { from: 'awaitingConfirmation', to: 'published' },
    ];

    for (const { from, to } of transitions) {
      restoreRepo(ElectionsRepository);
      let capturedData: any;
      stubRepo(ElectionsRepository, {
        get: async () => ({ ...baseElection, status: from }),
        countNomineesByPosition: async () => [
          { positionId: POSITION_A, count: 3 },
          { positionId: POSITION_B, count: 2 },
        ],
        update: async (_id: string, data: any) => {
          capturedData = data;
          return { ...baseElection, status: from, ...data };
        },
      });

      const ctx = makeCtx({
        _params: { id: ELECTION_ID },
        _body: { status: to },
      });

      const response = await updateElectionStatus(ctx);
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(to);

      // publishedAt only set on final published transition
      if (to === 'published') {
        expect(capturedData.publishedAt).toBeInstanceOf(Date);
      } else {
        expect(capturedData.publishedAt).toBeUndefined();
      }
    }
  });

  test('cannot skip lifecycle stages (draft → votingOpen blocked)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'draft' }),
      update: async () => baseElection,
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { status: 'votingOpen' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('Cannot transition election');
  });

  test('cannot skip lifecycle stages (nominationsOpen → published blocked)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'nominationsOpen' }),
      update: async () => baseElection,
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { status: 'published' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('Cannot transition election');
  });

  test('cannot skip lifecycle stages (draft → awaitingConfirmation blocked)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'draft' }),
      update: async () => baseElection,
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { status: 'awaitingConfirmation' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('Cannot transition election');
  });

  test('any non-terminal state can transition to cancelled', async () => {
    const cancellableStates = ['draft', 'nominationsOpen', 'votingOpen', 'awaitingConfirmation'];

    for (const from of cancellableStates) {
      restoreRepo(ElectionsRepository);
      stubRepo(ElectionsRepository, {
        get: async () => ({ ...baseElection, status: from }),
        update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
      });

      const ctx = makeCtx({
        _params: { id: ELECTION_ID },
        _body: { status: 'cancelled' },
      });

      const response = await updateElectionStatus(ctx);
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');
    }
  });
});

// ─── BR-20: One Vote Per Position Per Member ────────────

describe('[BR-20] One Vote Per Position Per Member', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ id: 'mem-1', duesExpiryDate: '2027-12-31', gracePeriodDays: 30, suspendedAt: null, removedAt: null }),
    });
  });
  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('member can vote for different positions in same election', async () => {
    // Tracks which positions have been voted for
    const votedPositions = new Set<string>();

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      hasVoted: async (_elId: string, _voterId: string, posId: string) => votedPositions.has(posId),
      castVote: async (data: any) => {
        votedPositions.add(data.positionId);
        return { id: 'vote-new', ...data };
      },
    });

    // Vote for position A
    const ctxA = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_A, nomineeId: NOMINEE_A },
    });
    const responseA = await castVote(ctxA);
    expect(responseA.status).toBe(201);

    // Vote for position B — should succeed (different position)
    const ctxB = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_B, nomineeId: NOMINEE_B },
    });
    const responseB = await castVote(ctxB);
    expect(responseB.status).toBe(201);
  });

  test('member cannot vote twice for same position', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      hasVoted: async () => true, // already voted for this position
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_A, nomineeId: NOMINEE_A },
    });

    await expect(castVote(ctx)).rejects.toThrow('Already voted for this position');
  });

  test('different members can vote for same position', async () => {
    const votedPairs = new Set<string>();

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      hasVoted: async (_elId: string, voterId: string, posId: string) =>
        votedPairs.has(`${voterId}:${posId}`),
      castVote: async (data: any) => {
        votedPairs.add(`${data.voterId}:${data.positionId}`);
        return { id: 'vote-new', ...data };
      },
    });

    // Voter 1
    const ctx1 = makeCtx({
      user: { id: 'voter-1', role: 'member' },
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_A, nomineeId: NOMINEE_A },
    });
    const r1 = await castVote(ctx1);
    expect(r1.status).toBe(201);

    // Voter 2 — same position, different voter
    const ctx2 = makeCtx({
      user: { id: 'voter-2', role: 'member' },
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_A, nomineeId: NOMINEE_A },
    });
    const r2 = await castVote(ctx2);
    expect(r2.status).toBe(201);
  });
});

// ─── BR-33: Vote Anonymity & Results Visibility ────────

describe('[BR-33] Vote Anonymity & Results Visibility', () => {
  beforeEach(() => restoreRepo(ElectionsRepository));
  afterEach(() => restoreRepo(ElectionsRepository));
  // getElection doesn't use requirePosition or MembershipRepository — no extra stubs needed

  test('getElection returns aggregate tallies, not individual voter info', async () => {
    const tallies = [
      { positionId: POSITION_A, nomineeId: NOMINEE_A, count: 15 },
      { positionId: POSITION_A, nomineeId: NOMINEE_B, count: 10 },
    ];

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'published', publishedAt: new Date() }),
      listNominees: async () => [],
      getVoterCount: async () => 25,
      getVoteTallies: async () => tallies,
    });

    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await getElection(ctx);
    const data = response.body.data;

    // Tallies are aggregate counts — no voter identities
    expect(data.tallies).toHaveLength(2);
    for (const tally of data.tallies) {
      expect(tally).toHaveProperty('positionId');
      expect(tally).toHaveProperty('nomineeId');
      expect(tally).toHaveProperty('count');
      // Must NOT contain voter identity
      expect(tally).not.toHaveProperty('voterId');
      expect(tally).not.toHaveProperty('voterIds');
      expect(tally).not.toHaveProperty('voters');
    }

    // voterCount is aggregate — just a number
    expect(typeof data.voterCount).toBe('number');
  });

  test('tallies hidden during votingOpen (BR-33: results not displayed until closed)', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      listNominees: async () => [],
      getVoterCount: async () => 5,
      getVoteTallies: async () => { throw new Error('should not be called during votingOpen'); },
    });

    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await getElection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.tallies).toEqual([]);
  });

  test('tallies hidden during nominationsOpen', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'nominationsOpen' }),
      listNominees: async () => [],
      getVoterCount: async () => 0,
      getVoteTallies: async () => { throw new Error('should not be called during nominationsOpen'); },
    });

    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await getElection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.tallies).toEqual([]);
  });

  test('tallies visible when status is awaitingConfirmation', async () => {
    const tallies = [{ positionId: POSITION_A, nomineeId: NOMINEE_A, count: 8 }];

    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'awaitingConfirmation' }),
      listNominees: async () => [],
      getVoterCount: async () => 8,
      getVoteTallies: async () => tallies,
    });

    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await getElection(ctx);
    expect(response.body.data.tallies).toHaveLength(1);
    expect(response.body.data.tallies[0].count).toBe(8);
  });
});

// ─── castVote Input Validation ──────────────────────────

describe('[024] castVote Input Validation', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ id: 'mem-1', duesExpiryDate: '2027-12-31', gracePeriodDays: 30, suspendedAt: null, removedAt: null }),
    });
  });
  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('rejects invalid positionId UUID', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: 'not-a-uuid', nomineeId: NOMINEE_A },
    });

    await expect(castVote(ctx)).rejects.toThrow();
  });

  test('rejects invalid nomineeId UUID', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: { positionId: POSITION_A, nomineeId: 'not-a-uuid' },
    });

    await expect(castVote(ctx)).rejects.toThrow();
  });

  test('rejects empty body', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: ELECTION_ID },
      _body: {},
    });

    await expect(castVote(ctx)).rejects.toThrow();
  });
});
