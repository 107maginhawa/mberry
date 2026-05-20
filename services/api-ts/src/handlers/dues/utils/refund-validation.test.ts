import { describe, test, expect } from 'bun:test';
import {
  validateRefundEligibility,
  requiresApproval,
  REFUND_WINDOW_DAYS,
  APPROVAL_THRESHOLD_CENTS,
} from './refund-validation';

// ─── Fixtures ───────────────────────────────────────────

const NOW = new Date('2026-06-15T12:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

const baseInput = {
  paymentStatus: 'completed' as string,
  paymentPaidAt: daysAgo(5) as Date | null,
  paymentAmount: 5000,
  alreadyRefunded: 0,
  requestedRefundAmount: null as number | null,
  now: NOW,
};

// ─── BR-08: 30-day refund window ────────────────────────

describe('[BR-08] validateRefundEligibility — 30-day window', () => {
  test('allows refund within 30-day window', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentPaidAt: daysAgo(10) });
    expect(result.eligible).toBe(true);
  });

  test('allows refund on exactly day 30', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentPaidAt: daysAgo(30) });
    expect(result.eligible).toBe(true);
  });

  test('rejects refund on day 31', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentPaidAt: daysAgo(31) });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('REFUND_WINDOW_EXPIRED');
    }
  });

  test('rejects refund on day 60', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentPaidAt: daysAgo(60) });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('REFUND_WINDOW_EXPIRED');
    }
  });

  test('rejects refund when no payment date', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentPaidAt: null });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('NO_PAYMENT_DATE');
    }
  });
});

// ─── BR-08: Status eligibility ──────────────────────────

describe('[BR-08] validateRefundEligibility — payment status', () => {
  test('allows refund for completed payment', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentStatus: 'completed' });
    expect(result.eligible).toBe(true);
  });

  test('allows refund for partiallyRefunded payment', () => {
    const result = validateRefundEligibility({
      ...baseInput,
      paymentStatus: 'partiallyRefunded',
      alreadyRefunded: 2000,
      requestedRefundAmount: 3000,
    });
    expect(result.eligible).toBe(true);
  });

  test('allows refund for confirmed payment', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentStatus: 'confirmed' });
    expect(result.eligible).toBe(true);
  });

  test('rejects refund for already-refunded payment', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentStatus: 'refunded' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('ALREADY_REFUNDED');
    }
  });

  test('rejects refund for pending payment', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentStatus: 'pending' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('INVALID_STATUS');
    }
  });

  test('rejects refund for failed payment', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentStatus: 'failed' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('INVALID_STATUS');
    }
  });

  test('rejects refund for expired payment', () => {
    const result = validateRefundEligibility({ ...baseInput, paymentStatus: 'expired' });
    expect(result.eligible).toBe(false);
  });
});

// ─── Refund amount validation ───────────────────────────

describe('[BR-08] validateRefundEligibility — amount checks', () => {
  test('full refund (null amount) uses remaining refundable', () => {
    const result = validateRefundEligibility({
      ...baseInput,
      requestedRefundAmount: null,
    });
    expect(result.eligible).toBe(true);
  });

  test('partial refund within bounds succeeds', () => {
    const result = validateRefundEligibility({
      ...baseInput,
      requestedRefundAmount: 2500,
    });
    expect(result.eligible).toBe(true);
  });

  test('refund exceeding remaining amount fails', () => {
    const result = validateRefundEligibility({
      ...baseInput,
      paymentAmount: 5000,
      alreadyRefunded: 3000,
      requestedRefundAmount: 3000,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('EXCEEDS_REFUNDABLE');
    }
  });

  test('nothing left to refund when fully refunded amount', () => {
    const result = validateRefundEligibility({
      ...baseInput,
      paymentAmount: 5000,
      alreadyRefunded: 5000,
      requestedRefundAmount: null,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('NOTHING_TO_REFUND');
    }
  });

  test('zero requested amount fails', () => {
    const result = validateRefundEligibility({
      ...baseInput,
      requestedRefundAmount: 0,
    });
    expect(result.eligible).toBe(false);
  });
});

// ─── Approval threshold ─────────────────────────────────

describe('[BR-08] requiresApproval — president approval threshold', () => {
  test('below threshold does not require approval', () => {
    expect(requiresApproval(APPROVAL_THRESHOLD_CENTS - 1)).toBe(false);
  });

  test('at threshold does not require approval', () => {
    expect(requiresApproval(APPROVAL_THRESHOLD_CENTS)).toBe(false);
  });

  test('above threshold requires approval', () => {
    expect(requiresApproval(APPROVAL_THRESHOLD_CENTS + 1)).toBe(true);
  });

  test('REFUND_WINDOW_DAYS is 30', () => {
    expect(REFUND_WINDOW_DAYS).toBe(30);
  });
});
