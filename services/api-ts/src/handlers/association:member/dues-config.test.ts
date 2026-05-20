// Business Rules: [BR-02] gracePeriodDays max 90 days
import { describe, test, expect } from 'bun:test';
import {
  DuesConfigCreateRequestSchema,
  DuesConfigUpdateRequestSchema,
} from '@/generated/openapi/validators';

/**
 * V-10: gracePeriodDays upper bound validation (max 90 days)
 *
 * TypeSpec should generate Zod validators with .lte(90) constraint.
 * These tests verify the generated validators reject values > 90.
 */

const validCreateBody = {
  organizationId: 'org-1',
  tierId: 'tier-1',
  annualAmount: 5000,
  currency: 'PHP',
  gracePeriodDays: 30,
  fundAllocations: [{ fundName: 'General', percentage: 100, isLast: true }],
  effectiveDate: '2026-01-01',
  status: 'active',
};

describe('gracePeriodDays upper bound — CreateDuesConfig', () => {
  test('rejects gracePeriodDays = 91 (above max)', () => {
    const result = DuesConfigCreateRequestSchema.safeParse({
      ...validCreateBody,
      gracePeriodDays: 91,
    });
    expect(result.success).toBe(false);
  });

  test('rejects gracePeriodDays = 365 (way above max)', () => {
    const result = DuesConfigCreateRequestSchema.safeParse({
      ...validCreateBody,
      gracePeriodDays: 365,
    });
    expect(result.success).toBe(false);
  });

  test('accepts gracePeriodDays = 90 (boundary max)', () => {
    const result = DuesConfigCreateRequestSchema.safeParse({
      ...validCreateBody,
      gracePeriodDays: 90,
    });
    expect(result.success).toBe(true);
  });

  test('accepts gracePeriodDays = 0 (boundary min)', () => {
    const result = DuesConfigCreateRequestSchema.safeParse({
      ...validCreateBody,
      gracePeriodDays: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('gracePeriodDays upper bound — UpdateDuesConfig', () => {
  test('rejects gracePeriodDays = 91 (above max)', () => {
    const result = DuesConfigUpdateRequestSchema.safeParse({
      gracePeriodDays: 91,
    });
    expect(result.success).toBe(false);
  });

  test('rejects gracePeriodDays = 365 (way above max)', () => {
    const result = DuesConfigUpdateRequestSchema.safeParse({
      gracePeriodDays: 365,
    });
    expect(result.success).toBe(false);
  });

  test('accepts gracePeriodDays = 90 (boundary max)', () => {
    const result = DuesConfigUpdateRequestSchema.safeParse({
      gracePeriodDays: 90,
    });
    expect(result.success).toBe(true);
  });

  test('accepts gracePeriodDays = 0 (boundary min)', () => {
    const result = DuesConfigUpdateRequestSchema.safeParse({
      gracePeriodDays: 0,
    });
    expect(result.success).toBe(true);
  });
});
