import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteTraining } from './deleteTraining';
import { TrainingRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('deleteTraining — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await deleteTraining(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteTraining — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
  });

  test('returns success on delete', async () => {
    const existing = { id: 't-1', title: 'CPD Training', status: 'published', organizationId: 'org-1' };
    mocks = stubRepo(TrainingRepository, {
      findOneById: async () => existing,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { trainingId: 't-1' } });
    const response = await deleteTraining(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.success).toBe(true);
  });

  test('throws NotFoundError when training not found', async () => {
    mocks = stubRepo(TrainingRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { trainingId: 'no-such-training' } });
    await expect(deleteTraining(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('calls deleteOneById with correct trainingId', async () => {
    const existing = { id: 't-33', title: 'Training', status: 'draft', organizationId: 'org-1' };
    let deletedId = '';
    mocks = stubRepo(TrainingRepository, {
      findOneById: async () => existing,
      deleteOneById: async (id: string) => { deletedId = id; return undefined; },
    });

    const ctx = makeCtx({ _params: { trainingId: 't-33' } });
    await deleteTraining(ctx);
    expect(deletedId).toBe('t-33');
  });
});
