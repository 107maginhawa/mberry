/**
 * Seed script for Phase 1 development data.
 *
 * Creates: 1 association, 2 orgs, membership tiers, categories,
 * 2 test users with persons and memberships.
 *
 * Requires: API server running on port 7213 (for auth sign-up).
 * Run: cd services/api-ts && bun run db:seed
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { associations, organizations } from './handlers/platformadmin/repos/platform-admin.schema';
import { membershipTiers, membershipCategories, memberships } from './handlers/association:member/repos/membership.schema';
import { positions, officerTerms } from './handlers/association:member/repos/governance.schema';
import { persons } from './handlers/person/repos/person.schema';
import { user as userTable } from './generated/better-auth/schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://elad-mini@localhost:5432/monobase';
const API_URL = process.env.API_URL || 'http://localhost:7213';

// Test credentials
const TEST_USERS = [
  {
    email: 'test@memberry.ph',
    password: 'TestPass123!',
    name: 'Maria Santos',
    firstName: 'Maria',
    lastName: 'Santos',
    specialization: 'Orthodontics',
    licenseNumber: '0012345',
    dbRole: 'admin,association:admin,association:member',
  },
  {
    email: 'member@memberry.ph',
    password: 'TestPass123!',
    name: 'Juan Cruz',
    firstName: 'Juan',
    lastName: 'Cruz',
    specialization: 'General Dentistry',
    licenseNumber: '0067890',
    dbRole: 'association:member',
  },
];

async function signUpUser(email: string, password: string, name: string): Promise<{ userId: string; cookie: string } | null> {
  const res = await fetch(`${API_URL}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (res.status === 409 || res.status === 422) {
    // User already exists — sign in instead to get cookie
    const signIn = await fetch(`${API_URL}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!signIn.ok) {
      console.log(`  ⚠ User ${email} exists but sign-in failed (${signIn.status}). Skipping.`);
      return null;
    }
    const data = await signIn.json() as any;
    const cookie = extractSessionCookie(signIn);
    return { userId: data.user?.id || data.id, cookie };
  }

  if (!res.ok) {
    const text = await res.text();
    console.log(`  ⚠ Sign-up failed for ${email}: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as any;
  const cookie = extractSessionCookie(res);
  return { userId: data.user?.id || data.id, cookie };
}

/** Extract session cookie value from set-cookie headers */
function extractSessionCookie(res: Response): string {
  const cookies: string[] = [];
  // Bun's Headers.getSetCookie() returns array of set-cookie values
  const setCookies = (res.headers as any).getSetCookie?.() ?? [res.headers.get('set-cookie') || ''];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) cookies.push(match[1]!);
  }
  return cookies.join('; ');
}

