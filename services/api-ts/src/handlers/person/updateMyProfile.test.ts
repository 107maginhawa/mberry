import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { domainEvents } from '@/core/domain-events';
import { updateMyProfile } from './updateMyProfile';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('updateMyProfile', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(updateMyProfile(ctx)).rejects.toThrow();
  });

  test('returns 200 on happy path', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async () => ({ ...person, firstName: 'Updated' }),
    });
    const ctx = makeCtx({ _body: { firstName: 'Updated' } });
    const res = await updateMyProfile(ctx);
    expect(res.status).toBe(200);
  });

  // ── EM-M02-m3n4o5p6: profile change emits person.updated ──
  test('emits person.updated with changedFields', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async () => ({ ...person, firstName: 'Updated' }),
    });
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const ctx = makeCtx({ _body: { firstName: 'Updated', specialization: 'Cardiology' } });
      await updateMyProfile(ctx);
      const emit = emitSpy.mock.calls.find((c) => c[0] === 'person.updated');
      expect(emit).toBeDefined();
      expect(emit![1]).toMatchObject({ personId: 'user-1', updatedBy: 'user-1' });
      expect((emit![1] as any).updatedFields).toEqual(
        expect.arrayContaining(['firstName', 'specialization']),
      );
      expect((emit![1] as any).updatedFields).not.toContain('updatedBy');
    } finally {
      emitSpy.mockRestore();
    }
  });
});
