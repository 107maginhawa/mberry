/**
 * Real-DB integration tests for the email SuppressionRepository.
 *
 * Backfills the p0 deliverability rules that had ZERO test refs:
 *   - BR-55 Hard Bounce Auto-Suppression (p0-data): a hard_bounce suppression
 *     persists durably with reason `hard_bounce` and is observable on read.
 *   - BR-56 Complaint Auto-Suppression / CAN-SPAM (p0-security): a complaint
 *     suppression persists with reason `complaint`, AND suppression is strictly
 *     org-scoped — suppressing an address in one tenant must NOT suppress the
 *     same address in another (cross-tenant leak would be a CAN-SPAM/privacy
 *     defect).
 *
 * Scope: the durable-state + tenant-isolation half of the IF→THEN rule (the
 * THEN). The IF trigger (a provider bounce/complaint webhook that CALLS
 * addSuppression) is not yet wired in the codebase — see BR-55/56 annotations.
 * These tests lock the suppression-state contract the trigger will depend on.
 *
 * Pattern mirrors dues-repos.integration.test.ts: a per-run scratch schema with
 * hand-written DDL for only the email_suppression table. The reason enum is
 * modelled as `text` (drizzle sends the literal string). Skips cleanly if
 * Postgres is unreachable rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { SuppressionRepository } from './suppression.repo';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `suppression_repo_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let setupPool: Pool;
let scopedPool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

const ORG_A = '00000000-0000-4000-8000-00000000a001';
const ORG_B = '00000000-0000-4000-8000-00000000b001';

function freshEmail(tag: string): string {
  return `${tag}-${crypto.randomUUID()}@example.test`;
}

async function ddl(client: any) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await client.query(`SET search_path TO "${TEST_SCHEMA}", public`);

  // email_suppression — reason enum modelled as text. Unique (org, email).
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".email_suppression (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      email varchar(255) NOT NULL,
      reason text NOT NULL,
      suppressed_at timestamptz NOT NULL DEFAULT now(),
      suppressed_by uuid,
      notes text,
      version integer NOT NULL DEFAULT 1,
      created_by uuid,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT email_suppression_org_email_unique UNIQUE (organization_id, email)
    )
  `);
}

beforeAll(async () => {
  setupPool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await setupPool.connect();
    try {
      await ddl(client);
      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[suppression-repo integration] Postgres unreachable, skipping: ${(err as Error).message}`);
    return;
  }

  scopedPool = new Pool({
    connectionString: DB_URL,
    options: `-c search_path="${TEST_SCHEMA}",public`,
    max: 4,
    connectionTimeoutMillis: 15000,
  });
  db = drizzle(scopedPool);
});

afterAll(async () => {
  if (dbReachable) {
    try {
      const client = await setupPool.connect();
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      } finally {
        client.release();
      }
    } catch {
      /* best-effort cleanup */
    }
  }
  if (scopedPool) await scopedPool.end();
  if (setupPool) await setupPool.end();
});

// ─── BR-55 Hard Bounce Auto-Suppression (p0-data) ─────────────────────────

describe('SuppressionRepository — BR-55 hard_bounce (real DB)', () => {
  test('persists a hard_bounce suppression and reads it back with the right reason', async () => {
    if (!dbReachable) return;
    const repo = new SuppressionRepository(db as any);
    const email = freshEmail('bounce');

    expect(await repo.isSuppressed(email, ORG_A)).toBe(false);

    await repo.addSuppression({ orgId: ORG_A, email, reason: 'hard_bounce' });

    expect(await repo.getSuppressionReason(email, ORG_A)).toBe('hard_bounce');
    expect(await repo.isSuppressed(email, ORG_A)).toBe(true);
  });

  test('a duplicate add for the same org+email is an idempotent no-op (keeps first reason)', async () => {
    if (!dbReachable) return;
    const repo = new SuppressionRepository(db as any);
    const email = freshEmail('dup');

    await repo.addSuppression({ orgId: ORG_A, email, reason: 'hard_bounce' });
    // Second add must NOT throw on the (org,email) unique constraint.
    await repo.addSuppression({ orgId: ORG_A, email, reason: 'manual' });

    // First reason retained — the no-op does not overwrite.
    expect(await repo.getSuppressionReason(email, ORG_A)).toBe('hard_bounce');
  });
});

// ─── BR-56 Complaint Auto-Suppression / CAN-SPAM (p0-security) ─────────────

describe('SuppressionRepository — BR-56 complaint + tenant isolation (real DB)', () => {
  test('persists a complaint suppression with reason complaint', async () => {
    if (!dbReachable) return;
    const repo = new SuppressionRepository(db as any);
    const email = freshEmail('complaint');

    await repo.addSuppression({ orgId: ORG_A, email, reason: 'complaint' });

    expect(await repo.getSuppressionReason(email, ORG_A)).toBe('complaint');
  });

  test('suppression is strictly org-scoped — a complaint in org A does not suppress the same address in org B', async () => {
    if (!dbReachable) return;
    const repo = new SuppressionRepository(db as any);
    const email = freshEmail('shared');

    await repo.addSuppression({ orgId: ORG_A, email, reason: 'complaint' });

    // org A sees it…
    expect(await repo.isSuppressed(email, ORG_A)).toBe(true);
    // …org B must NOT (cross-tenant leak would be the security defect).
    expect(await repo.isSuppressed(email, ORG_B)).toBe(false);
    expect(await repo.getSuppressionReason(email, ORG_B)).toBeNull();
  });

  test('listByOrg returns only the calling org’s suppressions', async () => {
    if (!dbReachable) return;
    const repo = new SuppressionRepository(db as any);
    const aEmail = freshEmail('list-a');
    const bEmail = freshEmail('list-b');

    await repo.addSuppression({ orgId: ORG_A, email: aEmail, reason: 'complaint' });
    await repo.addSuppression({ orgId: ORG_B, email: bEmail, reason: 'hard_bounce' });

    const aList = await repo.listByOrg(ORG_A);
    const aEmails = aList.data.map((r) => r.email);
    expect(aEmails).toContain(aEmail);
    expect(aEmails).not.toContain(bEmail);
  });
});
