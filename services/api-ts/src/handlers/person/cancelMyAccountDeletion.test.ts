import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { cancelMyAccountDeletion } from './cancelMyAccountDeletion';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('cancelMyAccountDeletion', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(cancelMyAccountDeletion(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: new Date() }),
      updateOneById: async () => ({ id: 'user-1' }),
    });
    const ctx = makeCtx();
    const res = await cancelMyAccountDeletion(ctx);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when no deletion pending', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: null }),
    });
    const ctx = makeCtx();
    await expect(cancelMyAccountDeletion(ctx)).rejects.toThrow('No pending deletion request');
  });
});
