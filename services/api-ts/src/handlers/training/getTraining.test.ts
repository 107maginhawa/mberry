import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getTraining } from './getTraining';
import { TrainingRepository } from './repos/training.repo';

const fakeTraining = {
  id: 'training-1',
  orgId: 'org-1',
  orgId: 'org-1',
  title: 'CPD Seminar',
  status: 'published',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  capacity: 50,
};

describe('getTraining', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns training with enrollment count and attendance stats', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 15,
      getAttendanceStats: async () => ({ completed: 5, total: 15 }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'org-1' } });
    const response = await getTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('training-1');
    expect(response.body.data.enrollmentCount).toBe(15);
    expect(response.body.data.attendance.completed).toBe(5);
  });

  test('throws NotFoundError when training does not exist', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined,
      getEnrollmentCount: async () => 0,
      getAttendanceStats: async () => ({ completed: 0, total: 0 }),
    });

    const ctx = makeCtx({ _params: { id: 'missing-id', organizationId: 'org-1' } });
    await expect(getTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('throws NotFoundError when training belongs to different org (cross-org attack)', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined, // getByOrg returns undefined for wrong org
      getEnrollmentCount: async () => 0,
      getAttendanceStats: async () => ({ completed: 0, total: 0 }),
    });

    const ctx = makeCtx({ _params: { id: 'training-1', organizationId: 'wrong-org' } });
    await expect(getTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({ user: null, session: null, database: undefined });
    await expect(getTraining(ctx)).rejects.toThrow();
  });
});
