import { describe, it, expect } from 'bun:test';
import {
  BOOKING_VALID_TRANSITIONS,
  isValidBookingTransition,
  bookingTransitionError,
} from './status-transitions';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

const BOOKING_STATUSES = [
  'pending', 'confirmed', 'rejected', 'cancelled',
  'completed', 'no_show_client', 'no_show_host',
] as const;

// ---------------------------------------------------------------------------
// Booking transition matrix
// ---------------------------------------------------------------------------

describe('isValidBookingTransition', () => {
  describe('valid transitions', () => {
    it('pending → confirmed', () => expect(isValidBookingTransition('pending', 'confirmed')).toBe(true));
    it('pending → rejected', () => expect(isValidBookingTransition('pending', 'rejected')).toBe(true));
    it('pending → cancelled', () => expect(isValidBookingTransition('pending', 'cancelled')).toBe(true));

    it('confirmed → cancelled', () => expect(isValidBookingTransition('confirmed', 'cancelled')).toBe(true));
    it('confirmed → completed', () => expect(isValidBookingTransition('confirmed', 'completed')).toBe(true));
    it('confirmed → no_show_client', () => expect(isValidBookingTransition('confirmed', 'no_show_client')).toBe(true));
    it('confirmed → no_show_host', () => expect(isValidBookingTransition('confirmed', 'no_show_host')).toBe(true));
  });

  describe('terminal states — no outgoing transitions', () => {
    for (const terminal of ['rejected', 'cancelled', 'completed', 'no_show_client', 'no_show_host'] as const) {
      for (const target of BOOKING_STATUSES) {
        it(`${terminal} → ${target} is false`, () =>
          expect(isValidBookingTransition(terminal, target)).toBe(false));
      }
    }
  });

  describe('invalid transitions (non-terminal sources)', () => {
    it('pending → completed (skip)', () => expect(isValidBookingTransition('pending', 'completed')).toBe(false));
    it('pending → no_show_client (skip)', () => expect(isValidBookingTransition('pending', 'no_show_client')).toBe(false));
    it('pending → no_show_host (skip)', () => expect(isValidBookingTransition('pending', 'no_show_host')).toBe(false));
    it('pending → pending (self)', () => expect(isValidBookingTransition('pending', 'pending')).toBe(false));

    it('confirmed → pending (backwards)', () => expect(isValidBookingTransition('confirmed', 'pending')).toBe(false));
    it('confirmed → rejected (wrong path)', () => expect(isValidBookingTransition('confirmed', 'rejected')).toBe(false));
    it('confirmed → confirmed (self)', () => expect(isValidBookingTransition('confirmed', 'confirmed')).toBe(false));
  });

  describe('unknown status', () => {
    it('unknown from returns false', () => expect(isValidBookingTransition('bogus', 'confirmed')).toBe(false));
    it('unknown to returns false', () => expect(isValidBookingTransition('pending', 'bogus')).toBe(false));
    it('both unknown returns false', () => expect(isValidBookingTransition('foo', 'bar')).toBe(false));
    it('empty string returns false', () => expect(isValidBookingTransition('', 'confirmed')).toBe(false));
  });
});

// ---------------------------------------------------------------------------
// Error message helpers
// ---------------------------------------------------------------------------

describe('bookingTransitionError', () => {
  it('includes from and to in message', () => {
    const msg = bookingTransitionError('pending', 'completed');
    expect(msg).toContain('pending');
    expect(msg).toContain('completed');
  });

  it('lists allowed transitions', () => {
    const msg = bookingTransitionError('pending', 'completed');
    expect(msg).toContain('confirmed');
    expect(msg).toContain('rejected');
    expect(msg).toContain('cancelled');
  });

  it('says "terminal state" for terminal status', () => {
    const msg = bookingTransitionError('completed', 'pending');
    expect(msg).toContain('terminal');
  });

  it('handles unknown from status', () => {
    const msg = bookingTransitionError('bogus', 'confirmed');
    expect(msg).toContain('bogus');
  });
});

// ---------------------------------------------------------------------------
// Booking happy-path scenarios
// ---------------------------------------------------------------------------

describe('Booking happy-path transitions', () => {
  it('pending → confirmed → completed: standard booking lifecycle', () => {
    expect(isValidBookingTransition('pending', 'confirmed')).toBe(true);
    expect(isValidBookingTransition('confirmed', 'completed')).toBe(true);
    expect(isValidBookingTransition('completed', 'pending')).toBe(false);
  });

  it('pending → confirmed → cancelled: client cancels confirmed booking', () => {
    expect(isValidBookingTransition('pending', 'confirmed')).toBe(true);
    expect(isValidBookingTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('pending → rejected: host rejects booking request', () => {
    expect(isValidBookingTransition('pending', 'rejected')).toBe(true);
    expect(isValidBookingTransition('rejected', 'pending')).toBe(false);
  });

  it('confirmed → no_show_client: client no-show after confirmed', () => {
    expect(isValidBookingTransition('confirmed', 'no_show_client')).toBe(true);
    expect(isValidBookingTransition('no_show_client', 'confirmed')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Map integrity
// ---------------------------------------------------------------------------

describe('BOOKING_VALID_TRANSITIONS map integrity', () => {
  it('covers all 7 booking statuses', () => {
    expect(Object.keys(BOOKING_VALID_TRANSITIONS)).toHaveLength(7);
  });

  it('all target statuses are known booking statuses', () => {
    const known = new Set(BOOKING_STATUSES);
    for (const [, targets] of Object.entries(BOOKING_VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t as typeof BOOKING_STATUSES[number])).toBe(true);
      }
    }
  });
});
