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
import {
  notifications,
  bookings,
  platformAdmins,
  trainingEnrollments,
  trainings,
  memberships,
  positions,
  events,
  eventRegistrations,
  invitationTokens,
} from './schema-registry';
import {
  OfficerTermRepository,
  TransitionChecklistRepository,
} from '@/handlers/association:member/repos/governance.repo';

// ── person.deleted cascade — schema imports (mirror accountDeletionCascade.ts) ──
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { checkIns, waitlistEntries } from '@/handlers/association:operations/repos/events.schema';
import { courseEnrollments, quizAttempts } from '@/handlers/association:operations/repos/training.schema';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { electionNominees, electionVotes } from '@/handlers/elections/repos/elections.schema';
import { officerTerms } from '@/handlers/association:member/repos/governance.schema';
import { personSubscriptions } from '@/handlers/communication/repos/communication.schema';
import { certificates } from '@/handlers/certificates/repos/certificates.schema';
import { directoryProfiles } from '@/handlers/association:member/repos/directory.schema';
import { notificationPreferences } from '@/handlers/person/repos/notification-preferences.schema';
import { personPrivacySettings } from '@/handlers/person/repos/privacy-settings.schema';
import { documents } from '@/handlers/documents/repos/documents.schema';
import { dunningEvents } from '@/handlers/association:member/repos/dunning.schema';
import { digitalCredentials } from '@/handlers/association:member/repos/credentials.schema';
import { chapterAffiliations, affiliationTransfers } from '@/handlers/association:member/repos/chapters.schema';
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { merchantAccounts } from '@/handlers/billing/repos/billing.schema';

