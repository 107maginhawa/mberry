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
import { positions } from './handlers/association:member/repos/governance.schema';
import { persons } from './handlers/person/repos/person.schema';
import { events, eventRegistrations } from './handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from './handlers/association:operations/repos/training.schema';

// Phase 10-16 imports (retained for phases 19-30 + main summary)
import { notifications } from './handlers/notifs/repos/notification.schema';
import { certificates } from './handlers/certificates/repos/certificates.schema';
import { documents } from './handlers/documents/repos/documents.schema';
import { chatRooms, chatMessages } from './handlers/comms/repos/comms.schema';

// Phase 17-18 imports (retained for phases 23+)
import { duesInvoices } from './handlers/association:member/repos/dues.schema';
import { duesFunds, duesOrgConfigs } from './handlers/association:member/repos/dues-payments.schema';

// Phase 23-29 imports (cross-module alignment)
import { duesFundAllocations, duesReminderSchedules, duesGatewayConfigs, duesPayments } from './handlers/association:member/repos/dues-payments.schema';
import { duesPaymentStatusHistory } from './handlers/association:member/repos/dues-payment-status-history.schema';
import { announcements } from './handlers/communication/repos/communication.schema';
import { specialAssessments, specialAssessmentTargets } from './handlers/association:member/repos/special-assessments.schema';
import { paymentTokens } from './handlers/dues/repos/payment-token.schema';
import { chatRoomMembers, chatMessageReactions } from './handlers/comms/repos/comms.schema';
import { surveys as surveysTable, surveyResponses as surveyResponsesTable } from './handlers/surveys/repos/survey.schema';
import { orgCpdConfig } from './handlers/association:member/repos/credits.schema';
import { orgCertificateSeq } from './handlers/certificates/repos/certificates.schema';
import { savedSegments } from './handlers/communication/repos/communication.schema';
import { jobPostings, jobApplications } from './handlers/jobs/repos/jobs.schema';

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
import { NOW, daysAgo, daysFromNow, dateStr, ACTIVE_EXPIRY, graceExpiry, lapsedExpiry, TERM_START, TERM_END, MEMBERSHIP_START, DATABASE_URL, API_URL, PASSWORD, verifyEmail } from './seed/helpers';

import { SeedClient } from './seed/client';
import { OFFICERS, MEMBERS, APPLICANTS } from './seed/data';
import { bootstrapDB } from './seed/layer-1-foundation';
import { seedPresident, seedOfficer, seedMember, seedApplicant, seedIdorOfficer, seedMissingRoles } from './seed/layer-2-users';
import { seedEvents, seedTraining, seedElections, seedAnnouncements, seedCredits, seedRelationalData, seedProfilePhotos } from './seed/layer-3-modules';
import { seedNotifications, seedCertificates, seedDocuments, seedComms, seedBilling, seedDunningEventsAndAudit, seedRemainingModules, seedDuesInfrastructure, seedCommittees } from './seed/layer-4-cross-module';

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

// ═══════════════════════════════════════════════════════════════
// Phase 23: Finance Deep-Fill (fund allocations, assessments, payment→invoice links)
// ═══════════════════════════════════════════════════════════════

