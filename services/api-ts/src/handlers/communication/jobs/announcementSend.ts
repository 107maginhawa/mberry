/**
 * Announcement Send Job
 * Processes announcement fan-out: resolves recipients from segmentFilters,
 * then delivers via in-app notifications, email, and push channels.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { NotFoundError } from '@/core/errors';
import type { NotificationService } from '@/core/notifs';
import type { EmailService } from '@/core/email';
import type { DatabaseInstance } from '@/core/database';
import { CommunicationsRepository } from '../repos/communication.repo';
import { MembershipRepository } from '../../membership/repos/membership.repo';
import { notifications } from '../../notifs/repos/notification.schema';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { SYSTEM_USER_ID } from '@/core/constants';
import type { SegmentFilters } from '../repos/communication.schema';
import { personSubscriptions } from '../repos/communication.schema';
import { domainEvents } from '@/core/domain-events';
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

  // [M7-R5] Filter out deceased and suppressed members
  recipients = recipients.filter((row) => {
    const status = row.membership.status;
    return status !== 'deceased' && status !== 'suspended' && status !== 'removed';
  });

  // Apply filters not supported by listMembers query.
  // chapterId is not a column on the memberships table — it's looked up
  // via chapter_affiliation. For now we read it as an optional ad-hoc
  // attribute pending the chapter-segment join (Wave G5 / saved-segments).
  if (filters?.chapterIds?.length) {
    recipients = recipients.filter((row) => {
      const chapterId = (row.membership as Record<string, unknown>)['chapterId'];
      return typeof chapterId === 'string' && filters.chapterIds!.includes(chapterId);
    });
  }
  if (filters?.joinedAfter) {
    const cutoff = new Date(filters.joinedAfter);
    recipients = recipients.filter((row) => {
      const joined = row.membership.joinedAt;
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
    throw new NotFoundError(`Announcement ${announcementId} not found`, { resourceType: 'announcement', resource: announcementId });
  }

  // segmentFilters is not yet on the announcements schema — saved-segment
  // join is planned for Wave G5. Read defensively as an optional attribute.
  const segmentFilters = (announcement as Record<string, unknown>)['segmentFilters'] as SegmentFilters | undefined;
  const recipients = await resolveRecipients(db, announcement.organizationId, segmentFilters);
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

  // [M7-R2] Email fan-out — respects opt-out preferences
  if (channels.email && emailService) {
    // Batch-load email opt-outs for all recipients
    const allPersonIds = recipients.map((r) => r.personId);
    const optedOutPersonIds = new Set<string>();
    try {
      if (allPersonIds.length > 0) {
        const optOuts = await db.select({ personId: personSubscriptions.personId })
          .from(personSubscriptions)
          .where(and(
            eq(personSubscriptions.organizationId, announcement.organizationId),
            eq(personSubscriptions.enabled, false),
            inArray(personSubscriptions.personId, allPersonIds),
          ));
        for (const row of optOuts) {
          optedOutPersonIds.add(row.personId);
        }
      }
    } catch (err) {
      console.error('Failed to load email opt-outs, proceeding without filter:', err);
    }

    try {
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE)
          .filter((r) => !optedOutPersonIds.has(r.personId));
        if (batch.length === 0) continue;
        const personIds = batch.map((r) => r.personId);

        // Batch-fetch all emails for this batch in one query (fixes N+1)
        const emailMap: Map<string, string> = new Map();
        try {
          const emailResult = await db.execute(
            sql`SELECT id, email FROM "user" WHERE id = ANY(${personIds})`
          );
          // node-postgres returns { rows }, postgres-js returns the array directly.
          // structural: driver-shape varies — narrow to a uniform array shape.
          const rawRows = emailResult as unknown as { rows?: Array<{ id: string; email: string | null }> } | Array<{ id: string; email: string | null }>;
          const rows: Array<{ id: string; email: string | null }> = Array.isArray(rawRows) ? rawRows : (rawRows.rows ?? []);
          for (const row of rows) {
            if (row.email) emailMap.set(row.id, row.email);
          }
        } catch (err) {
          console.error('Batch email lookup failed:', err);
          continue;
        }

        for (const recipient of batch) {
          try {
            const userEmail = emailMap.get(recipient.personId);
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
 * Register communication background jobs with the scheduler AND wire the
 * announcement delivery fan-out to the domain event bus.
 *
 * Called once during app initialization (initializeApp). Before this wiring,
 * `registerCommunicationJobs` was never invoked, no subscriber existed for
 * `announcement.published`, and `processAnnouncementSend` was dead code —
 * meaning no announcement ever reached a member (FIX-001 / FIX-002).
 *
 * @param db Database instance used by the published-event subscriber. The cron
 *           handler receives its own db via JobContext; the event subscriber
 *           has no context, so it captures `db` from the closure.
 */
export function registerCommunicationJobs(
  scheduler: JobScheduler,
  notifsService: NotificationService,
  emailService: EmailService,
  db: DatabaseInstance,
): void {
  // FIX-001: deliver on publish. When an announcement is published, fan out to
  // in-app / email / push immediately. Fire-and-forget per domain-event-bus
  // convention — the subscriber owns its own try/catch + structured logging.
  domainEvents.on('announcement.published', async (payload) => {
    try {
      const repo = new CommunicationsRepository(db);
      const announcement = await repo.get(payload.announcementId, payload.organizationId);
      if (!announcement) return;
      await processAnnouncementSend(
        db,
        payload.announcementId,
        {
          push: announcement.channelPush,
          email: announcement.channelEmail,
          inApp: true, // in-app is the mandatory baseline channel (M7-R1)
        },
        notifsService,
        emailService,
      );
    } catch (err) {
      console.error('[announcement.published] fan-out failed:', err);
    }
  });

  // FIX-002: process scheduled announcements — runs every 5 minutes
  scheduler.registerCron('communication.processScheduled', '*/5 * * * *', async (context: JobContext) => {
    const cronDb = context.db;
    const repo = new CommunicationsRepository(cronDb);
    // Cross-org: find scheduled announcements whose time has come. MUST NOT pass a
    // single orgId — this cron spans every org. Passing '' previously cast to uuid
    // and threw `invalid input syntax for type uuid: ""` on every 5-min tick.
    const due = await repo.findScheduledDue(10);

    for (const announcement of due) {
      await repo.updateStatus(announcement.id, 'sent', { publishedAt: new Date() });
      await processAnnouncementSend(cronDb, announcement.id, {
        push: announcement.channelPush,
        email: announcement.channelEmail,
        inApp: true,
      }, notifsService, emailService);
    }
  });
}
