import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailQueueRepository } from './repos/queue.repo';
import { getEmailQueueItem } from './getEmailQueueItem';

describe('getEmailQueueItem', () => {
  beforeEach(() => { restoreRepo(EmailQueueRepository); });
  afterEach(() => { restoreRepo(EmailQueueRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, _params: { queue: 'q-1' } });
    await expect(getEmailQueueItem(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 with queue item on success', async () => {
    const item = { id: 'q-1', status: 'pending', recipientEmail: 'a@b.com' };
    stubRepo(EmailQueueRepository, { findOneById: async () => item });
    const ctx = makeCtx({ user: { id: 'u1', role: 'admin' }, _params: { queue: 'q-1' } });
    const res = await getEmailQueueItem(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual(item);
  });

  test('throws NotFoundError when item does not exist', async () => {
    stubRepo(EmailQueueRepository, { findOneById: async () => null });
    const ctx = makeCtx({ user: { id: 'u1', role: 'admin' }, _params: { queue: 'q-missing' } });
    await expect(getEmailQueueItem(ctx)).rejects.toThrow('Email queue item not found');
  });
});
