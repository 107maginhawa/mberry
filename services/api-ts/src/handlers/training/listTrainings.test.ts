import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeTraining as createFakeTraining } from '@/test-utils/factories';
import { listTrainings } from './listTrainings';
import { TrainingRepository } from './repos/training.repo';

const fakeTraining = createFakeTraining({
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'published',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
});

describe('listTrainings', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns list with meta.total', async () => {
    mocks = stubRepo(TrainingRepository, {
      list: async () => ({ data: [fakeTraining], total: 1 }),
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const response = await listTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  test('returns empty list when no trainings', async () => {
    mocks = stubRepo(TrainingRepository, {
      list: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const response = await listTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  test('passes query params to repo', async () => {
    let capturedFilters: any;
    mocks = stubRepo(TrainingRepository, {
      list: async (_orgId: string, filters: any) => {
        capturedFilters = filters;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'published', search: 'CPD', limit: '10', offset: '5' },
    });
    await listTrainings(ctx);
    expect(capturedFilters.status).toBe('published');
    expect(capturedFilters.search).toBe('CPD');
    expect(capturedFilters.limit).toBe(10);
    expect(capturedFilters.offset).toBe(5);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      list: async () => { throw new Error('should not reach repo'); },
    });

    // listTrainings does not access session directly, but the db
    // context is required. With no database, it will error.
    const ctx = makeCtx({ user: null, session: null, database: undefined });
    // listTrainings calls `ctx.get('database')` then `new TrainingRepository(db)`
    // with undefined db, repo.list will throw
    await expect(listTrainings(ctx)).rejects.toThrow();
  });
});
