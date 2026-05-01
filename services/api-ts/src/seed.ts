/**
 * Seed script for Phase 1 development data.
 *
 * Creates: 1 association, 2 orgs (with slugs), membership tiers, categories.
 * Run: cd services/api-ts && bun run src/seed.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { associations, organizations } from './handlers/platformadmin/repos/platform-admin.schema';
import { membershipTiers, membershipCategories } from './handlers/association:member/repos/membership.schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://elad-mini@localhost:5432/monobase';

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding Phase 1 data...');

  // 1. Association
  const [assoc] = await db.insert(associations).values({
    name: 'Philippine Dental Association',
    country: 'PH',
    currency: 'PHP',
    locale: 'en',
    licenseFormatRegex: '^\\d{4,7}$',
    creditCyclePeriod: 36, // 3 years
    requiredCreditsPerCycle: 60,
    carryoverEnabled: true,
    status: 'active',
  }).returning();

  console.log(`  Association: ${assoc.name} (${assoc.id})`);

  // 2. Organizations
  const [org1] = await db.insert(organizations).values({
    associationId: assoc.id,
    name: 'PDA Metro Manila Chapter',
    slug: 'pda-metro-manila',
    orgType: 'chapter',
    region: 'NCR',
    contactEmail: 'metromanila@pda.ph',
    status: 'active',
  }).returning();

  const [org2] = await db.insert(organizations).values({
    associationId: assoc.id,
    name: 'PDA Cebu Chapter',
    slug: 'pda-cebu',
    orgType: 'chapter',
    region: 'Region VII',
    contactEmail: 'cebu@pda.ph',
    status: 'active',
  }).returning();

  console.log(`  Org 1: ${org1.name} (${org1.id}) slug: ${org1.slug}`);
  console.log(`  Org 2: ${org2.name} (${org2.id}) slug: ${org2.slug}`);

  // 3. Membership Tiers
  const [regularTier] = await db.insert(membershipTiers).values({
    tenantId: org1.id,
    name: 'Regular Member',
    code: 'REGULAR',
    description: 'Standard membership for licensed dentists',
    annualFee: 250000, // PHP 2,500.00 in centavos
    currency: 'PHP',
    benefits: ['Directory listing', 'Event discounts', 'CPD tracking'],
    status: 'active',
  }).returning();

  const [associateTier] = await db.insert(membershipTiers).values({
    tenantId: org1.id,
    name: 'Associate Member',
    code: 'ASSOCIATE',
    description: 'For dental students and recent graduates',
    annualFee: 100000, // PHP 1,000.00
    currency: 'PHP',
    benefits: ['Directory listing', 'Event access'],
    status: 'active',
  }).returning();

  console.log(`  Tier: ${regularTier.name} (${regularTier.id}) - PHP ${regularTier.annualFee / 100}`);
  console.log(`  Tier: ${associateTier.name} (${associateTier.id}) - PHP ${associateTier.annualFee / 100}`);

  // 4. Membership Categories
  const [practitionerCat] = await db.insert(membershipCategories).values({
    tenantId: org1.id,
    orgId: org1.id,
    name: 'Practicing Dentist',
    description: 'Licensed and actively practicing',
    applicableTiers: [regularTier.id],
  }).returning();

  const [studentCat] = await db.insert(membershipCategories).values({
    tenantId: org1.id,
    orgId: org1.id,
    name: 'Student',
    description: 'Currently enrolled in dental school',
    applicableTiers: [associateTier.id],
  }).returning();

  console.log(`  Category: ${practitionerCat.name} (${practitionerCat.id})`);
  console.log(`  Category: ${studentCat.name} (${studentCat.id})`);

  // Summary
  console.log('\n--- Seed Complete ---');
  console.log(`Association: ${assoc.id}`);
  console.log(`Org 1 (Metro Manila): ${org1.id}`);
  console.log(`Org 2 (Cebu): ${org2.id}`);
  console.log(`Public URLs: /public/org/pda-metro-manila, /public/org/pda-cebu`);
  console.log('\nSign up at http://localhost:3004 to create a user,');
  console.log('then create a membership via API to test org-scoped features.');

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
