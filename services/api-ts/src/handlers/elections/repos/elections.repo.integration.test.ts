/**
 * Real-PG integration harness for ElectionsRepository (B4 elections S1).
 *
 * elections is the ODD B4 member: both existing repo test files
 * (`elections.repo.test.ts`, `elections.repo.nominees.test.ts`) are fake-db
 * illusions ("no real Postgres needed") whose hand-crafted stubs resolve to
 * whatever rows the test hands them — so the real SQL (defaults, org-scope
 * binding, CHECK constraints, the `election_vote_unique` partial index, the
 * secret-ballot projection, GROUP BY tallies, cascade DELETE/UPDATE) is NEVER
 * exercised against Postgres.
 *
 * This is the ONE NEW real-PG harness in B4. It borrows member/governance's
 * SEED IDIOMS (person DEFAULT VALUES RETURNING id; position(organization_id,
 * title); repo.create/addNominee) but stands the tables up via `createScratch`
 * so the LIKE-copy faithfully reproduces the live public schema — including the
 * `election_vote_unique` index that BOTH the stub AND the old hand-DDL
 * governance fixtures LACK (which is exactly why the 23505 backstop is unproven).
 *
 * Slice 1: harness + create/get/list (org isolation) + CHECK enforcement +
 * nominee CRUD round-trip.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { ElectionsRepository } from './elections.repo';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['election', 'election_nominee', 'election_vote', 'person', 'position']);
});

afterAll(async () => {
  await H?.teardown();
});

// Seed idioms borrowed from member/governance/election-lifecycle.integration.test.ts:199-204.
// The live public `person` table has `first_name NOT NULL` (stricter than the old
// governance hand-DDL which made it nullable), so DEFAULT VALUES would 23502 here —
// the createScratch LIKE-copy faithfully reproduces that NOT NULL. Supply first_name.
async function seedPerson(): Promise<string> {
  const res = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (first_name) VALUES ('Voter') RETURNING id`,
  );
  return res.rows[0].id as string;
}

async function seedPosition(orgId: string): Promise<string> {
  // Live public `position` has organization_id/title/level all NOT NULL with no
  // default for `level` (governance hand-DDL defaulted level='national'); supply it.
  const res = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (organization_id, title, level) VALUES ($1, 'President', 'national') RETURNING id`,
    [orgId],
  );
  return res.rows[0].id as string;
}

const RANDOM_UUID = '00000000-0000-4000-8000-0000000000ff';

describe('ElectionsRepository — real-PG (B4 S1)', () => {
  test('create persists with defaults; get round-trips; get(random) is undefined', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();

    const election = await repo.create({
      organizationId: orgId,
      title: 'Defaults Election',
      type: 'officer',
      status: 'draft',
      votingMode: 'online',
    } as never);

    // Read the stored row directly — prove the persisted column values, not the JS echo.
    const { rows } = await H.scopedPool.query(
      `SELECT status, type, voting_mode, organization_id, title FROM "${H.schema}".election WHERE id = $1`,
      [election.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('draft');
    expect(rows[0].type).toBe('officer');
    expect(rows[0].voting_mode).toBe('online');
    expect(rows[0].organization_id).toBe(orgId);
    expect(rows[0].title).toBe('Defaults Election');

    const fetched = await repo.get(election.id);
    expect(fetched?.id).toBe(election.id);
    expect(fetched?.status).toBe('draft');

    const missing = await repo.get(RANDOM_UUID);
    expect(missing).toBeUndefined();
  });

  test('list(org, {status}) is org+status scoped, ordered created_at DESC; other org never returned', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();

    // orgA: two votingOpen + one draft. Insert older first, then newer, to assert DESC order.
    const older = await repo.create({
      organizationId: orgA, title: 'A older votingOpen', type: 'officer',
      status: 'votingOpen', votingMode: 'online',
    } as never);
    // ensure distinct created_at ordering
    await new Promise((r) => setTimeout(r, 10));
    const newer = await repo.create({
      organizationId: orgA, title: 'A newer votingOpen', type: 'officer',
      status: 'votingOpen', votingMode: 'online',
    } as never);
    await repo.create({
      organizationId: orgA, title: 'A draft', type: 'officer',
      status: 'draft', votingMode: 'online',
    } as never);
    // orgB: a votingOpen that must NEVER appear in orgA's list.
    const otherOrg = await repo.create({
      organizationId: orgB, title: 'B votingOpen', type: 'officer',
      status: 'votingOpen', votingMode: 'online',
    } as never);

    const result = await repo.list(orgA, { status: 'votingOpen' });
    const ids = result.map((e) => e.id);

    expect(ids).toContain(older.id);
    expect(ids).toContain(newer.id);
    expect(ids).not.toContain(otherOrg.id); // org isolation
    expect(result.every((e) => e.status === 'votingOpen')).toBe(true);
    expect(result.every((e) => e.organizationId === orgA)).toBe(true);
    // DESC by created_at — newer must come before older.
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  test('CHECK enforcement: voting/nominations date-order violations raise 23514', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const t1 = new Date('2026-02-01T00:00:00Z');
    const t0 = new Date('2026-01-01T00:00:00Z');

    // votingCloseAt (t0) < votingOpenAt (t1) violates election_voting_date_order.
    let votingCode: string | undefined;
    try {
      await repo.create({
        organizationId: orgId, title: 'bad voting order', type: 'officer',
        status: 'draft', votingMode: 'online',
        votingOpenAt: t1, votingCloseAt: t0,
      } as never);
    } catch (e) {
      votingCode =
        (e as { code?: string; cause?: { code?: string } }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(votingCode).toBe('23514');

    // nominationsCloseAt (t0) < nominationsOpenAt (t1) violates election_nominations_date_order.
    let nominationsCode: string | undefined;
    try {
      await repo.create({
        organizationId: orgId, title: 'bad nominations order', type: 'officer',
        status: 'draft', votingMode: 'online',
        nominationsOpenAt: t1, nominationsCloseAt: t0,
      } as never);
    } catch (e) {
      nominationsCode =
        (e as { code?: string; cause?: { code?: string } }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(nominationsCode).toBe('23514');
  });

  test('addNominee persists status=nominated; getNominee round-trips; updateNomineeStatus flips status + bumps updated_at', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const personId = await seedPerson();
    const positionId = await seedPosition(orgId);

    const election = await repo.create({
      organizationId: orgId, title: 'Nominee CRUD', type: 'officer',
      status: 'nominationsOpen', votingMode: 'online',
    } as never);

    const nominee = await repo.addNominee({
      electionId: election.id,
      positionId,
      personId,
      nominatedBy: personId,
      organizationId: orgId,
    });

    // Persisted default status.
    const stored = await H.scopedPool.query(
      `SELECT status, updated_at FROM "${H.schema}".election_nominee WHERE id = $1`,
      [nominee.id],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].status).toBe('nominated');
    const updatedAtBefore = new Date(stored.rows[0].updated_at).getTime();

    const fetched = await repo.getNominee(nominee.id);
    expect(fetched?.id).toBe(nominee.id);
    expect(fetched?.status).toBe('nominated');

    // ensure a measurable updated_at delta
    await new Promise((r) => setTimeout(r, 10));
    await repo.updateNomineeStatus(nominee.id, 'accepted');

    const after = await H.scopedPool.query(
      `SELECT status, updated_at FROM "${H.schema}".election_nominee WHERE id = $1`,
      [nominee.id],
    );
    expect(after.rows[0].status).toBe('accepted');
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(updatedAtBefore);
  });
});

/**
 * Slice 2 — Secret-ballot anonymization projection (WF-077), repo lines 81-103.
 *
 * The privacy model is PROJECTION-only: `voter_id` IS persisted NOT NULL (so the
 * "already voted?" self-check can run), but the admin tally path
 * `listAnonymizedVotes` deliberately OMITS voterId/createdBy/updatedBy from its
 * SELECT — so an admin tally row can never be linked back to a voter. The
 * deliberate asymmetry: `listVotesForVoter` (self-read) DOES return the caller's
 * own voterId, but only their own rows. The fake-db stub never exercised either
 * SELECT against real SQL, so neither the omission nor the asymmetry was proven.
 */
