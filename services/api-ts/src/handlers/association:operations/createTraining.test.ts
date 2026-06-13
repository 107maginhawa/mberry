import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { TrainingCreateRequestSchema } from '@/generated/openapi/validators';
import { TrainingRepository } from './repos/training.repo';

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

describe('FIX-007 (G7a / M9-R1): training.type persists on create', () => {
  afterEach(() => restoreRepo(TrainingRepository));

  test('persists the validated type to the repository', async () => {
    const { createTraining } = await import('./createTraining');

    let captured: Record<string, unknown> | undefined;
    stubRepo(TrainingRepository, {
      createOne: async (data: Record<string, unknown>) => {
        captured = data;
        return { id: 'training-1', ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {
        title: 'CPD Workshop',
        organizationId: 'org-1',
        type: 'workshop',
        startDate: new Date('2026-07-01T09:00:00Z'),
        creditAmount: 2,
      },
    });

    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(captured).toBeDefined();
    // The handler must forward `type` to the persistence layer (M9-R1 taxonomy).
    expect(captured?.['type']).toBe('workshop');
  });
});

describe('FIX-013 (F6): createTraining binds to ctx org, ignores body.organizationId', () => {
  afterEach(() => restoreRepo(TrainingRepository));

  test('persists the ctx organizationId, NOT a foreign body.organizationId', async () => {
    const { createTraining } = await import('./createTraining');

    let captured: Record<string, unknown> | undefined;
    stubRepo(TrainingRepository, {
      createOne: async (data: Record<string, unknown>) => {
        captured = data;
        return { id: 'training-1', ...data };
      },
    });

    // The officer's resolved org context is org-ctx; a malicious/mistaken body
    // claims a DIFFERENT org. Org isolation requires the persisted training to
    // belong to the ctx org, never the body-supplied one.
    const ctx = makeCtx({
      organizationId: 'org-ctx',
      _body: {
        title: 'CPD Seminar',
        organizationId: 'org-foreign',
        type: 'seminar',
        startDate: new Date('2026-07-01T09:00:00Z'),
        creditAmount: 1,
      },
    });

    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(captured?.['organizationId']).toBe('org-ctx');
  });

  test('still binds to ctx org when body.organizationId is absent', async () => {
    const { createTraining } = await import('./createTraining');

    let captured: Record<string, unknown> | undefined;
    stubRepo(TrainingRepository, {
      createOne: async (data: Record<string, unknown>) => {
        captured = data;
        return { id: 'training-2', ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-ctx',
      _body: {
        title: 'CPD Webinar',
        type: 'webinar',
        startDate: new Date('2026-07-01T09:00:00Z'),
        creditAmount: 1,
      },
    });

    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(captured?.['organizationId']).toBe('org-ctx');
  });
});
