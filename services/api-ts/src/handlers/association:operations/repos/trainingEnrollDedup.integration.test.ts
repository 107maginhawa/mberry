/**
 * AHA Step 27 — dup-enroll deploy preflight (real-Postgres).
 *
 * Migration 0068 adds a PARTIAL UNIQUE index `uq_training_enroll_active` on
 * `training_enrollment(training_id, person_id) WHERE status <> 'cancelled'`.
 * Its own header warns: if a target DB already holds duplicate ACTIVE
 * enrollments for the same (training_id, person_id), `CREATE UNIQUE INDEX`
 * fails and the migrator crashes on boot. The fix is an idempotent de-dup
 * preflight that runs BEFORE the index in the same migration.
 *
 * This suite proves the hazard is real and the fix removes it, by executing the
 * EXACT statements from 0068 against a real engine in a scratch schema:
 *   1. HAZARD: with two non-cancelled rows for one (training_id, person_id),
 *      `CREATE UNIQUE INDEX … WHERE status <> 'cancelled'` FAILS.
 *   2. PREFLIGHT: the migration's de-dup UPDATE soft-cancels the loser rows by
 *      the pinned priority (completed > enrolled > noShow; then earliest
 *      enrolled_at; then smallest id) — winner survives non-cancelled, losers
 *      get status='cancelled' + cancelled_at set, nothing is DELETEd.
 *   3. The index then CREATES successfully.
 *   4. IDEMPOTENCY: re-running the preflight cancels nothing further.
 *
 * The preflight + index SQL are read from the migration FILE (the source of
 * truth the drizzle migrator applies), so this test can never drift from what
 * actually ships. drizzle-kit generate is unavailable here; 0068 is the
 * hand-authored, idempotent exception.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If
 * unreachable, the suite skips with a documented message rather than failing
 * for an environment reason.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

// Unique scratch schema so we never touch real data and can run in parallel.
const TEST_SCHEMA = `aha_step27_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const T1 = '00000000-0000-4000-8000-0000000000a1';
const P1 = '00000000-0000-4000-8000-0000000000b1';
const P2 = '00000000-0000-4000-8000-0000000000b2';

// ── Extract the real statements 0068 ships ──────────────────────────────────
const MIGRATION_SQL = readFileSync(
  join(import.meta.dir, '../../../generated/migrations/0068_training_enroll_unique_active.sql'),
  'utf8',
);
/** Strip `-- …` line comments, split into statements on `;`. */
const STATEMENTS = MIGRATION_SQL.replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const PREFLIGHT_SQL = STATEMENTS.find(
  (s) => /^UPDATE/i.test(s) && /training_enrollment/i.test(s),
);
const CREATE_INDEX_SQL = STATEMENTS.find((s) => /CREATE\s+UNIQUE\s+INDEX/i.test(s));

let pool: Pool;
let dbReachable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  pool.on('connect', (c) => {
    c.query(`SET search_path TO "${TEST_SCHEMA}", public`);
  });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
      // Scratch table mirroring the columns 0068's preflight + index touch.
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".training_enrollment (
          id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          training_id     uuid NOT NULL,
          person_id       uuid NOT NULL,
          status          text NOT NULL,
          enrolled_at     timestamptz NOT NULL DEFAULT now(),
          completed_at    timestamptz,
          cancelled_at    timestamptz
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
      `[AHA Step 27 integration] Postgres unreachable at ${DB_URL}; skipping. ${(err as Error).message}`,
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

/** Truncate + seed the duplicate-active fixture, returning the seeded ids. */
async function seedDuplicates(client: import('pg').PoolClient) {
  await client.query(`TRUNCATE "${TEST_SCHEMA}".training_enrollment`);
  // Group 1 (T1, P1): completed must beat enrolled.
  const g1completed = (
    await client.query(
      `INSERT INTO training_enrollment (organization_id, training_id, person_id, status, enrolled_at, completed_at)
       VALUES ($1,$2,$3,'completed', now() - interval '5 days', now() - interval '1 day') RETURNING id`,
      [ORG_ID, T1, P1],
    )
  ).rows[0].id as string;
  const g1enrolled = (
    await client.query(
      `INSERT INTO training_enrollment (organization_id, training_id, person_id, status, enrolled_at)
       VALUES ($1,$2,$3,'enrolled', now() - interval '2 days') RETURNING id`,
      [ORG_ID, T1, P1],
    )
  ).rows[0].id as string;
  // Group 2 (T1, P2): earliest enrolled wins; later enrolled + noShow lose.
  const g2early = (
    await client.query(
      `INSERT INTO training_enrollment (organization_id, training_id, person_id, status, enrolled_at)
       VALUES ($1,$2,$3,'enrolled', now() - interval '9 days') RETURNING id`,
      [ORG_ID, T1, P2],
    )
  ).rows[0].id as string;
  const g2late = (
    await client.query(
      `INSERT INTO training_enrollment (organization_id, training_id, person_id, status, enrolled_at)
       VALUES ($1,$2,$3,'enrolled', now() - interval '3 days') RETURNING id`,
      [ORG_ID, T1, P2],
    )
  ).rows[0].id as string;
  const g2noShow = (
    await client.query(
      `INSERT INTO training_enrollment (organization_id, training_id, person_id, status, enrolled_at)
       VALUES ($1,$2,$3,'noShow', now() - interval '1 day') RETURNING id`,
      [ORG_ID, T1, P2],
    )
  ).rows[0].id as string;
  return { g1completed, g1enrolled, g2early, g2late, g2noShow };
}

