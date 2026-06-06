import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonSubscriptionRepository } from './repos/communication.repo';
import { updatePersonSubscription } from './updatePersonSubscription';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('updatePersonSubscription', () => {
  beforeEach(() => { restoreRepo(PersonSubscriptionRepository); });
  afterEach(() => { restoreRepo(PersonSubscriptionRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await updatePersonSubscription(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { subscriptionId: 'ps-1' } });
    const res = await updatePersonSubscription(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(PersonSubscriptionRepository, {
      findById: async () => ({ id: 'ps-1', organizationId: 'tenant-1', enabled: false }),
      update: async () => ({ id: 'ps-1', organizationId: 'tenant-1', enabled: true }),
    });
    const ctx = makeCtx({ _params: { subscriptionId: 'ps-1' }, _body: { enabled: true } });
    const res = await updatePersonSubscription(ctx);
    expect(res.status).toBe(200);
  });
});
