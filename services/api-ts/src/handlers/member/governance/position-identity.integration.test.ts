/**
 * AHA FIX-002 (G2) — Real-DB position-identity integration test.
 *
 * The G2 fork: `election.positions` is a jsonb array of `{ id, title, sortOrder }`
 * slots, while `election_nominee.position_id` / `election_vote.position_id` carry a
 * REAL foreign key to the canonical `position` table
 * (`election_nominee_position_id_position_id_fk`).
 *
 * Before the fix, `createElection` minted `crypto.randomUUID()` for every slot id.
 * Those ids exist in NO `position` row, so the moment the UI nominates a candidate
 * using a slot id as `positionId`, the insert violates the FK (runtime 5xx) — the
 * P0. The mock-only unit tests never caught it because they hand back self-consistent
 * fake ids; the FIX-007 lifecycle test side-stepped `createElection` by inserting a
 * real position id directly into the slot.
 *
 * This test drives the REAL `createElection` handler against real Postgres rows and
 * proves the canonical-identity decision (Step 29): every slot id is a real
 * `position` row, so a nominee insert through the real FK SUCCEEDS.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If unreachable,
 * the suite skips with a clear message rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createElection } from './createElection';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `aha_fix002_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let pool: Pool;
let dbReachable = false;

const PRESIDENT_ID = '00000000-0000-4000-8000-0000000000a1';

const officerTerm = {
  id: '00000000-0000-4000-8000-0000000000aa',
  positionId: 'pos-president',
  personId: PRESIDENT_ID,
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

      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".person (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid()
        )
      `);

      const baseCols = `
          version integer NOT NULL DEFAULT 1,
          created_by uuid,
          updated_by uuid,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()`;

      // Canonical position table — the FK target at the heart of G2.
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

      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[FIX-002 integration] Postgres unreachable, skipping: ${(err as Error).message}`);
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

describe('election position identity — real-DB (FIX-002 / G2)', () => {
  test('createElection slot ids are real position rows; nominee insert survives the FK', async () => {
    if (!dbReachable) return; // documented environment skip

    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [officerTerm],
    });

    const { db, scopedPool } = makeScopedDb();
    try {
      const orgId = (await scopedPool.query(`SELECT gen_random_uuid() AS id`)).rows[0].id as string;
      const personId = (
        await scopedPool.query(`INSERT INTO "${TEST_SCHEMA}".person DEFAULT VALUES RETURNING id`)
      ).rows[0].id as string;

      const ctx = makeCtx({
        user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
        organizationId: orgId,
        database: db,
        _body: {
          title: '2026 Officers Election',
          type: 'officer',
          votingMode: 'online',
          positions: ['President', 'Treasurer'],
        },
      });

      const response: any = await createElection(ctx);
      expect(response.status).toBe(201);

      const slots: Array<{ id: string; title: string; sortOrder: number }> =
        response.body.positions;
      expect(slots.length).toBe(2);

      // Every slot id must resolve to a REAL position row (canonical identity).
      for (const slot of slots) {
        const found = await scopedPool.query(
          `SELECT id, title FROM "${TEST_SCHEMA}".position WHERE id = $1`,
          [slot.id],
        );
        expect(found.rows.length).toBe(1);
        expect(found.rows[0].title).toBe(slot.title);
      }

      // The actual P0 probe: a nominee insert keyed by a slot id must NOT violate
      // election_nominee_position_id_position_id_fk. Before the fix the slot id is a
      // random UUID absent from `position`, so this throws (RED).
      const presidentSlot = slots.find((s) => s.title === 'President')!;
      const electionId = response.body.id as string;
      await scopedPool.query(
        `INSERT INTO "${TEST_SCHEMA}".election_nominee
           (organization_id, election_id, position_id, person_id, nominated_by)
         VALUES ($1, $2, $3, $4, $4)`,
        [orgId, electionId, presidentSlot.id, personId],
      );
      const nominees = await scopedPool.query(
        `SELECT id FROM "${TEST_SCHEMA}".election_nominee WHERE election_id = $1`,
        [electionId],
      );
      expect(nominees.rows.length).toBe(1);
    } finally {
      await scopedPool.end();
    }
  });

  test('repeated titles across elections reuse the same canonical position row', async () => {
    if (!dbReachable) return;

    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [officerTerm],
    });

    const { db, scopedPool } = makeScopedDb();
    try {
      const orgId = (await scopedPool.query(`SELECT gen_random_uuid() AS id`)).rows[0].id as string;

      async function create(title: string) {
        const ctx = makeCtx({
          user: { id: PRESIDENT_ID, role: 'user', twoFactorEnabled: true },
          organizationId: orgId,
          database: db,
          _body: { title, type: 'officer', votingMode: 'online', positions: ['President'] },
        });
        const res: any = await createElection(ctx);
        return res.body.positions[0].id as string;
      }

      const firstId = await create('Election A');
      const secondId = await create('Election B');

      // Same title in the same org → one canonical position, not two.
      expect(secondId).toBe(firstId);
      const count = await scopedPool.query(
        `SELECT count(*)::int AS n FROM "${TEST_SCHEMA}".position WHERE organization_id = $1`,
        [orgId],
      );
      expect(count.rows[0].n).toBe(1);
    } finally {
      await scopedPool.end();
    }
  });
});