const row = async (client: import('pg').PoolClient, id: string) =>
  (
    await client.query(
      `SELECT status, cancelled_at FROM training_enrollment WHERE id = $1`,
      [id],
    )
  ).rows[0] as { status: string; cancelled_at: string | null };

const activeCount = async (client: import('pg').PoolClient) =>
  (
    await client.query(
      `SELECT count(*)::int AS n FROM training_enrollment WHERE status <> 'cancelled'`,
    )
  ).rows[0].n as number;

describe('AHA Step 27 — dup-enroll deploy preflight (real-PG)', () => {
  test('migration 0068 ships an idempotent de-dup preflight UPDATE before the index', () => {
    // Drift/RED guard: pre-fix the migration has no preflight, so this fails.
    expect(PREFLIGHT_SQL).toBeDefined();
    expect(CREATE_INDEX_SQL).toBeDefined();
    // Ordering is the whole safety property: the preflight statement must
    // precede the index statement. Compare positions in the comment-stripped
    // STATEMENTS list so header prose ("CREATE UNIQUE INDEX would fail") cannot
    // be mistaken for the executable statement.
    const preflightPos = STATEMENTS.indexOf(PREFLIGHT_SQL as string);
    const indexPos = STATEMENTS.indexOf(CREATE_INDEX_SQL as string);
    expect(preflightPos).toBeGreaterThanOrEqual(0);
    expect(indexPos).toBeGreaterThan(preflightPos);
  });

  test('HAZARD → PREFLIGHT → index creates; winners survive, losers soft-cancelled', async () => {
    if (!dbReachable) return; // documented environment skip
    if (!PREFLIGHT_SQL || !CREATE_INDEX_SQL) return; // covered by the drift test above

    const client = await pool.connect();
    try {
      const ids = await seedDuplicates(client);

      // ── 1. HAZARD: index creation FAILS on duplicate active rows ──
      let indexFailedFirst = false;
      try {
        await client.query(CREATE_INDEX_SQL);
      } catch {
        indexFailedFirst = true;
      }
      expect(indexFailedFirst).toBe(true);

      // ── 2. PREFLIGHT: soft-cancel losers by the pinned priority ──
      await client.query(PREFLIGHT_SQL);

      // Group 1: completed winner survives; enrolled loser cancelled w/ timestamp.
      expect((await row(client, ids.g1completed)).status).toBe('completed');
      const g1loser = await row(client, ids.g1enrolled);
      expect(g1loser.status).toBe('cancelled');
      expect(g1loser.cancelled_at).not.toBeNull();

      // Group 2: earliest enrolled survives; later enrolled + noShow cancelled.
      expect((await row(client, ids.g2early)).status).toBe('enrolled');
      expect((await row(client, ids.g2late)).status).toBe('cancelled');
      expect((await row(client, ids.g2noShow)).status).toBe('cancelled');

      // Exactly one active row per group remains (2 groups → 2 active).
      expect(await activeCount(client)).toBe(2);

      // No row was DELETEd — all five seeded rows still exist.
      expect(
        (await client.query(`SELECT count(*)::int AS n FROM training_enrollment`)).rows[0].n,
      ).toBe(5);

      // ── 3. Index now creates successfully on de-duped data ──
      await client.query(CREATE_INDEX_SQL);
      const idxPresent = (
        await client.query(
          `SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = 'uq_training_enroll_active'`,
          [TEST_SCHEMA],
        )
      ).rowCount;
      expect(idxPresent).toBe(1);

      // ── 4. IDEMPOTENCY: re-running the preflight cancels nothing further ──
      const before = await activeCount(client);
      await client.query(PREFLIGHT_SQL);
      expect(await activeCount(client)).toBe(before);
      // Winners are untouched on the second pass.
      expect((await row(client, ids.g1completed)).status).toBe('completed');
      expect((await row(client, ids.g2early)).status).toBe('enrolled');
    } finally {
      client.release();
    }
  });
});
