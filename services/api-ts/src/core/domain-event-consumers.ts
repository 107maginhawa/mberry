/**
 * Domain Event Consumers
 *
 * Registers all cross-module event handlers. Called once during app startup.
 * Each consumer is a thin glue layer — heavy logic stays in repos/services.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { domainEvents } from './domain-events';
import type { DatabaseInstance } from './database';
import type { Logger } from '@/types/logger';
import { SYSTEM_USER_ID } from './constants';
import { notifications } from '@/handlers/notifs/repos/notification.schema';
import { bookings } from '@/handlers/booking/repos/booking.schema';
import { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { trainingEnrollments } from '@/handlers/association:operations/repos/training.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { positions } from '@/handlers/association:member/repos/governance.schema';

/** Minimal contract for the membership repo used by domain event consumers. */
export interface DomainEventMembershipRepo {
  findByPersonAndOrg(personId: string, organizationId: string): Promise<{ id: string } | null>;
  updateOneById(id: string, data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Register all domain event consumers.
 * Call this once during app initialization (in initializeApp).
 */
export function registerDomainEventConsumers(
  deps: { membershipRepo: DomainEventMembershipRepo; db: DatabaseInstance },
  logger: Logger,
): void {
  domainEvents.setLogger(logger);

  // -----------------------------------------------------------------------
  // dues.payment.recorded → update membership duesExpiryDate
  // -----------------------------------------------------------------------
  domainEvents.on('dues.payment.recorded', async (payload) => {
    if (!payload.newExpiryDate) {
      logger.debug(
        { paymentId: payload.paymentId },
        'Payment recorded without new expiry date — skipping membership update',
      );
      return;
    }

    const membership = await deps.membershipRepo.findByPersonAndOrg(
      payload.personId,
      payload.organizationId,
    );

    if (!membership) {
      logger.warn(
        { personId: payload.personId, organizationId: payload.organizationId },
        'dues.payment.recorded: no membership found for person+org — cannot update expiry',
      );
      return;
    }

    await deps.membershipRepo.updateOneById(membership.id, {
      duesExpiryDate: payload.newExpiryDate,
    } as any);

    logger.info(
      {
        membershipId: membership.id,
        newExpiryDate: payload.newExpiryDate,
        paymentId: payload.paymentId,
      },
      'Membership duesExpiryDate updated via domain event',
    );
  });

  // -----------------------------------------------------------------------
  // booking.confirmed → notify client directly (clientId in payload)
  // -----------------------------------------------------------------------
  domainEvents.on('booking.confirmed', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.clientId,
        type: 'booking.confirmed',
        channel: 'in-app',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'booking',
        relatedEntity: payload.bookingId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] booking.confirmed failed');
    }
  });

  // -----------------------------------------------------------------------
  // booking.cancelled → look up clientId from bookings table, then notify
  // -----------------------------------------------------------------------
  domainEvents.on('booking.cancelled', async (payload) => {
    try {
      const rows = await deps.db
        .select({ client: bookings.client })
        .from(bookings)
        .where(eq(bookings.id, payload.bookingId))
        .limit(1);

      const clientId = rows[0]?.client;
      if (!clientId) {
        logger.warn({ bookingId: payload.bookingId }, '[consumer] booking.cancelled: booking not found, skipping notification');
        return;
      }

      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: clientId,
        type: 'booking.cancelled',
        channel: 'in-app',
        title: 'Booking Cancelled',
        message: `Your booking has been cancelled. Reason: ${payload.reason}`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'booking',
        relatedEntity: payload.bookingId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] booking.cancelled failed');
    }
  });

  // -----------------------------------------------------------------------
  // officer.assigned → notify the person assigned to the position
  // -----------------------------------------------------------------------
  domainEvents.on('officer.assigned', async (payload) => {
    try {
      // Look up position title for a more informative notification
      const positionRows = await deps.db
        .select({ title: positions.title })
        .from(positions)
        .where(eq(positions.id, payload.positionId))
        .limit(1);

      const positionTitle = positionRows[0]?.title ?? 'an officer position';

      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: `You have been assigned as ${positionTitle}`,
        message: `Congratulations! You have been assigned to a new officer role in your organization.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'officer_term',
        relatedEntity: payload.termId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] officer.assigned failed');
    }
  });

  // -----------------------------------------------------------------------
  // officer.removed → notify the person whose term ended
  // -----------------------------------------------------------------------
  domainEvents.on('officer.removed', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Your officer term has ended',
        message: 'Your officer term has been ended. Thank you for your service.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'officer_term',
        relatedEntity: payload.termId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] officer.removed failed');
    }
  });

  // -----------------------------------------------------------------------
  // membership.created → welcome notification
  // -----------------------------------------------------------------------
  domainEvents.on('membership.created', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Welcome! Your membership is now active',
        message: 'Your membership has been created and is now active. Welcome to the organization!',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'membership',
        relatedEntity: payload.membershipId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] membership.created failed');
    }
  });

  // -----------------------------------------------------------------------
  // credit.awarded → notify member of CPD credits earned
  // -----------------------------------------------------------------------
  domainEvents.on('credit.awarded', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'CPD Credits Awarded',
        message: `You earned ${payload.creditAmount} credits for completing "${payload.activityName}".`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'training',
        relatedEntity: payload.trainingId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] credit.awarded failed');
    }
  });

  // -----------------------------------------------------------------------
  // breach.reported → notify ALL super admins (URGENT)
  // -----------------------------------------------------------------------
  domainEvents.on('breach.reported', async (payload) => {
    try {
      const superAdmins = await deps.db
        .select({ userId: platformAdmins.userId })
        .from(platformAdmins)
        .where(eq(platformAdmins.role, 'super'));

      if (superAdmins.length === 0) {
        logger.warn({ breachId: payload.breachId }, '[consumer] breach.reported: no super admins found');
        return;
      }

      const notificationRows = superAdmins.map((admin) => ({
        organizationId: payload.organizationId ?? '00000000-0000-0000-0000-000000000001',
        recipient: admin.userId,
        type: 'security' as const,
        channel: 'in-app' as const,
        title: 'URGENT: Data Breach Reported',
        message: `A data breach has been reported. Notification deadline: ${payload.notificationDeadline}. Description: ${payload.description}`,
        status: 'sent' as const,
        sentAt: new Date(),
        relatedEntityType: 'breach_incident',
        relatedEntity: payload.breachId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      }));

      await deps.db.insert(notifications).values(notificationRows);
    } catch (err) {
      logger.error({ error: err }, '[consumer] breach.reported failed');
    }
  });

  // -----------------------------------------------------------------------
  // training.cancelled → bulk async notify all enrolled members (fire-and-forget)
  // -----------------------------------------------------------------------
  domainEvents.on('training.cancelled', async (payload) => {
    (async () => {
      try {
        const enrollments = await deps.db
          .select({ personId: trainingEnrollments.personId })
          .from(trainingEnrollments)
          .where(
            and(
              eq(trainingEnrollments.trainingId, payload.trainingId),
              eq(trainingEnrollments.status, 'enrolled'),
            ),
          );

        if (enrollments.length === 0) return;

        const CHUNK_SIZE = 50;
        for (let i = 0; i < enrollments.length; i += CHUNK_SIZE) {
          const chunk = enrollments.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map((e) => ({
            organizationId: payload.organizationId,
            recipient: e.personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: 'Training Cancelled',
            message: 'A training you were enrolled in has been cancelled.',
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'training',
            relatedEntity: payload.trainingId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }));
          await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] training.cancelled bulk notify failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // election.status.changed → bulk async notify active members when voting opens
  // -----------------------------------------------------------------------
  domainEvents.on('election.status.changed', async (payload) => {
    if (payload.newStatus !== 'voting') return;

    (async () => {
      try {
        const activeMembers = await deps.db
          .select({ personId: memberships.personId })
          .from(memberships)
          .where(
            and(
              eq(memberships.organizationId, payload.organizationId),
              eq(memberships.status, 'active'),
            ),
          );

        if (activeMembers.length === 0) return;

        const CHUNK_SIZE = 100;
        for (let i = 0; i < activeMembers.length; i += CHUNK_SIZE) {
          const chunk = activeMembers.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map((m) => ({
            organizationId: payload.organizationId,
            recipient: m.personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: 'Voting is now open',
            message: 'The election has entered the voting phase. Cast your vote now.',
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'election',
            relatedEntity: payload.electionId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }));
          await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] election.status.changed bulk notify failed');
      }
    })();
  });
}
