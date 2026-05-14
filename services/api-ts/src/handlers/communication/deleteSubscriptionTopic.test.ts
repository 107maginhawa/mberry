import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SubscriptionTopicRepository } from './repos/communication.repo';
import { deleteSubscriptionTopic } from './deleteSubscriptionTopic';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('deleteSubscriptionTopic', () => {
  beforeEach(() => { restoreRepo(SubscriptionTopicRepository); });
  afterEach(() => { restoreRepo(SubscriptionTopicRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await deleteSubscriptionTopic(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { topicId: 'tp-1' } });
    const res = await deleteSubscriptionTopic(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 204 on happy path', async () => {
    stubRepo(SubscriptionTopicRepository, {
      findById: async () => ({ id: 'tp-1', organizationId: 'tenant-1', name: 'T' }),
      delete: async () => undefined,
    });
    const ctx = makeCtx({ _params: { topicId: 'tp-1' } });
    const res = await deleteSubscriptionTopic(ctx);
    expect(res.status).toBe(204);
  });
});
