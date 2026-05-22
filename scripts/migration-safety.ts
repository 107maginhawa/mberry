#!/usr/bin/env bun
/**
 * Migration safety lint — Phase 5.3
 *
 * Scans SQL migration files for destructive or dangerous operations.
 * Designed for CI: exits 1 if any dangerous op found in NEW migrations
 * (files not on the base branch). Pass --all to scan every migration.
 *
 * Usage:
 *   bun scripts/migration-safety.ts              # only new migrations vs main
 *   bun scripts/migration-safety.ts --all        # scan all migrations
 *   bun scripts/migration-safety.ts --base=dev   # compare against dev branch
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Dangerous patterns — ordered by severity
// ---------------------------------------------------------------------------

interface DangerPattern {
  severity: 'error' | 'warning';
  pattern: RegExp;
  message: string;
}

const DANGER_PATTERNS: DangerPattern[] = [
  // Hard errors — data loss
  { severity: 'error', pattern: /\bDROP\s+TABLE\b/i, message: 'DROP TABLE — permanent data loss' },
  { severity: 'error', pattern: /\bDROP\s+SCHEMA\b/i, message: 'DROP SCHEMA — permanent data loss' },
  { severity: 'error', pattern: /\bTRUNCATE\b/i, message: 'TRUNCATE — deletes all rows' },
  { severity: 'error', pattern: /\bDELETE\s+FROM\b(?!.*\bWHERE\b)/i, message: 'DELETE without WHERE — deletes all rows' },

  // Warnings — potentially dangerous, review required
  { severity: 'warning', pattern: /\bDROP\s+COLUMN\b/i, message: 'DROP COLUMN — may lose data if column has values' },
  { severity: 'warning', pattern: /\bALTER\s+(?:COLUMN|TABLE).*\bTYPE\b/i, message: 'ALTER TYPE — may fail or truncate data' },
  { severity: 'warning', pattern: /\bRENAME\s+(?:TABLE|COLUMN)\b/i, message: 'RENAME — breaks code referencing old name' },
  { severity: 'warning', pattern: /\bALTER\s+TABLE.*\bSET\s+NOT\s+NULL\b/i, message: 'SET NOT NULL — fails if existing NULLs' },
  { severity: 'warning', pattern: /\bALTER\s+TABLE.*\bDROP\s+CONSTRAINT\b/i, message: 'DROP CONSTRAINT — weakens data integrity' },
  { severity: 'warning', pattern: /\bDROP\s+INDEX\b/i, message: 'DROP INDEX — may degrade query performance' },
];

// ---------------------------------------------------------------------------
// Determine which migrations to scan
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const scanAll = args.includes('--all');
const baseFlag = args.find(a => a.startsWith('--base='));
const baseBranch = baseFlag?.split('=')[1] || 'main';

const MIGRATION_DIR = 'services/api-ts/src/generated/migrations';

function getNewMigrations(): string[] {
  try {
    const diff = execSync(
      `git diff --name-only --diff-filter=A ${baseBranch}...HEAD -- "${MIGRATION_DIR}/*.sql"`,
      { encoding: 'utf-8' }
    ).trim();
    return diff ? diff.split('\n').filter(f => f.endsWith('.sql')) : [];
  } catch {
    // If base branch doesn't exist (e.g., detached HEAD in CI), fall back to all
    console.warn(`[migration-safety] Could not diff against ${baseBranch}, scanning all migrations`);
    return getAllMigrations();
  }
}

function getAllMigrations(): string[] {
  if (!existsSync(MIGRATION_DIR)) return [];
  return readdirSync(MIGRATION_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => join(MIGRATION_DIR, f));
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

const files = scanAll ? getAllMigrations() : getNewMigrations();

if (files.length === 0) {
  console.log('[migration-safety] No migrations to scan. ✓');
  process.exit(0);
}

console.log(`[migration-safety] Scanning ${files.length} migration(s)...\n`);

let errors = 0;
let warnings = 0;

for (const file of files) {
  if (!existsSync(file)) continue;

  const sql = readFileSync(file, 'utf-8');
  const name = basename(file);

  // File-level acknowledgment: if the file contains "migration-safety: reviewed",
  // all errors are downgraded to warnings (still reported, but don't block CI).
  const acknowledged = /--\s*migration-safety:\s*reviewed/i.test(sql);

  const findings: { severity: string; line: number; message: string }[] = [];

  const lines = sql.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip SQL comments
    if (line.trimStart().startsWith('--')) continue;

    for (const dp of DANGER_PATTERNS) {
      if (dp.pattern.test(line)) {
        const effectiveSeverity = acknowledged && dp.severity === 'error' ? 'warning' : dp.severity;
        findings.push({ severity: effectiveSeverity, line: i + 1, message: dp.message });
        if (effectiveSeverity === 'error') errors++;
        else warnings++;
      }
    }
  }

  if (findings.length > 0) {
    console.log(`${name}:`);
    for (const f of findings) {
      const icon = f.severity === 'error' ? '🔴' : '🟡';
      console.log(`  ${icon} L${f.line}: ${f.message}`);
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

if (errors > 0) {
  console.error(`\n[migration-safety] FAILED: ${errors} error(s), ${warnings} warning(s)`);
  console.error('Destructive migrations require manual review. Add a comment `-- migration-safety: reviewed` to acknowledge.');
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\n[migration-safety] PASSED with ${warnings} warning(s) — review recommended`);
  process.exit(0);
} else {
  console.log(`[migration-safety] All clean. ✓`);
  process.exit(0);
}
