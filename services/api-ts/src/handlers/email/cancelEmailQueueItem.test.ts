import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailQueueRepository } from './repos/queue.repo';
import { cancelEmailQueueItem } from './cancelEmailQueueItem';

describe('cancelEmailQueueItem', () => {
  beforeEach(() => { restoreRepo(EmailQueueRepository); });
  afterEach(() => { restoreRepo(EmailQueueRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({
      user: { id: 'u1', role: 'user' },
      _params: { queue: 'q-1' },
      _body: { reason: 'No longer needed' },
    });
    await expect(cancelEmailQueueItem(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 on successful cancellation', async () => {
    const cancelled = { id: 'q-1', status: 'cancelled', recipientEmail: 'a@b.com', templateTags: [] };
    stubRepo(EmailQueueRepository, { cancelEmail: async () => cancelled });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { queue: 'q-1' },
      _body: { reason: 'No longer needed' },
    });
    const res = await cancelEmailQueueItem(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual(cancelled);
  });

  test('throws ValidationError when reason is empty', async () => {
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { queue: 'q-1' },
      _body: { reason: '' },
    });
    await expect(cancelEmailQueueItem(ctx)).rejects.toThrow('Cancellation reason is required');
  });

  test('throws ValidationError when reason exceeds 500 chars', async () => {
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { queue: 'q-1' },
      _body: { reason: 'x'.repeat(501) },
    });
    await expect(cancelEmailQueueItem(ctx)).rejects.toThrow('500 characters or less');
  });
});
