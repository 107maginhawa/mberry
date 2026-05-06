/**
 * Rich seed script — populates realistic demo data.
 * Run AFTER base seed + module seed.
 *
 * Creates: 50 memberships, 12 positions, 15 officer terms, 25 credit entries,
 * 15 dues payments, 15 event registrations, 10 training enrollments, certificates.
 *
 * Idempotent — safe to re-run.
 * Does NOT require API server running (direct DB inserts).
 *
 * Run: cd services/api-ts && bun run db:seed-rich
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, and, count } from 'drizzle-orm';
import { Pool } from 'pg';

import { memberships, membershipTiers, membershipCategories } from './handlers/association:member/repos/membership.schema';
import { positions, officerTerms } from './handlers/association:member/repos/governance.schema';
import { creditEntries } from './handlers/association:member/repos/credits.schema';
import { duesPayments } from './handlers/dues/repos/dues.schema';
import { certificates } from './handlers/certificates/repos/certificates.schema';
import { events, eventRegistrations } from './handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from './handlers/association:operations/repos/training.schema';
import { notifications } from './handlers/notifs/repos/notification.schema';
import { persons } from './handlers/person/repos/person.schema';
import { organizations } from './handlers/platformadmin/repos/platform-admin.schema';

const DATABASE_URL = process.env['DATABASE_URL'] || 'postgres://elad-mini@localhost:5432/monobase';

// ─── Helpers ────────────────────────────────────────────────

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(`${startYear}-01-01`).getTime();
  const end = new Date(`${endYear}-12-31`).getTime();
  return new Date(start + Math.random() * (end - start));
}

// ─── Main ───────────────────────────────────────────────────

async function seedRich() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding rich demo data...\n');

  // ─── Bootstrap: fetch reference data ──────────────────────

  const [org1] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-metro-manila')).limit(1);
  const [org2] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-cebu')).limit(1);
  if (!org1 || !org2) { console.error('Run base seed first!'); process.exit(1); }

  const allPersons = await db.select({ id: persons.id }).from(persons);
  if (allPersons.length < 10) { console.error('Need at least 10 persons. Run base seed first!'); process.exit(1); }

  // Give realistic Filipino names to persons that have "Test User" names
  const FILIPINO_NAMES = [
    ['Ana', 'Reyes'], ['Carlos', 'Garcia'], ['Elena', 'Torres'], ['Miguel', 'Bautista'],
    ['Sofia', 'Mendoza'], ['Rafael', 'Villanueva'], ['Isabella', 'Dela Cruz'], ['Luis', 'Ramos'],
    ['Patricia', 'Navarro'], ['Fernando', 'Castillo'], ['Carmen', 'Aquino'], ['Roberto', 'Gonzales'],
    ['Teresa', 'Santiago'], ['Antonio', 'Flores'], ['Rosa', 'Diaz'], ['Diego', 'Rivera'],
    ['Lucia', 'Hernandez'], ['Marco', 'Lim'], ['Gabriela', 'Tan'], ['Pedro', 'Sy'],
    ['Andrea', 'Ong'], ['Jose', 'Co'], ['Valeria', 'Chua'], ['Ricardo', 'Go'],
    ['Catalina', 'Yap'], ['Eduardo', 'Ang'], ['Mariana', 'Wu'], ['Sergio', 'Lee'],
    ['Daniela', 'Tiu'], ['Francisco', 'Uy'], ['Claudia', 'Cheng'], ['Alejandro', 'Koh'],
    ['Beatriz', 'Lao'], ['Manuel', 'Yu'], ['Victoria', 'Que'], ['Enrique', 'Siy'],
    ['Monica', 'Dee'], ['Arturo', 'Lam'], ['Natalia', 'Ty'], ['Ignacio', 'Ngo'],
  ];
  const testPersons = await db.select({ id: persons.id, firstName: persons.firstName }).from(persons)
    .where(sql`${persons.firstName} LIKE 'Test'`);
  for (let i = 0; i < testPersons.length && i < FILIPINO_NAMES.length; i++) {
    const [first, last] = FILIPINO_NAMES[i]!;
    await db.update(persons).set({ firstName: first, lastName: last }).where(eq(persons.id, testPersons[i]!.id));
  }
  if (testPersons.length > 0) console.log(`    Renamed ${Math.min(testPersons.length, FILIPINO_NAMES.length)} "Test User" persons to Filipino names`);

  // Get existing membership person IDs to exclude
  const existingMemberships = await db.select({ personId: memberships.personId }).from(memberships);
  const existingPersonIds = new Set(existingMemberships.map(m => m.personId));
  const availablePersons = allPersons.filter(p => !existingPersonIds.has(p.id));

  // Get tiers (only exist for org1)
  const tiers = await db.select().from(membershipTiers).where(eq(membershipTiers.organizationId, org1.id));
  const regularTier = tiers.find(t => t.code === 'REGULAR');
  const associateTier = tiers.find(t => t.code === 'ASSOCIATE');
  if (!regularTier || !associateTier) { console.error('No tiers found. Run base seed first!'); process.exit(1); }

  // Get categories
  const cats = await db.select().from(membershipCategories).where(eq(membershipCategories.organizationId, org1.id));
  const regularCat = cats.find(c => c.name === 'Regular');
  const associateCat = cats.find(c => c.name === 'Associate');

  // ═══════════════════════════════════════════════════════════
  // 0. SEED FUTURE EVENTS + NOTIFICATIONS (before snapshot)
  // ═══════════════════════════════════════════════════════════

  console.log('  0. Future events + notifications...');
  const [futureEventCount] = await db.select({ c: count() }).from(events)
    .where(and(eq(events.organizationId, org1.id), sql`start_date > now()`));
  if ((futureEventCount?.c ?? 0) >= 3) {
    console.log('    (future events already seeded, skipping)');
  } else {
    const now = new Date();
    const futureEvents = [
      { title: 'Annual Convention 2026', description: 'Three-day convention with keynote speakers and workshops', location: 'SMX Convention Center, Manila', startDate: new Date(now.getTime() + 14 * 86400000), endDate: new Date(now.getTime() + 16 * 86400000), capacity: 200, status: 'published' as const },
      { title: 'CPD Seminar: Digital Dentistry', description: 'Hands-on workshop on CAD/CAM systems', location: 'Hotel Sofitel, Pasay', startDate: new Date(now.getTime() + 30 * 86400000), endDate: new Date(now.getTime() + 30 * 86400000), capacity: 50, creditBearing: true, creditAmount: 8, status: 'published' as const },
      { title: 'Regional Officers Meeting', description: 'Quarterly meeting of chapter officers', location: 'PDA Office, Quezon City', startDate: new Date(now.getTime() + 45 * 86400000), endDate: new Date(now.getTime() + 45 * 86400000), capacity: 30, status: 'published' as const },
      { title: 'Community Dental Mission', description: 'Free dental services for underserved communities', location: 'Barangay Hall, Tondo', startDate: new Date(now.getTime() + 60 * 86400000), endDate: new Date(now.getTime() + 60 * 86400000), capacity: 100, status: 'published' as const },
      { title: 'Year-End Gala Dinner', description: 'Annual celebration and awards night', location: 'Manila Hotel', startDate: new Date(now.getTime() + 90 * 86400000), endDate: new Date(now.getTime() + 90 * 86400000), capacity: 150, status: 'published' as const },
    ];
    for (const evt of futureEvents) {
      await db.insert(events).values({
        organizationId: org1.id,
        ...evt,
        publishedAt: new Date(),
      });
    }
    // Register first person for first 3 events
    const insertedEvents = await db.select().from(events)
      .where(and(eq(events.organizationId, org1.id), sql`start_date > now()`));
    for (const evt of insertedEvents.slice(0, 3)) {
      await db.insert(eventRegistrations).values({
        eventId: evt.id,
        personId: allPersons[0].id,
        status: 'confirmed',
        registeredAt: new Date(),
      }).onConflictDoNothing();
    }
    console.log(`    Created ${futureEvents.length} future events, registered user for 3`);
  }

  // Seed notifications — use auth user ID (not person ID) because notifs endpoint filters by session.user.id
  const authUserRows = await db.execute(sql`SELECT id FROM "user" WHERE email = 'test@memberry.ph' LIMIT 1`);
  const authUserId = (authUserRows as any)?.[0]?.id || (authUserRows as any)?.rows?.[0]?.id;
  if (!authUserId) {
    console.log('    (auth user not found, skipping notifications)');
  } else {
    const [notifCount] = await db.select({ c: count() }).from(notifications)
      .where(eq(notifications.recipient, authUserId));
    if ((notifCount?.c ?? 0) >= 3) {
      console.log('    (notifications already seeded, skipping)');
    } else {
      const notifRows = [
        { type: 'billing' as const, title: 'Your dues payment was received', message: 'Payment of ₱1,200 for PDA Manila Chapter has been confirmed.', status: 'sent' as const },
        { type: 'system' as const, title: 'Welcome to Memberry', message: 'Your account has been set up. Complete your profile to get started.', status: 'sent' as const },
        { type: 'billing' as const, title: 'Dues renewal reminder', message: 'Your membership dues for PDA Metro Manila are due on December 31, 2025.', status: 'sent' as const },
        { type: 'system' as const, title: 'Profile updated', message: 'Your specialization has been updated to Orthodontics.', status: 'read' as const },
        { type: 'system' as const, title: 'New training available', message: 'CPD Seminar: Digital Dentistry is now open for registration.', status: 'sent' as const },
      ];
      for (const n of notifRows) {
        await db.insert(notifications).values({
          recipient: authUserId,
          channel: 'in-app',
          consentValidated: true,
          sentAt: new Date(),
          ...n,
        });
      }
      console.log(`    Created ${notifRows.length} notifications for user (auth ID: ${authUserId})`);
    }
  }

  // Get existing trainings and events (AFTER inserting future events)
  const allTrainings = await db.select().from(trainings).where(eq(trainings.organizationId, org1.id));
  const completedTraining = allTrainings.find(t => t.status === 'completed');
  const upcomingTrainings = allTrainings.filter(t => t.status === 'published');

  const allEvents = await db.select().from(events).where(eq(events.organizationId, org1.id));

  // ═══════════════════════════════════════════════════════════
  // 1. MEMBERSHIPS (50 new)
  // ═══════════════════════════════════════════════════════════

  console.log('  1. Memberships...');
  const [memCount] = await db.select({ c: count() }).from(memberships).where(eq(memberships.organizationId, org1.id));
  if ((memCount?.c ?? 0) > 10) {
    console.log('    (already seeded, skipping)');
  } else {
    // Ensure tiers exist for org2
    const org2Tiers = await db.select().from(membershipTiers).where(eq(membershipTiers.organizationId, org2.id));
    let org2RegularTier = org2Tiers.find(t => t.code === 'REGULAR');
    let org2AssociateTier = org2Tiers.find(t => t.code === 'ASSOCIATE');

    if (!org2RegularTier) {
      const [inserted] = await db.insert(membershipTiers).values({
        organizationId: org2.id,
        name: 'Regular',
        code: 'REGULAR',
        description: 'Licensed practicing dentists',
        annualFee: 150000,
        currency: 'PHP',
        benefits: ['Full voting rights', 'Event access', 'CPD tracking'],
        status: 'active',
      }).returning();
      org2RegularTier = inserted;
      console.log('    Created Regular tier for PDA Cebu');
    }
    if (!org2AssociateTier) {
      const [inserted] = await db.insert(membershipTiers).values({
        organizationId: org2.id,
        name: 'Associate',
        code: 'ASSOCIATE',
        description: 'Dental students and recent graduates',
        annualFee: 50000,
        currency: 'PHP',
        benefits: ['Event access', 'CPD tracking'],
        status: 'active',
      }).returning();
      org2AssociateTier = inserted;
      console.log('    Created Associate tier for PDA Cebu');
    }

    // Ensure categories exist for org2
    const org2Cats = await db.select().from(membershipCategories).where(eq(membershipCategories.organizationId, org2.id));
    if (org2Cats.length === 0) {
      await db.insert(membershipCategories).values([
        { organizationId: org2.id, name: 'Regular', description: 'Licensed practicing dentists', applicableTiers: [] },
        { organizationId: org2.id, name: 'Associate', description: 'Dental students and recent graduates', applicableTiers: [] },
      ]);
      console.log('    Created categories for PDA Cebu');
    }
    const org2CatsRefresh = await db.select().from(membershipCategories).where(eq(membershipCategories.organizationId, org2.id));
    const org2RegularCat = org2CatsRefresh.find(c => c.name === 'Regular');
    const org2AssociateCat = org2CatsRefresh.find(c => c.name === 'Associate');

    const numToSeed = Math.min(availablePersons.length, 50);
    const org1Count = Math.min(35, Math.floor(numToSeed * 0.7));
    const org2Count = numToSeed - org1Count;

    // Status distribution helper
    type StatusConfig = { status: 'active' | 'gracePeriod' | 'lapsed' | 'suspended' | 'pendingPayment'; expiryDaysOffset: number };
    function getStatusConfig(idx: number, total: number): StatusConfig {
      const pct = idx / total;
      if (pct < 0.70) return { status: 'active', expiryDaysOffset: 180 + Math.floor(Math.random() * 200) };
      if (pct < 0.80) return { status: 'gracePeriod', expiryDaysOffset: -(Math.floor(Math.random() * 25) + 1) }; // 1-25 days ago
      if (pct < 0.90) return { status: 'lapsed', expiryDaysOffset: -(Math.floor(Math.random() * 200) + 60) }; // 60-260 days ago
      if (pct < 0.95) return { status: 'suspended', expiryDaysOffset: -90 };
      return { status: 'pendingPayment', expiryDaysOffset: 365 };
    }

    const membershipRows: any[] = [];

    // Org1 members
    for (let i = 0; i < org1Count; i++) {
      const person = availablePersons[i]!;
      const { status, expiryDaysOffset } = getStatusConfig(i, org1Count);
      const isAssociate = i % 5 === 4; // 20% associate
      const joinDate = randomDate(2023, 2025);
      membershipRows.push({
        organizationId: org1.id,
        personId: person.id,
        tierId: isAssociate ? associateTier.id : regularTier.id,
        categoryId: isAssociate ? (associateCat?.id ?? null) : (regularCat?.id ?? null),
        memberNumber: `PDA-2026-${String(100 + i).padStart(3, '0')}`,
        startDate: dateStr(joinDate),
        duesExpiryDate: dateStr(daysFromNow(expiryDaysOffset)),
        gracePeriodDays: 30,
        status,
        joinedAt: joinDate,
      });
    }

    // Org2 members
    for (let i = 0; i < org2Count; i++) {
      const person = availablePersons[org1Count + i]!;
      const { status, expiryDaysOffset } = getStatusConfig(i, org2Count);
      const isAssociate = i % 5 === 4;
      const joinDate = randomDate(2023, 2025);
      membershipRows.push({
        organizationId: org2.id,
        personId: person.id,
        tierId: isAssociate ? org2AssociateTier!.id : org2RegularTier!.id,
        categoryId: isAssociate ? (org2AssociateCat?.id ?? null) : (org2RegularCat?.id ?? null),
        memberNumber: `PDA-CEBU-${String(100 + i).padStart(3, '0')}`,
        startDate: dateStr(joinDate),
        duesExpiryDate: dateStr(daysFromNow(expiryDaysOffset)),
        gracePeriodDays: 30,
        status,
        joinedAt: joinDate,
      });
    }

    await db.insert(memberships).values(membershipRows);
    console.log(`    Created ${membershipRows.length} memberships (${org1Count} Manila, ${org2Count} Cebu)`);
  }

  // Refresh membership list for subsequent sections
  const allMembershipsNow = await db.select().from(memberships);
  const org1Members = allMembershipsNow.filter(m => m.organizationId === org1.id);
  const activeOrg1Members = org1Members.filter(m => m.status === 'active');

  // ═══════════════════════════════════════════════════════════
  // 2. POSITIONS + OFFICER TERMS
  // ═══════════════════════════════════════════════════════════

  console.log('  2. Positions + Officer Terms...');
  const [posCount] = await db.select({ c: count() }).from(positions).where(eq(positions.organizationId, org1.id));
  if ((posCount?.c ?? 0) > 0) {
    console.log('    (already seeded, skipping)');
  } else {
    const positionTitles = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'Public Relations Officer'];

    // Create positions for both orgs
    for (const org of [org1, org2]) {
      const posRows = positionTitles.map((title, idx) => ({
        organizationId: org.id,
        title,
        description: `${title} of ${org.slug === 'pda-metro-manila' ? 'PDA Metro Manila' : 'PDA Cebu'}`,
        level: 'chapter' as const,
        termLengthMonths: 12,
        maxTerms: title === 'Public Relations Officer' ? null : 2,
        sortOrder: idx,
      }));
      await db.insert(positions).values(posRows);
    }
    console.log('    Created 12 positions (6 per org)');

    // Create officer terms using active members
    const org1Positions = await db.select().from(positions).where(eq(positions.organizationId, org1.id));
    const org2Positions = await db.select().from(positions).where(eq(positions.organizationId, org2.id));
    const org2Members = allMembershipsNow.filter(m => m.organizationId === org2.id && m.status === 'active');

    const termStart = new Date('2025-07-01');
    const termEnd = new Date('2026-06-30');
    const prevTermStart = new Date('2024-07-01');
    const prevTermEnd = new Date('2025-06-30');

    const termRows: any[] = [];

    // Active terms for org1
    for (let i = 0; i < Math.min(org1Positions.length, activeOrg1Members.length); i++) {
      termRows.push({
        positionId: org1Positions[i]!.id,
        personId: activeOrg1Members[i]!.personId,
        organizationId: org1.id,
        status: 'active' as const,
        startDate: termStart,
        endDate: termEnd,
      });
    }

    // Active terms for org2
    for (let i = 0; i < Math.min(org2Positions.length, org2Members.length); i++) {
      termRows.push({
        positionId: org2Positions[i]!.id,
        personId: org2Members[i]!.personId,
        organizationId: org2.id,
        status: 'active' as const,
        startDate: termStart,
        endDate: termEnd,
      });
    }

    // 2 completed historical terms for org1 (different persons)
    if (activeOrg1Members.length > 7 && org1Positions.length >= 2) {
      termRows.push({
        positionId: org1Positions[0]!.id, // President
        personId: activeOrg1Members[6]!.personId,
        organizationId: org1.id,
        status: 'completed' as const,
        startDate: prevTermStart,
        endDate: prevTermEnd,
      });
      termRows.push({
        positionId: org1Positions[2]!.id, // Secretary
        personId: activeOrg1Members[7]!.personId,
        organizationId: org1.id,
        status: 'completed' as const,
        startDate: prevTermStart,
        endDate: prevTermEnd,
      });
    }

    await db.insert(officerTerms).values(termRows);
    console.log(`    Created ${termRows.length} officer terms`);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. CREDIT ENTRIES (25)
  // ═══════════════════════════════════════════════════════════

  console.log('  3. Credit Entries...');
  const [creditCount] = await db.select({ c: count() }).from(creditEntries).where(eq(creditEntries.organizationId, org1.id));
  if ((creditCount?.c ?? 0) > 0) {
    console.log('    (already seeded, skipping)');
  } else {
    const cycleStart = new Date('2024-01-01');
    const cycleEnd = new Date('2026-12-31');
    const creditRows: any[] = [];

    // Auto credits from completed training (10 entries)
    if (completedTraining) {
      const autoMembers = activeOrg1Members.slice(0, 10);
      for (const member of autoMembers) {
        creditRows.push({
          personId: member.personId,
          organizationId: org1.id,
          type: 'auto' as const,
          trainingId: completedTraining.id,
          activityName: completedTraining.title,
          provider: 'PDA Metro Manila',
          activityDate: completedTraining.endDate,
          creditAmount: completedTraining.creditAmount ?? 4,
          cycleStart,
          cycleEnd,
        });
      }
    }

    // Manual credits (15 entries across 8 members)
    const manualActivities = [
      { name: 'Philippine Dental Convention 2025', provider: 'PRC', credits: 8, date: new Date('2025-11-15') },
      { name: 'Infection Control Webinar (DOH)', provider: 'DOH', credits: 2, date: new Date('2025-09-20') },
      { name: 'Prosthodontics Lecture Series', provider: 'UST College of Dentistry', credits: 6, date: new Date('2025-07-10') },
      { name: 'Oral Surgery Case Presentation', provider: 'PGH Dental Department', credits: 3, date: new Date('2025-08-22') },
      { name: 'Pediatric Dentistry Workshop', provider: 'PDA National', credits: 4, date: new Date('2026-01-18') },
      { name: 'Community Dental Outreach', provider: 'Volunteer', credits: 2, date: new Date('2026-02-14') },
      { name: 'Dental Radiology Update', provider: 'PRC', credits: 3, date: new Date('2025-05-30') },
      { name: 'Practice Management Seminar', provider: 'ADA Philippines', credits: 4, date: new Date('2025-10-05') },
      { name: 'Implantology Basics Online', provider: 'Straumann Academy', credits: 6, date: new Date('2025-12-01') },
      { name: 'Ethics in Dentistry', provider: 'PRC', credits: 2, date: new Date('2026-03-10') },
      { name: 'TMJ Disorders Conference', provider: 'UP Manila', credits: 5, date: new Date('2025-06-15') },
      { name: 'Dental Materials Update', provider: '3M Philippines', credits: 3, date: new Date('2026-01-25') },
      { name: 'Orthodontics Mini-Residency', provider: 'PDA National', credits: 8, date: new Date('2025-04-20') },
      { name: 'Periodontal Surgery Workshop', provider: 'PSPD', credits: 6, date: new Date('2025-08-08') },
      { name: 'Digital Dentistry Forum', provider: 'Ivoclar Vivadent', credits: 4, date: new Date('2026-02-28') },
    ];

    for (let i = 0; i < manualActivities.length; i++) {
      const act = manualActivities[i]!;
      const memberIdx = i % 8; // spread across 8 members
      const member = activeOrg1Members[memberIdx + 2]; // offset from auto-credit members
      if (member) {
        creditRows.push({
          personId: member.personId,
          organizationId: org1.id,
          type: 'manual' as const,
          trainingId: null,
          activityName: act.name,
          provider: act.provider,
          activityDate: act.date,
          creditAmount: act.credits,
          cycleStart,
          cycleEnd,
        });
      }
    }

    if (creditRows.length > 0) {
      await db.insert(creditEntries).values(creditRows);
      console.log(`    Created ${creditRows.length} credit entries (${creditRows.filter(c => c.type === 'auto').length} auto, ${creditRows.filter(c => c.type === 'manual').length} manual)`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. DUES PAYMENTS (15 more)
  // ═══════════════════════════════════════════════════════════

  console.log('  4. Dues Payments...');
  const existingRichPayments = await db.select({ c: count() }).from(duesPayments).where(sql`receipt_number LIKE 'PDA-RICH-%'`);
  if ((existingRichPayments[0]?.c ?? 0) > 0) {
    console.log('    (already seeded, skipping)');
  } else {
    const officerId = activeOrg1Members[0]?.personId;
    if (!officerId) { console.log('    (no active members for recordedBy, skipping)'); }
    else {
      type PaymentDef = { memberIdx: number; amount: number; status: 'pending' | 'completed' | 'failed' | 'refunded'; method: 'cash' | 'gcash' | 'bank_transfer' | 'check' | 'online'; paidAt: Date | null };
      const paymentDefs: PaymentDef[] = [
        { memberIdx: 0, amount: 150000, status: 'completed', method: 'cash', paidAt: new Date('2026-01-10') },
        { memberIdx: 1, amount: 150000, status: 'completed', method: 'cash', paidAt: new Date('2026-01-20') },
        { memberIdx: 2, amount: 150000, status: 'completed', method: 'cash', paidAt: new Date('2026-02-05') },
        { memberIdx: 3, amount: 150000, status: 'completed', method: 'gcash', paidAt: new Date('2026-02-15') },
        { memberIdx: 4, amount: 150000, status: 'completed', method: 'gcash', paidAt: new Date('2026-03-01') },
        { memberIdx: 5, amount: 150000, status: 'completed', method: 'gcash', paidAt: new Date('2026-03-20') },
        { memberIdx: 6, amount: 150000, status: 'completed', method: 'bank_transfer', paidAt: new Date('2026-02-28') },
        { memberIdx: 7, amount: 150000, status: 'completed', method: 'bank_transfer', paidAt: new Date('2026-03-10') },
        { memberIdx: 8, amount: 150000, status: 'completed', method: 'check', paidAt: new Date('2026-01-15') },
        { memberIdx: 9, amount: 150000, status: 'completed', method: 'cash', paidAt: new Date('2026-04-01') },
        { memberIdx: 10, amount: 150000, status: 'pending', method: 'online', paidAt: null },
        { memberIdx: 11, amount: 150000, status: 'pending', method: 'online', paidAt: null },
        { memberIdx: 12, amount: 100000, status: 'completed', method: 'check', paidAt: new Date('2026-01-25') },
        { memberIdx: 13, amount: 150000, status: 'failed', method: 'online', paidAt: null },
        { memberIdx: 14, amount: 150000, status: 'refunded', method: 'bank_transfer', paidAt: new Date('2026-01-05') },
      ];

      const paymentRows = paymentDefs
        .filter(p => activeOrg1Members[p.memberIdx])
        .map((p, i) => ({
          organizationId: org1.id,
          personId: activeOrg1Members[p.memberIdx]!.personId,
          receiptNumber: `PDA-RICH-${String(i + 1).padStart(3, '0')}`,
          amount: p.amount,
          currency: 'PHP',
          paymentMethod: p.method,
          status: p.status,
          recordedBy: officerId,
          paidAt: p.paidAt,
          refundedAmount: p.status === 'refunded' ? p.amount : 0,
        }));

      if (paymentRows.length > 0) {
        await db.insert(duesPayments).values(paymentRows);
        console.log(`    Created ${paymentRows.length} dues payments`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 5. EVENT REGISTRATIONS (15)
  // ═══════════════════════════════════════════════════════════

  console.log('  5. Event Registrations...');
  const [regCount] = await db.select({ c: count() }).from(eventRegistrations);
  if ((regCount?.c ?? 0) > 5) {
    console.log('    (already seeded, skipping)');
  } else {
    const regRows: any[] = [];
    // Pick events
    const upcomingEvents = allEvents.filter(e => e.status === 'published');
    const pastEvents = allEvents.filter(e => e.status === 'completed');

    // 8 for first upcoming event
    if (upcomingEvents[0]) {
      for (let i = 0; i < Math.min(8, activeOrg1Members.length); i++) {
        regRows.push({
          eventId: upcomingEvents[0].id,
          personId: activeOrg1Members[i]!.personId,
          status: 'confirmed' as const,
        });
      }
    }

    // 5 for second upcoming event (3 confirmed, 2 waitlisted)
    if (upcomingEvents[1]) {
      for (let i = 8; i < Math.min(13, activeOrg1Members.length); i++) {
        regRows.push({
          eventId: upcomingEvents[1].id,
          personId: activeOrg1Members[i]!.personId,
          status: (i >= 11 ? 'waitlisted' : 'confirmed') as const,
        });
      }
    }

    // 2 for past event
    if (pastEvents[0]) {
      for (let i = 13; i < Math.min(15, activeOrg1Members.length); i++) {
        regRows.push({
          eventId: pastEvents[0].id,
          personId: activeOrg1Members[i]!.personId,
          status: 'confirmed' as const,
        });
      }
    }

    if (regRows.length > 0) {
      await db.insert(eventRegistrations).values(regRows);
      console.log(`    Created ${regRows.length} event registrations`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. TRAINING ENROLLMENTS (10)
  // ═══════════════════════════════════════════════════════════

  console.log('  6. Training Enrollments...');
  const [enrollCount] = await db.select({ c: count() }).from(trainingEnrollments);
  if ((enrollCount?.c ?? 0) > 5) {
    console.log('    (already seeded, skipping)');
  } else {
    const enrollRows: any[] = [];

    // 4 enrolled in first upcoming training
    if (upcomingTrainings[0]) {
      for (let i = 2; i < Math.min(6, activeOrg1Members.length); i++) {
        enrollRows.push({
          trainingId: upcomingTrainings[0].id,
          personId: activeOrg1Members[i]!.personId,
          status: 'enrolled' as const,
        });
      }
    }

    // 3 enrolled in second upcoming training
    if (upcomingTrainings[1]) {
      for (let i = 6; i < Math.min(9, activeOrg1Members.length); i++) {
        enrollRows.push({
          trainingId: upcomingTrainings[1].id,
          personId: activeOrg1Members[i]!.personId,
          status: 'enrolled' as const,
        });
      }
    }

    // 3 completed in past training
    if (completedTraining) {
      for (let i = 9; i < Math.min(12, activeOrg1Members.length); i++) {
        enrollRows.push({
          trainingId: completedTraining.id,
          personId: activeOrg1Members[i]!.personId,
          status: 'completed' as const,
          completedAt: completedTraining.endDate,
        });
      }
    }

    if (enrollRows.length > 0) {
      await db.insert(trainingEnrollments).values(enrollRows);
      console.log(`    Created ${enrollRows.length} training enrollments`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. CERTIFICATES
  // ═══════════════════════════════════════════════════════════

  console.log('  7. Certificates...');
  const [certCount] = await db.select({ c: count() }).from(certificates);
  if ((certCount?.c ?? 0) > 3) {
    console.log('    (already seeded, skipping)');
  } else if (!completedTraining) {
    console.log('    (no completed training, skipping)');
  } else {
    // Get all completed enrollments for past training
    const completedEnrollments = await db.select()
      .from(trainingEnrollments)
      .where(and(
        eq(trainingEnrollments.trainingId, completedTraining.id),
        eq(trainingEnrollments.status, 'completed'),
      ));

    // Also check existing certificates to avoid duplicates
    const existingCerts = await db.select({ personId: certificates.personId })
      .from(certificates)
      .where(eq(certificates.trainingId, completedTraining.id));
    const certPersonIds = new Set(existingCerts.map(c => c.personId));

    const certRows = completedEnrollments
      .filter(e => !certPersonIds.has(e.personId))
      .map((e, i) => ({
        organizationId: org1.id,
        personId: e.personId,
        trainingId: completedTraining.id,
        certificateNumber: `CERT-2026-${String(100 + i).padStart(3, '0')}`,
        issuedAt: completedTraining.endDate ?? new Date(),
      }));

    if (certRows.length > 0) {
      await db.insert(certificates).values(certRows);
      console.log(`    Created ${certRows.length} certificates`);
    } else {
      console.log('    (no new certificates needed)');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════

  // Final counts
  const finalCounts = await Promise.all([
    db.select({ c: count() }).from(memberships),
    db.select({ c: count() }).from(positions),
    db.select({ c: count() }).from(officerTerms),
    db.select({ c: count() }).from(creditEntries),
    db.select({ c: count() }).from(duesPayments),
    db.select({ c: count() }).from(eventRegistrations),
    db.select({ c: count() }).from(trainingEnrollments),
    db.select({ c: count() }).from(certificates),
  ]);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       RICH SEED COMPLETE                 ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Memberships:      ${String(finalCounts[0]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Positions:        ${String(finalCounts[1]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Officer Terms:    ${String(finalCounts[2]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Credit Entries:   ${String(finalCounts[3]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Dues Payments:    ${String(finalCounts[4]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Event Regs:       ${String(finalCounts[5]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Enrollments:      ${String(finalCounts[6]![0]!.c).padStart(4)}               ║`);
  console.log(`║  Certificates:     ${String(finalCounts[7]![0]!.c).padStart(4)}               ║`);
  console.log('╚══════════════════════════════════════════╝');

  await pool.end();
}

seedRich().catch(err => {
  console.error('Rich seed failed:', err);
  process.exit(1);
});
