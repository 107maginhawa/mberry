import { describe, it, expect } from 'bun:test';
import {
  BOOKING_EVENT_VALID_TRANSITIONS,
  EMAIL_QUEUE_VALID_TRANSITIONS,
  FEED_POST_VALID_TRANSITIONS,
  MEMBERSHIP_VALID_TRANSITIONS,
  DUES_PAYMENT_VALID_TRANSITIONS,
  ELECTION_VALID_TRANSITIONS,
  MARKETPLACE_VENDOR_VALID_TRANSITIONS,
  MARKETPLACE_LISTING_VALID_TRANSITIONS,
  MARKETPLACE_ORDER_VALID_TRANSITIONS,
  TRAINING_VALID_TRANSITIONS,
  TRAINING_ENROLLMENT_VALID_TRANSITIONS,
  isValidTransition,
  assertValidTransition,
} from './status-transitions';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

describe('isValidTransition', () => {
  it('returns true for a known valid transition', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'active')).toBe(true);
  });

  it('returns false for an invalid transition', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'draft')).toBe(false);
  });

  it('returns false for unknown from-status', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'nonexistent', 'active')).toBe(false);
  });
});

describe('BOOKING_EVENT_VALID_TRANSITIONS', () => {
  it('draft → active is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'active')).toBe(true);
  });

  it('draft → archived is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'archived')).toBe(true);
  });

  it('active → paused is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'active', 'paused')).toBe(true);
  });

  it('active → archived is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'active', 'archived')).toBe(true);
  });

  it('paused → active is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'paused', 'active')).toBe(true);
  });

  it('paused → archived is valid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'paused', 'archived')).toBe(true);
  });

  it('archived has no valid transitions (terminal)', () => {
    expect(BOOKING_EVENT_VALID_TRANSITIONS['archived']).toEqual([]);
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'draft')).toBe(false);
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'active')).toBe(false);
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'paused')).toBe(false);
  });

  it('draft → paused is invalid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'paused')).toBe(false);
  });

  it('active → draft is invalid', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'active', 'draft')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(isValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'unknown', 'active')).toBe(false);
  });
});

describe('EMAIL_QUEUE_VALID_TRANSITIONS', () => {
  it('pending → processing is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'pending', 'processing')).toBe(true);
  });

  it('pending → cancelled is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'pending', 'cancelled')).toBe(true);
  });

  it('processing → sent is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'processing', 'sent')).toBe(true);
  });

  it('processing → failed is valid', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'processing', 'failed')).toBe(true);
  });

  it('failed → pending is valid (user-triggered retry)', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'failed', 'pending')).toBe(true);
  });

  it('failed → processing is valid (job-runner auto-retry path)', () => {
    // Job runner picks up failed items eligible for retry and marks them
    // processing directly (see core/email.ts processPendingEmails). Both
    // failed → pending (user retry) and failed → processing (auto retry)
    // are legitimate forward paths from failed.
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'failed', 'processing')).toBe(true);
  });

  it('sent has no valid transitions (terminal)', () => {
    expect(EMAIL_QUEUE_VALID_TRANSITIONS['sent']).toEqual([]);
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'sent', 'pending')).toBe(false);
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'sent', 'failed')).toBe(false);
  });

  it('cancelled has no valid transitions (terminal)', () => {
    expect(EMAIL_QUEUE_VALID_TRANSITIONS['cancelled']).toEqual([]);
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'cancelled', 'pending')).toBe(false);
  });

  it('pending → sent is invalid (must go through processing)', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'pending', 'sent')).toBe(false);
  });

  it('failed → sent is invalid (must retry via pending)', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'failed', 'sent')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(isValidTransition(EMAIL_QUEUE_VALID_TRANSITIONS, 'bounced', 'pending')).toBe(false);
  });
});

describe('FEED_POST_VALID_TRANSITIONS', () => {
  it('draft → published is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'draft', 'published')).toBe(true);
  });

  it('published → flagged is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'published', 'flagged')).toBe(true);
  });

  it('published → removed is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'published', 'removed')).toBe(true);
  });

  it('flagged → published is valid (officer restore)', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'flagged', 'published')).toBe(true);
  });

  it('flagged → removed is valid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'flagged', 'removed')).toBe(true);
  });

  it('removed has no valid transitions (terminal)', () => {
    expect(FEED_POST_VALID_TRANSITIONS['removed']).toEqual([]);
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'removed', 'draft')).toBe(false);
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'removed', 'published')).toBe(false);
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'removed', 'flagged')).toBe(false);
  });

  it('draft → flagged is invalid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'draft', 'flagged')).toBe(false);
  });

  it('draft → removed is invalid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'draft', 'removed')).toBe(false);
  });

  it('published → draft is invalid', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'published', 'draft')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(isValidTransition(FEED_POST_VALID_TRANSITIONS, 'hidden', 'published')).toBe(false);
  });
});

// ─── assertValidTransition ──────────────────────────────────────────

