import { describe, it, expect } from 'bun:test';
import {
  INVOICE_VALID_TRANSITIONS,
  PAYMENT_VALID_TRANSITIONS,
  isValidInvoiceTransition,
  isValidPaymentTransition,
  invoiceTransitionError,
  paymentTransitionError,
} from './status-transitions';

// ---------------------------------------------------------------------------
// Invoice transition matrix
// ---------------------------------------------------------------------------

const INVOICE_STATUSES = ['generated', 'sent', 'paid', 'overdue', 'cancelled', 'writtenOff'] as const;

describe('isValidInvoiceTransition', () => {
  describe('valid transitions', () => {
    it('generated → sent', () => expect(isValidInvoiceTransition('generated', 'sent')).toBe(true));
    it('generated → cancelled', () => expect(isValidInvoiceTransition('generated', 'cancelled')).toBe(true));

    it('sent → paid', () => expect(isValidInvoiceTransition('sent', 'paid')).toBe(true));
    it('sent → overdue', () => expect(isValidInvoiceTransition('sent', 'overdue')).toBe(true));
    it('sent → cancelled', () => expect(isValidInvoiceTransition('sent', 'cancelled')).toBe(true));

    it('overdue → paid', () => expect(isValidInvoiceTransition('overdue', 'paid')).toBe(true));
    it('overdue → cancelled', () => expect(isValidInvoiceTransition('overdue', 'cancelled')).toBe(true));
    it('overdue → writtenOff', () => expect(isValidInvoiceTransition('overdue', 'writtenOff')).toBe(true));
  });

  describe('terminal states — no outgoing transitions', () => {
    for (const terminal of ['paid', 'cancelled', 'writtenOff'] as const) {
      for (const target of INVOICE_STATUSES) {
        it(`${terminal} → ${target} is false`, () =>
          expect(isValidInvoiceTransition(terminal, target)).toBe(false));
      }
    }
  });

  describe('invalid transitions (non-terminal sources)', () => {
    // generated cannot skip ahead or go backwards
    it('generated → paid (skip)', () => expect(isValidInvoiceTransition('generated', 'paid')).toBe(false));
    it('generated → overdue (skip)', () => expect(isValidInvoiceTransition('generated', 'overdue')).toBe(false));
    it('generated → writtenOff (skip)', () => expect(isValidInvoiceTransition('generated', 'writtenOff')).toBe(false));

    // sent cannot jump to writtenOff directly
    it('sent → writtenOff (skip)', () => expect(isValidInvoiceTransition('sent', 'writtenOff')).toBe(false));
    // sent cannot self-transition
    it('sent → generated (backwards)', () => expect(isValidInvoiceTransition('sent', 'generated')).toBe(false));
    it('sent → sent (self)', () => expect(isValidInvoiceTransition('sent', 'sent')).toBe(false));

    // overdue cannot go to sent (backwards)
    it('overdue → generated (backwards)', () => expect(isValidInvoiceTransition('overdue', 'generated')).toBe(false));
    it('overdue → sent (backwards)', () => expect(isValidInvoiceTransition('overdue', 'sent')).toBe(false));
    it('overdue → overdue (self)', () => expect(isValidInvoiceTransition('overdue', 'overdue')).toBe(false));
  });

  describe('unknown status', () => {
    it('unknown from returns false', () => expect(isValidInvoiceTransition('bogus', 'sent')).toBe(false));
    it('unknown to returns false', () => expect(isValidInvoiceTransition('generated', 'bogus')).toBe(false));
    it('both unknown returns false', () => expect(isValidInvoiceTransition('foo', 'bar')).toBe(false));
    it('empty string returns false', () => expect(isValidInvoiceTransition('', 'sent')).toBe(false));
  });
});

// ---------------------------------------------------------------------------
// Payment transition matrix
// ---------------------------------------------------------------------------

const PAYMENT_STATUSES = [
  'pending', 'submitted', 'underReview', 'confirmed', 'completed',
  'refunded', 'partiallyRefunded', 'failed', 'rejected', 'expired',
] as const;

