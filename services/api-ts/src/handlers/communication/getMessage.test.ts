import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { getMessage } from './getMessage';

describe('getMessage', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await getMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { messageId: 'm-1' } });
    const res = await getMessage(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    const message = { id: 'm-1', organizationId: 'tenant-1', channel: 'email' };
    stubRepo(MessageRepository, {
      findById: async () => message,
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    const res = await getMessage(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when message not in org', async () => {
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'other-org' }),
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    await expect(getMessage(ctx)).rejects.toThrow('Message not found');
  });
});
