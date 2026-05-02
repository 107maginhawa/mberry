/**
 * Module seed script — adds sample data for F2-F10 modules.
 * Run AFTER base seed: bun run src/seed-modules.ts
 *
 * Requires: Database with base seed data already applied.
 * Does NOT require API server running (direct DB inserts).
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

// Import schemas
import { duesConfigs, duesFunds, duesPayments } from './handlers/dues/repos/dues.types';
import { membershipCategories } from './handlers/membership/repos/membership.types';
import { events, eventRegistrations } from './handlers/events/repos/events.types';
import { trainings, trainingEnrollments, trainingAttendance } from './handlers/training/repos/training.types';
import { announcements, announcementStats } from './handlers/communications/repos/communications.types';
import { elections } from './handlers/elections/repos/elections.types';
import { certificates } from './handlers/certificates/repos/certificates.types';
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
  const officerId = officerPerson.id;
  const memberId = memberPerson!.id;

  // ─── F2: Dues Config + Funds + Payments ───────────────────
  console.log('  F2: Dues & Payments...');

  const existingConfig = await db.select().from(duesConfigs).where(eq(duesConfigs.organizationId, orgId)).limit(1);
  if (existingConfig.length === 0) {
    await db.insert(duesConfigs).values({
      organizationId: orgId,
      defaultAmount: 150000, // PHP 1,500
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
  console.log('  F3: Membership...');

  const existingCats = await db.select().from(membershipCategories).where(eq(membershipCategories.organizationId, orgId)).limit(1);
  if (existingCats.length === 0) {
    await db.insert(membershipCategories).values([
      { organizationId: orgId, name: 'Regular', description: 'Licensed practicing dentists', duesAmount: 150000, billingCycle: 'annual', sortOrder: 0, active: true },
      { organizationId: orgId, name: 'Associate', description: 'Dental students and recent graduates', duesAmount: 75000, billingCycle: 'annual', sortOrder: 1, active: true },
      { organizationId: orgId, name: 'Life', description: 'Lifetime members (exempt from dues)', duesAmount: 0, billingCycle: 'annual', sortOrder: 2, active: true },
      { organizationId: orgId, name: 'Honorary', description: 'Distinguished contributors', duesAmount: 0, billingCycle: 'annual', sortOrder: 3, active: true },
    ]);
    console.log('    Categories: Regular, Associate, Life, Honorary');
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F4: Events ───────────────────────────────────────────
  console.log('  F4: Events...');

  const existingEvents = await db.select().from(events).where(eq(events.organizationId, orgId)).limit(1);
  if (existingEvents.length === 0) {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const inserted = await db.insert(events).values([
      {
        organizationId: orgId,
        title: 'Monthly General Assembly - May 2026',
        type: 'general_assembly',
        description: 'Regular monthly meeting of PDA Metro Manila members. Agenda includes quarterly financial report and upcoming election timeline.',
        startAt: nextWeek,
        endAt: new Date(nextWeek.getTime() + 3 * 60 * 60 * 1000),
        locationType: 'in_person',
        locationDetails: { venue: 'PDA Convention Center', address: '123 Dental Ave, Makati City' },
        registrationEnabled: true,
        fee: 0,
        capacity: 100,
        qrEnabled: true,
        visibility: 'internal',
        status: 'published',
        createdBy: officerId,
        updatedBy: officerId,
      },
      {
        organizationId: orgId,
        title: 'Dental Mission - Tondo Community',
        type: 'medical_mission',
        description: 'Free dental services for the Tondo community. Volunteers needed for extraction, cleaning, and oral health education.',
        startAt: new Date(nextWeek.getTime() + 14 * 24 * 60 * 60 * 1000),
        endAt: new Date(nextWeek.getTime() + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        locationType: 'in_person',
        locationDetails: { venue: 'Tondo Community Center', address: 'Tondo, Manila' },
        registrationEnabled: true,
        fee: 0,
        capacity: 30,
        qrEnabled: true,
        visibility: 'internal',
        status: 'published',
        createdBy: officerId,
        updatedBy: officerId,
      },
      {
        organizationId: orgId,
        title: 'April General Assembly (Past)',
        type: 'general_assembly',
        description: 'Regular monthly meeting. Minutes available in the documents section.',
        startAt: lastMonth,
        endAt: new Date(lastMonth.getTime() + 3 * 60 * 60 * 1000),
        locationType: 'in_person',
        locationDetails: { venue: 'PDA Convention Center', address: '123 Dental Ave, Makati City' },
        registrationEnabled: true,
        fee: 0,
        capacity: 100,
        qrEnabled: true,
        visibility: 'internal',
        status: 'published',
        createdBy: officerId,
        updatedBy: officerId,
      },
    ]).returning();
    console.log('    Events: 3 (2 upcoming, 1 past)');

    // Register member for first (upcoming) event
    const upcomingEvent = inserted[0];
    if (upcomingEvent) {
      await db.insert(eventRegistrations).values({
        eventId: upcomingEvent.id,
        personId: memberId,
        status: 'registered',
      });
      console.log('    Registration: member registered for General Assembly');
    }
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F5: Training ─────────────────────────────────────────
  console.log('  F5: Training...');

  const existingTrainings = await db.select().from(trainings).where(eq(trainings.organizationId, orgId)).limit(1);
  if (existingTrainings.length === 0) {
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const insertedTrainings = await db.insert(trainings).values([
      {
        organizationId: orgId,
        title: 'Advanced Endodontics Workshop',
        type: 'workshop',
        description: 'Hands-on workshop covering modern endodontic techniques including rotary instrumentation and bioceramic sealers.',
        startAt: nextMonth,
        endAt: new Date(nextMonth.getTime() + 8 * 60 * 60 * 1000),
        locationType: 'in_person',
        locationDetails: { venue: 'PDA Training Center', address: '456 Skills Ave, Quezon City' },
        creditValue: '8',
        regulatoryApproval: 'prc_approved',
        regulatoryReference: 'PRC-CPD-2026-0142',
        enrollmentMode: 'open',
        fee: 350000, // PHP 3,500
        capacity: 25,
        visibility: 'network',
        status: 'published',
        createdBy: officerId,
        updatedBy: officerId,
      },
      {
        organizationId: orgId,
        title: 'Infection Control Update 2026 (Online)',
        type: 'online_course',
        description: 'Annual infection control compliance training. Required for license renewal.',
        startAt: new Date(nextMonth.getTime() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(nextMonth.getTime() + 14 * 24 * 60 * 60 * 1000),
        scheduleDescription: 'Self-paced, 7-day access window',
        locationType: 'online',
        locationDetails: { meetingUrl: 'https://learn.pda.ph/infection-control-2026' },
        creditValue: '4',
        regulatoryApproval: 'prc_approved',
        enrollmentMode: 'open',
        fee: 0,
        capacity: null,
        visibility: 'network',
        status: 'published',
        createdBy: officerId,
        updatedBy: officerId,
      },
      {
        organizationId: orgId,
        title: 'Dental Photography Seminar (Completed)',
        type: 'seminar',
        description: 'Clinical photography techniques for documentation and case presentation.',
        startAt: lastWeek,
        endAt: new Date(lastWeek.getTime() + 4 * 60 * 60 * 1000),
        locationType: 'in_person',
        locationDetails: { venue: 'PDA Convention Center', address: '123 Dental Ave, Makati City' },
        creditValue: '4',
        creditValueLocked: true,
        regulatoryApproval: 'prc_approved',
        enrollmentMode: 'open',
        fee: 150000,
        capacity: 40,
        visibility: 'internal',
        status: 'published',
        createdBy: officerId,
        updatedBy: officerId,
      },
    ]).returning();
    console.log('    Trainings: 3 (2 upcoming, 1 completed)');

    // Enroll member in first (upcoming) training
    const upcomingTraining = insertedTrainings[0];
    if (upcomingTraining) {
      await db.insert(trainingEnrollments).values({
        trainingId: upcomingTraining.id,
        personId: memberId,
        status: 'enrolled',
      });
      console.log('    Enrollment: member enrolled in Endodontics Workshop');
    }

    // Mark member as attended past training + award certificate
    const pastTraining = insertedTrainings[2];
    if (pastTraining) {
      await db.insert(trainingAttendance).values({
        trainingId: pastTraining.id,
        personId: memberId,
        method: 'qr',
        creditsAwarded: '4',
      });
      await db.insert(certificates).values({
        organizationId: orgId,
        personId: memberId,
        trainingId: pastTraining.id,
        certificateNumber: 'CERT-2026-000001',
      });
      console.log('    Attendance + Certificate: member completed Photography Seminar');
    }
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F6: Communications ───────────────────────────────────
  console.log('  F6: Communications...');

  const existingAnn = await db.select().from(announcements).where(eq(announcements.organizationId, orgId)).limit(1);
  if (existingAnn.length === 0) {
    const insertedAnn = await db.insert(announcements).values([
      {
        organizationId: orgId,
        authorId: officerId,
        title: 'May Dues Reminder — Please Pay Before June 1',
        content: '<p>Dear members,</p><p>This is a friendly reminder that annual dues for 2026 are due by <strong>June 1, 2026</strong>. Members who have not paid by this date will enter the 30-day grace period.</p><p>Pay online or in person at the next General Assembly.</p><p>Thank you,<br>PDA Metro Manila Treasury</p>',
        audienceType: 'all',
        channelPush: true,
        channelEmail: true,
        visibility: 'internal',
        status: 'sent',
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        createdBy: officerId,
        updatedBy: officerId,
      },
      {
        organizationId: orgId,
        authorId: officerId,
        title: 'Election Timeline Announcement (Draft)',
        content: '<p>The 2026 Officer Election timeline is now set. Nominations will open on June 15.</p>',
        audienceType: 'all',
        channelPush: true,
        channelEmail: false,
        visibility: 'internal',
        status: 'draft',
        createdBy: officerId,
        updatedBy: officerId,
      },
    ]).returning();

    // Stats for sent announcement
    const sentAnn = insertedAnn[0];
    if (sentAnn) {
      await db.insert(announcementStats).values({
        announcementId: sentAnn.id,
        recipients: 47,
        inappViews: 32,
        pushDelivered: 41,
        emailSent: 47,
        emailOpened: 28,
      });
    }
    console.log('    Announcements: 2 (1 sent with stats, 1 draft)');
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── F8: Elections ────────────────────────────────────────
  console.log('  F8: Elections...');

  const existingElections = await db.select().from(elections).where(eq(elections.organizationId, orgId)).limit(1);
  if (existingElections.length === 0) {
    await db.insert(elections).values({
      organizationId: orgId,
      title: '2026 Officer Election',
      type: 'officer',
      status: 'draft',
      votingMode: 'online',
      nominationsOpenAt: new Date('2026-06-15'),
      nominationsCloseAt: new Date('2026-06-30'),
      votingOpenAt: new Date('2026-07-05'),
      votingCloseAt: new Date('2026-07-12'),
      positions: [
        { id: 'president', title: 'President', sortOrder: 0 },
        { id: 'vice-president', title: 'Vice President', sortOrder: 1 },
        { id: 'secretary', title: 'Secretary', sortOrder: 2 },
        { id: 'treasurer', title: 'Treasurer', sortOrder: 3 },
        { id: 'auditor', title: 'Auditor', sortOrder: 4 },
      ],
      createdBy: officerId,
      updatedBy: officerId,
    });
    console.log('    Election: 2026 Officer Election (draft, 5 positions)');
  } else {
    console.log('    (exists, skipping)');
  }

  // ─── Summary ──────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      MODULE SEED COMPLETE                ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Dues: config + 3 funds + 3 payments    ║');
  console.log('║  Membership: 4 categories               ║');
  console.log('║  Events: 3 events + 1 registration      ║');
  console.log('║  Training: 3 programs + enrollment +    ║');
  console.log('║           attendance + certificate       ║');
  console.log('║  Communications: 2 announcements         ║');
  console.log('║  Elections: 1 draft election             ║');
  console.log('╚══════════════════════════════════════════╝');

  await pool.end();
}

seedModules().catch(err => {
  console.error('Module seed failed:', err);
  process.exit(1);
});
