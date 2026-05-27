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
  'event.registered': {
    eventId: string;
    personId: string;
    organizationId: string;
    status: 'confirmed' | 'waitlisted';
  };

  // ── Communications Context ────────────────────────────────────────────
  'announcement.published': {
    announcementId: string;
    organizationId: string;
    publishedBy: string;
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
}

export type DomainEventName = keyof DomainEventMap;
