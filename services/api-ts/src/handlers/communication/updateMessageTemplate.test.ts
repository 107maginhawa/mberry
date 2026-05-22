import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageTemplateRepository } from './repos/communication.repo';
import { updateMessageTemplate } from './updateMessageTemplate';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('updateMessageTemplate', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await updateMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { templateId: 'tpl-1' } });
    const res = await updateMessageTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    const template = { id: 'tpl-1', organizationId: 'tenant-1', name: 'T' };
    stubRepo(MessageTemplateRepository, {
      findById: async () => template,
      update: async () => ({ ...template, name: 'Updated' }),
    });
    const ctx = makeCtx({ _params: { templateId: 'tpl-1' }, _body: { name: 'Updated' } });
    const res = await updateMessageTemplate(ctx);
    expect(res.status).toBe(200);
  });
});
