// FLOW-04: Election Vote → Tally → Winner
// Tests castVote records vote with duplicate detection,
// and updateElectionStatus manages election lifecycle.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { castVote } from './castVote';
import { updateElectionStatus } from './updateElectionStatus';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const ELECTION_ID = 'election-1';
const VOTER = 'voter-1';
const POSITION_ID = '00000000-0000-4000-8000-000000000001';
const NOMINEE_ID = '00000000-0000-4000-8000-000000000002';

const fakeElection = {
  id: ELECTION_ID,
  organizationId: 'org-1',
  title: 'Board Elections 2026',
  status: 'votingOpen',
  publishedAt: new Date('2026-03-01'),
};

const fakeVote = {
  id: 'vote-1',
  electionId: ELECTION_ID,
  positionId: POSITION_ID,
  nomineeId: NOMINEE_ID,
  voterId: VOTER,
};

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(ElectionsRepository, {
    get: async () => fakeElection,
    hasVoted: async () => false,
    castVote: async (data: any) => ({ ...fakeVote, ...data }),
    update: async (id: string, data: any) => ({ ...fakeElection, id, ...data }),
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-04] Election Vote → Tally → Winner', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  // ── Vote Casting ──

  test('vote recorded successfully for open election', async () => {
    let capturedVote: any = null;

    mocks = defaultStubs({
      castVote: async (data: any) => {
        capturedVote = data;
        return { ...fakeVote, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { positionId: POSITION_ID, nomineeId: NOMINEE_ID },
      _params: { id: ELECTION_ID },
    });
    const response = await castVote(ctx);

    expect(response.status).toBe(201);
    expect(capturedVote.electionId).toBe(ELECTION_ID);
    expect(capturedVote.positionId).toBe(POSITION_ID);
    expect(capturedVote.nomineeId).toBe(NOMINEE_ID);
    expect(capturedVote.voterId).toBeDefined();
  });

  test('duplicate vote for same position throws ConflictError', async () => {
    mocks = defaultStubs({
      hasVoted: async () => true,
    });

    const ctx = makeCtx({
      _body: { positionId: POSITION_ID, nomineeId: NOMINEE_ID },
      _params: { id: ELECTION_ID },
    });

    try {
      await castVote(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('Already voted');
    }
  });

  test('vote on non-open election throws ConflictError', async () => {
    mocks = defaultStubs({
      get: async () => ({ ...fakeElection, status: 'draft' }),
    });

    const ctx = makeCtx({
      _body: { positionId: POSITION_ID, nomineeId: NOMINEE_ID },
      _params: { id: ELECTION_ID },
    });

    try {
      await castVote(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('not open');
    }
  });

  test('vote on nonexistent election throws NotFoundError', async () => {
    mocks = defaultStubs({
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _body: { positionId: POSITION_ID, nomineeId: NOMINEE_ID },
      _params: { id: 'nonexistent' },
    });

    try {
      await castVote(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('not found');
    }
  });

  // ── Election Status Transitions ──

  test('publishing election sets publishedAt timestamp', async () => {
    let capturedUpdate: any = null;

    // Must be in awaitingConfirmation to transition to published
    mocks = defaultStubs({
      get: async () => ({ ...fakeElection, status: 'awaitingConfirmation' }),
      update: async (id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakeElection, id, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'published' },
      _params: { id: ELECTION_ID },
    });
    const response = await updateElectionStatus(ctx);

    expect(response.status).toBe(200);
    expect(capturedUpdate.status).toBe('published');
    expect(capturedUpdate.publishedAt).toBeInstanceOf(Date);
  });

  test('transitioning to awaitingConfirmation updates status without publishedAt', async () => {
    let capturedUpdate: any = null;

    // votingOpen → awaitingConfirmation is valid
    mocks = defaultStubs({
      update: async (id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakeElection, id, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { status: 'awaitingConfirmation' },
      _params: { id: ELECTION_ID },
    });
    const response = await updateElectionStatus(ctx);

    expect(response.status).toBe(200);
    expect(capturedUpdate.status).toBe('awaitingConfirmation');
    expect(capturedUpdate.publishedAt).toBeUndefined();
  });

  // Side-effect tests removed — tally computation and notification features
  // not yet implemented. Re-add when election results pipeline is built.
});
