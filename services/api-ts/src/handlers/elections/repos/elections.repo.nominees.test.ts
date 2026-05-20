/**
 * [024] ElectionsRepository — Nominee & Vote Voiding Tests
 *
 * Covers repo methods not tested in elections.repo.test.ts:
 * - addNominee: insert nominee record
 * - getNominee: retrieve single nominee by ID
 * - updateNomineeStatus: transition nominee status
 * - countNomineesByPosition: aggregate count for min-candidate validation (BR-33)
 * - voidVotesForNominee: delete votes for removed candidate (BR-33)
 *
 * All tests use hand-crafted DB stubs — no real Postgres needed.
 */

import { describe, test, expect } from 'bun:test';
import { ElectionsRepository } from './elections.repo';

// ─── DB Stub Factory ────────────────────────────────────

function makeDb({
  selectRows = [] as any[],
  insertRow = {} as any,
  updateRow = {} as any,
  deleteRows = [] as any[],
}: {
  selectRows?: any[];
  insertRow?: any;
  updateRow?: any;
  deleteRows?: any[];
} = {}) {
  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    groupBy: () => awaitable(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => awaitable(selectRows),
    insert: (_table: any) => ({
      values: (_data: any) => ({
        returning: () => Promise.resolve([insertRow]),
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
      where: () => ({
        returning: () => Promise.resolve(deleteRows),
      }),
    }),
  };
}

// ─── addNominee ─────────────────────────────────────────

describe('ElectionsRepository.addNominee', () => {
  test('inserts nominee with status nominated and returns record', async () => {
    const nominee = {
      id: 'nom-1',
      electionId: 'election-1',
      positionId: 'pos-1',
      personId: 'person-1',
      nominatedBy: 'officer-1',
      organizationId: 'org-1',
      status: 'nominated',
    };
    const db = makeDb({ insertRow: nominee });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.addNominee({
      electionId: 'election-1',
      positionId: 'pos-1',
      personId: 'person-1',
      nominatedBy: 'officer-1',
      organizationId: 'org-1',
    });

    expect(result.id).toBe('nom-1');
    expect(result.status).toBe('nominated');
    expect(result.personId).toBe('person-1');
  });
});

// ─── getNominee ─────────────────────────────────────────

describe('ElectionsRepository.getNominee', () => {
  test('returns nominee when found', async () => {
    const nominee = {
      id: 'nom-1',
      electionId: 'election-1',
      positionId: 'pos-1',
      personId: 'person-1',
      status: 'nominated',
    };
    const db = makeDb({ selectRows: [nominee] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.getNominee('nom-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('nom-1');
    expect(result!.status).toBe('nominated');
  });

  test('returns undefined when nominee not found', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.getNominee('missing-nom');
    expect(result).toBeUndefined();
  });
});

// ─── updateNomineeStatus ────────────────────────────────

describe('ElectionsRepository.updateNomineeStatus', () => {
  test('transitions nominee from nominated to accepted', async () => {
    const updated = {
      id: 'nom-1',
      electionId: 'election-1',
      positionId: 'pos-1',
      personId: 'person-1',
      status: 'accepted',
    };
    const db = makeDb({ updateRow: updated });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.updateNomineeStatus('nom-1', 'accepted');
    expect(result.status).toBe('accepted');
  });

  test('transitions nominee from nominated to declined', async () => {
    const updated = {
      id: 'nom-1',
      status: 'declined',
    };
    const db = makeDb({ updateRow: updated });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.updateNomineeStatus('nom-1', 'declined');
    expect(result.status).toBe('declined');
  });

  test('transitions nominee from accepted to elected', async () => {
    const updated = {
      id: 'nom-1',
      status: 'elected',
    };
    const db = makeDb({ updateRow: updated });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.updateNomineeStatus('nom-1', 'elected');
    expect(result.status).toBe('elected');
  });
});

// ─── countNomineesByPosition (BR-33) ────────────────────

describe('ElectionsRepository.countNomineesByPosition', () => {
  test('returns grouped counts per position', async () => {
    const rows = [
      { positionId: 'pos-1', count: 3 },
      { positionId: 'pos-2', count: 2 },
    ];
    const db = makeDb({ selectRows: rows });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.countNomineesByPosition('election-1');
    expect(result).toHaveLength(2);
    expect(result[0].positionId).toBe('pos-1');
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(2);
  });

  test('returns empty array when no nominees', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.countNomineesByPosition('election-1');
    expect(result).toEqual([]);
  });

  test('returns single position with count 1 (below minimum)', async () => {
    const rows = [{ positionId: 'pos-1', count: 1 }];
    const db = makeDb({ selectRows: rows });
    const repo = new ElectionsRepository(db as any);

    const result = await repo.countNomineesByPosition('election-1');
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });
});

// ─── voidVotesForNominee (BR-33) ────────────────────────

describe('ElectionsRepository.voidVotesForNominee', () => {
  test('deletes votes and returns count of voided votes', async () => {
    const deletedVotes = [
      { id: 'v1', electionId: 'election-1', nomineeId: 'nom-1', voterId: 'voter-1' },
      { id: 'v2', electionId: 'election-1', nomineeId: 'nom-1', voterId: 'voter-2' },
      { id: 'v3', electionId: 'election-1', nomineeId: 'nom-1', voterId: 'voter-3' },
    ];
    const db = makeDb({ deleteRows: deletedVotes });
    const repo = new ElectionsRepository(db as any);

    const voided = await repo.voidVotesForNominee('election-1', 'nom-1');
    expect(voided).toBe(3);
  });

  test('returns 0 when no votes exist for the nominee', async () => {
    const db = makeDb({ deleteRows: [] });
    const repo = new ElectionsRepository(db as any);

    const voided = await repo.voidVotesForNominee('election-1', 'nom-nonexistent');
    expect(voided).toBe(0);
  });
});
