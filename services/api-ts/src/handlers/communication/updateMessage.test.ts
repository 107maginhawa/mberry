import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { updateMessage } from './updateMessage';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('updateMessage', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await updateMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { messageId: 'm-1' } });
    const res = await updateMessage(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    const message = { id: 'm-1', organizationId: 'tenant-1', status: 'draft' };
    stubRepo(MessageRepository, {
      findById: async () => message,
      update: async () => ({ ...message, subject: 'Updated' }),
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' }, _body: { subject: 'Updated' } });
    const res = await updateMessage(ctx);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when message already sent', async () => {
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1', status: 'sent' }),
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' }, _body: {} });
    await expect(updateMessage(ctx)).rejects.toThrow('Cannot update a message that has already been sent');
  });
});
