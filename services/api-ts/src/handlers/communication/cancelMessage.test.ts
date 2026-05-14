import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { cancelMessage } from './cancelMessage';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('cancelMessage', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await cancelMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { messageId: 'm-1' } });
    const res = await cancelMessage(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path (draft)', async () => {
    const message = { id: 'm-1', organizationId: 'tenant-1', status: 'draft' };
    stubRepo(MessageRepository, {
      findById: async () => message,
      update: async () => ({ ...message, status: 'cancelled' }),
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    const res = await cancelMessage(ctx);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when message already sent', async () => {
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1', status: 'sent' }),
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    await expect(cancelMessage(ctx)).rejects.toThrow('Cannot cancel a message with status');
  });
});
