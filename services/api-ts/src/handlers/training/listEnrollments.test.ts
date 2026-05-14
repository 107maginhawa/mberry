import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { TrainingRepository } from './repos/training.repo';
import { listEnrollments } from './listEnrollments';

const fakeTraining = {
  id: 'training-1',
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'published',
};

const fakeEnrollment = {
  id: 'enrollment-1',
  trainingId: 'training-1',
  personId: 'user-1',
  status: 'enrolled',
  enrolledAt: new Date(),
};

const fakeStats = {
  enrolled: 1,
  attended: 0,
  cancelled: 0,
};

describe('listEnrollments', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns enrollments and stats when training exists', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      listEnrollments: async () => [fakeEnrollment],
      getAttendanceStats: async () => fakeStats,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
    });

    const res = await listEnrollments(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
    expect((res as any).body.stats).toEqual(fakeStats);
  });

  test('throws NotFoundError when training not found', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined,
      listEnrollments: async () => [],
      getAttendanceStats: async () => fakeStats,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-training', organizationId: 'org-1' },
    });

    await expect(listEnrollments(ctx as any)).rejects.toThrow('not found');
  });

  test('returns empty enrollments when training has no enrollees', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      listEnrollments: async () => [],
      getAttendanceStats: async () => ({ enrolled: 0, attended: 0, cancelled: 0 }),
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
    });

    const res = await listEnrollments(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(0);
  });
});
