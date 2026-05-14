import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageTemplateRepository } from './repos/communication.repo';
import { deleteMessageTemplate } from './deleteMessageTemplate';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('deleteMessageTemplate', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await deleteMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { templateId: 'tpl-1' } });
    const res = await deleteMessageTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 204 on happy path', async () => {
    stubRepo(MessageTemplateRepository, {
      findById: async () => ({ id: 'tpl-1', organizationId: 'tenant-1', name: 'T' }),
      delete: async () => undefined,
    });
    const ctx = makeCtx({ _params: { templateId: 'tpl-1' } });
    const res = await deleteMessageTemplate(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when template not found', async () => {
    stubRepo(MessageTemplateRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({ _params: { templateId: 'tpl-1' } });
    await expect(deleteMessageTemplate(ctx)).rejects.toThrow('Message template not found');
  });
});
