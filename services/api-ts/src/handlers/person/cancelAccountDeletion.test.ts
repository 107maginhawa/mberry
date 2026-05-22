import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { cancelAccountDeletion } from './cancelAccountDeletion';

describe('cancelAccountDeletion', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await cancelAccountDeletion(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({
        id: 'user-1',
        deletionRequestedAt: new Date(),
        deletionCompletedAt: null,
      }),
      updateOneById: async () => ({ id: 'user-1' }),
    });
    const ctx = makeCtx();
    const res = await cancelAccountDeletion(ctx);
    expect(res.status).toBe(200);
  });

  test('returns 400 when no deletion pending', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: null, deletionCompletedAt: null }),
    });
    const ctx = makeCtx();
    const res = await cancelAccountDeletion(ctx);
    expect(res.status).toBe(400);
  });
});
