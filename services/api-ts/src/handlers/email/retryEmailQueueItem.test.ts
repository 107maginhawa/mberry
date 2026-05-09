import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailQueueRepository } from './repos/queue.repo';
import { retryEmailQueueItem } from './retryEmailQueueItem';

describe('retryEmailQueueItem', () => {
  beforeEach(() => { restoreRepo(EmailQueueRepository); });
  afterEach(() => { restoreRepo(EmailQueueRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, _params: { queue: 'q-1' } });
    await expect(retryEmailQueueItem(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 with updated email on success', async () => {
    const updated = { id: 'q-1', status: 'pending', recipientEmail: 'a@b.com', template: 'welcome', attempts: 2 };
    stubRepo(EmailQueueRepository, { retryEmail: async () => updated });
    const ctx = makeCtx({ user: { id: 'u1', role: 'admin' }, _params: { queue: 'q-1' } });
    const res = await retryEmailQueueItem(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual(updated);
  });
});
