import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { castVote } from './castVote';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: '2026 Board Election',
  status: 'voting_open',
};

const fakeVote = {
  id: 'vote-1',
  electionId: 'election-1',
  positionId: 'pos-1',
  nomineeId: 'nominee-1',
  voterId: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-33] castVote', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('casts vote and returns 201', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => false,
      castVote: async (data: any) => ({ ...fakeVote, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    const response = await castVote(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.positionId).toBe('pos-1');
    expect(response.body.data.nomineeId).toBe('nominee-1');
  });

  test('uses session user as voterId', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => false,
      castVote: async (data: any) => { capturedData = data; return { ...fakeVote, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'voter-99', role: 'member' },
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await castVote(ctx);
    expect(capturedData.voterId).toBe('voter-99');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => false,
      castVote: async (data: any) => ({ ...fakeVote, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow();
  });

  // ─── [BR-33] Voting Integrity Edge Cases ───────────────

  test('[BR-33] throws ConflictError on double vote (same user, same position)', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => true, // already voted
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Already voted for this position');
  });

  test('[BR-33] throws ConflictError when election status is draft', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'draft' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws ConflictError when election status is nominations_open', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominations_open' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws ConflictError when election status is published (closed)', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'published' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws ConflictError when election status is cancelled', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'cancelled' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws ConflictError when election status is awaiting_confirmation', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'awaiting_confirmation' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws NotFoundError when election does not exist', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => undefined,
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'missing-id' },
      _body: { positionId: 'pos-1', nomineeId: 'nominee-1' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Election not found');
  });
});
