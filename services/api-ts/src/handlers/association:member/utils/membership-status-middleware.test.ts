/**
 * Tests for membership-status-middleware (BR-01 compliance)
 *
 * Verifies that withComputedStatus() always derives status from flag fields,
 * never trusts a stored status value.
 */

import { describe, it, expect } from 'bun:test';
import { withComputedStatus } from './membership-status-middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE = '2099-12-31';
const PAST_BEYOND_GRACE = '2000-01-01'; // well past any grace period

function baseRow(overrides: Partial<Parameters<typeof withComputedStatus>[0]> = {}) {
  return {
    duesExpiryDate: FUTURE,
    gracePeriodDays: 30,
    suspendedAt: null,
    removedAt: null,
    dateOfDeath: null,
    expelledAt: null,
    resignedAt: null,
    isPendingPayment: false,
    isExpired: false,
    // Simulate a stale stored status (middleware must ignore this)
    status: 'lapsed' as const,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withComputedStatus', () => {
  it('returns active when duesExpiryDate is in the future', () => {
    const result = withComputedStatus(baseRow({ duesExpiryDate: FUTURE }));
    expect(result.status).toBe('active');
  });

  it('returns lapsed when duesExpiryDate is past and grace period has expired', () => {
    const result = withComputedStatus(
      baseRow({ duesExpiryDate: PAST_BEYOND_GRACE }),
      30,
    );
    expect(result.status).toBe('lapsed');
  });

  it('returns suspended when suspendedAt is set, even with future duesExpiryDate', () => {
    const result = withComputedStatus(
      baseRow({
        duesExpiryDate: FUTURE,
        suspendedAt: new Date('2024-01-01'),
      }),
    );
    // suspended trumps active dues
    expect(result.status).toBe('suspended');
  });

  it('returns deceased when dateOfDeath is set (terminal — highest priority)', () => {
    const result = withComputedStatus(
      baseRow({
        duesExpiryDate: FUTURE,
        suspendedAt: new Date('2024-01-01'), // suspended too — deceased wins
        dateOfDeath: '2025-06-01',
      }),
    );
    expect(result.status).toBe('deceased');
  });

  it('returns suspended (not active) for a suspended member with future expiry', () => {
    const result = withComputedStatus(
      baseRow({
        duesExpiryDate: FUTURE,
        suspendedAt: new Date(),
      }),
    );
    expect(result.status).toBe('suspended');
    expect(result.status).not.toBe('active');
  });

  it('preserves all other fields on the returned object', () => {
    const row = baseRow({ duesExpiryDate: FUTURE });
    const result = withComputedStatus(row);
    expect(result.duesExpiryDate).toBe(FUTURE);
    expect(result.gracePeriodDays).toBe(30);
  });

  it('does not mutate the original row', () => {
    const row = baseRow({ duesExpiryDate: FUTURE, status: 'lapsed' as const });
    withComputedStatus(row);
    // Original stored status must be untouched
    expect(row.status).toBe('lapsed');
  });

  it('uses provided gracePeriodDays override over row value', () => {
    // Expired yesterday — within a 30-day grace but we override to 0
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expiryStr = yesterday.toISOString().split('T')[0]!;

    const withGrace = withComputedStatus(baseRow({ duesExpiryDate: expiryStr }), 30);
    expect(withGrace.status).toBe('gracePeriod');

    const noGrace = withComputedStatus(baseRow({ duesExpiryDate: expiryStr }), 0);
    expect(noGrace.status).toBe('lapsed');
  });

  it('returns removed when removedAt is set', () => {
    const result = withComputedStatus(
      baseRow({
        removedAt: new Date('2024-01-01'),
        duesExpiryDate: FUTURE,
      }),
    );
    expect(result.status).toBe('removed');
  });

  it('returns pendingPayment when isPendingPayment is true and no terminal flags', () => {
    const result = withComputedStatus(
      baseRow({
        isPendingPayment: true,
        duesExpiryDate: null,
      }),
    );
    expect(result.status).toBe('pendingPayment');
  });
});
