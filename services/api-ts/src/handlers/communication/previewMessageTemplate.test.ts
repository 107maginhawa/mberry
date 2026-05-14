import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MessageTemplateRepository } from './repos/communication.repo';
import { previewMessageTemplate } from './previewMessageTemplate';

describe('previewMessageTemplate', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await previewMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { templateId: 'tpl-1' }, _body: { mergeData: {} } });
    const res = await previewMessageTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 on happy path', async () => {
    stubRepo(MessageTemplateRepository, {
      findById: async () => ({ id: 'tpl-1', organizationId: 'tenant-1', body: 'Hello {{name}}', subject: null }),
    });
    const ctx = makeCtx({ _params: { templateId: 'tpl-1' }, _body: { mergeData: { name: 'World' } } });
    const res = await previewMessageTemplate(ctx);
    expect(res.status).toBe(200);
  });
});
