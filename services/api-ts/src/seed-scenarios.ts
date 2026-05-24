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
import { membershipTiers, memberships } from './handlers/association:member/repos/membership.schema';
import { positions } from './handlers/association:member/repos/governance.schema';
import { persons } from './handlers/person/repos/person.schema';
import { events, eventRegistrations } from './handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from './handlers/association:operations/repos/training.schema';

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
        issuedAt: new Date('2025-03-01T00:00:00Z'),
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

  // ─── Historical completed payments (24 months for chart timeline) ──
  try {
    const histExists = await db.execute(
      sql`SELECT count(*) as c FROM dues_payment WHERE receipt_number LIKE 'RCP-HIST-%'`
    );
    const histCount = Number((histExists as any).rows?.[0]?.c ?? (histExists as any)[0]?.c ?? 0);
    if (histCount === 0 && memberPersonIds.length >= 5) {
      const methods = ['gcash', 'bankTransfer', 'cash', 'online', 'check'] as const;
      let histNum = 1;
      // 24 months of payments, 3-5 per month
      for (let monthsBack = 24; monthsBack >= 1; monthsBack--) {
        const paymentsThisMonth = 3 + (monthsBack % 3); // 3-5 per month
        for (let j = 0; j < paymentsThisMonth; j++) {
          const personIdx = (histNum - 1) % memberPersonIds.length;
          const dayInMonth = 5 + (j * 7); // spread across month
          const paidDate = new Date(NOW.getTime() - monthsBack * 30 * 86400000 + dayInMonth * 86400000);
          await db.execute(sql`
            INSERT INTO dues_payment (organization_id, person_id, receipt_number, amount, currency, payment_method, status, paid_at, created_at)
            VALUES (${orgId}, ${memberPersonIds[personIdx]!}, ${`RCP-HIST-${String(histNum).padStart(3, '0')}`}, 300000, 'PHP', ${methods[j % methods.length]}::dues_payment_method, 'completed'::dues_payment_status, ${paidDate}, ${paidDate})
          `);
          histNum++;
        }
      }
      console.log(`    ✓ ${histNum - 1} historical payments seeded (24 months for chart)`);
    }
  } catch (e) {
    console.log(`    (historical payments failed: ${(e as Error).message?.slice(0, 80)})`);
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
