/**
 * Ticket SLA Monitor — runs every 15 minutes.
 *
 * Finds tickets with approaching SLA deadlines (< 1 hour) or already breached.
 * Notifies the assigned admin (if any) and all super admins.
 *
 * M3-R12 compliance job.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import { and, inArray, lt, or, sql } from 'drizzle-orm';
import { supportTickets } from '../repos/platform-admin.schema';
import { platformAdmins } from '../repos/platform-admin.schema';
import { notifications } from '@/handlers/notifs/repos/notification.schema';

const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000000';
const ALERT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function registerTicketJobs(scheduler: JobScheduler, _notificationService: NotificationService): void {
  scheduler.registerCron('platformadmin.ticketSlaMonitor', '*/15 * * * *', async (context: JobContext) => {
    const { db, logger, jobId } = context;
    logger.debug({ jobId }, 'Ticket SLA monitor starting');

    try {
      const now = new Date();
      const alertCutoff = new Date(now.getTime() + ALERT_WINDOW_MS);

      // Active tickets whose first-response OR resolution deadline is within 1h or already passed
      const activeTickets = await db
        .select()
        .from(supportTickets)
        .where(
          and(
            inArray(supportTickets.status, ['open', 'in_progress', 'waiting_customer']),
            or(
              lt(supportTickets.slaFirstResponseDeadline, alertCutoff),
              lt(supportTickets.slaResolutionDeadline, alertCutoff),
            ),
          ),
        );

      if (activeTickets.length === 0) {
        logger.debug({ jobId }, 'No tickets approaching SLA deadline');
        return;
      }

      // Super admins always notified
      const superAdmins = await db
        .select({ userId: platformAdmins.userId })
        .from(platformAdmins)
        .where(sql`${platformAdmins.role} = 'super'`);

      let notifiedCount = 0;

      for (const ticket of activeTickets) {
        const resMs = ticket.slaResolutionDeadline.getTime();
        const frMs = ticket.slaFirstResponseDeadline.getTime();
        const nowMs = now.getTime();

        const isBreached = nowMs > resMs || (!ticket.firstRespondedAt && nowMs > frMs);
        const hoursToResolution = Math.max(0, (resMs - nowMs) / (1000 * 60 * 60));

        const title = isBreached
          ? `BREACHED: Ticket SLA exceeded — ${ticket.subject}`
          : `SLA Alert: Ticket deadline < 1h — ${ticket.subject}`;

        const message = isBreached
          ? `Ticket ${ticket.id} (${ticket.priority}) has breached its SLA deadline.`
          : `Ticket ${ticket.id} (${ticket.priority}) has ${Math.round(hoursToResolution * 60)} minutes until SLA breach.`;

        // Collect recipient set: super admins + assigned admin (deduplicated)
        const recipientSet = new Set<string>(superAdmins.map(a => a.userId));
        if (ticket.assignedTo) recipientSet.add(ticket.assignedTo);

        for (const recipientId of recipientSet) {
          try {
            await db.insert(notifications).values({
              organizationId: PLATFORM_ORG_ID,
              recipient: recipientId,
              type: 'system',
              channel: 'in-app',
              title,
              message,
              status: 'sent',
              sentAt: now,
              relatedEntityType: 'support_ticket',
              relatedEntity: ticket.id,
              consentValidated: false,
            });
            notifiedCount++;
          } catch (err) {
            logger.error({ err, ticketId: ticket.id, recipientId }, 'Failed to create SLA notification');
          }
        }
      }

      logger.info({ jobId, ticketCount: activeTickets.length, notifiedCount }, 'Ticket SLA monitor completed');
    } catch (error) {
      logger.error({ error, jobId }, 'Ticket SLA monitor failed');
      throw error;
    }
  });
}
