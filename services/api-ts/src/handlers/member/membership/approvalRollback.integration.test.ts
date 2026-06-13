/**
 * AHA Step 26 — multi-table approval transaction rollback (real-Postgres).
 *
 * `approveMembershipApplication.ts` performs a 3-table write inside a single
 * `db.transaction(...)` (the reuse-row re-application path, membership FIX-010 /
 * decision #5):
 *
 *   1. UPDATE membership_application  → status 'approved' (+ reviewedBy/At)
 *   2. UPDATE membership              → status 'pendingPayment' (re-applied row)
 *   3. INSERT membership_status_history (the from→to transition row)
 *
 * Its inline comment states the atomicity contract explicitly: "Wrap approval +
 * membership creation in a transaction so a failed [write] doesn't leave the
 * application stuck in 'approved' with no membership record."
 *
 * The module's unit layer is mock-only (stubRepo / fake `db.transaction` that
 * just runs the callback) — a mock can never prove a REAL Postgres engine rolls
 * the earlier writes back when a later write aborts. This suite drives the exact
 * `db.transaction` primitive the handler uses against a real engine and proves
 * the contract holds. NOTE: the queued item was labelled "FIX-010 membership-
 * DELETE rollback", but there is no live membership hard-delete path — the only
 * delete handlers (`deleteMembership` / `deleteMembershipApplication`) were dead
 * orphans removed in this same pass. The genuine multi-table atomic write to
 * guard is this approval transaction; see the fix report's AHA Step 26 section.
 *
 * The existing behaviour is already correct, so the atomic cases are regression
 * guards. To keep them honest (a test that can only ever pass proves nothing),
 * a CONTROL case first demonstrates the hazard is real: the SAME three writes
 * run NON-transactionally leave partial rows when the third fails. The atomic
 * cases then prove `db.transaction` eliminates exactly that partial state.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If
 * unreachable, the suite skips with a documented message rather than failing
 * for an environment reason.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

// Unique scratch schema so we never touch real data and can run in parallel.
const TEST_SCHEMA = `aha_step26_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const OFFICER_ID = '00000000-0000-4000-8000-000000000003';

let pool: Pool;
let dbReachable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
      // Minimal scratch tables mirroring only the columns the approval
      // transaction touches. `to_status NOT NULL` on the history table is the
      // realistic mid-transaction failure point (the third write).
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".membership_application (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          status      text NOT NULL,
          reviewed_by uuid,
          reviewed_at timestamptz
        )
      `);
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".membership (
          id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id  uuid NOT NULL,
          person_id        uuid NOT NULL,
          status           text NOT NULL,
          dues_expiry_date date
        )
      `);
      await client.query(`
        CREATE TABLE "${TEST_SCHEMA}".membership_status_history (
          id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          membership_id   uuid NOT NULL,
          person_id       uuid NOT NULL,
          from_status     text,
          to_status       text NOT NULL,
          reason          text,
          changed_by      uuid,
          changed_at      timestamptz NOT NULL DEFAULT now()
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
      `[AHA Step 26 integration] Postgres unreachable at ${DB_URL}; skipping. ${(err as Error).message}`,
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

/** drizzle instance pinned to the scratch schema on every checked-out conn. */
function makeScopedDb() {
  const scopedPool = new Pool({ connectionString: DB_URL });
  scopedPool.on('connect', (c) => {
    c.query(`SET search_path TO "${TEST_SCHEMA}", public`);
  });
  const db = drizzle(scopedPool);
  return { db, scopedPool };
}

/** Seed a submitted application + a re-usable (terminal) membership row. */
async function seed(scopedPool: Pool) {
  const app = await scopedPool.query(
    `INSERT INTO membership_application (status) VALUES ('submitted') RETURNING id`,
  );
  const mem = await scopedPool.query(
    `INSERT INTO membership (organization_id, person_id, status)
     VALUES ($1, $2, 'removed') RETURNING id`,
    [ORG_ID, PERSON_ID],
  );
  return { applicationId: app.rows[0].id as string, membershipId: mem.rows[0].id as string };
}

const appStatus = async (p: Pool, id: string) =>
  (await p.query(`SELECT status FROM membership_application WHERE id = $1`, [id])).rows[0]?.status;
const memStatus = async (p: Pool, id: string) =>
  (await p.query(`SELECT status FROM membership WHERE id = $1`, [id])).rows[0]?.status;
const historyCount = async (p: Pool, membershipId: string) =>
  (await p.query(`SELECT count(*)::int AS n FROM membership_status_history WHERE membership_id = $1`, [membershipId]))
    .rows[0].n as number;

