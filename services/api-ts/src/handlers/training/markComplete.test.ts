import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { markComplete } from './markComplete';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';

const fakeTraining = {
  id: 'training-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'completed',
  capacity: 50,
  creditAmount: 8,
  endDate: new Date('2024-01-01'), // Past date — BR-20 requires activity to have ended
};

const fakeEnrollment = {
  id: 'enroll-1',
  tenantId: 'org-1',
  trainingId: 'training-1',
  personId: 'person-1',
  status: 'enrolled',
  enrolledAt: new Date(),
  completedAt: null,
  cancelledAt: null,
};

describe('markComplete', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('marks enrollment as completed and returns 201', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('completed');
  });

  test('throws NotFoundError when training does not exist', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => undefined,
      getEnrollmentCount: async () => 0,
      listEnrollments: async () => [],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-id' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Training not found');
  });

  test('throws ConflictError when no active enrollment exists', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 0,
      listEnrollments: async () => [],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('No active enrollment found');
  });

  test('throws NotFoundError when person is not enrolled', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{ ...fakeEnrollment, personId: 'other-person' }],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Enrollment not found');
  });

  test('throws ConflictError when already completed', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{
        ...fakeEnrollment,
        status: 'completed',
        completedAt: new Date(),
      }],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Already marked as completed');
  });

  // ─── [BR-13] Auto-credit creation ─────────────────────

  test('[BR-13] creates auto credit entry for credit-bearing training', async () => {
    let creditCreated: any = null;
    mocks = stubRepo(TrainingRepository, {
      get: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    // Also stub credit repo
    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();
    expect(creditCreated.type).toBe('auto');
    expect(creditCreated.trainingId).toBe('training-1');
    expect(creditCreated.creditAmount).toBe(8);
    expect(creditCreated.personId).toBe('person-1');

    Object.values(creditMock).forEach((m) => m.mockRestore());
  });

  test('[BR-13] skips credit creation for non-credit-bearing training', async () => {
    let creditCreated = false;
    mocks = stubRepo(TrainingRepository, {
      get: async () => ({ ...fakeTraining, creditAmount: 0 }),
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCreated = true; return {} as any; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    await markComplete(ctx);
    expect(creditCreated).toBe(false);

    Object.values(creditMock).forEach((m) => m.mockRestore());
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      get: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      database: undefined,
      _params: { id: 'training-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow();
  });
});
