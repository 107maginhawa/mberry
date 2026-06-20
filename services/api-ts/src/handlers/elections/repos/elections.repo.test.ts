/**
 * Tests for ElectionsRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed.
 */

import { describe, test, expect } from 'bun:test';
import { ElectionsRepository } from './elections.repo';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeElection(overrides: Record<string, any> = {}) {
  return {
    id: 'election-1',
    organizationId: 'org-1',
    title: '2026 Board Election',
    type: 'officer',
    status: 'draft',
    votingMode: 'online',
    nominationsOpenAt: null,
    nominationsCloseAt: null,
    votingOpenAt: null,
    votingCloseAt: null,
    passageThreshold: null,
    positions: [{ id: 'pos-1', title: 'President', sortOrder: 0 }],
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  };
}

function makeVote(overrides: Record<string, any> = {}) {
  return {
    id: 'vote-1',
    electionId: 'election-1',
    positionId: 'pos-1',
    nomineeId: 'nominee-1',
    voterId: 'voter-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever `rows` is provided.
 */
function makeDb({
  selectRows = [] as any[],
  selectRowsSets = undefined as any[][] | undefined,
  insertRow = {} as any,
  updateRow = {} as any,
}: {
  selectRows?: any[];
  selectRowsSets?: any[][];
  insertRow?: any;
  updateRow?: any;
} = {}) {
  let selectCallCount = 0;

  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    offset: (_n: number) => awaitable(result),
    groupBy: () => awaitable(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => {
      const rows = selectRowsSets
        ? selectRowsSets[selectCallCount++] ?? selectRows
        : selectRows;
      return awaitable(rows);
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () =>
          Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([updateRow]),
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  };
}

// ---------------------------------------------------------------------------
// ElectionsRepository.list
// ---------------------------------------------------------------------------

describe('ElectionsRepository.list', () => {
  test('returns elections for an organization', async () => {
    const e1 = makeElection();
    const e2 = makeElection({ id: 'election-2', title: 'Bylaw Amendment' });
    const db = makeDb({ selectRows: [e1, e2] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.list('org-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('election-1');
    expect(result[1].id).toBe('election-2');
  });

  test('returns empty array when no elections exist for org', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.list('org-empty');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.get
// ---------------------------------------------------------------------------

describe('ElectionsRepository.get', () => {
  test('returns election when found', async () => {
    const election = makeElection();
    const db = makeDb({ selectRows: [election] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.get('election-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('election-1');
    expect(result!.title).toBe('2026 Board Election');
  });

  test('returns undefined when election not found', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.get('missing-id');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.create
// ---------------------------------------------------------------------------

describe('ElectionsRepository.create', () => {
  test('inserts and returns new election', async () => {
    const election = makeElection();
    const db = makeDb({ insertRow: election });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.create({
      organizationId: 'org-1',
      title: '2026 Board Election',
      type: 'officer',
      status: 'draft',
      votingMode: 'online',
      positions: [{ id: 'pos-1', title: 'President', sortOrder: 0 }],
    } as any);

    expect(result.id).toBe('election-1');
    expect(result.title).toBe('2026 Board Election');
    expect(result.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.update (used by updateStatus)
// ---------------------------------------------------------------------------

describe('ElectionsRepository.update', () => {
  test('updates status and returns updated election', async () => {
    const updated = makeElection({ status: 'votingOpen' });
    const db = makeDb({ updateRow: updated });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.update('election-1', { status: 'votingOpen' } as any);
    expect(result.status).toBe('votingOpen');
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.castVote
// ---------------------------------------------------------------------------

describe('ElectionsRepository.castVote', () => {
  test('inserts and returns vote record', async () => {
    const vote = makeVote();
    const db = makeDb({ insertRow: vote });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.castVote({
      electionId: 'election-1',
      positionId: 'pos-1',
      nomineeId: 'nominee-1',
      voterId: 'voter-1',
    });

    expect(result.electionId).toBe('election-1');
    expect(result.positionId).toBe('pos-1');
    expect(result.voterId).toBe('voter-1');
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.hasVoted
// ---------------------------------------------------------------------------

describe('ElectionsRepository.hasVoted', () => {
  test('returns true when voter already voted for position', async () => {
    const vote = makeVote();
    const db = makeDb({ selectRows: [vote] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.hasVoted('election-1', 'voter-1', 'pos-1');
    expect(result).toBe(true);
  });

  test('returns false when voter has not voted for position', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.hasVoted('election-1', 'voter-1', 'pos-1');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.getVoteTallies
// ---------------------------------------------------------------------------

describe('ElectionsRepository.getVoteTallies', () => {
  test('returns grouped vote counts', async () => {
    const rows = [
      { positionId: 'pos-1', nomineeId: 'nominee-1', count: 5 },
      { positionId: 'pos-1', nomineeId: 'nominee-2', count: 3 },
    ];
    const db = makeDb({ selectRows: rows });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.getVoteTallies('election-1');
    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(5);
    expect(result[1].nomineeId).toBe('nominee-2');
  });

  test('returns empty array when no votes', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.getVoteTallies('election-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.getVoterCount
// ---------------------------------------------------------------------------

describe('ElectionsRepository.getVoterCount', () => {
  test('returns distinct voter count', async () => {
    const db = makeDb({ selectRows: [{ count: 42 }] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.getVoterCount('election-1');
    expect(result).toBe(42);
  });

  test('returns 0 when no voters', async () => {
    const db = makeDb({ selectRows: [undefined] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.getVoterCount('election-1');
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ElectionsRepository.listNominees
// ---------------------------------------------------------------------------

describe('ElectionsRepository.listNominees', () => {
  test('returns nominees for an election', async () => {
    // ISSUE-031: listNominees now selects { nominee, firstName, lastName } via a
    // leftJoin on persons and maps r.nominee + personName. Mock the joined row shape.
    const nominees = [
      { nominee: { id: 'nom-1', electionId: 'election-1', positionId: 'pos-1', personId: 'person-1', status: 'nominated' }, firstName: 'Ada', lastName: 'Lovelace' },
      { nominee: { id: 'nom-2', electionId: 'election-1', positionId: 'pos-1', personId: 'person-2', status: 'accepted' }, firstName: 'Alan', lastName: 'Turing' },
    ];
    const db = makeDb({ selectRows: nominees });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.listNominees('election-1');
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('nominated');
    expect(result[0].personName).toBe('Ada Lovelace');
  });

  test('returns empty array when no nominees', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.listNominees('election-1');
    expect(result).toEqual([]);
  });
});
