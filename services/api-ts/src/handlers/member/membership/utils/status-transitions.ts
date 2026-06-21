/**
 * Valid state transitions for dues invoices and payments.
 * Terminal states have empty arrays — no further transitions allowed.
 *
 * Invoice statuses: generated | sent | paid | overdue | cancelled | writtenOff
 * Payment statuses: pending | submitted | underReview | confirmed | completed |
 *                   refunded | partiallyRefunded | failed | rejected | expired
 */

export const INVOICE_VALID_TRANSITIONS: Record<string, string[]> = {
  // 'generated' invoices are member-visible and directly payable — submitPaymentProof
  // accepts payableStatuses ['generated','sent','overdue'], so confirming a proof on a
  // 'generated' invoice must be able to mark it paid (there is no mandatory 'send' step
  // for dues). Without 'paid' here, a member can submit a proof the officer can never
  // confirm (409 generated→paid). Caught by dues-payment-proof-lifecycle e2e.
  generated: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled', 'writtenOff'],
  paid: [],           // terminal
  cancelled: [],      // terminal
  writtenOff: [],     // terminal
};

export const PAYMENT_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['submitted', 'expired', 'cancelled'],
  submitted: ['underReview', 'confirmed', 'rejected'],
  underReview: ['confirmed', 'rejected'],
  confirmed: ['completed'],
  completed: ['refunded', 'partiallyRefunded'],
  refunded: [],            // terminal
  partiallyRefunded: ['refunded'],
  failed: [],              // terminal
  rejected: [],            // terminal
  expired: [],             // terminal
  cancelled: [],           // terminal
};

export function isValidInvoiceTransition(from: string, to: string): boolean {
  return INVOICE_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidPaymentTransition(from: string, to: string): boolean {
  return PAYMENT_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns a human-readable error message for an invalid invoice transition.
 */
export function invoiceTransitionError(from: string, to: string): string {
  const allowed = INVOICE_VALID_TRANSITIONS[from];
  if (allowed === undefined) {
    return `Unknown invoice status '${from}'`;
  }
  const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
  return `Cannot transition invoice from '${from}' to '${to}'. Allowed: ${allowedStr}`;
}

/**
 * Returns a human-readable error message for an invalid payment transition.
 */
export function paymentTransitionError(from: string, to: string): string {
  const allowed = PAYMENT_VALID_TRANSITIONS[from];
  if (allowed === undefined) {
    return `Unknown payment status '${from}'`;
  }
  const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
  return `Cannot transition payment from '${from}' to '${to}'. Allowed: ${allowedStr}`;
}

// ---------------------------------------------------------------------------
// Membership status transitions
// ---------------------------------------------------------------------------

/**
 * Valid state transitions for membership status.
 *
 * Membership statuses: pendingPayment | active | gracePeriod | lapsed |
 *                      expired | suspended | removed | resigned | deceased | expelled
 *
 * Notes (decided semantics — AHA membership-lifecycle E2, 2026-06-12):
 * - pendingPayment → active is the approval path
 * - active → gracePeriod and gracePeriod → lapsed are automatic (computed from dues_expiry_date)
 * - lapsed → active happens via payment recording (BR-07) or officer reinstate;
 *   `reinstateMembership` is LAPSED-ONLY (decision #1)
 * - active/gracePeriod/lapsed → suspended is `suspendMembership`; suspended → active
 *   is `unsuspendMembership` (NOT reinstate)
 * - removed/resigned/deceased/expelled are terminal + irreversible; re-entry after a
 *   terminal state goes through re-application (approve flow), not a transition back
 * - `expired` is retained in the enum/table but is NOT produced by any V1 op
 *   (decision #3: EXPIRED is dropped from V1 vocabulary — no threshold or job ships)
 */
export const MEMBERSHIP_VALID_TRANSITIONS: Record<string, string[]> = {
  pendingPayment: ['active', 'removed', 'expired'],
  active: ['gracePeriod', 'suspended', 'removed', 'resigned', 'deceased', 'expelled'],
  gracePeriod: ['active', 'lapsed', 'suspended', 'removed', 'resigned', 'deceased', 'expelled'],
  lapsed: ['active', 'suspended', 'removed', 'resigned', 'deceased', 'expelled'],
  expired: ['active', 'removed'],
  suspended: ['active', 'removed', 'resigned', 'expelled'],
  removed: [],      // terminal
  resigned: [],     // terminal
  deceased: [],     // terminal
  expelled: [],     // terminal
};

export function isValidMembershipTransition(from: string, to: string): boolean {
  return MEMBERSHIP_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function membershipTransitionError(from: string, to: string): string {
  const allowed = MEMBERSHIP_VALID_TRANSITIONS[from];
  if (allowed === undefined) {
    return `Unknown membership status '${from}'`;
  }
  const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
  return `Cannot transition membership from '${from}' to '${to}'. Allowed: ${allowedStr}`;
}

// ---------------------------------------------------------------------------
// License status transitions
// ---------------------------------------------------------------------------

/**
 * Valid state transitions for professional license/credential status.
 *
 * License statuses: pending | active | expired | suspended | revoked
 */
export const LICENSE_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'revoked'],
  active: ['expired', 'suspended', 'revoked'],
  expired: ['active', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],  // terminal
};

export function isValidLicenseTransition(from: string, to: string): boolean {
  return LICENSE_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function licenseTransitionError(from: string, to: string): string {
  const allowed = LICENSE_VALID_TRANSITIONS[from];
  if (allowed === undefined) {
    return `Unknown license status '${from}'`;
  }
  const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
  return `Cannot transition license from '${from}' to '${to}'. Allowed: ${allowedStr}`;
}

// ---------------------------------------------------------------------------
// Officer term status transitions
// ---------------------------------------------------------------------------

/**
 * Valid state transitions for officer term status.
 *
 * Term statuses: upcoming | active | completed | resigned | removed
 */
export const TERM_VALID_TRANSITIONS: Record<string, string[]> = {
  upcoming: ['active', 'removed'],
  active: ['completed', 'resigned', 'removed'],
  completed: [],   // terminal
  resigned: [],    // terminal
  removed: [],     // terminal
};

export function isValidTermTransition(from: string, to: string): boolean {
  return TERM_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function termTransitionError(from: string, to: string): string {
  const allowed = TERM_VALID_TRANSITIONS[from];
  if (allowed === undefined) {
    return `Unknown term status '${from}'`;
  }
  const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
  return `Cannot transition term from '${from}' to '${to}'. Allowed: ${allowedStr}`;
}
