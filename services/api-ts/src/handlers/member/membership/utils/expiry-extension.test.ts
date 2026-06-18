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

  // ─── Month-end clamping (date-fns regression) ─────────
  // These guard against setMonth overflow where Aug 31 + 6mo → March 3
  // instead of the correct Feb 28/29. date-fns addMonths clamps correctly.

  test('annual month-end: Aug 31 + 12 months = Aug 31 next year', () => {
    // today before lapse threshold → standard extension branch
    const TODAY_AUG = new Date('2025-07-01');
    const result = computeNewExpiry({
      currentExpiry: date('2025-08-31'),
      billingCycle: 'annual',
      today: TODAY_AUG,
    });
    // 2025-08-31 + 12 months = 2026-08-31 (Aug has 31 days)
    expect(result).toEqual(date('2026-08-31'));
  });

  test('semi-annual month-end overflow regression: Aug 31 + 6mo = Feb 28 (2026, non-leap)', () => {
    // today before lapse threshold → standard extension branch
    const TODAY_AUG = new Date('2025-07-01');
    const result = computeNewExpiry({
      currentExpiry: date('2025-08-31'),
      billingCycle: 'semi-annual',
      today: TODAY_AUG,
    });
    // 2025-08-31 + 6 months = 2026-02-28 (Feb 2026 has 28 days — NOT March 3)
    expect(result).toEqual(date('2026-02-28'));
  });

  test('leap-year clamp: Aug 31 + 6mo = Feb 29 in leap year (2024)', () => {
    const TODAY_AUG_2023 = new Date('2023-07-01');
    const result = computeNewExpiry({
      currentExpiry: date('2023-08-31'),
      billingCycle: 'semi-annual',
      today: TODAY_AUG_2023,
    });
    // 2023-08-31 + 6 months = 2024-02-29 (2024 IS a leap year)
    expect(result).toEqual(date('2024-02-29'));
  });

  test('first payment with month-end today: null expiry + semi-annual = Feb 28', () => {
    // today = Aug 31 → first payment → today + 6mo = Feb 28 (2026 non-leap)
    const TODAY_AUG_31 = new Date('2025-08-31');
    const result = computeNewExpiry({
      currentExpiry: null,
      billingCycle: 'semi-annual',
      today: TODAY_AUG_31,
    });
    expect(result).toEqual(date('2026-02-28'));
  });

  test('severely lapsed near month boundary resets from today (month-end)', () => {
    // Severely lapsed: expiry 2024-08-31, today 2026-03-01, semi-annual (6mo threshold)
    // threshold = subMonths(2026-03-01, 6) = 2025-09-01; expiry 2024-08-31 < threshold
    // → reset: addMonths(2026-03-01, 6) = 2026-09-01
    const TODAY_MAR = new Date('2026-03-01');
    const result = computeNewExpiry({
      currentExpiry: date('2024-08-31'),
      billingCycle: 'semi-annual',
      today: TODAY_MAR,
    });
    expect(result).toEqual(date('2026-09-01'));
  });
});
