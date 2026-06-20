/**
 * AHA FIX-007 — Real-DB election lifecycle integration test.
 *
 * The governance unit tests are mock-only (stubRepo). A mock repo returns
 * whatever rows the test hands it, so it CANNOT prove that:
 *   1. the close-voting transition actually persists `awaitingConfirmation`
 *      on a real `election` row (FIX-001 / G1), nor
 *   2. that nominee/vote inserts survive the real FK to `position`
 *      (`election_nominee_position_id_position_id_fk`) — the G2 fork.
 *
 * This test stands up an isolated scratch schema mirroring the ACTUAL columns
 * of elections.schema.ts + the real `position` FK target, drives an election
 * through the lifecycle against real Postgres rows, and runs the real
 * `closeElectionVoting` handler so the `votingOpen → awaitingConfirmation`
 * transition is proven end-to-end (the state that `certifyElection` requires).
 *
 * Scope note (Batch A / FIX-001): the officer-term authorization is exercised
 * by the unit test; here `OfficerTermRepository` is stubbed to a President so
 * the focus stays on lifecycle persistence. The handler itself reads/writes
 * the election through `ElectionsRepository` against the real `db`.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If
 * unreachable, the suite skips with a clear message rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { closeElectionVoting } from './closeElectionVoting';
import { createElection } from './createElection';
import { openElectionVoting } from './openElectionVoting';
import { castBallot } from './castBallot';
import { fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `aha_fix007_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let pool: Pool;
let dbReachable = false;

const officerTerm = {
  id: '00000000-0000-4000-8000-0000000000aa',
  positionId: 'pos-president',
  personId: 'user-1',
  organizationId: 'org-1',
  status: 'active',
  startDate: new Date('2025-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  positionTitle: 'President',
};

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
      await client.query(`SET search_path TO "${TEST_SCHEMA}", public`);

      // Minimal person table (FK target for nominee/vote).
      // first_name/last_name mirror the real person schema: listNominees
      // (ISSUE-031) leftJoins person and selects these to render candidate names.
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".person (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          first_name varchar(50),
          last_name varchar(50)
        )
      `);

      // baseEntityFields columns shared by every entity table: version +
      // created_by/updated_by are referenced by the repo inserts/updates, so
      // the scratch tables must mirror them or the insert throws.
      const baseCols = `
          version integer NOT NULL DEFAULT 1,
          created_by uuid,
          updated_by uuid,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()`;

      // Real position table (the FK target at the heart of the G2 fork).
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".position (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          title varchar(200) NOT NULL,
          description text,
          level text NOT NULL DEFAULT 'national',
          term_length_months integer NOT NULL DEFAULT 12,
          max_terms integer,
          sort_order integer DEFAULT 0,${baseCols}
        )
      `);

      // election + nominee + vote tables mirroring the real columns.
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".election (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          title varchar(200) NOT NULL,
          type text NOT NULL DEFAULT 'officer',
          status text NOT NULL DEFAULT 'draft',
          voting_mode text NOT NULL DEFAULT 'online',
          nominations_open_at timestamptz,
          nominations_close_at timestamptz,
          voting_open_at timestamptz,
          voting_close_at timestamptz,
          passage_threshold integer,
          positions jsonb,
          published_at timestamptz,${baseCols}
        )
      `);

      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".election_nominee (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          election_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".election(id) ON DELETE CASCADE,
          position_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".position(id),
          person_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".person(id),
          nominated_by uuid REFERENCES "${TEST_SCHEMA}".person(id),
          status text NOT NULL DEFAULT 'nominated',${baseCols}
        )
      `);

      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".election_vote (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          election_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".election(id) ON DELETE CASCADE,
          position_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".position(id),
          nominee_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".election_nominee(id),
          voter_id uuid NOT NULL REFERENCES "${TEST_SCHEMA}".person(id),${baseCols}
        )
      `);

      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[FIX-007 integration] Postgres unreachable, skipping: ${(err as Error).message}`);
  }
});

afterAll(async () => {
  restoreRepo(OfficerTermRepository);
  if (pool) {
    try {
      if (dbReachable) {
        const client = await pool.connect();
        try {
          await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
        } finally {
          client.release();
        }
      }
    } finally {
      await pool.end();
    }
  }
});

/** drizzle instance pinned to the scratch schema on every connection. */
function makeScopedDb() {
  const scopedPool = new Pool({ connectionString: DB_URL });
  scopedPool.on('connect', (c) => {
    c.query(`SET search_path TO "${TEST_SCHEMA}", public`);
  });
  const db = drizzle(scopedPool);
  return { db, scopedPool };
}