async function seedFinanceDeepFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Finance deep-fill...');

  // ─── Fix orphaned payments: link completed payments to paid invoices ──
  try {
    const paidInvoices = await db.select({ id: duesInvoices.id, personId: duesInvoices.personId })
      .from(duesInvoices)
      .where(sql`${duesInvoices.status} = 'paid' AND ${duesInvoices.organizationId} = ${orgId}`);

    if (paidInvoices.length > 0) {
      let linked = 0;
      for (const inv of paidInvoices) {
        const result = await db.execute(sql`
          UPDATE dues_payment SET invoice_id = ${inv.id}
          WHERE person_id = ${inv.personId} AND organization_id = ${orgId}
            AND status = 'completed' AND invoice_id IS NULL
          LIMIT 1
        `);
        linked++;
      }
      console.log(`    ✓ ${linked} payments linked to paid invoices`);
    }
  } catch (e) {
    console.log(`    (payment→invoice linking failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Fund allocations for completed payments ──
  try {
    const existing = await db.select().from(duesFundAllocations).limit(1);
    if (existing.length === 0) {
      const completedPayments = await db.execute(
        sql`SELECT id, amount FROM dues_payment WHERE status = 'completed' AND organization_id = ${orgId}`
      );
      const payments = (completedPayments as any).rows ?? completedPayments;

      const fundRows = await db.select({ id: duesFunds.id, name: duesFunds.name, percentage: duesFunds.percentage })
        .from(duesFunds)
        .where(eq(duesFunds.organizationId, orgId));

      let allocCount = 0;
      for (const pay of payments) {
        const amount = Number(pay.amount ?? 0);
        for (const fund of fundRows) {
          const pct = Number(fund.percentage ?? 0);
          const allocAmount = Math.round((amount * pct) / 100);
          await db.insert(duesFundAllocations).values({
            paymentId: pay.id,
            fundId: fund.id,
            amount: allocAmount,
          } as any);
          allocCount++;
        }
      }
      console.log(`    ✓ ${allocCount} fund allocations seeded`);
    } else {
      console.log('    (fund allocations already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (fund allocations failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Special assessments ──
  try {
    const existing = await db.select().from(specialAssessments).limit(1);
    if (existing.length === 0) {
      const fundRows = await db.select({ id: duesFunds.id, name: duesFunds.name })
        .from(duesFunds)
        .where(eq(duesFunds.organizationId, orgId));
      const buildingFund = fundRows.find(f => f.name.includes('Building'));

      const [assess1] = await db.insert(specialAssessments).values({
        organizationId: orgId,
        name: 'Building Fund Special Levy',
        description: 'One-time assessment for chapter office renovation. Approved by Executive Board resolution 2025-03.',
        amount: 100000, // ₱1,000
        currency: 'PHP',
        dueDate: dateStr(daysFromNow(60)),
        fundId: buildingFund?.id ?? null,
        appliesTo: 'all',
        status: 'active',
      } as any).returning({ id: specialAssessments.id });

      const [assess2] = await db.insert(specialAssessments).values({
        organizationId: orgId,
        name: 'Emergency Medical Equipment',
        description: 'Draft assessment for dental clinic equipment donation program.',
        amount: 50000, // ₱500
        currency: 'PHP',
        dueDate: dateStr(daysFromNow(120)),
        appliesTo: 'selected',
        status: 'draft',
      } as any).returning({ id: specialAssessments.id });

      // Targets for active assessment
      if (assess1) {
        for (let i = 0; i < Math.min(8, memberPersonIds.length); i++) {
          await db.insert(specialAssessmentTargets).values({
            assessmentId: assess1.id,
            personId: memberPersonIds[i]!,
            status: i < 3 ? 'paid' : 'pending',
          } as any);
        }
      }
      console.log('    ✓ 2 special assessments + 8 targets seeded');
    } else {
      console.log('    (special assessments already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (special assessments failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Reminder schedule ──
  try {
    const existing = await db.select().from(duesReminderSchedules).limit(1);
    if (existing.length === 0) {
      const orgConfigs = await db.select({ id: duesOrgConfigs.id })
        .from(duesOrgConfigs)
        .where(eq(duesOrgConfigs.organizationId, orgId))
        .limit(1);
      if (orgConfigs[0]) {
        await db.insert(duesReminderSchedules).values({
          orgConfigId: orgConfigs[0].id,
          daysBeforeDue: 30,
          channel: 'email',
          templateId: null,
          active: true,
        } as any);
        console.log('    ✓ 1 reminder schedule seeded');
      }
    } else {
      console.log('    (reminder schedule already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (reminder schedule failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Gateway config ──
  try {
    const existing = await db.select().from(duesGatewayConfigs).limit(1);
    if (existing.length === 0) {
      await db.insert(duesGatewayConfigs).values({
        organizationId: orgId,
        provider: 'paymongo',
        publicKey: 'pk_test_demo_key_not_real',
        secretKey: 'sk_test_demo_key_not_real',
        webhookSecret: 'whsec_demo_not_real',
        active: true,
      } as any);
      console.log('    ✓ 1 gateway config seeded (PayMongo test)');
    } else {
      console.log('    (gateway config already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (gateway config failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 24: Comms Gap-Fill (room members, reactions, threading)
// ═══════════════════════════════════════════════════════════════

async function seedCommsGapFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Comms gap-fill...');

  // ─── Chat room members ──
  try {
    const existing = await db.select().from(chatRoomMembers).limit(1);
    if (existing.length === 0) {
      const rooms = await db.select({ id: chatRooms.id }).from(chatRooms).limit(5);
      let memberCount = 0;
      for (const room of rooms) {
        const participants = [presidentPersonId, ...memberPersonIds.slice(0, 4)];
        for (const personId of participants) {
          await db.insert(chatRoomMembers).values({
            roomId: room.id,
            personId,
            role: personId === presidentPersonId ? 'admin' : 'member',
            joinedAt: daysAgo(30),
          } as any);
          memberCount++;
        }
      }
      console.log(`    ✓ ${memberCount} chat room members seeded`);
    } else {
      console.log('    (chat room members already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (chat room members failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Message reactions ──
  try {
    const existing = await db.select().from(chatMessageReactions).limit(1);
    if (existing.length === 0) {
      const msgs = await db.select({ id: chatMessages.id }).from(chatMessages).limit(5);
      const emojis = ['👍', '❤️', '😂', '🎉', '👀'];
      let reactionCount = 0;
      for (let i = 0; i < Math.min(msgs.length, emojis.length); i++) {
        await db.insert(chatMessageReactions).values({
          messageId: msgs[i]!.id,
          personId: memberPersonIds[i % memberPersonIds.length]!,
          emoji: emojis[i]!,
        } as any);
        reactionCount++;
      }
      console.log(`    ✓ ${reactionCount} message reactions seeded`);
    } else {
      console.log('    (message reactions already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (message reactions failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Update room types ──
  try {
    await db.execute(sql`
      UPDATE chat_room SET room_type = 'channel', name = 'General'
      WHERE organization_id = ${orgId} AND room_type IS NULL
      LIMIT 1
    `);
    console.log('    ✓ Room type updated to channel');
  } catch (e) {
    console.log(`    (room type update failed: ${(e as Error).message?.slice(0, 60)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 25: Surveys Module
// ═══════════════════════════════════════════════════════════════

async function seedSurveysModule(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Surveys module...');
  try {
    const existing = await db.select().from(surveysTable).limit(1);
    if (existing.length > 0) {
      console.log('    (surveys already seeded, skipping)');
      return;
    }

    // NPS survey
    const [npsSurvey] = await db.insert(surveysTable).values({
      organizationId: orgId,
      title: 'Member Satisfaction — Q2 2026',
      description: 'How likely are you to recommend our association to a colleague?',
      surveyType: 'nps',
      status: 'active',
      createdBy: presidentPersonId,
      questions: [
        { id: 'q1', type: 'nps', text: 'How likely are you to recommend our association to a colleague?', required: true, order: 1 },
        { id: 'q2', type: 'text', text: 'What could we do better?', required: false, order: 2 },
      ],
      settings: { anonymous: false, fatigueThreshold: 2 },
    } as any).returning({ id: surveysTable.id });

    // General feedback survey (draft)
    await db.insert(surveysTable).values({
      organizationId: orgId,
      title: 'Annual Convention Feedback',
      description: 'Help us improve next year\'s convention.',
      surveyType: 'general',
      status: 'draft',
      createdBy: presidentPersonId,
      questions: [
        { id: 'q1', type: 'rating', text: 'Rate the overall convention experience', required: true, order: 1, scale: { min: 1, max: 5 } },
        { id: 'q2', type: 'text', text: 'What was the highlight of the convention?', required: false, order: 2 },
        { id: 'q3', type: 'text', text: 'What should we improve?', required: false, order: 3 },
      ],
      settings: { anonymous: true },
    } as any);

    // NPS responses
    if (npsSurvey) {
      const npsScores = [10, 9, 9, 8, 7, 6, 3];
      const comments = [
        'Excellent organization — events are always well-planned.',
        'Great CPD programs. Keep it up!',
        '',
        'Good but could improve communication frequency.',
        'Dues are a bit high for what we get.',
        'Need more hands-on clinical workshops.',
        'Very poor response time from officers.',
      ];
      for (let i = 0; i < Math.min(npsScores.length, memberPersonIds.length); i++) {
        await db.insert(surveyResponsesTable).values({
          organizationId: orgId,
          surveyId: npsSurvey.id,
          responderId: memberPersonIds[i]!,
          answers: [
            { questionId: 'q1', value: npsScores[i] },
            ...(comments[i] ? [{ questionId: 'q2', value: comments[i] }] : []),
          ],
          status: 'completed',
          completedAt: daysAgo(Math.floor(Math.random() * 14)),
        } as any);
      }
      console.log(`    ✓ 2 surveys + ${Math.min(npsScores.length, memberPersonIds.length)} responses seeded`);
    }
  } catch (e) {
    console.log(`    (surveys failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 26: CPD Config + Credit/Certificate Backfill
// ═══════════════════════════════════════════════════════════════

async function seedCpdBackfill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
) {
  console.log('  CPD config + backfill...');

  // ─── org_cpd_config ──
  try {
    const existing = await db.select().from(orgCpdConfig).limit(1);
    if (existing.length === 0) {
      await db.insert(orgCpdConfig).values({
        organizationId: orgId,
        requiredCredits: 60,
        cycleLengthYears: 3,
        cycleStartMonth: 1,
        allowCarryOver: false,
        maxCarryOverCredits: 0,
      } as any);
      console.log('    ✓ 1 CPD config seeded (60 credits / 3-year cycle)');
    } else {
      console.log('    (CPD config already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (CPD config failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── org_certificate_seq ──
  try {
    const existing = await db.select().from(orgCertificateSeq).limit(1);
    if (existing.length === 0) {
      await db.insert(orgCertificateSeq).values({
        organizationId: orgId,
        year: NOW.getFullYear(),
        lastNumber: 5,
      } as any);
      console.log('    ✓ 1 certificate sequence seeded');
    } else {
      console.log('    (certificate sequence already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (certificate sequence failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Backfill credit sourceType ──
  try {
    await db.execute(sql`
      UPDATE credit_entry SET source_type = 'event_checkin'
      WHERE source_type IS NULL AND organization_id = ${orgId}
      LIMIT 10
    `);
    // Add 1 voided credit
    await db.execute(sql`
      UPDATE credit_entry SET status = 'voided', voided_reason = 'Duplicate entry — same event credited twice'
      WHERE status = 'active' AND organization_id = ${orgId}
      LIMIT 1
    `);
    console.log('    ✓ Credit entries backfilled (sourceType + 1 voided)');
  } catch (e) {
    console.log(`    (credit backfill failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Backfill certificate status ──
  try {
    await db.execute(sql`
      UPDATE certificate SET status = 'issued'
      WHERE status IS NULL
      LIMIT 20
    `);
    // Add 1 revoked cert
    await db.execute(sql`
      UPDATE certificate SET status = 'revoked', revoked_at = ${daysAgo(30)}, revoked_reason = 'Training provider accreditation revoked — credits invalidated'
      WHERE status = 'issued'
      LIMIT 1
    `);
    console.log('    ✓ Certificates backfilled (status + 1 revoked)');
  } catch (e) {
    console.log(`    (certificate backfill failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 27: Saved Segments
// ═══════════════════════════════════════════════════════════════

async function seedSavedSegments(
  db: ReturnType<typeof drizzle>,
  orgId: string,
) {
  console.log('  Saved segments...');
  try {
    const existing = await db.select().from(savedSegments).limit(1);
    if (existing.length > 0) {
      console.log('    (saved segments already seeded, skipping)');
      return;
    }

    const segments = [
      { name: 'Overdue Members', description: 'Members with overdue dues', filters: { membershipStatus: ['lapsed', 'gracePeriod'], duesStatus: 'overdue' } },
      { name: 'New Members 2025', description: 'Members who joined in 2025', filters: { joinedAfter: '2025-01-01', joinedBefore: '2025-12-31' } },
      { name: 'Active Dentists', description: 'Active members in dentistry category', filters: { membershipStatus: ['active'], category: 'Regular' } },
    ];

    for (const seg of segments) {
      await db.insert(savedSegments).values({
        organizationId: orgId,
        name: seg.name,
        description: seg.description,
        filters: seg.filters,
      } as any);
    }
    console.log('    ✓ 3 saved segments seeded');
  } catch (e) {
    console.log(`    (saved segments failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 28: Jobs Module
// ═══════════════════════════════════════════════════════════════

async function seedJobsModule(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Jobs module...');
  try {
    const existing = await db.select().from(jobPostings).limit(1);
    if (existing.length > 0) {
      console.log('    (jobs already seeded, skipping)');
      return;
    }

    const [job1] = await db.insert(jobPostings).values({
      organizationId: orgId,
      title: 'Associate Dentist — General Practice',
      description: 'Seeking a licensed dentist to join our growing clinic. Must have valid PRC license and 2+ years experience.',
      type: 'fullTime',
      status: 'active',
      location: 'Makati City, Metro Manila',
      salary: 'PHP 45,000 - 65,000/month',
      postedBy: presidentPersonId,
      postedAt: daysAgo(7),
      expiresAt: daysFromNow(53),
    } as any).returning({ id: jobPostings.id });

    const [job2] = await db.insert(jobPostings).values({
      organizationId: orgId,
      title: 'Clinic Manager',
      description: 'Office manager for busy dental practice. Experience with clinic scheduling, billing, and patient coordination.',
      type: 'fullTime',
      status: 'active',
      location: 'Quezon City, Metro Manila',
      salary: 'PHP 30,000 - 40,000/month',
      postedBy: presidentPersonId,
      postedAt: daysAgo(3),
      expiresAt: daysFromNow(57),
    } as any).returning({ id: jobPostings.id });

    // Applications
    if (job1 && memberPersonIds.length > 0) {
      await db.insert(jobApplications).values({
        jobId: job1.id,
        applicantId: memberPersonIds[0]!,
        status: 'pending',
        coverLetter: 'I am interested in this position. I have 3 years of experience in general dentistry and specialize in endodontics.',
        appliedAt: daysAgo(5),
      } as any);
    }
    if (job2 && memberPersonIds.length > 1) {
      await db.insert(jobApplications).values({
        jobId: job2.id,
        applicantId: memberPersonIds[1]!,
        status: 'shortlisted',
        coverLetter: 'Experienced clinic administrator with 5 years managing multi-dentist practices.',
        appliedAt: daysAgo(2),
      } as any);
    }
    console.log('    ✓ 2 job postings + 2 applications seeded');
  } catch (e) {
    console.log(`    (jobs failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 29: Privacy Settings Backfill
// ═══════════════════════════════════════════════════════════════

async function seedPrivacyBackfill(
  db: ReturnType<typeof drizzle>,
  memberPersonIds: string[],
) {
  console.log('  Privacy settings backfill...');
  try {
    // Set varied visibility for demo
    for (let i = 0; i < Math.min(5, memberPersonIds.length); i++) {
      await db.execute(sql`
        UPDATE person_privacy_setting
        SET credentials_visible = true, dues_status_visible = ${i < 3}
        WHERE person_id = ${memberPersonIds[i]!}
      `);
    }
    console.log('    ✓ Privacy settings varied for 5 members');
  } catch (e) {
    console.log(`    (privacy backfill failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

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
