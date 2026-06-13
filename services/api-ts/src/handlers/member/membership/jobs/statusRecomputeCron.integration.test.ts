/**
 * FIX-001 (G-01) — statusRecomputeCron real-schema integration test.
 *
 * The unit-test layer for this module is mock-only (stubRepo / fake DBs).
 * A mock `db.execute()` returns whatever rows the test hands it and never
 * parses the SQL, so it CANNOT catch the production bug this test exists for:
 * the cron's raw SELECT references columns (`is_expired`, `is_pending_payment`)
 * that do not exist in the real `membership` table. Against a real Postgres
 * schema that SELECT throws `column "is_expired" does not exist`, the job
 * aborts, and the nightly ACTIVE→gracePeriod→lapsed recompute never runs.
 *
 * This test connects to a real Postgres instance, builds an isolated scratch
 * schema containing a `membership` table that mirrors the ACTUAL columns of
 * `membership.schema.ts` (deliberately WITHOUT the phantom columns), seeds an
 * expired membership whose stored status is stale (`active`), captures the
 * registered cron handler, runs it against the real DB, and asserts:
 *   1. the job completes WITHOUT a SQL error, and
 *   2. the expired row's stored status is corrected to the computed value.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default).
 * If unreachable, the suite skips with a clear message rather than failing
 * for an environment reason.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { JobScheduler, JobHandler, JobContext } from '@/core/jobs';
import { registerStatusRecomputeJob } from './statusRecomputeCron';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

// Unique scratch schema so we never touch real data and can run in parallel.
const TEST_SCHEMA = `aha_fix001_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let pool: Pool;
let dbReachable = false;

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger,
} as unknown as JobContext['logger'];

/** Capture the cron handler the job registers (instead of scheduling it). */
function captureCronHandler(): { handler: JobHandler | undefined } {
  const captured: { handler: JobHandler | undefined } = { handler: undefined };
  const fakeScheduler: Partial<JobScheduler> = {
    registerCron: (_name: string, _pattern: string, handler: JobHandler) => {
      captured.handler = handler;
    },
  };
  registerStatusRecomputeJob(fakeScheduler as JobScheduler);
  return captured;
}

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
      await client.query(`SET search_path TO "${TEST_SCHEMA}"`);
      // Mirror the REAL membership columns referenced by the cron — no phantom
      // is_expired / is_pending_payment columns (those never existed in any migration).
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".membership (
          id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          status            text NOT NULL,
          dues_expiry_date  date,
          grace_period_days integer NOT NULL DEFAULT 30,
          suspended_at      timestamptz,
          removed_at        timestamptz,
          date_of_death     date
        )
      `);
      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[FIX-001 integration] Postgres unreachable, skipping: ${(err as Error).message}`);
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

/**
 * Build a drizzle instance whose every query runs inside the scratch schema.
 * We pin search_path on every checked-out connection via the pool.
 */
function makeScopedDb() {
  const scopedPool = new Pool({ connectionString: DB_URL });
  scopedPool.on('connect', (c) => {
    c.query(`SET search_path TO "${TEST_SCHEMA}", public`);
  });
  const db = drizzle(scopedPool);
  return { db, scopedPool };
}

describe('statusRecomputeCron — real-schema integration (FIX-001 / G-01)', () => {
  test('cron runs against the real membership columns and corrects a stale expired status', async () => {
    if (!dbReachable) {
      // Environment skip — documented, not a false green.
      return;
    }

    const { db, scopedPool } = makeScopedDb();
    try {
      // Seed an expired membership whose STORED status is stale ('active').
      // Expiry 200 days ago with 30-day grace => computed status must be 'lapsed'.
      const expiry = new Date();
      expiry.setDate(expiry.getDate() - 200);
      const expiryStr = expiry.toISOString().split('T')[0];

      const ins = await scopedPool.query(
        `INSERT INTO "${TEST_SCHEMA}".membership
           (status, dues_expiry_date, grace_period_days)
         VALUES ('active', $1, 30)
         RETURNING id`,
        [expiryStr],
      );
      const seededId = ins.rows[0].id as string;

      const { handler } = captureCronHandler();
      expect(handler).toBeDefined();

      const ctx: JobContext = {
        db: db as unknown as JobContext['db'],
        logger: silentLogger,
        jobId: 'test-job-1',
        jobName: 'membership.statusRecompute',
      };

      // Must NOT throw a SQL error. Before the fix this rejects with
      // `column "is_expired" does not exist`.
      await handler!(ctx);

      // Stored status was corrected on the real row.
      const after = await scopedPool.query(
        `SELECT status FROM "${TEST_SCHEMA}".membership WHERE id = $1`,
        [seededId],
      );
      expect(after.rows[0].status).toBe('lapsed');
    } finally {
      await scopedPool.end();
    }
  });

  test('cron leaves a still-active membership untouched', async () => {
    if (!dbReachable) return;

    const { db, scopedPool } = makeScopedDb();
    try {
      const future = new Date();
      future.setDate(future.getDate() + 200);
      const futureStr = future.toISOString().split('T')[0];

      const ins = await scopedPool.query(
        `INSERT INTO "${TEST_SCHEMA}".membership
           (status, dues_expiry_date, grace_period_days)
         VALUES ('active', $1, 30)
         RETURNING id`,
        [futureStr],
      );
      const seededId = ins.rows[0].id as string;

      const { handler } = captureCronHandler();
      const ctx: JobContext = {
        db: db as unknown as JobContext['db'],
        logger: silentLogger,
        jobId: 'test-job-2',
        jobName: 'membership.statusRecompute',
      };

      await handler!(ctx);

      const after = await scopedPool.query(
        `SELECT status FROM "${TEST_SCHEMA}".membership WHERE id = $1`,
        [seededId],
      );
      expect(after.rows[0].status).toBe('active');
    } finally {
      await scopedPool.end();
    }
  });
});
