/**
 * BR-07: Payment extends membership expiry by billing period.
 *
 * Source lives at association:member/utils/expiry-extension.ts — tested here
 * at the path registered in br-registry.json for BR-07.
 */

import { describe, test, expect } from 'bun:test';
import { computeNewExpiry, type BillingCycle } from '../../association:member/utils/expiry-extension';

const TODAY = new Date('2026-06-15');

function date(s: string): Date {
  return new Date(s);
}

// ─── Standard extension: from current expiry, not today [BR-07] ───

describe('[BR-07] computeNewExpiry — standard extension', () => {
  test('extends from current expiry, not from today (annual)', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-08-01'),
      billingCycle: 'annual',
      today: TODAY,
    });
    expect(result).toEqual(date('2027-08-01'));
  });

  test('extends from current expiry (quarterly)', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-07-15'),
      billingCycle: 'quarterly',
      today: TODAY,
    });
    expect(result).toEqual(date('2026-10-15'));
  });

  test('extends from current expiry (semi-annual)', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-08-01'),
      billingCycle: 'semi-annual',
      today: TODAY,
    });
    expect(result).toEqual(date('2027-02-01'));
  });

  test('custom billing cycle uses customMonths', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-08-01'),
      billingCycle: 'custom',
      customMonths: 18,
      today: TODAY,
    });
    expect(result).toEqual(date('2028-02-01'));
  });

  test('custom billing cycle defaults to 12 months when customMonths omitted', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2026-08-01'),
      billingCycle: 'custom',
      today: TODAY,
    });
    expect(result).toEqual(date('2027-08-01'));
  });
});

// ─── First payment (no existing expiry) [BR-07] ───

describe('[BR-07] computeNewExpiry — first payment', () => {
  test('null expiry sets expiry to today + one cycle', () => {
    const result = computeNewExpiry({
      currentExpiry: null,
      billingCycle: 'annual',
      today: TODAY,
    });
    expect(result).toEqual(date('2027-06-15'));
  });

  test('null expiry with quarterly', () => {
    const result = computeNewExpiry({
      currentExpiry: null,
      billingCycle: 'quarterly',
      today: TODAY,
    });
    expect(result).toEqual(date('2026-09-15'));
  });
});

// ─── Severely lapsed member [BR-07] ───

describe('[BR-07] computeNewExpiry — severely lapsed', () => {
  test('expiry more than one cycle in the past resets from today', () => {
    // Annual cycle, expiry 2 years ago — severely lapsed
    const result = computeNewExpiry({
      currentExpiry: date('2024-01-01'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // Severely lapsed: reset from today
    expect(result).toEqual(date('2027-06-15'));
  });

  test('expiry exactly one cycle ago still uses standard extension', () => {
    // Exactly 12 months ago from TODAY (2026-06-15) = 2025-06-15
    const result = computeNewExpiry({
      currentExpiry: date('2025-06-15'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // NOT severely lapsed — extend from current expiry
    expect(result).toEqual(date('2026-06-15'));
  });

  test('expiry one day past the severe-lapse threshold resets from today', () => {
    // One day before the exact-one-cycle-ago boundary
    const result = computeNewExpiry({
      currentExpiry: date('2025-06-14'),
      billingCycle: 'annual',
      today: TODAY,
    });
    // This is MORE than one cycle ago — severely lapsed
    expect(result).toEqual(date('2027-06-15'));
  });
});

// ─── Edge cases ───

describe('[BR-07] computeNewExpiry — edge cases', () => {
  test('expiry in the future (early payment) extends from expiry', () => {
    const result = computeNewExpiry({
      currentExpiry: date('2027-01-01'),
      billingCycle: 'annual',
      today: TODAY,
    });
    expect(result).toEqual(date('2028-01-01'));
  });

  test('expiry today extends from today', () => {
    const result = computeNewExpiry({
      currentExpiry: TODAY,
      billingCycle: 'annual',
      today: TODAY,
    });
    expect(result).toEqual(date('2027-06-15'));
  });

  test('recently expired (within grace) extends from expiry', () => {
    // Expired 2 months ago — within one cycle
    const result = computeNewExpiry({
      currentExpiry: date('2026-04-15'),
      billingCycle: 'annual',
      today: TODAY,
    });
    expect(result).toEqual(date('2027-04-15'));
  });
});
