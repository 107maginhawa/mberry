import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { listMyCreditEntries } from './listMyCreditEntries';

describe('listMyCreditEntries', () => {
  beforeEach(() => { restoreRepo(CreditEntryRepository); });
  afterEach(() => { restoreRepo(CreditEntryRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(listMyCreditEntries(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(CreditEntryRepository, {
      findMany: async () => [],
    });
    const ctx = makeCtx({ _query: {} });
    const res = await listMyCreditEntries(ctx);
    expect(res.status).toBe(200);
  });
});