describe('ElectionsRepository — secret-ballot projection (B4 S2, WF-077)', () => {
  test('voter_id persisted NOT NULL; listAnonymizedVotes omits voter identity; listVotesForVoter is the asymmetric self-read', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const positionId = await seedPosition(orgId);

    const election = await repo.create({
      organizationId: orgId, title: 'Secret Ballot', type: 'officer',
      status: 'votingOpen', votingMode: 'online',
    } as never);

    const candidateId = await seedPerson();
    const nominee = await repo.addNominee({
      electionId: election.id,
      positionId,
      personId: candidateId,
      nominatedBy: candidateId,
      organizationId: orgId,
    });

    // 3 distinct voters each cast one vote for the same nominee/position.
    const voterIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const voterId = await seedPerson();
      voterIds.push(voterId);
      await repo.castVote({
        electionId: election.id,
        positionId,
        nomineeId: nominee.id,
        voterId,
        organizationId: orgId,
      });
    }

    // Storage-level truth: voter_id IS persisted and NOT NULL (anonymity is
    // projection-only, not storage-level). Read raw column directly.
    const raw = await H.scopedPool.query(
      `SELECT voter_id FROM "${H.schema}".election_vote WHERE election_id = $1`,
      [election.id],
    );
    expect(raw.rows).toHaveLength(3);
    expect(raw.rows.every((r) => r.voter_id !== null && r.voter_id !== undefined)).toBe(true);
    expect(new Set(raw.rows.map((r) => r.voter_id))).toEqual(new Set(voterIds));

    // Admin path: anonymized projection — 3 rows, each WITHOUT voter identity.
    const anon = await repo.listAnonymizedVotes(election.id);
    expect(anon).toHaveLength(3);
    for (const row of anon) {
      const keys = Object.keys(row);
      // The secret-ballot guarantee: no key can link a tally row to a voter.
      expect(keys).not.toContain('voterId');
      expect(keys).not.toContain('createdBy');
      expect(keys).not.toContain('updatedBy');
      // What it DOES carry — the un-linkable tally fields.
      expect(keys).toContain('castAt');
      expect(keys).toContain('nomineeId');
      expect(keys).toContain('positionId');
      expect(keys).toContain('organizationId');
      const r = row as { castAt: unknown; nomineeId: string; positionId: string; organizationId: string };
      expect(r.castAt).toBeInstanceOf(Date); // created_at aliased to castAt
      expect(r.nomineeId).toBe(nominee.id);
      expect(r.positionId).toBe(positionId);
      expect(r.organizationId).toBe(orgId);
    }

    // Self-read asymmetry: listVotesForVoter returns the caller's OWN full rows
    // (including voterId) and ONLY that voter's rows — never another voter's.
    const selfRows = await repo.listVotesForVoter(election.id, voterIds[0]!);
    expect(selfRows).toHaveLength(1);
    expect(Object.keys(selfRows[0]!)).toContain('voterId');
    expect((selfRows[0] as { voterId: string }).voterId).toBe(voterIds[0]);
    expect(selfRows.every((v) => (v as { voterId: string }).voterId === voterIds[0])).toBe(true);
    // Another voter's self-read returns only THEIR row, not voter 0's.
    const otherSelf = await repo.listVotesForVoter(election.id, voterIds[1]!);
    expect(otherSelf).toHaveLength(1);
    expect((otherSelf[0] as { voterId: string }).voterId).toBe(voterIds[1]);
  });

  test('listAnonymizedVotes(electionId, positionId) filters to one position; other position excluded', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const positionP = await seedPosition(orgId);
    const positionQ = await seedPosition(orgId);

    const election = await repo.create({
      organizationId: orgId, title: 'Two Position Ballot', type: 'officer',
      status: 'votingOpen', votingMode: 'online',
    } as never);

    const candidate = await seedPerson();
    const nomineeP = await repo.addNominee({
      electionId: election.id, positionId: positionP, personId: candidate,
      nominatedBy: candidate, organizationId: orgId,
    });
    const nomineeQ = await repo.addNominee({
      electionId: election.id, positionId: positionQ, personId: candidate,
      nominatedBy: candidate, organizationId: orgId,
    });

    // 2 votes for position P, 1 for position Q (distinct voters per (position) key).
    const voterPa = await seedPerson();
    const voterPb = await seedPerson();
    const voterQ = await seedPerson();
    await repo.castVote({ electionId: election.id, positionId: positionP, nomineeId: nomineeP.id, voterId: voterPa, organizationId: orgId });
    await repo.castVote({ electionId: election.id, positionId: positionP, nomineeId: nomineeP.id, voterId: voterPb, organizationId: orgId });
    await repo.castVote({ electionId: election.id, positionId: positionQ, nomineeId: nomineeQ.id, voterId: voterQ, organizationId: orgId });

    const allRows = await repo.listAnonymizedVotes(election.id);
    expect(allRows).toHaveLength(3);

    const onlyP = await repo.listAnonymizedVotes(election.id, positionP);
    expect(onlyP).toHaveLength(2);
    expect(onlyP.every((r) => (r as { positionId: string }).positionId === positionP)).toBe(true);
    // The other position's vote is excluded.
    expect(onlyP.some((r) => (r as { positionId: string }).positionId === positionQ)).toBe(false);

    const onlyQ = await repo.listAnonymizedVotes(election.id, positionQ);
    expect(onlyQ).toHaveLength(1);
    expect((onlyQ[0] as { positionId: string }).positionId).toBe(positionQ);
  });
});

