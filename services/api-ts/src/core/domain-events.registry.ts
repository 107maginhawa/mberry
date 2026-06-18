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

  // Emitted by handlers/person/executeAccountDeletion.ts after grace-period PII
  // scrub. Distinct from 'person.deleted' (which drives the destructive cascade
  // via executeCascadeDeletion, already run earlier in that handler) — re-using
  // 'person.deleted' here would double-fire the cascade. Fire-and-forget
  // audit/extension hook; consumer is optional.
  'person.anonymized': {
    personId: string;
  };

  'person.deletion.requested': {
    personId: string;
    scheduledDate: string;
  };

  'person.deletion.cancelled': {
    personId: string;
  };

  'person.deleted': {
    personId: string;
    scheduledAt: string;
  };

  'data-export.ready': {
    personId: string;
    exportId: string;
    downloadUrl: string;
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

  'membership.imported': {
    organizationId: string;
    importedBy: string;
    importedCount: number;
    personIds: string[];
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

  'dues.payment.refunded': {
    paymentId: string;
    personId: string;
    organizationId: string;
    refundAmount: number;
    isFullRefund: boolean;
  };

  'dues.invoice.generated': {
    invoiceId: string;
    organizationId: string;
    personId: string;
    amount: number;
    dueDate: string;
  };

  'dues.payment.proof.rejected': {
    paymentId: string;
    personId: string;
    organizationId: string;
    reason: string;
  };

  'credit.awarded': {
    personId: string;
    organizationId: string;
    trainingId?: string;
    creditEntryId?: string;
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

  // Enrollment-scoped: ONE member's enrollment was cancelled. Distinct from
  // the program-wide `training.cancelled` so it does NOT mass-notify every
  // enrollee that the whole training is cancelled (FIX-003 / G6).
  'training.enrollment.cancelled': {
    enrollmentId: string;
    trainingId: string;
    organizationId: string;
    personId: string;
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

  // Compliance standings matview needs a refresh because a credit-write path
  // (manual award / officer adjustment / void) changed the underlying data.
  // Deferred off the request path — eventual consistency is acceptable.
  'compliance.recompute': {
    organizationId: string;
    reason: 'manual_award' | 'adjustment' | 'void';
  };

  // ── Governance Context ────────────────────────────────────────────────
  'org.settings.updated': {
    organizationId: string;
    updatedBy: string;
    updatedFields: string[];
  };

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

  'election.published': {
    electionId: string;
    organizationId: string;
    publishedBy: string;
    winners: { positionId: string; winnerId: string }[];
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

  // FIX-012 (G12 / PA-8): an officer reply reopens a resolved ticket (alerts
  // the assignee); an admin status change notifies the reporter. Consumers in
  // domain-event-consumers.ts turn these into in-app notifications.
  'ticket.reopened': {
    ticketId: string;
    organizationId: string | null;
    assignedTo: string | null;
    reopenedBy: string;
    subject: string;
  };

  'ticket.status.changed': {
    ticketId: string;
    organizationId: string | null;
    reportedBy: string;
    status: string;
    subject: string;
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

  // ── Documents / Credentials Context (M11) ─────────────────────────────
  'document.created': {
    documentId: string;
    organizationId: string;
    ownerId: string;
    ownerType: string;
    createdBy: string;
    isNewVersion: boolean;
  };

  'credential.generated': {
    credentialId: string;
    credentialNumber: string;
    personId: string;
    credentialType: 'certificate' | 'idCard';
    generatedBy: string;
  };

  'verification.requested': {
    credentialNumber: string;
    verified: boolean;
  };

  // ── National Dashboard Context (M14) ──────────────────────────────────
  'dashboard.exported': {
    exportId: string;
    associationId: string;
    format: string;
    exportedBy: string;
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

  // ── Onboarding Context ────────────────────────────────────────────────
  'onboarding.completed': {
    organizationId: string;
    officerId: string;
  };

  // ── Platform Admin Context (M03) ──────────────────────────────────────
  'association.created': {
    associationId: string;
    name: string;
  };

  'organization.created': {
    organizationId: string;
    associationId: string;
    name: string;
  };

  'org.status.transitioned': {
    organizationId: string;
    fromStatus: string;
    toStatus: string;
  };

  'feature_flag.changed': {
    targetType: string;
    targetId: string;
    moduleName: string;
    enabled: boolean;
  };

  'impersonation.started': {
    sessionId: string;
    adminId: string;
    targetUserId: string;
  };

  'impersonation.ended': {
    sessionId: string;
    adminId: string;
    targetUserId: string;
  };

  'admin.invited': {
    adminId: string;
    email: string;
    role: string;
  };

  // FIX-003 (G4): emitted by claimAdminInvite when an invited admin binds their
  // real Better-Auth userId to the placeholder row, so the bind is auditable.
  'admin.invite.claimed': {
    adminId: string;
    userId: string;
    email: string;
    role: string;
  };
}

export type DomainEventName = keyof DomainEventMap;
