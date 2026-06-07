/**
 * Layer 5: Gap-fill seeding — Phases 19-29
 *
 * Events gap-fill, training gap-fill, credentials, profile/governance,
 * finance deep-fill, comms gap-fill, surveys, CPD backfill, saved segments,
 * jobs, privacy backfill.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { NOW, daysAgo, daysFromNow, dateStr } from './helpers';

// Schema imports
import { events } from '@/handlers/association:operations/repos/events.schema';
import { checkIns, waitlistEntries } from '@/handlers/association:operations/repos/events.schema';
import { courses, courseEnrollments, quizAttempts } from '@/handlers/association:operations/repos/training.schema';
import { accreditedProviders } from '@/handlers/association:operations/repos/accredited-provider.schema';
import { electionNominees, electionVotes, elections } from '@/handlers/elections/repos/elections.schema';
import { positions, officerTerms } from '@/handlers/association:member/repos/governance.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { membershipStatusHistory, type NewMembershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { professionalLicenses, licenseRenewalAlerts, credentialTemplates, digitalCredentials } from '@/handlers/association:member/repos/credentials.schema';
import { directoryProfiles } from '@/handlers/association:member/repos/directory.schema';
import { chapterAffiliations } from '@/handlers/association:member/repos/chapters.schema';
import { notificationPreferences } from '@/handlers/person/repos/notification-preferences.schema';
import { personPrivacySettings } from '@/handlers/person/repos/privacy-settings.schema';
import { duesInvoices } from '@/handlers/association:member/repos/dues.schema';
import { duesFunds, duesOrgConfigs, duesFundAllocations, duesReminderSchedules, duesGatewayConfigs } from '@/handlers/association:member/repos/dues-payments.schema';
import { specialAssessments, specialAssessmentTargets } from '@/handlers/association:member/repos/special-assessments.schema';
import { chatRooms, chatMessages, chatRoomMembers, chatMessageReactions } from '@/handlers/comms/repos/comms.schema';
import { surveys as surveysTable, surveyResponses as surveyResponsesTable } from '@/handlers/surveys/repos/survey.schema';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { orgCertificateSeq } from '@/handlers/member/certificates/repos/certificates.schema';
import { savedSegments } from '@/handlers/communication/repos/communication.schema';
import { jobPostings, jobApplications } from '@/handlers/jobs/repos/jobs.schema';

// ═══════════════════════════════════════════════════════════════
// Phase 19: Events gap-fill — check-ins, waitlist, full election
// ═══════════════════════════════════════════════════════════════

export async function seedEventsGapFill(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Events gap-fill (check-ins + waitlist + nominees + votes)...');

  // ─── Check-ins ────────────────────────────────────────────────
  let existingCheckIns: Array<Record<string, unknown>>;
  let skipCheckIns = false;
  try {
    existingCheckIns = await db.select().from(checkIns).limit(1);
  } catch {
    console.log('    (check_in table not migrated yet, skipping)');
    existingCheckIns = [];
    skipCheckIns = true;
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
        });
      }
      console.log(`    ✓ ${checkInData.length} check-in records seeded`);
    } else {
      console.log('    (no completed events found, skipping check-ins)');
    }
  } else if (!skipCheckIns) {
    console.log('    (check-ins already seeded, skipping)');
  }

  // ─── Waitlist entries ─────────────────────────────────────────
  let existingWaitlist: Array<Record<string, unknown>>;
  let skipWaitlist = false;
  try {
    existingWaitlist = await db.select().from(waitlistEntries).limit(1);
  } catch {
    console.log('    (waitlist_entry table not migrated yet, skipping)');
    existingWaitlist = [];
    skipWaitlist = true;
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
        await db.insert(waitlistEntries).values(w);
      }
      console.log(`    ✓ ${waitlistData.length} waitlist entries seeded (1 promoted)`);
    } else {
      console.log('    (no published events found, skipping waitlist)');
    }
  } else if (!skipWaitlist) {
    console.log('    (waitlist entries already seeded, skipping)');
  }

  // ─── Election nominees + votes ────────────────────────────────
  let existingNominees: Array<Record<string, unknown>>;
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
        const presidentPos = positionRows.find(p => p.title === 'President') || positionRows[0]!;
        const treasurerPos = positionRows.find(p => p.title === 'Treasurer') || positionRows[Math.min(1, positionRows.length - 1)]!;
        // 3 nominees: president (elected), 2 others for treasurer
        const nomineeData = [
          { electionId, organizationId: orgId, positionId: presidentPos.id, personId: presidentPersonId, nominatedBy: presidentPersonId, status: 'elected' as const },
          { electionId, organizationId: orgId, positionId: treasurerPos.id, personId: memberPersonIds[0]!, nominatedBy: presidentPersonId, status: 'elected' as const },
          { electionId, organizationId: orgId, positionId: treasurerPos.id, personId: memberPersonIds[1]!, nominatedBy: memberPersonIds[0]!, status: 'accepted' as const },
        ];
        const insertedNominees: string[] = [];
        for (const n of nomineeData) {
          const [inserted] = await db.insert(electionNominees).values(n).returning({ id: electionNominees.id });
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
        let existingVotes: Array<Record<string, unknown>>;
        let skipVotes = false;
        try {
          existingVotes = await db.select().from(electionVotes).limit(1);
        } catch {
          console.log('    (election_vote table not migrated yet, skipping votes)');
          existingVotes = [];
          skipVotes = true;
        }
        if (existingVotes.length === 0) {
          for (const v of votesData) {
            await db.insert(electionVotes).values(v).onConflictDoNothing();
          }
          console.log(`    ✓ ${votesData.length} election votes seeded`);
        } else if (!skipVotes) {
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

  // ─── BR-44 (Election Certification Cross-Module Effects, M12, WF-077) ───
  // Runs regardless of whether nominees were just seeded or pre-existing —
  // for each elected nominee on any published election, end any current
  // active officer_term on the same position and create a new active term
  // for the elected nominee. Transition checklists for new terms get
  // populated downstream by layer-7-member seedOfficerHandover.
  try {
    const pubElectionsForRotation = await db.select({ id: elections.id })
      .from(elections)
      .where(sql`${elections.status} = 'published' AND ${elections.organizationId} = ${orgId}`);

    let totalRotated = 0;
    for (const pe of pubElectionsForRotation) {
      const electedNominees = await db
        .select({ positionId: electionNominees.positionId, personId: electionNominees.personId })
        .from(electionNominees)
        .where(and(eq(electionNominees.electionId, pe.id), eq(electionNominees.status, 'elected')));

      for (const n of electedNominees) {
        // Skip if nominee already holds an active term on this position
        const existingNewTerm = await db.select({ id: officerTerms.id })
          .from(officerTerms)
          .where(and(
            eq(officerTerms.personId, n.personId),
            eq(officerTerms.positionId, n.positionId),
            eq(officerTerms.status, 'active'),
          ))
          .limit(1);
        if (existingNewTerm.length > 0) continue;

        // End any other currently-active term on this position
        await db
          .update(officerTerms)
          .set({ status: 'completed', endDate: daysAgo(1) })
          .where(and(
            eq(officerTerms.positionId, n.positionId),
            eq(officerTerms.status, 'active'),
            sql`${officerTerms.personId} <> ${n.personId}`,
          ));

        // Create new active term for elected nominee
        await db.insert(officerTerms).values({
          positionId: n.positionId,
          personId: n.personId,
          organizationId: orgId,
          status: 'active',
          startDate: NOW,
          endDate: daysFromNow(365),
          notes: 'BR-44: created on election certification (WF-077)',
        });
        totalRotated++;
      }
    }
    if (totalRotated > 0) {
      console.log(`    ✓ BR-44: rotated ${totalRotated} officer term(s) post-certification`);
    } else {
      console.log('    (BR-44 rotation: no eligible nominees or already rotated)');
    }
  } catch (e) {
    console.log(`    (BR-44 rotation failed: ${(e as Error).message?.slice(0, 120)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 20: Training gap-fill — courses, enrollments, quiz attempts,
//           accredited providers
// ═══════════════════════════════════════════════════════════════

export async function seedTrainingGapFill(
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
  let existingProviders: Array<Record<string, unknown>>;
  let skipProviders = false;
  try {
    existingProviders = await db.select().from(accreditedProviders).limit(1);
  } catch {
    console.log('    (accredited_provider table not migrated yet, skipping providers)');
    existingProviders = [];
    skipProviders = true;
  }
  const seededProviderIds: string[] = [];
  if (existingProviders.length === 0) {
    const providerData = [
      { organizationId: orgId, name: 'Philippine Dental Association – CPD Council', accreditationNumber: 'PDA-CPD-001', status: 'active' as const, expiryDate: daysFromNow(365) },
      { organizationId: orgId, name: 'Philippine College of Oral Surgeons', accreditationNumber: 'PCOS-CPD-022', status: 'active' as const, expiryDate: daysFromNow(180) },
      { organizationId: orgId, name: 'DOH Region VII Training Unit', accreditationNumber: 'DOH-R7-055', status: 'suspended' as const, expiryDate: daysAgo(30) },
    ];
    for (const p of providerData) {
      const [inserted] = await db.insert(accreditedProviders).values(p).returning({ id: accreditedProviders.id });
      if (inserted) seededProviderIds.push(inserted.id);
    }
    console.log(`    ✓ ${seededProviderIds.length} accredited providers seeded`);
  } else if (!skipProviders) {
    console.log('    (accredited providers already seeded, skipping)');
    const rows = await db.select({ id: accreditedProviders.id }).from(accreditedProviders).limit(3);
    seededProviderIds.push(...rows.map(r => r.id));
  }

  // ─── Courses (self-paced online) ──────────────────────────────
  let existingCourses: Array<Record<string, unknown>>;
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
      const [inserted] = await db.insert(courses).values(c).returning({ id: courses.id });
      if (inserted) seededCourseIds.push(inserted.id);
    }
    console.log(`    ✓ ${seededCourseIds.length} courses seeded`);
  } else {
    console.log('    (courses already seeded, skipping)');
    const rows = await db.select({ id: courses.id }).from(courses).limit(4);
    seededCourseIds.push(...rows.map(r => r.id));
  }

  // ─── Course enrollments ───────────────────────────────────────
  let existingEnrollments: Array<Record<string, unknown>>;
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
      await db.insert(courseEnrollments).values(e);
    }
    console.log(`    ✓ ${enrollmentData.length} course enrollments seeded (4 completed, 3 in-progress)`);
  } else if (existingEnrollments.length > 0) {
    console.log('    (course enrollments already seeded, skipping)');
  }

  // ─── Quiz attempts ────────────────────────────────────────────
  let existingAttempts: Array<Record<string, unknown>>;
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
      await db.insert(quizAttempts).values(a);
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

export async function seedCredentialsGapFill(
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
  let existingLicenses: Array<Record<string, unknown>>;
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
      const [ins] = await db.insert(professionalLicenses).values(l).returning({ id: professionalLicenses.id });
      if (ins) insertedLicenses.push(ins.id);
    }
    console.log(`    ✓ ${insertedLicenses.length} professional licenses seeded (6 active, 2 expired)`);

    // ─── Renewal alerts for expiring licenses ─────────────────
    let existingAlerts: Array<Record<string, unknown>>;
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
        await db.insert(licenseRenewalAlerts).values(a);
      }
      console.log(`    ✓ ${alertData.length} license renewal alerts seeded`);
    }
  } else {
    console.log('    (professional licenses already seeded, skipping)');
  }

  // ─── Credential template ──────────────────────────────────────
  let existingTemplates: Array<Record<string, unknown>>;
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
    }).returning({ id: credentialTemplates.id });
    templateId = inserted?.id ?? null;
    console.log(`    ✓ Credential template seeded`);
  } else {
    templateId = (existingTemplates[0]?.['id'] as string) ?? null;
    console.log('    (credential template already seeded, skipping)');
  }

  // ─── Digital credentials (member ID cards) ───────────────────
  let existingDCs: Array<Record<string, unknown>>;
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
      await db.insert(digitalCredentials).values(dc);
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

export async function seedProfileAndGovernanceGapFill(
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
  let existingProfiles: Array<Record<string, unknown>>;
  let skipProfiles = false;
  try {
    existingProfiles = await db.select().from(directoryProfiles).limit(1);
  } catch {
    console.log('    (directory_profile table not migrated yet, skipping)');
    existingProfiles = [];
    skipProfiles = true;
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
      await db.insert(directoryProfiles).values(p);
    }
    console.log(`    ✓ ${profileData.length} directory profiles seeded (3 public, 4 memberOnly, 2 hidden)`);
  } else if (!skipProfiles) {
    console.log('    (directory profiles already seeded, skipping)');
  }

  // ─── Chapter affiliations ─────────────────────────────────────
  let existingAffiliations: Array<Record<string, unknown>>;
  let skipAffiliations = false;
  try {
    existingAffiliations = await db.select().from(chapterAffiliations).limit(1);
  } catch {
    console.log('    (chapter_affiliation table not migrated yet, skipping)');
    existingAffiliations = [];
    skipAffiliations = true;
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
      await db.insert(chapterAffiliations).values(a);
    }
    console.log(`    ✓ ${affiliationData.length} chapter affiliations seeded`);
  } else if (!skipAffiliations) {
    console.log('    (chapter affiliations already seeded, skipping)');
  }

  // ─── Notification preferences ─────────────────────────────────
  let existingPrefs: Array<Record<string, unknown>>;
  let skipPrefs = false;
  try {
    existingPrefs = await db.select().from(notificationPreferences).limit(1);
  } catch {
    console.log('    (notification_preference table not migrated yet, skipping)');
    existingPrefs = [];
    skipPrefs = true;
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
      await db.insert(notificationPreferences).values(p).onConflictDoNothing();
    }
    console.log(`    ✓ ${prefData.length} notification preferences seeded (${prefPersonIds.length} persons × ${categories.length} categories)`);
  } else if (!skipPrefs) {
    console.log('    (notification preferences already seeded, skipping)');
  }

  // ─── Privacy settings ─────────────────────────────────────────
  let existingPrivacy: Array<Record<string, unknown>>;
  let skipPrivacy = false;
  try {
    existingPrivacy = await db.select().from(personPrivacySettings).limit(1);
  } catch {
    console.log('    (person_privacy_setting table not migrated yet, skipping)');
    existingPrivacy = [];
    skipPrivacy = true;
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
      await db.insert(personPrivacySettings).values(p).onConflictDoNothing();
    }
    console.log(`    ✓ ${privacyData.length} privacy settings seeded`);
  } else if (!skipPrivacy) {
    console.log('    (privacy settings already seeded, skipping)');
  }

  // ─── Membership status history ────────────────────────────────
  let existingHistory: Array<Record<string, unknown>>;
  try {
    existingHistory = await db.select().from(membershipStatusHistory).limit(1);
  } catch {
    console.log('    (membership_status_history table not migrated yet, skipping)');
    return;
  }
  if (existingHistory.length === 0 && allMembershipIds.length > 0) {
    // Build transition history for first 5 memberships + grace/lapsed ones
    const historyData: NewMembershipStatusHistory[] = [];

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
      await db.insert(membershipStatusHistory).values(h);
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

export async function seedFinanceDeepFill(
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
        await db.execute(sql`
          UPDATE dues_payment SET invoice_id = ${inv.id}
          WHERE id = (
            SELECT id FROM dues_payment
            WHERE person_id = ${inv.personId} AND organization_id = ${orgId}
              AND status = 'completed' AND invoice_id IS NULL
            LIMIT 1
          )
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
      const payments = (completedPayments as unknown as { rows: Array<Record<string, unknown>> }).rows ?? (completedPayments as unknown as Array<Record<string, unknown>>);

      const fundRows = await db.select({ id: duesFunds.id, name: duesFunds.name, percentage: duesFunds.percentage })
        .from(duesFunds)
        .where(eq(duesFunds.organizationId, orgId));

      let allocCount = 0;
      for (const pay of payments) {
        const amount = Number(pay['amount'] ?? 0);
        for (const fund of fundRows) {
          const pct = Number(fund.percentage ?? 0);
          const allocAmount = Math.round((amount * pct) / 100);
          await db.insert(duesFundAllocations).values({
            organizationId: orgId,
            paymentId: pay['id'] as string,
            fundId: fund.id,
            amount: allocAmount,
          });
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
      }).returning({ id: specialAssessments.id });

      const [assess2] = await db.insert(specialAssessments).values({
        organizationId: orgId,
        name: 'Emergency Medical Equipment',
        description: 'Draft assessment for dental clinic equipment donation program.',
        amount: 50000, // ₱500
        currency: 'PHP',
        dueDate: dateStr(daysFromNow(120)),
        appliesTo: 'selected',
        status: 'draft',
      }).returning({ id: specialAssessments.id });

      // Targets for active assessment
      if (assess1) {
        for (let i = 0; i < Math.min(8, memberPersonIds.length); i++) {
          await db.insert(specialAssessmentTargets).values({
            assessmentId: assess1.id,
            personId: memberPersonIds[i]!,
            status: i < 3 ? 'paid' as const : 'pending' as const,
          });
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
          organizationId: orgId,
          duesConfigId: orgConfigs[0].id,
          daysOffset: -30,
          enabled: true,
        });
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
        encryptedSecret: 'sk_test_demo_key_not_real',
        connected: true,
      });
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

export async function seedCommsGapFill(
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
            chatRoomId: room.id,
            personId,
            role: personId === presidentPersonId ? 'admin' as const : 'member' as const,
            joinedAt: daysAgo(30),
          });
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
        });
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
      WHERE id = (
        SELECT id FROM chat_room
        WHERE organization_id = ${orgId} AND room_type IS NULL
        LIMIT 1
      )
    `);
    console.log('    ✓ Room type updated to channel');
  } catch (e) {
    console.log(`    (room type update failed: ${(e as Error).message?.slice(0, 60)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 25: Surveys Module
// ═══════════════════════════════════════════════════════════════

export async function seedSurveysModule(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Surveys module...');
  try {
    // ── Base surveys (NPS + draft + completed responses) ──
    // Guarded together: skip if any survey already exists.
    const existing = await db.select().from(surveysTable).limit(1);
    if (existing.length > 0) {
      console.log('    (base surveys already seeded, skipping)');
    } else {
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
      }).returning({ id: surveysTable.id });

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
      });

      // NPS responses (completed)
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
              { questionId: 'q1', value: npsScores[i]! },
              ...(comments[i] ? [{ questionId: 'q2', value: comments[i]! }] : []),
            ],
            status: 'completed',
            completedAt: daysAgo(Math.floor(Math.random() * 14)),
          });
        }
        console.log(`    ✓ 2 base surveys + ${Math.min(npsScores.length, memberPersonIds.length)} completed responses seeded`);
      }
    }

    // ── Active survey with OUTSTANDING (pending) assignments ──
    // Independently idempotent (checked by title) so existing DBs gain a
    // visible "Pending" card on the My Surveys page without a full reset.
    const PENDING_TITLE = 'Continuing Education Needs — 2026';
    const existingPending = await db
      .select({ id: surveysTable.id })
      .from(surveysTable)
      .where(and(eq(surveysTable.organizationId, orgId), eq(surveysTable.title, PENDING_TITLE)))
      .limit(1);

    if (existingPending.length === 0) {
      const [pendingSurvey] = await db.insert(surveysTable).values({
        organizationId: orgId,
        title: PENDING_TITLE,
        description: 'Tell us which CPD topics matter most to you this year.',
        surveyType: 'satisfaction',
        status: 'active',
        createdBy: presidentPersonId,
        questions: [
          { id: 'q1', type: 'rating', text: 'How satisfied are you with current CPD offerings?', required: true, order: 1, scale: { min: 1, max: 5 } },
          { id: 'q2', type: 'multi_choice', text: 'Which topics would you like more of?', required: false, order: 2, options: ['Clinical workshops', 'Practice management', 'Ethics', 'Research methods'] },
        ],
        settings: { anonymous: false, deadline: daysFromNow(14).toISOString() },
      }).returning({ id: surveysTable.id });

      if (pendingSurvey) {
        for (const memberId of memberPersonIds) {
          await db.insert(surveyResponsesTable).values({
            organizationId: orgId,
            surveyId: pendingSurvey.id,
            responderId: memberId,
            answers: [],
            status: 'pending',
          });
        }
        console.log(`    ✓ 1 active survey + ${memberPersonIds.length} pending responses seeded`);
      }
    } else {
      console.log('    (pending survey already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (surveys failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 26: CPD Config + Credit/Certificate Backfill
// ═══════════════════════════════════════════════════════════════

export async function seedCpdBackfill(
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
      });
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
        lastSeq: 5,
        orgCode: 'PDA-MM',
      });
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
      WHERE id IN (
        SELECT id FROM credit_entry
        WHERE source_type IS NULL AND organization_id = ${orgId}
        LIMIT 10
      )
    `);
    // Add 1 voided credit
    await db.execute(sql`
      UPDATE credit_entry SET status = 'voided', voided_reason = 'Duplicate entry — same event credited twice'
      WHERE id = (
        SELECT id FROM credit_entry
        WHERE status = 'active' AND organization_id = ${orgId}
        LIMIT 1
      )
    `);
    console.log('    ✓ Credit entries backfilled (sourceType + 1 voided)');
  } catch (e) {
    console.log(`    (credit backfill failed: ${(e as Error).message?.slice(0, 80)})`);
  }

  // ─── Backfill certificate status ──
  try {
    await db.execute(sql`
      UPDATE certificate SET status = 'issued'
      WHERE id IN (
        SELECT id FROM certificate WHERE status IS NULL LIMIT 20
      )
    `);
    // Add 1 revoked cert
    await db.execute(sql`
      UPDATE certificate SET status = 'revoked', revoked_at = ${daysAgo(30)}, revoked_reason = 'Training provider accreditation revoked — credits invalidated'
      WHERE id = (
        SELECT id FROM certificate WHERE status = 'issued' LIMIT 1
      )
    `);
    console.log('    ✓ Certificates backfilled (status + 1 revoked)');
  } catch (e) {
    console.log(`    (certificate backfill failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 27: Saved Segments
// ═══════════════════════════════════════════════════════════════

export async function seedSavedSegments(
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
      { name: 'Overdue Members', filters: { membershipStatus: ['lapsed', 'gracePeriod'], duesStatus: 'overdue' } },
      { name: 'New Members 2025', filters: { joinedAfter: '2025-01-01', joinedBefore: '2025-12-31' } },
      { name: 'Active Dentists', filters: { membershipStatus: ['active'], category: 'Regular' } },
    ];

    for (const seg of segments) {
      await db.insert(savedSegments).values({
        organizationId: orgId,
        name: seg.name,
        filters: seg.filters,
      });
    }
    console.log('    ✓ 3 saved segments seeded');
  } catch (e) {
    console.log(`    (saved segments failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 28: Jobs Module
// ═══════════════════════════════════════════════════════════════

export async function seedJobsModule(
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
      organizationName: 'PDA Metro Manila Chapter',
      title: 'Associate Dentist — General Practice',
      description: 'Seeking a licensed dentist to join our growing clinic. Must have valid PRC license and 2+ years experience.',
      type: 'full_time',
      status: 'active',
      location: 'Makati City, Metro Manila',
      salary: 'PHP 45,000 - 65,000/month',
      postedBy: presidentPersonId,
      postedAt: daysAgo(7),
      expiresAt: daysFromNow(53),
    }).returning({ id: jobPostings.id });

    const [job2] = await db.insert(jobPostings).values({
      organizationId: orgId,
      organizationName: 'PDA Metro Manila Chapter',
      title: 'Clinic Manager',
      description: 'Office manager for busy dental practice. Experience with clinic scheduling, billing, and patient coordination.',
      type: 'full_time',
      status: 'active',
      location: 'Quezon City, Metro Manila',
      salary: 'PHP 30,000 - 40,000/month',
      postedBy: presidentPersonId,
      postedAt: daysAgo(3),
      expiresAt: daysFromNow(57),
    }).returning({ id: jobPostings.id });

    // Applications
    if (job1 && memberPersonIds.length > 0) {
      await db.insert(jobApplications).values({
        postingId: job1.id,
        personId: memberPersonIds[0]!,
        status: 'applied',
        coverLetter: 'I am interested in this position. I have 3 years of experience in general dentistry and specialize in endodontics.',
        appliedAt: daysAgo(5),
      });
    }
    if (job2 && memberPersonIds.length > 1) {
      await db.insert(jobApplications).values({
        postingId: job2.id,
        personId: memberPersonIds[1]!,
        status: 'screening',
        coverLetter: 'Experienced clinic administrator with 5 years managing multi-dentist practices.',
        appliedAt: daysAgo(2),
      });
    }
    console.log('    ✓ 2 job postings + 2 applications seeded');
  } catch (e) {
    console.log(`    (jobs failed: ${(e as Error).message?.slice(0, 80)})`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 29: Privacy Settings Backfill
// ═══════════════════════════════════════════════════════════════

export async function seedPrivacyBackfill(
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
