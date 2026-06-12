/**
 * Migration Verification Tests (DATA-04)
 *
 * Verifies post-migration DB state: no tenant_id columns remain,
 * and key association tables have organization_id.
 *
 * These tests require a live database connection and will be skipped
 * in environments where no DATABASE_URL is set.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP_DB_TESTS = !DATABASE_URL;

describe('Migration Verification (DATA-04)', () => {
  let db: any = null;

  beforeAll(async () => {
    if (SKIP_DB_TESTS) return;
    try {
      const { db: database } = await import('./core/database');
      db = database;
    } catch {
      // DB connection not available — DB tests will be skipped
      db = null;
    }
  });

  test('no tenant_id columns remain in any table', async () => {
    if (SKIP_DB_TESTS || !db) {
      console.log('Skipping: no DB connection available');
      return;
    }
    const { sql } = await import('drizzle-orm');
    const result = await db.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'tenant_id'
    `);
    expect(result.rows).toHaveLength(0);
  });

  test('all core association tables have organization_id column', async () => {
    if (SKIP_DB_TESTS || !db) {
      console.log('Skipping: no DB connection available');
      return;
    }
    const { sql } = await import('drizzle-orm');
    const tables = [
      'training',
      'event',
      'membership',
      'membership_tier',
      'membership_application',
      'chapter_affiliation',
      'credential_template',
      'directory_profile',
      'document',
    ];

    for (const table of tables) {
      const result = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table}
          AND column_name = 'organization_id'
      `);
      expect(result.rows.length).toBe(1);
    }
  });

  test('no tenant_id in schema files (compile-time guard for CI)', async () => {
    // This test runs without DB and verifies no schema files re-introduce tenantId.
    // It is a fast safety net that runs even without a DB connection.
    const { Glob } = await import('bun');
    const path = await import('path');
    const ROOT_DIR = path.resolve(import.meta.dir, '..');

    const glob = new Glob('src/handlers/**/repos/*.schema.ts');
    const violations: string[] = [];

    for await (const file of glob.scan({ cwd: ROOT_DIR, absolute: false })) {
      const content = await Bun.file(path.join(ROOT_DIR, file)).text();
      if (content.includes("'tenant_id'")) {
        violations.push(file);
      }
    }

    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FIX-010 (AHA realtime-comms): chat_room / chat_message organization_id must
// be NOT NULL (the schema declares .notNull(); migration 0016 left it nullable
// and 0019's conditional SET NOT NULL was skipped). Migration 0064 backfills
// from the room then enforces NOT NULL.
// ---------------------------------------------------------------------------

describe('Migration Verification — comms org_id NOT NULL (FIX-010)', () => {
  // Connect directly via pg (DATABASE_URL only) — importing ./core/database
  // triggers full-env config validation that fails in a bare `bun test` run.
  const DB_URL = process.env['DATABASE_URL'];
  let pool: any = null;

  beforeAll(async () => {
    if (!DB_URL) return;
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: DB_URL });
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  const commsTables = ['chat_room', 'chat_message'] as const;

  for (const table of commsTables) {
    test(`${table}.organization_id is NOT NULL`, async () => {
      if (!pool) {
        console.log('Skipping: no DATABASE_URL');
        return;
      }
      const { rows } = await pool.query(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id'`,
        [table]
      );
      expect(rows[0]?.is_nullable).toBe('NO');
    });

    test(`${table} has no NULL organization_id rows`, async () => {
      if (!pool) {
        console.log('Skipping: no DATABASE_URL');
        return;
      }
      // `table` comes from a fixed allowlist above — safe to inline as identifier.
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE organization_id IS NULL`
      );
      expect(rows[0]?.n).toBe(0);
    });
  }
});
