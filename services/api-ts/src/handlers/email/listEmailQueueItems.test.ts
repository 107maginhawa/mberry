import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailQueueRepository } from './repos/queue.repo';
import { listEmailQueueItems } from './listEmailQueueItems';

describe('listEmailQueueItems', () => {
  beforeEach(() => { restoreRepo(EmailQueueRepository); });
  afterEach(() => { restoreRepo(EmailQueueRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' } });
    await expect(listEmailQueueItems(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 with data and pagination', async () => {
    const emails = [{ id: 'q-1', status: 'pending' }, { id: 'q-2', status: 'sent' }];
    stubRepo(EmailQueueRepository, {
      findMany: async () => emails,
      count: async () => 2,
    });
    const ctx = makeCtx({ user: { id: 'u1', role: 'admin' }, _query: {} });
    const res = await listEmailQueueItems(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toEqual(emails);
    expect(body.pagination).toBeDefined();
  });
});
