import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { domainEvents } from '@/core/domain-events';
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

  // ── EM-M02-m3n4o5p6: cancellation emits person.deletion.cancelled ──
  test('emits person.deletion.cancelled on success', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: new Date() }),
      updateOneById: async () => ({ id: 'user-1' }),
    });
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      await cancelMyAccountDeletion(makeCtx());
      const emit = emitSpy.mock.calls.find((c) => c[0] === 'person.deletion.cancelled');
      expect(emit).toBeDefined();
      expect(emit![1]).toMatchObject({ personId: 'user-1' });
    } finally {
      emitSpy.mockRestore();
    }
  });

  test('throws BusinessLogicError when no deletion pending', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', deletionRequestedAt: null }),
    });
    const ctx = makeCtx();
    await expect(cancelMyAccountDeletion(ctx)).rejects.toThrow('No pending deletion request');
  });
});