describe('assertValidTransition', () => {
  it('does not throw for valid transition', () => {
    expect(() =>
      assertValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'active', 'booking event')
    ).not.toThrow();
  });

  it('throws ConflictError for invalid transition', () => {
    expect(() =>
      assertValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'draft', 'booking event')
    ).toThrow(/Cannot transition booking event/);
  });

  it('throws ConflictError for unknown from-status', () => {
    expect(() =>
      assertValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'bogus', 'active', 'booking event')
    ).toThrow(/Cannot transition booking event/);
  });

  it('error message includes allowed transitions', () => {
    try {
      assertValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'draft', 'paused', 'booking event');
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain('active');
      expect(e.message).toContain('archived');
      expect(e.statusCode).toBe(409);
    }
  });

  it('error message says terminal for terminal states', () => {
    try {
      assertValidTransition(BOOKING_EVENT_VALID_TRANSITIONS, 'archived', 'active', 'booking event');
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('terminal');
    }
  });
});

// ─── MEMBERSHIP_VALID_TRANSITIONS ───────────────────────────────────

describe('MEMBERSHIP_VALID_TRANSITIONS', () => {
  it('pendingPayment → active is valid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'pendingPayment', 'active')).toBe(true);
  });

  it('active → gracePeriod is valid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'active', 'gracePeriod')).toBe(true);
  });

  it('active → suspended is valid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'active', 'suspended')).toBe(true);
  });

  it('gracePeriod → active is valid (renewed)', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'gracePeriod', 'active')).toBe(true);
  });

  it('gracePeriod → suspended is valid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'gracePeriod', 'suspended')).toBe(true);
  });

  it('suspended → active is valid (reinstatement)', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'suspended', 'active')).toBe(true);
  });

  it('any non-terminal state → removed is valid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'active', 'removed')).toBe(true);
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'suspended', 'removed')).toBe(true);
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'gracePeriod', 'removed')).toBe(true);
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'pendingPayment', 'removed')).toBe(true);
  });

  it('active → resigned/deceased/expelled are valid (LIF-04)', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'active', 'resigned')).toBe(true);
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'active', 'deceased')).toBe(true);
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'active', 'expelled')).toBe(true);
  });

  it('all terminal states have no transitions', () => {
    for (const terminal of ['removed', 'resigned', 'deceased', 'expelled']) {
      expect(MEMBERSHIP_VALID_TRANSITIONS[terminal]).toEqual([]);
      expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, terminal, 'active')).toBe(false);
    }
  });

  it('pendingPayment → suspended is invalid (must activate first)', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'pendingPayment', 'suspended')).toBe(false);
  });

  it('pendingPayment → gracePeriod is invalid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'pendingPayment', 'gracePeriod')).toBe(false);
  });

  it('lapsed → active is valid (renewal)', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'lapsed', 'active')).toBe(true);
  });

  it('expired → removed is valid', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'expired', 'removed')).toBe(true);
  });

  it('expired → active is invalid (must go through admin)', () => {
    expect(isValidTransition(MEMBERSHIP_VALID_TRANSITIONS, 'expired', 'active')).toBe(false);
  });
});

// ─── ELECTION_VALID_TRANSITIONS ─────────────────────────────────────

describe('ELECTION_VALID_TRANSITIONS', () => {
  it('follows linear progression: draft → nominations → voting → awaiting → published', () => {
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'draft', 'nominationsOpen')).toBe(true);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'nominationsOpen', 'votingOpen')).toBe(true);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'votingOpen', 'awaitingConfirmation')).toBe(true);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'awaitingConfirmation', 'published')).toBe(true);
  });

  it('any non-terminal state can be cancelled', () => {
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'draft', 'cancelled')).toBe(true);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'nominationsOpen', 'cancelled')).toBe(true);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'votingOpen', 'cancelled')).toBe(true);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'awaitingConfirmation', 'cancelled')).toBe(true);
  });

  it('published and cancelled are terminal', () => {
    expect(ELECTION_VALID_TRANSITIONS['published']).toEqual([]);
    expect(ELECTION_VALID_TRANSITIONS['cancelled']).toEqual([]);
  });

  it('cannot skip stages', () => {
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'draft', 'votingOpen')).toBe(false);
    expect(isValidTransition(ELECTION_VALID_TRANSITIONS, 'nominationsOpen', 'published')).toBe(false);
  });
});

// ─── MARKETPLACE TRANSITIONS ────────────────────────────────────────

describe('MARKETPLACE_VENDOR_VALID_TRANSITIONS', () => {
  it('pending → verified is valid', () => {
    expect(isValidTransition(MARKETPLACE_VENDOR_VALID_TRANSITIONS, 'pending', 'verified')).toBe(true);
  });

  it('pending → rejected is valid', () => {
    expect(isValidTransition(MARKETPLACE_VENDOR_VALID_TRANSITIONS, 'pending', 'rejected')).toBe(true);
  });

  it('verified → suspended is valid', () => {
    expect(isValidTransition(MARKETPLACE_VENDOR_VALID_TRANSITIONS, 'verified', 'suspended')).toBe(true);
  });

  it('suspended → verified is valid (reinstatement)', () => {
    expect(isValidTransition(MARKETPLACE_VENDOR_VALID_TRANSITIONS, 'suspended', 'verified')).toBe(true);
  });

  it('rejected is terminal', () => {
    expect(MARKETPLACE_VENDOR_VALID_TRANSITIONS['rejected']).toEqual([]);
  });
});

