/**
 * Domain Event Registry
 *
 * Type definitions for all domain events in the system.
 * Each event carries a typed payload describing what happened.
 * Add new events here as bounded contexts need cross-module communication.
 */

export interface DomainEventMap {
  'dues.payment.recorded': {
    paymentId: string;
    personId: string;
    organizationId: string;
    amount: number;
    newExpiryDate: string | null;
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
}

export type DomainEventName = keyof DomainEventMap;
