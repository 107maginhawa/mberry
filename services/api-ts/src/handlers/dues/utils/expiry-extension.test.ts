import { describe, test, expect } from 'bun:test';
import { computeNewExpiry, type BillingCycle } from './expiry-extension';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

// [BR-07] Dues Expiry Extension on Payment
// Tests written from BR text, not from implementation.

const TODAY = new Date('2026-06-15');

function date(s: string): Date {
  return new Date(s);
}

describe('computeNewExpiry [BR-07]', () => {
  // ─── Standard extension: from current expiry, not today ───

  test('extends from current expiry, not from today (annual)', () => {
    // Member pays early — expiry is still in the future
    const result = computeNewExpiry({
      currentExpiry: date('2026-08-01'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // Should extend from 2026-08-01 + 12 months = 2027-08-01
    expect(result).toEqual(date('2027-08-01'));
  });

  test('extends from current expiry, not from today (quarterly)', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-07-15'),
      billingCycle: 'quarterly',
      today: TODAY,
    });
    // 2026-07-15 + 3 months = 2026-10-15
    expect(result).toEqual(date('2026-10-15'));
  });

  test('extends from current expiry even when recently expired', () => {
    // Expiry was 1 month ago — still within one billing cycle
    const result = computeNewExpiry({
      currentExpiry: date('2026-05-15'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // Extend from expiry: 2026-05-15 + 12 months = 2027-05-15
    expect(result).toEqual(date('2027-05-15'));
  });

  test('early payment preserves remaining time', () => {
    // Member pays 3 months early — should get full extension from current expiry
    const result = computeNewExpiry({
      currentExpiry: date('2026-09-15'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // 2026-09-15 + 12 months = 2027-09-15 (keeps 3 extra months)
    expect(result).toEqual(date('2027-09-15'));
  });

  // ─── Severely lapsed: reset from today ────────────────

  test('severely lapsed resets from today (expired > 1 cycle ago)', () => {
    // Expiry was 13 months ago — MORE than one annual cycle
    const result = computeNewExpiry({
      currentExpiry: date('2025-05-14'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // Reset from today: 2026-06-15 + 12 months = 2027-06-15
    expect(result).toEqual(date('2027-06-15'));
  });

  test('exactly one billing cycle ago still uses standard extension', () => {
    // BR-07 edge case: "If the expiry is exactly one billing cycle ago
    // to the day, the standard extension (from current expiry) still applies."
    const result = computeNewExpiry({
      currentExpiry: date('2025-06-15'), // exactly 12 months before today
      billingCycle: 'annual',
      today: TODAY,
    });
    // Standard extension: 2025-06-15 + 12 months = 2026-06-15
    expect(result).toEqual(date('2026-06-15'));
  });

  test('one day more than a cycle ago triggers severe lapse', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2025-06-14'), // one day MORE than 12 months ago
      billingCycle: 'annual',
      today: TODAY,
    });
    // Severely lapsed → from today: 2026-06-15 + 12 months = 2027-06-15
    expect(result).toEqual(date('2027-06-15'));
  });

  // ─── Quarterly cycle ──────────────────────────────────

  test('quarterly severe lapse threshold is 3 months', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-03-14'), // > 3 months before today
      billingCycle: 'quarterly',
      today: TODAY,
    });
    // Severely lapsed for quarterly: reset from today
    expect(result).toEqual(date('2026-09-15'));
  });

  test('quarterly within threshold uses standard extension', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-03-16'), // within 3 months
      billingCycle: 'quarterly',
      today: TODAY,
    });
    // Standard: 2026-03-16 + 3 months = 2026-06-16
    expect(result).toEqual(date('2026-06-16'));
  });

  // ─── Custom cycle ─────────────────────────────────────

  test('custom 6-month cycle extends correctly', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-07-01'),
      billingCycle: 'custom',
      customMonths: 6,
      today: TODAY,
    });
    expect(result).toEqual(date('2027-01-01'));
  });

  // ─── Null expiry (first payment) ──────────────────────

  test('null expiry (first payment) starts from today', () => {
    const result = computeNewExpiry({
      currentExpiry: null,
      billingCycle: 'annual',
      today: TODAY,
    });
    // No existing expiry → today + 12 months
    expect(result).toEqual(date('2027-06-15'));
  });
});
