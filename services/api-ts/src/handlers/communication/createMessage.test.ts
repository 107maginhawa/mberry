import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageRepository } from './repos/communication.repo';
import { createMessage } from './createMessage';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('createMessage', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await createMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null });
    const res = await createMessage(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 201 on happy path', async () => {
    const message = { id: 'msg-1', organizationId: 'tenant-1', channel: 'email', status: 'draft' };
    stubRepo(MessageRepository, {
      findDuplicatesSentToday: async () => [],
      create: async () => message,
    });
    const ctx = makeCtx({
      _body: { channel: 'email', senderId: 's-1', recipientPersonIds: ['p-1'], body: 'Hello' },
    });
    const res = await createMessage(ctx);
    expect(res.status).toBe(201);
  });
});
