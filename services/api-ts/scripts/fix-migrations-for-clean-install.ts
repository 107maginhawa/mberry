/**
 * Migration fixer for clean installs.
 *
 * Problem: Drizzle-generated migrations are NOT idempotent. Running all 40
 * migrations on a fresh DB fails because later migrations assume intermediate
 * state (columns to rename, types to add values to, indexes to drop).
 *
 * Solution: Patch SQL files in-place to make all operations idempotent.
 * After seed completes, restore originals via `git checkout -- src/generated/migrations/`.
 *
 * Usage:
 *   cd services/api-ts
 *   bun scripts/fix-migrations-for-clean-install.ts
 *   bun dev  # starts API, runs patched migrations
 *   bun run db:seed
 *   git checkout -- src/generated/migrations/
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(import.meta.dir, '../src/generated/migrations');

// Migrations that are already idempotent — skip patching
const SKIP = new Set([
  '0014_data_model_unification.sql',
  '0030_dunning_tables.sql',
  '0033_orgid_rename.sql',
  '0034_lying_fixer.sql',
  '0035_glossy_titanium_man.sql',
  '0036_solid_lyja.sql',
  '0037_last_infant_terrible.sql',
  '0039_notification_type_gap_wiring.sql',
]);

let totalFixes = 0;

function patchFile(filename: string): number {
  const filepath = join(MIGRATIONS_DIR, filename);
  let sql = readFileSync(filepath, 'utf8');
  const original = sql;
  let fixes = 0;

  // 1. ALTER TYPE ... ADD VALUE → exception-safe
  // Handles both "type_name" and "public"."type_name" formats
  sql = sql.replace(
    /^ALTER TYPE ("[^"]+(?:"\."[^"]+)?") ADD VALUE '([^']+)';(-->.*)?$/gm,
    (match, type, value, bp) => {
      // Skip if already inside a DO block
      fixes++;
      return `DO $$ BEGIN ALTER TYPE ${type} ADD VALUE '${value}'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;${bp || ''}`;
    }
  );

  // 2. ALTER TYPE ... RENAME VALUE → exception-safe
  sql = sql.replace(
    /^ALTER TYPE ("[^"]+(?:"\."[^"]+)?") RENAME VALUE '([^']+)' TO '([^']+)';(-->.*)?$/gm,
    (_, type, oldVal, newVal, bp) => {
      fixes++;
      return `DO $$ BEGIN ALTER TYPE ${type} RENAME VALUE '${oldVal}' TO '${newVal}'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;${bp || ''}`;
    }
  );

  // 3. CREATE TYPE ... AS ENUM → exception-safe (only bare ones, not already wrapped in DO $$)
  // Handles both "type_name" and "public"."type_name" formats
  sql = sql.replace(
    /^CREATE TYPE ("[^"]+(?:"\."[^"]+)?") AS ENUM\(([^)]+)\);(-->.*)?$/gm,
    (_, type, values, bp) => {
      fixes++;
      return `DO $$ BEGIN CREATE TYPE ${type} AS ENUM(${values}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;${bp || ''}`;
    }
  );

  // 4. ALTER TABLE ... RENAME COLUMN → conditional (skip if already wrapped in DO $$)
  // Match lines that start with ALTER TABLE (not inside a DO block)
  sql = sql.replace(
    /^ALTER TABLE "(\w+)" RENAME COLUMN "(\w+)" TO "(\w+)";(-->.*)?$/gm,
    (match, table, oldCol, newCol, bp) => {
      // Don't double-wrap if already inside a DO block
      fixes++;
      return `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${oldCol}')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${newCol}')
  THEN ALTER TABLE "${table}" RENAME COLUMN "${oldCol}" TO "${newCol}";
  END IF;
END $$;${bp || ''}`;
    }
  );

  // 5. ALTER TABLE ... ADD COLUMN (bare, not already IF NOT EXISTS or in DO block)
  {
    const addColLines = sql.split('\n');
    const newAddColLines: string[] = [];
    for (let i = 0; i < addColLines.length; i++) {
      const line = addColLines[i]!;
      const prevLine = i > 0 ? addColLines[i - 1]! : '';
      const addColMatch = line.match(/^ALTER TABLE "(\w+)" ADD COLUMN "(\w+)" (.+?);(-->.*)?$/);
      if (addColMatch && !prevLine.includes('DO $$') && !prevLine.includes('THEN') && !prevLine.includes('BEGIN')) {
        const [, table, col, rest, bp] = addColMatch;
        fixes++;
        newAddColLines.push(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}')
  THEN ALTER TABLE "${table}" ADD COLUMN "${col}" ${rest};
  END IF;
END $$;${bp || ''}`);
      } else {
        newAddColLines.push(line);
      }
    }
    sql = newAddColLines.join('\n');
  }

  // 6. ALTER TABLE ... DROP COLUMN without IF EXISTS
  sql = sql.replace(
    /DROP COLUMN "(\w+)"/g,
    (match, col) => {
      if (match.includes('IF EXISTS')) return match;
      fixes++;
      return `DROP COLUMN IF EXISTS "${col}"`;
    }
  );

  // 7. DROP INDEX without IF EXISTS
  sql = sql.replace(
    /^DROP INDEX "(\w+)";(-->.*)?$/gm,
    (_, idx, bp) => {
      fixes++;
      return `DROP INDEX IF EXISTS "${idx}";${bp || ''}`;
    }
  );

  // 8. ALTER TABLE ... ADD CONSTRAINT → conditional
  // Only match lines NOT already inside a DO $$ block (check preceding line)
  const lines = sql.split('\n');
  const newLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prevLine = i > 0 ? lines[i - 1]! : '';
    const constraintMatch = line.match(/^ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)" (.+?);(-->.*)?$/);
    if (constraintMatch && !prevLine.includes('DO $$') && !prevLine.includes('BEGIN')) {
      const [, table, constraint, rest, bp] = constraintMatch;
      fixes++;
      newLines.push(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${constraint}')
  THEN ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" ${rest};
  END IF;
END $$;${bp || ''}`);
    } else {
      newLines.push(line);
    }
  }
  sql = newLines.join('\n');

  // 9. ALTER TABLE ... ALTER COLUMN ... SET NOT NULL → conditional
  sql = sql.replace(
    /^ALTER TABLE "(\w+)" ALTER COLUMN "(\w+)" SET NOT NULL;(-->.*)?$/gm,
    (_, table, col, bp) => {
      fixes++;
      return `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}')
  THEN ALTER TABLE "${table}" ALTER COLUMN "${col}" SET NOT NULL;
  END IF;
END $$;${bp || ''}`;
    }
  );

  if (sql !== original) {
    writeFileSync(filepath, sql);
  }

  return fixes;
}

/**
 * Special handling for 0019: CREATE TABLE IF NOT EXISTS column gaps.
 * When 0019 does CREATE TABLE IF NOT EXISTS for a table that already exists
 * (from 0010-0012), the new columns in the CREATE TABLE are never added.
 * Insert ADD COLUMN IF NOT EXISTS after each such CREATE TABLE.
 */
