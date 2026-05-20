/**
 * RED tests for computeMembershipStatus — BR-01
 *
 * Membership status is computed at query time from dues_expiry_date,
 * never stored as mutable field. Pure function, no DB dependency.
 */
import { describe, test, expect } from 'bun:test';
import { computeMembershipStatus } from './compute-membership-status';

// Helper: create a date string N days from reference
function daysFromNow(n: number, ref = new Date()): string {
  const d = new Date(ref);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const today = new Date('2026-01-15');

describe('[BR-01] computeMembershipStatus', () => {
  test('returns "active" when duesExpiryDate is in the future', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-06-01',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('active');
  });

  test('returns "active" when duesExpiryDate is today (not yet expired)', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-15',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('active');
  });

  test('returns "gracePeriod" when within grace window after expiry', () => {
    // Expired 10 days ago, grace = 30 days → still in grace
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-05',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('gracePeriod');
  });

  test('returns "lapsed" when grace period has also expired', () => {
    // Expired 60 days ago, grace = 30 days → lapsed
    const status = computeMembershipStatus({
      duesExpiryDate: '2025-11-16',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('lapsed');
  });

  test('returns "active" when duesExpiryDate is null (life/honorary member)', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: null,
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('active');
  });

  test('returns "suspended" when suspendedAt is set, regardless of expiry', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-06-01', // future — would be active
      gracePeriodDays: 30,
      suspendedAt: new Date('2026-01-10'),
      removedAt: null,
    }, today);
    expect(status).toBe('suspended');
  });

  test('returns "removed" when removedAt is set, regardless of expiry', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-06-01',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: new Date('2026-01-10'),
    }, today);
    expect(status).toBe('removed');
  });

  test('removed takes precedence over suspended', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-06-01',
      gracePeriodDays: 30,
      suspendedAt: new Date('2026-01-08'),
      removedAt: new Date('2026-01-10'),
    }, today);
    expect(status).toBe('removed');
  });

  test('gracePeriodDays=0 means no grace — goes straight to lapsed', () => {
    // Expired yesterday, no grace
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-14',
      gracePeriodDays: 0,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('lapsed');
  });

  test('returns "pendingPayment" when duesExpiryDate is null and no joinedAt payment', () => {
    // pendingPayment is a special initial state — the membership was just created
    // and no payment has been made yet. duesExpiryDate is null.
    const status = computeMembershipStatus({
      duesExpiryDate: null,
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
      isPendingPayment: true,
    }, today);
    expect(status).toBe('pendingPayment');
  });

  test('defaults to current date when no reference date provided', () => {
    // Just verify it doesn't throw — uses Date.now() internally
    const status = computeMembershipStatus({
      duesExpiryDate: '2099-01-01',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    });
    expect(status).toBe('active');
  });
});