/**
 * Slice 3 — Vote tally GROUP BY + distinct voter count against real aggregation,
 * repo lines 105-115.
 *
 * The fake-db stub returned whatever scripted counts the test handed it, so the
 * real SQL was never exercised: `getVoteTallies` (groupBy(positionId, nomineeId)
 * + count(*)::int) and `getVoterCount` (count(DISTINCT voter_id)::int with the
 * `?? 0` guard). This slice drives 8 real ballots into the scratch schema and
 * asserts the aggregated INTEGERS Postgres computes — proving the GROUP BY bins
 * by (position, nominee) and that DISTINCT actually dedups a voter who votes in
 * two positions, plus the empty-election guards.
 */
const EMPTY_ELECTION_UUID = '00000000-0000-4000-8000-0000000000ee';

describe('ElectionsRepository — vote tallies + voter count (B4 S3)', () => {
  test('getVoteTallies groups by (position,nominee) with real count(*)::int; getVoterCount is count(DISTINCT voter_id)', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const positionId = await seedPosition(orgId);

    const election = await repo.create({
      organizationId: orgId, title: 'Tally Election', type: 'officer',
      status: 'votingOpen', votingMode: 'online',
    } as never);

    const candidateA = await seedPerson();
    const candidateB = await seedPerson();
    const nomineeA = await repo.addNominee({
      electionId: election.id, positionId, personId: candidateA,
      nominatedBy: candidateA, organizationId: orgId,
    });
    const nomineeB = await repo.addNominee({
      electionId: election.id, positionId, personId: candidateB,
      nominatedBy: candidateB, organizationId: orgId,
    });

    // 5 votes for A + 3 votes for B across 8 DISTINCT seeded voters.
    const allVoters: string[] = [];
    for (let i = 0; i < 5; i++) {
      const voterId = await seedPerson();
      allVoters.push(voterId);
      await repo.castVote({
        electionId: election.id, positionId, nomineeId: nomineeA.id, voterId, organizationId: orgId,
      });
    }
    for (let i = 0; i < 3; i++) {
      const voterId = await seedPerson();
      allVoters.push(voterId);
      await repo.castVote({
        electionId: election.id, positionId, nomineeId: nomineeB.id, voterId, organizationId: orgId,
      });
    }

    // Tallies: exactly 2 grouped rows, with the real aggregated integers.
    const tallies = await repo.getVoteTallies(election.id);
    expect(tallies).toHaveLength(2);
    const tallyA = tallies.find((t) => t.nomineeId === nomineeA.id);
    const tallyB = tallies.find((t) => t.nomineeId === nomineeB.id);
    expect(tallyA?.count).toBe(5);
    expect(tallyB?.count).toBe(3);
    // count is a real integer, not a string (count(*)::int cast binds).
    expect(typeof tallyA?.count).toBe('number');
    expect(tallyA?.positionId).toBe(positionId);
    expect(tallyB?.positionId).toBe(positionId);

    // 8 distinct voters.
    expect(await repo.getVoterCount(election.id)).toBe(8);

    // A SECOND vote by an ALREADY-counted voter, for a DIFFERENT position — allowed
    // (election_vote_unique is per (election, voter, position)). DISTINCT must dedup
    // the voter so getVoterCount STAYS 8, while the tally row set grows by one.
    const positionTwo = await seedPosition(orgId);
    const nomineeC = await repo.addNominee({
      electionId: election.id, positionId: positionTwo, personId: candidateA,
      nominatedBy: candidateA, organizationId: orgId,
    });
    await repo.castVote({
      electionId: election.id, positionId: positionTwo, nomineeId: nomineeC.id,
      voterId: allVoters[0]!, organizationId: orgId,
    });

    // Still 8 — count(DISTINCT voter_id) dedups the repeat voter.
    expect(await repo.getVoterCount(election.id)).toBe(8);
    // But the tally row set grew: the new (positionTwo, nomineeC) bin appears.
    const talliesAfter = await repo.getVoteTallies(election.id);
    expect(talliesAfter).toHaveLength(3);
    const newBin = talliesAfter.find((t) => t.nomineeId === nomineeC.id);
    expect(newBin?.count).toBe(1);
    expect(newBin?.positionId).toBe(positionTwo);
  });

  test('empty election: getVoteTallies returns []; getVoterCount returns 0 (?? 0 guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new ElectionsRepository(H.db as never);

    const tallies = await repo.getVoteTallies(EMPTY_ELECTION_UUID);
    expect(tallies).toEqual([]);

    const count = await repo.getVoterCount(EMPTY_ELECTION_UUID);
    expect(count).toBe(0);
  });
});
