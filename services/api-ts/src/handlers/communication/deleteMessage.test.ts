import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { deleteMessage } from './deleteMessage';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('deleteMessage', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await deleteMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { messageId: 'm-1' } });
    const res = await deleteMessage(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 204 on happy path', async () => {
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1' }),
      delete: async () => undefined,
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    const res = await deleteMessage(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when message not in org', async () => {
    stubRepo(MessageRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    await expect(deleteMessage(ctx)).rejects.toThrow('Message not found');
  });
});