describe('election lifecycle — real-DB (FIX-007 / FIX-001)', () => {
  test('closeElectionVoting moves a real votingOpen election to awaitingConfirmation', async () => {
    if (!dbReachable) return; // documented environment skip

    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [officerTerm],
    });

    const { db, scopedPool } = makeScopedDb();
    try {
      const repo = new ElectionsRepository(db as any);

      // Seed person + position (real FK targets).
      const personRes = await scopedPool.query(`INSERT INTO "${TEST_SCHEMA}".person DEFAULT VALUES RETURNING id`);
      const personId = personRes.rows[0].id as string;
      const posRes = await scopedPool.query(
        `INSERT INTO "${TEST_SCHEMA}".position (organization_id, title) VALUES (gen_random_uuid(), 'President') RETURNING id`,
      );
      const positionId = posRes.rows[0].id as string;

      // Create election already at votingOpen with a position slot.
      const election = await repo.create({
        organizationId: personId, // any uuid; org scoping not asserted here
        title: '2026 Lifecycle Election',
        type: 'officer',
        status: 'votingOpen',
        votingMode: 'online',
        votingOpenAt: new Date(),
        positions: [{ id: positionId, title: 'President', sortOrder: 0 }],
      } as any);

      // Nominee + vote insert must survive the REAL FK to position (G2 probe).
      const nominee = await repo.addNominee({
        electionId: election.id,
        positionId,
        personId,
        nominatedBy: personId,
        organizationId: election.organizationId,
      });
      await repo.castVote({
        electionId: election.id,
        positionId,
        nomineeId: nominee.id,
        voterId: personId,
        organizationId: election.organizationId,
      });

      // Run the REAL handler against the REAL db.
      const ctx = makeCtx({
        _params: { electionId: election.id },
        database: db,
        organizationId: election.organizationId,
      });
      const response = await closeElectionVoting(ctx);
      expect(response.status).toBe(200);

      // Stored row was actually transitioned in Postgres.
      const after = await scopedPool.query(
        `SELECT status, voting_close_at FROM "${TEST_SCHEMA}".election WHERE id = $1`,
        [election.id],
      );
      expect(after.rows[0].status).toBe('awaitingConfirmation');
      expect(after.rows[0].voting_close_at).not.toBeNull();
    } finally {
      await scopedPool.end();
    }
  });

  test('closeElectionVoting rejects a real draft election (no transition persisted)', async () => {
    if (!dbReachable) return;

    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [officerTerm],
    });

    const { db, scopedPool } = makeScopedDb();
    try {
      const repo = new ElectionsRepository(db as any);
      const election = await repo.create({
        organizationId: '00000000-0000-4000-8000-0000000000bb',
        title: 'Draft Election',
        type: 'officer',
        status: 'draft',
        votingMode: 'online',
      } as any);

      const ctx = makeCtx({
        _params: { electionId: election.id },
        database: db,
        organizationId: election.organizationId,
      });
      await expect(closeElectionVoting(ctx)).rejects.toThrow();

      const after = await scopedPool.query(
        `SELECT status FROM "${TEST_SCHEMA}".election WHERE id = $1`,
        [election.id],
      );
      // Unchanged — invalid transition must not mutate the row.
      expect(after.rows[0].status).toBe('draft');
    } finally {
      await scopedPool.end();
    }
  });

  /**
   * AHA Step 35 — regression coverage closing the FIX-007 gap.
   *
   * The two tests above stop short of the voting-phase transition handlers, and
   * `position-identity.integration.test.ts` stops at the nominee insert. NEITHER
   * drives the REAL `openElectionVoting` / `castBallot` handlers, so the canonical
   * position identity (Step 29 / FIX-002) was never proven through the full voting
   * path against real Postgres rows. This walks
   *   createElection → openElectionVoting → castBallot → closeElectionVoting
   * with the REAL handlers and canonical position ids, proving the FK holds and the
   * min-candidate guard groups by the real position id end-to-end. It stops before
   * `certifyElection` on purpose — the published winner→officer-roster cascade is
   * Batch C / FIX-011 territory and out of this scope.
   *
   * NOTE: this is GREEN-on-correct-code regression coverage, not a RED→GREEN fix —
   * FIX-002 already shipped in Step 29 (its RED proof lives in
   * `position-identity.integration.test.ts`). No production code changes here.
   */
  test('full voting path via real handlers: create → openVoting → castBallot → closeVoting (canonical position identity)', async () => {
    if (!dbReachable) return; // documented environment skip

    const PRESIDENT_ID = '00000000-0000-4000-8000-0000000000c1';
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ ...officerTerm, personId: PRESIDENT_ID }],
    });

    const { db, scopedPool } = makeScopedDb();
    try {
      const orgId = (await scopedPool.query(`SELECT gen_random_uuid() AS id`)).rows[0].id as string;
      const cand1 = (
        await scopedPool.query(`INSERT INTO "${TEST_SCHEMA}".person DEFAULT VALUES RETURNING id`)
      ).rows[0].id as string;
      const cand2 = (
        await scopedPool.query(`INSERT INTO "${TEST_SCHEMA}".person DEFAULT VALUES RETURNING id`)
      ).rows[0].id as string;
      const voter = (
        await scopedPool.query(`INSERT INTO "${TEST_SCHEMA}".person DEFAULT VALUES RETURNING id`)
      ).rows[0].id as string;

      // 1. REAL createElection → every slot id is a real `position` row (canonical identity).
      const createCtx = makeCtx({
        user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
        organizationId: orgId,
        database: db,
        _body: {
          title: 'Full-Path Election',
          type: 'officer',
          votingMode: 'online',
          positions: ['President'],
        },
      });
      const createRes: any = await createElection(createCtx);
      expect(createRes.status).toBe(201);
      const electionId = createRes.body.id as string;
      const slots: Array<{ id: string; title: string }> = createRes.body.positions;
      const presidentPositionId = slots.find((s) => s.title === 'President')!.id;
      // Slot id must be a real position row (the FK target).
      const posCheck = await scopedPool.query(
        `SELECT id FROM "${TEST_SCHEMA}".position WHERE id = $1`,
        [presidentPositionId],
      );
      expect(posCheck.rows.length).toBe(1);

      // Election is created as draft; advance to nominationsOpen (that transition is
      // not the subject of this test — the open/close/vote handlers are).
      await scopedPool.query(
        `UPDATE "${TEST_SCHEMA}".election SET status = 'nominationsOpen' WHERE id = $1`,
        [electionId],
      );

      // Two REAL nominees keyed by the canonical position id (min-candidate guard needs >= 2).
      const repo = new ElectionsRepository(db as any);
      const nom1 = await repo.addNominee({
        electionId,
        positionId: presidentPositionId,
        personId: cand1,
        nominatedBy: cand1,
        organizationId: orgId,
      });
      await repo.addNominee({
        electionId,
        positionId: presidentPositionId,
        personId: cand2,
        nominatedBy: cand2,
        organizationId: orgId,
      });

      // 2. REAL openElectionVoting → groups nominees by the canonical position id; guard passes.
      const openCtx = makeCtx({
        _params: { electionId },
        database: db,
        organizationId: orgId,
        user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
      });
      const openRes: any = await openElectionVoting(openCtx);
      expect(openRes.status).toBe(200);
      const afterOpen = await scopedPool.query(
        `SELECT status FROM "${TEST_SCHEMA}".election WHERE id = $1`,
        [electionId],
      );
      expect(afterOpen.rows[0].status).toBe('votingOpen');

      // 3. REAL castBallot → the vote insert survives the real election_vote → position FK.
      restoreRepo(MembershipRepository);
      stubRepo(MembershipRepository, {
        findByPersonAndOrg: async () => createFakeMembership({ personId: voter }),
      });
      const voteCtx = makeCtx({
        user: { id: voter, role: 'user', twoFactorEnabled: false },
        organizationId: orgId,
        database: db,
        _body: { electionId, positionId: presidentPositionId, candidateId: nom1.id },
      });
      const voteRes: any = await castBallot(voteCtx);
      expect(voteRes.status).toBe(201);
      const votes = await scopedPool.query(
        `SELECT id, position_id FROM "${TEST_SCHEMA}".election_vote WHERE election_id = $1`,
        [electionId],
      );
      expect(votes.rows.length).toBe(1);
      expect(votes.rows[0].position_id).toBe(presidentPositionId);

      // 4. REAL closeElectionVoting → votingOpen → awaitingConfirmation (ready for certify).
      const closeCtx = makeCtx({
        _params: { electionId },
        database: db,
        organizationId: orgId,
        user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
      });
      const closeRes: any = await closeElectionVoting(closeCtx);
      expect(closeRes.status).toBe(200);
      const afterClose = await scopedPool.query(
        `SELECT status FROM "${TEST_SCHEMA}".election WHERE id = $1`,
        [electionId],
      );
      expect(afterClose.rows[0].status).toBe('awaitingConfirmation');
    } finally {
      restoreRepo(MembershipRepository);
      await scopedPool.end();
    }
  });

  test('openElectionVoting rejects a position with < 2 canonical-id nominees (BR-33 min-candidate guard)', async () => {
    if (!dbReachable) return;

    const PRESIDENT_ID = '00000000-0000-4000-8000-0000000000c2';
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ ...officerTerm, personId: PRESIDENT_ID }],
    });

    const { db, scopedPool } = makeScopedDb();
    try {
      const orgId = (await scopedPool.query(`SELECT gen_random_uuid() AS id`)).rows[0].id as string;
      const cand1 = (
        await scopedPool.query(`INSERT INTO "${TEST_SCHEMA}".person DEFAULT VALUES RETURNING id`)
      ).rows[0].id as string;

      const createCtx = makeCtx({
        user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
        organizationId: orgId,
        database: db,
        _body: {
          title: 'Under-nominated Election',
          type: 'officer',
          votingMode: 'online',
          positions: ['President'],
        },
      });
      const createRes: any = await createElection(createCtx);
      const electionId = createRes.body.id as string;
      const presidentPositionId = (
        createRes.body.positions as Array<{ id: string; title: string }>
      ).find((s) => s.title === 'President')!.id;

      await scopedPool.query(
        `UPDATE "${TEST_SCHEMA}".election SET status = 'nominationsOpen' WHERE id = $1`,
        [electionId],
      );

      // Only ONE nominee for the position — below the BR-33 minimum of 2.
      const repo = new ElectionsRepository(db as any);
      await repo.addNominee({
        electionId,
        positionId: presidentPositionId,
        personId: cand1,
        nominatedBy: cand1,
        organizationId: orgId,
      });

      const openCtx = makeCtx({
        _params: { electionId },
        database: db,
        organizationId: orgId,
        user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
      });
      // Guard groups by the canonical position id and finds only 1 candidate → reject.
      await expect(openElectionVoting(openCtx)).rejects.toThrow();

      const after = await scopedPool.query(
        `SELECT status FROM "${TEST_SCHEMA}".election WHERE id = $1`,
        [electionId],
      );
      // Rejected transition must not mutate the row.
      expect(after.rows[0].status).toBe('nominationsOpen');
    } finally {
      await scopedPool.end();
    }
  });
});
