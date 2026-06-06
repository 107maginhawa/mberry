#!/usr/bin/env bun
/**
 * audit-migrations.ts — Wave 2.5 migration safety audit
 *
 * Full-history scan of ALL SQL migrations for unsafe DDL patterns.
 * Writes a machine-readable findings report to docs/security/migrations-audit.json.
 * Complements scripts/migration-safety.ts (CI gating on new migrations only).
 *
 * Usage:
 *   bun scripts/audit-migrations.ts
 *   bun scripts/audit-migrations.ts --dir=<path>   # override migration dir
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, relative } from 'path';

type Severity = 'P0' | 'P1' | 'P2' | 'P3' | 'INFO';

interface Finding {
  file: string;
  severity: Severity;
  pattern: string;
  line?: number;
  snippet?: string;
  rationale: string;
  remediation: string;
}

interface AuditResult {
  generatedAt: string;
  migrationDir: string;
  totals: {
    files: number;
    findings: number;
    P0: number;
    P1: number;
    P2: number;
    P3: number;
    INFO: number;
  };
  findings: Finding[];
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

const PATTERNS: Array<{
  re: RegExp;
  severity: Severity;
  pattern: string;
  rationale: string;
  remediation: string;
  skipComments?: boolean;
}> = [
  // P0 — Destructive, data-loss risk
  {
    re: /\bDROP\s+TABLE\b/i,
    severity: 'P0',
    pattern: 'DROP TABLE',
    rationale: 'Permanent data loss — requires expand-contract split across two releases.',
    remediation: 'Add a compensating migration that re-creates or renames. Backfill data before dropping. Tag original with -- migration-safety: reviewed after confirming data was already migrated.',
  },
  {
    re: /\bDROP\s+SCHEMA\b/i,
    severity: 'P0',
    pattern: 'DROP SCHEMA',
    rationale: 'Cascades to ALL objects in schema — catastrophic data loss.',
    remediation: 'Never drop schema in app migrations. Archive schema contents first.',
  },
  {
    re: /\bTRUNCATE\b/i,
    severity: 'P0',
    pattern: 'TRUNCATE',
    rationale: 'Deletes all rows — likely unintentional in migration context.',
    remediation: 'Replace with conditional DELETE WHERE or move data to archive table before truncating.',
  },
  {
    re: /\bDELETE\s+FROM\b(?!\s+[\w"]+\s+WHERE)/i,
    severity: 'P0',
    pattern: 'DELETE without WHERE',
    rationale: 'Deletes all rows in table — data loss.',
    remediation: 'Add a WHERE clause or confirm intent and tag -- migration-safety: reviewed.',
  },

  // P1 — Locking / null-safety risks
  {
    re: /ALTER\s+(?:TABLE\s+\S+\s+)?ALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL/i,
    severity: 'P1',
    pattern: 'SET NOT NULL (ALTER COLUMN)',
    rationale: 'Full table scan required; fails if any existing row has NULL in that column. Locks table on Postgres < 12.',
    remediation: 'Run a backfill UPDATE first (separate migration), then SET NOT NULL in a subsequent migration.',
  },
  {
    re: /ADD\s+COLUMN\s+\S+\s+\S+.*?NOT\s+NULL(?!\s+DEFAULT)(?!\s*,?\s*DEFAULT)/i,
    severity: 'P1',
    pattern: 'ADD COLUMN NOT NULL (no DEFAULT)',
    rationale: 'Existing rows violate the NOT NULL constraint — migration will fail on non-empty tables.',
    remediation: 'Add a DEFAULT clause, or use expand-contract: add nullable → backfill → set NOT NULL.',
  },
  {
    re: /\bRENAME\s+(COLUMN|TABLE)\b/i,
    severity: 'P1',
    pattern: 'RENAME COLUMN/TABLE',
    rationale: 'Breaks any running code (queries, ORM, functions) that references the old name.',
    remediation: 'Expand-contract: add new column/table → dual-write → cut over code → drop old in a later release.',
  },
  {
    re: /ALTER\s+(?:TABLE\s+\S+\s+)?ALTER\s+COLUMN\s+\S+\s+TYPE\b/i,
    severity: 'P1',
    pattern: 'ALTER COLUMN TYPE',
    rationale: 'May rewrite the entire table and hold ACCESS EXCLUSIVE lock for the duration.',
    remediation: 'Use expand-contract: add new column with correct type → migrate data → swap application code → drop old column.',
  },
  {
    re: /\bALTER\s+TABLE.*\bDROP\s+CONSTRAINT\b/i,
    severity: 'P1',
    pattern: 'DROP CONSTRAINT',
    rationale: 'Weakens data integrity; referential constraints protect multi-tenant data isolation.',
    remediation: 'Confirm constraint removal is intentional. Add -- migration-safety: reviewed with justification.',
  },

  // P1 — DROP COLUMN (potential data loss, may break code)
  {
    re: /\bDROP\s+COLUMN\b/i,
    severity: 'P1',
    pattern: 'DROP COLUMN',
    rationale: 'Data loss if column has non-null values; breaks ORM code reading the column.',
    remediation: 'Expand-contract: stop writing to column in one release, then drop in the next.',
  },

  // P2 — Locking performance risks
  {
    re: /CREATE\s+(?:UNIQUE\s+)?INDEX(?!\s+CONCURRENTLY)(?!\s+IF\s+NOT\s+EXISTS\s+\S+\s+ON\s+\S+\s+USING\s+gin)/i,
    severity: 'P2',
    pattern: 'CREATE INDEX (not CONCURRENTLY)',
    rationale: 'Acquires ACCESS EXCLUSIVE lock — blocks reads AND writes for table duration.',
    remediation: 'Use CREATE INDEX CONCURRENTLY (or CREATE UNIQUE INDEX CONCURRENTLY). Note: CONCURRENTLY cannot run inside a transaction block.',
  },
  {
    re: /\bDROP\s+INDEX\b/i,
    severity: 'P2',
    pattern: 'DROP INDEX',
    rationale: 'May degrade query performance if index was actively used by production queries.',
    remediation: 'Verify index is genuinely unused via pg_stat_user_indexes before dropping.',
  },

  // P2 — Mixed schema + data
  // (handled separately as file-level heuristic below)
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dirFlag = args.find((a) => a.startsWith('--dir='));
const MIG_DIR = dirFlag ? dirFlag.split('=')[1] : 'services/api-ts/src/generated/migrations';
const OUT_FILE = 'docs/security/migrations-audit.json';

function walkSql(dir: string): string[] {
  const out: string[] = [];
  try {
    statSync(dir);
  } catch {
    return out;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSql(p));
    else if (entry.name.endsWith('.sql') || entry.name.endsWith('.ts')) out.push(p);
  }
  return out.sort();
}

function relPath(f: string): string {
  try {
    return relative(process.cwd(), f);
  } catch {
    return f;
  }
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

const files = walkSql(MIG_DIR);
const findings: Finding[] = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const relFile = relPath(f);

  // Check if file has migration-safety acknowledgment
  const acknowledged = /--\s*migration-safety:\s*reviewed/i.test(src);

  for (const { re, severity, pattern, rationale, remediation } of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip pure SQL comment lines
      if (line.trimStart().startsWith('--')) continue;

      if (re.test(line)) {
        // Acknowledged files downgrade P0→P1, P1→P2 (still reported)
        let effectiveSeverity = severity;
        if (acknowledged) {
          if (severity === 'P0') effectiveSeverity = 'P1';
          else if (severity === 'P1') effectiveSeverity = 'P2';
        }

        findings.push({
          file: relFile,
          severity: effectiveSeverity,
          pattern,
          line: i + 1,
          snippet: line.trim().slice(0, 140),
          rationale,
          remediation: acknowledged ? `[ACKNOWLEDGED] ${remediation}` : remediation,
        });
      }
    }
  }

  // File-level heuristic: mixed schema + data in single migration
  const hasSchemaOp = /\b(CREATE|ALTER|DROP)\b/i.test(src);
  const hasDataOp = /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM\s+\w)/i.test(src);
  if (hasSchemaOp && hasDataOp) {
    findings.push({
      file: relFile,
      severity: 'P2',
      pattern: 'mixed schema+data in single migration',
      rationale: 'Schema and data changes in the same migration make rollback harder and complicate partial-failure recovery.',
      remediation: 'Split into separate migrations: one for DDL, one for the data backfill.',
    });
  }
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

const totals = {
  files: files.length,
  findings: findings.length,
  P0: findings.filter((f) => f.severity === 'P0').length,
  P1: findings.filter((f) => f.severity === 'P1').length,
  P2: findings.filter((f) => f.severity === 'P2').length,
  P3: findings.filter((f) => f.severity === 'P3').length,
  INFO: findings.filter((f) => f.severity === 'INFO').length,
};

const result: AuditResult = {
  generatedAt: new Date().toISOString(),
  migrationDir: MIG_DIR,
  totals,
  findings,
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const outDir = OUT_FILE.split('/').slice(0, -1).join('/');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

console.log(`\nMigration Safety Audit — Wave 2.5`);
console.log(`  Scanned : ${totals.files} files in ${MIG_DIR}`);
console.log(`  Findings: ${totals.findings} total`);
console.log(`  P0      : ${totals.P0}  (destructive — immediate risk)`);
console.log(`  P1      : ${totals.P1}  (locking / null-safety)`);
console.log(`  P2      : ${totals.P2}  (performance / hygiene)`);
console.log(`  P3      : ${totals.P3}  (informational)`);
console.log(`\nReport written to: ${OUT_FILE}`);

if (totals.P0 > 0) {
  console.log('\n--- P0 Findings (escalation required) ---');
  for (const f of findings.filter((x) => x.severity === 'P0')) {
    console.log(`  ${f.file}:${f.line}  [${f.pattern}]`);
    console.log(`    ${f.snippet}`);
    console.log(`    Remediation: ${f.remediation}`);
  }
}
