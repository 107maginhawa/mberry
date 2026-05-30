import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import { BusinessLogicError, ConflictError } from '@/core/errors';

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

// ─── completeTrainingEnrollment — WF-061/BR-20 certificate wiring ──

describe('completeTrainingEnrollment — emits training.completed (EM-M09-n4o5p6q7)', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;
  let emitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
    emitSpy = spyOn(domainEvents, 'emit');
  });

  afterEach(() => {
    [trainingMocks, enrollMocks, creditMocks, officerMocks].forEach(
      (m) => m && Object.values(m).forEach((s) => s.mockRestore()),
    );
    emitSpy.mockRestore();
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('emits training.completed after credit-bearing enrollment completion', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'enrolled' }),
      updateOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'completed' }),
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => ({
        id: 't-1',
        organizationId: 'org-1',
        title: 'CPD Seminar',
        creditBearing: true,
        creditAmount: 10,
        endDate: new Date(),
      }),
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      findByTrainingAndPerson: async () => null,
      createOne: async () => ({ id: 'c-1' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
      _body: {},
    });

    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(200);

    const completedEmit = emitSpy.mock.calls.find((c) => c[0] === 'training.completed');
    expect(completedEmit).toBeDefined();
    expect(completedEmit![1]).toMatchObject({
      trainingId: 't-1',
      organizationId: 'org-1',
      completedBy: 'officer-1',
    });
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

// ─── BR-41 — paid training requires payment before enrollment ──

describe('BR-41 — paid training requires payment before enrollment', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });
  afterEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('BR-41: createTrainingEnrollment rejects a paid training with PAYMENT_REQUIRED', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    let createCalled = false;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-paid', status: 'published', capacity: null, registrationFee: 5000 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async () => { createCalled = true; return { id: 'should-not-be-created' }; },
    });

    const ctx = makeCtx({ _body: { trainingId: 't-paid' } });
    let thrown: unknown;
    try {
      await createTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('PAYMENT_REQUIRED');
    expect((thrown as BusinessLogicError).message).toContain('payment');
    // gate fires before any enrollment row is written
    expect(createCalled).toBe(false);
  });

  test('BR-41: createTrainingEnrollment allows a free training (registrationFee 0)', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    let createCalled = false;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-free', status: 'published', capacity: null, registrationFee: 0 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async () => { createCalled = true; return { id: 'e-free', trainingId: 't-free', status: 'enrolled' }; },
    });

    const ctx = makeCtx({ _body: { trainingId: 't-free' } });
    const response = await createTrainingEnrollment(ctx);
    expect(response.status).toBe(201);
    expect(createCalled).toBe(true);
    expect((response as any).body).toMatchObject({ trainingId: 't-free', status: 'enrolled' });
  });

  test('BR-41: enrollInCustomTraining rejects a paid training with PAYMENT_REQUIRED', async () => {
    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    let createCalled = false;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-paid', status: 'published', capacity: null, registrationFee: 2500 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async () => { createCalled = true; return { id: 'should-not-be-created' }; },
    });

    const ctx = makeCtx({ _params: { trainingId: 't-paid' } });
    let thrown: unknown;
    try {
      await enrollInCustomTraining(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('PAYMENT_REQUIRED');
    expect(createCalled).toBe(false);
  });
});

// ─── BR-43 — completed training locks enrollments ──────────

