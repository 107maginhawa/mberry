import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonSubscriptionRepository } from './repos/communication.repo';
import { listPersonSubscriptions } from './listPersonSubscriptions';

describe('listPersonSubscriptions', () => {
  beforeEach(() => { restoreRepo(PersonSubscriptionRepository); });
  afterEach(() => { restoreRepo(PersonSubscriptionRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _query: { personId: 'p-1' } });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonSubscriptionRepository, {
      findByPerson: async () => [],
    });
    const ctx = makeCtx({ _query: { personId: 'p-1' } });
    const res = await listPersonSubscriptions(ctx);
    expect(res.status).toBe(200);
  });
});
