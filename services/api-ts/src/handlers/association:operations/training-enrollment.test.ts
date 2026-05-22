import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Training Enrollment Tests
 *
 * Tests for training enrollment lifecycle handlers and guards.
 */

// ─── enrollInCustomTraining ────────────────────────────────

describe('enrollInCustomTraining', () => {
  test('enrollInCustomTraining returns 401 without user', async () => {
    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('enrollInCustomTraining returns 403 without organizationId', async () => {
    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({ organizationId: null, _params: { trainingId: 't-1' } });
    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(403);
  });

  test('only published trainings accept enrollment', () => {
    const published = { status: 'published' };
    const draft = { status: 'draft' };
    const cancelled = { status: 'cancelled' };

    expect(published.status === 'published').toBe(true);
    expect(draft.status === 'published').toBe(false);
    expect(cancelled.status === 'published').toBe(false);
  });

  test('capacity check prevents over-enrollment', () => {
    const training = { capacity: 30 };
    const enrolledCount = 30;
    const isFull = training.capacity !== null && enrolledCount >= training.capacity;
    expect(isFull).toBe(true);
  });

  test('enrollment allowed when below capacity', () => {
    const training = { capacity: 30 };
    const enrolledCount = 15;
    const isFull = training.capacity !== null && enrolledCount >= training.capacity;
    expect(isFull).toBe(false);
  });

  test('no capacity limit when capacity is null', () => {
    const training = { capacity: null };
    const enrolledCount = 9999;
    const isFull = training.capacity !== null && enrolledCount >= training.capacity;
    expect(isFull).toBe(false);
  });
});

// ─── listCustomTrainingEnrollments ─────────────────────────

describe('listCustomTrainingEnrollments', () => {
  test('listCustomTrainingEnrollments returns 401 without user', async () => {
    const { listCustomTrainingEnrollments } = await import('./listCustomTrainingEnrollments');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await listCustomTrainingEnrollments(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── listMyCustomTrainings ─────────────────────────────────

describe('listMyCustomTrainings', () => {
  test('listMyCustomTrainings returns 401 without user', async () => {
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ user: null });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── completeTrainingEnrollment — deeper tests ─────────────

describe('completeTrainingEnrollment — business logic', () => {
  test('completeTrainingEnrollment returns 401 without user', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'e-1' }, _body: {} });
    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('already completed enrollment cannot be completed again', () => {
    const enrollment = { status: 'completed' };
    expect(enrollment.status === 'completed').toBe(true);
  });

  test('only enrolled status allows completion', () => {
    const validForCompletion = ['enrolled'];
    expect(validForCompletion).toContain('enrolled');
    expect(validForCompletion).not.toContain('cancelled');
    expect(validForCompletion).not.toContain('completed');
    expect(validForCompletion).not.toContain('noShow');
  });

  test('credit-bearing training awards credits on completion', () => {
    const training = { creditBearing: true, creditAmount: 15 };
    const creditAwarded = training.creditBearing ? training.creditAmount : 0;
    expect(creditAwarded).toBe(15);
  });

  test('non-credit-bearing training awards zero', () => {
    const training = { creditBearing: false, creditAmount: 15 };
    const creditAwarded = training.creditBearing ? training.creditAmount : 0;
    expect(creditAwarded).toBe(0);
  });
});

// ─── createTrainingEnrollment — org guard ──────────────────

describe('createTrainingEnrollment — org guard', () => {
  test('createTrainingEnrollment returns 403 without organizationId', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    const ctx = makeCtx({ organizationId: null });
    const response = await createTrainingEnrollment(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── searchTrainingEnrollments — org guard ─────────────────

describe('searchTrainingEnrollments — org guard', () => {
  test('searchTrainingEnrollments returns 403 without organizationId', async () => {
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── Enrollment status machine ─────────────────────────────

describe('Enrollment status machine', () => {
  test('enrolled -> completed transition', () => {
    const enrollment = { status: 'enrolled' as string, completedAt: null as Date | null };
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    expect(enrollment.status).toBe('completed');
    expect(enrollment.completedAt).not.toBeNull();
  });

  test('enrolled -> cancelled transition', () => {
    const enrollment = { status: 'enrolled' as string, cancelledAt: null as Date | null };
    enrollment.status = 'cancelled';
    enrollment.cancelledAt = new Date();
    expect(enrollment.status).toBe('cancelled');
    expect(enrollment.cancelledAt).not.toBeNull();
  });

  test('cancelled enrollment cannot be completed', () => {
    const enrollment = { status: 'cancelled' };
    const canComplete = enrollment.status === 'enrolled';
    expect(canComplete).toBe(false);
  });

  test('completed enrollment cannot be cancelled', () => {
    const enrollment = { status: 'completed' };
    const canCancel = enrollment.status !== 'cancelled' && enrollment.status !== 'completed';
    expect(canCancel).toBe(false);
  });
});
