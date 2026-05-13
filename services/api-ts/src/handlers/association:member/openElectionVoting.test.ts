import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { openElectionVoting } from './openElectionVoting';
import { ElectionsRepository } from '../elections/repos/elections.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'org-1',
  title: '2026 Board Election',
  status: 'nominationsOpen',
  positions: [
    { id: 'pos-1', title: 'President', sortOrder: 0 },
    { id: 'pos-2', title: 'Secretary', sortOrder: 1 },
  ],
};

const updatedElection = {
  ...fakeElection,
  status: 'votingOpen',
  votingOpenAt: new Date(),
};

/** Fake DB that passes tx through to callback (simulates transaction) */
const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
};

function makeNominee(positionId: string, personId: string) {
  return {
    id: `nom-${positionId}-${personId}`,
    electionId: 'election-1',
    positionId,
    personId,
    status: 'nominated',
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('[BR-33] openElectionVoting — 2+ candidates per position', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
  });

  test('rejects when a position has only 1 candidate', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      listNominees: async () => [
        // pos-1 has 2 candidates (valid)
        makeNominee('pos-1', 'person-1'),
        makeNominee('pos-1', 'person-2'),
        // pos-2 has only 1 candidate (invalid)
        makeNominee('pos-2', 'person-3'),
      ],
      update: async () => updatedElection,
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' }, database: txDb });
    await expect(openElectionVoting(ctx)).rejects.toThrow(/Secretary/);
  });

  test('rejects when a position has 0 candidates', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      listNominees: async () => [
        // pos-1 has 2 candidates, pos-2 has 0
        makeNominee('pos-1', 'person-1'),
        makeNominee('pos-1', 'person-2'),
      ],
      update: async () => updatedElection,
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' }, database: txDb });
    await expect(openElectionVoting(ctx)).rejects.toThrow(/Secretary/);
  });

  test('rejects with no nominees at all', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      listNominees: async () => [],
      update: async () => updatedElection,
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' }, database: txDb });
    await expect(openElectionVoting(ctx)).rejects.toThrow();
  });

  test('succeeds when all positions have 2+ candidates', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      listNominees: async () => [
        makeNominee('pos-1', 'person-1'),
        makeNominee('pos-1', 'person-2'),
        makeNominee('pos-2', 'person-3'),
        makeNominee('pos-2', 'person-4'),
      ],
      update: async () => updatedElection,
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' }, database: txDb });
    const res = await openElectionVoting(ctx);
    expect(res.status).toBe(200);
  });

  test('rejects mixed — one valid position, one with 1 candidate', async () => {
    const threePositionElection = {
      ...fakeElection,
      positions: [
        { id: 'pos-1', title: 'President', sortOrder: 0 },
        { id: 'pos-2', title: 'Secretary', sortOrder: 1 },
        { id: 'pos-3', title: 'Treasurer', sortOrder: 2 },
      ],
    };

    stubRepo(ElectionsRepository, {
      get: async () => threePositionElection,
      listNominees: async () => [
        makeNominee('pos-1', 'person-1'),
        makeNominee('pos-1', 'person-2'),
        makeNominee('pos-2', 'person-3'),
        makeNominee('pos-2', 'person-4'),
        // pos-3 has only 1
        makeNominee('pos-3', 'person-5'),
      ],
      update: async () => updatedElection,
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' }, database: txDb });
    await expect(openElectionVoting(ctx)).rejects.toThrow(/Treasurer/);
  });

  test('uses INSUFFICIENT_CANDIDATES error code', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      listNominees: async () => [
        makeNominee('pos-1', 'person-1'),
        // pos-2 missing entirely
      ],
      update: async () => updatedElection,
    });

    const ctx = makeCtx({ _params: { electionId: 'election-1' }, database: txDb });
    try {
      await openElectionVoting(ctx);
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('INSUFFICIENT_CANDIDATES');
    }
  });
});
