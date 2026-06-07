import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { sendMessage } from './sendMessage';
import { mock } from 'bun:test';

const DRAFT_MSG = {
  id: 'msg-1',
  organizationId: 'org-1',
  status: 'draft',
  subject: 'Test',
};

const SENT_MSG = {
  ...DRAFT_MSG,
  status: 'sent',
  sentAt: new Date(),
};

// Mock audit
mock.module('@/core/audit/audit-action', () => ({
  auditAction: async () => {},
}));

describe('sendMessage', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtx({
      _params: { messageId: 'msg-1' },
      user: null,
      session: null,
    });
    const res = await sendMessage(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 without org context', async () => {
    const ctx = makeCtx({
      _params: { messageId: 'msg-1' },
      orgId: null,
      organizationId: null,
    });
    const origGet = ctx.get.bind(ctx);
    ctx.get = (key: string) => key === 'orgId' ? null : origGet(key);

    const res = await sendMessage(ctx as any);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when message not found', async () => {
    mocks = stubRepo(MessageRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({ _params: { messageId: 'nonexistent' } });
    await expect(sendMessage(ctx as any)).rejects.toThrow('Message not found');
  });

  test('throws NotFoundError when message belongs to different org', async () => {
    mocks = stubRepo(MessageRepository, {
      findById: async () => ({ ...DRAFT_MSG, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({ _params: { messageId: 'msg-1' } });
    await expect(sendMessage(ctx as any)).rejects.toThrow('Message not found');
  });

  test('throws BusinessLogicError when message already sent', async () => {
    mocks = stubRepo(MessageRepository, {
      findById: async () => ({ ...DRAFT_MSG, status: 'sent' }),
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { messageId: 'msg-1' } });
    await expect(sendMessage(ctx as any)).rejects.toThrow('Cannot send a message with status "sent"');
  });

  test('sends draft message and returns 200', async () => {
    mocks = stubRepo(MessageRepository, {
      findById: async () => DRAFT_MSG,
      update: async (_id: string, data: any) => ({ ...DRAFT_MSG, ...data }),
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { messageId: 'msg-1' } });
    const res = await sendMessage(ctx as any);
    expect(res.status).toBe(200);
  });

  test('sends scheduled message and returns 200', async () => {
    mocks = stubRepo(MessageRepository, {
      findById: async () => ({ ...DRAFT_MSG, status: 'scheduled' }),
      update: async (_id: string, data: any) => ({ ...DRAFT_MSG, ...data }),
    });

    const ctx = makeCtx({ organizationId: 'org-1', _params: { messageId: 'msg-1' } });
    const res = await sendMessage(ctx as any);
    expect(res.status).toBe(200);
  });
});
