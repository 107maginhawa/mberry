/**
 * S-C4-015 contract test: MembershipRepository must not embed hardcoded
 * cross-module table names in raw SQL.
 *
 * Cycle-3 audit IC-07 flagged the `'dues_invoice'` and `'credit_entry'`
 * string literals inside `listMembersWithOfficerStatus` as cross-module
 * SQL leakage. After the fix those references must come from the
 * canonical Drizzle schemas (`duesInvoices`, `creditEntries`) imported
 * from the owning modules, so a table rename can never silently break
 * the membership query.
 *
 * We assert via source-level inspection rather than runtime: the SQL
 * runs against a real DB in integration tests, and the audit is about
 * static cross-module reference hygiene.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_FILE = join(
  import.meta.dir,
  'membership.repo.ts',
);

const SOURCE = readFileSync(REPO_FILE, 'utf-8');

describe('S-C4-015: membership repo no hardcoded cross-module table names', () => {
  test('no literal "FROM dues_invoice" SQL fragment remains', () => {
    expect(SOURCE).not.toMatch(/FROM\s+dues_invoice\b/);
  });

  test('no literal "FROM credit_entry" SQL fragment remains', () => {
    expect(SOURCE).not.toMatch(/FROM\s+credit_entry\b/);
  });

  test('imports the dues + credit Drizzle schemas instead', () => {
    // The fix routes the correlated subqueries through canonical schema
    // references owned by the dues / association:member modules.
    expect(SOURCE).toMatch(/import\s+\{[^}]*duesInvoices[^}]*\}\s+from\s+['"][^'"]*dues[^'"]*['"]/);
    expect(SOURCE).toMatch(/import\s+\{[^}]*creditEntries[^}]*\}\s+from\s+['"][^'"]*credits[^'"]*['"]/);
  });
});
