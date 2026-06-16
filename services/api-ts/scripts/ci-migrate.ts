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
} catch (err) {
  console.error('ci-migrate: migration failed', err);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection(db);
}
