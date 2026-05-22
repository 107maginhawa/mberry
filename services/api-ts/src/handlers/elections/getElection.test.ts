import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection } from '@/test-utils/factories';
import { getElection } from './getElection';
import { ElectionsRepository } from './repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = createFakeElection({
  status: 'draft',
  positions: [{ id: 'pos-1', title: 'President', sortOrder: 0 }],
});

const fakeNominees = [
  { id: 'nom-1', electionId: 'election-1', positionId: 'pos-1', personId: 'person-1', status: 'nominated' },
];

// ─── Tests ──────────────────────────────────────────────

describe('getElection', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(ElectionsRepository);
  });

  test('returns election with nominees and voter count', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      listNominees: async () => fakeNominees,
      getVoterCount: async () => 10,
      getVoteTallies: async () => [],
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const response = await getElection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('election-1');
    expect(response.body.data.nominees).toHaveLength(1);
    expect(response.body.data.voterCount).toBe(10);
  });

  test('includes tallies when status is published', async () => {
    const publishedElection = { ...fakeElection, status: 'published' };
    const tallies = [{ positionId: 'pos-1', nomineeId: 'nom-1', count: 5 }];

    mocks = stubRepo(ElectionsRepository, {
      get: async () => publishedElection,
      listNominees: async () => fakeNominees,
      getVoterCount: async () => 10,
      getVoteTallies: async () => tallies,
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const response = await getElection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.tallies).toHaveLength(1);
    expect(response.body.data.tallies[0].count).toBe(5);
  });

  test('includes tallies when status is awaiting_confirmation', async () => {
    const awaitingElection = { ...fakeElection, status: 'awaitingConfirmation' };
    const tallies = [{ positionId: 'pos-1', nomineeId: 'nom-1', count: 3 }];

    mocks = stubRepo(ElectionsRepository, {
      get: async () => awaitingElection,
      listNominees: async () => fakeNominees,
      getVoterCount: async () => 5,
      getVoteTallies: async () => tallies,
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const response = await getElection(ctx);
    expect(response.body.data.tallies).toHaveLength(1);
  });

  test('omits tallies when status is draft', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection, // status: 'draft'
      listNominees: async () => [],
      getVoterCount: async () => 0,
      getVoteTallies: async () => { throw new Error('should not be called'); },
    });

    const ctx = makeCtx({ _params: { id: 'election-1' } });
    const response = await getElection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.tallies).toEqual([]);
  });

  test('throws NotFoundError when election does not exist', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => undefined,
      listNominees: async () => [],
      getVoterCount: async () => 0,
      getVoteTallies: async () => [],
    });

    const ctx = makeCtx({ _params: { id: 'missing-id' } });
    await expect(getElection(ctx)).rejects.toThrow('Election not found');
  });
});
