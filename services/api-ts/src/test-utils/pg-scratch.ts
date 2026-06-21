/**
 * Real-PG integration harness — isolated scratch schema, schema-faithful.
 *
 * Each suite gets a unique Postgres schema seeded by COPYING the real public
 * table structures via `CREATE TABLE <scratch>.<t> (LIKE public.<t> INCLUDING ALL)`.
 * This keeps the dense canonical scratch-schema isolation (parallel-safe, no
 * cross-file contamination, clean teardown) WITHOUT hand-written DDL — so a repo
 * query referencing a column the suite author forgot to declare can't pass against
 * a thinner fake table. Foreign keys are intentionally NOT copied (LIKE never
 * copies FKs), so a suite can insert into one table without standing up every
 * parent row.
 *
 * Requires the public schema to already be migrated (local dev DB, or CI's
 * ci-migrate step). When Postgres is unreachable / public is empty, the helper
 * returns `{ dbReachable: false }` and the suite skips cleanly (`if (!H.dbReachable) return`).
 *
 * Usage:
 *   let H: ScratchDb
 *   beforeAll(async () => { H = await createScratch(['credit_entry']) })
 *   afterAll(async () => { await H?.teardown() })
 *   test('...', async () => {
 *     if (!H.dbReachable) return
 *     const repo = new CreditEntryRepository(H.db as any)
 *     ...
 *   })
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export interface ScratchDb {
  /** drizzle instance pinned to the scratch schema (search_path startup option). */
  db: ReturnType<typeof drizzle>;
  /** raw pool pinned to the scratch schema — for read-back assertions / raw inserts. */
  scopedPool: Pool;
  /** the unique scratch schema name. */
  schema: string;
  /** false when Postgres is unreachable / public not migrated — guard every test on it. */
  dbReachable: boolean;
  /** drop the schema + close pools. Call in afterAll. Safe to call when unreachable. */
  teardown: () => Promise<void>;
}

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

/**
 * Stand up an isolated scratch schema containing copies of the named public tables.
 * @param tables public table names the suite-under-test reads/writes (e.g. ['credit_entry']).
 */
export async function createScratch(tables: string[]): Promise<ScratchDb> {
  // Date.now()/Math.random() are fine in test files (not in workflow scripts).
  const schema = `it_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const setupPool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });

  const noop: ScratchDb = {
    db: null as never,
    scopedPool: null as never,
    schema,
    dbReachable: false,
    teardown: async () => {
      await setupPool.end().catch(() => {});
    },
  };

  try {
    const client = await setupPool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}", public`);
      for (const t of tables) {
        // INCLUDING ALL copies columns, types, defaults, NOT NULL, CHECKs, indexes —
        // but never FK constraints, which is what we want for isolated inserts.
        await client.query(`CREATE TABLE "${schema}".${t} (LIKE public.${t} INCLUDING ALL)`);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[pg-scratch] Postgres unreachable / public not migrated; skipping suite. ${(err as Error).message}`);
    return noop;
  }

  const scopedPool = new Pool({
    connectionString: DB_URL,
    // search_path pinned as a libpq startup option (applied before any query) — NOT an
    // on('connect') handler, which races under pool churn.
    options: `-c search_path="${schema}",public`,
    max: 4,
    connectionTimeoutMillis: 15000,
  });
  const db = drizzle(scopedPool);

  return {
    db,
    scopedPool,
    schema,
    dbReachable: true,
    teardown: async () => {
      try {
        const client = await setupPool.connect();
        try {
          await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        } finally {
          client.release();
        }
      } catch {
        /* best-effort */
      }
      await scopedPool.end().catch(() => {});
      await setupPool.end().catch(() => {});
    },
  };
}
