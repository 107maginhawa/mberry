import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeTraining as createFakeTraining } from '@/test-utils/factories';
import { cancelTraining } from './cancelTraining';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

const fakeTraining = createFakeTraining({
  title: 'CPD Seminar',
  status: 'published',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
});

describe('cancelTraining', () => {
  let mocks: ReturnType<typeof stubRepo>;

  function stubOfficer() {
    return stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
  }

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('cancels training and returns 200', async () => {
    stubOfficer();
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
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, status: 'cancelled' }),
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    await expect(cancelTraining(ctx)).rejects.toMatchObject({ code: 'TRAINING_ALREADY_CANCELLED' });
  });

  test('throws TRAINING_COMPLETED if training is completed', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, status: 'completed' }),
      update: async (_id: string, data: any) => ({ ...fakeTraining, ...data }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    await expect(cancelTraining(ctx)).rejects.toMatchObject({ code: 'TRAINING_COMPLETED' });
  });

  test('throws NotFoundError when training does not exist', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined,
      update: async () => fakeTraining,
    });

    const ctx = makeCtx({ _params: { id: 'missing-id', organizationId: 'org-1' } });
    await expect(cancelTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('cancels training that has enrollees (no guard)', async () => {
    stubOfficer();
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
