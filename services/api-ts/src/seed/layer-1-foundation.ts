import type { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { associations, organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { membershipTiers, membershipCategories } from '@/handlers/association:member/repos/membership.schema';

export async function bootstrapDB(db: ReturnType<typeof drizzle>) {
  console.log('Phase 0: DB Bootstrap...');

  // Association
  let [assoc] = await db.select().from(associations).where(eq(associations.name, 'Philippine Dental Association')).limit(1);
  if (!assoc) {
    [assoc] = await db.insert(associations).values({
      name: 'Philippine Dental Association',
      country: 'PH', currency: 'PHP', locale: 'en',
      licenseFormatRegex: '^\\d{4,7}$',
      creditCyclePeriod: 36, requiredCreditsPerCycle: 60,
      carryoverEnabled: true, status: 'active',
    }).returning();
  }
  console.log(`  ✓ Association: ${assoc!.name}`);

  // Org 1: Metro Manila
  let [org1] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-metro-manila')).limit(1);
  if (!org1) {
    [org1] = await db.insert(organizations).values({
      id: 'ed8e3a96-8126-4341-be42-e6eb7940c562',
      associationId: assoc!.id, name: 'PDA Metro Manila Chapter',
      slug: 'pda-metro-manila', orgType: 'chapter', region: 'NCR',
      contactEmail: 'metromanila@pda.ph', status: 'active',
    }).returning();
  }
  console.log(`  ✓ Org: ${org1!.name}`);

  // Org 2: Cebu (minimal, for IDOR testing)
  let [org2] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-cebu')).limit(1);
  if (!org2) {
    [org2] = await db.insert(organizations).values({
      associationId: assoc!.id, name: 'PDA Cebu Chapter',
      slug: 'pda-cebu', orgType: 'chapter', region: 'Region VII',
      contactEmail: 'cebu@pda.ph', status: 'active',
    }).returning();
  }
  console.log(`  ✓ Org: ${org2!.name}`);

  // Membership tiers
  const existingTiers = await db.select().from(membershipTiers).where(eq(membershipTiers.organizationId, org1!.id));
  let regularTier: any, associateTier: any;
  if (existingTiers.length === 0) {
    const tierRows = await db.insert(membershipTiers).values([
      { organizationId: org1!.id, name: 'Regular', code: 'REGULAR', annualFee: 3000, currency: 'PHP', benefits: ['Voting rights', 'CPD credits', 'Event discounts'], status: 'active' },
      { organizationId: org1!.id, name: 'Associate', code: 'ASSOCIATE', annualFee: 1500, currency: 'PHP', benefits: ['CPD credits', 'Event access'], status: 'active' },
    ]).returning();
    regularTier = tierRows[0]; associateTier = tierRows[1];
  } else {
    regularTier = existingTiers.find((t: any) => t.code === 'REGULAR');
    associateTier = existingTiers.find((t: any) => t.code === 'ASSOCIATE');
  }
  console.log(`  ✓ Tiers: Regular (${regularTier.id}), Associate (${associateTier.id})`);

  // Membership categories
  const existingCats = await db.select().from(membershipCategories).where(eq(membershipCategories.organizationId, org1!.id));
  if (existingCats.length === 0) {
    await db.insert(membershipCategories).values([
      { organizationId: org1!.id, name: 'Regular', applicableTiers: [regularTier.id] },
      { organizationId: org1!.id, name: 'Associate', applicableTiers: [associateTier.id] },
    ]);
  }
  console.log(`  ✓ Categories: Regular, Associate`);

  // Org2 tier (needed for IDOR test officer)
  const existingOrg2Tiers = await db.select().from(membershipTiers).where(eq(membershipTiers.organizationId, org2!.id));
  let org2RegularTier: any;
  if (existingOrg2Tiers.length === 0) {
    const [t] = await db.insert(membershipTiers).values([
      { organizationId: org2!.id, name: 'Regular', code: 'REGULAR', annualFee: 3000, currency: 'PHP', benefits: ['Voting rights', 'CPD credits'], status: 'active' },
    ]).returning();
    org2RegularTier = t;
  } else {
    org2RegularTier = existingOrg2Tiers[0];
  }

  return { assocId: assoc!.id, orgId: org1!.id, org2Id: org2!.id, regularTierId: regularTier.id, associateTierId: associateTier.id, org2RegularTierId: org2RegularTier.id };
}
