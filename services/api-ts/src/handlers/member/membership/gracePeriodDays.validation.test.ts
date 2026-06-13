import { describe, test, expect } from 'bun:test';
import {
  MembershipUpdateRequestSchema,
  MembershipCreateRequestSchema,
} from '@/generated/openapi/validators';

/**
 * FIX-020 / BR-02: gracePeriodDays must be within 0–90. The TypeSpec models
 * had a bare `int32`, so the generated validators accepted any integer — an
 * out-of-range grace period was silently stored. These assert the regenerated
 * @minValue(0)/@maxValue(90) constraint.
 */
describe('gracePeriodDays range validation (FIX-020 / BR-02)', () => {
  const createBase = {
    personId: 'p-1',
    organizationId: 'org-1',
    tierId: 'tier-1',
    startDate: '2026-01-01',
    duesExpiryDate: '2026-12-31',
  };

  test('MembershipUpdateRequest rejects gracePeriodDays above 90', () => {
    expect(MembershipUpdateRequestSchema.safeParse({ gracePeriodDays: 200 }).success).toBe(false);
  });

  test('MembershipUpdateRequest rejects negative gracePeriodDays', () => {
    expect(MembershipUpdateRequestSchema.safeParse({ gracePeriodDays: -5 }).success).toBe(false);
  });

  test('MembershipUpdateRequest accepts gracePeriodDays within 0–90', () => {
    expect(MembershipUpdateRequestSchema.safeParse({ gracePeriodDays: 30 }).success).toBe(true);
    expect(MembershipUpdateRequestSchema.safeParse({ gracePeriodDays: 0 }).success).toBe(true);
    expect(MembershipUpdateRequestSchema.safeParse({ gracePeriodDays: 90 }).success).toBe(true);
  });

  test('MembershipCreateRequest rejects gracePeriodDays above 90', () => {
    expect(MembershipCreateRequestSchema.safeParse({ ...createBase, gracePeriodDays: 200 }).success).toBe(false);
  });

  test('MembershipCreateRequest accepts a valid gracePeriodDays', () => {
    expect(MembershipCreateRequestSchema.safeParse({ ...createBase, gracePeriodDays: 30 }).success).toBe(true);
  });
});