function patch0019ColumnGaps(): number {
  const filepath = join(MIGRATIONS_DIR, '0019_p0-7-multi-tenant-scoping.sql');
  let sql = readFileSync(filepath, 'utf8');
  let fixes = 0;

  // Tables created by earlier migrations (0010-0012) that 0019 recreates with organization_id
  const gapTables = [
    'announcement_stats',
    'dues_category_override',
    'dues_fund_allocation',
    'dues_reminder_schedule',
    'election_nominee',
    'election_vote',
    'notification_preference',
  ];

  for (const table of gapTables) {
    const marker = `CREATE TABLE IF NOT EXISTS "${table}"`;
    const idx = sql.indexOf(marker);
    if (idx === -1) continue;

    // Find the --> statement-breakpoint after this CREATE TABLE
    const bpIdx = sql.indexOf('--> statement-breakpoint', idx);
    if (bpIdx === -1) continue;

    const insertPoint = bpIdx + '--> statement-breakpoint'.length;

    // Check if we already added this
    const nextChunk = sql.slice(insertPoint, insertPoint + 200);
    if (nextChunk.includes(`table_name='${table}' AND column_name='organization_id'`)) continue;

    const addCol = `\nDO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='organization_id')
  THEN ALTER TABLE "${table}" ADD COLUMN "organization_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;
END $$;--> statement-breakpoint`;

    sql = sql.slice(0, insertPoint) + addCol + sql.slice(insertPoint);
    fixes++;
  }

  // Also handle person_privacy_setting.org_id (dropped by 0014, needed for index)
  const ppsMarker = `CREATE TABLE IF NOT EXISTS "person_privacy_setting"`;
  const ppsIdx = sql.indexOf(ppsMarker);
  if (ppsIdx !== -1) {
    const bpIdx = sql.indexOf('--> statement-breakpoint', ppsIdx);
    if (bpIdx !== -1) {
      const insertPoint = bpIdx + '--> statement-breakpoint'.length;
      const nextChunk = sql.slice(insertPoint, insertPoint + 200);
      if (!nextChunk.includes(`table_name='person_privacy_setting' AND column_name='org_id'`)) {
        const addCol = `\nDO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='person_privacy_setting' AND column_name='org_id')
  THEN ALTER TABLE "person_privacy_setting" ADD COLUMN "org_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;
END $$;--> statement-breakpoint`;
        sql = sql.slice(0, insertPoint) + addCol + sql.slice(insertPoint);
        fixes++;
      }
    }
  }

  writeFileSync(filepath, sql);
  return fixes;
}

