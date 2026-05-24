/**
 * Layer 4: Cross-module seeding — Phases 10-18
 *
 * Notifications, certificates, documents, comms, billing,
 * dunning/audit, marketplace/reviews/invites/storage,
 * dues infrastructure, committees.
 */

import { eq, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { NOW, daysAgo, daysFromNow, dateStr, ACTIVE_EXPIRY } from './helpers';

// Schema imports — cross-module
import { notifications } from '@/handlers/notifs/repos/notification.schema';
import { certificates } from '@/handlers/certificates/repos/certificates.schema';
import { orgCertificateSeq } from '@/handlers/certificates/repos/certificates.schema';
import { documents, documentVersions, documentAccessLogs } from '@/handlers/documents/repos/documents.schema';
import { chatRooms, chatMessages } from '@/handlers/comms/repos/comms.schema';
import { invoices, invoiceLineItems, merchantAccounts, billingConfigs } from '@/handlers/billing/repos/billing.schema';
import { duesConfigs, duesInvoices } from '@/handlers/association:member/repos/dues.schema';
import { duesFunds, duesOrgConfigs } from '@/handlers/association:member/repos/dues-payments.schema';
import { committees, committeeMembers } from '@/handlers/association:operations/repos/committee.schema';
import { committeeTasks } from '@/handlers/association:operations/repos/committee-task.schema';
import { dunningTemplates, dunningEvents } from '@/handlers/association:member/repos/dunning.schema';
import { auditLogEntries } from '@/handlers/audit/repos/audit.schema';
import { vendors, marketplaceListings, marketplaceOrders } from '@/handlers/marketplace/repos/marketplace.schema';
import { reviews } from '@/handlers/reviews/repos/review.schema';
import { invitationTokens } from '@/handlers/invite/repos/invite.schema';
import { storedFiles } from '@/handlers/storage/repos/file.schema';
import { membershipTiers } from '@/handlers/association:member/repos/membership.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { trainings } from '@/handlers/association:operations/repos/training.schema';

// ═══════════════════════════════════════════════════════════════
// Phase 10: Notifications
// ═══════════════════════════════════════════════════════════════

export async function seedNotifications(
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

export async function seedCertificates(
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

export async function seedDocuments(
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

export async function seedComms(
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

export async function seedBilling(
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

export async function seedDunningEventsAndAudit(
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

export async function seedRemainingModules(
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

export async function seedDuesInfrastructure(
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

export async function seedCommittees(
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
