import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { getMyCreditSummary } from './getMyCreditSummary';

describe('getMyCreditSummary', () => {
  beforeEach(() => { restoreRepo(CreditEntryRepository); });
  afterEach(() => { restoreRepo(CreditEntryRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyCreditSummary(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    // Stub db.select chain for membership / org / association lookups
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    stubRepo(CreditEntryRepository, {
      sumCreditsByOrg: async () => [],
    });
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyCreditSummary(ctx);
    expect(res.status).toBe(200);
  });
});
