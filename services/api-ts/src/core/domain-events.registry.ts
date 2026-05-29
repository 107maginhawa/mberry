/**
 * Domain Event Registry
 *
 * Type definitions for all domain events in the system.
 * Each event carries a typed payload describing what happened.
 * Add new events here as bounded contexts need cross-module communication.
 */

export interface DomainEventMap {
  // ── Identity Context ──────────────────────────────────────────────────
  'person.created': {
    personId: string;
    createdBy: string;
  };

  'person.updated': {
    personId: string;
    updatedBy: string;
    updatedFields: string[];
  };

  // ── Membership Context ────────────────────────────────────────────────
  'membership.created': {
    membershipId: string;
    personId: string;
    organizationId: string;
    source: 'application' | 'invite' | 'manual';
  };

  'membership.status.changed': {
    membershipId: string;
    personId: string;
    organizationId: string;
    oldStatus: string;
    newStatus: string;
  };

  'invite.claimed': {
    inviteId: string;
    personId: string;
    organizationId: string;
    membershipId: string;
  };

  // ── Financial Context ─────────────────────────────────────────────────
  'dues.payment.recorded': {
    paymentId: string;
    personId: string;
    organizationId: string;
    amount: number;
    newExpiryDate: string | null;
  };

  'credit.awarded': {
    personId: string;
    organizationId: string;
    trainingId: string;
    creditAmount: number;
    activityName: string;
  };

  // ── Booking Context ───────────────────────────────────────────────────
  'booking.created': {
    bookingId: string;
    clientId: string;
    slotId: string;
    organizationId: string;
  };

  'booking.confirmed': {
    bookingId: string;
    hostId: string;
    clientId: string;
    organizationId: string;
  };

  'booking.rejected': {
    bookingId: string;
    hostId: string;
    clientId: string;
    organizationId: string;
    reason: string;
  };

  'booking.cancelled': {
    bookingId: string;
    cancelledBy: 'host' | 'client';
    organizationId: string;
    reason: string;
  };

  // ── Activities Context ────────────────────────────────────────────────
  'event.published': {
    eventId: string;
    organizationId: string;
    publishedBy: string;
  };

  'event.completed': {
    eventId: string;
    organizationId: string;
    completedBy: string;
  };

  'event.cancelled': {
    eventId: string;
    organizationId: string;
    cancelledBy: string;
  };

  'event.registered': {
    eventId: string;
    personId: string;
    organizationId: string;
    status: 'confirmed' | 'waitlisted';
  };

  'event.registration.cancelled': {
    registrationId: string;
    eventId: string;
    personId: string;
    organizationId: string;
    cancelledBy?: string;
    hadPayment?: boolean;
  };

  // ── Communications Context ────────────────────────────────────────────
  'message.created': {
    messageId: string;
    organizationId: string;
    createdBy: string;
    channel: string;
    recipientCount: number;
  };

  'message.sent': {
    messageId: string;
    organizationId: string;
    sentBy: string;
    channel: string;
    recipientCount: number;
  };

  'message.scheduled': {
    messageId: string;
    organizationId: string;
    scheduledBy: string;
    scheduledAt: string;
  };

  'message.cancelled': {
    messageId: string;
    organizationId: string;
    cancelledBy: string;
    previousStatus: string;
  };

  'announcement.created': {
    announcementId: string;
    organizationId: string;
    createdBy: string;
    title: string;
  };

  'announcement.published': {
    announcementId: string;
    organizationId: string;
    publishedBy: string;
  };

  'announcement.scheduled': {
    announcementId: string;
    organizationId: string;
    scheduledBy: string;
    scheduledAt: string;
  };

  // ── Training Context ──────────────────────────────────────────────────
  'training.published': {
    trainingId: string;
    organizationId: string;
    publishedBy: string;
  };

  'training.completed': {
    trainingId: string;
    organizationId: string;
    completedBy: string;
  };

  'training.cancelled': {
    trainingId: string;
    organizationId: string;
    cancelledBy: string;
  };

  // ── Financial Context (Credits) ───────────────────────────────────────
  'credit.adjusted': {
    creditEntryId: string;
    personId: string;
    organizationId: string;
    adjustedBy: string;
    creditAmount: number;
    reason: string;
  };

  // ── Governance Context ────────────────────────────────────────────────
  'officer.assigned': {
    termId: string;
    personId: string;
    positionId: string;
    organizationId: string;
    assignedBy: string;
  };

  'officer.removed': {
    termId: string;
    personId: string;
    positionId: string;
    organizationId: string;
    removedBy: string;
  };

  'officer.transitioned': {
    outgoingTermId: string;
    newTermId: string;
    outgoingPersonId: string;
    successorPersonId: string;
    positionId: string;
    organizationId: string;
    transitionedBy: string;
  };

  'member.suspended': {
    disciplinaryActionId: string;
    personId: string;
    organizationId: string;
    actionType: string;
    issuedBy: string;
    expiresAt: string | null;
  };

  'member.removed': {
    disciplinaryActionId: string;
    personId: string;
    organizationId: string;
    issuedBy: string;
  };

  'election.created': {
    electionId: string;
    organizationId: string;
    createdBy: string;
  };

  'election.deleted': {
    electionId: string;
    organizationId: string;
    deletedBy: string;
  };

  'election.status.changed': {
    electionId: string;
    organizationId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
  };

  'nomination.submitted': {
    nomineeId: string;
    electionId: string;
    personId: string;
    positionId: string;
    organizationId: string;
  };

  // ── Support Ticket Context ────────────────────────────────────────────
  'ticket.created': {
    ticketId: string;
    organizationId: string | null;
    reportedBy: string;
    priority: string;
    subject: string;
  };

  'ticket.escalated': {
    ticketId: string;
    reason: string;
    escalatedTo: string;
  };

  // ── Compliance Context ────────────────────────────────────────────────
  'breach.reported': {
    breachId: string;
    organizationId: string | null;
    reportedBy: string;
    discoveredAt: string;
    notificationDeadline: string;
    description: string;
  };

  // ── Subscription Context (UJ-M03) ─────────────────────────────────────
  'subscription.created': {
    subscriptionId: string;
    organizationId: string;
    tierId: string;
    status: string;
  };

  'subscription.upgraded': {
    subscriptionId: string;
    organizationId: string;
    fromTierId: string;
    toTierId: string;
  };

  'subscription.cancelled': {
    subscriptionId: string;
    organizationId: string;
    reason: string;
  };

  'subscription.payment_failed': {
    subscriptionId: string;
    organizationId: string;
  };
}

export type DomainEventName = keyof DomainEventMap;
