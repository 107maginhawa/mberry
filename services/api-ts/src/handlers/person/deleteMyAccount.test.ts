import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { deleteMyAccount } from './deleteMyAccount';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('[BR-32] deleteMyAccount', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(deleteMyAccount(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws Unauthorized when person not found', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => null,
    });
    const ctx = makeCtx();
    await expect(deleteMyAccount(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 202 and schedules deletion on happy path', async () => {
    let updatedData: any = null;
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: null, deletionCompletedAt: null }),
      updateOneById: async (_id: string, data: any) => { updatedData = data; return { id: 'user-1' }; },
    });

    const ctx = makeCtx();
    const res = await deleteMyAccount(ctx);

    expect(res.status).toBe(202);
    expect(res.body.gracePeriodDays).toBe(30);
    expect(res.body.scheduledAt).toBeTruthy();
    expect(updatedData.deletionRequestedAt).toBeInstanceOf(Date);
    expect(updatedData.deletionScheduledAt).toBeInstanceOf(Date);
  });

  test('returns 200 idempotently when deletion already requested', async () => {
    const requested = new Date('2025-05-01');
    const scheduled = new Date('2025-05-31');
    stubRepo(PersonRepository, {
      findOneById: async () => ({
        id: 'user-1',
        deletionRequestedAt: requested,
        deletionScheduledAt: scheduled,
        deletionCompletedAt: null,
      }),
    });

    const ctx = makeCtx();
    const res = await deleteMyAccount(ctx);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('already requested');
  });

  test('returns 410 when account already deleted', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({
        id: 'user-1',
        deletionRequestedAt: new Date(),
        deletionCompletedAt: new Date(),
      }),
    });

    const ctx = makeCtx();
    const res = await deleteMyAccount(ctx);
    expect(res.status).toBe(410);
  });

  test('sets updatedBy to personId for audit trail', async () => {
    let updatedData: any = null;
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: null, deletionCompletedAt: null }),
      updateOneById: async (_id: string, data: any) => { updatedData = data; return { id: 'user-1' }; },
    });

    const ctx = makeCtx();
    await deleteMyAccount(ctx);
    expect(updatedData.updatedBy).toBe('user-1');
  });
});
