/**
 * Layer 7: Communication + Email coverage seeding
 *
 * Seeds FK-coherent, idempotent data for communication
 * templates/subscriptions, announcement stats, and the
 * email queue/templates. Safe to re-run — every insert is guarded by a
 * unique-marker existence check, and each table group is isolated in its
 * own try/catch so a single failure never aborts the whole layer.
 */

import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { daysAgo, daysFromNow } from './helpers';

// Schema imports
import {
  announcementStats,
  messageTemplates,
  subscriptionTopics,
  personSubscriptions,
  messages,
} from '@/handlers/communication/repos/communication.schema';
import {
  emailQueue,
  emailTemplates,
} from '@/handlers/email/repos/email.schema';

export async function seedCommsCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Comms coverage (templates, subscriptions, email)...');

  // ─── messageTemplates ───
  try {
    type NewTemplate = typeof messageTemplates.$inferInsert;
    const templateSeeds: Array<Pick<NewTemplate, 'name' | 'channel' | 'subject' | 'body' | 'mergeFields' | 'category' | 'isTransactional' | 'status'>> = [
      { name: 'Dues Renewal Reminder', channel: 'email', subject: 'Your {{year}} membership dues are due soon', body: 'Hi {{firstName}}, your annual dues of {{amount}} are due on {{dueDate}}. Renew now to keep your membership active.', mergeFields: ['firstName', 'year', 'amount', 'dueDate'], category: 'dues', isTransactional: true, status: 'active' },
      { name: 'Event Invitation', channel: 'email', subject: "You're invited: {{eventName}}", body: 'Dear {{firstName}}, join us for {{eventName}} on {{eventDate}} at {{venue}}. Reserve your seat today.', mergeFields: ['firstName', 'eventName', 'eventDate', 'venue'], category: 'events', isTransactional: false, status: 'active' },
      { name: 'Training Confirmation', channel: 'inApp', subject: 'Enrollment confirmed: {{trainingName}}', body: 'You are enrolled in {{trainingName}}. It awards {{credits}} CPD units. See you on {{startDate}}.', mergeFields: ['trainingName', 'credits', 'startDate'], category: 'training', isTransactional: true, status: 'active' },
      { name: 'Welcome Push', channel: 'push', subject: null, body: 'Welcome to the association, {{firstName}}! Tap to complete your profile.', mergeFields: ['firstName'], category: 'onboarding', isTransactional: false, status: 'draft' },
    ];

    for (const t of templateSeeds) {
      const existing = (await db.execute(
        sql`SELECT id FROM message_template WHERE organization_id = ${orgId} AND name = ${t.name} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(messageTemplates).values({
          organizationId: orgId,
          name: t.name,
          channel: t.channel,
          subject: t.subject ?? null,
          body: t.body,
          mergeFields: t.mergeFields,
          category: t.category,
          isTransactional: t.isTransactional,
          status: t.status,
        });
      }
    }
    console.log(`    ✓ ${templateSeeds.length} message templates`);
  } catch (e) {
    console.log(`    (message templates failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── subscriptionTopics + personSubscriptions ───
  try {
    type NewTopic = typeof subscriptionTopics.$inferInsert;
    const topicSeeds: Array<Pick<NewTopic, 'name' | 'description' | 'channel' | 'category' | 'defaultEnabled'>> = [
      { name: 'events', description: 'Notifications about upcoming events and conferences.', channel: 'email', category: 'events', defaultEnabled: true },
      { name: 'dues', description: 'Reminders about membership dues and payment status.', channel: 'email', category: 'billing', defaultEnabled: true },
      { name: 'training', description: 'Continuing education and CPD opportunities.', channel: 'inApp', category: 'training', defaultEnabled: true },
      { name: 'announcements', description: 'Official association announcements and news.', channel: 'push', category: 'general', defaultEnabled: true },
      { name: 'newsletter', description: 'Monthly digest and member spotlights.', channel: 'email', category: 'marketing', defaultEnabled: false },
    ];

    const topicIds: string[] = [];
    for (const t of topicSeeds) {
      const existing = (await db.execute(
        sql`SELECT id FROM subscription_topic WHERE organization_id = ${orgId} AND name = ${t.name} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        const [row] = await db.insert(subscriptionTopics).values({
          organizationId: orgId,
          name: t.name,
          description: t.description,
          channel: t.channel,
          category: t.category,
          defaultEnabled: t.defaultEnabled,
        }).returning({ id: subscriptionTopics.id });
        if (row) topicIds.push(row.id);
      } else {
        topicIds.push(existing.rows[0]!.id);
      }
    }

    // Per-person subscriptions (unique on personId+topicId)
    let subCount = 0;
    const subscribers = [presidentPersonId, ...memberPersonIds.slice(0, 4)];
    for (let s = 0; s < subscribers.length; s++) {
      const personId = subscribers[s]!;
      for (let t = 0; t < topicIds.length; t++) {
        const topicId = topicIds[t]!;
        const existing = (await db.execute(
          sql`SELECT id FROM person_subscription WHERE person_id = ${personId} AND topic_id = ${topicId} LIMIT 1`,
        )) as unknown as { rows: Array<{ id: string }> };
        if (existing.rows?.length === 0) {
          await db.insert(personSubscriptions).values({
            organizationId: orgId,
            personId,
            topicId,
            // Vary opt-out: newsletter (index 4) disabled for some members
            enabled: !(t === 4 && s % 2 === 1),
          });
          subCount++;
        }
      }
    }
    console.log(`    ✓ ${topicIds.length} subscription topics + ${subCount} person subscriptions`);
  } catch (e) {
    console.log(`    (subscriptions failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── announcementStats (FK → announcement) ───
  try {
    const ann = (await db.execute(
      sql`SELECT id FROM announcement WHERE organization_id = ${orgId} ORDER BY created_at DESC LIMIT 3`,
    )) as unknown as { rows: Array<{ id: string }> };

    if (!ann.rows || ann.rows.length === 0) {
      console.log('    (no announcement found, skipped announcement stats)');
    } else {
      let statsCount = 0;
      for (let i = 0; i < ann.rows.length; i++) {
        const announcementId = ann.rows[i]!.id;
        const existing = (await db.execute(
          sql`SELECT id FROM announcement_stats WHERE announcement_id = ${announcementId} LIMIT 1`,
        )) as unknown as { rows: Array<{ id: string }> };
        if (existing.rows?.length === 0) {
          const recipients = 120 + i * 40;
          await db.insert(announcementStats).values({
            organizationId: orgId,
            announcementId,
            recipients,
            inappViews: Math.floor(recipients * 0.7),
            pushDelivered: Math.floor(recipients * 0.9),
            emailSent: Math.floor(recipients * 0.6),
            emailOpened: Math.floor(recipients * 0.35),
          });
          statsCount++;
        }
      }
      console.log(`    ✓ ${statsCount} announcement stats records`);
    }
  } catch (e) {
    console.log(`    (announcement stats failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── emailTemplates ───
  try {
    type NewEmailTemplate = typeof emailTemplates.$inferInsert;
    const emailTemplateSeeds: Array<Pick<NewEmailTemplate, 'name' | 'description' | 'subject' | 'bodyHtml' | 'bodyText' | 'tags' | 'variables' | 'status'>> = [
      { name: 'Dues Receipt', description: 'Sent after a successful dues payment.', subject: 'Payment received — {{receiptNumber}}', bodyHtml: '<p>Hi {{firstName}},</p><p>We received your payment of <strong>{{amount}}</strong>. Your membership is valid until {{expiryDate}}.</p>', bodyText: 'Hi {{firstName}}, we received your payment of {{amount}}. Membership valid until {{expiryDate}}.', tags: ['dues', 'receipt'], variables: [{ id: 'firstName', type: 'string', label: 'First Name', required: true }, { id: 'amount', type: 'string', label: 'Amount', required: true }, { id: 'receiptNumber', type: 'string', label: 'Receipt Number', required: true }, { id: 'expiryDate', type: 'date', label: 'Expiry Date', required: true }], status: 'active' },
      { name: 'Event Reminder', description: 'Reminder sent 24h before an event.', subject: 'Reminder: {{eventName}} is tomorrow', bodyHtml: '<p>Dear {{firstName}},</p><p>{{eventName}} starts tomorrow at {{venue}}. We look forward to seeing you!</p>', bodyText: 'Dear {{firstName}}, {{eventName}} starts tomorrow at {{venue}}.', tags: ['events', 'reminder'], variables: [{ id: 'firstName', type: 'string', label: 'First Name', required: true }, { id: 'eventName', type: 'string', label: 'Event Name', required: true }, { id: 'venue', type: 'string', label: 'Venue', required: true }], status: 'active' },
      { name: 'Welcome Email', description: 'Onboarding email for new members.', subject: 'Welcome to the association, {{firstName}}!', bodyHtml: '<p>Welcome aboard, {{firstName}}! Your member number is {{memberNumber}}.</p>', bodyText: 'Welcome aboard, {{firstName}}! Your member number is {{memberNumber}}.', tags: ['onboarding'], variables: [{ id: 'firstName', type: 'string', label: 'First Name', required: true }, { id: 'memberNumber', type: 'string', label: 'Member Number', required: true }], status: 'active' },
      { name: 'Password Reset', description: 'Transactional password reset email.', subject: 'Reset your password', bodyHtml: '<p>Click <a href="{{resetUrl}}">here</a> to reset your password. This link expires in 1 hour.</p>', bodyText: 'Reset your password: {{resetUrl}} (expires in 1 hour).', tags: ['auth', 'transactional'], variables: [{ id: 'resetUrl', type: 'url', label: 'Reset URL', required: true }], status: 'draft' },
    ];

    const emailTemplateIds: string[] = [];
    for (const t of emailTemplateSeeds) {
      const existing = (await db.execute(
        sql`SELECT id FROM email_template WHERE organization_id = ${orgId} AND name = ${t.name} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        const [row] = await db.insert(emailTemplates).values({
          organizationId: orgId,
          name: t.name,
          description: t.description ?? null,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText ?? null,
          tags: t.tags ?? null,
          variables: t.variables,
          status: t.status,
        }).returning({ id: emailTemplates.id });
        if (row) emailTemplateIds.push(row.id);
      } else {
        emailTemplateIds.push(existing.rows[0]!.id);
      }
    }
    console.log(`    ✓ ${emailTemplateSeeds.length} email templates`);

    // ─── emailQueue (spans all statuses) ───
    try {
      type NewQueueItem = typeof emailQueue.$inferInsert;
      const firstTemplateId = emailTemplateIds[0] ?? null;
      const queueSeeds: Array<{
        marker: string;
        status: NonNullable<NewQueueItem['status']>;
        recipientEmail: string;
        recipientName: string;
        priority: number;
        attempts: number;
        scheduledAt: Date | null;
        sentAt: Date | null;
        lastAttemptAt: Date | null;
        nextRetryAt: Date | null;
        lastError: string | null;
        provider: NonNullable<NewQueueItem['provider']> | null;
        providerMessageId: string | null;
        cancelledAt: Date | null;
        cancellationReason: string | null;
        emailCategory: NonNullable<NewQueueItem['emailCategory']>;
      }> = [
        { marker: 'SEED7-Q-PENDING', status: 'pending', recipientEmail: 'pending.member@example.com', recipientName: 'Pending Member', priority: 5, attempts: 0, scheduledAt: daysFromNow(1), sentAt: null, lastAttemptAt: null, nextRetryAt: null, lastError: null, provider: null, providerMessageId: null, cancelledAt: null, cancellationReason: null, emailCategory: 'transactional' },
        { marker: 'SEED7-Q-PROCESSING', status: 'processing', recipientEmail: 'processing.member@example.com', recipientName: 'Processing Member', priority: 3, attempts: 1, scheduledAt: null, sentAt: null, lastAttemptAt: daysAgo(0), nextRetryAt: null, lastError: null, provider: 'smtp', providerMessageId: null, cancelledAt: null, cancellationReason: null, emailCategory: 'transactional' },
        { marker: 'SEED7-Q-SENT', status: 'sent', recipientEmail: 'sent.member@example.com', recipientName: 'Sent Member', priority: 5, attempts: 1, scheduledAt: null, sentAt: daysAgo(2), lastAttemptAt: daysAgo(2), nextRetryAt: null, lastError: null, provider: 'postmark', providerMessageId: 'pm-msg-0001', cancelledAt: null, cancellationReason: null, emailCategory: 'bulk' },
        { marker: 'SEED7-Q-FAILED', status: 'failed', recipientEmail: 'failed.member@example.com', recipientName: 'Failed Member', priority: 5, attempts: 3, scheduledAt: null, sentAt: null, lastAttemptAt: daysAgo(1), nextRetryAt: daysFromNow(1), lastError: 'SMTP 550: recipient mailbox unavailable', provider: 'smtp', providerMessageId: null, cancelledAt: null, cancellationReason: null, emailCategory: 'transactional' },
        { marker: 'SEED7-Q-CANCELLED', status: 'cancelled', recipientEmail: 'cancelled.member@example.com', recipientName: 'Cancelled Member', priority: 7, attempts: 0, scheduledAt: daysFromNow(3), sentAt: null, lastAttemptAt: null, nextRetryAt: null, lastError: null, provider: null, providerMessageId: null, cancelledAt: daysAgo(0), cancellationReason: 'Recipient unsubscribed before send', emailCategory: 'bulk' },
      ];

      let queueCount = 0;
      for (const q of queueSeeds) {
        const existing = (await db.execute(
          sql`SELECT id FROM email_queue WHERE organization_id = ${orgId} AND metadata->>'seedMarker' = ${q.marker} LIMIT 1`,
        )) as unknown as { rows: Array<{ id: string }> };
        if (existing.rows?.length === 0) {
          await db.insert(emailQueue).values({
            organizationId: orgId,
            template: firstTemplateId,
            templateTags: firstTemplateId ? null : ['dues', 'receipt'],
            recipientEmail: q.recipientEmail,
            recipientName: q.recipientName,
            variables: { firstName: q.recipientName.split(' ')[0], amount: 'PHP 2,000.00' },
            metadata: { seedMarker: q.marker },
            status: q.status,
            priority: q.priority,
            scheduledAt: q.scheduledAt,
            attempts: q.attempts,
            lastAttemptAt: q.lastAttemptAt,
            nextRetryAt: q.nextRetryAt,
            lastError: q.lastError,
            sentAt: q.sentAt,
            provider: q.provider,
            providerMessageId: q.providerMessageId,
            cancelledAt: q.cancelledAt,
            cancelledBy: q.status === 'cancelled' ? presidentPersonId : null,
            cancellationReason: q.cancellationReason,
            emailCategory: q.emailCategory,
          });
          queueCount++;
        }
      }
      console.log(`    ✓ ${queueCount} email queue records (pending, processing, sent, failed, cancelled)`);
    } catch (e) {
      console.log(`    (email queue failed: ${(e as Error).message?.slice(0, 120)})`);
    }
  } catch (e) {
    console.log(`    (email templates failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── BR-28 (Communication Dedup, M07, WF-046): seed dedup fixture ───
  // Two sent-today email messages to memberPersonIds[0] with the same
  // (channel, recipient, day) tuple. Per BR-28 these MUST dedupe to a single
  // unique notification when grouped — assertion target for
  // `__tests__/br-edge-cases.test.ts` and the M07 dedup contract.
  //
  //   SELECT COUNT(DISTINCT (channel, recipient_person_id, DATE(sent_at)))
  //     FROM message
  //     WHERE body LIKE 'SEED-BR-28%'
  //       AND organization_id = $orgId;
  //   → expected 1 (two raw rows, deduped to one channel+recipient+day key)
  try {
    const existing = (await db.execute(
      sql`SELECT id FROM message WHERE organization_id = ${orgId} AND status = 'sent' AND body LIKE 'SEED-BR-28%' LIMIT 2`,
    )) as unknown as { rows: Array<{ id: string }> };

    const existingCount = existing.rows?.length ?? 0;

    if (existingCount < 2 && memberPersonIds.length > 0) {
      const now = new Date();
      // Row 1: the precondition (first send today)
      if (existingCount < 1) {
        await db.insert(messages).values({
          organizationId: orgId,
          channel: 'email',
          senderId: presidentPersonId,
          recipients: [
            { personId: memberPersonIds[0]!, deliveryStatus: 'delivered', deliveredAt: now.toISOString() },
          ],
          subject: 'SEED-BR-28',
          body: 'SEED-BR-28: dedup precondition',
          sentAt: now,
          status: 'sent',
        });
      }
      // Row 2: the dedup target — same (channel=email, recipient=memberPersonIds[0],
      // day=today) as row 1. BR-28 says these collapse to a single delivered notification.
      await db.insert(messages).values({
        organizationId: orgId,
        channel: 'email',
        senderId: presidentPersonId,
        recipients: [
          { personId: memberPersonIds[0]!, deliveryStatus: 'delivered', deliveredAt: now.toISOString() },
        ],
        subject: 'SEED-BR-28',
        body: 'SEED-BR-28: dedup duplicate (same channel+recipient+day)',
        sentAt: now,
        status: 'sent',
      });
      console.log('    ✓ BR-28 dedup fixture seeded (2 raw rows → 1 deduped (channel,recipient,day) key)');
    } else {
      console.log('    (BR-28 dedup fixture already seeded, skipping)');
    }
  } catch (e) {
    console.log(`    (BR-28 dedup fixture failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  console.log('  Comms coverage complete.');
}
