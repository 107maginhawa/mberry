import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { listPersons } from './listPersons';

describe('listPersons', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonRepository, {
      findMany: async () => [],
      count: async () => 0,
    });
    const ctx = makeCtx({ _query: {} });
    const res = await listPersons(ctx);
    expect(res.status).toBe(200);
  });
});
