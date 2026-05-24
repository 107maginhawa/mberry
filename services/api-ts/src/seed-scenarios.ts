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
import { memberships } from './handlers/association:member/repos/membership.schema';
import { persons } from './handlers/person/repos/person.schema';
import { events, eventRegistrations } from './handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from './handlers/association:operations/repos/training.schema';

// Retained for Phase 30 + main summary
import { notifications } from './handlers/notifs/repos/notification.schema';
import { certificates } from './handlers/certificates/repos/certificates.schema';
import { documents } from './handlers/documents/repos/documents.schema';
import { duesPayments } from './handlers/association:member/repos/dues-payments.schema';
import { duesPaymentStatusHistory } from './handlers/association:member/repos/dues-payment-status-history.schema';
import { announcements } from './handlers/communication/repos/communication.schema';
import { courses } from './handlers/association:operations/repos/training.schema';
import { daysAgo, daysFromNow, DATABASE_URL, API_URL } from './seed/helpers';

import { SeedClient } from './seed/client';
import { OFFICERS, MEMBERS, APPLICANTS } from './seed/data';
import { bootstrapDB } from './seed/layer-1-foundation';
import { seedPresident, seedOfficer, seedMember, seedApplicant, seedIdorOfficer, seedMissingRoles } from './seed/layer-2-users';
import { seedEvents, seedTraining, seedElections, seedAnnouncements, seedCredits, seedRelationalData, seedProfilePhotos } from './seed/layer-3-modules';
import { seedNotifications, seedCertificates, seedDocuments, seedComms, seedBilling, seedDunningEventsAndAudit, seedRemainingModules, seedDuesInfrastructure, seedCommittees } from './seed/layer-4-cross-module';
import { seedEventsGapFill, seedTrainingGapFill, seedCredentialsGapFill, seedProfileAndGovernanceGapFill, seedFinanceDeepFill, seedCommsGapFill, seedSurveysModule, seedCpdBackfill, seedSavedSegments, seedJobsModule, seedPrivacyBackfill } from './seed/layer-5-gap-fill';

// ═══════════════════════════════════════════════════════════════
// Phase 30: State Coverage — fill every state machine gap
// Ensures every enum value has at least 1 record for UI testing
// ═══════════════════════════════════════════════════════════════