async function createPerson(
  cookie: string,
  data: { firstName: string; lastName: string; specialization: string; licenseNumber: string; email: string },
): Promise<string | null> {
  const res = await fetch(`${API_URL}/persons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      firstName: data.firstName,
      lastName: data.lastName,
      specialization: data.specialization,
      licenseNumber: data.licenseNumber,
      contactInfo: { email: data.email },
    }),
  });

  if (res.status === 409) {
    console.log(`  ⚠ Person for ${data.email} already exists. Skipping.`);
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    console.log(`  ⚠ Create person failed for ${data.email}: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }

  const body = await res.json() as any;
  return body.id || body.data?.id || null;
}

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding Phase 1 data...\n');

  // ─── 1. Association (idempotent) ───
  const existingAssoc = await db.select().from(associations).where(eq(associations.name, 'Philippine Dental Association')).limit(1);
  let assoc: any;

  if (existingAssoc.length > 0) {
    assoc = existingAssoc[0];
    console.log(`  Association: ${assoc.name} (exists: ${assoc.id})`);
  } else {
    [assoc] = await db.insert(associations).values({
      name: 'Philippine Dental Association',
      country: 'PH',
      currency: 'PHP',
      locale: 'en',
      licenseFormatRegex: '^\\d{4,7}$',
      creditCyclePeriod: 36,
      requiredCreditsPerCycle: 60,
      carryoverEnabled: true,
      status: 'active',
    }).returning();
    console.log(`  Association: ${assoc.name} (${assoc.id})`);
  }

  // ─── 2. Organizations (idempotent) ───
  const existingOrg1 = await db.select().from(organizations).where(eq(organizations.slug, 'pda-metro-manila')).limit(1);
  let org1: any;

  if (existingOrg1.length > 0) {
    org1 = existingOrg1[0];
    console.log(`  Org 1: ${org1.name} (exists: ${org1.id})`);
  } else {
    [org1] = await db.insert(organizations).values({
      associationId: assoc.id,
      name: 'PDA Metro Manila Chapter',
      slug: 'pda-metro-manila',
      orgType: 'chapter',
      region: 'NCR',
      contactEmail: 'metromanila@pda.ph',
      status: 'active',
    }).returning();
    console.log(`  Org 1: ${org1.name} (${org1.id})`);
  }

  const existingOrg2 = await db.select().from(organizations).where(eq(organizations.slug, 'pda-cebu')).limit(1);
  let org2: any;

  if (existingOrg2.length > 0) {
    org2 = existingOrg2[0];
    console.log(`  Org 2: ${org2.name} (exists: ${org2.id})`);
  } else {
    [org2] = await db.insert(organizations).values({
      associationId: assoc.id,
      name: 'PDA Cebu Chapter',
      slug: 'pda-cebu',
      orgType: 'chapter',
      region: 'Region VII',
      contactEmail: 'cebu@pda.ph',
      status: 'active',
    }).returning();
    console.log(`  Org 2: ${org2.name} (${org2.id})`);
  }

  // ─── 3. Membership Tiers (idempotent) ───
  const existingTiers = await db.select().from(membershipTiers).where(eq(membershipTiers.tenantId, org1.id));
  let regularTier: any;
  let associateTier: any;

  if (existingTiers.length >= 2) {
    regularTier = existingTiers.find((t: any) => t.code === 'REGULAR') || existingTiers[0];
    associateTier = existingTiers.find((t: any) => t.code === 'ASSOCIATE') || existingTiers[1];
    console.log(`  Tiers: exist (${existingTiers.length} found)`);
  } else {
    [regularTier] = await db.insert(membershipTiers).values({
      tenantId: org1.id,
      name: 'Regular Member',
      code: 'REGULAR',
      description: 'Standard membership for licensed dentists',
      annualFee: 250000,
      currency: 'PHP',
      benefits: ['Directory listing', 'Event discounts', 'CPD tracking'],
      status: 'active',
    }).returning();

    [associateTier] = await db.insert(membershipTiers).values({
      tenantId: org1.id,
      name: 'Associate Member',
      code: 'ASSOCIATE',
      description: 'For dental students and recent graduates',
      annualFee: 100000,
      currency: 'PHP',
      benefits: ['Directory listing', 'Event access'],
      status: 'active',
    }).returning();
    console.log(`  Tier: ${regularTier.name} - PHP ${regularTier.annualFee / 100}`);
    console.log(`  Tier: ${associateTier.name} - PHP ${associateTier.annualFee / 100}`);
  }

  // ─── 4. Membership Categories (idempotent) ───
  const existingCats = await db.select().from(membershipCategories).where(eq(membershipCategories.tenantId, org1.id));

  if (existingCats.length >= 2) {
    console.log(`  Categories: exist (${existingCats.length} found)`);
  } else {
    await db.insert(membershipCategories).values({
      tenantId: org1.id,
      orgId: org1.id,
      name: 'Practicing Dentist',
      description: 'Licensed and actively practicing',
      applicableTiers: [regularTier.id],
    });
    await db.insert(membershipCategories).values({
      tenantId: org1.id,
      orgId: org1.id,
      name: 'Student',
      description: 'Currently enrolled in dental school',
      applicableTiers: [associateTier.id],
    });
    console.log(`  Categories: created (Practicing Dentist, Student)`);
  }

  // ─── 5. Test Users (via API — requires server running) ───
  console.log('\n  Creating test users (requires API on port 7213)...');

  const personIds: string[] = [];

  for (const user of TEST_USERS) {
    const auth = await signUpUser(user.email, user.password, user.name);
    if (!auth) {
      console.log(`  ⚠ Skipping ${user.email}`);
      continue;
    }
    console.log(`  User: ${user.email} (${auth.userId})`);

    // Create person FIRST (uses original session cookie before role change)
    const personId = await createPerson(auth.cookie, {
      firstName: user.firstName,
      lastName: user.lastName,
      specialization: user.specialization,
      licenseNumber: user.licenseNumber,
      email: user.email,
    });

    if (personId) {
      personIds.push(personId);
      console.log(`  Person: ${user.firstName} ${user.lastName} (${personId})`);
    }

    // Assign proper roles AFTER person creation
    await db.update(userTable)
      .set({ role: user.dbRole })
      .where(eq(userTable.email, user.email));
    console.log(`  Role: ${user.dbRole}`);
  }

  // ─── 6. Memberships (direct DB insert) ───
  if (personIds.length > 0) {
    const existingMemberships = await db.select().from(memberships).where(eq(memberships.orgId, org1.id));

    if (existingMemberships.length === 0) {
      for (let i = 0; i < personIds.length; i++) {
        const tier = i === 0 ? regularTier : associateTier;
        await db.insert(memberships).values({
          tenantId: org1.id,
          personId: personIds[i]!,
          orgId: org1.id,
          tierId: tier.id,
          memberNumber: `PDA-2025-${String(i + 1).padStart(3, '0')}`,
          startDate: '2025-01-01',
          duesExpiryDate: '2025-12-31',
          gracePeriodDays: 30,
          status: 'active',
          joinedAt: new Date(),
        });
        console.log(`  Membership: PDA-2025-${String(i + 1).padStart(3, '0')} (${TEST_USERS[i]!.email})`);
      }
    } else {
      console.log(`  Memberships: exist (${existingMemberships.length} found)`);
    }
  }

  // ─── 7. Officer Position + Term for admin user ───
  if (personIds.length > 0) {
    const existingPositions = await db.select().from(positions).where(eq(positions.organizationId, org1.id));

    if (existingPositions.length === 0) {
      const [presidentPos] = await db.insert(positions).values({
        tenantId: org1.id,
        organizationId: org1.id,
        title: 'President',
        description: 'Association President',
        level: 'chapter',
        termLengthMonths: 24,
        sortOrder: 1,
      }).returning();

      await db.insert(officerTerms).values({
        tenantId: org1.id,
        positionId: presidentPos!.id,
        personId: personIds[0]!,
        organizationId: org1.id,
        status: 'active',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-12-31'),
      });
      console.log(`  Officer: ${TEST_USERS[0]!.name} → President (active term)`);
    } else {
      console.log(`  Officer positions: exist (${existingPositions.length} found)`);
    }
  }

  // ─── Summary ───
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         SEED COMPLETE                    ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  App:  http://localhost:3004             ║');
  console.log('║                                         ║');
  console.log('║  Officer account:                       ║');
  console.log('║    Email:    test@memberry.ph            ║');
  console.log('║    Password: TestPass123!               ║');
  console.log('║                                         ║');
  console.log('║  Member account:                        ║');
  console.log('║    Email:    member@memberry.ph          ║');
  console.log('║    Password: TestPass123!               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Org ID: ${org1.id}  ║`);
  console.log('║  Public: /org/pda-metro-manila          ║');
  console.log('╚══════════════════════════════════════════╝');

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