describe('AHA Step 26 — approval multi-table transaction rollback (real-PG)', () => {
  // ── CONTROL: proves the hazard is real (the "watch it fail" half) ──
  // The same three writes run NON-transactionally: when the third write fails,
  // the first two have already committed → partial state survives. This is the
  // exact bug the handler's transaction prevents.
  test('CONTROL: non-transactional writes leave PARTIAL rows when the 3rd fails', async () => {
    if (!dbReachable) return; // documented environment skip

    const { db, scopedPool } = makeScopedDb();
    try {
      const { applicationId, membershipId } = await seed(scopedPool);

      let threw = false;
      try {
        // Autocommit (no transaction) — each statement commits on its own.
        await db.execute(
          sql.raw(`UPDATE membership_application SET status='approved', reviewed_by='${OFFICER_ID}', reviewed_at=now() WHERE id='${applicationId}'`),
        );
        await db.execute(
          sql.raw(`UPDATE membership SET status='pendingPayment', dues_expiry_date=NULL WHERE id='${membershipId}'`),
        );
        // Third write fails: to_status NOT NULL violated.
        await db.execute(
          sql.raw(`INSERT INTO membership_status_history (organization_id, membership_id, person_id, from_status, to_status, changed_by) VALUES ('${ORG_ID}','${membershipId}','${PERSON_ID}','removed', NULL, '${OFFICER_ID}')`),
        );
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);
      // Partial state survives without a transaction — the hazard is real.
      expect(await appStatus(scopedPool, applicationId)).toBe('approved');
      expect(await memStatus(scopedPool, membershipId)).toBe('pendingPayment');
      expect(await historyCount(scopedPool, membershipId)).toBe(0);
    } finally {
      await scopedPool.end();
    }
  });

  // ── ATOMIC #1: a real DB-constraint failure mid-transaction rolls back all ──
  test('db.transaction rolls back ALL writes when the history INSERT aborts', async () => {
    if (!dbReachable) return;

    const { db, scopedPool } = makeScopedDb();
    try {
      const { applicationId, membershipId } = await seed(scopedPool);

      let threw = false;
      try {
        await db.transaction(async (tx) => {
          await tx.execute(
            sql.raw(`UPDATE membership_application SET status='approved', reviewed_by='${OFFICER_ID}', reviewed_at=now() WHERE id='${applicationId}'`),
          );
          await tx.execute(
            sql.raw(`UPDATE membership SET status='pendingPayment', dues_expiry_date=NULL WHERE id='${membershipId}'`),
          );
          // Same induced failure as the control: to_status NOT NULL violated.
          await tx.execute(
            sql.raw(`INSERT INTO membership_status_history (organization_id, membership_id, person_id, from_status, to_status, changed_by) VALUES ('${ORG_ID}','${membershipId}','${PERSON_ID}','removed', NULL, '${OFFICER_ID}')`),
          );
        });
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);
      // ZERO partial rows: the two prior writes rolled back with the failed one.
      expect(await appStatus(scopedPool, applicationId)).toBe('submitted');
      expect(await memStatus(scopedPool, membershipId)).toBe('removed');
      expect(await historyCount(scopedPool, membershipId)).toBe(0);
    } finally {
      await scopedPool.end();
    }
  });

  // ── ATOMIC #2: a thrown error mid-transaction (e.g. a later guard) rolls back ──
  test('db.transaction rolls back ALL writes when the callback throws after writes', async () => {
    if (!dbReachable) return;

    const { db, scopedPool } = makeScopedDb();
    try {
      const { applicationId, membershipId } = await seed(scopedPool);

      let threw = false;
      try {
        await db.transaction(async (tx) => {
          await tx.execute(
            sql.raw(`UPDATE membership_application SET status='approved', reviewed_by='${OFFICER_ID}', reviewed_at=now() WHERE id='${applicationId}'`),
          );
          await tx.execute(
            sql.raw(`UPDATE membership SET status='pendingPayment', dues_expiry_date=NULL WHERE id='${membershipId}'`),
          );
          throw new Error('induced mid-transaction failure');
        });
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);
      // Both updates rolled back — no application 'approved' with a half-applied
      // membership, the precise state the handler's transaction prevents.
      expect(await appStatus(scopedPool, applicationId)).toBe('submitted');
      expect(await memStatus(scopedPool, membershipId)).toBe('removed');
      expect(await historyCount(scopedPool, membershipId)).toBe(0);
    } finally {
      await scopedPool.end();
    }
  });
});
