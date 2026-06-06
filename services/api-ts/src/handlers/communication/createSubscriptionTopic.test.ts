import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SubscriptionTopicRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { createSubscriptionTopic } from './createSubscriptionTopic';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('createSubscriptionTopic', () => {
  beforeEach(() => {
    restoreRepo(SubscriptionTopicRepository);
    restoreRepo(OfficerTermRepository);
    // Handler requires president/secretary via requirePosition()
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
  });
  afterEach(() => {
    restoreRepo(SubscriptionTopicRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await createSubscriptionTopic(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { name: 'T', channel: 'email', category: 'c', defaultEnabled: true } });
    const res = await createSubscriptionTopic(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 on happy path', async () => {
    stubRepo(SubscriptionTopicRepository, {
      create: async () => ({ id: 'tp-1', organizationId: 'tenant-1', name: 'T' }),
    });
    const ctx = makeCtx({ _body: { name: 'T', channel: 'email', category: 'c', defaultEnabled: true } });
    const res = await createSubscriptionTopic(ctx);
    expect(res.status).toBe(201);
  });
});
