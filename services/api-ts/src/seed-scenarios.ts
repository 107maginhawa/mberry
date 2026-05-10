/**
 * API-driven seed script — seeds all data through realistic user journeys.
 *
 * Replaces: seed.ts, seed-modules.ts, seed-rich.ts
 *
 * Architecture: thin DB bootstrap (chicken-and-egg items) + API-driven journeys.
 * Requires: API server running on port 7213.
 * Idempotent — safe to re-run.
 *
 * Run: cd services/api-ts && bun run db:seed-scenarios
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { associations, organizations, platformAdmins } from './handlers/platformadmin/repos/platform-admin.schema';
import { membershipTiers, membershipCategories, memberships, membershipApplications } from './handlers/association:member/repos/membership.schema';
import { positions, officerTerms } from './handlers/association:member/repos/governance.schema';
import { persons } from './handlers/person/repos/person.schema';
import { user as userTable } from './generated/better-auth/schema';
import { events, eventRegistrations } from './handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from './handlers/association:operations/repos/training.schema';
import { creditEntries } from './handlers/association:member/repos/credits.schema';

const DATABASE_URL = process.env['DATABASE_URL'] || 'postgres://elad-mini@localhost:5432/monobase';
const API_URL = process.env['API_URL'] || 'http://localhost:7213';
const PASSWORD = 'TestPass123!';

// ═══════════════════════════════════════════════════════════════
// SeedClient — fetch wrapper with auth cookie management
// ═══════════════════════════════════════════════════════════════

class SeedClient {
  cookie = '';
  orgId = '';
  personId = '';
  userId = '';
  email = '';

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async signUp(email: string, name: string): Promise<boolean> {
    this.email = email;
    const res = await fetch(`${API_URL}/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, name }),
    });
    if (res.status === 409 || res.status === 422) {
      // Already exists — sign in instead
      return this.signIn(email);
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(`  ✗ Sign-up failed for ${email}: ${res.status} ${text.slice(0, 200)}`);
      return false;
    }
    const data = await res.json() as any;
    this.userId = data.user?.id || data.id || '';
    this.cookie = extractCookie(res);
    return true;
  }

  async signIn(email: string): Promise<boolean> {
    this.email = email;
    const res = await fetch(`${API_URL}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!res.ok) {
      console.error(`  ✗ Sign-in failed for ${email}: ${res.status}`);
      return false;
    }
    const data = await res.json() as any;
    this.userId = data.user?.id || data.id || '';
    this.cookie = extractCookie(res);
    return true;
  }

  async createPerson(data: {
    firstName: string; lastName: string;
    specialization?: string; licenseNumber?: string;
    dateOfBirth?: string; gender?: string;
  }): Promise<string | null> {
    const res = await this.post('/persons', {
      ...data,
      contactInfo: { email: this.email },
    });
    if (res?.__conflict) {
      // Person exists — fetch
      const existing = await this.get('/persons/me');
      this.personId = existing?.id || '';
      return this.personId;
    }
    this.personId = res?.id || res?.data?.id || '';
    return this.personId;
  }

  async post(path: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: this.cookie,
    };
    if (this.orgId && path.startsWith('/association/')) {
      headers['x-org-id'] = this.orgId;
    }
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 409) return { __conflict: true };
    if (!res.ok) {
      const text = await res.text();
      console.error(`  ✗ POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async get(path: string): Promise<any> {
    const headers: Record<string, string> = {
      Cookie: this.cookie,
    };
    if (this.orgId && path.startsWith('/association/')) {
      headers['x-org-id'] = this.orgId;
    }
    const res = await fetch(`${API_URL}${path}`, { headers });
    if (!res.ok) return null;
    return res.json();
  }

  async patch(path: string, body: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: this.cookie,
    };
    if (this.orgId && path.startsWith('/association/')) {
      headers['x-org-id'] = this.orgId;
    }
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }
}

function extractCookie(res: Response): string {
  const cookies: string[] = [];
  const setCookies = (res.headers as any).getSetCookie?.() ?? [res.headers.get('set-cookie') || ''];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) cookies.push(match[1]!);
  }
  return cookies.join('; ');
}

// ═══════════════════════════════════════════════════════════════
// Filipino persona data
// ═══════════════════════════════════════════════════════════════

const OFFICERS = [
  { email: 'test@memberry.ph', firstName: 'Maria', lastName: 'Santos', position: 'President', spec: 'Orthodontics', license: '0012345' },
  { email: 'treasurer@memberry.ph', firstName: 'Juan', lastName: 'Cruz', position: 'Treasurer', spec: 'Prosthodontics', license: '0023456' },
  { email: 'secretary@memberry.ph', firstName: 'Ana', lastName: 'Reyes', position: 'Secretary', spec: 'Pediatric Dentistry', license: '0034567' },
  { email: 'society@memberry.ph', firstName: 'Carlos', lastName: 'Diaz', position: 'Society Officer', spec: 'Endodontics', license: '0045678' },
  { email: 'membership@memberry.ph', firstName: 'Sofia', lastName: 'Garcia', position: 'Membership Chair', spec: 'General Dentistry', license: '0056789' },
];

const MEMBERS: { email: string; firstName: string; lastName: string; spec: string; license: string; status: 'active' | 'grace' | 'lapsed' }[] = [
  // Legacy test user (referenced by 6+ test files — DO NOT REMOVE)
  { email: 'member@memberry.ph', firstName: 'Miguel', lastName: 'Bautista', spec: 'General Dentistry', license: '0099999', status: 'active' },
  // 20 active
  { email: 'member01@memberry.ph', firstName: 'Isabella', lastName: 'Dela Cruz', spec: 'General Dentistry', license: '0100001', status: 'active' },
  { email: 'member02@memberry.ph', firstName: 'Luis', lastName: 'Ramos', spec: 'Oral Surgery', license: '0100002', status: 'active' },
  { email: 'member03@memberry.ph', firstName: 'Patricia', lastName: 'Navarro', spec: 'Periodontics', license: '0100003', status: 'active' },
  { email: 'member04@memberry.ph', firstName: 'Fernando', lastName: 'Bautista', spec: 'Orthodontics', license: '0100004', status: 'active' },
  { email: 'member05@memberry.ph', firstName: 'Carmen', lastName: 'Aquino', spec: 'Endodontics', license: '0100005', status: 'active' },
  { email: 'member06@memberry.ph', firstName: 'Roberto', lastName: 'Flores', spec: 'Prosthodontics', license: '0100006', status: 'active' },
  { email: 'member07@memberry.ph', firstName: 'Teresa', lastName: 'Santiago', spec: 'Pediatric Dentistry', license: '0100007', status: 'active' },
  { email: 'member08@memberry.ph', firstName: 'Antonio', lastName: 'Torres', spec: 'General Dentistry', license: '0100008', status: 'active' },
  { email: 'member09@memberry.ph', firstName: 'Rosa', lastName: 'Mendoza', spec: 'Oral Pathology', license: '0100009', status: 'active' },
  { email: 'member10@memberry.ph', firstName: 'Diego', lastName: 'Rivera', spec: 'Orthodontics', license: '0100010', status: 'active' },
  { email: 'member11@memberry.ph', firstName: 'Lucia', lastName: 'Hernandez', spec: 'General Dentistry', license: '0100011', status: 'active' },
  { email: 'member12@memberry.ph', firstName: 'Marco', lastName: 'Lim', spec: 'Prosthodontics', license: '0100012', status: 'active' },
  { email: 'member13@memberry.ph', firstName: 'Gabriela', lastName: 'Tan', spec: 'Periodontics', license: '0100013', status: 'active' },
  { email: 'member14@memberry.ph', firstName: 'Pedro', lastName: 'Sy', spec: 'Oral Surgery', license: '0100014', status: 'active' },
  { email: 'member15@memberry.ph', firstName: 'Andrea', lastName: 'Ong', spec: 'General Dentistry', license: '0100015', status: 'active' },
  { email: 'member16@memberry.ph', firstName: 'Jose', lastName: 'Co', spec: 'Endodontics', license: '0100016', status: 'active' },
  { email: 'member17@memberry.ph', firstName: 'Valeria', lastName: 'Chua', spec: 'General Dentistry', license: '0100017', status: 'active' },
  { email: 'member18@memberry.ph', firstName: 'Ricardo', lastName: 'Go', spec: 'Pediatric Dentistry', license: '0100018', status: 'active' },
  { email: 'member19@memberry.ph', firstName: 'Catalina', lastName: 'Yap', spec: 'General Dentistry', license: '0100019', status: 'active' },
  { email: 'member20@memberry.ph', firstName: 'Eduardo', lastName: 'Ang', spec: 'Prosthodontics', license: '0100020', status: 'active' },
  // 3 grace period
  { email: 'member21@memberry.ph', firstName: 'Mariana', lastName: 'Castillo', spec: 'General Dentistry', license: '0100021', status: 'grace' },
  { email: 'member22@memberry.ph', firstName: 'Sergio', lastName: 'Wu', spec: 'Oral Surgery', license: '0100022', status: 'grace' },
  { email: 'member23@memberry.ph', firstName: 'Daniela', lastName: 'Lee', spec: 'Periodontics', license: '0100023', status: 'grace' },
  // 2 lapsed
  { email: 'member24@memberry.ph', firstName: 'Francisco', lastName: 'Gonzales', spec: 'General Dentistry', license: '0100024', status: 'lapsed' },
  { email: 'member25@memberry.ph', firstName: 'Claudia', lastName: 'Tiu', spec: 'Orthodontics', license: '0100025', status: 'lapsed' },
];

const APPLICANTS = [
  { email: 'applicant01@memberry.ph', firstName: 'Beatriz', lastName: 'Lao', spec: 'General Dentistry', license: '0200001' },
  { email: 'applicant02@memberry.ph', firstName: 'Manuel', lastName: 'Yu', spec: 'Prosthodontics', license: '0200002' },
];

// ═══════════════════════════════════════════════════════════════
// Phase 0: DB Bootstrap
// ═══════════════════════════════════════════════════════════════

async function bootstrapDB(db: ReturnType<typeof drizzle>) {
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
      { organizationId: org1!.id, name: 'Regular', code: 'REGULAR', annualFee: '3000', currency: 'PHP', benefits: ['Voting rights', 'CPD credits', 'Event discounts'], status: 'active', sortOrder: 1 },
      { organizationId: org1!.id, name: 'Associate', code: 'ASSOCIATE', annualFee: '1500', currency: 'PHP', benefits: ['CPD credits', 'Event access'], status: 'active', sortOrder: 2 },
    ] as any).returning();
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
    ] as any);
  }
  console.log(`  ✓ Categories: Regular, Associate`);

  // Org2 tier (needed for IDOR test officer)
  const existingOrg2Tiers = await db.select().from(membershipTiers).where(eq(membershipTiers.organizationId, org2!.id));
  let org2RegularTier: any;
  if (existingOrg2Tiers.length === 0) {
    const [t] = await db.insert(membershipTiers).values([
      { organizationId: org2!.id, name: 'Regular', code: 'REGULAR', annualFee: '3000', currency: 'PHP', benefits: ['Voting rights', 'CPD credits'], status: 'active', sortOrder: 1 },
    ] as any).returning();
    org2RegularTier = t;
  } else {
    org2RegularTier = existingOrg2Tiers[0];
  }

  return { assocId: assoc!.id, orgId: org1!.id, org2Id: org2!.id, regularTierId: regularTier.id, associateTierId: associateTier.id, org2RegularTierId: org2RegularTier.id };
}

async function verifyEmail(db: ReturnType<typeof drizzle>, email: string) {
  await db.update(userTable).set({ emailVerified: true } as any).where(eq(userTable.email, email));
}

// ═══════════════════════════════════════════════════════════════
// Phase 1: President (hybrid — API sign-up + DB bootstrap)
// ═══════════════════════════════════════════════════════════════

async function seedPresident(
  db: ReturnType<typeof drizzle>,
  orgId: string, regularTierId: string,
): Promise<SeedClient> {
  console.log('\nPhase 1: President (Maria Santos)...');
  const o = OFFICERS[0]!;
  const client = new SeedClient(orgId);

  await client.signUp(o.email, `${o.firstName} ${o.lastName}`);
  await verifyEmail(db, o.email);
  // Re-sign-in after email verify to get fresh session
  await client.signIn(o.email);

  await client.createPerson({
    firstName: o.firstName, lastName: o.lastName,
    specialization: o.spec, licenseNumber: o.license,
    dateOfBirth: '1978-03-15', gender: 'female',
  });

  // DB: membership (chicken-and-egg — no officer exists to approve)
  const existingMembership = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMembership.length === 0) {
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: 'PDA-2025-001',
      startDate: '2025-01-01', duesExpiryDate: '2025-12-31',
      gracePeriodDays: 30, status: 'active', joinedAt: new Date(),
    } as any);
  }

  // DB: position + officer term
  const existingPos = await db.select().from(positions)
    .where(eq(positions.title, 'President')).limit(1);
  let presPos: any;
  if (existingPos.length === 0) {
    [presPos] = await db.insert(positions).values({
      organizationId: orgId, title: 'President',
      level: 'chapter', termLengthMonths: 12, sortOrder: 1,
    } as any).returning();
  } else {
    presPos = existingPos[0];
  }

  const existingTerm = await db.select().from(officerTerms)
    .where(eq(officerTerms.personId, client.personId)).limit(1);
  if (existingTerm.length === 0) {
    await db.insert(officerTerms).values({
      positionId: presPos.id, personId: client.personId,
      organizationId: orgId, status: 'active',
      startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'),
    } as any);
  }

  // Platform admin
  const existingAdmin = await db.select().from(platformAdmins)
    .where(eq(platformAdmins.email, o.email)).limit(1);
  if (existingAdmin.length === 0) {
    await db.insert(platformAdmins).values({
      userId: client.userId, email: o.email, name: `${o.firstName} ${o.lastName}`, role: 'super',
    } as any);
  }

  // Set admin role so president can access all association endpoints
  await db.update(userTable).set({ role: 'admin,association:admin,association:member,association:officer' } as any).where(eq(userTable.id, client.userId));

  console.log(`  ✓ Maria Santos — President, membership PDA-2025-001`);
  return client;
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: Officers 2-5 (API-driven)
// ═══════════════════════════════════════════════════════════════

async function seedOfficer(
  db: ReturnType<typeof drizzle>,
  officer: typeof OFFICERS[0],
  orgId: string, regularTierId: string,
  president: SeedClient, memberNum: string,
): Promise<SeedClient> {
  const client = new SeedClient(orgId);
  await client.signUp(officer.email, `${officer.firstName} ${officer.lastName}`);
  await verifyEmail(db, officer.email);
  await client.signIn(officer.email);

  await client.createPerson({
    firstName: officer.firstName, lastName: officer.lastName,
    specialization: officer.spec, licenseNumber: officer.license,
    dateOfBirth: '1980-06-20', gender: officer.firstName === 'Juan' || officer.firstName === 'Carlos' ? 'male' : 'female',
  });

  // Create application + approve + membership via DB (2FA on requirePosition blocks API approve)
  const app = await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  if (app && !app.__conflict) {
    const appId = app.id || app.data?.id;
    if (appId) {
      // DB approve: update application status + create membership
      await db.update(membershipApplications)
        .set({ status: 'approved', reviewedAt: new Date() } as any)
        .where(eq(membershipApplications.id, appId));
    }
  }

  // Create membership via DB
  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: memberNum,
      startDate: new Date().toISOString().split('T')[0],
      duesExpiryDate: '2025-12-31',
      gracePeriodDays: 30, status: 'active', joinedAt: new Date(),
    } as any);
  }

  // Set officer role (needs member+officer+admin for all endpoint access)
  await db.update(userTable).set({ role: 'association:admin,association:member,association:officer' } as any).where(eq(userTable.id, client.userId));

  // Create position + officer term via DB (requirePosition check blocks API)
  const existingPos = await db.select().from(positions)
    .where(eq(positions.title, officer.position)).limit(1);
  let pos: any;
  if (existingPos.length === 0) {
    [pos] = await db.insert(positions).values({
      organizationId: orgId, title: officer.position,
      level: 'chapter', termLengthMonths: 12, sortOrder: OFFICERS.indexOf(officer) + 1,
    } as any).returning();
  } else {
    pos = existingPos[0];
  }

  const existingTerm = await db.select().from(officerTerms)
    .where(eq(officerTerms.personId, client.personId)).limit(1);
  if (existingTerm.length === 0) {
    await db.insert(officerTerms).values({
      positionId: pos.id, personId: client.personId,
      organizationId: orgId, status: 'active',
      startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'),
    } as any);
  }

  console.log(`  ✓ ${officer.firstName} ${officer.lastName} — ${officer.position}, ${memberNum}`);
  return client;
}

// ═══════════════════════════════════════════════════════════════
// Phase 3: Regular Members (API-driven)
// ═══════════════════════════════════════════════════════════════

async function seedMember(
  db: ReturnType<typeof drizzle>,
  member: typeof MEMBERS[0],
  orgId: string, regularTierId: string,
  president: SeedClient, memberNum: string,
): Promise<SeedClient> {
  const client = new SeedClient(orgId);
  await client.signUp(member.email, `${member.firstName} ${member.lastName}`);
  await verifyEmail(db, member.email);
  await client.signIn(member.email);

  await client.createPerson({
    firstName: member.firstName, lastName: member.lastName,
    specialization: member.spec, licenseNumber: member.license,
    dateOfBirth: `19${80 + Math.floor(Math.random() * 15)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    gender: ['Isabella', 'Patricia', 'Carmen', 'Teresa', 'Rosa', 'Lucia', 'Gabriela', 'Andrea', 'Valeria', 'Catalina', 'Mariana', 'Daniela', 'Claudia'].includes(member.firstName) ? 'female' : 'male',
  });

  // Create application via API (proper person linkage), approve + membership via DB (2FA blocks API)
  const app = await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  if (app && !app.__conflict) {
    const appId = app.id || app.data?.id;
    if (appId) {
      await db.update(membershipApplications)
        .set({ status: 'approved', reviewedAt: new Date() } as any)
        .where(eq(membershipApplications.id, appId));
    }
  }

  // Set member role
  await db.update(userTable).set({ role: 'association:member' } as any).where(eq(userTable.id, client.userId));

  // Create membership via DB
  const duesExpiry = member.status === 'active' ? '2025-12-31'
    : member.status === 'grace' ? '2025-04-01'
    : '2024-12-31';

  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: memberNum,
      startDate: '2025-01-01',
      duesExpiryDate: duesExpiry,
      gracePeriodDays: 30,
      status: member.status === 'grace' ? 'active' : member.status,
      joinedAt: new Date(),
    } as any);
  }

  return client;
}

// ═══════════════════════════════════════════════════════════════
// Phase 4: Pending Applicants (API-driven, NOT approved)
// ═══════════════════════════════════════════════════════════════

async function seedApplicant(
  db: ReturnType<typeof drizzle>,
  applicant: typeof APPLICANTS[0],
  orgId: string, regularTierId: string,
  president: SeedClient,
): Promise<void> {
  const client = new SeedClient(orgId);
  await client.signUp(applicant.email, `${applicant.firstName} ${applicant.lastName}`);
  await verifyEmail(db, applicant.email);
  await client.signIn(applicant.email);

  await client.createPerson({
    firstName: applicant.firstName, lastName: applicant.lastName,
    specialization: applicant.spec, licenseNumber: applicant.license,
    dateOfBirth: '1992-08-10', gender: applicant.firstName === 'Manuel' ? 'male' : 'female',
  });

  // President submits application on behalf — do NOT approve, stays pending
  await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  console.log(`  ✓ ${applicant.firstName} ${applicant.lastName} — pending applicant`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 5: Activities (Events, Training, Dues)
// ═══════════════════════════════════════════════════════════════

async function seedEvents(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('\n  Events...');

  const eventData = [
    { title: 'PDA Annual Dental Convention 2025', eventType: 'generalAssembly', description: 'Annual gathering of dental professionals.', location: 'SMX Convention Center, Pasay City', startDate: new Date('2025-03-15T08:00:00Z'), endDate: new Date('2025-03-16T17:00:00Z'), capacity: 200, registrationFee: '2500', status: 'completed', visibility: 'internal' },
    { title: 'Monthly General Assembly - May 2026', eventType: 'generalAssembly', description: 'Regular monthly meeting with updates.', location: 'PDA Metro Manila Office, Makati City', startDate: new Date('2026-05-09T14:00:00Z'), endDate: new Date('2026-05-09T17:00:00Z'), capacity: 100, registrationFee: '0', status: 'published', visibility: 'internal' },
    { title: 'Year-End Gala Dinner', eventType: 'fellowship', description: 'Annual year-end celebration and awards night.', location: 'Manila Hotel, Rizal Ballroom', startDate: new Date('2026-08-01T18:00:00Z'), endDate: new Date('2026-08-01T23:00:00Z'), capacity: 150, registrationFee: '3500', status: 'published', visibility: 'internal' },
    { title: 'Community Dental Mission - Tondo', eventType: 'medicalMission', description: 'Free dental services for underserved communities.', location: 'Tondo Community Center, Manila', startDate: new Date('2026-09-20T07:00:00Z'), endDate: new Date('2026-09-20T16:00:00Z'), capacity: 50, registrationFee: '0', status: 'draft', visibility: 'internal' },
  ];

  for (const e of eventData) {
    const existing = await db.select().from(events).where(eq(events.title, e.title)).limit(1);
    if (existing.length === 0) {
      await db.insert(events).values({
        organizationId: orgId, ...e,
        creditBearing: false, creditAmount: 0,
        createdBy: presidentId, updatedBy: presidentId,
      } as any);
    }
    console.log(`    ✓ ${e.status}: ${e.title}`);
  }
}

async function seedTraining(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Training...');

  const trainingData = [
    { title: 'Advanced Implant Placement Workshop', description: 'Hands-on workshop covering modern implant techniques.', instructorName: 'Dr. Ramon Aquino', location: 'PDA Training Center, Quezon City', startDate: new Date('2025-02-01T08:00:00Z'), endDate: new Date('2025-02-02T17:00:00Z'), capacity: 30, registrationFee: '5000', creditBearing: true, creditAmount: 16, status: 'completed' },
    { title: 'Dental Photography Seminar', description: 'Clinical photography techniques for documentation.', instructorName: 'Dr. Elena Villanueva', location: 'Makati Medical Center', startDate: new Date('2026-04-20T09:00:00Z'), endDate: new Date('2026-04-20T17:00:00Z'), capacity: 25, registrationFee: '3000', creditBearing: true, creditAmount: 8, status: 'published' },
    { title: 'Infection Control & Sterilization Update', description: 'Updated protocols for infection prevention.', instructorName: 'Dr. Patricia Reyes', location: 'PDA Metro Manila Office', startDate: new Date('2026-07-15T09:00:00Z'), endDate: new Date('2026-07-15T16:00:00Z'), capacity: 40, registrationFee: '2000', creditBearing: true, creditAmount: 6, status: 'published' },
  ];

  for (const t of trainingData) {
    const existing = await db.select().from(trainings).where(eq(trainings.title, t.title)).limit(1);
    if (existing.length === 0) {
      await db.insert(trainings).values({
        organizationId: orgId, ...t,
        createdBy: presidentId, updatedBy: presidentId,
      } as any);
    }
    console.log(`    ✓ ${t.status}: ${t.title}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 6: Governance (Elections, Announcements)
// ═══════════════════════════════════════════════════════════════

async function seedElections(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Elections...');

  // Use raw SQL since election table uses hand-wired schema
  const electionData = [
    { title: 'PDA Metro Manila Officers Election 2025', status: 'published', nominationsOpenAt: '2025-01-01', nominationsCloseAt: '2025-01-15', votingOpenAt: '2025-01-20', votingCloseAt: '2025-01-25' },
    { title: 'PDA Metro Manila Officers Election 2026', status: 'draft', nominationsOpenAt: '2026-07-01', nominationsCloseAt: '2026-07-15', votingOpenAt: '2026-07-20', votingCloseAt: '2026-07-25' },
  ];

  for (const e of electionData) {
    const existing = await db.execute(sql`SELECT id FROM election WHERE title = ${e.title} LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      await db.execute(sql`
        INSERT INTO election (organization_id, title, type, status, voting_mode,
          nominations_open_at, nominations_close_at, voting_open_at, voting_close_at,
          positions, created_by, updated_by)
        VALUES (${orgId}, ${e.title}, 'officer', ${e.status}, 'online',
          ${e.nominationsOpenAt}::timestamp, ${e.nominationsCloseAt}::timestamp,
          ${e.votingOpenAt}::timestamp, ${e.votingCloseAt}::timestamp,
          '["President","Treasurer","Secretary"]'::jsonb, ${presidentId}, ${presidentId})
      `);
    }
    console.log(`    ✓ ${e.status}: ${e.title}`);
  }
}

async function seedAnnouncements(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Announcements...');

  const annData = [
    { title: 'May Dues Reminder - Please Pay Before June 1', content: '<p>Dear members, annual dues for 2025 are due. Please settle your accounts before June 1.</p>', audienceType: 'all', visibility: 'internal', status: 'sent', publishedAt: new Date('2026-05-01') },
    { title: 'Upcoming Board Meeting - June 15', content: '<p>Board meeting on June 15 at 2:00 PM. Agenda: budget review, election prep, membership drive.</p>', audienceType: 'officers', visibility: 'internal', status: 'draft', publishedAt: null },
  ];

  for (const a of annData) {
    const existing = await db.execute(sql`SELECT id FROM announcement WHERE title = ${a.title} LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      await db.execute(sql`
        INSERT INTO announcement (organization_id, author_id, title, content, audience_type, visibility, status, published_at)
        VALUES (${orgId}, ${presidentId}, ${a.title}, ${a.content}, ${a.audienceType}, ${a.visibility}::announcement_visibility, ${a.status}::announcement_status, ${a.publishedAt})
      `);
    }
    console.log(`    ✓ ${a.status}: ${a.title}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 7: Credit Entries (manual, since completeTraining
//          doesn't auto-create credits)
// ═══════════════════════════════════════════════════════════════

async function seedCredits(db: ReturnType<typeof drizzle>, memberClients: SeedClient[], orgId: string) {
  console.log('  Credits...');

  const activities = [
    { name: 'Dental Photography Seminar (Completed)', credits: 4, date: '2026-04-25' },
    { name: 'External Implant Workshop', credits: 6, date: '2026-04-15', provider: 'Philippine College of Oral Surgeons' },
    { name: 'API Test Credit', credits: 3, date: '2026-04-01', provider: 'Self-Study' },
    { name: 'Infection Control Webinar', credits: 2, date: '2026-03-10', provider: 'DOH' },
    { name: 'CPD Seminar: Advances in Periodontics', credits: 4, date: '2026-02-15', provider: 'PDA National' },
  ];

  // Check if credits already seeded
  const existingCredits = await db.select().from(creditEntries).limit(1);
  if (existingCredits.length > 0) {
    console.log(`    (credits already seeded, skipping)`);
    return;
  }

  // Give credits to first 3 members
  for (let i = 0; i < Math.min(3, memberClients.length); i++) {
    const client = memberClients[i]!;
    const count = i === 0 ? 5 : i === 1 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const act = activities[j % activities.length]!;
      await client.post('/persons/me/credit-entries', {
        organizationId: orgId,
        activityName: act.name,
        provider: act.provider || 'PDA Metro Manila',
        activityDate: act.date,
        creditAmount: act.credits,
        registrationDate: '2025-01-01',
        cyclePeriodYears: 3,
      });
    }
    console.log(`    ✓ ${client.email}: ${count} credit entries`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 8: Relational Data (registrations, enrollments, payments)
// ═══════════════════════════════════════════════════════════════

async function seedRelationalData(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  president: SeedClient,
  memberClients: SeedClient[],
) {
  console.log('  Relational data...');

  // Get event and training IDs
  const allEvents = await db.select({ id: events.id, title: events.title, status: events.status }).from(events);
  const allTrainings = await db.select({ id: trainings.id, title: trainings.title, status: trainings.status }).from(trainings);

  // Event registrations — register Maria + first 5 members for published events
  const publishedEvents = allEvents.filter(e => e.status === 'published' || e.status === 'completed');
  const existingRegs = await db.select().from(eventRegistrations).limit(1);
  if (existingRegs.length === 0 && publishedEvents.length > 0) {
    const registrants = [president.personId, ...memberClients.slice(0, 5).map(c => c.personId)];
    for (const evt of publishedEvents) {
      for (const personId of registrants) {
        await db.insert(eventRegistrations).values({
          organizationId: orgId, eventId: evt.id, personId,
          status: 'confirmed', registeredAt: new Date(),
        } as any);
      }
    }
    console.log(`    ✓ Event registrations: ${registrants.length} people × ${publishedEvents.length} events`);
  }

  // Training enrollments — enroll Maria + first 3 members
  const existingEnrollments = await db.select().from(trainingEnrollments).limit(1);
  if (existingEnrollments.length === 0 && allTrainings.length > 0) {
    const enrollees = [president.personId, ...memberClients.slice(0, 3).map(c => c.personId)];
    for (const trn of allTrainings) {
      for (const personId of enrollees) {
        const isCompleted = trn.status === 'completed';
        await db.insert(trainingEnrollments).values({
          organizationId: orgId, trainingId: trn.id, personId,
          status: isCompleted ? 'completed' : 'enrolled',
          enrolledAt: new Date(),
          completedAt: isCompleted ? new Date() : null,
        } as any);
      }
    }
    console.log(`    ✓ Training enrollments: ${enrollees.length} people × ${allTrainings.length} trainings`);
  }

  // Dues payments — 10 payments for first 10 active members
  const existingPayments = await db.execute(sql`SELECT count(*) as c FROM dues_payment`);
  const paymentCount = (existingPayments as any).rows?.[0]?.c ?? (existingPayments as any)[0]?.c ?? 0;
  if (Number(paymentCount) === 0) {
    const paymentMembers = memberClients.slice(0, 10);
    for (let i = 0; i < paymentMembers.length; i++) {
      const methods = ['gcash', 'bankTransfer', 'cash', 'online', 'check'];
      await db.execute(sql`
        INSERT INTO dues_payment (organization_id, person_id, receipt_number, amount, currency, payment_method, status, paid_at)
        VALUES (${orgId}, ${paymentMembers[i]!.personId}, ${`RCP-2025-${String(i + 1).padStart(3, '0')}`}, 3000, 'PHP', ${methods[i % methods.length]}::dues_payment_method, 'completed'::dues_payment_status, ${new Date('2025-01-15')})
      `);
    }
    console.log(`    ✓ Dues payments: 10 records`);
  }

  // Credits for Maria (president) — so her credits page isn't empty
  await president.post('/persons/me/credit-entries', {
    organizationId: orgId,
    activityName: 'PDA Annual Convention 2025 (Attended)',
    provider: 'PDA Metro Manila',
    activityDate: '2025-03-15',
    creditAmount: 8,
    registrationDate: '2025-01-01',
    cyclePeriodYears: 3,
  });
  await president.post('/persons/me/credit-entries', {
    organizationId: orgId,
    activityName: 'Advanced Implant Workshop (Completed)',
    provider: 'PDA Training Center',
    activityDate: '2025-02-02',
    creditAmount: 16,
    registrationDate: '2025-01-01',
    cyclePeriodYears: 3,
  });
  await president.post('/persons/me/credit-entries', {
    organizationId: orgId,
    activityName: 'Leadership & Governance Seminar',
    provider: 'PDA National',
    activityDate: '2025-04-10',
    creditAmount: 4,
    registrationDate: '2025-01-01',
    cyclePeriodYears: 3,
  });
  console.log(`    ✓ Maria credits: 3 entries (28 total credits)`);
}

// ═══════════════════════════════════════════════════════════════
// IDOR Test Officer (org2) — required by route-protection-idor.test.ts
// ═══════════════════════════════════════════════════════════════

async function seedIdorOfficer(db: ReturnType<typeof drizzle>, org2Id: string, tierId: string) {
  const email = 'idor-officer@memberry.ph';
  const client = new SeedClient(org2Id);
  await client.signUp(email, 'IDOR Test Officer');
  await verifyEmail(db, email);
  await client.signIn(email);

  await client.createPerson({
    firstName: 'IDOR', lastName: 'Officer',
    specialization: 'General Dentistry', licenseNumber: '0099998',
    dateOfBirth: '1985-01-01', gender: 'male',
  });

  // Set role
  await db.update(userTable).set({ role: 'association:admin' } as any).where(eq(userTable.id, client.userId));

  // Membership in org2
  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    await db.insert(memberships).values({
      organizationId: org2Id, personId: client.personId,
      tierId, memberNumber: 'PDA-CEBU-001',
      startDate: '2025-01-01', duesExpiryDate: '2025-12-31',
      gracePeriodDays: 30, status: 'active', joinedAt: new Date(),
    } as any);
  }

  // Position + officer term in org2
  const existingPos = await db.select().from(positions)
    .where(eq(positions.title, 'IDOR Officer')).limit(1);
  let pos: any;
  if (existingPos.length === 0) {
    [pos] = await db.insert(positions).values({
      organizationId: org2Id, title: 'IDOR Officer',
      level: 'chapter', termLengthMonths: 12, sortOrder: 1,
    } as any).returning();
  } else {
    pos = existingPos[0];
  }

  const existingTerm = await db.select().from(officerTerms)
    .where(eq(officerTerms.personId, client.personId)).limit(1);
  if (existingTerm.length === 0) {
    await db.insert(officerTerms).values({
      positionId: pos.id, personId: client.personId,
      organizationId: org2Id, status: 'active',
      startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'),
    } as any);
  }

  console.log(`  ✓ IDOR Officer — org2 (pda-cebu), ${email}`);
}

// ═══════════════════════════════════════════════════════════════
// Main Orchestrator
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SEED SCENARIOS — API-driven seeding    ║');
  console.log('║   Requires: API server on port 7213      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Verify API is reachable
  try {
    const health = await fetch(`${API_URL}/auth/ok`);
    if (!health.ok) throw new Error(`API returned ${health.status}`);
  } catch (err) {
    console.error(`✗ Cannot reach API at ${API_URL}. Start the server first: bun dev`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  // Phase 0: DB Bootstrap
  const { orgId, org2Id, regularTierId, associateTierId, org2RegularTierId } = await bootstrapDB(db);

  // Phase 1: President
  const president = await seedPresident(db, orgId, regularTierId);

  // Phase 2: Officers
  console.log('\nPhase 2: Officers...');
  const officerClients: SeedClient[] = [president];
  for (let i = 1; i < OFFICERS.length; i++) {
    const o = OFFICERS[i]!;
    const memberNum = `PDA-2025-${String(i + 1).padStart(3, '0')}`;
    const client = await seedOfficer(db, o, orgId, regularTierId, president, memberNum);
    officerClients.push(client);
  }

  // Phase 3: Regular Members
  console.log('\nPhase 3: Regular Members (25)...');
  const memberClients: SeedClient[] = [];
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i]!;
    const memberNum = `PDA-2025-${String(i + 6).padStart(3, '0')}`;
    const client = await seedMember(db, m, orgId, regularTierId, president, memberNum);
    memberClients.push(client);
    process.stdout.write('.');
  }
  console.log(` done (${MEMBERS.length} members)`);

  // Phase 4: Pending Applicants
  console.log('\nPhase 4: Pending Applicants (2)...');
  for (const a of APPLICANTS) {
    await seedApplicant(db, a, orgId, regularTierId, president);
  }

  // Phase 4b: IDOR test user (org2 officer — referenced by route-protection-idor.test.ts)
  console.log('\nPhase 4b: IDOR Officer (org2)...');
  await seedIdorOfficer(db, org2Id, org2RegularTierId);

  // Phase 5: Activities (DB-based — requirePosition 2FA blocks API)
  console.log('\nPhase 5: Activities...');
  await seedEvents(db, orgId, president.personId);
  await seedTraining(db, orgId, president.personId);

  // Phase 6: Governance (DB-based)
  console.log('\nPhase 6: Governance...');
  await seedElections(db, orgId, president.personId);
  await seedAnnouncements(db, orgId, president.personId);

  // Phase 7: Credits
  console.log('\nPhase 7: Credits...');
  await seedCredits(db, memberClients, orgId);

  // Phase 8: Relational data (registrations, enrollments, payments)
  console.log('\nPhase 8: Relational data...');
  await seedRelationalData(db, orgId, president, memberClients);

  // Summary
  const personCount = await db.select().from(persons);
  const membershipCount = await db.select().from(memberships);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         SEED SCENARIOS COMPLETE          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Persons:        ${String(personCount.length).padStart(4)}               ║`);
  console.log(`║  Memberships:    ${String(membershipCount.length).padStart(4)}               ║`);
  console.log(`║  Officers:          5                    ║`);
  console.log(`║  Pending Apps:      2                    ║`);
  console.log('╚══════════════════════════════════════════╝');

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
