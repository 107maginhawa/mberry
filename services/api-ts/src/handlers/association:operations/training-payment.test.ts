/**
 * TC-DEC-01 (AHA Step 47) — paid-training PROOF-OF-PAYMENT flow.
 *
 * Decision (captured verbatim in training-credits-fix-report.md):
 *   Paid trainings are supported in V1 via proof-of-payment (module-local, no
 *   Stripe dependency). A paid enrollment is created in `payment_pending`; the
 *   member submits offline-payment proof (submitTrainingPaymentProof); an
 *   officer confirms it (confirmTrainingPayment), moving the enrollment to
 *   `enrolled`. The credit-award path (completeTrainingEnrollment) accepts only
 *   `enrolled → completed`, so no credit is awarded while payment is unconfirmed.
 *
 * The paid-enroll → payment_pending behaviour itself is covered in
 * training-enrollment.test.ts (BR-41 / TC-DEC-01). This file covers the two new
 * lifecycle handlers and the FSM guard.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo, makeMember } from '@/test-utils/make-ctx';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { ForbiddenError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';

const MEMBER = makeMember({ id: 'member-1' });

describe('[TC-DEC-01] submitTrainingPaymentProof', () => {
  beforeEach(() => restoreRepo(TrainingEnrollmentRepository));
  afterEach(() => restoreRepo(TrainingEnrollmentRepository));

  test('member attaches proof to their own payment_pending enrollment → 200, proof + paymentSubmittedAt stored, status unchanged', async () => {
    const { submitTrainingPaymentProof } = await import('./submitTrainingPaymentProof');
    let updatedWith: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', personId: 'member-1', status: 'payment_pending', trainingId: 't-paid' }),
      updateOneById: async (_id: string, data: any) => { updatedWith = data; return { id: 'e-1', status: 'payment_pending', ...data }; },
    });

    const ctx = makeCtx({
      user: MEMBER,
      _params: { enrollmentId: 'e-1' },
      _body: { proofStorageKey: 'proofs/e-1.png', proofFileName: 'receipt.png', proofMimeType: 'image/png' },
    });
    const res = await submitTrainingPaymentProof(ctx as any);

    expect(res.status).toBe(200);
    expect(updatedWith.proofStorageKey).toBe('proofs/e-1.png');
    expect(updatedWith.paymentSubmittedAt).toBeInstanceOf(Date);
    // Submitting proof must NOT itself flip the status — only an officer can.
    expect(updatedWith.status).toBeUndefined();
  });

  test('member cannot submit proof for someone else’s enrollment → ForbiddenError', async () => {
    const { submitTrainingPaymentProof } = await import('./submitTrainingPaymentProof');
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-2', personId: 'other-member', status: 'payment_pending' }),
      updateOneById: async () => { throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: MEMBER, _params: { enrollmentId: 'e-2' }, _body: { proofStorageKey: 'x' } });
    await expect(submitTrainingPaymentProof(ctx as any)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('cannot submit proof once the enrollment is no longer payment_pending → PAYMENT_NOT_PENDING', async () => {
    const { submitTrainingPaymentProof } = await import('./submitTrainingPaymentProof');
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-3', personId: 'member-1', status: 'enrolled' }),
      updateOneById: async () => { throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: MEMBER, _params: { enrollmentId: 'e-3' }, _body: { proofStorageKey: 'x' } });
    let thrown: unknown;
    try { await submitTrainingPaymentProof(ctx as any); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('PAYMENT_NOT_PENDING');
  });

  test('missing enrollment → NotFoundError', async () => {
    const { submitTrainingPaymentProof } = await import('./submitTrainingPaymentProof');
    stubRepo(TrainingEnrollmentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ user: MEMBER, _params: { enrollmentId: 'nope' }, _body: { proofStorageKey: 'x' } });
    await expect(submitTrainingPaymentProof(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('[TC-DEC-01] confirmTrainingPayment', () => {
  beforeEach(() => restoreRepo(TrainingEnrollmentRepository));
  afterEach(() => restoreRepo(TrainingEnrollmentRepository));

  test('officer confirms payment_pending → enrolled, records paymentConfirmedBy/At', async () => {
    const { confirmTrainingPayment } = await import('./confirmTrainingPayment');
    let updatedWith: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', personId: 'member-1', status: 'payment_pending' }),
      updateOneById: async (_id: string, data: any) => { updatedWith = data; return { id: 'e-1', ...data }; },
    });
    const ctx = makeCtx({ user: { id: 'officer-1', role: 'officer', twoFactorEnabled: true }, _params: { enrollmentId: 'e-1' } });
    const res = await confirmTrainingPayment(ctx as any);

    expect(res.status).toBe(200);
    expect(updatedWith.status).toBe('enrolled');
    expect(updatedWith.paymentConfirmedBy).toBe('officer-1');
    expect(updatedWith.paymentConfirmedAt).toBeInstanceOf(Date);
  });

  test('confirming an already-enrolled (non-paid) enrollment is rejected by the FSM → ConflictError', async () => {
    const { confirmTrainingPayment } = await import('./confirmTrainingPayment');
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-9', personId: 'member-1', status: 'enrolled' }),
      updateOneById: async () => { throw new Error('must not update'); },
    });
    const ctx = makeCtx({ user: { id: 'officer-1', role: 'officer', twoFactorEnabled: true }, _params: { enrollmentId: 'e-9' } });
    await expect(confirmTrainingPayment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('missing enrollment → NotFoundError', async () => {
    const { confirmTrainingPayment } = await import('./confirmTrainingPayment');
    stubRepo(TrainingEnrollmentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ user: { id: 'officer-1', role: 'officer', twoFactorEnabled: true }, _params: { enrollmentId: 'nope' } });
    await expect(confirmTrainingPayment(ctx as any)).rejects.toBeInstanceOf(NotFoundError);
  });
});