describe('isValidPaymentTransition', () => {
  describe('valid transitions', () => {
    it('pending → submitted', () => expect(isValidPaymentTransition('pending', 'submitted')).toBe(true));
    it('pending → expired', () => expect(isValidPaymentTransition('pending', 'expired')).toBe(true));
    it('pending → cancelled', () => expect(isValidPaymentTransition('pending', 'cancelled')).toBe(true));

    it('submitted → underReview', () => expect(isValidPaymentTransition('submitted', 'underReview')).toBe(true));
    it('submitted → confirmed', () => expect(isValidPaymentTransition('submitted', 'confirmed')).toBe(true));
    it('submitted → rejected', () => expect(isValidPaymentTransition('submitted', 'rejected')).toBe(true));

    it('underReview → confirmed', () => expect(isValidPaymentTransition('underReview', 'confirmed')).toBe(true));
    it('underReview → rejected', () => expect(isValidPaymentTransition('underReview', 'rejected')).toBe(true));

    it('confirmed → completed', () => expect(isValidPaymentTransition('confirmed', 'completed')).toBe(true));

    it('completed → refunded', () => expect(isValidPaymentTransition('completed', 'refunded')).toBe(true));
    it('completed → partiallyRefunded', () => expect(isValidPaymentTransition('completed', 'partiallyRefunded')).toBe(true));

    it('partiallyRefunded → refunded', () => expect(isValidPaymentTransition('partiallyRefunded', 'refunded')).toBe(true));
  });

  describe('terminal states — no outgoing transitions', () => {
    for (const terminal of ['refunded', 'failed', 'rejected', 'expired'] as const) {
      for (const target of PAYMENT_STATUSES) {
        it(`${terminal} → ${target} is false`, () =>
          expect(isValidPaymentTransition(terminal, target)).toBe(false));
      }
    }
  });

  describe('invalid transitions (non-terminal sources)', () => {
    // pending cannot skip
    it('pending → confirmed (skip)', () => expect(isValidPaymentTransition('pending', 'confirmed')).toBe(false));
    it('pending → completed (skip)', () => expect(isValidPaymentTransition('pending', 'completed')).toBe(false));
    it('pending → refunded (skip)', () => expect(isValidPaymentTransition('pending', 'refunded')).toBe(false));
    it('pending → rejected (skip)', () => expect(isValidPaymentTransition('pending', 'rejected')).toBe(false));
    it('pending → underReview (skip)', () => expect(isValidPaymentTransition('pending', 'underReview')).toBe(false));
    it('pending → partiallyRefunded (skip)', () => expect(isValidPaymentTransition('pending', 'partiallyRefunded')).toBe(false));
    it('pending → pending (self)', () => expect(isValidPaymentTransition('pending', 'pending')).toBe(false));

    // submitted cannot skip ahead to completed/refunded
    it('submitted → completed (skip)', () => expect(isValidPaymentTransition('submitted', 'completed')).toBe(false));
    it('submitted → refunded (skip)', () => expect(isValidPaymentTransition('submitted', 'refunded')).toBe(false));
    it('submitted → pending (backwards)', () => expect(isValidPaymentTransition('submitted', 'pending')).toBe(false));
    it('submitted → submitted (self)', () => expect(isValidPaymentTransition('submitted', 'submitted')).toBe(false));
    it('submitted → expired (skip)', () => expect(isValidPaymentTransition('submitted', 'expired')).toBe(false));

    // underReview cannot go backwards or skip
    it('underReview → pending (backwards)', () => expect(isValidPaymentTransition('underReview', 'pending')).toBe(false));
    it('underReview → submitted (backwards)', () => expect(isValidPaymentTransition('underReview', 'submitted')).toBe(false));
    it('underReview → completed (skip)', () => expect(isValidPaymentTransition('underReview', 'completed')).toBe(false));
    it('underReview → refunded (skip)', () => expect(isValidPaymentTransition('underReview', 'refunded')).toBe(false));
    it('underReview → underReview (self)', () => expect(isValidPaymentTransition('underReview', 'underReview')).toBe(false));

    // confirmed cannot skip or go backwards
    it('confirmed → pending (backwards)', () => expect(isValidPaymentTransition('confirmed', 'pending')).toBe(false));
    it('confirmed → submitted (backwards)', () => expect(isValidPaymentTransition('confirmed', 'submitted')).toBe(false));
    it('confirmed → underReview (backwards)', () => expect(isValidPaymentTransition('confirmed', 'underReview')).toBe(false));
    it('confirmed → refunded (skip)', () => expect(isValidPaymentTransition('confirmed', 'refunded')).toBe(false));
    it('confirmed → rejected (skip)', () => expect(isValidPaymentTransition('confirmed', 'rejected')).toBe(false));
    it('confirmed → confirmed (self)', () => expect(isValidPaymentTransition('confirmed', 'confirmed')).toBe(false));

    // completed cannot go backwards
    it('completed → pending (backwards)', () => expect(isValidPaymentTransition('completed', 'pending')).toBe(false));
    it('completed → confirmed (backwards)', () => expect(isValidPaymentTransition('completed', 'confirmed')).toBe(false));
    it('completed → completed (self)', () => expect(isValidPaymentTransition('completed', 'completed')).toBe(false));
    it('completed → rejected (invalid)', () => expect(isValidPaymentTransition('completed', 'rejected')).toBe(false));
    it('completed → expired (invalid)', () => expect(isValidPaymentTransition('completed', 'expired')).toBe(false));

    // partiallyRefunded cannot go anywhere except refunded (already tested as valid)
    it('partiallyRefunded → pending (invalid)', () => expect(isValidPaymentTransition('partiallyRefunded', 'pending')).toBe(false));
    it('partiallyRefunded → completed (backwards)', () => expect(isValidPaymentTransition('partiallyRefunded', 'completed')).toBe(false));
    it('partiallyRefunded → partiallyRefunded (self)', () => expect(isValidPaymentTransition('partiallyRefunded', 'partiallyRefunded')).toBe(false));
    it('partiallyRefunded → rejected (invalid)', () => expect(isValidPaymentTransition('partiallyRefunded', 'rejected')).toBe(false));
  });

  describe('unknown status', () => {
    it('unknown from returns false', () => expect(isValidPaymentTransition('bogus', 'confirmed')).toBe(false));
    it('unknown to returns false', () => expect(isValidPaymentTransition('pending', 'bogus')).toBe(false));
    it('both unknown returns false', () => expect(isValidPaymentTransition('foo', 'bar')).toBe(false));
    it('empty string returns false', () => expect(isValidPaymentTransition('', 'completed')).toBe(false));
  });
});

