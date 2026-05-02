/**
 * Module seed script — adds sample data for F2-F10 modules.
 * Run AFTER base seed: bun run src/seed-modules.ts
 *
 * Requires: Database with base seed data already applied.
 * Does NOT require API server running (direct DB inserts).
 *
 * Skipped (tables not migrated yet):
 *   - F6: Communications (announcements)
 *   - F8: Elections
 *   - F9: Certificates
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

// Dues tables (new migration)
import { duesConfigs, duesFunds, duesPayments } from './handlers/dues/repos/dues.types';

// Membership, Events, Training — OLD schemas (existing DB tables)
import { membershipCategories } from './handlers/association:member/repos/membership.schema';
import { events, eventRegistrations } from './handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from './handlers/association:operations/repos/training.schema';

// Base tables
import { persons } from './handlers/person/repos/person.schema';
import { organizations } from './handlers/platformadmin/repos/platform-admin.schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://elad-mini@localhost:5432/monobase';

async function seedModules() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding F2-F10 module data...\n');

  // Get org and persons
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-metro-manila')).limit(1);
  if (!org) { console.error('Run base seed first!'); process.exit(1); }

  const allPersons = await db.select().from(persons).limit(10);
  const officerPerson = allPersons[0];
  const memberPerson = allPersons[1] ?? allPersons[0];

  if (!officerPerson) { console.error('No persons found. Run base seed first!'); process.exit(1); }

  const orgId = org.id;
  // tenantId convention: org.id is used as tenantId for org-scoped tables
  const tenantId = org.id;
  const officerId = officerPerson.id;
  const memberId = memberPerson!.id;

  // ─── F2: Dues Config + Funds + Payments ───────────────────
  console.log('  F2: Dues & Payments...');

  const existingConfig = await db.select().from(duesConfigs).where(eq(duesConfigs.organizationId, orgId)).limit(1);
  if (existingConfig.length === 0) {
    await db.insert(duesConfigs).values({
      organizationId: orgId,
      defaultAmount: 150000, // PHP 1,500 (in centavos)
      currency: 'PHP',
      billingFrequency: 'annual',
      dueDateMonth: 1,
      dueDateDay: 1,
      gracePeriodDays: 30,
    });
    console.log('    Config: PHP 1,500 annual, 30-day grace');

    // Funds
    await db.insert(duesFunds).values([
      { organizationId: orgId, name: 'General Fund', percentage: '33.00', sortOrder: 0, active: true },
      { organizationId: orgId, name: 'Education Fund', percentage: '33.00', sortOrder: 1, active: true },
      { organizationId: orgId, name: 'Building Fund', percentage: '34.00', sortOrder: 2, active: true },
    ]);
    console.log('    Funds: General (33%), Education (33%), Building (34%)');

    // Sample payments
    const payments = [
      { personId: memberId, amount: 150000, status: 'completed' as const, method: 'cash' as const, receipt: 'PDA-2026-000001', paidAt: new Date('2026-01-15') },
      { personId: officerId, amount: 150000, status: 'completed' as const, method: 'gcash' as const, receipt: 'PDA-2026-000002', paidAt: new Date('2026-02-01') },
      { personId: memberId, amount: 150000, status: 'pending' as const, method: 'online' as const, receipt: 'PDA-2026-000003', paidAt: null },
    ];

    for (const p of payments) {
      await db.insert(duesPayments).values({
        organizationId: orgId,
        personId: p.personId,
        receiptNumber: p.receipt,
        amount: p.amount,
        currency: 'PHP',
        paymentMethod: p.method,
        status: p.status,
        recordedBy: officerId,
        paidAt: p.paidAt,
      });
    }
    console.log('    Payments: 3 (2 completed, 1 pending)');
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F3: Membership Categories ────────────────────────────
  // Schema: membership_category(tenantId, orgId, name, description, applicableTiers jsonb)
  console.log('  F3: Membership categories...');

  const existingCats = await db.select().from(membershipCategories).where(eq(membershipCategories.tenantId, tenantId)).limit(1);
  if (existingCats.length === 0) {
    await db.insert(membershipCategories).values([
      {
        tenantId,
        orgId,
        name: 'Regular',
        description: 'Licensed practicing dentists',
        applicableTiers: [],
      },
      {
        tenantId,
        orgId,
        name: 'Associate',
        description: 'Dental students and recent graduates',
        applicableTiers: [],
      },
      {
        tenantId,
        orgId,
        name: 'Life',
        description: 'Lifetime members (exempt from dues)',
        applicableTiers: [],
      },
      {
        tenantId,
        orgId,
        name: 'Honorary',
        description: 'Distinguished contributors',
        applicableTiers: [],
      },
    ]);
    console.log('    Categories: Regular, Associate, Life, Honorary');
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F4: Events ───────────────────────────────────────────
  // Schema: event(tenantId, organizationId, title, description, location varchar,
  //              startDate, endDate, capacity, registrationFee bigint, status event_status)
  console.log('  F4: Events...');

  const existingEvents = await db.select().from(events).where(eq(events.organizationId, orgId)).limit(1);
  if (existingEvents.length === 0) {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const nextWeekPlus3h = new Date(nextWeek.getTime() + 3 * 60 * 60 * 1000);
    const twoWeeksOut = new Date(nextWeek.getTime() + 14 * 24 * 60 * 60 * 1000);
    const twoWeeksOutPlus8h = new Date(twoWeeksOut.getTime() + 8 * 60 * 60 * 1000);
    const lastMonthPlus3h = new Date(lastMonth.getTime() + 3 * 60 * 60 * 1000);

    const inserted = await db.insert(events).values([
      {
        tenantId,
        organizationId: orgId,
        title: 'Monthly General Assembly - May 2026',
        description: 'Regular monthly meeting of PDA Metro Manila members. Agenda includes quarterly financial report and upcoming election timeline.',
        location: 'PDA Convention Center, 123 Dental Ave, Makati City',
        startDate: nextWeek,
        endDate: nextWeekPlus3h,
        capacity: 100,
        registrationFee: 0,
        status: 'published',
      },
      {
        tenantId,
        organizationId: orgId,
        title: 'Dental Mission - Tondo Community',
        description: 'Free dental services for the Tondo community. Volunteers needed for extraction, cleaning, and oral health education.',
        location: 'Tondo Community Center, Tondo, Manila',
        startDate: twoWeeksOut,
        endDate: twoWeeksOutPlus8h,
        capacity: 30,
        registrationFee: 0,
        status: 'published',
      },
      {
        tenantId,
        organizationId: orgId,
        title: 'April General Assembly (Past)',
        description: 'Regular monthly meeting. Minutes available in the documents section.',
        location: 'PDA Convention Center, 123 Dental Ave, Makati City',
        startDate: lastMonth,
        endDate: lastMonthPlus3h,
        capacity: 100,
        registrationFee: 0,
        status: 'completed',
      },
    ]).returning();
    console.log('    Events: 3 (2 upcoming, 1 past)');

    // Register member for first (upcoming) event
    const upcomingEvent = inserted[0];
    if (upcomingEvent) {
      await db.insert(eventRegistrations).values({
        tenantId,
        eventId: upcomingEvent.id,
        personId: memberId,
        status: 'confirmed',
      });
      console.log('    Registration: member registered for General Assembly');
    }
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F5: Training ─────────────────────────────────────────
  // Schema: training(tenantId, organizationId, title, description, instructorName,
  //                  instructorId, location, startDate, endDate, creditValue numeric,
  //                  status training_status)
  console.log('  F5: Training...');

  const existingTrainings = await db.select().from(trainings).where(eq(trainings.organizationId, orgId)).limit(1);
  if (existingTrainings.length === 0) {
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const nextMonthPlus8h = new Date(nextMonth.getTime() + 8 * 60 * 60 * 1000);
    const nextMonthPlus7d = new Date(nextMonth.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonthPlus14d = new Date(nextMonth.getTime() + 14 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekPlus4h = new Date(lastWeek.getTime() + 4 * 60 * 60 * 1000);

    const insertedTrainings = await db.insert(trainings).values([
      {
        tenantId,
        organizationId: orgId,
        title: 'Advanced Endodontics Workshop',
        description: 'Hands-on workshop covering modern endodontic techniques including rotary instrumentation and bioceramic sealers.',
        instructorName: 'Dr. Maria Santos',
        location: 'PDA Training Center, 456 Skills Ave, Quezon City',
        startDate: nextMonth,
        endDate: nextMonthPlus8h,
        capacity: 25,
        registrationFee: 350000, // PHP 3,500
        creditAmount: 8,
        status: 'published',
      },
      {
        tenantId,
        organizationId: orgId,
        title: 'Infection Control Update 2026 (Online)',
        description: 'Annual infection control compliance training. Required for license renewal.',
        instructorName: 'Dr. Jose Reyes',
        location: 'Online — https://learn.pda.ph/infection-control-2026',
        startDate: nextMonthPlus7d,
        endDate: nextMonthPlus14d,
        capacity: null,
        registrationFee: 0,
        creditAmount: 4,
        status: 'published',
      },
      {
        tenantId,
        organizationId: orgId,
        title: 'Dental Photography Seminar (Completed)',
        description: 'Clinical photography techniques for documentation and case presentation.',
        instructorName: 'Dr. Ana Cruz',
        location: 'PDA Convention Center, 123 Dental Ave, Makati City',
        startDate: lastWeek,
        endDate: lastWeekPlus4h,
        capacity: 40,
        registrationFee: 150000, // PHP 1,500
        creditAmount: 4,
        status: 'completed',
      },
    ]).returning();
    console.log('    Trainings: 3 (2 upcoming, 1 completed)');

    // Enroll member in first (upcoming) training
    const upcomingTraining = insertedTrainings[0];
    if (upcomingTraining) {
      await db.insert(trainingEnrollments).values({
        tenantId,
        trainingId: upcomingTraining.id,
        personId: memberId,
        status: 'enrolled',
      });
      console.log('    Enrollment: member enrolled in Endodontics Workshop');
    }

    // Mark member as completed in past training (enrollment with completed status)
    const pastTraining = insertedTrainings[2];
    if (pastTraining) {
      await db.insert(trainingEnrollments).values({
        tenantId,
        trainingId: pastTraining.id,
        personId: memberId,
        status: 'completed',
        completedAt: pastTraining.endDate,
      });
      console.log('    Enrollment (completed): member finished Photography Seminar');
    }
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F6: Communications — SKIPPED (tables not migrated yet) ───
  console.log('  F6: Communications... (skipped — table not migrated)');

  // ─── F8: Elections — SKIPPED (tables not migrated yet) ────────
  console.log('  F8: Elections... (skipped — table not migrated)');

  // ─── F9: Certificates — SKIPPED (tables not migrated yet) ─────
  console.log('  F9: Certificates... (skipped — table not migrated)');

  // ─── Summary ──────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      MODULE SEED COMPLETE                ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Dues: config + 3 funds + 3 payments    ║');
  console.log('║  Membership: 4 categories               ║');
  console.log('║  Events: 3 events + 1 registration      ║');
  console.log('║  Training: 3 programs + 2 enrollments   ║');
  console.log('║  Comms/Elections/Certs: skipped         ║');
  console.log('╚══════════════════════════════════════════╝');

  await pool.end();
}

seedModules().catch(err => {
  console.error('Module seed failed:', err);
  process.exit(1);
});
