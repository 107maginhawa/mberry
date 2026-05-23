/**
 * Announcement Send Job
 * Processes announcement fan-out: resolves recipients from segmentFilters,
 * then delivers via in-app notifications, email, and push channels.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import type { EmailService } from '@/core/email';
import type { DatabaseInstance } from '@/core/database';
import { CommunicationsRepository } from '../repos/communication.repo';
import { MembershipRepository } from '../../membership/repos/membership.repo';
import { notifications } from '../../notifs/repos/notification.schema';
import { sql } from 'drizzle-orm';
import { SYSTEM_USER_ID } from '@/core/constants';
import type { SegmentFilters } from '../repos/communication.schema';
import Handlebars from 'handlebars';

const BATCH_SIZE = 50;

/**
 * Render merge fields in announcement content using Handlebars.
 * Reuses the same template syntax as email module.
 * Unknown fields pass through unchanged.
 */
export function renderMergeFields(text: string, data: Record<string, unknown>): string {
  try {
    const template = Handlebars.compile(text, { noEscape: true, strict: false });
    return template(data);
  } catch {
    // If Handlebars fails, return original text
    return text;
  }
}

/**
 * Resolve recipients from segment filters using membership roster.
 * Returns personIds of matching members.
 */
export async function resolveRecipients(
  db: DatabaseInstance,
  organizationId: string,
  filters?: SegmentFilters | null,
): Promise<Array<{ personId: string }>> {
  const membershipRepo = new MembershipRepository(db);
  const result = await membershipRepo.listMembers({
    organizationId,
    status: filters?.duesStatus || 'active',
    categoryId: filters?.membershipTier || undefined,
    limit: 10000,
    offset: 0,
  });

  let recipients = result.data;

  // Apply filters not supported by listMembers query
  if (filters?.chapterIds?.length) {
    recipients = recipients.filter((row) =>
      filters.chapterIds!.includes((row.membership as any).chapterId)
    );
  }
  if (filters?.joinedAfter) {
    const cutoff = new Date(filters.joinedAfter);
    recipients = recipients.filter((row) => {
      const joined = (row.membership as any).joinedAt;
      return joined && new Date(joined) >= cutoff;
    });
  }
  // cpdCompliant filtering requires credit data — deferred to β6 saved segments

  return recipients.map((row) => ({
    personId: row.person?.id ?? row.membership.personId,
  }));
}

/**
 * Process the announcement send: fan out to all channels.
 * Called directly from publishAnnouncement (synchronous within request for MVP).
 */
export async function processAnnouncementSend(
  db: DatabaseInstance,
  announcementId: string,
  channels: { push: boolean; email: boolean; inApp: boolean },
  notifsService?: NotificationService,
  emailService?: EmailService,
): Promise<{ recipients: number; emailSent: number; pushDelivered: number; inAppSent: number }> {
  const repo = new CommunicationsRepository(db);
  const announcement = await repo.get(announcementId);
  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  const recipients = await resolveRecipients(db, announcement.organizationId, (announcement as any).segmentFilters);
  const stats = { recipients: recipients.length, emailSent: 0, pushDelivered: 0, inAppSent: 0 };

  if (recipients.length === 0) {
    await repo.createStats(announcementId, 0, announcement.organizationId);
    return stats;
  }

  // In-App notifications — bulk insert
  if (channels.inApp) {
    try {
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        await db.insert(notifications).values(
          batch.map((r) => ({
            organizationId: announcement.organizationId,
            recipient: r.personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: announcement.title,
            message: announcement.content.substring(0, 1000),
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'announcement',
            relatedEntity: announcementId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          })),
        );
        stats.inAppSent += batch.length;
      }
    } catch (err) {
      // Partial failure: log but continue with other channels
      console.error('In-app notification batch failed:', err);
    }
  }

  // Email fan-out — fetch email from user table via personId mapping
  if (channels.email && emailService) {
    try {
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        for (const recipient of batch) {
          try {
            // Fetch user email via raw SQL (user table from Better-Auth, linked by person_id)
            const emailResult = await db.execute(
              sql`SELECT email FROM "user" WHERE id = ${recipient.personId} LIMIT 1`
            );
            const userEmail = (emailResult as any).rows?.[0]?.email;

            if (userEmail) {
              await emailService.queueEmail({
                templateTags: ['announcement'],
                recipient: userEmail,
                variables: {
                  title: announcement.title,
                  message: announcement.content,
                },
                metadata: {
                  announcementId,
                  relatedEntity: announcementId,
                },
              });
              stats.emailSent++;
            }
          } catch (err) {
            // Individual email failure — continue
            console.error(`Email failed for ${recipient.personId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Email fan-out failed:', err);
    }
  }

  // Push notification via NotificationService (handles OneSignal)
  if (channels.push) {
    try {
      if (notifsService) {
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          for (const recipient of batch) {
            try {
              await notifsService.createNotification({
                organizationId: announcement.organizationId,
                recipient: recipient.personId,
                type: 'system',
                channel: 'push',
                title: announcement.title,
                message: announcement.content.substring(0, 200),
              });
              stats.pushDelivered++;
            } catch {
              // Individual push failure — continue
            }
          }
        }
      } else {
        console.log(`Push: OneSignal not configured, skipping ${recipients.length} push notifications`);
      }
    } catch (err) {
      console.error('Push fan-out failed:', err);
    }
  }

  // Update announcement stats with delivery counts
  try {
    await repo.createStats(announcementId, stats.recipients, announcement.organizationId);
  } catch {
    // Stats insert failure is non-critical
  }

  return stats;
}

/**
 * Register communication background jobs with the scheduler.
 */
export function registerCommunicationJobs(
  scheduler: JobScheduler,
  notifsService: NotificationService,
  emailService: EmailService,
): void {
  // Process scheduled announcements — runs every 5 minutes
  scheduler.registerCron('communication.processScheduled', '*/5 * * * *', async (context: JobContext) => {
    const db = context.db;
    const repo = new CommunicationsRepository(db);
    const { data: scheduled } = await repo.list('', { status: 'scheduled', limit: 10 });

    for (const announcement of scheduled) {
      if (announcement.scheduledAt && new Date(announcement.scheduledAt) <= new Date()) {
        await repo.updateStatus(announcement.id, 'sent', { publishedAt: new Date() });
        await processAnnouncementSend(db, announcement.id, {
          push: announcement.channelPush,
          email: announcement.channelEmail,
          inApp: true,
        }, notifsService, emailService);
      }
    }
  });
}
