import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getElection } from './getElection';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const baseElection = {
  id: 'elec-1',
  organizationId: 'tenant-1',
  title: 'Board Election 2024',
  status: 'active' as const,
  type: 'board',
  nominationsOpenAt: '2024-01-01T00:00:00Z',
  nominationsCloseAt: '2024-02-01T00:00:00Z',
  votingOpenAt: '2024-02-10T00:00:00Z',
  votingCloseAt: '2024-02-20T00:00:00Z',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const publishedElection = { ...baseElection, id: 'elec-2', status: 'published' as const };

let mocks: ReturnType<typeof stubRepo>;

// ─── Tests ──────────────────────────────────────────────

describe('getElection', () => {
  afterEach(() => restoreRepo(ElectionsRepository));

  test('happy path — returns election with nominees, voterCount, empty tallies for active', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      listNominees: async () => [{ id: 'nom-1', personId: 'p-1', status: 'nominated' }],
      getVoterCount: async () => 42,
      getVoteTallies: async () => [],
    });

    const ctx = makeCtx({ _params: { electionId: 'elec-1' } });
    const res = await getElection(ctx);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('elec-1');
    expect(res.body.title).toBe('Board Election 2024');
    expect(res.body.voterCount).toBe(42);
    expect(Array.isArray(res.body.nominees)).toBe(true);
    expect(res.body.nominees).toHaveLength(1);
    // Tallies should be empty for active (not awaitingConfirmation/published)
    expect(res.body.tallies).toEqual([]);
    // Field mapping
    expect(res.body.nominationStart).toBe(baseElection.nominationsOpenAt);
    expect(res.body.nominationEnd).toBe(baseElection.nominationsCloseAt);
    expect(res.body.votingStart).toBe(baseElection.votingOpenAt);
    expect(res.body.votingEnd).toBe(baseElection.votingCloseAt);
  });

  test('published election — tallies fetched', async () => {
    const fakeTallies = [{ positionId: 'pos-1', nomineeId: 'nom-1', count: 10 }];
    mocks = stubRepo(ElectionsRepository, {
      get: async () => publishedElection,
      listNominees: async () => [],
      getVoterCount: async () => 5,
      getVoteTallies: async () => fakeTallies,
    });

    const ctx = makeCtx({ _params: { electionId: 'elec-2' } });
    const res = await getElection(ctx);

    expect(res.status).toBe(200);
    expect(res.body.tallies).toHaveLength(1);
    expect(res.body.tallies[0].count).toBe(10);
  });

  test('awaitingConfirmation election — tallies fetched', async () => {
    const waitingElection = { ...baseElection, status: 'awaitingConfirmation' as const };
    const fakeTallies = [{ positionId: 'pos-2', nomineeId: 'nom-2', count: 3 }];
    mocks = stubRepo(ElectionsRepository, {
      get: async () => waitingElection,
      listNominees: async () => [],
      getVoterCount: async () => 3,
      getVoteTallies: async () => fakeTallies,
    });

    const ctx = makeCtx({ _params: { electionId: 'elec-1' } });
    const res = await getElection(ctx);

    expect(res.status).toBe(200);
    expect(res.body.tallies).toHaveLength(1);
  });

  test('throws on missing session (unauthorized)', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => baseElection,
      listNominees: async () => [],
      getVoterCount: async () => 0,
      getVoteTallies: async () => [],
    });

    const ctx = makeCtx({ user: null, session: null, _params: { electionId: 'elec-1' } });
    await expect(getElection(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when election not found', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => undefined,
      listNominees: async () => [],
      getVoterCount: async () => 0,
      getVoteTallies: async () => [],
    });

    const ctx = makeCtx({ _params: { electionId: 'no-such' } });
    await expect(getElection(ctx)).rejects.toThrow();
  });
});
