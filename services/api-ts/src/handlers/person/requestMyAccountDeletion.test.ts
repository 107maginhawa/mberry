import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { requestMyAccountDeletion } from './requestMyAccountDeletion';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('requestMyAccountDeletion', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(requestMyAccountDeletion(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 202 on happy path', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: null }),
      updateOneById: async () => ({ id: 'user-1' }),
    });
    const ctx = makeCtx();
    const res = await requestMyAccountDeletion(ctx);
    expect(res.status).toBe(202);
  });

  test('throws BusinessLogicError when deletion already requested', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: new Date() }),
    });
    const ctx = makeCtx();
    await expect(requestMyAccountDeletion(ctx)).rejects.toThrow('Deletion already requested');
  });
});