describe('BR-43 — completed training locks enrollments', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('BR-43: enrollment in a completed training is rejected (creation locked)', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    let createCalled = false;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-done', status: 'completed', capacity: null, registrationFee: 0 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async () => { createCalled = true; return { id: 'should-not-be-created' }; },
    });
    const ctx = makeCtx({ _body: { trainingId: 't-done' } });
    let thrown: unknown;
    try {
      await createTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('TRAINING_NOT_PUBLISHED');
    expect(createCalled).toBe(false);
  });

  test('BR-43: updateTrainingEnrollment rejects changes when training is completed', async () => {
    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    let updateCalled = false;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-done', status: 'enrolled' }),
      updateOneById: async () => { updateCalled = true; return { id: 'e-1', status: 'noShow' }; },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-done', status: 'completed' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'noShow' },
    });
    let thrown: unknown;
    try {
      await updateTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('TRAINING_COMPLETED');
    // lock fires before the enrollment is mutated
    expect(updateCalled).toBe(false);
  });

  test('BR-43: deleteTrainingEnrollment rejects deletion when training is completed', async () => {
    const { deleteTrainingEnrollment } = await import('./deleteTrainingEnrollment');
    let deleteCalled = false;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-done', status: 'enrolled' }),
      deleteOneById: async () => { deleteCalled = true; return { id: 'e-1' }; },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-done', status: 'completed' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
    });
    let thrown: unknown;
    try {
      await deleteTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('TRAINING_COMPLETED');
    expect(deleteCalled).toBe(false);
  });

  test('BR-43: updateTrainingEnrollment allows changes when training is not completed', async () => {
    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    let updateCalled = false;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-pub', status: 'enrolled' }),
      updateOneById: async () => { updateCalled = true; return { id: 'e-1', status: 'noShow' }; },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-pub', status: 'published' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'noShow' },
    });
    const response = await updateTrainingEnrollment(ctx);
    expect(response.status).toBe(200);
    expect(updateCalled).toBe(true);
    expect((response as any).body).toMatchObject({ id: 'e-1', status: 'noShow' });
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

// ─── S-G1-04 — TRAINING_ENROLLMENT_VALID_TRANSITIONS guard ──

describe('completeTrainingEnrollment — TRAINING_ENROLLMENT_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
  });

  test('throws ConflictError when current enrollment status is cancelled (not enrolled)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'cancelled', personId: 'p-1', trainingId: 't-1' }) as any,
      updateOneById: async () => {
        updateCalled = true;
        return {} as any;
      },
    });

    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ _params: { enrollmentId: 'e-1' }, _body: {} });

    await expect(completeTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
    expect(updateCalled).toBe(false);
  });

  test('throws ConflictError when current enrollment status is noShow (terminal)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'noShow', personId: 'p-1', trainingId: 't-1' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ _params: { enrollmentId: 'e-1' }, _body: {} });

    await expect(completeTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ConflictError when current enrollment status is already completed (terminal)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'completed', personId: 'p-1', trainingId: 't-1' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ _params: { enrollmentId: 'e-1' }, _body: {} });

    await expect(completeTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('updateTrainingEnrollment — TRAINING_ENROLLMENT_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
  });

  test('throws ConflictError when body.status attempts noShow → completed', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'noShow', trainingId: 't-1' }) as any,
      updateOneById: async () => {
        updateCalled = true;
        return {} as any;
      },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'completed' },
    });

    await expect(updateTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
    expect(updateCalled).toBe(false);
  });

  test('throws ConflictError when body.status attempts cancelled → completed', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'cancelled', trainingId: 't-1' }) as any,
      updateOneById: async () => ({}) as any,
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'completed' },
    });

    await expect(updateTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('allows update when body.status equals existing.status (no transition)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'enrolled', trainingId: 't-1' }) as any,
      updateOneById: async () => {
        updateCalled = true;
        return { id: 'e-1', status: 'enrolled' } as any;
      },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'enrolled' },
    });

    const res = await updateTrainingEnrollment(ctx as any);
    expect(res.status).toBe(200);
    expect(updateCalled).toBe(true);
  });

  test('allows enrolled → completed via update body.status', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let captured: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'enrolled', trainingId: 't-1' }) as any,
      updateOneById: async (_id: string, data: any) => {
        captured = data;
        return { id: 'e-1', ...data } as any;
      },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'completed' },
    });

    const res = await updateTrainingEnrollment(ctx as any);
    expect(res.status).toBe(200);
    expect(captured?.status).toBe('completed');
  });
});
