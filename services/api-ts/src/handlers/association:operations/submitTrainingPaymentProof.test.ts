/**
 * Co-located unit test for submitTrainingPaymentProof.
 *
 * TC-DEC-01 (AHA Step 47) proof-of-payment: a member attaches offline-payment
 * proof to their OWN payment_pending enrollment. Submitting proof records it for
 * officer review but does NOT itself flip the enrollment status.
 *
 * Mirrors the mocking/setup style of the sibling aggregated suite
 * (training-payment.test.ts): bun:test runner + the @/test-utils/make-ctx shim,
 * with the repo stubbed via stubRepo/restoreRepo so no real DB is required.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo, makeMember } from '@/test-utils/make-ctx';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { ForbiddenError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { submitTrainingPaymentProof } from './submitTrainingPaymentProof';

const MEMBER = makeMember({ id: 'member-1' });

describe('submitTrainingPaymentProof', () => {
  beforeEach(() => restoreRepo(TrainingEnrollmentRepository));
  afterEach(() => restoreRepo(TrainingEnrollmentRepository));

  test('happy path: member attaches proof to their own payment_pending enrollment → 200, proof + paymentSubmittedAt persisted, status NOT flipped', async () => {
    let updatedWith: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', personId: 'member-1', status: 'payment_pending', trainingId: 't-paid' }),
      updateOneById: async (_id: string, data: any) => {
        updatedWith = data;
        return { id: 'e-1', status: 'payment_pending', ...data };
      },
    });

    const ctx = makeCtx({
      user: MEMBER,
      _params: { enrollmentId: 'e-1' },
      _body: { proofStorageKey: 'proofs/e-1.png', proofFileName: 'receipt.png', proofMimeType: 'image/png' },
    });
    const res = await submitTrainingPaymentProof(ctx as any);

    expect(res.status).toBe(200);
    // The mock ctx.json returns { status, body }; the handler echoes the updated row.
    expect((res as any).body.id).toBe('e-1');
    expect(updatedWith.proofStorageKey).toBe('proofs/e-1.png');
    expect(updatedWith.proofFileName).toBe('receipt.png');
    expect(updatedWith.proofMimeType).toBe('image/png');
    expect(updatedWith.paymentSubmittedAt).toBeInstanceOf(Date);
    // Submitting proof must NOT itself flip the status — only an officer can.
    expect(updatedWith.status).toBeUndefined();
    // Handler exposes the enrollment id to the audit middleware.
    expect(ctx.get('auditResourceId')).toBe('e-1');
  });

  test('optional proof fields default to null when omitted', async () => {
    let updatedWith: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-4', personId: 'member-1', status: 'payment_pending' }),
      updateOneById: async (_id: string, data: any) => {
        updatedWith = data;
        return { id: 'e-4', ...data };
      },
    });

    const ctx = makeCtx({
      user: MEMBER,
      _params: { enrollmentId: 'e-4' },
      _body: { proofStorageKey: 'proofs/e-4.pdf' },
    });
    const res = await submitTrainingPaymentProof(ctx as any);

    expect(res.status).toBe(200);
    expect(updatedWith.proofStorageKey).toBe('proofs/e-4.pdf');
    expect(updatedWith.proofFileName).toBeNull();
    expect(updatedWith.proofMimeType).toBeNull();
  });

  test('ownership guard: member cannot submit proof for someone else’s enrollment → ForbiddenError, no update', async () => {
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-2', personId: 'other-member', status: 'payment_pending' }),
      updateOneById: async () => { throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: MEMBER, _params: { enrollmentId: 'e-2' }, _body: { proofStorageKey: 'x' } });
    await expect(submitTrainingPaymentProof(ctx as any)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('state guard: cannot submit proof once the enrollment is no longer payment_pending → PAYMENT_NOT_PENDING', async () => {
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-3', personId: 'member-1', status: 'enrolled' }),
      updateOneById: async () => { throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: MEMBER, _params: { enrollmentId: 'e-3' }, _body: { proofStorageKey: 'x' } });
    let thrown: unknown;
    try {
      await submitTrainingPaymentProof(ctx as any);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('PAYMENT_NOT_PENDING');
  });

  test('missing enrollment → NotFoundError', async () => {
    stubRepo(TrainingEnrollmentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ user: MEMBER, _params: { enrollmentId: 'nope' }, _body: { proofStorageKey: 'x' } });
    await expect(submitTrainingPaymentProof(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });
});
