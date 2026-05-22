/**
 * Valid state transitions for dues invoices and payments.
 * Terminal states have empty arrays — no further transitions allowed.
 *
 * Invoice statuses: generated | sent | paid | overdue | cancelled | writtenOff
 * Payment statuses: pending | submitted | underReview | confirmed | completed |
 *                   refunded | partiallyRefunded | failed | rejected | expired
 */

export const INVOICE_VALID_TRANSITIONS: Record<string, string[]> = {
  generated: ['sent', 'cancelled'],
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
