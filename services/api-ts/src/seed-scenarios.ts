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

// Phase 10-16 imports
import { notifications } from './handlers/notifs/repos/notification.schema';
import { certificates } from './handlers/certificates/repos/certificates.schema';
import { documents, documentVersions, documentAccessLogs } from './handlers/documents/repos/documents.schema';
import { chatRooms, chatMessages } from './handlers/comms/repos/comms.schema';
import { invoices, invoiceLineItems, merchantAccounts, billingConfigs } from './handlers/billing/repos/billing.schema';

// Phase 17-18 imports (audit-gap tables)
import { duesConfigs, duesInvoices } from './handlers/association:member/repos/dues.schema';
import { duesFunds, duesOrgConfigs } from './handlers/association:member/repos/dues-payments.schema';
import { committees, committeeMembers } from './handlers/association:operations/repos/committee.schema';
import { committeeTasks } from './handlers/association:operations/repos/committee-task.schema';
import { dunningTemplates, dunningEvents } from './handlers/association:member/repos/dunning.schema';
import { auditLogEntries } from './handlers/audit/repos/audit.schema';
import { vendors, marketplaceListings, marketplaceOrders } from './handlers/marketplace/repos/marketplace.schema';
import { reviews } from './handlers/reviews/repos/review.schema';
import { invitationTokens } from './handlers/invite/repos/invite.schema';
import { storedFiles } from './handlers/storage/repos/file.schema';

// Phase 19-22 imports (gap-fill)
import { checkIns, waitlistEntries } from './handlers/association:operations/repos/events.schema';
import { courses, courseEnrollments, quizAttempts } from './handlers/association:operations/repos/training.schema';
import { accreditedProviders } from './handlers/training/repos/accredited-provider.schema';
import { electionNominees, electionVotes, elections } from './handlers/elections/repos/elections.schema';
import { membershipStatusHistory } from './handlers/association:member/repos/status-history.schema';
import { professionalLicenses, licenseRenewalAlerts, credentialTemplates, digitalCredentials } from './handlers/association:member/repos/credentials.schema';
import { directoryProfiles } from './handlers/association:member/repos/directory.schema';
import { chapterAffiliations } from './handlers/association:member/repos/chapters.schema';
import { notificationPreferences } from './handlers/person/repos/notification-preferences.schema';
import { personPrivacySettings } from './handlers/person/repos/privacy-settings.schema';

const DATABASE_URL = process.env['DATABASE_URL'] || 'postgres://postgres@localhost:5432/monobase';
const API_URL = process.env['API_URL'] || 'http://localhost:7213';
const PASSWORD = 'TestPass123!';

// ═══════════════════════════════════════════════════════════════
// Relative date helpers — all seed dates computed from NOW
// so data never ages out
// ═══════════════════════════════════════════════════════════════

const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86400000);
const dateStr = (d: Date) => d.toISOString().split('T')[0]!;

/** Active member: dues expire 7 months from now */
const ACTIVE_EXPIRY = dateStr(daysFromNow(210));
/** Grace member: dues expired N days ago (within 30-day grace) */
const graceExpiry = (daysBack: number) => dateStr(daysAgo(daysBack));
/** Lapsed member: dues expired N days ago (past 30-day grace) */
const lapsedExpiry = (daysBack: number) => dateStr(daysAgo(daysBack));
/** Officer term: started 10 months ago, ends 2 months from now */
const TERM_START = daysAgo(300);
const TERM_END = daysFromNow(65);
/** Membership start: ~1 year ago */
const MEMBERSHIP_START = dateStr(daysAgo(365));

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

type MemberStatus = 'active' | 'grace' | 'lapsed' | 'suspended' | 'removed' | 'pendingPayment' | 'expired' | 'resigned';

const MEMBERS: { email: string; firstName: string; lastName: string; spec: string; license: string; status: MemberStatus }[] = [
  // Legacy test user (referenced by 6+ test files — DO NOT REMOVE)
  { email: 'member@memberry.ph', firstName: 'Miguel', lastName: 'Bautista', spec: 'General Dentistry', license: '0099999', status: 'active' },
  // 15 active (dues paid, future expiry)
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
  // 3 grace period (expired 10-20 days ago, within 30-day grace)
  { email: 'member16@memberry.ph', firstName: 'Jose', lastName: 'Co', spec: 'Endodontics', license: '0100016', status: 'grace' },
  { email: 'member17@memberry.ph', firstName: 'Valeria', lastName: 'Chua', spec: 'General Dentistry', license: '0100017', status: 'grace' },
  { email: 'member18@memberry.ph', firstName: 'Ricardo', lastName: 'Go', spec: 'Pediatric Dentistry', license: '0100018', status: 'grace' },
  // 2 lapsed (expired 60-90 days ago, past grace)
  { email: 'member19@memberry.ph', firstName: 'Catalina', lastName: 'Yap', spec: 'General Dentistry', license: '0100019', status: 'lapsed' },
  { email: 'member20@memberry.ph', firstName: 'Eduardo', lastName: 'Ang', spec: 'Prosthodontics', license: '0100020', status: 'lapsed' },
  // 2 suspended (officer action — non-payment escalation or conduct issue)
  { email: 'member21@memberry.ph', firstName: 'Mariana', lastName: 'Castillo', spec: 'General Dentistry', license: '0100021', status: 'suspended' },
  { email: 'member22@memberry.ph', firstName: 'Sergio', lastName: 'Wu', spec: 'Oral Surgery', license: '0100022', status: 'suspended' },
  // 1 removed (irreversible — fraudulent credentials)
  { email: 'member23@memberry.ph', firstName: 'Daniela', lastName: 'Lee', spec: 'Periodontics', license: '0100023', status: 'removed' },
  // 2 pendingPayment (approved but awaiting first dues payment)
  { email: 'member24@memberry.ph', firstName: 'Francisco', lastName: 'Gonzales', spec: 'General Dentistry', license: '0100024', status: 'pendingPayment' },
  { email: 'member25@memberry.ph', firstName: 'Claudia', lastName: 'Tiu', spec: 'Orthodontics', license: '0100025', status: 'pendingPayment' },
  // 1 expired (dues expired over a year ago)
  { email: 'member26@memberry.ph', firstName: 'Ramon', lastName: 'Villanueva', spec: 'General Dentistry', license: '0100026', status: 'expired' },
  // 1 resigned (voluntary departure)
  { email: 'member27@memberry.ph', firstName: 'Elena', lastName: 'Santos', spec: 'Prosthodontics', license: '0100027', status: 'resigned' },
];

