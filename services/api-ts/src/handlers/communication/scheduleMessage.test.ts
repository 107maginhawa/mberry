import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { scheduleMessage } from './scheduleMessage';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('scheduleMessage', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await scheduleMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { messageId: 'm-1' } });
    const res = await scheduleMessage(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    const message = { id: 'm-1', organizationId: 'tenant-1', status: 'draft' };
    const scheduledAt = new Date(Date.now() + 3600000).toISOString();
    stubRepo(MessageRepository, {
      findById: async () => message,
      update: async () => ({ ...message, status: 'scheduled', scheduledAt }),
    });
    const ctx = makeCtx({ _params: { messageId: 'm-1' }, _body: { scheduledAt } });
    const res = await scheduleMessage(ctx);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when message not draft', async () => {
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1', status: 'scheduled' }),
    });
    const ctx = makeCtx({
      _params: { messageId: 'm-1' },
      _body: { scheduledAt: new Date(Date.now() + 3600000).toISOString() },
    });
    await expect(scheduleMessage(ctx)).rejects.toThrow('Cannot schedule a message with status');
  });
});