// ── [BR-02] Configurable grace period per org (0-90 days) ─────────────
describe('[BR-02] configurable grace period per org', () => {
  test('grace=0: expired yesterday → lapsed immediately (no grace)', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-14',
      gracePeriodDays: 0,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('lapsed');
  });

  test('grace=7: expired 5 days ago → gracePeriod', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-10',
      gracePeriodDays: 7,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('gracePeriod');
  });

  test('grace=7: expired 8 days ago → lapsed', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-07',
      gracePeriodDays: 7,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('lapsed');
  });

  test('grace=90: expired 89 days ago → still gracePeriod', () => {
    // today = 2026-01-15, expired = 2025-10-18 (89 days ago)
    const status = computeMembershipStatus({
      duesExpiryDate: '2025-10-18',
      gracePeriodDays: 90,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('gracePeriod');
  });

  test('grace=90: expired 91 days ago → lapsed', () => {
    // today = 2026-01-15, expired = 2025-10-16 (91 days ago)
    const status = computeMembershipStatus({
      duesExpiryDate: '2025-10-16',
      gracePeriodDays: 90,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('lapsed');
  });

  test('grace=1: expired exactly 1 day ago → gracePeriod (boundary)', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2026-01-14',
      gracePeriodDays: 1,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(status).toBe('gracePeriod');
  });

  test('two orgs with different grace periods compute independently', () => {
    const expiry = '2026-01-10'; // 5 days ago from today
    const orgA = computeMembershipStatus({
      duesExpiryDate: expiry,
      gracePeriodDays: 3, // grace ended
      suspendedAt: null,
      removedAt: null,
    }, today);
    const orgB = computeMembershipStatus({
      duesExpiryDate: expiry,
      gracePeriodDays: 30, // still in grace
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(orgA).toBe('lapsed');
    expect(orgB).toBe('gracePeriod');
  });
});

// ── [M5-R1] State machine transitions: Pending→Active→Grace→Lapsed ───
describe('[M5-R1] state machine transitions', () => {
  test('pendingPayment → active (payment received, expiry set)', () => {
    // Before payment: pendingPayment
    const before = computeMembershipStatus({
      duesExpiryDate: null,
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
      isPendingPayment: true,
    }, today);
    expect(before).toBe('pendingPayment');

    // After payment: active (expiry set to future)
    const after = computeMembershipStatus({
      duesExpiryDate: '2027-01-15',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(after).toBe('active');
  });

  test('active → gracePeriod (expiry passes, within grace)', () => {
    // Day before expiry: active
    const beforeExpiry = computeMembershipStatus({
      duesExpiryDate: '2026-01-15',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(beforeExpiry).toBe('active');

    // Day after expiry: gracePeriod
    const afterExpiry = computeMembershipStatus({
      duesExpiryDate: '2026-01-14',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(afterExpiry).toBe('gracePeriod');
  });

  test('gracePeriod → lapsed (grace window expires)', () => {
    // Still in grace (10 days expired, 30 day grace)
    const inGrace = computeMembershipStatus({
      duesExpiryDate: '2026-01-05',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(inGrace).toBe('gracePeriod');

    // Grace expired (60 days expired, 30 day grace)
    const pastGrace = computeMembershipStatus({
      duesExpiryDate: '2025-11-16',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);
    expect(pastGrace).toBe('lapsed');
  });

  test('any state → suspended (officer action)', () => {
    const states: Array<{ duesExpiryDate: string | null; isPendingPayment?: boolean }> = [
      { duesExpiryDate: '2027-01-01' },        // would be active
      { duesExpiryDate: '2026-01-10' },         // would be gracePeriod
      { duesExpiryDate: '2025-01-01' },         // would be lapsed
      { duesExpiryDate: null, isPendingPayment: true }, // would be pendingPayment
    ];
    for (const s of states) {
      const status = computeMembershipStatus({
        ...s,
        duesExpiryDate: s.duesExpiryDate,
        gracePeriodDays: 30,
        suspendedAt: new Date('2026-01-10'),
        removedAt: null,
      }, today);
      expect(status).toBe('suspended');
    }
  });

  test('any state → removed (officer action, highest priority)', () => {
    const status = computeMembershipStatus({
      duesExpiryDate: '2027-01-01',
      gracePeriodDays: 30,
      suspendedAt: new Date('2026-01-08'),
      removedAt: new Date('2026-01-10'),
    }, today);
    expect(status).toBe('removed');
  });
});

// ── [M5-R10] Cross-org independence ──────────────────────────────────
describe('[M5-R10] cross-org independence', () => {
  test('same person different orgs can have different statuses', () => {
    // Org A: active (future expiry)
    const orgA = computeMembershipStatus({
      duesExpiryDate: '2027-06-01',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);

    // Org B: lapsed (expired + grace over)
    const orgB = computeMembershipStatus({
      duesExpiryDate: '2025-06-01',
      gracePeriodDays: 30,
      suspendedAt: null,
      removedAt: null,
    }, today);

    // Org C: suspended (officer action)
    const orgC = computeMembershipStatus({
      duesExpiryDate: '2027-06-01',
      gracePeriodDays: 30,
      suspendedAt: new Date('2026-01-01'),
      removedAt: null,
    }, today);

    expect(orgA).toBe('active');
    expect(orgB).toBe('lapsed');
    expect(orgC).toBe('suspended');
  });

  test('org-specific grace period does not leak to other org', () => {
    const expiry = '2026-01-10'; // 5 days ago
    // Org with 3-day grace: lapsed
    const shortGrace = computeMembershipStatus({
      duesExpiryDate: expiry,
      gracePeriodDays: 3,
      suspendedAt: null,
      removedAt: null,
    }, today);
    // Org with 60-day grace: still in grace
    const longGrace = computeMembershipStatus({
      duesExpiryDate: expiry,
      gracePeriodDays: 60,
      suspendedAt: null,
      removedAt: null,
    }, today);

    expect(shortGrace).toBe('lapsed');
    expect(longGrace).toBe('gracePeriod');
  });
});