// ---------------------------------------------------------------------------
// Error message helpers
// ---------------------------------------------------------------------------

describe('invoiceTransitionError', () => {
  it('includes from and to in message', () => {
    const msg = invoiceTransitionError('generated', 'paid');
    expect(msg).toContain('generated');
    expect(msg).toContain('paid');
  });

  it('lists allowed transitions', () => {
    const msg = invoiceTransitionError('generated', 'paid');
    expect(msg).toContain('sent');
    expect(msg).toContain('cancelled');
  });

  it('says "terminal state" for terminal status', () => {
    const msg = invoiceTransitionError('paid', 'generated');
    expect(msg).toContain('terminal');
  });

  it('handles unknown from status', () => {
    const msg = invoiceTransitionError('bogus', 'sent');
    expect(msg).toContain('bogus');
  });
});

describe('paymentTransitionError', () => {
  it('includes from and to in message', () => {
    const msg = paymentTransitionError('pending', 'refunded');
    expect(msg).toContain('pending');
    expect(msg).toContain('refunded');
  });

  it('lists allowed transitions', () => {
    const msg = paymentTransitionError('pending', 'refunded');
    expect(msg).toContain('submitted');
  });

  it('says "terminal state" for terminal status', () => {
    const msg = paymentTransitionError('refunded', 'pending');
    expect(msg).toContain('terminal');
  });

  it('handles unknown from status', () => {
    const msg = paymentTransitionError('bogus', 'completed');
    expect(msg).toContain('bogus');
  });
});

// ---------------------------------------------------------------------------
// Sanity-check the exported maps are well-formed
// ---------------------------------------------------------------------------

describe('INVOICE_VALID_TRANSITIONS map integrity', () => {
  it('covers all 6 invoice statuses', () => {
    expect(Object.keys(INVOICE_VALID_TRANSITIONS)).toHaveLength(6);
  });

  it('all target statuses are known invoice statuses', () => {
    const known = new Set(INVOICE_STATUSES);
    for (const [, targets] of Object.entries(INVOICE_VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t as typeof INVOICE_STATUSES[number])).toBe(true);
      }
    }
  });
});

describe('PAYMENT_VALID_TRANSITIONS map integrity', () => {
  it('covers all 10 payment statuses', () => {
    expect(Object.keys(PAYMENT_VALID_TRANSITIONS)).toHaveLength(10);
  });

  it('all target statuses are known payment statuses (or "cancelled")', () => {
    const known = new Set([...PAYMENT_STATUSES, 'cancelled']);
    for (const [, targets] of Object.entries(PAYMENT_VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t)).toBe(true);
      }
    }
  });
});
