/**
 * [BR-08] Refund Validation Rules
 *
 * Pure validation functions for refund eligibility:
 * - 30-day refund window from payment date
 * - Only un-allocated (completed) payments may be refunded
 * - Refund amount cannot exceed original payment minus already-refunded
 * - President approval required for amounts above threshold
 */

/** Maximum days after payment date within which a refund is allowed. */
export const REFUND_WINDOW_DAYS = 30;

/** Refund amounts above this threshold (in cents) require president approval. */
export const APPROVAL_THRESHOLD_CENTS = 500_000; // 5,000 PHP

export type RefundEligibility =
  | { eligible: true }
  | { eligible: false; reason: string; code: string };

export interface RefundValidationInput {
  paymentStatus: string;
  paymentPaidAt: Date | null;
  paymentAmount: number;
  alreadyRefunded: number;
  requestedRefundAmount: number | null; // null = full refund
  now?: Date; // injectable for testing
}

/**
 * Check whether a payment is eligible for refund per BR-08.
 */
export function validateRefundEligibility(input: RefundValidationInput): RefundEligibility {
  const {
    paymentStatus,
    paymentPaidAt,
    paymentAmount,
    alreadyRefunded,
    requestedRefundAmount,
    now = new Date(),
  } = input;

  // Already fully refunded
  if (paymentStatus === 'refunded') {
    return { eligible: false, reason: 'Payment already fully refunded', code: 'ALREADY_REFUNDED' };
  }

  // Only completed or partiallyRefunded payments can be refunded
  const refundableStatuses = ['completed', 'partiallyRefunded', 'confirmed'];
  if (!refundableStatuses.includes(paymentStatus)) {
    return {
      eligible: false,
      reason: `Payment status "${paymentStatus}" is not eligible for refund`,
      code: 'INVALID_STATUS',
    };
  }

  // Must have a payment date to check window
  if (!paymentPaidAt) {
    return { eligible: false, reason: 'Payment has no recorded payment date', code: 'NO_PAYMENT_DATE' };
  }

  // 30-day window check
  const daysSincePayment = Math.floor(
    (now.getTime() - paymentPaidAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSincePayment > REFUND_WINDOW_DAYS) {
    return {
      eligible: false,
      reason: `Refund window expired: ${daysSincePayment} days since payment (max ${REFUND_WINDOW_DAYS})`,
      code: 'REFUND_WINDOW_EXPIRED',
    };
  }

  // Refund amount validation
  const maxRefundable = paymentAmount - alreadyRefunded;
  const effectiveAmount = requestedRefundAmount ?? maxRefundable;

  if (effectiveAmount <= 0) {
    return { eligible: false, reason: 'Nothing left to refund', code: 'NOTHING_TO_REFUND' };
  }

  if (effectiveAmount > maxRefundable) {
    return {
      eligible: false,
      reason: `Requested refund ${effectiveAmount} exceeds refundable amount ${maxRefundable}`,
      code: 'EXCEEDS_REFUNDABLE',
    };
  }

  return { eligible: true };
}

/**
 * Check whether a refund amount requires president approval.
 */
export function requiresApproval(refundAmount: number): boolean {
  return refundAmount > APPROVAL_THRESHOLD_CENTS;
}
