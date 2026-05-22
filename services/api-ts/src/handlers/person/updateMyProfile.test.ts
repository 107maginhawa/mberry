import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
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
});
