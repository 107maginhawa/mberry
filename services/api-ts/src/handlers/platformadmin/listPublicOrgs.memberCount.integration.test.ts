// Regression: member-count-by-org array binding (SQL ANY(array) fix)
//
// The handler `listPublicOrgs` counts active members per org with:
//   SELECT organization_id, count(*)::int ... WHERE organization_id = ANY(<orgIds>)
// Interpolating a JS string[] directly produced `ANY(($1,$2,...))` (a tuple),
// which Postgres rejects: "op ANY/ALL (array) requires array on right side".
// The fix binds orgIds as a real uuid[] via ARRAY[...]::uuid[].
//
// This is a REAL-DB test. It connects to DATABASE_URL, runs everything inside a
// transaction that is always rolled back, and proves:
//   1) the array-bound query is valid SQL (no "requires array on right side")
//   2) it returns correct grouped counts for a multi-org input
//   3) the empty-array input is valid and returns zero rows (no error)

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase';

// Build the exact array-bound expression the handler uses.
function orgIdArray(orgIds: string[]) {
  return sql`ARRAY[${sql.join(
    orgIds.map((id) => sql`${id}`),
    sql`, `
  )}]::uuid[]`;
}

function memberCountQuery(db: NodePgDatabase, orgIds: string[]) {
  return db.execute(
    sql`SELECT organization_id, count(*)::int as count FROM membership WHERE organization_id = ANY(${orgIdArray(
      orgIds
    )}) AND status = 'active' GROUP BY organization_id`
  );
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  const r = result as Record<string, unknown>;
  return (r['rows'] as Array<Record<string, unknown>> | undefined) ??
    (result as Array<Record<string, unknown>>);
}

let pool: Pool;
let dbReachable = false;
let tierId: string | null = null;
let personIds: string[] = [];

const ORG_A = '11111111-1111-1111-1111-11111111aaaa';
const ORG_B = '22222222-2222-2222-2222-22222222bbbb';
const ORG_C = '33333333-3333-3333-3333-33333333cccc';

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const client = await pool.connect();
    try {
      const tier = await client.query('SELECT id FROM membership_tier LIMIT 1');
      const people = await client.query('SELECT id FROM person LIMIT 4');
      if (tier.rows.length > 0 && people.rows.length >= 3) {
        tierId = tier.rows[0].id;
        personIds = people.rows.map((p: { id: string }) => p.id);
        dbReachable = true;
      }
    } finally {
      client.release();
    }
  } catch {
    dbReachable = false;
  }
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('listPublicOrgs member-count array binding (real DB)', () => {
  test('multi-org input returns correct grouped active counts; empty input is safe', async () => {
    if (!dbReachable) {
      // Dev DB not reachable / not seeded — skip without failing the suite.
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Defer FK checks so we don't need real tier/person rows per org.
      await client.query('SET CONSTRAINTS ALL DEFERRED');

      // ORG_A: 2 active + 1 lapsed | ORG_B: 1 active | ORG_C: 0 active (1 lapsed)
      const seed: Array<[string, string, string]> = [
        [ORG_A, personIds[0], 'active'],
        [ORG_A, personIds[1], 'active'],
        [ORG_A, personIds[2], 'lapsed'],
        [ORG_B, personIds[0], 'active'],
        [ORG_C, personIds[1], 'lapsed'],
      ];
      let i = 0;
      for (const [orgId, personId, status] of seed) {
        await client.query(
          `INSERT INTO membership (organization_id, person_id, tier_id, member_number, start_date, status)
           VALUES ($1, $2, $3, $4, current_date, $5::membership_status)`,
          [orgId, personId, tierId, `REG-TEST-${i++}`, status]
        );
      }

      const db = drizzle(client as unknown as Pool);

      // Multi-org input — the case that previously threw the tuple error.
      const orgIds = [ORG_A, ORG_B, ORG_C];
      const result = await memberCountQuery(db, orgIds);
      const counts = new Map<string, number>();
      for (const row of rowsOf(result)) {
        counts.set(row['organization_id'] as string, row['count'] as number);
      }

      expect(counts.get(ORG_A)).toBe(2);
      expect(counts.get(ORG_B)).toBe(1);
      // ORG_C has no active members → absent from grouped result → 0
      expect(counts.get(ORG_C) ?? 0).toBe(0);

      // Empty-array input must be valid SQL and return zero rows (no error).
      const emptyResult = await memberCountQuery(db, []);
      expect(rowsOf(emptyResult).length).toBe(0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
