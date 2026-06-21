/**
 * Domain Event Consumers
 *
 * Registers all cross-module event handlers. Called once during app startup.
 * Each consumer is a thin glue layer — heavy logic stays in repos/services.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
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
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';
import { EmailQueueRepository } from '@/handlers/email/repos/queue.repo';
import { EmailTemplateTags, SYSTEM_ORG_ID } from '@/core/email-types';

// ── person.deleted cascade — schema imports (mirror accountDeletionCascade.ts) ──
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { checkIns, waitlistEntries } from '@/handlers/association:operations/repos/events.schema';
import { courseEnrollments, quizAttempts } from '@/handlers/association:operations/repos/training.schema';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { electionNominees, electionVotes } from '@/handlers/elections/repos/elections.schema';
import { officerTerms } from '@/handlers/association:member/repos/governance.schema';
import { personSubscriptions } from '@/handlers/communication/repos/communication.schema';
import { certificates } from '@/handlers/member/certificates/repos/certificates.schema';
import { directoryProfiles } from '@/handlers/association:member/repos/directory.schema';
import { notificationPreferences } from '@/handlers/person/repos/notification-preferences.schema';
import { personPrivacySettings } from '@/handlers/person/repos/privacy-settings.schema';
import { documents } from '@/handlers/documents/repos/documents.schema';
import { dunningEvents } from '@/handlers/association:member/repos/dunning.schema';
import { digitalCredentials } from '@/handlers/association:member/repos/credentials.schema';
import { chapterAffiliations, affiliationTransfers } from '@/handlers/association:member/repos/chapters.schema';
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { merchantAccounts } from '@/handlers/billing/repos/billing.schema';
import { surveyResponses } from '@/handlers/surveys/repos/survey.schema';
import { reviews } from '@/handlers/reviews/repos/review.schema';
import { memberAdOptOuts, adReports } from '@/handlers/advertising/repos/advertising.schema';
import { chatRoomMembers, chatMessages } from '@/handlers/comms/repos/comms.schema';
import { committeeMembers } from '@/handlers/association:operations/repos/committee.schema';
import { committeeTasks } from '@/handlers/association:operations/repos/committee-task.schema';
import { createDefaultChannels, autoJoinOrgChannels } from '@/handlers/comms/default-channels';
import { mintFirstDuesInvoice } from '@/handlers/member/duesspecialassessments/firstInvoiceOnApproval';

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
  // booking.rejected → notify client directly (clientId in payload)
  // -----------------------------------------------------------------------
  domainEvents.on('booking.rejected', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId,
        recipient: payload.clientId,
        type: 'booking.rejected',
        channel: 'in-app',
        title: 'Booking Rejected',
        message: `Your booking request has been rejected by the host. Reason: ${payload.reason}`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'booking',
        relatedEntity: payload.bookingId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] booking.rejected failed');
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
  // FIX-004 (G2 / PD-1) — comms channel provisioning + member auto-join
  // -----------------------------------------------------------------------

  // organization.created → provision #general + #announcements channels so the
  // org ships with channels its members auto-belong to.
  domainEvents.on('organization.created', async (payload) => {
    try {
      await createDefaultChannels(deps.db, payload.organizationId, []);
    } catch (err) {
      logger.error({ error: err }, '[consumer] organization.created channel provisioning failed');
    }
  });

  // membership.created → auto-join the new member to the org's channels (PD-1).
  domainEvents.on('membership.created', async (payload) => {
    try {
      await autoJoinOrgChannels(deps.db, payload.organizationId, payload.personId);
    } catch (err) {
      logger.error({ error: err }, '[consumer] membership.created channel auto-join failed');
    }
  });

  // -----------------------------------------------------------------------
  // FIX-009 / Q-PD7 — membership.created → mint the member's FIRST dues invoice.
  // Approval/claim leaves a new member `pendingPayment` with no invoice, and the
  // batch generator only picks up `active` members — so without this they never
  // get a payable invoice (the join→pay→active funnel dead-ends). Idempotent per
  // (membership, period); read-only on memberships (no status change — settle
  // still flips pendingPayment→active). On success, emit dues.invoice.generated
  // so the existing consumer notifies the member of their new invoice.
  // -----------------------------------------------------------------------
  domainEvents.on('membership.created', async (payload) => {
    try {
      const result = await mintFirstDuesInvoice(
        deps.db,
        {
          membershipId: payload.membershipId,
          personId: payload.personId,
          organizationId: payload.organizationId,
        },
        logger,
      );

      if (result.created && result.invoiceId) {
        domainEvents
          .emit('dues.invoice.generated', {
            invoiceId: result.invoiceId,
            organizationId: payload.organizationId,
            personId: payload.personId,
            amount: result.amount ?? 0,
            dueDate: result.periodEnd ?? '',
          })
          .catch(() => {});
      }
    } catch (err) {
      logger.error({ error: err }, '[consumer] membership.created first-invoice failed');
    }
  });

  // membership.imported → auto-join each roster-imported member to org channels.
  domainEvents.on('membership.imported', async (payload) => {
    (async () => {
      try {
        for (const personId of payload.personIds) {
          await autoJoinOrgChannels(deps.db, payload.organizationId, personId);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] membership.imported channel auto-join failed');
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
  // ticket.reopened → alert the assigned admin that an officer reply reopened
  // a resolved support ticket (FIX-012 / G12 / PA-8). Skip when unassigned.
  // organizationId is nullable on platform-wide tickets — fall back to the
  // platform sentinel org (mirrors breach.reported).
  // -----------------------------------------------------------------------
  domainEvents.on('ticket.reopened', async (payload) => {
    try {
      if (!payload.assignedTo) {
        logger.debug({ ticketId: payload.ticketId }, '[consumer] ticket.reopened: unassigned ticket, skipping notification');
        return;
      }
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId ?? '00000000-0000-0000-0000-000000000001',
        recipient: payload.assignedTo,
        type: 'system',
        channel: 'in-app',
        title: 'Support ticket reopened',
        message: `An officer replied to a resolved ticket ("${payload.subject}"), reopening it.`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'support-ticket',
        relatedEntity: payload.ticketId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] ticket.reopened failed');
    }
  });

  // -----------------------------------------------------------------------
  // ticket.status.changed → notify the reporter (officer) that their support
  // ticket changed status (FIX-012 / G12 / PA-8 "Officer notified").
  // -----------------------------------------------------------------------
  domainEvents.on('ticket.status.changed', async (payload) => {
    try {
      await deps.db.insert(notifications).values({
        organizationId: payload.organizationId ?? '00000000-0000-0000-0000-000000000001',
        recipient: payload.reportedBy,
        type: 'system',
        channel: 'in-app',
        title: 'Support ticket update',
        message: `Your support ticket ("${payload.subject}") is now "${payload.status}".`,
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'support-ticket',
        relatedEntity: payload.ticketId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] ticket.status.changed failed');
    }
  });

  // -----------------------------------------------------------------------
  // admin.invited → queue the platform-admin invite email (FIX-003 / G4 /
  // WF-022 step 2). inviteAdmin emits this with no consumer, so invited admins
  // never learned to sign in + claim. The invitee's email is in the payload;
  // POST /platform-admin/claim binds their real userId. SYSTEM_ORG_ID scopes
  // the system-level invite template (admin.invite).
  // -----------------------------------------------------------------------
  domainEvents.on('admin.invited', async (payload) => {
    try {
      const emailRepo = new EmailQueueRepository(deps.db, logger);
      const claimUrl = `${process.env['ADMIN_APP_URL'] ?? ''}/claim`;
      await emailRepo.queueEmail({
        templateTags: [EmailTemplateTags.ADMIN_INVITE],
        recipient: payload.email,
        variables: {
          email: payload.email,
          role: payload.role,
          claimUrl,
        },
        organizationId: SYSTEM_ORG_ID,
        emailCategory: 'transactional',
        metadata: { adminId: payload.adminId },
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] admin.invited failed');
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
  // training.enrollment.cancelled → notify ONLY the affected member (FIX-003)
  // Distinct from the program-wide training.cancelled mass-notify above.
  // -----------------------------------------------------------------------
  domainEvents.on('training.enrollment.cancelled', async (payload) => {
    (async () => {
      try {
        await deps.db.insert(notifications).values({
          organizationId: payload.organizationId,
          recipient: payload.personId,
          type: 'system' as const,
          channel: 'in-app' as const,
          title: 'Training Enrollment Cancelled',
          message: 'Your enrollment in a training has been cancelled.',
          status: 'sent' as const,
          sentAt: new Date(),
          relatedEntityType: 'training',
          relatedEntity: payload.trainingId,
          consentValidated: false,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        });
      } catch (err) {
        logger.error({ error: err }, '[consumer] training.enrollment.cancelled notify failed');
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
  // compliance.recompute → refresh the compliance_standings matview off the
  // request path. Credit-write handlers (award/adjust/void) emit this instead
  // of running REFRESH MATERIALIZED VIEW CONCURRENTLY inline, which added
  // latency + a heavy lock to user-facing mutations. Eventual consistency is
  // acceptable: those handlers return the written entry directly, not a read
  // back of the view. Fire-and-forget — failure is logged, never propagated.
  // -----------------------------------------------------------------------
  domainEvents.on('compliance.recompute', async (payload) => {
    try {
      await deps.db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`);
    } catch (err) {
      logger.error(
        { error: err, organizationId: payload.organizationId, reason: payload.reason },
        '[consumer] compliance.recompute matview refresh failed',
      );
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
  //
  // FIX-010 (G12): gate on certificate existence. Issuance is manual
  // (officer-initiated bulk-issue), so a training.completed does NOT imply a
  // certificate was produced. Only notify members who actually have a
  // non-revoked certificate for this training — never claim a download exists
  // when none was issued.
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

        // FIX-010: resolve who actually has an issued (non-revoked) certificate
        // for this training. No certificate → no "available to download" notice.
        const issuedCerts = await deps.db
          .select({ personId: certificates.personId, status: certificates.status })
          .from(certificates)
          .where(
            and(
              eq(certificates.trainingId, payload.trainingId),
              eq(certificates.organizationId, payload.organizationId),
            ),
          );
        const eligible = new Set(
          issuedCerts.filter((c) => c.status !== 'revoked').map((c) => c.personId),
        );

        const recipients = enrollees.filter((e) => eligible.has(e.personId));
        if (recipients.length === 0) return;

        const CHUNK_SIZE = 100;
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
          const chunk = recipients.slice(i, i + CHUNK_SIZE);
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
  // verification.requested → audit-log public certificate verifications.
  // FIX-011 (G13): the event was emitted by verifyCertificatePublic with zero
  // consumers, so certificate verifications went unlogged (asymmetric with the
  // credential trust path). Write a tamper-evident audit_log_entry via the
  // platform AuditRepository so verification attempts are auditable.
  // -----------------------------------------------------------------------
  domainEvents.on('verification.requested', async (payload) => {
    try {
      // Resolve the owning org for tenant-scoped auditing. The public verifier
      // is anonymous; the event payload carries only the certificate number.
      const rows = await deps.db
        .select({ organizationId: certificates.organizationId })
        .from(certificates)
        .where(eq(certificates.certificateNumber, payload.credentialNumber))
        .limit(1);
      const organizationId = rows[0]?.organizationId;

      const auditRepo = new AuditRepository(deps.db, logger);
      await auditRepo.logEvent({
        eventType: 'compliance',
        category: 'association',
        action: 'read',
        outcome: payload.verified ? 'success' : 'failure',
        organizationId,
        resourceType: 'certificate',
        resource: payload.credentialNumber,
        description: `Public certificate verification for ${payload.credentialNumber}: ${payload.verified ? 'signature verified' : 'not verified'}`,
        details: { credentialNumber: payload.credentialNumber, verified: payload.verified },
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] verification.requested audit-log failed');
    }
  });

  // -----------------------------------------------------------------------
  // FIX-007 (G-07): GDPR account-lifecycle events were emitted with ZERO
  // consumers. Wire them here, reusing the raw-insert notification pattern.
  // The payloads carry only personId (no organizationId), so org context is
  // resolved from the person's active memberships (mirrors person.updated).
  // -----------------------------------------------------------------------

  // person.deletion.requested → alert active officers of the member's orgs (Spec 10b).
  domainEvents.on('person.deletion.requested', async (payload) => {
    void (async () => {
      try {
        const orgs = await deps.db
          .select({ organizationId: memberships.organizationId })
          .from(memberships)
          .where(and(eq(memberships.personId, payload.personId), eq(memberships.status, 'active')));
        for (const { organizationId } of orgs) {
          const officers = await deps.db
            .select({ personId: officerTerms.personId })
            .from(officerTerms)
            .where(and(eq(officerTerms.organizationId, organizationId), eq(officerTerms.status, 'active')));
          const rows = officers
            .filter((o) => o.personId && o.personId !== payload.personId)
            .map((o) => ({
              organizationId,
              recipient: o.personId,
              type: 'system' as const,
              channel: 'in-app' as const,
              title: 'Member requested account deletion',
              message: `A member has requested account deletion, scheduled for ${payload.scheduledDate}.`,
              status: 'sent' as const,
              sentAt: new Date(),
              relatedEntityType: 'person',
              relatedEntity: payload.personId,
              consentValidated: false,
              createdBy: SYSTEM_USER_ID,
              updatedBy: SYSTEM_USER_ID,
            }));
          if (rows.length > 0) await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] person.deletion.requested failed');
      }
    })();
  });

  // person.deletion.cancelled → tell the same officers the deletion was called off.
  domainEvents.on('person.deletion.cancelled', async (payload) => {
    void (async () => {
      try {
        const orgs = await deps.db
          .select({ organizationId: memberships.organizationId })
          .from(memberships)
          .where(and(eq(memberships.personId, payload.personId), eq(memberships.status, 'active')));
        for (const { organizationId } of orgs) {
          const officers = await deps.db
            .select({ personId: officerTerms.personId })
            .from(officerTerms)
            .where(and(eq(officerTerms.organizationId, organizationId), eq(officerTerms.status, 'active')));
          const rows = officers
            .filter((o) => o.personId && o.personId !== payload.personId)
            .map((o) => ({
              organizationId,
              recipient: o.personId,
              type: 'system' as const,
              channel: 'in-app' as const,
              title: 'Member cancelled account deletion',
              message: 'A member has cancelled their pending account deletion.',
              status: 'sent' as const,
              sentAt: new Date(),
              relatedEntityType: 'person',
              relatedEntity: payload.personId,
              consentValidated: false,
              createdBy: SYSTEM_USER_ID,
              updatedBy: SYSTEM_USER_ID,
            }));
          if (rows.length > 0) await deps.db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ error: err }, '[consumer] person.deletion.cancelled failed');
      }
    })();
  });

  // data-export.ready → notify the requester their personal-data export is ready.
  domainEvents.on('data-export.ready', async (payload) => {
    try {
      const orgs = await deps.db
        .select({ organizationId: memberships.organizationId })
        .from(memberships)
        .where(and(eq(memberships.personId, payload.personId), eq(memberships.status, 'active')))
        .limit(1);
      const organizationId = orgs[0]?.organizationId;
      // notifications.organizationId is NOT NULL — skip if the person has no org context.
      if (!organizationId) return;
      await deps.db.insert(notifications).values({
        organizationId,
        recipient: payload.personId,
        type: 'system',
        channel: 'in-app',
        title: 'Your data export is ready',
        message: 'Your personal data export is ready to download. The link expires in 7 days.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityType: 'data-export',
        relatedEntity: payload.exportId,
        consentValidated: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    } catch (err) {
      logger.error({ error: err }, '[consumer] data-export.ready failed');
    }
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
  // person.deleted → surveys: anonymize identified survey responses
  // (NULL responder_id, retain answers for aggregate integrity — BR-32).
  // The responder_id FK is onDelete:'restrict', so this MUST run before any
  // hard person delete; it also de-anonymizes identified responses so a
  // deleted member can no longer be mapped to their individual answers.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.update(surveyResponses)
        .set({ responderId: null, updatedBy: SYSTEM_USER_ID })
        .where(eq(surveyResponses.responderId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted surveys cascade failed');
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

  // -----------------------------------------------------------------------
  // person.deleted → reviews: hard-delete the member's own NPS reviews
  // (PII feedback they authored), and null out reviewedEntity where the
  // deleted person was the subject so other reviewers' rows are retained
  // without pointing at a removed person. Both columns are onDelete:'restrict',
  // so this MUST run before any hard person delete.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      // Reviews authored by the person (delete — personal feedback)
      await deps.db.delete(reviews)
        .where(eq(reviews.reviewer, personId));

      // Reviews where the person was the subject (anonymize subject reference)
      await deps.db.update(reviews)
        .set({ reviewedEntity: null, updatedBy: SYSTEM_USER_ID })
        .where(eq(reviews.reviewedEntity, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted reviews cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → advertising: hard-delete the member's ad opt-out
  // preferences and any ad reports they filed (personal rows, mirrors the
  // dunningEvents/digitalCredentials hard-delete choice).
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      await deps.db.delete(memberAdOptOuts)
        .where(eq(memberAdOptOuts.personId, personId));

      await deps.db.delete(adReports)
        .where(eq(adReports.reporterPersonId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted advertising cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → comms: delete chat-room memberships (incl. DM rooms the
  // person belonged to) and anonymize messages they authored. Memberships are
  // pure person↔room links → hard delete. Messages are immutable thread content;
  // we anonymize the sender to SYSTEM_USER_ID (retain thread integrity, sever
  // the PII link) rather than delete, which would orphan replies in the thread.
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      // Chat room memberships / DM participation (hard delete)
      await deps.db.delete(chatRoomMembers)
        .where(eq(chatRoomMembers.personId, personId));

      // Authored messages (anonymize sender — retain thread integrity)
      await deps.db.update(chatMessages)
        .set({ sender: SYSTEM_USER_ID, updatedBy: SYSTEM_USER_ID })
        .where(eq(chatMessages.sender, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted comms cascade failed');
    }
  });

  // -----------------------------------------------------------------------
  // person.deleted → committee: soft-delete the member's committee
  // memberships (mirrors chapterAffiliations soft-delete — set inactive +
  // removedAt) and unassign any committee tasks assigned to them (null the
  // assignee, retain the task for the committee).
  // -----------------------------------------------------------------------
  domainEvents.on('person.deleted', async (payload) => {
    const { personId } = payload;
    try {
      // Committee memberships (soft-delete)
      await deps.db.update(committeeMembers)
        .set({
          active: false,
          removedAt: new Date(),
          updatedBy: SYSTEM_USER_ID,
        })
        .where(eq(committeeMembers.personId, personId));

      // Committee tasks assigned to the person (unassign, retain task)
      await deps.db.update(committeeTasks)
        .set({ assigneeId: null, updatedBy: SYSTEM_USER_ID })
        .where(eq(committeeTasks.assigneeId, personId));
    } catch (err) {
      logger.error({ error: err, personId }, '[consumer] person.deleted committee cascade failed');
    }
  });
}
