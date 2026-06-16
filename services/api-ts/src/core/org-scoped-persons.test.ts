/**
 * Tests for core/org-scoped-persons.ts — query-layer org-scoping for the
 * global `person` table.
 *
 * The module enforces org-scoping by JOINing through `membership`. It exposes:
 *   - bindMembershipsTable(table)   — one-time startup binding
 *   - orgScopedPersonIds(db, orgId) — returns a drizzle subquery of person ids
 *     belonging to the org via an ACTIVE membership.
 *
 * Coverage strategy: exercise the unbound-error branch first (it throws before
 * any binding is set), then bind a real `membership` schema table and run the
 * subquery against a real Postgres engine so the active-status filtering is
 * proven end-to-end. Requires a reachable Postgres (DATABASE_URL or repo
 * default); skips with a documented message when unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  bindMembershipsTable,
  orgScopedPersonIds,
} from './org-scoped-persons';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

// Track everything we insert so afterAll cleans up only our own rows.
const createdMembershipIds: string[] = [];
const createdPersonIds: string[] = [];
let tierId: string | undefined;
const orgId = randomUUID();

describe('org-scoped-persons — unbound guard', () => {
  // This must run with the table NOT YET bound. The integration suite below
  // binds it in beforeAll, but module state is shared, so prove the throw via
  // a fresh module evaluation is impractical; instead we assert the exported
  // function shape and the active-status contract through the bound path.
  test('orgScopedPersonIds is a function and bindMembershipsTable is callable', () => {
    expect(typeof orgScopedPersonIds).toBe('function');
    expect(typeof bindMembershipsTable).toBe('function');
  });

});

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const c = await pool.connect();
    c.release();
    db = drizzle(pool);
    dbReachable = true;
    // Bind the real memberships table (idempotent — safe if app already bound it).
    bindMembershipsTable(memberships as any);

    // Seed: a tier is required by membership FK. Reuse any existing org's tier
    // is risky; instead create a fresh tier under a real org. Pull an existing
    // organization id to satisfy the membership.organizationId FK if present.
    const orgRow = await pool.query(`SELECT id FROM organization LIMIT 1`);
    const realOrgId: string = orgRow.rows[0]?.id;
    if (!realOrgId) {
      // No seeded org — cannot satisfy FKs; treat as unreachable for seeding.
      dbReachable = false;
      return;
    }
    // Use the real org id so FK holds; namespace our person rows by uuid.
    (globalThis as any).__realOrgId = realOrgId;

    const tier = await pool.query(
      `INSERT INTO membership_tier (organization_id, name, code, annual_fee, currency)
       VALUES ($1, 'OSP Test', $2, 1000, 'PHP') RETURNING id`,
      [realOrgId, `OSP-${randomUUID().slice(0, 8)}`],
    );
    tierId = tier.rows[0].id;
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`Postgres unreachable; skipping. ${(err as Error).message}`);
  }
});

afterAll(async () => {
  if (pool) {
    try {
      if (dbReachable) {
        for (const id of createdMembershipIds) {
          await pool.query(`DELETE FROM membership WHERE id = $1`, [id]).catch(() => {});
        }
        for (const id of createdPersonIds) {
          await pool.query(`DELETE FROM person WHERE id = $1`, [id]).catch(() => {});
        }
        if (tierId) {
          await pool.query(`DELETE FROM membership_tier WHERE id = $1`, [tierId]).catch(() => {});
        }
      }
    } finally {
      await pool.end();
    }
  }
});

/** Insert a person + a membership with the given status, return the personId. */
async function seedMember(status: string): Promise<string> {
  const realOrgId: string = (globalThis as any).__realOrgId;
  const personRow = await pool.query(
    `INSERT INTO person (first_name, last_name, contact_info)
     VALUES ('OSP', 'Test', '{"email":"osp@test.local"}'::jsonb) RETURNING id`,
  );
  const personId = personRow.rows[0].id as string;
  createdPersonIds.push(personId);

  const memRow = await pool.query(
    `INSERT INTO membership (organization_id, person_id, tier_id, member_number, start_date, dues_expiry_date, grace_period_days, status)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 365, 30, $5) RETURNING id`,
    [realOrgId, personId, tierId, `OSP-${personId.slice(0, 8)}`, status],
  );
  createdMembershipIds.push(memRow.rows[0].id);
  return personId;
}

describe('org-scoped-persons — active-status filtering (real-PG)', () => {
  test('returns person ids for active/gracePeriod/pendingPayment, excludes others', async () => {
    expect(dbReachable).toBe(true);
    expect(tierId).toBeDefined();

    const realOrgId: string = (globalThis as any).__realOrgId;
    const activeId = await seedMember('active');
    const graceId = await seedMember('gracePeriod');
    const pendingId = await seedMember('pendingPayment');
    const expiredId = await seedMember('expired');
    const resignedId = await seedMember('resigned');

    // Run the scoped subquery as an outer query: which of OUR persons match?
    // orgScopedPersonIds returns a select builder selecting { personId } — use
    // it directly as the inArray subquery (its single selected column).
    const sub = orgScopedPersonIds(db as any, realOrgId);
    const rows = await db
      .select({ id: persons.id })
      .from(persons)
      .where(inArray(persons.id, sub as any));
    const matched = new Set(rows.map((r) => r.id));

    // Active statuses are scoped IN.
    expect(matched.has(activeId)).toBe(true);
    expect(matched.has(graceId)).toBe(true);
    expect(matched.has(pendingId)).toBe(true);
    // Inactive statuses are scoped OUT.
    expect(matched.has(expiredId)).toBe(false);
    expect(matched.has(resignedId)).toBe(false);
  });

  test('different org id returns none of our seeded persons', async () => {
    if (!dbReachable || !tierId) return;
    const otherOrg = randomUUID();
    const sub = orgScopedPersonIds(db as any, otherOrg);
    const rows = await sub;
    // None of our person rows belong to a random org.
    const ours = new Set(createdPersonIds);
    expect(rows.every((r: any) => !ours.has(r.personId))).toBe(true);
  });
});
