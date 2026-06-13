/**
 * Batch F (R-5 / FIX-007 schema side) — `resigned_at` additive migration +
 * backfill real-schema integration test.
 *
 * The unit-test layer for this module is mock-only (stubRepo / fake DBs) and
 * cannot prove a DDL migration applied or that a data backfill is correct —
 * a mock never touches a real `membership` table. This test connects to a real
 * Postgres instance and asserts two things the migration must deliver:
 *
 *   Part A — against the REAL `public.membership` table: the additive
 *            `resigned_at` column exists and is nullable (proves the
 *            generated migration applied; RED before it does).
 *   Part B — against an isolated scratch schema: the backfill SQL
 *            (`UPDATE ... SET resigned_at = removed_at WHERE status='resigned'
 *            AND resigned_at IS NULL`) populates pre-migration resigned rows
 *            from `removed_at`, leaves non-resigned rows untouched, and is a
 *            no-op for resigned rows that never had a removed_at.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If
 * unreachable, the suite skips with a documented message rather than failing
 * for an environment reason.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

// Unique scratch schema so we never touch real data and can run in parallel.
const TEST_SCHEMA = `aha_batchf_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// The exact backfill the migration ships. Kept here as the single source of
// truth the test exercises against a real engine.
const BACKFILL_SQL = (schema: string) =>
  `UPDATE "${schema}".membership
     SET resigned_at = removed_at
   WHERE status = 'resigned' AND resigned_at IS NULL`;

let pool: Pool;
let dbReachable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
      // Scratch table mirrors the post-migration membership shape for the
      // columns the backfill touches.
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".membership (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          status        text NOT NULL,
          removed_at    timestamptz,
          resigned_at   timestamptz
        )
      `);
      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(
      `[Batch F integration] Postgres unreachable at ${DB_URL}; skipping. ${(err as Error).message}`,
    );
  }
});

afterAll(async () => {
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

describe('Batch F — resigned_at migration (real-schema)', () => {
  // ── Part A: the migration applied the additive column to the real table ──
  test('public.membership has a nullable resigned_at column', async () => {
    if (!dbReachable) return; // documented environment skip

    const res = await pool.query(
      `SELECT data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'membership'
          AND column_name = 'resigned_at'`,
    );

    // RED before the migration is applied: zero rows. GREEN after: exactly one.
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].data_type).toContain('timestamp');
    expect(res.rows[0].is_nullable).toBe('YES');
  });

  // ── Part B: the backfill SQL is correct against a real engine ──
  test('backfill copies removed_at into resigned_at for resigned rows only', async () => {
    if (!dbReachable) return;

    const removedTs = '2025-06-01T00:00:00.000Z';
    const otherTs = '2025-07-15T00:00:00.000Z';

    // 1) resigned row that carries a removed_at (the pre-fix resign handler set
    //    removed_at + status='resigned') → must be backfilled.
    const a = await pool.query(
      `INSERT INTO "${TEST_SCHEMA}".membership (status, removed_at, resigned_at)
       VALUES ('resigned', $1, NULL) RETURNING id`,
      [removedTs],
    );
    // 2) a removed (not resigned) row → must NOT be touched.
    const b = await pool.query(
      `INSERT INTO "${TEST_SCHEMA}".membership (status, removed_at, resigned_at)
       VALUES ('removed', $1, NULL) RETURNING id`,
      [otherTs],
    );
    // 3) a resigned row with no removed_at → backfill is a no-op (stays NULL).
    const c = await pool.query(
      `INSERT INTO "${TEST_SCHEMA}".membership (status, removed_at, resigned_at)
       VALUES ('resigned', NULL, NULL) RETURNING id`,
    );

    await pool.query(BACKFILL_SQL(TEST_SCHEMA));

    const after = async (id: string) =>
      (await pool.query(`SELECT removed_at, resigned_at FROM "${TEST_SCHEMA}".membership WHERE id = $1`, [id]))
        .rows[0];

    const rowA = await after(a.rows[0].id);
    const rowB = await after(b.rows[0].id);
    const rowC = await after(c.rows[0].id);

    // resigned + removed_at → resigned_at now equals removed_at
    expect(rowA.resigned_at).not.toBeNull();
    expect(new Date(rowA.resigned_at).getTime()).toBe(new Date(rowA.removed_at).getTime());
    // removed (non-resigned) → untouched
    expect(rowB.resigned_at).toBeNull();
    // resigned with no removed_at → stays NULL
    expect(rowC.resigned_at).toBeNull();
  });

  test('backfill is idempotent (re-running does not change populated rows)', async () => {
    if (!dbReachable) return;

    const ts = '2025-03-03T00:00:00.000Z';
    const ins = await pool.query(
      `INSERT INTO "${TEST_SCHEMA}".membership (status, removed_at, resigned_at)
       VALUES ('resigned', $1, NULL) RETURNING id`,
      [ts],
    );
    const id = ins.rows[0].id as string;

    await pool.query(BACKFILL_SQL(TEST_SCHEMA));
    const first = (await pool.query(`SELECT resigned_at FROM "${TEST_SCHEMA}".membership WHERE id = $1`, [id])).rows[0];
    await pool.query(BACKFILL_SQL(TEST_SCHEMA));
    const second = (await pool.query(`SELECT resigned_at FROM "${TEST_SCHEMA}".membership WHERE id = $1`, [id])).rows[0];

    expect(first.resigned_at).not.toBeNull();
    expect(new Date(second.resigned_at).getTime()).toBe(new Date(first.resigned_at).getTime());
  });
});
