import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeTraining as createFakeTraining, fakeEnrollment as createFakeEnrollment } from '@/test-utils/factories';
import { listMyTrainings } from './listMyTrainings';
import { TrainingRepository } from './repos/training.repo';

const fakeRow = {
  enrollment: createFakeEnrollment(),
  training: createFakeTraining({
    title: 'CPD Seminar',
    status: 'published',
    startDate: new Date('2026-06-01'),
  }),
};

describe('listMyTrainings', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns trainings for the current user', async () => {
    mocks = stubRepo(TrainingRepository, {
      listByPerson: async () => [fakeRow],
    });

    const ctx = makeCtx({});
    const response = await listMyTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].training.title).toBe('CPD Seminar');
  });

  test('returns empty list when user has no enrollments', async () => {
    mocks = stubRepo(TrainingRepository, {
      listByPerson: async () => [],
    });

    const ctx = makeCtx({});
    const response = await listMyTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  test('uses session user id to query', async () => {
    let capturedPersonId: string | undefined;
    mocks = stubRepo(TrainingRepository, {
      listByPerson: async (personId: string) => { capturedPersonId = personId; return []; },
    });

    const ctx = makeCtx({ user: { id: 'member-42', role: 'member' } });
    await listMyTrainings(ctx);
    expect(capturedPersonId).toBe('member-42');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      listByPerson: async () => [],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
    });

    // session.user.id is accessed for personId
    await expect(listMyTrainings(ctx)).rejects.toThrow();
  });
});
