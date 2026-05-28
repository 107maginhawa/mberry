/**
 * Valid state transitions for all domain status enums.
 * Each map defines allowed from→to transitions. Terminal states have empty arrays.
 */

import { ConflictError } from '@/core/errors';

// Booking event status (bookingEventStatusEnum: draft, active, paused, archived)
export const BOOKING_EVENT_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],  // terminal
};

// Email queue status (emailQueueStatusEnum: pending, processing, sent, failed, cancelled)
export const EMAIL_QUEUE_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['sent', 'failed'],
  sent: [],      // terminal
  failed: ['pending'],  // retry
  cancelled: [],  // terminal
};

// Feed post status (feedPostStatusEnum: published, draft, flagged, removed)
export const FEED_POST_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['flagged', 'removed'],
  flagged: ['published', 'removed'],  // officer can restore or remove
  removed: [],   // terminal
};

export function isValidTransition(
  transitions: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

/**
 * Assert a state transition is valid — throws ConflictError (409) if not.
 * @param transitions - valid transition map
 * @param from - current status
 * @param to - desired status
 * @param entityName - human-readable name for error messages (e.g., "membership", "election")
 */
export function assertValidTransition(
  transitions: Record<string, string[]>,
  from: string,
  to: string,
  entityName: string,
): void {
  if (isValidTransition(transitions, from, to)) return;
  const allowed = transitions[from];
  const allowedStr = allowed === undefined
    ? 'unknown status'
    : allowed.length === 0
      ? 'none (terminal state)'
      : allowed.join(', ');
  throw new ConflictError(
    `Cannot transition ${entityName} from '${from}' to '${to}'. Allowed: ${allowedStr}`
  );
}

// ─── Membership ─────────────────────────────────────────────────────

export const MEMBERSHIP_VALID_TRANSITIONS: Record<string, string[]> = {
  pendingPayment: ['active', 'removed'],
  active: ['gracePeriod', 'suspended', 'removed'],
  gracePeriod: ['active', 'suspended', 'removed'],
  suspended: ['active', 'removed'],
  removed: [],  // terminal
};

// ─── Dues Payments (centralized — replaces per-repo copy) ───────────

export const DUES_PAYMENT_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['completed', 'failed', 'expired'],
  submitted: ['underReview', 'confirmed', 'rejected'],
  underReview: ['confirmed', 'rejected'],
  confirmed: ['completed', 'refunded', 'partiallyRefunded'],
  completed: ['refunded', 'partiallyRefunded'],
  partiallyRefunded: ['refunded'],
  failed: ['pending'],       // retry
  rejected: ['pending'],     // resubmit
  refunded: [],              // terminal
  expired: [],               // terminal
};

// ─── Elections ──────────────────────────────────────────────────────

export const ELECTION_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['nominationsOpen', 'cancelled'],
  nominationsOpen: ['votingOpen', 'cancelled'],
  votingOpen: ['awaitingConfirmation', 'cancelled'],
  awaitingConfirmation: ['published', 'cancelled'],
  published: [],   // terminal
  cancelled: [],   // terminal
};

// ─── Marketplace ────────────────────────────────────────────────────

export const MARKETPLACE_VENDOR_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['verified', 'rejected'],
  verified: ['suspended'],
  suspended: ['verified'],
  rejected: [],  // terminal
};

export const MARKETPLACE_LISTING_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['archived'],
  archived: [],  // terminal
};

export const MARKETPLACE_ORDER_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['fulfilled', 'cancelled'],
  fulfilled: ['refunded'],
  cancelled: [],  // terminal
  refunded: [],   // terminal
};

// ─── Training ───────────────────────────────────────────────────────

export const TRAINING_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'cancelled'],
  published: ['completed', 'cancelled'],
  completed: [],   // terminal
  cancelled: [],   // terminal
};

export const TRAINING_ENROLLMENT_VALID_TRANSITIONS: Record<string, string[]> = {
  enrolled: ['completed', 'cancelled', 'noShow'],
  completed: [],   // terminal
  cancelled: [],   // terminal
  noShow: [],      // terminal
};
