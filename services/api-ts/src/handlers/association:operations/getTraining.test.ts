import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeTraining } from '@/test-utils/factories';
import { TrainingRepository } from './repos/training.repo';
import { getTraining } from './getTraining';

describe('getTraining', () => {
  afterEach(() => restoreRepo(TrainingRepository));

  test('throws UnauthorizedError when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { trainingId: 'training-1' } });
    await expect(getTraining(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ForbiddenError when no org context', async () => {
    const ctx = makeCtx({
      organizationId: null,
      _params: { trainingId: 'training-1' },
    });
    await expect(getTraining(ctx)).rejects.toThrow('Organization context required');
  });

  test('returns training on happy path', async () => {
    const training = fakeTraining({ id: 'training-1', organizationId: 'org-1' });
    stubRepo(TrainingRepository, {
      findOne: async () => training,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { trainingId: 'training-1' },
    });
    const response = await getTraining(ctx);
    expect(response.status).toBe(200);
  });

  test('throws NotFoundError when training does not exist', async () => {
    stubRepo(TrainingRepository, {
      findOne: async () => null,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { trainingId: 'nonexistent' },
    });
    await expect(getTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('throws NotFoundError for cross-org attack', async () => {
    stubRepo(TrainingRepository, {
      findOne: async ({ id, organizationId }: { id: string; organizationId: string }) => {
        // Scoped query: training exists in org-2 but caller is in org-1
        if (id === 'training-1' && organizationId === 'org-1') return null;
        return fakeTraining();
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { trainingId: 'training-1' },
    });
    await expect(getTraining(ctx)).rejects.toThrow('Training not found');
  });
});
