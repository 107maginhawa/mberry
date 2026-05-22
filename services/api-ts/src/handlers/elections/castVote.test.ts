import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection, fakeVote as createFakeVote } from '@/test-utils/factories';
import { castVote } from './castVote';
import { ElectionsRepository } from './repos/elections.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = createFakeElection();

const fakeVote = createFakeVote({
  nomineeId: '00000000-0000-4000-8000-000000000002',
});

// ─── Tests ──────────────────────────────────────────────

describe('[BR-33] castVote', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
    // Default: voter is active member
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        duesExpiryDate: '2027-12-31',
        gracePeriodDays: 30,
        suspendedAt: null,
        removedAt: null,
      }),
    });
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(MembershipRepository);
  });

  test('casts vote and returns 201', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => false,
      castVote: async (data: any) => ({ ...fakeVote, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    const response = await castVote(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.positionId).toBe('00000000-0000-4000-8000-000000000001');
    expect(response.body.data.nomineeId).toBe('00000000-0000-4000-8000-000000000002');
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws ConflictError when election status is nominations_open', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting is not open');
  });

  test('throws ConflictError when election status is awaiting_confirmation', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'awaitingConfirmation' }),
      hasVoted: async () => false,
      castVote: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
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
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Election not found');
  });

  // ─── [BR-33] Voter Eligibility ────────────────────────────

  test('[BR-33] rejects non-member voter', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => false,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    await expect(castVote(ctx)).rejects.toThrow('must be a member');
  });

  test('[BR-33] rejects lapsed member', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      hasVoted: async () => false,
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        duesExpiryDate: '2020-01-01', // expired long ago
        gracePeriodDays: 30,
        suspendedAt: null,
        removedAt: null,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { positionId: '00000000-0000-4000-8000-000000000001', nomineeId: '00000000-0000-4000-8000-000000000002' },
    });

    await expect(castVote(ctx)).rejects.toThrow('Voting requires active membership');
  });
});
