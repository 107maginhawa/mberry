import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeTraining as createFakeTraining, fakeEnrollment as createFakeEnrollment } from '@/test-utils/factories';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { listEnrollments } from './listEnrollments';

const fakeTraining = createFakeTraining({
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'published',
});

const fakeEnrollment = createFakeEnrollment({
  id: 'enrollment-1',
  trainingId: 'training-1',
  personId: 'user-1',
  status: 'enrolled',
});

const fakeStats = {
  enrolled: 1,
  attended: 0,
  cancelled: 0,
};

describe('listEnrollments', () => {
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

  test('returns enrollments and stats when training exists', async () => {
    stubOfficer();
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
    stubOfficer();
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
    stubOfficer();
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