const APPLICANTS = [
  { email: 'applicant01@memberry.ph', firstName: 'Beatriz', lastName: 'Lao', spec: 'General Dentistry', license: '0200001', rejected: false },
  { email: 'applicant02@memberry.ph', firstName: 'Manuel', lastName: 'Yu', spec: 'Prosthodontics', license: '0200002', rejected: true },
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
      startDate: MEMBERSHIP_START, duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
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
      startDate: TERM_START, endDate: TERM_END,
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
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: memberNum,
      startDate: MEMBERSHIP_START,
      duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
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
      startDate: TERM_START, endDate: TERM_END,
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

  // Create membership via DB — status-specific dates and fields
  let duesExpiry: string;
  let dbStatus: string = member.status;
  let suspendedAt: Date | null = null;
  let removedAt: Date | null = null;
  let removalReason: string | null = null;

  switch (member.status) {
    case 'active':
      duesExpiry = ACTIVE_EXPIRY; // +7 months
      dbStatus = 'active';
      break;
    case 'grace':
      duesExpiry = graceExpiry(15); // expired 15 days ago (within 30-day grace)
      dbStatus = 'gracePeriod'; // stored as gracePeriod enum value
      break;
    case 'lapsed':
      duesExpiry = lapsedExpiry(75); // expired 75 days ago (past 30-day grace)
      dbStatus = 'lapsed';
      break;
    case 'suspended':
      duesExpiry = ACTIVE_EXPIRY; // was active before suspension
      dbStatus = 'suspended';
      suspendedAt = daysAgo(14); // suspended 2 weeks ago
      break;
    case 'removed':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'removed';
      removedAt = daysAgo(30); // removed 1 month ago
      removalReason = 'Fraudulent credentials — license number verified as invalid by PRC';
      break;
    case 'expired':
      duesExpiry = lapsedExpiry(400); // expired over a year ago
      dbStatus = 'expired';
      break;
    case 'resigned':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'resigned';
      break;
    case 'pendingPayment':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'pendingPayment';
      break;
    default:
      duesExpiry = ACTIVE_EXPIRY;
  }

  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: memberNum,
      startDate: MEMBERSHIP_START,
      duesExpiryDate: duesExpiry,
      gracePeriodDays: 30,
      status: dbStatus,
      joinedAt: daysAgo(365),
      suspendedAt,
      removedAt,
      removalReason,
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

  // President submits application on behalf
  const app = await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  // If rejected applicant, update via DB
  if (applicant.rejected && app && !app.__conflict) {
    const appId = app.id || app.data?.id;
    if (appId) {
      await db.update(membershipApplications)
        .set({ status: 'denied', reviewedAt: new Date() } as any)
        .where(eq(membershipApplications.id, appId));
    }
  }

  console.log(`  ✓ ${applicant.firstName} ${applicant.lastName} — ${applicant.rejected ? 'rejected' : 'pending'} applicant`);
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
    // votingOpen election — enables BR-42 vote integrity testing
    { title: 'PDA Metro Manila Mid-Year Election 2026', status: 'votingOpen', nominationsOpenAt: dateStr(daysAgo(30)), nominationsCloseAt: dateStr(daysAgo(7)), votingOpenAt: dateStr(daysAgo(3)), votingCloseAt: dateStr(daysFromNow(14)) },
  ];

  for (const e of electionData) {
    const existing = await db.execute(sql`SELECT id FROM election WHERE title = ${e.title} LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      await db.execute(sql`
        INSERT INTO election (organization_id, title, type, status, voting_mode,
          nominations_open_at, nominations_close_at, voting_open_at, voting_close_at,
          positions, created_by, updated_by)
        VALUES (${orgId}, ${e.title}, 'officer', ${e.status}, 'online',
          ${e.nominationsOpenAt}::timestamptz, ${e.nominationsCloseAt}::timestamptz,
          ${e.votingOpenAt}::timestamptz, ${e.votingCloseAt}::timestamptz,
          '["President","Treasurer","Secretary"]'::jsonb, ${presidentId}, ${presidentId})
      `);
    }
    console.log(`    ✓ ${e.status}: ${e.title}`);
  }
}

async function seedAnnouncements(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Announcements...');

  const annData = [
    { title: 'May Dues Reminder - Please Pay Before June 1', content: '<p>Dear members, annual dues for 2025 are due. Please settle your accounts before June 1.</p>', audienceType: 'all', visibility: 'internal', status: 'sent', publishedAt: new Date('2026-05-01T00:00:00Z') },
    { title: 'Upcoming Board Meeting - June 15', content: '<p>Board meeting on June 15 at 2:00 PM. Agenda: budget review, election prep, membership drive.</p>', audienceType: 'officers', visibility: 'internal', status: 'draft', publishedAt: null },
    { title: 'Annual Convention Registration Open', content: '<p>Early bird registration for the 2026 PDA Annual Convention is now open.</p>', audienceType: 'all', visibility: 'internal', status: 'scheduled', publishedAt: daysFromNow(7) },
    { title: 'April Newsletter - Community Dental Mission Recap', content: '<p>Thank you to all volunteers who participated in the Tondo dental mission.</p>', audienceType: 'all', visibility: 'internal', status: 'archived', publishedAt: daysAgo(45) },
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

  // Give credits to first 10 members (varied amounts for realistic dashboard)
  // Members 0-4: well above requirement (60+), 5-7: close to requirement, 8-9: shortfall
  const creditCounts = [8, 6, 5, 5, 4, 3, 3, 2, 1, 1];
  for (let i = 0; i < Math.min(creditCounts.length, memberClients.length); i++) {
    const client = memberClients[i]!;
    const count = creditCounts[i]!;
    for (let j = 0; j < count; j++) {
      const act = activities[j % activities.length]!;
      await client.post('/persons/me/credit-entries', {
        organizationId: orgId,
        activityName: act.name,
        provider: act.provider || 'PDA Metro Manila',
        activityDate: act.date,
        creditAmount: act.credits,
        registrationDate: dateStr(daysAgo(365)),
        cyclePeriodYears: 3,
      });
    }
    if (i < 5) console.log(`    ✓ ${client.email}: ${count} credit entries`);
  }
  console.log(`    ✓ 10 members with credit entries (varied amounts)`);
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
        VALUES (${orgId}, ${paymentMembers[i]!.personId}, ${`RCP-${NOW.getFullYear()}-${String(i + 1).padStart(3, '0')}`}, 300000, 'PHP', ${methods[i % methods.length]}::dues_payment_method, 'completed'::dues_payment_status, ${daysAgo(50 - i * 5)})
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
// Phase 9: Profile Photos (from randomuser.me)
// ═══════════════════════════════════════════════════════════════

async function seedProfilePhotos(db: ReturnType<typeof drizzle>, allPersonIds: string[], genders: Record<string, string>) {
  console.log('  Profile photos...');

  // Check if any person already has an avatar
  const [sample] = await db.select({ id: persons.id, avatar: persons.avatar }).from(persons).limit(1);
  if (sample?.avatar) {
    console.log('    (photos already seeded, skipping)');
    return;
  }

  try {
    // Fetch photos from randomuser.me in batch
    const count = Math.min(allPersonIds.length, 40);
    const maleCount = Object.values(genders).filter(g => g === 'male').length;
    const femaleCount = count - maleCount;

    // Use deterministic portrait URLs (no API call needed, faster + no rate limit)
    let maleIdx = 1;
    let femaleIdx = 1;

    for (const personId of allPersonIds) {
      const gender = genders[personId] || 'male';
      const folder = gender === 'female' ? 'women' : 'men';
      const idx = gender === 'female' ? femaleIdx++ : maleIdx++;
      const url = `https://randomuser.me/api/portraits/${folder}/${idx}.jpg`;

      await db.update(persons)
        .set({ avatar: { url } } as any)
        .where(eq(persons.id, personId));
    }

    console.log(`    ✓ ${allPersonIds.length} profile photos assigned`);
  } catch (err) {
    console.log(`    ⚠ Photo seeding failed (non-blocking): ${(err as Error).message}`);
  }
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
      startDate: MEMBERSHIP_START, duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
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
      startDate: TERM_START, endDate: TERM_END,
    } as any);
  }

  console.log(`  ✓ IDOR Officer — org2 (pda-cebu), ${email}`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 10: Notifications
// ═══════════════════════════════════════════════════════════════

async function seedNotifications(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  memberPersonIds: string[],
  presidentPersonId: string,
) {
  console.log('  Notifications...');
  const existing = await db.select().from(notifications).limit(1);
  if (existing.length > 0) {
    console.log('    (already seeded, skipping)');
    return;
  }

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);

  const notifRows = [
    // System notifications
    { recipient: memberPersonIds[0]!, type: 'system' as const, channel: 'in-app' as const, title: 'Welcome to Memberry', message: 'Your account has been created. Complete your profile to get started.', status: 'read' as const, sentAt: daysAgo(30), readAt: daysAgo(29), consentValidated: true },
    { recipient: memberPersonIds[1]!, type: 'system' as const, channel: 'in-app' as const, title: 'Profile Updated', message: 'Your profile information has been updated successfully.', status: 'read' as const, sentAt: daysAgo(15), readAt: daysAgo(14), consentValidated: true },
    // Billing notifications
    { recipient: memberPersonIds[2]!, type: 'billing' as const, channel: 'email' as const, title: 'Payment Received', message: 'Your dues payment of ₱3,000.00 has been received. Receipt #RCP-2025-003.', status: 'delivered' as const, sentAt: daysAgo(20), consentValidated: true },
    { recipient: memberPersonIds[3]!, type: 'billing' as const, channel: 'in-app' as const, title: 'Invoice Due Soon', message: 'Your annual dues invoice is due in 7 days. Pay now to avoid late fees.', status: 'delivered' as const, sentAt: daysAgo(7), consentValidated: true },
    // Booking notifications
    { recipient: memberPersonIds[4]!, type: 'booking.confirmed' as const, channel: 'in-app' as const, title: 'Booking Confirmed', message: 'Your appointment on March 15 at 2:00 PM has been confirmed.', status: 'read' as const, sentAt: daysAgo(10), readAt: daysAgo(9), consentValidated: true },
    { recipient: presidentPersonId, type: 'booking.cancelled' as const, channel: 'in-app' as const, title: 'Booking Cancelled', message: 'A member has cancelled their appointment for March 20.', status: 'delivered' as const, sentAt: daysAgo(5), consentValidated: true },
    // Waitlist promotion (GAP-003)
    { recipient: memberPersonIds[5]!, type: 'waitlist.promoted' as const, channel: 'in-app' as const, title: 'Waitlist Promotion', message: 'You have been promoted from the waitlist for "PDA Annual Convention 2025". Your registration is now confirmed.', status: 'delivered' as const, sentAt: daysAgo(3), consentValidated: true },
    // Late cancellation (GAP-006)
    { recipient: presidentPersonId, type: 'event.late-cancellation' as const, channel: 'in-app' as const, title: 'Late Cancellation Alert', message: 'A member cancelled their registration for "Advanced Implant Workshop" within 24 hours of the event.', status: 'queued' as const, consentValidated: true },
    // Dunning escalation (GAP-012)
    { recipient: memberPersonIds[6]!, type: 'dunning.escalation' as const, channel: 'in-app' as const, title: 'Dues Payment Overdue', message: 'Your annual dues are 30 days overdue. Please settle to maintain your active membership status.', status: 'delivered' as const, sentAt: daysAgo(2), consentValidated: true },
    { recipient: memberPersonIds[7]!, type: 'dunning.escalation' as const, channel: 'email' as const, title: 'Final Dues Reminder', message: 'Your membership dues are 60 days overdue. Your membership will be suspended if not settled within 7 days.', status: 'sent' as const, sentAt: daysAgo(1), consentValidated: true },
    // Task overdue (GAP-017)
    { recipient: memberPersonIds[8]!, type: 'task.overdue' as const, channel: 'in-app' as const, title: 'Committee Task Overdue', message: 'Your task "Review membership applications" in the Membership Committee is 3 days overdue.', status: 'queued' as const, consentValidated: true },
    // Security notification
    { recipient: memberPersonIds[0]!, type: 'security' as const, channel: 'email' as const, title: 'New Login Detected', message: 'A new login was detected from Manila, Philippines. If this was not you, reset your password immediately.', status: 'delivered' as const, sentAt: hoursAgo(6), consentValidated: true },
    // Scheduled future notifications
    { recipient: memberPersonIds[1]!, type: 'billing' as const, channel: 'push' as const, title: 'Dues Renewal Reminder', message: 'Your membership dues will expire in 30 days. Renew now for uninterrupted access.', status: 'queued' as const, scheduledAt: new Date(now.getTime() + 7 * 86400000), consentValidated: true },
    { recipient: memberPersonIds[2]!, type: 'system' as const, channel: 'in-app' as const, title: 'Training Registration Open', message: 'Registration is now open for "Pediatric Dentistry Fundamentals" on April 20.', status: 'queued' as const, scheduledAt: new Date(now.getTime() + 3 * 86400000), consentValidated: true },
    // Failed notification
    { recipient: memberPersonIds[9]!, type: 'billing' as const, channel: 'push' as const, title: 'Payment Failed', message: 'Your payment attempt for annual dues has failed. Please try again.', status: 'failed' as const, sentAt: daysAgo(4), consentValidated: true },
  ];

  for (const row of notifRows) {
    await db.insert(notifications).values({
      organizationId: orgId,
      ...row,
    } as any);
  }
  console.log(`    ✓ ${notifRows.length} notifications seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 11: Certificates
// ═══════════════════════════════════════════════════════════════

async function seedCertificates(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  memberPersonIds: string[],
) {
  console.log('  Certificates...');
  const existing = await db.select().from(certificates).limit(1);
  if (existing.length > 0) {
    console.log('    (already seeded, skipping)');
    return;
  }

  const completedTrainings = await db.select({ id: trainings.id, title: trainings.title })
    .from(trainings)
    .where(eq(trainings.status, 'completed'));

  if (completedTrainings.length === 0) {
    console.log('    (no completed trainings, skipping)');
    return;
  }

  let certNum = 1;
  const recipients = memberPersonIds.slice(0, 5);
  for (const personId of recipients) {
    for (const trn of completedTrainings) {
      await db.insert(certificates).values({
        organizationId: orgId,
        personId,
        trainingId: trn.id,
        certificateNumber: `CERT-2025-${String(certNum).padStart(4, '0')}`,
        issuedAt: new Date('2025-03-01'),
      } as any);
      certNum++;
    }
  }
  console.log(`    ✓ ${certNum - 1} certificates seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 12: Documents
// ═══════════════════════════════════════════════════════════════

async function seedDocuments(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Documents...');
  const existing = await db.select().from(documents).limit(1);
  if (existing.length > 0) {
    console.log('    (already seeded, skipping)');
    return;
  }

  const docData = [
    { title: 'PDA Metro Manila Chapter Bylaws', fileName: 'pda-mm-bylaws-2025.pdf', mimeType: 'application/pdf', size: 245000, category: 'governance', accessLevel: 'orgOnly', status: 'published' as const },
    { title: 'Membership Application Form', fileName: 'membership-application-form.pdf', mimeType: 'application/pdf', size: 89000, category: 'forms', accessLevel: 'public', status: 'published' as const },
    { title: 'Advanced Endodontics Training Manual', fileName: 'endo-training-manual.pdf', mimeType: 'application/pdf', size: 1200000, category: 'training', accessLevel: 'orgOnly', status: 'published' as const },
    { title: 'Data Privacy Policy', fileName: 'data-privacy-policy.pdf', mimeType: 'application/pdf', size: 67000, category: 'compliance', accessLevel: 'public', status: 'published' as const },
    { title: 'Officer Handbook 2025', fileName: 'officer-handbook-2025.pdf', mimeType: 'application/pdf', size: 340000, category: 'governance', accessLevel: 'officerOnly', status: 'published' as const },
    { title: 'Annual Report 2024 (Draft)', fileName: 'annual-report-2024-draft.pdf', mimeType: 'application/pdf', size: 520000, category: 'reports', accessLevel: 'officerOnly', status: 'draft' as const },
    { title: 'CPD Credit Tracking Guide', fileName: 'cpd-credit-guide.pdf', mimeType: 'application/pdf', size: 156000, category: 'training', accessLevel: 'orgOnly', status: 'published' as const },
    { title: 'Event Planning Template', fileName: 'event-planning-template.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 45000, category: 'forms', accessLevel: 'officerOnly', status: 'published' as const },
  ];

  const insertedDocs: string[] = [];
  for (const doc of docData) {
    const [inserted] = await db.insert(documents).values({
      organizationId: orgId,
      ...doc,
      storageKey: `orgs/${orgId}/documents/${doc.fileName}`,
      ownerId: presidentPersonId,
      ownerType: 'person',
      tags: [],
    } as any).returning({ id: documents.id });
    if (inserted) insertedDocs.push(inserted.id);
  }
  console.log(`    ✓ ${insertedDocs.length} documents seeded`);

  // Access logs
  const accessActions = ['view', 'download', 'view', 'view', 'download'];
  for (let i = 0; i < Math.min(5, insertedDocs.length); i++) {
    await db.insert(documentAccessLogs).values({
      organizationId: orgId,
      documentId: insertedDocs[i]!,
      personId: memberPersonIds[i % memberPersonIds.length]!,
      action: accessActions[i]!,
      accessedAt: new Date(Date.now() - (i + 1) * 86400000),
    } as any);
  }
  console.log(`    ✓ 5 document access logs seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 13: Chat Rooms + Messages
// ═══════════════════════════════════════════════════════════════

async function seedComms(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Chat rooms & messages...');
  const existing = await db.select().from(chatRooms).limit(1);
  if (existing.length > 0) {
    console.log('    (already seeded, skipping)');
    return;
  }

  const roomConfigs = [
    { participants: [presidentPersonId, memberPersonIds[0]!, memberPersonIds[1]!], admins: [presidentPersonId], status: 'active' as const, messageCount: 6 },
    { participants: [memberPersonIds[2]!, memberPersonIds[3]!, memberPersonIds[4]!], admins: [memberPersonIds[2]!], status: 'active' as const, messageCount: 5 },
    { participants: [presidentPersonId, memberPersonIds[5]!], admins: [presidentPersonId], status: 'archived' as const, messageCount: 4 },
  ];

  const sampleMessages = [
    'Hi everyone, just a reminder about the upcoming CPD deadline.',
    'Thanks for the heads up! I still need 8 more credits.',
    'There\u2019s a workshop next week that offers 16 credits.',
    'Perfect, I\u2019ll register now.',
    'Don\u2019t forget to bring your PRC ID for the check-in.',
    'Got it. See you all there!',
    'Has anyone completed the new endodontics module?',
    'Yes, it was excellent. Highly recommend it.',
    'The certificate was issued right after completion.',
    'How do I log manual credits from an external seminar?',
    'Go to My Credits > Log Entry and fill in the details.',
    'Thanks! That was straightforward.',
    'Meeting notes from last week are in the documents section.',
    'Reviewed them. No concerns from my end.',
    'Great, I\u2019ll finalize and archive the thread.',
  ];

  let msgIdx = 0;
  for (const room of roomConfigs) {
    const [insertedRoom] = await db.insert(chatRooms).values({
      organizationId: orgId,
      participants: room.participants,
      admins: room.admins,
      status: room.status,
      messageCount: room.messageCount,
      lastMessageAt: new Date(Date.now() - (room.status === 'archived' ? 7 * 86400000 : 3600000)),
    } as any).returning({ id: chatRooms.id });

    if (insertedRoom) {
      for (let i = 0; i < room.messageCount; i++) {
        const sender = room.participants[i % room.participants.length]!;
        await db.insert(chatMessages).values({
          organizationId: orgId,
          chatRoom: insertedRoom.id,
          sender,
          messageType: 'text',
          message: sampleMessages[msgIdx % sampleMessages.length]!,
          timestamp: new Date(Date.now() - (room.messageCount - i) * 600000),
        } as any);
        msgIdx++;
      }
    }
  }
  console.log(`    ✓ 3 chat rooms + ${msgIdx} messages seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 14: Billing Records
// ═══════════════════════════════════════════════════════════════

async function seedBilling(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Billing records...');
  const existing = await db.select().from(invoices).limit(1);
  if (existing.length > 0) {
    console.log('    (already seeded, skipping)');
    return;
  }

  // Merchant account for the org treasurer
  const [merchant] = await db.insert(merchantAccounts).values({
    organizationId: orgId,
    person: presidentPersonId,
    active: true,
    metadata: { stripeAccountId: 'acct_seed_pda_mm', businessName: 'PDA Metro Manila Chapter' },
  } as any).returning({ id: merchantAccounts.id });

  if (!merchant) {
    console.log('    ⚠ Failed to create merchant account');
    return;
  }

  // Invoices with line items
  const invoiceData = [
    { customer: memberPersonIds[0]!, number: 'INV-2025-001', status: 'paid' as const, total: 300000, paidAt: new Date('2025-01-15'), desc: 'Annual Membership Dues 2025' },
    { customer: memberPersonIds[1]!, number: 'INV-2025-002', status: 'paid' as const, total: 300000, paidAt: new Date('2025-02-01'), desc: 'Annual Membership Dues 2025' },
    { customer: memberPersonIds[2]!, number: 'INV-2025-003', status: 'paid' as const, total: 350000, paidAt: new Date('2025-02-15'), desc: 'Annual Dues + Workshop Fee' },
    { customer: memberPersonIds[3]!, number: 'INV-2025-004', status: 'open' as const, total: 300000, paidAt: null, desc: 'Annual Membership Dues 2025' },
    { customer: memberPersonIds[4]!, number: 'INV-2025-005', status: 'void' as const, total: 300000, paidAt: null, desc: 'Annual Membership Dues 2025 (Voided)' },
  ];

  for (const inv of invoiceData) {
    const [inserted] = await db.insert(invoices).values({
      organizationId: orgId,
      invoiceNumber: inv.number,
      customer: inv.customer,
      merchant: presidentPersonId,
      merchantAccount: merchant.id,
      status: inv.status,
      subtotal: inv.total,
      total: inv.total,
      currency: 'PHP',
      paidAt: inv.paidAt,
      paidBy: inv.paidAt ? inv.customer : null,
      voidedAt: inv.status === 'void' ? new Date('2025-03-01') : null,
      voidedBy: inv.status === 'void' ? presidentPersonId : null,
    } as any).returning({ id: invoices.id });

    if (inserted) {
      await db.insert(invoiceLineItems).values({
        organizationId: orgId,
        invoice: inserted.id,
        description: inv.desc,
        quantity: 1,
        unitPrice: inv.total,
        amount: inv.total,
      } as any);
    }
  }
  console.log(`    ✓ 1 merchant account + 5 invoices seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 15: Dunning Events + Audit Trail
// ═══════════════════════════════════════════════════════════════

async function seedDunningEventsAndAudit(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Dunning events & audit trail...');

  // Dunning events — check existing
  const existingDunning = await db.select().from(dunningEvents).limit(1);
  if (existingDunning.length === 0) {
    // Get dunning templates
    const templates = await db.select().from(dunningTemplates).limit(5);
    if (templates.length > 0) {
      // Get memberships for overdue members
      const overdueMemberIds = memberPersonIds.slice(15, 20);
      const membershipRows = await db.select({ id: memberships.id, personId: memberships.personId })
        .from(memberships);

      let dunningCount = 0;
      for (const personId of overdueMemberIds) {
        const membership = membershipRows.find(m => m.personId === personId);
        if (!membership) continue;

        // Create 1-2 dunning events per overdue member
        for (let stage = 1; stage <= Math.min(2, templates.length); stage++) {
          const template = templates.find(t => t.stage === stage) || templates[0]!;
          await db.insert(dunningEvents).values({
            membershipId: membership.id,
            personId,
            templateId: template.id,
            stage,
            sentAt: new Date(Date.now() - (30 - stage * 10) * 86400000),
            channel: template.channel,
            deliveryStatus: stage === 1 ? 'delivered' : 'sent',
          } as any);
          dunningCount++;
        }
      }
      console.log(`    ✓ ${dunningCount} dunning events seeded`);
    } else {
      console.log('    (no dunning templates found, skipping events)');
    }
  } else {
    console.log('    (dunning events already seeded, skipping)');
  }

  // Audit trail
  const existingAudit = await db.select().from(auditLogEntries).limit(1);
  if (existingAudit.length > 0) {
    console.log('    (audit logs already seeded, skipping)');
    return;
  }

  const auditData = [
    { eventType: 'authentication' as const, category: 'security' as const, action: 'login' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'session', resource: 'auth-session-001', description: 'President logged in successfully' },
    { eventType: 'authentication' as const, category: 'security' as const, action: 'login' as const, outcome: 'failure' as const, user: memberPersonIds[0]!, resourceType: 'session', resource: 'auth-attempt-002', description: 'Failed login attempt — incorrect password' },
    { eventType: 'data-modification' as const, category: 'administrative' as const, action: 'approve' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'membership-application', resource: 'app-001', description: 'Approved membership application' },
    { eventType: 'data-modification' as const, category: 'administrative' as const, action: 'deny' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'membership-application', resource: 'app-002', description: 'Denied membership application — incomplete documents' },
    { eventType: 'data-modification' as const, category: 'financial' as const, action: 'mark-paid' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'dues-payment', resource: 'pay-001', description: 'Recorded dues payment of ₱3,000' },
    { eventType: 'data-access' as const, category: 'privacy' as const, action: 'read' as const, outcome: 'success' as const, user: memberPersonIds[1]!, resourceType: 'person', resource: memberPersonIds[1]!, description: 'Member viewed own profile data' },
    { eventType: 'data-modification' as const, category: 'administrative' as const, action: 'update' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'organization', resource: orgId, description: 'Updated organization settings' },
    { eventType: 'data-modification' as const, category: 'association' as const, action: 'create' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'event', resource: 'event-001', description: 'Created new event: PDA Annual Convention' },
    { eventType: 'data-modification' as const, category: 'association' as const, action: 'renew' as const, outcome: 'success' as const, user: memberPersonIds[2]!, resourceType: 'membership', resource: 'mem-001', description: 'Membership renewed for 2025' },
    { eventType: 'data-deletion' as const, category: 'privacy' as const, action: 'delete-request' as const, outcome: 'success' as const, user: memberPersonIds[3]!, resourceType: 'person', resource: memberPersonIds[3]!, description: 'Member requested data deletion' },
    { eventType: 'system-config' as const, category: 'administrative' as const, action: 'update' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'dues-config', resource: orgId, description: 'Updated dues configuration for 2025' },
    { eventType: 'data-modification' as const, category: 'association' as const, action: 'complete' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'training', resource: 'trn-001', description: 'Marked training session as completed' },
    { eventType: 'compliance' as const, category: 'privacy' as const, action: 'export' as const, outcome: 'success' as const, user: memberPersonIds[4]!, resourceType: 'person-data', resource: memberPersonIds[4]!, description: 'DPA data export generated' },
    { eventType: 'data-modification' as const, category: 'association' as const, action: 'transfer' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'officer-term', resource: 'term-001', description: 'Officer position transferred to new term' },
    { eventType: 'security' as const, category: 'security' as const, action: 'logout' as const, outcome: 'success' as const, user: memberPersonIds[5]!, resourceType: 'session', resource: 'session-005', description: 'Member logged out' },
    { eventType: 'data-modification' as const, category: 'financial' as const, action: 'create' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'invoice', resource: 'inv-001', description: 'Generated dues invoice for member' },
    { eventType: 'authentication' as const, category: 'security' as const, action: 'login' as const, outcome: 'denied' as const, user: null, resourceType: 'session', resource: 'auth-attempt-blocked', description: 'Login blocked — rate limit exceeded' },
    { eventType: 'data-access' as const, category: 'association' as const, action: 'read' as const, outcome: 'success' as const, user: memberPersonIds[6]!, resourceType: 'member-directory', resource: orgId, description: 'Member viewed chapter directory' },
    { eventType: 'data-modification' as const, category: 'association' as const, action: 'create' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'announcement', resource: 'ann-001', description: 'Published chapter announcement' },
    { eventType: 'data-modification' as const, category: 'administrative' as const, action: 'terminate' as const, outcome: 'success' as const, user: presidentPersonId, resourceType: 'membership', resource: 'mem-lapsed', description: 'Membership removed — non-payment after grace period' },
  ];

  for (let i = 0; i < auditData.length; i++) {
    const entry = auditData[i]!;
    await db.insert(auditLogEntries).values({
      organizationId: orgId,
      ...entry,
      userType: entry.user ? 'member' : null,
      ipAddress: '203.177.71.' + (10 + i),
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    } as any);
  }
  console.log(`    ✓ ${auditData.length} audit log entries seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 16: Marketplace, Reviews, Invites, Storage
// ═══════════════════════════════════════════════════════════════

async function seedRemainingModules(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Marketplace, reviews, invites, storage...');

  // ─── Marketplace (tables may not exist yet) ────────────────
  let marketplaceSeeded = false;
  try {
  const existingVendors = await db.select().from(vendors).limit(1);
  if (existingVendors.length === 0) {
    const [vendor1] = await db.insert(vendors).values({
      organizationId: orgId,
      companyName: 'DentalPro Supplies PH',
      category: 'supplies',
      description: 'Premium dental supplies and equipment for Philippine dental professionals. ISO-certified products.',
      verificationStatus: 'verified',
      websiteUrl: 'https://dentalpro.ph',
      contactEmail: 'sales@dentalpro.ph',
      contactPersonId: memberPersonIds[10]!,
      verifiedAt: new Date('2025-02-01'),
      verifiedBy: presidentPersonId,
    } as any).returning({ id: vendors.id });

    const [vendor2] = await db.insert(vendors).values({
      organizationId: orgId,
      companyName: 'MedTech Solutions',
      category: 'emr',
      description: 'Electronic medical records and practice management software designed for dental clinics.',
      verificationStatus: 'pending',
      contactEmail: 'info@medtech-solutions.ph',
      contactPersonId: memberPersonIds[11]!,
    } as any).returning({ id: vendors.id });

    if (vendor1 && vendor2) {
      // Listings
      const [listing1] = await db.insert(marketplaceListings).values({
        organizationId: orgId, vendorId: vendor1.id, title: 'Composite Resin Kit (A2-A4 Shades)',
        description: 'Professional-grade composite resin kit with 6 shades, light-cure compatible.', price: '4500.00', currency: 'PHP', status: 'active', categoryTags: ['supplies', 'restorative'],
      } as any).returning({ id: marketplaceListings.id });

      const [listing2] = await db.insert(marketplaceListings).values({
        organizationId: orgId, vendorId: vendor1.id, title: 'Dental Loupes 3.5x Magnification',
        description: 'Ergonomic dental loupes with LED headlight, adjustable interpupillary distance.', price: '28000.00', currency: 'PHP', status: 'active', categoryTags: ['equipment', 'optics'],
      } as any).returning({ id: marketplaceListings.id });

      await db.insert(marketplaceListings).values({
        organizationId: orgId, vendorId: vendor2.id, title: 'ClinicOS Practice Management',
        description: 'All-in-one practice management: scheduling, records, billing, patient portal.', price: '2500.00', currency: 'PHP', status: 'active', categoryTags: ['software', 'emr'],
      } as any);

      await db.insert(marketplaceListings).values({
        organizationId: orgId, vendorId: vendor1.id, title: 'Autoclave Sterilizer 23L',
        description: 'Class B autoclave sterilizer, 23-liter capacity, EU-certified.', price: '85000.00', currency: 'PHP', status: 'draft', categoryTags: ['equipment', 'sterilization'],
      } as any);

      // Orders
      if (listing1) {
        await db.insert(marketplaceOrders).values({
          organizationId: orgId, listingId: listing1.id, buyerPersonId: memberPersonIds[0]!, vendorId: vendor1.id,
          quantity: 2, totalPrice: '9000.00', status: 'fulfilled', fulfilledAt: new Date('2025-03-10'),
        } as any);
      }
      if (listing2) {
        await db.insert(marketplaceOrders).values({
          organizationId: orgId, listingId: listing2.id, buyerPersonId: memberPersonIds[1]!, vendorId: vendor1.id,
          quantity: 1, totalPrice: '28000.00', status: 'confirmed',
        } as any);
      }
      console.log('    ✓ 2 vendors + 4 listings + 2 orders seeded');
    }
  } else {
    console.log('    (marketplace already seeded, skipping)');
  }
  marketplaceSeeded = true;
  } catch {
    console.log('    (marketplace tables not migrated yet, skipping)');
  }

  // ─── Reviews ──────────────────────────────────────────────
  try {
    const existingReviews = await db.select().from(reviews).limit(1);
    if (existingReviews.length === 0) {
      const reviewData = [
        { reviewer: memberPersonIds[0]!, reviewType: 'nps-membership', npsScore: 9, comment: 'Excellent chapter management and timely communication. Very satisfied with the membership experience.' },
        { reviewer: memberPersonIds[1]!, reviewType: 'nps-membership', npsScore: 7, comment: 'Good overall, but could improve the online payment process for dues.' },
        { reviewer: memberPersonIds[2]!, reviewType: 'nps-event', npsScore: 10, comment: 'The Annual Convention was outstanding! Great speakers and networking opportunities.' },
      ];

      for (const r of reviewData) {
        await db.insert(reviews).values({
          organizationId: orgId,
          context: orgId,
          reviewer: r.reviewer,
          reviewType: r.reviewType,
          npsScore: r.npsScore,
          comment: r.comment,
        } as any);
      }
      console.log('    ✓ 3 reviews seeded');
    } else {
      console.log('    (reviews already seeded, skipping)');
    }
  } catch {
    console.log('    (reviews table not ready, skipping)');
  }

  // ─── Invitations ──────────────────────────────────────────
  try {
    const existingInvites = await db.select().from(invitationTokens).limit(1);
    if (existingInvites.length === 0) {
      const inviteData = [
        { email: 'newmember1@memberry.ph', message: 'You are invited to join PDA Metro Manila Chapter. Click the link to complete your registration.', type: 'invite' as const },
        { email: 'newmember2@memberry.ph', message: 'Welcome! Please claim your membership by setting up your account.', type: 'claim' as const },
      ];

      for (const inv of inviteData) {
        const { createHash } = await import('crypto');
        const tokenHash = createHash('sha256').update(`seed-invite-${inv.email}-${Date.now()}`).digest('hex');
        await db.insert(invitationTokens).values({
          organizationId: orgId,
          tokenHash,
          type: inv.type,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 86400000),
          createdByOfficer: presidentPersonId,
          email: inv.email,
          message: inv.message,
          metadata: { name: inv.email.split('@')[0], resendCount: 0 },
        } as any);
      }
      console.log('    ✓ 2 invitations seeded');
    } else {
      console.log('    (invitations already seeded, skipping)');
    }
  } catch {
    console.log('    (invitations table not ready, skipping)');
  }

  // ─── Storage (file metadata) ──────────────────────────────
  try {
    const existingFiles = await db.select().from(storedFiles).limit(1);
    if (existingFiles.length === 0) {
      const fileData = [
        { filename: 'pda-mm-bylaws-2025.pdf', mimeType: 'application/pdf', size: 245000, owner: presidentPersonId },
        { filename: 'membership-application-form.pdf', mimeType: 'application/pdf', size: 89000, owner: presidentPersonId },
        { filename: 'profile-photo-maria.jpg', mimeType: 'image/jpeg', size: 45000, owner: presidentPersonId },
        { filename: 'training-certificate-template.svg', mimeType: 'image/svg+xml', size: 12000, owner: presidentPersonId },
        { filename: 'event-banner-convention-2025.png', mimeType: 'image/png', size: 320000, owner: memberPersonIds[0]! },
      ];

      for (const f of fileData) {
        await db.insert(storedFiles).values({
          organizationId: orgId,
          ...f,
          status: 'available',
        } as any);
      }
      console.log('    ✓ 5 stored files seeded');
    } else {
      console.log('    (stored files already seeded, skipping)');
    }
  } catch {
    console.log('    (stored files table not ready, skipping)');
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 17: Dues Infrastructure (invoices, fund configs, proofs)
// Fixes: blank dues status filter + "Failed to load pending proofs"
// ═══════════════════════════════════════════════════════════════

async function seedDuesInfrastructure(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Dues infrastructure (invoices, funds, proofs)...');

  // ─── Dues org config (association:member dues_config table) ──
  const existingDuesConfig = await db.select().from(duesConfigs).limit(1);
  if (existingDuesConfig.length === 0) {
    // Get tier IDs for this org
    const tiers = await db.select({ id: membershipTiers.id })
      .from(membershipTiers)
      .where(eq(membershipTiers.organizationId, orgId))
      .limit(2);

    for (const tier of tiers) {
      await db.insert(duesConfigs).values({
        organizationId: orgId,
        tierId: tier.id,
        annualAmount: 300000, // ₱3,000.00
        currency: 'PHP',
        gracePeriodDays: 30,
        fundAllocations: [
          { fundName: 'General Fund', percentage: 50, isLast: false },
          { fundName: 'Building Fund', percentage: 30, isLast: false },
          { fundName: 'Emergency Fund', percentage: 20, isLast: true },
        ],
        effectiveDate: dateStr(daysAgo(365)),
        status: 'active',
      } as any);
    }
    console.log(`    ✓ ${tiers.length} dues configs seeded (per tier)`);
  } else {
    console.log('    (dues configs already seeded, skipping)');
  }

  // ─── Dues fund targets (dues module dues_fund table) ─────────
  try {
    const existingFunds = await db.select().from(duesFunds).limit(1);
    if (existingFunds.length === 0) {
      const fundData = [
        { name: 'General Fund', percentage: '50.00', sortOrder: 1, active: true },
        { name: 'Building Fund', percentage: '30.00', sortOrder: 2, active: true },
        { name: 'Emergency Fund', percentage: '20.00', sortOrder: 3, active: true },
      ];
      for (const fund of fundData) {
        await db.insert(duesFunds).values({ organizationId: orgId, ...fund } as any);
      }
      console.log('    ✓ 3 dues funds seeded');
    } else {
      console.log('    (dues funds already seeded, skipping)');
    }
  } catch {
    console.log('    (dues_fund table not migrated, skipping)');
  }

  // ─── Dues org config (dues module dues_org_config table) ─────
  try {
    const existingOrgConfig = await db.select().from(duesOrgConfigs).limit(1);
    if (existingOrgConfig.length === 0) {
      await db.insert(duesOrgConfigs).values({
        organizationId: orgId,
        defaultAmount: 300000, // ₱3,000 in centavos
        currency: 'PHP',
        billingFrequency: 'annual',
        dueDateMonth: 1, // January
        dueDateDay: 1,
        gracePeriodDays: 30,
      });
      console.log('    ✓ 1 dues org config seeded');
    } else {
      console.log('    (dues org config already seeded, skipping)');
    }
  } catch {
    console.log('    (dues_org_config table not migrated, skipping)');
  }

  // ─── Dues invoices (THE critical missing table) ──────────────
  const existingInvoices = await db.select().from(duesInvoices).limit(1);
  if (existingInvoices.length === 0) {
    // Get membership IDs for linking invoices
    const membershipRows = await db.select({ id: memberships.id, personId: memberships.personId })
      .from(memberships)
      .where(eq(memberships.organizationId, orgId))
      .limit(15);

    if (membershipRows.length > 0) {
      const invoiceStatuses: Array<{ status: string; sentAt: Date | null; paidAt: Date | null }> = [
        // 5 paid
        { status: 'paid', sentAt: daysAgo(350), paidAt: daysAgo(345) },
        { status: 'paid', sentAt: daysAgo(350), paidAt: daysAgo(340) },
        { status: 'paid', sentAt: daysAgo(350), paidAt: daysAgo(330) },
        { status: 'paid', sentAt: daysAgo(350), paidAt: daysAgo(325) },
        { status: 'paid', sentAt: daysAgo(350), paidAt: daysAgo(320) },
        // 3 sent (recent)
        { status: 'sent', sentAt: daysAgo(30), paidAt: null },
        { status: 'sent', sentAt: daysAgo(20), paidAt: null },
        { status: 'sent', sentAt: daysAgo(10), paidAt: null },
        // 3 generated (not yet sent)
        { status: 'generated', sentAt: null, paidAt: null },
        { status: 'generated', sentAt: null, paidAt: null },
        { status: 'generated', sentAt: null, paidAt: null },
        // 2 overdue
        { status: 'overdue', sentAt: daysAgo(90), paidAt: null },
        { status: 'overdue', sentAt: daysAgo(75), paidAt: null },
      ];

      const fundAllocs = [
        { fundName: 'General Fund', amount: 150000 },
        { fundName: 'Building Fund', amount: 90000 },
        { fundName: 'Emergency Fund', amount: 60000 },
      ];

      let invoiceNum = 1;
      for (let i = 0; i < Math.min(invoiceStatuses.length, membershipRows.length); i++) {
        const m = membershipRows[i]!;
        const inv = invoiceStatuses[i]!;
        await db.insert(duesInvoices).values({
          membershipId: m.id,
          personId: m.personId,
          organizationId: orgId,
          invoiceNumber: `INV-${NOW.getFullYear()}-${String(invoiceNum).padStart(3, '0')}`,
          periodStart: dateStr(daysAgo(365)),
          periodEnd: ACTIVE_EXPIRY,
          totalAmount: 300000,
          fundAllocations: fundAllocs,
          status: inv.status,
          generatedAt: daysAgo(360),
          sentAt: inv.sentAt,
          paidAt: inv.paidAt,
        } as any);
        invoiceNum++;
      }
      console.log(`    ✓ ${invoiceNum - 1} dues invoices seeded (5 paid, 3 sent, 3 generated, 2 overdue)`);
    } else {
      console.log('    (no memberships found, skipping invoices)');
    }
  } else {
    console.log('    (dues invoices already seeded, skipping)');
  }

  // ─── Submitted payment proofs (fixes pending proofs) ─────────
  const existingSubmitted = await db.execute(
    sql`SELECT count(*) as c FROM dues_payment WHERE status = 'submitted'`
  );
  const submittedCount = (existingSubmitted as any).rows?.[0]?.c ?? (existingSubmitted as any)[0]?.c ?? 0;

  if (Number(submittedCount) === 0) {
    // Get sent/generated invoices to link proofs to
    const pendingInvoices = await db.select({ id: duesInvoices.id, personId: duesInvoices.personId })
      .from(duesInvoices)
      .where(sql`${duesInvoices.status} IN ('sent', 'generated')`)
      .limit(3);

    if (pendingInvoices.length > 0) {
      const proofData = [
        { method: 'gcash', proofKey: 'proofs/gcash-screenshot-001.jpg', proofName: 'gcash-receipt.jpg', proofMime: 'image/jpeg', ref: 'GCASH-20250510-001' },
        { method: 'bankTransfer', proofKey: 'proofs/bdo-transfer-receipt.pdf', proofName: 'bdo-transfer.pdf', proofMime: 'application/pdf', ref: 'BDO-20250512-002' },
        { method: 'gcash', proofKey: 'proofs/gcash-screenshot-003.png', proofName: 'payment-proof.png', proofMime: 'image/png', ref: 'GCASH-20250515-003' },
      ];

      for (let i = 0; i < Math.min(proofData.length, pendingInvoices.length); i++) {
        const inv = pendingInvoices[i]!;
        const proof = proofData[i]!;
        await db.execute(sql`
          INSERT INTO dues_payment (organization_id, person_id, invoice_id, receipt_number, amount, currency, payment_method, status, reference_number, proof_storage_key, proof_file_name, proof_mime_type, paid_at)
          VALUES (${orgId}, ${inv.personId}, ${inv.id}, ${`RCP-2025-SUB-${String(i + 1).padStart(3, '0')}`}, 300000, 'PHP', ${proof.method}::dues_payment_method, 'submitted'::dues_payment_status, ${proof.ref}, ${proof.proofKey}, ${proof.proofName}, ${proof.proofMime}, ${new Date()})
        `);
      }
      console.log(`    ✓ ${Math.min(proofData.length, pendingInvoices.length)} submitted payment proofs seeded`);
    } else {
      console.log('    (no pending invoices for proof linking, skipping)');
    }
  } else {
    console.log('    (submitted proofs already exist, skipping)');
  }

  // ─── Payment status variety (refunded, rejected) ──────────────
  try {
    const refundedExists = await db.execute(
      sql`SELECT count(*) as c FROM dues_payment WHERE status = 'refunded'`
    );
    const refundedCount = Number((refundedExists as any).rows?.[0]?.c ?? (refundedExists as any)[0]?.c ?? 0);
    if (refundedCount === 0 && memberPersonIds.length > 2) {
      // Add 1 refunded payment
      await db.execute(sql`
        INSERT INTO dues_payment (organization_id, person_id, receipt_number, amount, currency, payment_method, status, paid_at, refunded_amount, refund_date, refund_reason)
        VALUES (${orgId}, ${memberPersonIds[0]}, 'RCP-REFUND-001', 300000, 'PHP', 'gcash'::dues_payment_method, 'refunded'::dues_payment_status, ${daysAgo(90)}, 300000, ${daysAgo(60)}, 'Duplicate payment — member paid via bank transfer and GCash')
      `);
      // Add 1 rejected payment
      await db.execute(sql`
        INSERT INTO dues_payment (organization_id, person_id, receipt_number, amount, currency, payment_method, status, paid_at, rejection_reason, proof_storage_key, proof_file_name, proof_mime_type)
        VALUES (${orgId}, ${memberPersonIds[1]}, 'RCP-REJECT-001', 300000, 'PHP', 'bankTransfer'::dues_payment_method, 'rejected'::dues_payment_status, ${daysAgo(45)}, 'Proof of payment does not match amount — screenshot shows ₱2,000 not ₱3,000', 'proofs/wrong-amount-transfer.jpg', 'wrong-amount.jpg', 'image/jpeg')
      `);
      console.log('    ✓ 1 refunded + 1 rejected payment seeded');
    }
  } catch (e) {
    console.log(`    (payment variety seeding failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Pending payments for aging report ────────────────────────
  try {
    const pendingExists = await db.execute(
      sql`SELECT count(*) as c FROM dues_payment WHERE status = 'pending'`
    );
    const pendingCount = Number((pendingExists as any).rows?.[0]?.c ?? (pendingExists as any)[0]?.c ?? 0);
    if (pendingCount === 0 && memberPersonIds.length >= 4) {
      // Create pending payments at various ages for aging bucket distribution
      const agingDays = [10, 25, 40, 55, 70, 85, 100, 120];
      for (let i = 0; i < Math.min(agingDays.length, memberPersonIds.length); i++) {
        await db.execute(sql`
          INSERT INTO dues_payment (organization_id, person_id, receipt_number, amount, currency, payment_method, status, created_at)
          VALUES (${orgId}, ${memberPersonIds[i]}, ${`RCP-AGING-${String(i + 1).padStart(3, '0')}`}, 300000, 'PHP', 'online'::dues_payment_method, 'pending'::dues_payment_status, ${daysAgo(agingDays[i]!)})
        `);
      }
      console.log(`    ✓ ${Math.min(agingDays.length, memberPersonIds.length)} pending payments seeded (aging report)`);
    }
  } catch (e) {
    console.log(`    (aging payments failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 18: Committees (structure + members + tasks)
// ═══════════════════════════════════════════════════════════════

async function seedCommittees(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Committees...');
  let existing: any[];
  try {
    existing = await db.select().from(committees).limit(1);
  } catch {
    console.log('    (committee table not migrated yet, skipping)');
    return;
  }
  if (existing.length > 0) {
    console.log('    (already seeded, skipping)');
    return;
  }

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  // 3 committees
  const committeeData = [
    { name: 'Executive Board', description: 'Oversees chapter operations, strategic planning, and officer coordination.', status: 'active' as const },
    { name: 'Events & Programs Committee', description: 'Plans and executes chapter events, conventions, and social gatherings.', status: 'active' as const },
    { name: 'Special Projects — Outreach', description: 'Ad-hoc committee for community dental health outreach program.', status: 'completed' as const, dissolvedAt: daysAgo(10), dissolutionReason: 'Project completed — outreach program launched successfully.' },
  ];

  const insertedCommittees: string[] = [];
  for (const c of committeeData) {
    const [inserted] = await db.insert(committees).values({
      organizationId: orgId,
      ...c,
      dissolvedBy: c.dissolvedAt ? presidentPersonId : null,
    } as any).returning({ id: committees.id });
    if (inserted) insertedCommittees.push(inserted.id);
  }

  // Committee members
  if (insertedCommittees.length >= 3) {
    const memberData = [
      // Executive Board: president as chair + 3 members
      { committeeId: insertedCommittees[0]!, personId: presidentPersonId, role: 'chairperson' as const, active: true },
      { committeeId: insertedCommittees[0]!, personId: memberPersonIds[0]!, role: 'secretary' as const, active: true },
      { committeeId: insertedCommittees[0]!, personId: memberPersonIds[1]!, role: 'member' as const, active: true },
      { committeeId: insertedCommittees[0]!, personId: memberPersonIds[2]!, role: 'member' as const, active: true },
      // Events Committee: member as chair + 3 members
      { committeeId: insertedCommittees[1]!, personId: memberPersonIds[3]!, role: 'chairperson' as const, active: true },
      { committeeId: insertedCommittees[1]!, personId: memberPersonIds[4]!, role: 'vice_chairperson' as const, active: true },
      { committeeId: insertedCommittees[1]!, personId: memberPersonIds[5]!, role: 'member' as const, active: true },
      { committeeId: insertedCommittees[1]!, personId: memberPersonIds[6]!, role: 'member' as const, active: true },
      // Special Projects (dissolved): chair + 2 members, all inactive
      { committeeId: insertedCommittees[2]!, personId: memberPersonIds[7]!, role: 'chairperson' as const, active: false, removedAt: daysAgo(10) },
      { committeeId: insertedCommittees[2]!, personId: memberPersonIds[8]!, role: 'member' as const, active: false, removedAt: daysAgo(10) },
      { committeeId: insertedCommittees[2]!, personId: memberPersonIds[9]!, role: 'member' as const, active: false, removedAt: daysAgo(10) },
    ];

    for (const m of memberData) {
      await db.insert(committeeMembers).values({
        organizationId: orgId,
        assignedAt: daysAgo(60),
        ...m,
      } as any);
    }
    console.log(`    ✓ ${memberData.length} committee members seeded`);

    // Committee tasks
    const taskData = [
      // Executive Board tasks
      { committeeId: insertedCommittees[0]!, title: 'Review membership applications', assigneeId: memberPersonIds[0]!, status: 'completed' as const, priority: 'high' as const, dueDate: daysAgo(5), completedAt: daysAgo(6), completedBy: memberPersonIds[0]! },
      { committeeId: insertedCommittees[0]!, title: 'Prepare Q2 financial report', assigneeId: memberPersonIds[1]!, status: 'in_progress' as const, priority: 'high' as const, dueDate: daysFromNow(7) },
      { committeeId: insertedCommittees[0]!, title: 'Update chapter bylaws draft', assigneeId: presidentPersonId, status: 'pending' as const, priority: 'medium' as const, dueDate: daysFromNow(30) },
      // Events Committee tasks
      { committeeId: insertedCommittees[1]!, title: 'Book venue for annual convention', assigneeId: memberPersonIds[3]!, status: 'completed' as const, priority: 'urgent' as const, dueDate: daysAgo(15), completedAt: daysAgo(17), completedBy: memberPersonIds[3]! },
      { committeeId: insertedCommittees[1]!, title: 'Send speaker invitations', assigneeId: memberPersonIds[4]!, status: 'in_progress' as const, priority: 'high' as const, dueDate: daysFromNow(14) },
      { committeeId: insertedCommittees[1]!, title: 'Design event promotional materials', assigneeId: memberPersonIds[5]!, status: 'pending' as const, priority: 'medium' as const, dueDate: daysFromNow(21) },
      // Overdue task (important for dashboard)
      { committeeId: insertedCommittees[1]!, title: 'Finalize catering arrangements', assigneeId: memberPersonIds[6]!, status: 'pending' as const, priority: 'high' as const, dueDate: daysAgo(3) },
      // Cancelled task
      { committeeId: insertedCommittees[2]!, title: 'Coordinate with barangay health centers', assigneeId: memberPersonIds[7]!, status: 'cancelled' as const, priority: 'low' as const, dueDate: daysAgo(20) },
    ];

    for (const t of taskData) {
      await db.insert(committeeTasks).values({
        organizationId: orgId,
        description: `Task for ${t.title.toLowerCase()}`,
        ...t,
      } as any);
    }
    console.log(`    ✓ ${taskData.length} committee tasks seeded (2 completed, 2 in-progress, 2 pending, 1 overdue, 1 cancelled)`);
  }

  console.log(`    ✓ ${insertedCommittees.length} committees seeded`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 19: Events gap-fill — check-ins, waitlist, full election
// ═══════════════════════════════════════════════════════════════

async function seedEventsGapFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Events gap-fill (check-ins + waitlist + nominees + votes)...');

  // ─── Check-ins ────────────────────────────────────────────────
  let existingCheckIns: any[];
  try {
    existingCheckIns = await db.select().from(checkIns).limit(1);
  } catch {
    console.log('    (check_in table not migrated yet, skipping)');
    existingCheckIns = [{ _skip: true }];
  }
  if (existingCheckIns.length === 0) {
    // Attach to completed past events
    const completedEvents = await db.select({ id: events.id })
      .from(events)
      .where(sql`${events.status} = 'completed'`)
      .limit(2);
    if (completedEvents.length > 0) {
      const now = new Date();
      const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
      // 5 check-ins across 2 events
      const checkInData: Array<{ eventId: string; personId: string; method: 'qr' | 'manual'; checkedInAt: Date }> = [];
      for (let i = 0; i < Math.min(5, memberPersonIds.length); i++) {
        checkInData.push({
          eventId: completedEvents[i % completedEvents.length]!.id,
          personId: memberPersonIds[i]!,
          method: i % 2 === 0 ? 'qr' : 'manual',
          checkedInAt: daysAgo(30 + i),
        });
      }
      // president check-in
      if (completedEvents[0]) {
        checkInData.push({ eventId: completedEvents[0].id, personId: presidentPersonId, method: 'qr', checkedInAt: daysAgo(30) });
      }
      for (const ci of checkInData) {
        await db.insert(checkIns).values({
          organizationId: orgId,
          eventId: ci.eventId,
          personId: ci.personId,
          method: ci.method,
          checkedInAt: ci.checkedInAt,
          checkedInBy: presidentPersonId,
        } as any);
      }
      console.log(`    ✓ ${checkInData.length} check-in records seeded`);
    } else {
      console.log('    (no completed events found, skipping check-ins)');
    }
  } else if (!(existingCheckIns[0] as any)._skip) {
    console.log('    (check-ins already seeded, skipping)');
  }

  // ─── Waitlist entries ─────────────────────────────────────────
  let existingWaitlist: any[];
  try {
    existingWaitlist = await db.select().from(waitlistEntries).limit(1);
  } catch {
    console.log('    (waitlist_entry table not migrated yet, skipping)');
    existingWaitlist = [{ _skip: true }];
  }
  if (existingWaitlist.length === 0) {
    const publishedEvents = await db.select({ id: events.id })
      .from(events)
      .where(sql`${events.status} = 'published'`)
      .limit(1);
    if (publishedEvents.length > 0) {
      const now = new Date();
      const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
      const eventId = publishedEvents[0]!.id;
      const waitlistData = memberPersonIds.slice(10, 13).map((personId, idx) => ({
        organizationId: orgId,
        eventId,
        personId,
        position: idx + 1,
        joinedAt: daysAgo(5 - idx),
        promotedAt: idx === 0 ? daysAgo(2) : null, // first one was promoted
      }));
      for (const w of waitlistData) {
        await db.insert(waitlistEntries).values(w as any);
      }
      console.log(`    ✓ ${waitlistData.length} waitlist entries seeded (1 promoted)`);
    } else {
      console.log('    (no published events found, skipping waitlist)');
    }
  } else if (!(existingWaitlist[0] as any)._skip) {
    console.log('    (waitlist entries already seeded, skipping)');
  }

  // ─── Election nominees + votes ────────────────────────────────
  let existingNominees: any[];
  try {
    existingNominees = await db.select().from(electionNominees).limit(1);
  } catch {
    console.log('    (election_nominee table not migrated yet, skipping)');
    return;
  }
  if (existingNominees.length === 0) {
    // Find published election (2025)
    const pubElections = await db.select({ id: elections.id, organizationId: elections.organizationId })
      .from(elections)
      .where(sql`${elections.status} = 'published' AND ${elections.organizationId} = ${orgId}`)
      .limit(1);
    if (pubElections.length > 0) {
      const electionId = pubElections[0]!.id;
      // Find positions
      const positionRows = await db.select({ id: positions.id, title: positions.title })
        .from(positions)
        .where(sql`${positions.organizationId} = ${orgId}`)
        .limit(3);
      if (positionRows.length > 0) {
        const presidentPos = positionRows.find((p: any) => p.title === 'President') || positionRows[0]!;
        const treasurerPos = positionRows.find((p: any) => p.title === 'Treasurer') || positionRows[Math.min(1, positionRows.length - 1)]!;
        // 3 nominees: president (elected), 2 others for treasurer
        const nomineeData = [
          { electionId, organizationId: orgId, positionId: presidentPos.id, personId: presidentPersonId, nominatedBy: presidentPersonId, status: 'elected' as const },
          { electionId, organizationId: orgId, positionId: treasurerPos.id, personId: memberPersonIds[0]!, nominatedBy: presidentPersonId, status: 'elected' as const },
          { electionId, organizationId: orgId, positionId: treasurerPos.id, personId: memberPersonIds[1]!, nominatedBy: memberPersonIds[0]!, status: 'accepted' as const },
        ];
        const insertedNominees: string[] = [];
        for (const n of nomineeData) {
          const [inserted] = await db.insert(electionNominees).values(n as any).returning({ id: electionNominees.id });
          if (inserted) insertedNominees.push(inserted.id);
        }
        console.log(`    ✓ ${insertedNominees.length} election nominees seeded`);

        // Votes: 5 members voted for the two elected nominees
        const votesData: Array<{ electionId: string; organizationId: string; positionId: string; nomineeId: string; voterId: string }> = [];
        for (let i = 0; i < Math.min(5, memberPersonIds.length); i++) {
          // vote for president nominee
          if (insertedNominees[0]) {
            votesData.push({ electionId, organizationId: orgId, positionId: presidentPos.id, nomineeId: insertedNominees[0], voterId: memberPersonIds[i]! });
          }
          // vote for treasurer nominee
          if (insertedNominees[1]) {
            votesData.push({ electionId, organizationId: orgId, positionId: treasurerPos.id, nomineeId: insertedNominees[1], voterId: memberPersonIds[i]! });
          }
        }
        let existingVotes: any[];
        try {
          existingVotes = await db.select().from(electionVotes).limit(1);
        } catch {
          console.log('    (election_vote table not migrated yet, skipping votes)');
          existingVotes = [{ _skip: true }];
        }
        if (existingVotes.length === 0) {
          for (const v of votesData) {
            await db.insert(electionVotes).values(v as any).onConflictDoNothing();
          }
          console.log(`    ✓ ${votesData.length} election votes seeded`);
        } else if (!(existingVotes[0] as any)._skip) {
          console.log('    (election votes already seeded, skipping)');
        }
      } else {
        console.log('    (no positions found, skipping nominees/votes)');
      }
    } else {
      console.log('    (no published elections found, skipping nominees/votes)');
    }
  } else {
    console.log('    (election nominees already seeded, skipping)');
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 20: Training gap-fill — courses, enrollments, quiz attempts,
//           accredited providers
// ═══════════════════════════════════════════════════════════════

async function seedTrainingGapFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Training gap-fill (accredited providers + courses + enrollments + quizzes)...');

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  // ─── Accredited providers ─────────────────────────────────────
  let existingProviders: any[];
  try {
    existingProviders = await db.select().from(accreditedProviders).limit(1);
  } catch {
    console.log('    (accredited_provider table not migrated yet, skipping providers)');
    existingProviders = [{ _skip: true }];
  }
  const seededProviderIds: string[] = [];
  if (existingProviders.length === 0) {
    const providerData = [
      { organizationId: orgId, name: 'Philippine Dental Association – CPD Council', accreditationNumber: 'PDA-CPD-001', status: 'active' as const, expiryDate: daysFromNow(365) },
      { organizationId: orgId, name: 'Philippine College of Oral Surgeons', accreditationNumber: 'PCOS-CPD-022', status: 'active' as const, expiryDate: daysFromNow(180) },
      { organizationId: orgId, name: 'DOH Region VII Training Unit', accreditationNumber: 'DOH-R7-055', status: 'suspended' as const, expiryDate: daysAgo(30) },
    ];
    for (const p of providerData) {
      const [inserted] = await db.insert(accreditedProviders).values(p as any).returning({ id: accreditedProviders.id });
      if (inserted) seededProviderIds.push(inserted.id);
    }
    console.log(`    ✓ ${seededProviderIds.length} accredited providers seeded`);
  } else if (!(existingProviders[0] as any)._skip) {
    console.log('    (accredited providers already seeded, skipping)');
    const rows = await db.select({ id: accreditedProviders.id }).from(accreditedProviders).limit(3);
    seededProviderIds.push(...rows.map((r: any) => r.id));
  }

  // ─── Courses (self-paced online) ──────────────────────────────
  let existingCourses: any[];
  try {
    existingCourses = await db.select().from(courses).limit(1);
  } catch {
    console.log('    (course table not migrated yet, skipping courses)');
    return;
  }
  const seededCourseIds: string[] = [];
  if (existingCourses.length === 0) {
    const courseData = [
      { organizationId: orgId, title: 'Infection Control & Sterilization Standards', description: 'Self-paced module covering ADA/PDA infection control protocols.', creditAmount: 3, status: 'published' as const, publishedAt: daysAgo(60) },
      { organizationId: orgId, title: 'Introduction to Digital Dentistry', description: 'CAD/CAM, intraoral scanners, and digital workflows.', creditAmount: 5, status: 'published' as const, publishedAt: daysAgo(45) },
      { organizationId: orgId, title: 'Ethics in Dental Practice', description: 'Professional obligations, informed consent, and patient rights.', creditAmount: 2, status: 'published' as const, publishedAt: daysAgo(30) },
      { organizationId: orgId, title: 'Advanced Periodontal Techniques', description: 'Coming soon — advanced surgical protocols.', creditAmount: 8, status: 'draft' as const },
    ];
    for (const c of courseData) {
      const [inserted] = await db.insert(courses).values(c as any).returning({ id: courses.id });
      if (inserted) seededCourseIds.push(inserted.id);
    }
    console.log(`    ✓ ${seededCourseIds.length} courses seeded`);
  } else {
    console.log('    (courses already seeded, skipping)');
    const rows = await db.select({ id: courses.id }).from(courses).limit(4);
    seededCourseIds.push(...rows.map((r: any) => r.id));
  }

  // ─── Course enrollments ───────────────────────────────────────
  let existingEnrollments: any[];
  try {
    existingEnrollments = await db.select().from(courseEnrollments).limit(1);
  } catch {
    console.log('    (course_enrollment table not migrated yet, skipping enrollments)');
    return;
  }
  if (existingEnrollments.length === 0 && seededCourseIds.length > 0) {
    const enrollmentData: Array<{ organizationId: string; courseId: string; personId: string; progress: number; status: 'enrolled' | 'completed' | 'cancelled'; completedAt: Date | null }> = [];
    // Enroll first 6 members across courses
    for (let i = 0; i < Math.min(6, memberPersonIds.length); i++) {
      const courseId = seededCourseIds[i % Math.min(3, seededCourseIds.length)]!;
      const isCompleted = i < 3;
      enrollmentData.push({
        organizationId: orgId,
        courseId,
        personId: memberPersonIds[i]!,
        progress: isCompleted ? 100 : Math.round(30 + i * 15),
        status: isCompleted ? 'completed' : 'enrolled',
        completedAt: isCompleted ? daysAgo(10 - i) : null,
      });
    }
    // President enrolled in course 0
    if (seededCourseIds[0]) {
      enrollmentData.push({ organizationId: orgId, courseId: seededCourseIds[0], personId: presidentPersonId, progress: 100, status: 'completed', completedAt: daysAgo(15) });
    }
    for (const e of enrollmentData) {
      await db.insert(courseEnrollments).values(e as any);
    }
    console.log(`    ✓ ${enrollmentData.length} course enrollments seeded (4 completed, 3 in-progress)`);
  } else if (existingEnrollments.length > 0) {
    console.log('    (course enrollments already seeded, skipping)');
  }

  // ─── Quiz attempts ────────────────────────────────────────────
  let existingAttempts: any[];
  try {
    existingAttempts = await db.select().from(quizAttempts).limit(1);
  } catch {
    console.log('    (quiz_attempt table not migrated yet, skipping quiz attempts)');
    return;
  }
  if (existingAttempts.length === 0 && seededCourseIds.length > 0) {
    const attemptData = [
      // Pass: member0 on course0
      { organizationId: orgId, courseId: seededCourseIds[0]!, personId: memberPersonIds[0]!, score: 85, maxScore: 100, passed: true, attemptedAt: daysAgo(8), answers: { q1: 'a', q2: 'b', q3: 'c' } },
      // Pass: member1 on course1
      { organizationId: orgId, courseId: seededCourseIds[1 % seededCourseIds.length]!, personId: memberPersonIds[1]!, score: 90, maxScore: 100, passed: true, attemptedAt: daysAgo(7), answers: { q1: 'a', q2: 'a', q3: 'b' } },
      // Fail then pass: member2 on course0 (2 attempts)
      { organizationId: orgId, courseId: seededCourseIds[0]!, personId: memberPersonIds[2]!, score: 55, maxScore: 100, passed: false, attemptedAt: daysAgo(12), answers: { q1: 'b', q2: 'c', q3: 'a' } },
      { organizationId: orgId, courseId: seededCourseIds[0]!, personId: memberPersonIds[2]!, score: 78, maxScore: 100, passed: true, attemptedAt: daysAgo(5), answers: { q1: 'a', q2: 'b', q3: 'c' } },
      // President pass
      { organizationId: orgId, courseId: seededCourseIds[0]!, personId: presidentPersonId, score: 95, maxScore: 100, passed: true, attemptedAt: daysAgo(14), answers: { q1: 'a', q2: 'b', q3: 'c' } },
    ];
    for (const a of attemptData) {
      await db.insert(quizAttempts).values(a as any);
    }
    console.log(`    ✓ ${attemptData.length} quiz attempts seeded (4 pass, 1 fail)`);
  } else if (existingAttempts.length > 0) {
    console.log('    (quiz attempts already seeded, skipping)');
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 21: Credentials — professional licenses, renewal alerts,
//           credential templates, digital credentials (member IDs)
// ═══════════════════════════════════════════════════════════════

async function seedCredentialsGapFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
  allMembershipIds: string[],
) {
  console.log('  Credentials gap-fill (licenses + alerts + templates + digital IDs)...');

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  // ─── Professional licenses ────────────────────────────────────
  let existingLicenses: any[];
  try {
    existingLicenses = await db.select().from(professionalLicenses).limit(1);
  } catch {
    console.log('    (professional_license table not migrated yet, skipping)');
    return;
  }
  if (existingLicenses.length === 0) {
    const licensePersonIds = [presidentPersonId, ...memberPersonIds.slice(0, 7)];
    const licenseData = licensePersonIds.map((personId, idx) => ({
      organizationId: orgId,
      personId,
      licenseType: 'Dentist',
      licenseNumber: `0${String(12345 + idx).padStart(6, '0')}`,
      issuingAuthority: 'Professional Regulation Commission',
      jurisdiction: 'Philippines',
      issuedDate: `${2019 + (idx % 3)}-06-15`,
      expirationDate: idx < 5
        ? `${2026 + (idx % 2)}-06-14`  // valid
        : `2025-06-14`,                 // expired (for alert scenarios)
      status: idx < 6 ? 'active' as const : 'expired' as const,
      verifiedAt: idx < 5 ? daysAgo(30) : null,
      verifiedBy: idx < 5 ? presidentPersonId : null,
    }));
    const insertedLicenses: string[] = [];
    for (const l of licenseData) {
      const [ins] = await db.insert(professionalLicenses).values(l as any).returning({ id: professionalLicenses.id });
      if (ins) insertedLicenses.push(ins.id);
    }
    console.log(`    ✓ ${insertedLicenses.length} professional licenses seeded (6 active, 2 expired)`);

    // ─── Renewal alerts for expiring licenses ─────────────────
    let existingAlerts: any[];
    try {
      existingAlerts = await db.select().from(licenseRenewalAlerts).limit(1);
    } catch {
      console.log('    (license_renewal_alert table not migrated yet, skipping alerts)');
      existingAlerts = [];
    }
    if (existingAlerts.length === 0 && insertedLicenses.length >= 2) {
      const alertData = [
        // 90-day advance warning for member[4]'s license (expiring in ~365 days)
        { organizationId: orgId, licenseId: insertedLicenses[4]!, personId: licensePersonIds[4]!, alertDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, daysUntilExpiry: 90, status: 'sent' as const },
        // 30-day final warning for member[5] (expiring in ~30 days)
        { organizationId: orgId, licenseId: insertedLicenses[5]!, personId: licensePersonIds[5]!, alertDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, daysUntilExpiry: 30, status: 'pending' as const },
        // Acknowledged by member[3]
        { organizationId: orgId, licenseId: insertedLicenses[3]!, personId: licensePersonIds[3]!, alertDate: daysAgo(20).toISOString().slice(0, 10), daysUntilExpiry: 110, status: 'acknowledged' as const },
      ];
      for (const a of alertData) {
        await db.insert(licenseRenewalAlerts).values(a as any);
      }
      console.log(`    ✓ ${alertData.length} license renewal alerts seeded`);
    }
  } else {
    console.log('    (professional licenses already seeded, skipping)');
  }

  // ─── Credential template ──────────────────────────────────────
  let existingTemplates: any[];
  try {
    existingTemplates = await db.select().from(credentialTemplates).limit(1);
  } catch {
    console.log('    (credential_template table not migrated yet, skipping)');
    return;
  }
  let templateId: string | null = null;
  if (existingTemplates.length === 0) {
    const templateDesign = JSON.stringify({
      background: '#1a3a5c', textColor: '#ffffff',
      logo: '/assets/pda-logo.png', watermark: true,
    });
    const [inserted] = await db.insert(credentialTemplates).values({
      organizationId: orgId,
      name: 'PDA Metro Manila — Member ID Card',
      type: 'memberCard',
      design: templateDesign,
      validityPeriod: 365,
      status: 'active',
    } as any).returning({ id: credentialTemplates.id });
    templateId = inserted?.id ?? null;
    console.log(`    ✓ Credential template seeded`);
  } else {
    templateId = existingTemplates[0]?.id ?? null;
    console.log('    (credential template already seeded, skipping)');
  }

  // ─── Digital credentials (member ID cards) ───────────────────
  let existingDCs: any[];
  try {
    existingDCs = await db.select().from(digitalCredentials).limit(1);
  } catch {
    console.log('    (digital_credential table not migrated yet, skipping)');
    return;
  }
  if (existingDCs.length === 0 && templateId) {
    const dcPersonIds = [presidentPersonId, ...memberPersonIds.slice(0, 5)];
    const dcData = dcPersonIds.map((personId, idx) => ({
      organizationId: orgId,
      personId,
      templateId,
      membershipId: allMembershipIds[idx] ?? null,
      credentialNumber: `PDA-MM-2025-${String(1000 + idx).padStart(4, '0')}`,
      issuedAt: daysAgo(90 - idx * 5),
      expiresAt: daysFromNow(275 + idx * 5),
      status: idx < 5 ? 'active' as const : 'revoked' as const,
      qrPayload: `https://verify.pda.ph/dc/PDA-MM-2025-${String(1000 + idx).padStart(4, '0')}`,
      hmacKey: `hmac_${Buffer.from(`${personId}-${templateId}`).toString('base64').slice(0, 32)}`,
      pdfUrl: `https://storage.pda.ph/credentials/PDA-MM-2025-${String(1000 + idx).padStart(4, '0')}.pdf`,
      verificationUrl: `https://verify.pda.ph/dc/PDA-MM-2025-${String(1000 + idx).padStart(4, '0')}`,
      revokedAt: idx >= 5 ? daysAgo(10) : null,
      revocationReason: idx >= 5 ? 'Membership lapsed — credential suspended.' : null,
    }));
    for (const dc of dcData) {
      await db.insert(digitalCredentials).values(dc as any);
    }
    console.log(`    ✓ ${dcData.length} digital credentials (member IDs) seeded`);
  } else if (existingDCs.length > 0) {
    console.log('    (digital credentials already seeded, skipping)');
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 22: Directory profiles, chapter affiliations,
//           notification prefs, privacy settings,
//           membership status history
// ═══════════════════════════════════════════════════════════════

async function seedProfileAndGovernanceGapFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
  allMembershipIds: string[],
) {
  console.log('  Profile + governance gap-fill (directory, affiliations, prefs, status history)...');

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  // ─── Directory profiles ───────────────────────────────────────
  let existingProfiles: any[];
  try {
    existingProfiles = await db.select().from(directoryProfiles).limit(1);
  } catch {
    console.log('    (directory_profile table not migrated yet, skipping)');
    existingProfiles = [{ _skip: true }];
  }
  if (existingProfiles.length === 0) {
    const profilePersonIds = [presidentPersonId, ...memberPersonIds.slice(0, 8)];
    const specialties = ['Orthodontics', 'Prosthodontics', 'General Dentistry', 'Oral Surgery', 'Periodontics', 'Endodontics', 'Pediatric Dentistry', 'Oral Pathology', 'General Dentistry'];
    const visibilities: Array<'public' | 'memberOnly' | 'hidden'> = ['public', 'public', 'memberOnly', 'memberOnly', 'memberOnly', 'hidden', 'hidden', 'memberOnly', 'public'];
    const profileData = profilePersonIds.map((personId, idx) => ({
      organizationId: orgId,
      personId,
      displayName: idx === 0 ? 'Dr. Maria Santos, DMD, MOrthRCS' : `Dr. Member ${idx}`,
      title: 'DMD',
      organization: 'PDA Metro Manila Chapter',
      specialty: specialties[idx] ?? 'General Dentistry',
      location: idx < 3 ? 'Makati City, Metro Manila' : 'Quezon City, Metro Manila',
      bio: idx < 3 ? `Experienced dental professional specializing in ${specialties[idx] ?? 'dentistry'} with over ${10 + idx} years in practice.` : null,
      contactEmail: idx < 4 ? `doctor${idx}@pdamanila.ph` : null,
      website: idx === 0 ? 'https://drsantos.ph' : null,
      socialLinks: idx === 0 ? { linkedin: 'linkedin.com/in/drsantos' } : null,
      visibility: visibilities[idx] ?? 'hidden',
      publishedAt: visibilities[idx] !== 'hidden' ? daysAgo(60 - idx * 5) : null,
      lastUpdatedAt: daysAgo(10),
    }));
    for (const p of profileData) {
      await db.insert(directoryProfiles).values(p as any);
    }
    console.log(`    ✓ ${profileData.length} directory profiles seeded (3 public, 4 memberOnly, 2 hidden)`);
  } else if (!(existingProfiles[0] as any)._skip) {
    console.log('    (directory profiles already seeded, skipping)');
  }

  // ─── Chapter affiliations ─────────────────────────────────────
  let existingAffiliations: any[];
  try {
    existingAffiliations = await db.select().from(chapterAffiliations).limit(1);
  } catch {
    console.log('    (chapter_affiliation table not migrated yet, skipping)');
    existingAffiliations = [{ _skip: true }];
  }
  if (existingAffiliations.length === 0) {
    const affiliationPersonIds = [presidentPersonId, ...memberPersonIds.slice(0, 10)];
    const affiliationData = affiliationPersonIds.map((personId, idx) => ({
      organizationId: orgId,
      personId,
      chapterId: orgId, // chapter = org in this context
      isPrimary: true,
      affiliatedAt: daysAgo(365 - idx * 5),
      status: idx >= 9 ? 'transferred' as const : 'active' as const,
    }));
    for (const a of affiliationData) {
      await db.insert(chapterAffiliations).values(a as any);
    }
    console.log(`    ✓ ${affiliationData.length} chapter affiliations seeded`);
  } else if (!(existingAffiliations[0] as any)._skip) {
    console.log('    (chapter affiliations already seeded, skipping)');
  }

  // ─── Notification preferences ─────────────────────────────────
  let existingPrefs: any[];
  try {
    existingPrefs = await db.select().from(notificationPreferences).limit(1);
  } catch {
    console.log('    (notification_preference table not migrated yet, skipping)');
    existingPrefs = [{ _skip: true }];
  }
  if (existingPrefs.length === 0) {
    const prefPersonIds = [presidentPersonId, ...memberPersonIds.slice(0, 5)];
    const categories = ['dues', 'events', 'trainings', 'announcements', 'credits'];
    const prefData: Array<{ organizationId: string; personId: string; category: string; pushEnabled: boolean; emailEnabled: boolean }> = [];
    for (const personId of prefPersonIds) {
      for (const category of categories) {
        prefData.push({
          organizationId: orgId,
          personId,
          category,
          pushEnabled: true,
          emailEnabled: category === 'dues' || category === 'announcements', // email on for important ones
        });
      }
    }
    for (const p of prefData) {
      await db.insert(notificationPreferences).values(p as any).onConflictDoNothing();
    }
    console.log(`    ✓ ${prefData.length} notification preferences seeded (${prefPersonIds.length} persons × ${categories.length} categories)`);
  } else if (!(existingPrefs[0] as any)._skip) {
    console.log('    (notification preferences already seeded, skipping)');
  }

  // ─── Privacy settings ─────────────────────────────────────────
  let existingPrivacy: any[];
  try {
    existingPrivacy = await db.select().from(personPrivacySettings).limit(1);
  } catch {
    console.log('    (person_privacy_setting table not migrated yet, skipping)');
    existingPrivacy = [{ _skip: true }];
  }
  if (existingPrivacy.length === 0) {
    const privacyPersonIds = [presidentPersonId, ...memberPersonIds.slice(0, 8)];
    const privacyData = privacyPersonIds.map((personId, idx) => ({
      organizationId: orgId,
      personId,
      // President and first 2 members are more visible
      emailVisible: idx < 3,
      phoneVisible: idx < 2,
      photoVisible: true, // everyone shows photo
      addressVisible: idx === 0, // only president shows address
    }));
    for (const p of privacyData) {
      await db.insert(personPrivacySettings).values(p as any).onConflictDoNothing();
    }
    console.log(`    ✓ ${privacyData.length} privacy settings seeded`);
  } else if (!(existingPrivacy[0] as any)._skip) {
    console.log('    (privacy settings already seeded, skipping)');
  }

  // ─── Membership status history ────────────────────────────────
  let existingHistory: any[];
  try {
    existingHistory = await db.select().from(membershipStatusHistory).limit(1);
  } catch {
    console.log('    (membership_status_history table not migrated yet, skipping)');
    return;
  }
  if (existingHistory.length === 0 && allMembershipIds.length > 0) {
    // Build transition history for first 5 memberships + grace/lapsed ones
    const historyData: Array<{
      organizationId: string; membershipId: string; personId: string;
      fromStatus: string | null; toStatus: string; reason: string | null;
      changedBy: string; changedAt: Date;
    }> = [];

    // Active members: pendingPayment → active (initial activation)
    for (let i = 0; i < Math.min(5, allMembershipIds.length); i++) {
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[i]!,
        personId: memberPersonIds[i] ?? presidentPersonId,
        fromStatus: null,
        toStatus: 'pendingPayment',
        reason: 'Membership application submitted',
        changedBy: presidentPersonId,
        changedAt: daysAgo(365 - i),
      });
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[i]!,
        personId: memberPersonIds[i] ?? presidentPersonId,
        fromStatus: 'pendingPayment',
        toStatus: 'active',
        reason: 'Dues payment confirmed',
        changedBy: presidentPersonId,
        changedAt: daysAgo(360 - i),
      });
    }

    // Grace period members (indices 15-17 in memberPersonIds — Jose, Valeria, Ricardo)
    for (let i = 15; i < Math.min(18, allMembershipIds.length); i++) {
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[i]!,
        personId: memberPersonIds[i] ?? presidentPersonId,
        fromStatus: 'active',
        toStatus: 'gracePeriod',
        reason: 'Annual dues overdue — entered grace period (BR-D3)',
        changedBy: presidentPersonId,
        changedAt: daysAgo(15 - (i - 15) * 3),
      });
    }

    // Lapsed members (indices 18-19 — Catalina, Eduardo)
    for (let i = 18; i < Math.min(20, allMembershipIds.length); i++) {
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[i]!,
        personId: memberPersonIds[i] ?? presidentPersonId,
        fromStatus: 'active',
        toStatus: 'gracePeriod',
        reason: 'Annual dues overdue — entered grace period',
        changedBy: presidentPersonId,
        changedAt: daysAgo(75),
      });
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[i]!,
        personId: memberPersonIds[i] ?? presidentPersonId,
        fromStatus: 'gracePeriod',
        toStatus: 'lapsed',
        reason: 'Grace period expired without payment',
        changedBy: presidentPersonId,
        changedAt: daysAgo(45),
      });
    }

    // Suspended members (indices 20-21 — Mariana, Sergio)
    for (let i = 20; i < Math.min(22, allMembershipIds.length); i++) {
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[i]!,
        personId: memberPersonIds[i] ?? presidentPersonId,
        fromStatus: 'active',
        toStatus: 'suspended',
        reason: i === 20
          ? 'Non-payment escalation — 3 dunning notices ignored'
          : 'Professional conduct issue — under review by ethics committee',
        changedBy: presidentPersonId,
        changedAt: daysAgo(14),
      });
    }

    // Removed member (index 22 — Daniela)
    if (allMembershipIds[22] && memberPersonIds[22]) {
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[22],
        personId: memberPersonIds[22],
        fromStatus: 'active',
        toStatus: 'suspended',
        reason: 'Credential fraud investigation initiated',
        changedBy: presidentPersonId,
        changedAt: daysAgo(45),
      });
      historyData.push({
        organizationId: orgId,
        membershipId: allMembershipIds[22],
        personId: memberPersonIds[22],
        fromStatus: 'suspended',
        toStatus: 'removed',
        reason: 'Fraudulent credentials — license number verified as invalid by PRC',
        changedBy: presidentPersonId,
        changedAt: daysAgo(30),
      });
    }

    // PendingPayment members (indices 23-24 — Francisco, Claudia) — no history needed
    // (they are in initial state, only have null → pendingPayment which is implicit)

    for (const h of historyData) {
      await db.insert(membershipStatusHistory).values(h as any);
    }
    console.log(`    ✓ ${historyData.length} membership status history entries seeded`);
  } else if (existingHistory.length > 0) {
    console.log('    (membership status history already seeded, skipping)');
  }
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

  // Phase 3: Regular Members (all 6 statuses)
  console.log('\nPhase 3: Regular Members (25 — active/grace/lapsed/suspended/removed/pendingPayment)...');
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

  // Phase 9: Profile photos
  console.log('\nPhase 9: Profile photos...');
  const allClients = [president, ...officerClients.slice(1), ...memberClients];
  const genderMap: Record<string, string> = {};
  // Officers
  for (const o of OFFICERS) {
    const c = allClients.find(c => c.email === o.email);
    if (c) genderMap[c.personId] = ['Juan', 'Carlos'].includes(o.firstName) ? 'male' : 'female';
  }
  // Members
  const femaleNames = ['Isabella', 'Patricia', 'Carmen', 'Teresa', 'Rosa', 'Lucia', 'Gabriela', 'Andrea', 'Valeria', 'Catalina', 'Mariana', 'Daniela', 'Claudia', 'Beatriz', 'Miguel'];
  for (const m of MEMBERS) {
    const c = allClients.find(c => c.email === m.email);
    if (c) genderMap[c.personId] = femaleNames.includes(m.firstName) ? 'female' : 'male';
  }
  await seedProfilePhotos(db, allClients.filter(c => c.personId).map(c => c.personId), genderMap);

  // Collect all person IDs for new phases
  const allPersonIds = allClients.filter(c => c.personId).map(c => c.personId);
  const memberPersonIds = memberClients.filter(c => c.personId).map(c => c.personId);

  // Phase 10: Notifications
  console.log('\nPhase 10: Notifications...');
  await seedNotifications(db, orgId, memberPersonIds, president.personId);

  // Phase 11: Certificates
  console.log('\nPhase 11: Certificates...');
  await seedCertificates(db, orgId, [president.personId, ...memberPersonIds.slice(0, 4)]);

  // Phase 12: Documents
  console.log('\nPhase 12: Documents...');
  await seedDocuments(db, orgId, president.personId, memberPersonIds);

  // Phase 13: Chat rooms & messages
  console.log('\nPhase 13: Comms...');
  await seedComms(db, orgId, president.personId, memberPersonIds);

  // Phase 14: Billing records
  console.log('\nPhase 14: Billing...');
  await seedBilling(db, orgId, president.personId, memberPersonIds);

  // Phase 15: Dunning events + audit trail
  console.log('\nPhase 15: Dunning events & audit...');
  await seedDunningEventsAndAudit(db, orgId, president.personId, memberPersonIds);

  // Phase 16: Marketplace, reviews, invites, storage
  console.log('\nPhase 16: Remaining modules...');
  await seedRemainingModules(db, orgId, president.personId, memberPersonIds);

  // Phase 17: Dues infrastructure (invoices, funds, submitted proofs)
  console.log('\nPhase 17: Dues infrastructure...');
  await seedDuesInfrastructure(db, orgId, president.personId, memberPersonIds);

  // Phase 18: Committees
  console.log('\nPhase 18: Committees...');
  await seedCommittees(db, orgId, president.personId, memberPersonIds);

  // Collect membership IDs for gap-fill phases (needed for status history, digital creds)
  const allMembershipRows = await db.select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.organizationId, orgId));
  const allMembershipIds = allMembershipRows.map((r: any) => r.id);

  // Phase 19: Events gap-fill (check-ins, waitlist, nominees, votes)
  console.log('\nPhase 19: Events gap-fill...');
  await seedEventsGapFill(db, orgId, president.personId, memberPersonIds);

  // Phase 20: Training gap-fill (accredited providers, courses, enrollments, quizzes)
  console.log('\nPhase 20: Training gap-fill...');
  await seedTrainingGapFill(db, orgId, president.personId, memberPersonIds);

  // Phase 21: Credentials gap-fill (licenses, renewal alerts, templates, digital IDs)
  console.log('\nPhase 21: Credentials gap-fill...');
  await seedCredentialsGapFill(db, orgId, president.personId, memberPersonIds, allMembershipIds);

  // Phase 22: Profile & governance gap-fill (directory, affiliations, prefs, privacy, status history)
  console.log('\nPhase 22: Profile & governance gap-fill...');
  await seedProfileAndGovernanceGapFill(db, orgId, president.personId, memberPersonIds, allMembershipIds);

  // Summary
  const personCount = await db.select().from(persons);
  const membershipCount = await db.select().from(memberships);
  const notifCount = await db.select().from(notifications);
  const certCount = await db.select().from(certificates);
  const docCount = await db.select().from(documents);
  const courseCount = await db.select().from(courses);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║           SEED SCENARIOS COMPLETE            ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Persons:         ${String(personCount.length).padStart(4)}                     ║`);
  console.log(`║  Memberships:     ${String(membershipCount.length).padStart(4)}                     ║`);
  console.log(`║  Officers:           5                       ║`);
  console.log(`║  Applicants:         2 (1 pending, 1 reject) ║`);
  console.log(`║  Notifications:   ${String(notifCount.length).padStart(4)}                     ║`);
  console.log(`║  Certificates:    ${String(certCount.length).padStart(4)}                     ║`);
  console.log(`║  Documents:       ${String(docCount.length).padStart(4)}                     ║`);
  console.log(`║  Courses:         ${String(courseCount.length).padStart(4)}                     ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Member Status Distribution:                 ║');
  console.log('║    Active:          16 (5 officers + 11 reg) ║');
  console.log('║    Grace Period:     3                       ║');
  console.log('║    Lapsed:           2                       ║');
  console.log('║    Suspended:        2                       ║');
  console.log('║    Removed:          1                       ║');
  console.log('║    Pending Payment:  2                       ║');
  console.log('╚══════════════════════════════════════════════╝');

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