/**
 * Special handling for 0019: tenant_id→organization_id chain.
 * 0014 drops tenant_id. 0019's conditional RENAME finds no tenant_id, skips.
 * Need ADD COLUMN fallback for organization_id after each RENAME block.
 */
function patch0019TenantIdChain(): number {
  const filepath = join(MIGRATIONS_DIR, '0019_p0-7-multi-tenant-scoping.sql');
  let sql = readFileSync(filepath, 'utf8');
  let fixes = 0;

  // Tables where 0014 drops tenant_id but 0019 needs organization_id
  const tables = [
    'training', 'training_enrollment', 'course', 'course_enrollment', 'quiz_attempt',
    'event', 'event_registration', 'check_in', 'waitlist_entry',
    'dues_config', 'dues_invoice', 'aging_bucket',
    'position', 'officer_term', 'credit_entry',
    'membership_category', 'membership', 'membership_application', 'membership_tier',
    'chapter_affiliation', 'affiliation_transfer', 'royalty_split', 'directory_profile',
    'message_template', 'message', 'subscription_topic', 'person_subscription',
    'document', 'document_tag', 'document_version',
  ];

  for (const table of tables) {
    // Check if organization_id ADD COLUMN already exists for this table
    const existsCheck = `table_name='${table}' AND column_name='organization_id'`;
    if (sql.includes(existsCheck) && sql.includes(`ALTER TABLE "${table}" ADD COLUMN "organization_id"`)) continue;

    // Find the RENAME block for this table (if any)
    const renameMarker = `table_name='${table}' AND column_name='tenant_id'`;
    let insertPoint: number;

    const renameIdx = sql.indexOf(renameMarker);
    if (renameIdx !== -1) {
      // Insert after this DO block's --> statement-breakpoint
      const endBlock = sql.indexOf('--> statement-breakpoint', renameIdx);
      if (endBlock === -1) continue;
      insertPoint = endBlock + '--> statement-breakpoint'.length;
    } else {
      // No RENAME block — find the first CREATE INDEX section as insertion point
      const firstIndex = sql.indexOf('CREATE INDEX IF NOT EXISTS');
      if (firstIndex === -1) continue;
      const beforeIndex = sql.lastIndexOf('--> statement-breakpoint', firstIndex);
      if (beforeIndex === -1) continue;
      insertPoint = beforeIndex + '--> statement-breakpoint'.length;
    }

    const addBlock = `\nDO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='organization_id')
  THEN ALTER TABLE "${table}" ADD COLUMN "organization_id" uuid;
  END IF;
END $$;--> statement-breakpoint`;

    sql = sql.slice(0, insertPoint) + addBlock + sql.slice(insertPoint);
    fixes++;
  }

  writeFileSync(filepath, sql);
  return fixes;
}

// --- Main ---
console.log('🔧 Migration fixer for clean install\n');

const files = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${files.length} migration files`);
console.log(`Skipping ${SKIP.size} already-safe files\n`);

// Pass 1: Generic idempotency fixes across all non-skip migrations
for (const file of files) {
  if (SKIP.has(file)) {
    continue;
  }
  const fixes = patchFile(file);
  if (fixes > 0) {
    console.log(`  ${file}: ${fixes} fixes`);
    totalFixes += fixes;
  }
}

// Pass 2: 0019-specific column gap patches
const gapFixes = patch0019ColumnGaps();
if (gapFixes > 0) {
  console.log(`  0019 column gaps: ${gapFixes} fixes`);
  totalFixes += gapFixes;
}

// Pass 3: 0019-specific tenant_id→organization_id chain
const chainFixes = patch0019TenantIdChain();
if (chainFixes > 0) {
  console.log(`  0019 tenant_id chain: ${chainFixes} fixes`);
  totalFixes += chainFixes;
}

console.log(`\n✅ Total: ${totalFixes} fixes applied`);
console.log('\nNext steps:');
console.log('  1. bun dev              # start API (runs patched migrations)');
console.log('  2. psql ... -f scripts/post-migration-fixup.sql');
console.log('  3. bun run db:seed');
console.log('  4. git checkout -- src/generated/migrations/   # restore originals');
