import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SubscriptionTopicRepository } from './repos/communication.repo';
import { updateSubscriptionTopic } from './updateSubscriptionTopic';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('updateSubscriptionTopic', () => {
  beforeEach(() => { restoreRepo(SubscriptionTopicRepository); });
  afterEach(() => { restoreRepo(SubscriptionTopicRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await updateSubscriptionTopic(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { topicId: 'tp-1' } });
    const res = await updateSubscriptionTopic(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    const topic = { id: 'tp-1', organizationId: 'tenant-1', name: 'T' };
    stubRepo(SubscriptionTopicRepository, {
      findById: async () => topic,
      update: async () => ({ ...topic, name: 'Updated' }),
    });
    const ctx = makeCtx({ _params: { topicId: 'tp-1' }, _body: { name: 'Updated' } });
    const res = await updateSubscriptionTopic(ctx);
    expect(res.status).toBe(200);
  });
});
