/**
 * Breach Deadline Monitor — runs every 15 minutes.
 *
 * Queries breach_incidents where status is active (reported/investigating)
 * and the NPC 72-hour notification deadline is within 24 hours.
 * Sends urgent in-app notifications to all platform super-admins.
 *   < 1h remaining → urgent
 *   1-24h remaining → warning
 *
 * DPA 2012 / M3-R11 compliance job.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import { inArray, and, lt, sql } from 'drizzle-orm';
import { breachIncidents } from '../repos/platform-admin.schema';
import { platformAdmins } from '../repos/platform-admin.schema';
import { notifications } from '@/handlers/notifs/repos/notification.schema';

const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000000';

export function registerBreachJobs(scheduler: JobScheduler, notificationService: NotificationService): void {
  scheduler.registerCron('platformadmin.breachDeadlineMonitor', '*/15 * * * *', async (context: JobContext) => {
    const { db, logger, jobId } = context;
    logger.debug({ jobId }, 'Breach deadline monitor starting');

    try {
      // Find active breaches with deadline within 24 hours
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const activeBreaches = await db
        .select()
        .from(breachIncidents)
        .where(
          and(
            inArray(breachIncidents.status, ['reported', 'investigating']),
            lt(breachIncidents.notificationDeadline, cutoff),
          ),
        );

      if (activeBreaches.length === 0) {
        logger.debug({ jobId }, 'No breaches approaching deadline');
        return;
      }

      // Find all super admin personIds
      const superAdmins = await db
        .select({ userId: platformAdmins.userId })
        .from(platformAdmins)
        .where(sql`${platformAdmins.role} = 'super'`);

      if (superAdmins.length === 0) {
        logger.warn({ jobId }, 'No super admins found — breach deadline notifications not sent');
        return;
      }

      const now = Date.now();
      let notifiedCount = 0;

      for (const breach of activeBreaches) {
        const hoursRemaining = (breach.notificationDeadline.getTime() - now) / (1000 * 60 * 60);
        const isUrgent = hoursRemaining < 1;

        const title = isUrgent
          ? `URGENT: Breach NPC deadline < 1 hour (${breach.id})`
          : `WARNING: Breach NPC deadline in ${Math.round(hoursRemaining)}h (${breach.id})`;

        const message = isUrgent
          ? `Breach incident ${breach.id} must be reported to NPC within 1 hour or a DPA 2012 violation occurs.`
          : `Breach incident ${breach.id} has ${Math.round(hoursRemaining)} hours remaining until the 72-hour NPC notification deadline.`;

        for (const admin of superAdmins) {
          try {
            await db.insert(notifications).values({
              organizationId: PLATFORM_ORG_ID,
              recipient: admin.userId,
              type: 'system',
              channel: 'in-app',
              title,
              message,
              status: 'sent',
              sentAt: new Date(),
              relatedEntityType: 'breach_incident',
              relatedEntity: breach.id,
              consentValidated: false,
            });
            notifiedCount++;
          } catch (err) {
            logger.error({ err, breachId: breach.id, adminUserId: admin.userId }, 'Failed to create breach notification');
          }
        }
      }

      logger.info({ jobId, breachCount: activeBreaches.length, notifiedCount }, 'Breach deadline monitor completed');
    } catch (error) {
      logger.error({ error, jobId }, 'Breach deadline monitor failed');
      throw error;
    }
  });
}
