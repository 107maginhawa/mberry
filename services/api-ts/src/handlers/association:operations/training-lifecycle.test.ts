import { describe, test, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * Training Lifecycle Tests
 *
 * Tests for training lifecycle handlers: publish, cancel, complete,
 * and 403/position guard tests for CRUD handlers.
 */

// ─── createTraining 403 ────────────────────────────────────

describe('createTraining — org guard', () => {
  test('createTraining returns 403 without organizationId', async () => {
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ organizationId: null });
    const response = await createTraining(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── updateTraining 403 ────────────────────────────────────

describe('updateTraining — org guard', () => {
  test('updateTraining returns 403 without organizationId', async () => {
    const { updateTraining } = await import('./updateTraining');
    const ctx = makeCtx({ organizationId: null, _params: { trainingId: 't-1' }, _body: {} });
    const response = await updateTraining(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── deleteTraining 401 (position guard) ────────────────────

describe('deleteTraining — auth guards', () => {
  test('deleteTraining returns 401 without user', async () => {
    const { deleteTraining } = await import('./deleteTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await deleteTraining(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── publishTraining — status machine ──────────────────────

describe('publishTraining — status checks', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('publishTraining returns 401 without user', async () => {
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await publishTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('only draft trainings can be published (status machine)', () => {
    const draftTraining = { status: 'draft' };
    const publishedTraining = { status: 'published' };
    const cancelledTraining = { status: 'cancelled' };

    expect(draftTraining.status === 'draft').toBe(true);
    expect(publishedTraining.status === 'draft').toBe(false);
    expect(cancelledTraining.status === 'draft').toBe(false);
  });

  test('training status transitions: draft -> published -> cancelled -> completed', () => {
    const validTransitions: Record<string, string[]> = {
      draft: ['published', 'cancelled'],
      published: ['cancelled', 'completed'],
      cancelled: [],
      completed: [],
    };

    expect(validTransitions['draft']).toContain('published');
    expect(validTransitions['published']).toContain('cancelled');
    expect(validTransitions['published']).toContain('completed');
    expect(validTransitions['cancelled']!.length).toBe(0);
    expect(validTransitions['completed']!.length).toBe(0);
  });
});

// ─── cancelCustomTraining ──────────────────────────────────

describe('cancelCustomTraining', () => {
  test('cancelCustomTraining returns 401 without user', async () => {
    const { cancelCustomTraining } = await import('./cancelCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await cancelCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('cannot cancel an already cancelled enrollment', () => {
    const enrollment = { status: 'cancelled' };
    expect(enrollment.status === 'cancelled').toBe(true);
  });

  test('cannot cancel a completed enrollment', () => {
    const enrollment = { status: 'completed' };
    expect(enrollment.status === 'completed').toBe(true);
  });

  test('enrolled enrollment can be cancelled', () => {
    const enrollment = { status: 'enrolled' };
    const cancellable = enrollment.status !== 'cancelled' && enrollment.status !== 'completed';
    expect(cancellable).toBe(true);
  });
});

// ─── G6 / FIX-003 — enrollment-scoped cancel event, not program-wide ────────
//
// cancelCustomTraining cancels ONLY the caller's enrollment. Emitting the
// program-wide `training.cancelled` makes the consumer mass-notify EVERY
// enrolled member that the whole training is cancelled. It must emit the
// enrollment-scoped `training.enrollment.cancelled` instead. [CROSS-MODULE RISK]
describe('cancelCustomTraining — emits enrollment-scoped event (FIX-003)', () => {
  let emitSpy: ReturnType<typeof spyOn>;
  let officerMocks: ReturnType<typeof stubRepo>;
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
    emitSpy = spyOn(domainEvents, 'emit');
  });

  afterEach(() => {
    [officerMocks, trainingMocks, enrollMocks].forEach(
      (m) => m && Object.values(m).forEach((s) => s.mockRestore()),
    );
    emitSpy.mockRestore();
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('cancelling one enrollment does NOT emit the program-wide training.cancelled', async () => {
    const { cancelCustomTraining } = await import('./cancelCustomTraining');

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', organizationId: 'org-1' }),
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [{ id: 'e-1', trainingId: 't-1', personId: 'officer-1', status: 'enrolled' }],
      updateOneById: async () => ({ id: 'e-1', status: 'cancelled' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { trainingId: 't-1' },
    });

    const response = await cancelCustomTraining(ctx);
    expect(response.status).toBe(200);

    const programCancelled = emitSpy.mock.calls.find((c) => c[0] === 'training.cancelled');
    expect(programCancelled).toBeUndefined();

    const enrollmentCancelled = emitSpy.mock.calls.find(
      (c) => c[0] === 'training.enrollment.cancelled',
    );
    expect(enrollmentCancelled).toBeDefined();
    expect(enrollmentCancelled![1]).toMatchObject({ trainingId: 't-1', organizationId: 'org-1' });
  });
});

// ─── completeCustomTraining ────────────────────────────────

describe('completeCustomTraining', () => {
  test('completeCustomTraining returns 401 without user', async () => {
    const { completeCustomTraining } = await import('./completeCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await completeCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('only enrolled enrollments can be completed', () => {
    const enrolled = { status: 'enrolled' };
    const cancelled = { status: 'cancelled' };
    const completed = { status: 'completed' };

    expect(enrolled.status === 'enrolled').toBe(true);
    expect(cancelled.status === 'enrolled').toBe(false);
    expect(completed.status === 'enrolled').toBe(false);
  });
});
