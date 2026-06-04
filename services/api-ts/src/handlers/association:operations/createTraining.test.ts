import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { TrainingCreateRequestSchema } from '@/generated/openapi/validators';

/**
 * createTraining tests
 *
 * Covers guards (auth, org context) and BR-42 (M9-R1):
 * training type restricted to platform-defined types
 * ("seminar" | "workshop" | "webinar" | "self_paced" | "hands_on").
 */

describe('createTraining — guards', () => {
  test('returns 401 without user', async () => {
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ user: null });
    const response = await createTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ organizationId: null });
    const response = await createTraining(ctx);
    expect(response.status).toBe(403);
  });
});

describe('BR-42 (M9-R1): training type restricted to platform-defined types', () => {
  const VALID_TYPES = ['seminar', 'workshop', 'webinar', 'self_paced', 'hands_on'] as const;

  function baseBody() {
    return {
      title: 'CPD Seminar',
      organizationId: 'org-1',
      startDate: '2026-07-01T09:00:00Z',
      creditAmount: 1,
    };
  }

  for (const type of VALID_TYPES) {
    test(`accepts type="${type}"`, () => {
      const result = TrainingCreateRequestSchema.safeParse({ ...baseBody(), type });
      expect(result.success).toBe(true);
    });
  }

  test('rejects unknown type with VALIDATION_ERROR shape', () => {
    const result = TrainingCreateRequestSchema.safeParse({ ...baseBody(), type: 'masterclass' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const typeIssue = result.error.issues.find((i) => i.path[0] === 'type');
      expect(typeIssue).toBeDefined();
      expect(typeIssue?.code).toBe('invalid_value');
    }
  });

  test('rejects missing type', () => {
    const result = TrainingCreateRequestSchema.safeParse(baseBody());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'type')).toBe(true);
    }
  });
});