async function seedStateCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  State coverage (filling enum gaps)...');

  // ─── Payment States (7 missing: failed, expired, refunded, partiallyRefunded, underReview, confirmed, rejected) ──
  try {
    const existingPayments = await db.select().from(duesPayments).limit(1);
    // Only seed if duesPayments table has some data (means base payments exist)
    if (existingPayments.length > 0) {
      const paymentStates = [
        { status: 'failed', receiptNumber: 'STATE-FAIL-001', amount: 200000, method: 'online', paidAt: null, expiredAt: daysAgo(10), referenceNumber: 'GW-FAIL-TIMEOUT', metadata: { failureReason: 'Gateway timeout', gatewayCode: 'TIMEOUT' } },
        { status: 'expired', receiptNumber: 'STATE-EXP-001', amount: 200000, method: 'online', paidAt: null, expiredAt: daysAgo(5), referenceNumber: null, metadata: { expiryReason: '24h payment window elapsed' } },
        { status: 'refunded', receiptNumber: 'STATE-REF-001', amount: 200000, method: 'bankTransfer', paidAt: daysAgo(20), expiredAt: null, referenceNumber: 'REF-2025-001', metadata: { refundReason: 'Duplicate payment', refundedAt: daysAgo(15).toISOString() } },
        { status: 'partiallyRefunded', receiptNumber: 'STATE-PREF-001', amount: 200000, method: 'gcash', paidAt: daysAgo(25), expiredAt: null, referenceNumber: 'PREF-2025-001', metadata: { partialRefundAmount: 100000, refundReason: 'Overpayment adjustment' } },
        { status: 'underReview', receiptNumber: 'STATE-REV-001', amount: 200000, method: 'cash', paidAt: null, expiredAt: null, referenceNumber: null, proofStorageKey: 'proofs/manual-payment-001.jpg', proofFileName: 'deposit-slip.jpg', proofMimeType: 'image/jpeg' },
        { status: 'confirmed', receiptNumber: 'STATE-CONF-001', amount: 200000, method: 'check', paidAt: daysAgo(3), expiredAt: null, referenceNumber: 'CHK-0012345', metadata: { confirmedBy: presidentPersonId, confirmNote: 'Verified via bank statement' } },
        { status: 'rejected', receiptNumber: 'STATE-REJ-001', amount: 200000, method: 'cash', paidAt: null, expiredAt: null, referenceNumber: null, rejectionReason: 'Proof of payment is illegible — please resubmit a clear photo', proofStorageKey: 'proofs/blurry-receipt.jpg', proofFileName: 'receipt-blurry.jpg', proofMimeType: 'image/jpeg' },
      ];

      for (let i = 0; i < paymentStates.length; i++) {
        const ps = paymentStates[i]!;
        const personId = memberPersonIds[i % memberPersonIds.length]!;
        const existing = await db.execute(sql`SELECT id FROM dues_payment WHERE receipt_number = ${ps.receiptNumber} LIMIT 1`);
        if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
          await db.insert(duesPayments).values({
            organizationId: orgId,
            personId,
            receiptNumber: ps.receiptNumber,
            amount: ps.amount,
            currency: 'PHP',
            paymentMethod: ps.method,
            status: ps.status,
            referenceNumber: ps.referenceNumber,
            paidAt: ps.paidAt,
            expiredAt: ps.expiredAt,
            rejectionReason: (ps as any).rejectionReason ?? null,
            proofStorageKey: (ps as any).proofStorageKey ?? null,
            proofFileName: (ps as any).proofFileName ?? null,
            proofMimeType: (ps as any).proofMimeType ?? null,
            metadata: ps.metadata ?? null,
            recordedBy: ps.method === 'cash' || ps.method === 'check' ? presidentPersonId : null,
          } as any);
        }
      }
      console.log('    ✓ 7 payment state-coverage records (failed, expired, refunded, partiallyRefunded, underReview, confirmed, rejected)');
    }
  } catch (e) {
    console.log(`    (payment state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Election States (3 missing: awaitingConfirmation, published, cancelled) ──
  try {
    const electionStates = [
      { title: 'Board Election 2024 (Results Published)', status: 'published', year: 2024 },
      { title: 'Special Election — VP Vacancy (Cancelled)', status: 'cancelled', year: 2025 },
      { title: 'Board Election 2025 (Awaiting Confirmation)', status: 'awaitingConfirmation', year: 2025 },
    ];

    for (const e of electionStates) {
      const existing = await db.execute(sql`SELECT id FROM election WHERE title = ${e.title} LIMIT 1`);
      if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
        await db.execute(sql`
          INSERT INTO election (organization_id, title, description, election_type, voting_mode, status,
            nominations_open_at, nominations_close_at, voting_open_at, voting_close_at)
          VALUES (${orgId}, ${e.title}, ${'State coverage seed — ' + e.status},
            'officer'::election_type, 'online'::voting_mode, ${e.status}::election_status,
            ${daysAgo(120)}, ${daysAgo(90)}, ${daysAgo(60)}, ${daysAgo(30)})
        `);
      }
    }
    console.log('    ✓ 3 election state-coverage records (published, cancelled, awaitingConfirmation)');
  } catch (e) {
    console.log(`    (election state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Event: 1 cancelled ──
  try {
    const existing = await db.select({ id: events.id }).from(events).where(eq(events.status, 'cancelled')).limit(1);
    if (existing.length === 0) {
      await db.insert(events).values({
        organizationId: orgId,
        title: 'Dental Health Day 2025 (Cancelled)',
        description: 'Community outreach event cancelled due to venue unavailability.',
        eventDate: daysAgo(30),
        endDate: daysAgo(30),
        location: 'Rizal Park, Manila',
        maxCapacity: 200,
        status: 'cancelled',
        visibility: 'internal',
        eventType: 'seminar',
        createdBy: presidentPersonId,
      } as any);
      console.log('    ✓ 1 cancelled event');
    }
  } catch (e) {
    console.log(`    (cancelled event failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Event: 1 capacity-limited (BR-27: waitlist scenario) ──
  try {
    const existing = await db.execute(sql`SELECT id FROM event WHERE title = 'Hands-On Composite Workshop (Full)' LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      const [fullEvent] = await db.insert(events).values({
        organizationId: orgId,
        title: 'Hands-On Composite Workshop (Full)',
        description: 'Limited capacity workshop — exercises BR-27 waitlist behavior.',
        eventDate: daysFromNow(14),
        endDate: daysFromNow(14),
        location: 'PDA Training Center, Makati',
        maxCapacity: 3,
        status: 'published',
        visibility: 'internal',
        eventType: 'workshop',
        createdBy: presidentPersonId,
      } as any).returning({ id: events.id });

      if (fullEvent) {
        // 3 confirmed (at capacity) + 2 waitlisted
        for (let i = 0; i < 5; i++) {
          const personId = memberPersonIds[i]!;
          await db.insert(eventRegistrations).values({
            organizationId: orgId,
            eventId: fullEvent.id,
            personId,
            status: i < 3 ? 'confirmed' : 'waitlisted',
            registeredAt: daysAgo(7 - i),
          } as any);
        }
        // 1 cancelled registration
        await db.insert(eventRegistrations).values({
          organizationId: orgId,
          eventId: fullEvent.id,
          personId: memberPersonIds[5]!,
          status: 'cancelled',
          registeredAt: daysAgo(6),
        } as any);
        console.log('    ✓ 1 capacity-limited event (3 confirmed, 2 waitlisted, 1 cancelled registration)');
      }
    }
  } catch (e) {
    console.log(`    (capacity event failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Training: 1 cancelled ──
  try {
    const existing = await db.select({ id: trainings.id }).from(trainings).where(eq(trainings.status, 'cancelled')).limit(1);
    if (existing.length === 0) {
      const [cancelledTraining] = await db.insert(trainings).values({
        organizationId: orgId,
        title: 'Advanced Prosthodontics Workshop (Cancelled)',
        description: 'Cancelled due to insufficient enrollment.',
        startDate: daysAgo(14),
        endDate: daysAgo(14),
        location: 'PDA Metro Manila Office',
        status: 'cancelled',
        maxParticipants: 20,
        creditAmount: 8,
        createdBy: presidentPersonId,
      } as any).returning({ id: trainings.id });

      // 1 cancelled enrollment (dropped)
      if (cancelledTraining) {
        await db.insert(trainingEnrollments).values({
          organizationId: orgId,
          trainingId: cancelledTraining.id,
          personId: memberPersonIds[0]!,
          status: 'cancelled',
          enrolledAt: daysAgo(21),
        } as any);
      }
      console.log('    ✓ 1 cancelled training + 1 cancelled enrollment');
    }
  } catch (e) {
    console.log(`    (cancelled training failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Notification: failed + expired states ──
  try {
    const notifStates = [
      { type: 'system.alert', status: 'failed', title: 'Failed delivery test', body: 'This notification failed to deliver via push.' },
      { type: 'system.alert', status: 'expired', title: 'Expired notification test', body: 'This notification expired before delivery.' },
    ];
    for (const n of notifStates) {
      const existing = await db.execute(sql`SELECT id FROM notification WHERE title = ${n.title} LIMIT 1`);
      if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
        await db.insert(notifications).values({
          organizationId: orgId,
          recipient: memberPersonIds[0]!,
          type: n.type,
          channel: 'push',
          status: n.status,
          title: n.title,
          body: n.body,
        } as any);
      }
    }
    console.log('    ✓ 2 notification state-coverage records (failed, expired)');
  } catch (e) {
    console.log(`    (notification state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Announcement: scheduledFailed state ──
  try {
    const existing = await db.execute(sql`SELECT id FROM announcement WHERE status = 'scheduledFailed' LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      await db.insert(announcements).values({
        organizationId: orgId,
        authorId: presidentPersonId,
        title: 'System Maintenance Notice (Failed to Send)',
        content: '<p>Scheduled announcement that failed to deliver.</p>',
        audienceType: 'all',
        visibility: 'internal',
        status: 'scheduledFailed',
      } as any);
      console.log('    ✓ 1 scheduledFailed announcement');
    }
  } catch (e) {
    console.log(`    (announcement state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Dues Payment Status History (audit trail for state-coverage payments) ──
  try {
    const statePayments = await db.execute(sql`
      SELECT id, person_id, status FROM dues_payment
      WHERE receipt_number LIKE 'STATE-%'
      LIMIT 7
    `);
    const rows = (statePayments as any).rows ?? statePayments;
    if (rows.length > 0) {
      const existingHistory = await db.select().from(duesPaymentStatusHistory).limit(1);
      if (existingHistory.length === 0) {
        for (const p of rows) {
          await db.insert(duesPaymentStatusHistory).values({
            organizationId: orgId,
            paymentId: p.id,
            personId: p.person_id,
            fromStatus: 'pending',
            toStatus: p.status,
            reason: `State coverage seed — ${p.status}`,
            changedBy: presidentPersonId,
          } as any);
        }
        console.log(`    ✓ ${rows.length} payment status history records`);
      }
    }
  } catch (e) {
    console.log(`    (payment status history failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  console.log('  State coverage complete.');
}

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

  // Phase 23: Finance deep-fill (fund allocations, assessments, payment→invoice links)
  console.log('\nPhase 23: Finance deep-fill...');
  await seedFinanceDeepFill(db, orgId, president.personId, memberPersonIds);

  // Phase 24: Comms gap-fill (room members, reactions, threading)
  console.log('\nPhase 24: Comms gap-fill...');
  await seedCommsGapFill(db, orgId, president.personId, memberPersonIds);

  // Phase 25: Surveys module
  console.log('\nPhase 25: Surveys module...');
  await seedSurveysModule(db, orgId, president.personId, memberPersonIds);

  // Phase 26: CPD config + credit/certificate backfill
  console.log('\nPhase 26: CPD backfill...');
  await seedCpdBackfill(db, orgId);

  // Phase 27: Saved segments
  console.log('\nPhase 27: Saved segments...');
  await seedSavedSegments(db, orgId);

  // Phase 28: Jobs module
  console.log('\nPhase 28: Jobs module...');
  await seedJobsModule(db, orgId, president.personId, memberPersonIds);

  // Phase 29: Privacy settings backfill
  console.log('\nPhase 29: Privacy backfill...');
  await seedPrivacyBackfill(db, memberPersonIds);

  // Phase 30: State coverage (fill all state machine gaps)
  console.log('\nPhase 30: State coverage...');
  await seedStateCoverage(db, orgId, president.personId, memberPersonIds);

  // Phase 31: Missing role users (VP, board member, staff, platform support/viewer)
  console.log('\nPhase 31: Missing role users...');
  await seedMissingRoles(db, orgId, regularTierId);

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
  console.log('║    Active:          19 (8 officers + 11 reg) ║');
  console.log('║    Grace Period:     3                       ║');
  console.log('║    Lapsed:           2                       ║');
  console.log('║    Suspended:        2                       ║');
  console.log('║    Removed:          1                       ║');
  console.log('║    Pending Payment:  2                       ║');
  console.log('║    Resigned:         1                       ║');
  console.log('║    Deceased:         1                       ║');
  console.log('║    Expelled:         1                       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  State Coverage (Phase 30):                  ║');
  console.log('║    Payment states:   7 (all enum values)     ║');
  console.log('║    Election states:  3 (published/cancel/aw) ║');
  console.log('║    Cancelled event:  1                       ║');
  console.log('║    Waitlist event:   1 (3+2+1 regs)          ║');
  console.log('║    Cancelled train:  1                       ║');
  console.log('╚══════════════════════════════════════════════╝');

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
