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
    // Mock db.select chain for M2-R5 guards (no pending payments, no sole officer)
    const mockQuery = { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) };
    const mockQueryNoLimit = { from: () => ({ where: () => Promise.resolve([]) }) };
    const ctx = makeCtx({ dbOverrides: { select: () => mockQuery } });
    // Override db.select to handle both guard queries (payments with limit, terms without)
    const db = ctx.get('database');
    let callCount = 0;
    (db as any).select = () => {
      callCount++;
      if (callCount === 1) return mockQuery; // pending payments query (has .limit)
      return mockQueryNoLimit; // officer terms query (no .limit)
    };
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
