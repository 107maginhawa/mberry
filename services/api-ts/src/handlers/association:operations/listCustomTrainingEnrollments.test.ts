import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listCustomTrainingEnrollments } from './listCustomTrainingEnrollments';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('listCustomTrainingEnrollments — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { trainingId: 'tr-1' } });
    const response = await listCustomTrainingEnrollments(ctx);
    expect(response.status).toBe(401);
  });
});

describe('listCustomTrainingEnrollments — business logic', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (enrollMocks) Object.values(enrollMocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('returns enrollments with total for existing training', async () => {
    const training = { id: 'tr-1', title: 'BLS Training' };
    const enrollments = [
      { id: 'enr-1', trainingId: 'tr-1', personId: 'p-1', status: 'enrolled' },
      { id: 'enr-2', trainingId: 'tr-1', personId: 'p-2', status: 'completed' },
    ];
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => training,
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => enrollments,
    });

    const ctx = makeCtx({
      _params: { trainingId: 'tr-1' },
      _query: {},
    });
    const response = await listCustomTrainingEnrollments(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(2);
    expect((response as any).body.total).toBe(2);
  });

  test('throws NotFoundError when training does not exist', async () => {
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { trainingId: 'no-such-training' },
      _query: {},
    });
    await expect(listCustomTrainingEnrollments(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('applies status filter when provided in query', async () => {
    const training = { id: 'tr-1', title: 'BLS Training' };
    let capturedFilters: any = {};
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => training,
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
    });

    const ctx = makeCtx({
      _params: { trainingId: 'tr-1' },
      _query: { status: 'completed' },
    });
    await listCustomTrainingEnrollments(ctx);
    expect(capturedFilters.status).toBe('completed');
    expect(capturedFilters.trainingId).toBe('tr-1');
  });

  test('does not apply status filter when absent from query', async () => {
    const training = { id: 'tr-1' };
    let capturedFilters: any = {};
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => training,
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
    });

    const ctx = makeCtx({
      _params: { trainingId: 'tr-1' },
      _query: {},
    });
    await listCustomTrainingEnrollments(ctx);
    expect(capturedFilters.status).toBeUndefined();
    expect(capturedFilters.trainingId).toBe('tr-1');
  });

  test('total matches enrollment array length', async () => {
    const training = { id: 'tr-1' };
    const enrollments = Array.from({ length: 7 }, (_, i) => ({ id: `enr-${i}`, trainingId: 'tr-1' }));
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => training });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, { findMany: async () => enrollments });

    const ctx = makeCtx({
      _params: { trainingId: 'tr-1' },
      _query: {},
    });
    const response = await listCustomTrainingEnrollments(ctx);
    expect((response as any).body.total).toBe(7);
    expect((response as any).body.data).toHaveLength(7);
  });
});