const ELECTION_TRANSITION_CHECKLIST_ITEMS = [
  'Hand over account credentials and passwords',
  'Transfer financial records and bank access',
  'Provide status update on ongoing projects',
  'Update official contact information',
  'Brief incoming officer on pending matters',
];

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
  // dues.payment.refunded → notify member of the refund
  // (expiry already reset inside the refund transaction — notification only)
  // -----------------------------------------------------------------------
  domainEvents.on('dues.payment.refunded', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: payload.isFullRefund ? 'Your dues payment was refunded' : 'Your dues payment was partially refunded',
        message: `A refund of ${payload.refundAmount} has been processed for your dues payment.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'dues-payment',
        relatedEntity: payload.paymentId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] dues.payment.refunded failed');
    }
  });

  // -----------------------------------------------------------------------
  // dues.invoice.generated → notify member they have a new dues invoice
  // -----------------------------------------------------------------------
  domainEvents.on('dues.invoice.generated', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'New dues invoice',
        message: `You have a new dues invoice of ${payload.amount} due by ${payload.dueDate}.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'dues-invoice',
        relatedEntity: payload.invoiceId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] dues.invoice.generated failed');
    }
  });

  // -----------------------------------------------------------------------
  // dues.payment.proof.rejected → notify member to resubmit proof
  // -----------------------------------------------------------------------
  domainEvents.on('dues.payment.proof.rejected', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Payment proof rejected',
        message: `Your payment proof was rejected: ${payload.reason}. Please resubmit.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'dues-payment',
        relatedEntity: payload.paymentId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] dues.payment.proof.rejected failed');
    }
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
  // membership.imported → welcome each roster-imported member (bulk async)
  // -----------------------------------------------------------------------
  domainEvents.on('membership.imported', async (payload) => {
    (async () => {
      try {
        if (payload.personIds.length === 0) return;

        const CHUNK_SIZE = 100;
        for (let i = 0; i < payload.personIds.length; i += CHUNK_SIZE) {
          const chunk = payload.personIds.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map((personId) => ({
            organizationId: payload.organizationId,
            recipient: personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: 'Welcome to the organization',
            message: 'Your membership has been added to the organization via roster import.',
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'membership',
            relatedEntity: payload.organizationId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }));
          await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] membership.imported bulk welcome failed');
      }
    })();
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
        relatedEntityType: payload.trainingId ? 'training' : 'credit-entry',
        relatedEntity: payload.trainingId ?? payload.creditEntryId,
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

  // -----------------------------------------------------------------------
  // event.published → bulk async notify all active members (internal events only)
  // -----------------------------------------------------------------------
  domainEvents.on('event.published', async (payload) => {
    (async () => {
      try {
        const eventRows = await deps.db
          .select({ title: events.title, visibility: events.visibility })
          .from(events)
          .where(eq(events.id, payload.eventId))
          .limit(1);

        const event = eventRows[0];
        if (!event) {
          logger.warn({ eventId: payload.eventId }, '[consumer] event.published: event not found, skipping notification');
          return;
        }

        // Only notify for internal events
        if (event.visibility !== 'internal') return;

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
            title: `New Event: ${event.title}`,
            message: 'A new event has been published for your organization.',
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'event',
            relatedEntity: payload.eventId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }));
          await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] event.published bulk notify failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // event.completed → bulk async notify all confirmed registrants
  // -----------------------------------------------------------------------
  domainEvents.on('event.completed', async (payload) => {
    (async () => {
      try {
        const registrants = await deps.db
          .select({ personId: eventRegistrations.personId })
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, payload.eventId),
              eq(eventRegistrations.status, 'confirmed'),
            ),
          );

        if (registrants.length === 0) return;

        const CHUNK_SIZE = 100;
        for (let i = 0; i < registrants.length; i += CHUNK_SIZE) {
          const chunk = registrants.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map((r) => ({
            organizationId: payload.organizationId,
            recipient: r.personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: 'Event Completed',
            message: 'An event you attended has been marked as completed.',
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'event',
            relatedEntity: payload.eventId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }));
          await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] event.completed bulk notify failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // event.cancelled → bulk async notify all confirmed registrants (M8-R3)
  // -----------------------------------------------------------------------
  domainEvents.on('event.cancelled', async (payload) => {
    (async () => {
      try {
        const registrants = await deps.db
          .select({ personId: eventRegistrations.personId })
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, payload.eventId),
              eq(eventRegistrations.status, 'confirmed'),
            ),
          );

        if (registrants.length === 0) return;

        const CHUNK_SIZE = 100;
        for (let i = 0; i < registrants.length; i += CHUNK_SIZE) {
          const chunk = registrants.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map((r) => ({
            organizationId: payload.organizationId,
            recipient: r.personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: 'Event Cancelled',
            message: 'An event you registered for has been cancelled.',
            status: 'sent' as const,
            sentAt: new Date(),
            relatedEntityType: 'event',
            relatedEntity: payload.eventId,
            consentValidated: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          }));
          await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] event.cancelled bulk notify failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // event.registered → notify the registrant directly
  // -----------------------------------------------------------------------
  domainEvents.on('event.registered', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Registration Confirmed',
        message: 'Your registration for the event has been confirmed.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'event',
        relatedEntity: payload.eventId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] event.registered failed');
    }
  });

  // -----------------------------------------------------------------------
  // training.published → bulk async notify all active members
  // -----------------------------------------------------------------------
  domainEvents.on('training.published', async (payload) => {
    (async () => {
      try {
        const trainingRows = await deps.db
          .select({ title: trainings.title })
          .from(trainings)
          .where(eq(trainings.id, payload.trainingId))
          .limit(1);

        const trainingTitle = trainingRows[0]?.title ?? 'New Training';

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
            title: `New Training Available: ${trainingTitle}`,
            message: 'A new training has been published for your organization.',
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
        logger.error({ error: err }, '[consumer] training.published bulk notify failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // officer.transitioned → notify the incoming officer (successorPersonId)
  // -----------------------------------------------------------------------
  domainEvents.on('officer.transitioned', async (payload) => {
    try {
      const positionRows = await deps.db
        .select({ title: positions.title })
        .from(positions)
        .where(eq(positions.id, payload.positionId))
        .limit(1);

      const positionTitle = positionRows[0]?.title ?? 'the position';

      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.successorPersonId,
        type: 'system',
        channel: 'in-app',
        title: `Officer Transition: You are the new ${positionTitle}`,
        message: `You have been transitioned into the role of ${positionTitle}. Welcome to your new position.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'officer_term',
        relatedEntity: payload.newTermId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] officer.transitioned failed');
    }
  });

  // -----------------------------------------------------------------------
  // election.created → bulk async notify all active members
  // -----------------------------------------------------------------------
  domainEvents.on('election.created', async (payload) => {
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
            title: 'New Election Created',
            message: 'A new election has been created in your organization.',
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
        logger.error({ error: err }, '[consumer] election.created bulk notify failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // nomination.submitted → notify the nominee
  // -----------------------------------------------------------------------
  domainEvents.on('nomination.submitted', async (payload) => {
    try {
      const positionRows = await deps.db
        .select({ title: positions.title })
        .from(positions)
        .where(eq(positions.id, payload.positionId))
        .limit(1);

      const positionTitle = positionRows[0]?.title ?? 'a position';

      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.nomineeId,
        type: 'system',
        channel: 'in-app',
        title: `You have been nominated for ${positionTitle}`,
        message: `You have been nominated for the position of ${positionTitle} in an upcoming election.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'election',
        relatedEntity: payload.electionId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] nomination.submitted failed');
    }
  });

  // -----------------------------------------------------------------------
  // member.suspended → notify the suspended member
  // -----------------------------------------------------------------------
  domainEvents.on('member.suspended', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Membership Suspended',
        message: `Your membership has been suspended. Reason: ${payload.actionType}.${payload.expiresAt ? ` Suspension expires: ${payload.expiresAt}.` : ''}`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'membership',
        relatedEntity: payload.disciplinaryActionId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] member.suspended failed');
    }
  });

  // -----------------------------------------------------------------------
  // member.removed → notify the removed member
  // -----------------------------------------------------------------------
  domainEvents.on('member.removed', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Membership Removed',
        message: 'Your membership has been removed from the organization.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'membership',
        relatedEntity: payload.disciplinaryActionId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] member.removed failed');
    }
  });

  // -----------------------------------------------------------------------
  // credit.adjusted → notify the member of the manual credit adjustment
  // -----------------------------------------------------------------------
  domainEvents.on('credit.adjusted', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'CPD Credit Adjustment',
        message: `${payload.creditAmount} credits have been adjusted on your account. Reason: ${payload.reason}.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'training',
        relatedEntity: payload.creditEntryId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] credit.adjusted failed');
    }
  });

  // -----------------------------------------------------------------------
  // invite.claimed → notify the officer who sent the invite
  // -----------------------------------------------------------------------
  domainEvents.on('invite.claimed', async (payload) => {
    try {
      const inviteRows = await deps.db
        .select({ createdByOfficer: invitationTokens.createdByOfficer })
        .from(invitationTokens)
        .where(eq(invitationTokens.id, payload.inviteId))
        .limit(1);

      const officerId = inviteRows[0]?.createdByOfficer;
      if (!officerId) {
        logger.warn({ inviteId: payload.inviteId }, '[consumer] invite.claimed: invite not found or no officer, skipping notification');
        return;
      }

      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: officerId,
        type: 'system',
        channel: 'in-app',
        title: 'Invitation Accepted',
        message: 'A member has joined via your invitation.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'invite',
        relatedEntity: payload.inviteId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] invite.claimed failed');
    }
  });

  // -----------------------------------------------------------------------
  // election.published → M04 officer transition
  // End outgoing terms, generate transition checklists, create new terms
  // for winners, and emit officer.transitioned / officer.assigned.
  // -----------------------------------------------------------------------
  domainEvents.on('election.published', async (payload) => {
    try {
      const termRepo = new OfficerTermRepository(deps.db);
      const checklistRepo = new TransitionChecklistRepository(deps.db);

      for (const winner of payload.winners) {
        const outgoing = await termRepo.findActiveByPosition(winner.positionId);

        if (outgoing) {
          await termRepo.update(outgoing.id, {
            status: 'completed',
            endDate: new Date(),
          });
          for (const item of ELECTION_TRANSITION_CHECKLIST_ITEMS) {
            await checklistRepo.create({
              officerTermId: outgoing.id,
              organizationId: payload.organizationId,
              item,
              status: 'pending',
            });
          }
        }

        const newTerm = await termRepo.create({
          positionId: winner.positionId,
          personId: winner.winnerId,
          organizationId: payload.organizationId,
          status: 'active',
          startDate: new Date(),
          notes: `Elected via election ${payload.electionId}`,
        });

        if (outgoing) {
          domainEvents.emit('officer.transitioned', {
            outgoingTermId: outgoing.id,
            newTermId: newTerm.id,
            outgoingPersonId: outgoing.personId,
            successorPersonId: winner.winnerId,
            positionId: winner.positionId,
            organizationId: payload.organizationId,
            transitionedBy: payload.publishedBy,
          }).catch(() => {});
        } else {
          domainEvents.emit('officer.assigned', {
            termId: newTerm.id,
            personId: winner.winnerId,
            positionId: winner.positionId,
            organizationId: payload.organizationId,
            assignedBy: payload.publishedBy,
          }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ error: err }, '[consumer] election.published failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.updated → ID cards are generated on-the-fly, so an identity change
  // implicitly refreshes them. Notify the member (per active membership) when
  // identity-relevant fields change so they can re-download an updated card.
  // (EM-M11-e2f45a01 / BR-19 auto-regenerate ID card)
  // -----------------------------------------------------------------------
  const ID_CARD_FIELDS = new Set(['firstName', 'lastName', 'licenseNumber', 'photoUrl', 'suffix']);
  domainEvents.on('person.updated', async (payload) => {
    if (!payload.updatedFields.some((f) => ID_CARD_FIELDS.has(f))) return;

    (async () => {
      try {
        const orgs = await deps.db
          .select({ organizationId: memberships.organizationId })
          .from(memberships)
          .where(
            and(
              eq(memberships.personId, payload.personId),
              eq(memberships.status, 'active'),
            ),
          );

        if (orgs.length === 0) return;

        const rows = orgs.map((o) => ({
          organizationId: o.organizationId,
          recipient: payload.personId,
          type: 'system' as const,
          channel: 'in-app' as const,
          title: 'Member ID Card Updated',
          message: 'Your profile changed — your digital member ID card now reflects the latest details.',
          status: 'sent' as const,
          sentAt: new Date(),
          relatedEntityType: 'person',
          relatedEntity: payload.personId,
          consentValidated: false,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        }));
        await deps.db.insert(notifications).values(rows);
      } catch (err) {
        logger.error({ error: err }, '[consumer] person.updated id-card refresh failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // membership.status.changed → notify member that their ID card reflects
  // the new membership status. (EM-M11-e2f45a01)
  // -----------------------------------------------------------------------
  domainEvents.on('membership.status.changed', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Member ID Card Updated',
        message: `Your membership status is now "${payload.newStatus}". Your digital member ID card has been updated.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'membership',
        relatedEntity: payload.membershipId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] membership.status.changed id-card refresh failed');
    }
  });

  // -----------------------------------------------------------------------
  // training.completed → make certificate available: notify enrolled members
  // that their certificate can now be downloaded. (EM-M11-e2f45a01)
  // -----------------------------------------------------------------------
  domainEvents.on('training.completed', async (payload) => {
    (async () => {
      try {
        const enrollees = await deps.db
          .select({ personId: trainingEnrollments.personId })
          .from(trainingEnrollments)
          .where(
            and(
              eq(trainingEnrollments.trainingId, payload.trainingId),
              inArray(trainingEnrollments.status, ['enrolled', 'completed']),
            ),
          );

        if (enrollees.length === 0) return;

        const CHUNK_SIZE = 100;
        for (let i = 0; i < enrollees.length; i += CHUNK_SIZE) {
          const chunk = enrollees.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map((e) => ({
            organizationId: payload.organizationId,
            recipient: e.personId,
            type: 'system' as const,
            channel: 'in-app' as const,
            title: 'Certificate Available',
            message: 'Your certificate for a completed training is now available to download.',
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
        logger.error({ error: err }, '[consumer] training.completed certificate-available failed');
      }
    })();
  });

  // -----------------------------------------------------------------------
  // person.deleted → association:member: soft-delete / anonymize 10 tables
  // (memberships, membershipStatusHistory, creditEntries, officerTerms,
  //  directoryProfiles, dunningEvents, digitalCredentials, chapterAffiliations,
  //  affiliationTransfers, duesPayments — BR-32 preserves dues amounts).
  // Mirrors CASCADE_STEPS steps 1, 4, 6, 9, 13, 14, 15, 16 + BR-32 dues.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      // Memberships (soft-delete)
      await deps.db.update(memberships)
        .set({
          status: 'removed',
          removedAt: new Date(),
          removalReason: 'Account deletion — DPA 2012',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(memberships.personId, personId));

      // Membership status history (anonymize)
      await deps.db.update(membershipStatusHistory)
        .set({
          reason: 'Account deleted',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(membershipStatusHistory.personId, personId));

      // Credit entries (anonymize)
      await deps.db.update(creditEntries)
        .set({
          activityName: 'DELETED',
          provider: null,
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(creditEntries.personId, personId));

      // Officer terms (soft-delete)
      await deps.db.update(officerTerms)
        .set({
          status: 'completed',
          endDate: new Date(),
          notes: 'Term ended — account deletion',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(officerTerms.personId, personId));

      // Directory profiles (delete)
      await deps.db.delete(directoryProfiles)
        .where(eq(directoryProfiles.personId, personId));

      // Dunning events (delete)
      await deps.db.delete(dunningEvents)
        .where(eq(dunningEvents.personId, personId));

      // Digital credentials (delete)
      await deps.db.delete(digitalCredentials)
        .where(eq(digitalCredentials.personId, personId));

      // Chapter affiliations (soft-delete)
      await deps.db.update(chapterAffiliations)
        .set({
          status: 'withdrawn',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(chapterAffiliations.personId, personId));

      // Affiliation transfers (soft-delete)
      await deps.db.update(affiliationTransfers)
        .set({
          status: 'cancelled',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(affiliationTransfers.personId, personId));

      // Dues payments (anonymize proof — BR-32 preserve amounts)
      await deps.db.update(duesPayments)
        .set({
          proofStorageKey: null,
          proofFileName: null,
          proofMimeType: null,
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(duesPayments.personId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted association:member cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → association:operations: events + training cascade
  // (eventRegistrations, checkIns, waitlistEntries, trainingEnrollments,
  //  courseEnrollments, quizAttempts). Mirrors CASCADE_STEPS steps 2 + 3.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      // Event registrations (soft-delete)
      await deps.db.update(eventRegistrations)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(eventRegistrations.personId, personId));

      // Check-ins (delete)
      await deps.db.delete(checkIns)
        .where(eq(checkIns.personId, personId));

      // Waitlist entries (delete)
      await deps.db.delete(waitlistEntries)
        .where(eq(waitlistEntries.personId, personId));

      // Training enrollments (soft-delete)
      await deps.db.update(trainingEnrollments)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(trainingEnrollments.personId, personId));

      // Course enrollments (soft-delete)
      await deps.db.update(courseEnrollments)
        .set({
          status: 'cancelled',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(courseEnrollments.personId, personId));

      // Quiz attempts (delete)
      await deps.db.delete(quizAttempts)
        .where(eq(quizAttempts.personId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted association:operations cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → elections: anonymize nominees, delete votes
  // Mirrors CASCADE_STEPS step 5.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.update(electionNominees)
        .set({
          status: 'declined',
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(electionNominees.personId, personId));

      // Secret ballot — delete votes by voterId
      await deps.db.delete(electionVotes)
        .where(eq(electionVotes.voterId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted elections cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → certificates: mark updatedBy=system (records retained
  // for compliance, PII anonymized at person table). Mirrors step 8.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.update(certificates)
        .set({ updatedBy: SYSTEM_USER_ID })
        .where(eq(certificates.personId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted certificates cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → communication: delete personSubscriptions
  // Mirrors CASCADE_STEPS step 7.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.delete(personSubscriptions)
        .where(eq(personSubscriptions.personId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted communication cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → documents: delete documents owned by the person
  // Mirrors CASCADE_STEPS step 12.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.delete(documents)
        .where(eq(documents.ownerId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted documents cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → invite: delete invitation tokens
  // Mirrors CASCADE_STEPS step 17.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.delete(invitationTokens)
        .where(eq(invitationTokens.personId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted invite cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → billing: deactivate merchant accounts (BR-32 preserves
  // invoices). Mirrors CASCADE_STEPS billing step.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.update(merchantAccounts)
        .set({
          active: false,
          metadata: { deletedAccount: true },
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(merchantAccounts.person, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted billing cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → person: delete notification preferences + privacy settings
  // Mirrors CASCADE_STEPS steps 10 + 11.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.delete(notificationPreferences)
        .where(eq(notificationPreferences.personId, personId));

      await deps.db.delete(personPrivacySettings)
        .where(eq(personPrivacySettings.personId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted person preferences cascade failed');
    }
  });
}
