import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { executeAccountDeletion } from './executeAccountDeletion';

describe('executeAccountDeletion', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('returns 404 when person not found', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => undefined,
    });
    const ctx = makeCtx({ _params: { personId: 'p-1' } });
    (ctx as any).req.param = (key: string) => key === 'personId' ? 'p-1' : '';
    const res = await executeAccountDeletion(ctx);
    expect(res.status).toBe(404);
  });

  test('returns 400 when no deletion requested', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({
        id: 'p-1',
        deletionCompletedAt: null,
        deletionRequestedAt: null,
        deletionScheduledAt: null,
      }),
    });
    const ctx = makeCtx({ _params: { personId: 'p-1' } });
    (ctx as any).req.param = (key: string) => key === 'personId' ? 'p-1' : '';
    const res = await executeAccountDeletion(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 200 on happy path', async () => {
    // Grace period expired (past date)
    const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    stubRepo(PersonRepository, {
      findOneById: async () => ({
        id: 'p-1',
        deletionCompletedAt: null,
        deletionRequestedAt: past,
        deletionScheduledAt: past,
      }),
      updateOneById: async () => ({ id: 'p-1' }),
    });
    const mockDb = {
      ...({ transaction: async (fn: any) => fn({}) } as any),
      delete: () => ({
        where: async () => undefined,
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    };
    const ctx = makeCtx({ database: mockDb, _params: { personId: 'p-1' } });
    (ctx as any).req.param = (key: string) => key === 'personId' ? 'p-1' : '';
    const res = await executeAccountDeletion(ctx);
    expect(res.status).toBe(200);
  });
});
