// AHA FIX-002 (G2) — unit coverage for the canonical-position-identity resolver.
//
// `resolveElectionPositionSlots` maps requested position titles to REAL `position`
// row ids (reusing existing ones case-insensitively, minting new ones otherwise) so
// downstream election_nominee / election_vote FKs survive. These tests drive the
// real exported function against a hand-rolled fake PositionRepository — no DB.
import { describe, test, expect } from 'bun:test';
import { resolveElectionPositionSlots } from './resolve-election-positions';
import type { PositionRepository } from '@/handlers/association:member/repos/governance.repo';

interface FakePosition {
  id: string;
  organizationId: string;
  title: string;
  level?: string;
  termLengthMonths?: number;
  sortOrder?: number;
}

/**
 * Builds a fake PositionRepository seeded with `existing` rows. `create` mints a
 * deterministic id, appends to the in-memory store, and records the payload so we
 * can assert on the create contract.
 */
function makeFakeRepo(existing: FakePosition[] = []) {
  const store: FakePosition[] = [...existing];
  const createCalls: any[] = [];
  let seq = 0;

  const repo = {
    findByOrg: async (organizationId: string) =>
      store.filter((p) => p.organizationId === organizationId) as any,
    create: async (data: any) => {
      createCalls.push(data);
      const row: FakePosition = { id: `new-pos-${++seq}`, ...data };
      store.push(row);
      return row as any;
    },
  };

  return { repo: repo as unknown as PositionRepository, store, createCalls };
}

describe('resolveElectionPositionSlots (AHA FIX-002 / G2)', () => {
  test('empty titles short-circuits without touching the repo', async () => {
    let findByOrgCalls = 0;
    const repo = {
      findByOrg: async () => {
        findByOrgCalls++;
        return [] as any;
      },
      create: async () => {
        throw new Error('create must not be called for empty titles');
      },
    } as unknown as PositionRepository;

    const slots = await resolveElectionPositionSlots(repo, 'org-1', []);

    expect(slots).toEqual([]);
    expect(findByOrgCalls).toBe(0);
  });

  test('reuses an existing org position case-insensitively instead of creating one', async () => {
    const { repo, createCalls } = makeFakeRepo([
      { id: 'pos-president', organizationId: 'org-1', title: 'President' },
    ]);

    const slots = await resolveElectionPositionSlots(repo, 'org-1', ['  president  ']);

    // Canonical identity: the slot id must be the REAL existing position row id.
    expect(slots).toEqual([{ id: 'pos-president', title: 'President', sortOrder: 0 }]);
    // Match was found, so no new position row may be minted.
    expect(createCalls.length).toBe(0);
  });

  test('creates a canonical position for an unknown title with the expected payload', async () => {
    const { repo, createCalls } = makeFakeRepo([]);

    const slots = await resolveElectionPositionSlots(repo, 'org-7', ['Treasurer']);

    expect(slots).toEqual([{ id: 'new-pos-1', title: 'Treasurer', sortOrder: 0 }]);
    expect(createCalls.length).toBe(1);
    expect(createCalls[0]).toMatchObject({
      organizationId: 'org-7',
      title: 'Treasurer',
      level: 'national',
      termLengthMonths: 12,
      sortOrder: 0,
    });
  });

  test('mixes reuse + create, preserves order, and skips blank titles', async () => {
    const { repo, createCalls } = makeFakeRepo([
      { id: 'pos-pres', organizationId: 'org-1', title: 'President' },
    ]);

    const slots = await resolveElectionPositionSlots(repo, 'org-1', [
      'President', // existing → reuse pos-pres
      '   ', // blank → skipped
      'Secretary', // new → created
    ]);

    expect(slots).toEqual([
      { id: 'pos-pres', title: 'President', sortOrder: 0 },
      // sortOrder tracks the original index (2), not the slot array position.
      { id: 'new-pos-1', title: 'Secretary', sortOrder: 2 },
    ]);
    // Only the unknown 'Secretary' triggers a create; blank + existing do not.
    expect(createCalls.length).toBe(1);
    expect(createCalls[0].title).toBe('Secretary');
  });

  test('dedupes repeated titles to a single canonical position within one call', async () => {
    const { repo, createCalls } = makeFakeRepo([]);

    const slots = await resolveElectionPositionSlots(repo, 'org-1', ['Auditor', 'auditor']);

    // Both slots resolve to the same freshly-minted canonical row.
    expect(slots.map((s) => s.id)).toEqual(['new-pos-1', 'new-pos-1']);
    // Second occurrence reuses the in-memory cache → exactly one create.
    expect(createCalls.length).toBe(1);
  });
});
