import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { updatePerson } from './updatePerson';

describe('updatePerson', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('returns 200 on happy path (owner updating own record)', async () => {
    const person = { id: 'user-1', firstName: 'Test', lastName: 'User' };
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async () => ({ ...person, firstName: 'Updated' }),
    });
    const ctx = makeCtx({ _body: { firstName: 'Updated' } });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'user-1' : '';
    const res = await updatePerson(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError when updating another person', async () => {
    const ctx = makeCtx({ _body: {} });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'other-user' : '';
    await expect(updatePerson(ctx)).rejects.toThrow('You can only update your own profile');
  });
});
