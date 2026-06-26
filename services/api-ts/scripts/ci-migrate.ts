/**
 * Apply all Drizzle migrations to the database at $DATABASE_URL, then exit.
 *
 * Used by CI's unit-tests job: that job runs `bun test` against a fresh, empty
 * Postgres service with no migrations applied, so any test that exercises the
 * real `public` schema (the `*(real-PG)*` integration tests) fails with
 * "relation … does not exist". Booting the full API just to migrate is
 * overkill; this runs the same `runMigrations()` the app calls on startup.
 *
 * Idempotent: re-running is a no-op (drizzle tracks applied migrations).
 */
import { sql } from 'drizzle-orm';
import { createDatabase, runMigrations, closeDatabaseConnection } from '@/core/database';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('ci-migrate: DATABASE_URL not set');
  process.exit(2);
}

const db = createDatabase({ url });
try {
  await runMigrations(db);
  console.log('ci-migrate: migrations applied');
  // TEMP DIAG (remove after CI green): prove whether 0085 actually applied.
  try {
    const cols = await db.execute(
      sql`select column_name from information_schema.columns where table_name = 'payment_token' and column_name in ('revoked_at','idempotency_key','paymongo_session_id','checkout_started_at') order by column_name`,
    );
    console.log('ci-migrate DIAG payment_token new cols:', JSON.stringify((cols as any).rows ?? cols));
    const m = await db.execute(
      sql`select count(*)::int as n, max(created_at)::text as maxc from drizzle."__drizzle_migrations"`,
    );
    console.log('ci-migrate DIAG __drizzle_migrations:', JSON.stringify((m as any).rows ?? m));
  } catch (diagErr) {
    console.log('ci-migrate DIAG failed:', (diagErr as Error).message);
  }
} catch (err) {
  console.error('ci-migrate: migration failed', err);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection(db);
}
