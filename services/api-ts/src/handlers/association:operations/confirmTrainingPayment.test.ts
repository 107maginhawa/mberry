/**
 * Co-located unit test for confirmTrainingPayment (TC-DEC-01, AHA Step 47).
 *
 * Officer confirms an offline proof-of-payment for a `payment_pending`
 * enrollment, moving it to `enrolled`. The FSM guard rejects confirming an
 * enrollment that is not payment_pending (ConflictError). A missing enrollment
 * raises NotFoundError. No user → 401; no org context → 403.
 *
 * Mirrors the aggregated sibling (training-payment.test.ts) mocking/setup:
 * makeCtx + stubRepo/restoreRepo on TrainingEnrollmentRepository, no real DB.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { NotFoundError, ConflictError } from '@/core/errors';
import { confirmTrainingPayment } from './confirmTrainingPayment';

const OFFICER = { id: 'officer-1', role: 'officer', twoFactorEnabled: true };

describe('confirmTrainingPayment', () => {
  beforeEach(() => restoreRepo(TrainingEnrollmentRepository));
  afterEach(() => restoreRepo(TrainingEnrollmentRepository));

  test('officer confirms payment_pending → 200 enrolled, records paymentConfirmedBy/At + audit', async () => {
    let updatedId: string | null = null;
    let updatedWith: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', personId: 'member-1', status: 'payment_pending' }),
      updateOneById: async (id: string, data: any) => {
        updatedId = id;
        updatedWith = data;
        return { id, ...data };
      },
    });

    const ctx = makeCtx({ user: OFFICER, _params: { enrollmentId: 'e-1' } });
    const res = await confirmTrainingPayment(ctx as any);

    expect(res.status).toBe(200);
    expect(updatedId).toBe('e-1');
    expect(updatedWith.status).toBe('enrolled');
    expect(updatedWith.paymentConfirmedBy).toBe('officer-1');
    expect(updatedWith.paymentConfirmedAt).toBeInstanceOf(Date);
    // Audit fields the per-route middleware composes from.
    expect(ctx.get('auditResourceId')).toBe('e-1');
    expect(ctx.get('auditDescription')).toBe('Training payment confirmed by officer');
    // The persisted row is echoed back to the caller.
    expect((res as any).body).toMatchObject({ id: 'e-1', status: 'enrolled' });
  });

  test('confirming an already-enrolled (non-paid) enrollment is rejected by the FSM → ConflictError, no write', async () => {
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-9', personId: 'member-1', status: 'enrolled' }),
      updateOneById: async () => { updateCalled = true; throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: OFFICER, _params: { enrollmentId: 'e-9' } });

    await expect(confirmTrainingPayment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
    expect(updateCalled).toBe(false);
  });

  test('missing enrollment → NotFoundError', async () => {
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => null,
      updateOneById: async () => { throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: OFFICER, _params: { enrollmentId: 'nope' } });

    await expect(confirmTrainingPayment(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('no authenticated user → 401 Unauthorized, repo never touched', async () => {
    let findCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => { findCalled = true; return null; },
    });
    const ctx = makeCtx({ user: null, session: null, _params: { enrollmentId: 'e-1' } });
    const res = await confirmTrainingPayment(ctx as any);

    expect(res.status).toBe(401);
    expect((res as any).body).toEqual({ error: 'Unauthorized' });
    expect(findCalled).toBe(false);
  });

  test('missing organization context → 403 Forbidden', async () => {
    const ctx = makeCtx({ user: OFFICER, organizationId: undefined, _params: { enrollmentId: 'e-1' } });
    const res = await confirmTrainingPayment(ctx as any);

    expect(res.status).toBe(403);
    expect((res as any).body).toEqual({ error: 'Organization context required' });
  });
});