describe('MARKETPLACE_LISTING_VALID_TRANSITIONS', () => {
  it('draft → active is valid', () => {
    expect(isValidTransition(MARKETPLACE_LISTING_VALID_TRANSITIONS, 'draft', 'active')).toBe(true);
  });

  it('active → archived is valid', () => {
    expect(isValidTransition(MARKETPLACE_LISTING_VALID_TRANSITIONS, 'active', 'archived')).toBe(true);
  });

  it('archived is terminal', () => {
    expect(MARKETPLACE_LISTING_VALID_TRANSITIONS['archived']).toEqual([]);
  });
});

describe('MARKETPLACE_ORDER_VALID_TRANSITIONS', () => {
  it('follows order lifecycle', () => {
    expect(isValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, 'pending', 'confirmed')).toBe(true);
    expect(isValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, 'pending', 'fulfilled')).toBe(true);
    expect(isValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, 'confirmed', 'fulfilled')).toBe(true);
  });

  it('pending and confirmed can be cancelled', () => {
    expect(isValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, 'pending', 'cancelled')).toBe(true);
    expect(isValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, 'confirmed', 'cancelled')).toBe(true);
  });

  it('fulfilled can be refunded', () => {
    expect(isValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, 'fulfilled', 'refunded')).toBe(true);
  });

  it('cancelled and refunded are terminal', () => {
    expect(MARKETPLACE_ORDER_VALID_TRANSITIONS['cancelled']).toEqual([]);
    expect(MARKETPLACE_ORDER_VALID_TRANSITIONS['refunded']).toEqual([]);
  });
});

// ─── TRAINING TRANSITIONS ───────────────────────────────────────────

describe('TRAINING_VALID_TRANSITIONS', () => {
  it('draft → published is valid', () => {
    expect(isValidTransition(TRAINING_VALID_TRANSITIONS, 'draft', 'published')).toBe(true);
  });

  it('published → completed is valid', () => {
    expect(isValidTransition(TRAINING_VALID_TRANSITIONS, 'published', 'completed')).toBe(true);
  });

  it('draft and published can be cancelled', () => {
    expect(isValidTransition(TRAINING_VALID_TRANSITIONS, 'draft', 'cancelled')).toBe(true);
    expect(isValidTransition(TRAINING_VALID_TRANSITIONS, 'published', 'cancelled')).toBe(true);
  });

  it('completed and cancelled are terminal', () => {
    expect(TRAINING_VALID_TRANSITIONS['completed']).toEqual([]);
    expect(TRAINING_VALID_TRANSITIONS['cancelled']).toEqual([]);
  });

  it('cannot go backwards', () => {
    expect(isValidTransition(TRAINING_VALID_TRANSITIONS, 'published', 'draft')).toBe(false);
  });
});

describe('TRAINING_ENROLLMENT_VALID_TRANSITIONS', () => {
  it('enrolled → completed is valid', () => {
    expect(isValidTransition(TRAINING_ENROLLMENT_VALID_TRANSITIONS, 'enrolled', 'completed')).toBe(true);
  });

  it('enrolled → cancelled is valid', () => {
    expect(isValidTransition(TRAINING_ENROLLMENT_VALID_TRANSITIONS, 'enrolled', 'cancelled')).toBe(true);
  });

  it('enrolled → noShow is valid', () => {
    expect(isValidTransition(TRAINING_ENROLLMENT_VALID_TRANSITIONS, 'enrolled', 'noShow')).toBe(true);
  });

  it('completed, cancelled, noShow are terminal', () => {
    expect(TRAINING_ENROLLMENT_VALID_TRANSITIONS['completed']).toEqual([]);
    expect(TRAINING_ENROLLMENT_VALID_TRANSITIONS['cancelled']).toEqual([]);
    expect(TRAINING_ENROLLMENT_VALID_TRANSITIONS['noShow']).toEqual([]);
  });
});

// ─── DUES_PAYMENT_VALID_TRANSITIONS ─────────────────────────────────

describe('DUES_PAYMENT_VALID_TRANSITIONS (centralized)', () => {
  it('pending → completed is valid', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'pending', 'completed')).toBe(true);
  });

  it('submitted → underReview is valid', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'submitted', 'underReview')).toBe(true);
  });

  it('completed → refunded is valid', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'completed', 'refunded')).toBe(true);
  });

  it('failed → pending is valid (retry)', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'failed', 'pending')).toBe(true);
  });

  it('refunded and expired are terminal', () => {
    expect(DUES_PAYMENT_VALID_TRANSITIONS['refunded']).toEqual([]);
    expect(DUES_PAYMENT_VALID_TRANSITIONS['expired']).toEqual([]);
  });

  it('pending → refunded is invalid (must complete first)', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'pending', 'refunded')).toBe(false);
  });
});
