import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { getPerson } from './getPerson';

describe('getPerson', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('returns 200 when owner accesses own record', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', firstName: 'Test', dateOfBirth: null }),
    });
    const ctx = makeCtx({ _params: { person: 'user-1' } });
    // ctx.req.param is set separately
    (ctx as any).req.param = (key: string) => key === 'person' ? 'user-1' : '';
    const res = await getPerson(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError when accessing another person', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'other-user', firstName: 'Other', dateOfBirth: null }),
    });
    const ctx = makeCtx({ _params: { person: 'other-user' } });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'other-user' : '';
    await expect(getPerson(ctx)).rejects.toThrow('Access denied');
  });
});
