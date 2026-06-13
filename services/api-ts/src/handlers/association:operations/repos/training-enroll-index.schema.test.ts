import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * FIX-010 (G10): schema/data test locking the duplicate-enrollment DB
 * backstop. The handler pre-check (enrollInCustomTraining) prevents the
 * common case, but the partial unique index is the race-safe backstop. This
 * characterizes migration 0068 so the index cannot silently disappear.
 *
 * Mirrors the Batch B compliance-matview.schema.test.ts approach: assert the
 * migration SQL text (the source of truth the drizzle migrator applies),
 * since drizzle-kit generate is unavailable in this environment.
 */
describe('FIX-010 (G10): training_enrollment partial-unique index (migration 0068)', () => {
  const sql = readFileSync(
    join(import.meta.dir, '../../../generated/migrations/0068_training_enroll_unique_active.sql'),
    'utf8',
  );

  test('creates a UNIQUE index on (training_id, person_id)', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]*"uq_training_enroll_active"/i);
    expect(sql).toMatch(/"training_id"\s*,\s*"person_id"/);
  });

  test('is PARTIAL — excludes cancelled enrollments so re-enrollment is allowed', () => {
    expect(sql).toMatch(/WHERE\s+"status"\s*<>\s*'cancelled'/i);
  });

  test('is idempotent (IF NOT EXISTS) — safe to re-run', () => {
    expect(sql).toMatch(/IF NOT EXISTS/i);
  });

  // AHA Step 27: an idempotent de-dup preflight runs BEFORE the index so a boot
  // against dirty data (pre-existing duplicate active enrollments) cannot crash
  // the migrator. The real-PG behavioural proof lives in
  // trainingEnrollDedup.integration.test.ts; this locks the text-level contract.
  test('has a de-dup preflight UPDATE ordered BEFORE the CREATE UNIQUE INDEX', () => {
    const stmts = sql
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    const preflightPos = stmts.findIndex(
      (s) => /^UPDATE/i.test(s) && /training_enrollment/i.test(s),
    );
    const indexPos = stmts.findIndex((s) => /CREATE\s+UNIQUE\s+INDEX/i.test(s));
    expect(preflightPos).toBeGreaterThanOrEqual(0);
    expect(indexPos).toBeGreaterThan(preflightPos);
    // Soft-cancel, never DELETE; winner picked by the pinned priority.
    expect(stmts[preflightPos]).toMatch(/SET\s+"status"\s*=\s*'cancelled'/i);
    expect(stmts[preflightPos]).toMatch(/row_number\(\)\s+OVER/i);
  });
});
