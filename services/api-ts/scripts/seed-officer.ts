#!/usr/bin/env bun

/**
 * Dev seed script: ensures the given user has an active President officer term.
 *
 * Usage:
 *   bun run scripts/seed-officer.ts                    # auto-detect from DB
 *   bun run scripts/seed-officer.ts <personId> <orgId> # explicit IDs
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import pg from 'pg';
import { parseConfig } from '../src/core/config';
import { positions, officerTerms } from '../src/handlers/association:member/repos/governance.schema';

const config = parseConfig();

const pool = new pg.Pool({ connectionString: config.database.url });
const db = drizzle(pool);

async function main() {
  let personId = process.argv[2];
  let orgId = process.argv[3];

  // Auto-detect if not provided
  if (!personId || !orgId) {
    console.log('No args provided — auto-detecting from DB...');

    // Get the most recent user
    const userRow = await db.execute(
      sql`SELECT id FROM "user" ORDER BY "created_at" DESC LIMIT 1`,
    );
    personId = (userRow.rows[0] as any)?.id;
    if (!personId) {
      console.error('No users found in DB. Sign in first.');
      process.exit(1);
    }

    // Get the most recent organization
    const orgRow = await db.execute(
      sql`SELECT id FROM "organization" ORDER BY "created_at" DESC LIMIT 1`,
    );
    orgId = (orgRow.rows[0] as any)?.id;
    if (!orgId) {
      console.error('No organizations found in DB. Create one first.');
      process.exit(1);
    }
  }

  console.log(`Person: ${personId}`);
  console.log(`Org:    ${orgId}`);

  // Upsert President position
  const existing = await db
    .select()
    .from(positions)
    .where(and(eq(positions.organizationId, orgId), eq(positions.title, 'President')))
    .limit(1);

  let positionId: string;
  if (existing.length > 0) {
    positionId = existing[0]!.id;
    console.log(`Position "President" already exists: ${positionId}`);
  } else {
    const [created] = await db
      .insert(positions)
      .values({
        organizationId: orgId,
        title: 'President',
        description: 'Board President',
        level: 'chapter',
        termLengthMonths: 12,
        sortOrder: 0,
      })
      .returning();
    positionId = created!.id;
    console.log(`Created position "President": ${positionId}`);
  }

  // Upsert active officer term
  const existingTerm = await db
    .select()
    .from(officerTerms)
    .where(
      and(
        eq(officerTerms.personId, personId),
        eq(officerTerms.organizationId, orgId),
        eq(officerTerms.positionId, positionId),
        eq(officerTerms.status, 'active'),
      ),
    )
    .limit(1);

  if (existingTerm.length > 0) {
    console.log(`Active officer term already exists: ${existingTerm[0]!.id}`);
  } else {
    const [term] = await db
      .insert(officerTerms)
      .values({
        positionId,
        personId,
        organizationId: orgId,
        status: 'active',
        startDate: new Date(),
        notes: 'Dev seed — auto-assigned President',
      })
      .returning();
    console.log(`Created active officer term: ${term!.id}`);
  }

  console.log('\nDone. User now has President role. Election status transitions should work.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
