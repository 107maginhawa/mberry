import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { cancelTraining } from './cancelTraining';
import { TrainingRepository } from './repos/training.repo';

const fakeTraining = {
  id: 'training-1',
  orgId: 'org-1',
  orgId: 'org-1',
  title: 'CPD Seminar',
  status: 'published',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
};

describe('cancelTraining', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('cancels training and returns 200', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    const response = await cancelTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });

  test('throws TRAINING_ALREADY_CANCELLED if training is already cancelled', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, status: 'cancelled' }),
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    await expect(cancelTraining(ctx)).rejects.toMatchObject({ code: 'TRAINING_ALREADY_CANCELLED' });
  });

  test('throws TRAINING_COMPLETED if training is completed', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, status: 'completed' }),
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    await expect(cancelTraining(ctx)).rejects.toMatchObject({ code: 'TRAINING_COMPLETED' });
  });

  test('throws NotFoundError when training does not exist', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined,
      update: async () => fakeTraining,
    });

    const ctx = makeCtx({ _params: { id: 'missing-id', organizationId: 'org-1' } });
    await expect(cancelTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('cancels training that has enrollees (no guard)', async () => {
    // The current handler does not check for enrollees before cancelling.
    // This documents that behavior.
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    const response = await cancelTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({ user: null, session: null, database: undefined });
    await expect(cancelTraining(ctx)).rejects.toThrow();
  });
});
