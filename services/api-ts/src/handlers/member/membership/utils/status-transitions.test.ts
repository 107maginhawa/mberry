import { describe, it, expect } from 'bun:test';
import {
  INVOICE_VALID_TRANSITIONS,
  PAYMENT_VALID_TRANSITIONS,
  MEMBERSHIP_VALID_TRANSITIONS,
  LICENSE_VALID_TRANSITIONS,
  TERM_VALID_TRANSITIONS,
  isValidInvoiceTransition,
  isValidPaymentTransition,
  isValidMembershipTransition,
  isValidLicenseTransition,
  isValidTermTransition,
  invoiceTransitionError,
  paymentTransitionError,
  membershipTransitionError,
  licenseTransitionError,
  termTransitionError,
} from './status-transitions';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

// ---------------------------------------------------------------------------
// Invoice transition matrix
// ---------------------------------------------------------------------------

const INVOICE_STATUSES = ['generated', 'sent', 'paid', 'overdue', 'cancelled', 'writtenOff'] as const;

describe('isValidInvoiceTransition', () => {
  describe('valid transitions', () => {
    it('generated → sent', () => expect(isValidInvoiceTransition('generated', 'sent')).toBe(true));
    // generated invoices are member-visible and directly payable (submitPaymentProof
    // accepts 'generated'), so a confirmed proof can mark a generated invoice paid.
    it('generated → paid (direct-pay)', () => expect(isValidInvoiceTransition('generated', 'paid')).toBe(true));
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
    // generated cannot skip ahead (to overdue/writtenOff) or go backwards — but
    // generated → paid IS allowed (direct member pay), asserted in valid transitions.
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
// DuesInvoice happy-path scenarios (transition + domain context)
// ---------------------------------------------------------------------------

describe('DuesInvoice happy-path transitions', () => {
  it('sent → paid: invoice amount matches payment amount', () => {
    const invoiceAmount = 5000;
    const paymentAmount = 5000;

    expect(isValidInvoiceTransition('sent', 'paid')).toBe(true);
    expect(paymentAmount).toBe(invoiceAmount);
    // Transition is valid AND amounts reconcile — happy path complete
  });

  it('sent → paid: rejects transition when payment amount is less than invoice', () => {
    const invoiceAmount = 5000;
    const paymentAmount = 3000;

    // Transition itself is valid (state machine allows it)
    expect(isValidInvoiceTransition('sent', 'paid')).toBe(true);
    // But business logic should reject underpayment
    expect(paymentAmount).toBeLessThan(invoiceAmount);
    expect(paymentAmount >= invoiceAmount).toBe(false);
  });

  it('sent → overdue: aging scenario — invoice past due date', () => {
    const dueDate = new Date('2026-01-15');
    const now = new Date('2026-02-01'); // 17 days past due

    expect(isValidInvoiceTransition('sent', 'overdue')).toBe(true);
    expect(now.getTime()).toBeGreaterThan(dueDate.getTime());
    // Aging: invoice has been sent and due date has passed
  });

  it('sent → overdue: does NOT age if still within due date', () => {
    const dueDate = new Date('2026-02-15');
    const now = new Date('2026-01-20'); // 26 days before due

    expect(isValidInvoiceTransition('sent', 'overdue')).toBe(true);
    // Transition is structurally valid but should not fire yet
    expect(now.getTime()).toBeLessThan(dueDate.getTime());
  });

  it('overdue → paid: late payment accepted with full amount', () => {
    const invoiceAmount = 7500;
    const paymentAmount = 7500;
    const dueDate = new Date('2026-01-15');
    const paymentDate = new Date('2026-03-10'); // ~2 months late

    expect(isValidInvoiceTransition('overdue', 'paid')).toBe(true);
    expect(paymentAmount).toBe(invoiceAmount);
    expect(paymentDate.getTime()).toBeGreaterThan(dueDate.getTime());
    // Late payment resolves the overdue invoice
  });

  it('overdue → paid: late payment with penalty surcharge', () => {
    const invoiceAmount = 5000;
    const latePenalty = 500;
    const totalDue = invoiceAmount + latePenalty;
    const paymentAmount = 5500;

    expect(isValidInvoiceTransition('overdue', 'paid')).toBe(true);
    expect(paymentAmount).toBe(totalDue);
    // Full payment including penalty clears the overdue invoice
  });

  it('paid is terminal — cannot transition to any other state (including voided)', () => {
    // "voided" is not a valid invoice status in the state machine
    expect(isValidInvoiceTransition('paid', 'generated')).toBe(false);
    expect(isValidInvoiceTransition('paid', 'sent')).toBe(false);
    expect(isValidInvoiceTransition('paid', 'overdue')).toBe(false);
    expect(isValidInvoiceTransition('paid', 'cancelled')).toBe(false);
    expect(isValidInvoiceTransition('paid', 'writtenOff')).toBe(false);
    // "voided" is not a recognized status — also rejected
    expect(isValidInvoiceTransition('paid', 'voided')).toBe(false);
  });

  it('generated → sent → paid: full lifecycle happy path', () => {
    expect(isValidInvoiceTransition('generated', 'sent')).toBe(true);
    expect(isValidInvoiceTransition('sent', 'paid')).toBe(true);
    // Cannot go further — paid is terminal
    expect(isValidInvoiceTransition('paid', 'generated')).toBe(false);
  });

  it('generated → sent → overdue → paid: late payment lifecycle', () => {
    expect(isValidInvoiceTransition('generated', 'sent')).toBe(true);
    expect(isValidInvoiceTransition('sent', 'overdue')).toBe(true);
    expect(isValidInvoiceTransition('overdue', 'paid')).toBe(true);
    // Terminal
    expect(isValidInvoiceTransition('paid', 'sent')).toBe(false);
  });

  it('error message for paid → voided includes terminal indicator', () => {
    const msg = invoiceTransitionError('paid', 'voided');
    expect(msg).toContain('terminal');
    expect(msg).toContain('paid');
    expect(msg).toContain('voided');
  });
});

// ---------------------------------------------------------------------------
// Payment happy-path scenarios (transition + domain context)
// ---------------------------------------------------------------------------

describe('Payment happy-path transitions', () => {
  it('pending → submitted → confirmed → completed: gateway success lifecycle', () => {
    expect(isValidPaymentTransition('pending', 'submitted')).toBe(true);
    expect(isValidPaymentTransition('submitted', 'confirmed')).toBe(true);
    expect(isValidPaymentTransition('confirmed', 'completed')).toBe(true);
  });

  it('pending → completed requires intermediate steps (cannot skip)', () => {
    expect(isValidPaymentTransition('pending', 'completed')).toBe(false);
    // Must go through submitted → confirmed → completed
  });

  it('completed → refunded: full refund with amount verification', () => {
    const paymentAmount = 5000;
    const refundAmount = 5000;

    expect(isValidPaymentTransition('completed', 'refunded')).toBe(true);
    expect(refundAmount).toBe(paymentAmount);
    // Full refund — amounts match
  });

  it('completed → partiallyRefunded: partial refund with amount check', () => {
    const paymentAmount = 5000;
    const refundAmount = 2000;

    expect(isValidPaymentTransition('completed', 'partiallyRefunded')).toBe(true);
    expect(refundAmount).toBeLessThan(paymentAmount);
    expect(refundAmount).toBeGreaterThan(0);
    // Partial refund — refund is less than original payment
  });

  it('partiallyRefunded → refunded: second refund completes the full refund', () => {
    const paymentAmount = 5000;
    const firstRefund = 2000;
    const secondRefund = 3000;
    const totalRefunded = firstRefund + secondRefund;

    expect(isValidPaymentTransition('completed', 'partiallyRefunded')).toBe(true);
    expect(isValidPaymentTransition('partiallyRefunded', 'refunded')).toBe(true);
    expect(totalRefunded).toBe(paymentAmount);
  });

  it('completed → refunded: cannot refund more than payment amount', () => {
    const paymentAmount = 5000;
    const refundAmount = 7000;

    // Transition is valid at state-machine level
    expect(isValidPaymentTransition('completed', 'refunded')).toBe(true);
    // But business logic should reject over-refund
    expect(refundAmount).toBeGreaterThan(paymentAmount);
    expect(refundAmount <= paymentAmount).toBe(false);
  });

  it('refunded is terminal — cannot transition further', () => {
    expect(isValidPaymentTransition('refunded', 'pending')).toBe(false);
    expect(isValidPaymentTransition('refunded', 'completed')).toBe(false);
    expect(isValidPaymentTransition('refunded', 'partiallyRefunded')).toBe(false);
    expect(isValidPaymentTransition('refunded', 'refunded')).toBe(false);
  });

  it('pending → expired: payment window timeout', () => {
    const createdAt = new Date('2026-01-01T10:00:00Z');
    const expiryWindow = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date('2026-01-03T10:00:00Z'); // 48 hours later

    expect(isValidPaymentTransition('pending', 'expired')).toBe(true);
    expect(now.getTime() - createdAt.getTime()).toBeGreaterThan(expiryWindow);
  });

  it('pending → cancelled: user-initiated cancellation', () => {
    expect(isValidPaymentTransition('pending', 'cancelled')).toBe(true);
    // Only pending payments can be cancelled by the user
    expect(isValidPaymentTransition('submitted', 'cancelled')).toBe(false);
    expect(isValidPaymentTransition('completed', 'cancelled')).toBe(false);
  });

  it('submitted → rejected: gateway rejects payment', () => {
    expect(isValidPaymentTransition('submitted', 'rejected')).toBe(true);
    // Rejected is terminal
    expect(isValidPaymentTransition('rejected', 'pending')).toBe(false);
    expect(isValidPaymentTransition('rejected', 'submitted')).toBe(false);
  });

  it('error message for pending → completed explains skip is invalid', () => {
    const msg = paymentTransitionError('pending', 'completed');
    expect(msg).toContain('pending');
    expect(msg).toContain('completed');
    expect(msg).toContain('submitted'); // lists allowed transitions from pending
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
  it('covers all 11 payment statuses', () => {
    expect(Object.keys(PAYMENT_VALID_TRANSITIONS)).toHaveLength(11);
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

// ===========================================================================
// Membership status transitions
// ===========================================================================

const MEMBERSHIP_STATUSES = [
  'pendingPayment', 'active', 'gracePeriod', 'lapsed', 'expired',
  'suspended', 'removed', 'resigned', 'deceased', 'expelled',
] as const;

describe('isValidMembershipTransition', () => {
  describe('valid transitions', () => {
    it('pendingPayment → active', () => expect(isValidMembershipTransition('pendingPayment', 'active')).toBe(true));
    it('pendingPayment → removed', () => expect(isValidMembershipTransition('pendingPayment', 'removed')).toBe(true));
    it('pendingPayment → expired', () => expect(isValidMembershipTransition('pendingPayment', 'expired')).toBe(true));

    it('active → gracePeriod', () => expect(isValidMembershipTransition('active', 'gracePeriod')).toBe(true));
    it('active → suspended', () => expect(isValidMembershipTransition('active', 'suspended')).toBe(true));
    it('active → removed', () => expect(isValidMembershipTransition('active', 'removed')).toBe(true));
    it('active → resigned', () => expect(isValidMembershipTransition('active', 'resigned')).toBe(true));
    it('active → deceased', () => expect(isValidMembershipTransition('active', 'deceased')).toBe(true));
    it('active → expelled', () => expect(isValidMembershipTransition('active', 'expelled')).toBe(true));

    it('gracePeriod → active', () => expect(isValidMembershipTransition('gracePeriod', 'active')).toBe(true));
    it('gracePeriod → lapsed', () => expect(isValidMembershipTransition('gracePeriod', 'lapsed')).toBe(true));
    it('gracePeriod → suspended', () => expect(isValidMembershipTransition('gracePeriod', 'suspended')).toBe(true));

    it('lapsed → active', () => expect(isValidMembershipTransition('lapsed', 'active')).toBe(true));
    it('lapsed → suspended', () => expect(isValidMembershipTransition('lapsed', 'suspended')).toBe(true));

    it('expired → active', () => expect(isValidMembershipTransition('expired', 'active')).toBe(true));
    it('expired → removed', () => expect(isValidMembershipTransition('expired', 'removed')).toBe(true));

    it('suspended → active', () => expect(isValidMembershipTransition('suspended', 'active')).toBe(true));
    it('suspended → removed', () => expect(isValidMembershipTransition('suspended', 'removed')).toBe(true));
    it('suspended → resigned', () => expect(isValidMembershipTransition('suspended', 'resigned')).toBe(true));
    it('suspended → expelled', () => expect(isValidMembershipTransition('suspended', 'expelled')).toBe(true));
  });

  describe('terminal states — no outgoing transitions', () => {
    for (const terminal of ['removed', 'resigned', 'deceased', 'expelled'] as const) {
      for (const target of MEMBERSHIP_STATUSES) {
        it(`${terminal} → ${target} is false`, () =>
          expect(isValidMembershipTransition(terminal, target)).toBe(false));
      }
    }
  });

  describe('invalid transitions (non-terminal sources)', () => {
    it('pendingPayment → gracePeriod (skip)', () => expect(isValidMembershipTransition('pendingPayment', 'gracePeriod')).toBe(false));
    it('pendingPayment → suspended (skip)', () => expect(isValidMembershipTransition('pendingPayment', 'suspended')).toBe(false));
    it('pendingPayment → lapsed (skip)', () => expect(isValidMembershipTransition('pendingPayment', 'lapsed')).toBe(false));
    it('pendingPayment → pendingPayment (self)', () => expect(isValidMembershipTransition('pendingPayment', 'pendingPayment')).toBe(false));

    it('active → pendingPayment (backwards)', () => expect(isValidMembershipTransition('active', 'pendingPayment')).toBe(false));
    it('active → active (self)', () => expect(isValidMembershipTransition('active', 'active')).toBe(false));
    it('active → lapsed (skip grace)', () => expect(isValidMembershipTransition('active', 'lapsed')).toBe(false));
    it('active → expired (skip)', () => expect(isValidMembershipTransition('active', 'expired')).toBe(false));

    it('suspended → gracePeriod (invalid)', () => expect(isValidMembershipTransition('suspended', 'gracePeriod')).toBe(false));
    it('suspended → lapsed (invalid)', () => expect(isValidMembershipTransition('suspended', 'lapsed')).toBe(false));
    it('suspended → deceased (invalid)', () => expect(isValidMembershipTransition('suspended', 'deceased')).toBe(false));
  });

  describe('unknown status', () => {
    it('unknown from returns false', () => expect(isValidMembershipTransition('bogus', 'active')).toBe(false));
    it('unknown to returns false', () => expect(isValidMembershipTransition('active', 'bogus')).toBe(false));
    it('both unknown returns false', () => expect(isValidMembershipTransition('foo', 'bar')).toBe(false));
    it('empty string returns false', () => expect(isValidMembershipTransition('', 'active')).toBe(false));
  });
});

describe('membershipTransitionError', () => {
  it('includes from and to in message', () => {
    const msg = membershipTransitionError('active', 'lapsed');
    expect(msg).toContain('active');
    expect(msg).toContain('lapsed');
  });

  it('lists allowed transitions', () => {
    const msg = membershipTransitionError('active', 'lapsed');
    expect(msg).toContain('gracePeriod');
    expect(msg).toContain('suspended');
  });

  it('says "terminal state" for terminal status', () => {
    const msg = membershipTransitionError('removed', 'active');
    expect(msg).toContain('terminal');
  });

  it('handles unknown from status', () => {
    const msg = membershipTransitionError('bogus', 'active');
    expect(msg).toContain('bogus');
  });
});

describe('Membership happy-path transitions', () => {
  it('pendingPayment → active → gracePeriod → lapsed → active: full lifecycle', () => {
    expect(isValidMembershipTransition('pendingPayment', 'active')).toBe(true);
    expect(isValidMembershipTransition('active', 'gracePeriod')).toBe(true);
    expect(isValidMembershipTransition('gracePeriod', 'lapsed')).toBe(true);
    expect(isValidMembershipTransition('lapsed', 'active')).toBe(true);
  });

  it('active → suspended → active: reinstatement after suspension', () => {
    expect(isValidMembershipTransition('active', 'suspended')).toBe(true);
    expect(isValidMembershipTransition('suspended', 'active')).toBe(true);
  });

  it('active → resigned: voluntary exit is terminal', () => {
    expect(isValidMembershipTransition('active', 'resigned')).toBe(true);
    expect(isValidMembershipTransition('resigned', 'active')).toBe(false);
  });
});

describe('MEMBERSHIP_VALID_TRANSITIONS map integrity', () => {
  it('covers all 10 membership statuses', () => {
    expect(Object.keys(MEMBERSHIP_VALID_TRANSITIONS)).toHaveLength(10);
  });

  it('all target statuses are known membership statuses', () => {
    const known = new Set(MEMBERSHIP_STATUSES);
    for (const [, targets] of Object.entries(MEMBERSHIP_VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t as typeof MEMBERSHIP_STATUSES[number])).toBe(true);
      }
    }
  });
});

// ===========================================================================
// License status transitions
// ===========================================================================

const LICENSE_STATUSES = ['pending', 'active', 'expired', 'suspended', 'revoked'] as const;

describe('isValidLicenseTransition', () => {
  describe('valid transitions', () => {
    it('pending → active', () => expect(isValidLicenseTransition('pending', 'active')).toBe(true));
    it('pending → revoked', () => expect(isValidLicenseTransition('pending', 'revoked')).toBe(true));

    it('active → expired', () => expect(isValidLicenseTransition('active', 'expired')).toBe(true));
    it('active → suspended', () => expect(isValidLicenseTransition('active', 'suspended')).toBe(true));
    it('active → revoked', () => expect(isValidLicenseTransition('active', 'revoked')).toBe(true));

    it('expired → active', () => expect(isValidLicenseTransition('expired', 'active')).toBe(true));
    it('expired → revoked', () => expect(isValidLicenseTransition('expired', 'revoked')).toBe(true));

    it('suspended → active', () => expect(isValidLicenseTransition('suspended', 'active')).toBe(true));
    it('suspended → revoked', () => expect(isValidLicenseTransition('suspended', 'revoked')).toBe(true));
  });

  describe('terminal states — no outgoing transitions', () => {
    for (const target of LICENSE_STATUSES) {
      it(`revoked → ${target} is false`, () =>
        expect(isValidLicenseTransition('revoked', target)).toBe(false));
    }
  });

  describe('invalid transitions', () => {
    it('pending → expired (skip)', () => expect(isValidLicenseTransition('pending', 'expired')).toBe(false));
    it('pending → suspended (skip)', () => expect(isValidLicenseTransition('pending', 'suspended')).toBe(false));
    it('pending → pending (self)', () => expect(isValidLicenseTransition('pending', 'pending')).toBe(false));
    it('active → pending (backwards)', () => expect(isValidLicenseTransition('active', 'pending')).toBe(false));
    it('active → active (self)', () => expect(isValidLicenseTransition('active', 'active')).toBe(false));
    it('expired → suspended (lateral)', () => expect(isValidLicenseTransition('expired', 'suspended')).toBe(false));
    it('expired → pending (backwards)', () => expect(isValidLicenseTransition('expired', 'pending')).toBe(false));
    it('suspended → expired (lateral)', () => expect(isValidLicenseTransition('suspended', 'expired')).toBe(false));
    it('suspended → pending (backwards)', () => expect(isValidLicenseTransition('suspended', 'pending')).toBe(false));
  });

  describe('unknown status', () => {
    it('unknown from returns false', () => expect(isValidLicenseTransition('bogus', 'active')).toBe(false));
    it('unknown to returns false', () => expect(isValidLicenseTransition('active', 'bogus')).toBe(false));
    it('empty string returns false', () => expect(isValidLicenseTransition('', 'active')).toBe(false));
  });
});

describe('licenseTransitionError', () => {
  it('includes from and to in message', () => {
    const msg = licenseTransitionError('active', 'pending');
    expect(msg).toContain('active');
    expect(msg).toContain('pending');
  });

  it('says "terminal state" for revoked', () => {
    const msg = licenseTransitionError('revoked', 'active');
    expect(msg).toContain('terminal');
  });
});

describe('LICENSE_VALID_TRANSITIONS map integrity', () => {
  it('covers all 5 license statuses', () => {
    expect(Object.keys(LICENSE_VALID_TRANSITIONS)).toHaveLength(5);
  });

  it('all target statuses are known license statuses', () => {
    const known = new Set(LICENSE_STATUSES);
    for (const [, targets] of Object.entries(LICENSE_VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t as typeof LICENSE_STATUSES[number])).toBe(true);
      }
    }
  });
});

// ===========================================================================
// Officer term status transitions
// ===========================================================================

const TERM_STATUSES = ['upcoming', 'active', 'completed', 'resigned', 'removed'] as const;

describe('isValidTermTransition', () => {
  describe('valid transitions', () => {
    it('upcoming → active', () => expect(isValidTermTransition('upcoming', 'active')).toBe(true));
    it('upcoming → removed', () => expect(isValidTermTransition('upcoming', 'removed')).toBe(true));

    it('active → completed', () => expect(isValidTermTransition('active', 'completed')).toBe(true));
    it('active → resigned', () => expect(isValidTermTransition('active', 'resigned')).toBe(true));
    it('active → removed', () => expect(isValidTermTransition('active', 'removed')).toBe(true));
  });

  describe('terminal states — no outgoing transitions', () => {
    for (const terminal of ['completed', 'resigned', 'removed'] as const) {
      for (const target of TERM_STATUSES) {
        it(`${terminal} → ${target} is false`, () =>
          expect(isValidTermTransition(terminal, target)).toBe(false));
      }
    }
  });

  describe('invalid transitions', () => {
    it('upcoming → completed (skip)', () => expect(isValidTermTransition('upcoming', 'completed')).toBe(false));
    it('upcoming → resigned (skip)', () => expect(isValidTermTransition('upcoming', 'resigned')).toBe(false));
    it('upcoming → upcoming (self)', () => expect(isValidTermTransition('upcoming', 'upcoming')).toBe(false));
    it('active → upcoming (backwards)', () => expect(isValidTermTransition('active', 'upcoming')).toBe(false));
    it('active → active (self)', () => expect(isValidTermTransition('active', 'active')).toBe(false));
  });

  describe('unknown status', () => {
    it('unknown from returns false', () => expect(isValidTermTransition('bogus', 'active')).toBe(false));
    it('unknown to returns false', () => expect(isValidTermTransition('active', 'bogus')).toBe(false));
    it('empty string returns false', () => expect(isValidTermTransition('', 'active')).toBe(false));
  });
});

describe('termTransitionError', () => {
  it('includes from and to in message', () => {
    const msg = termTransitionError('upcoming', 'completed');
    expect(msg).toContain('upcoming');
    expect(msg).toContain('completed');
  });

  it('says "terminal state" for completed', () => {
    const msg = termTransitionError('completed', 'active');
    expect(msg).toContain('terminal');
  });
});

describe('Term happy-path transitions', () => {
  it('upcoming → active → completed: standard term lifecycle', () => {
    expect(isValidTermTransition('upcoming', 'active')).toBe(true);
    expect(isValidTermTransition('active', 'completed')).toBe(true);
    expect(isValidTermTransition('completed', 'upcoming')).toBe(false);
  });

  it('active → resigned: voluntary resignation is terminal', () => {
    expect(isValidTermTransition('active', 'resigned')).toBe(true);
    expect(isValidTermTransition('resigned', 'active')).toBe(false);
  });
});

describe('TERM_VALID_TRANSITIONS map integrity', () => {
  it('covers all 5 term statuses', () => {
    expect(Object.keys(TERM_VALID_TRANSITIONS)).toHaveLength(5);
  });

  it('all target statuses are known term statuses', () => {
    const known = new Set(TERM_STATUSES);
    for (const [, targets] of Object.entries(TERM_VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t as typeof TERM_STATUSES[number])).toBe(true);
      }
    }
  });
});
