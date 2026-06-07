import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonSubscriptionRepository } from './repos/communication.repo';
import { bulkUpdatePersonSubscriptions } from './bulkUpdatePersonSubscriptions';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('bulkUpdatePersonSubscriptions', () => {
  beforeEach(() => { restoreRepo(PersonSubscriptionRepository); });
  afterEach(() => { restoreRepo(PersonSubscriptionRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await bulkUpdatePersonSubscriptions(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { updates: [] } });
    const res = await bulkUpdatePersonSubscriptions(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonSubscriptionRepository, {
      bulkUpsert: async () => [{ id: 'ps-1', topicId: 'tp-1', enabled: true }],
    });
    const ctx = makeCtx({ _body: { updates: [{ topicId: 'tp-1', enabled: true }] } });
    const res = await bulkUpdatePersonSubscriptions(ctx);
    expect(res.status).toBe(200);
  });
});
