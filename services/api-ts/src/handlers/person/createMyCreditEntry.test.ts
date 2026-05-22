import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { createMyCreditEntry } from './createMyCreditEntry';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('createMyCreditEntry', () => {
  beforeEach(() => { restoreRepo(CreditEntryRepository); });
  afterEach(() => { restoreRepo(CreditEntryRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(createMyCreditEntry(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ValidationError when activityName missing', async () => {
    const ctx = makeCtx({ _body: { activityName: '', creditAmount: -1, activityDate: '2025-01-01' } });
    await expect(createMyCreditEntry(ctx)).rejects.toThrow('activityName required');
  });

  test('returns 201 on happy path', async () => {
    const entry = { id: 'ce-1', personId: 'user-1', activityName: 'CPE Course', creditAmount: 3 };
    stubRepo(CreditEntryRepository, {
      createOne: async () => entry,
    });
    const ctx = makeCtx({
      _body: {
        activityName: 'CPE Course',
        creditAmount: 3,
        activityDate: '2025-01-15',
        organizationId: 'org-1',
        provider: 'Test Provider',
      },
    });
    const res = await createMyCreditEntry(ctx);
    expect(res.status).toBe(201);
  });
});
