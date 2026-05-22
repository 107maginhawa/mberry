import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageTemplateRepository } from './repos/communication.repo';
import { getMessageTemplate } from './getMessageTemplate';

describe('getMessageTemplate', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await getMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { templateId: 'tpl-1' } });
    const res = await getMessageTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(MessageTemplateRepository, {
      findById: async () => ({ id: 'tpl-1', organizationId: 'tenant-1', name: 'T' }),
    });
    const ctx = makeCtx({ _params: { templateId: 'tpl-1' } });
    const res = await getMessageTemplate(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when template not in org', async () => {
    stubRepo(MessageTemplateRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({ _params: { templateId: 'tpl-1' } });
    await expect(getMessageTemplate(ctx)).rejects.toThrow('Message template not found');
  });
});
