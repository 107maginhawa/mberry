/**
 * FIX-005 (G3) — data/schema regression: the compliance_standings
 * materialized view must EXCLUDE voided credits, so the matview-backed
 * officer compliance report agrees with the repo aggregate reads (which now
 * filter status='active') after an officer voids credits.
 *
 * This was a `[NEEDS CONFIRMATION]` item in the fix-ready plan — confirmed here
 * by asserting the migration that defines the view filters `ce.status='active'`.
 * Locking it as a test prevents a future migration edit from silently
 * reintroducing void-blind compliance numbers.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION = join(
  import.meta.dir,
  '../../../generated/migrations/0046_wave2b_compliance_view.sql',
);

describe('[FIX-005] compliance_standings matview excludes voided credits', () => {
  test('the matview definition filters ce.status = active', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toContain('compliance_standings');
    // The aggregate must be over active rows only.
    const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
    expect(normalized).toMatch(/where\s+ce\.status\s*=\s*'active'/);
  });
});
