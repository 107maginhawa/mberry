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
