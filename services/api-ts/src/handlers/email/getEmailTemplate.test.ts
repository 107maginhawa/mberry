import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailTemplateRepository } from './repos/template.repo';
import { getEmailTemplate } from './getEmailTemplate';

describe('getEmailTemplate', () => {
  beforeEach(() => { restoreRepo(EmailTemplateRepository); });
  afterEach(() => { restoreRepo(EmailTemplateRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, _params: { template: 'tmpl-1' } });
    await expect(getEmailTemplate(ctx)).rejects.toThrow('Admin role required');
  });

  test('throws NotFoundError when template does not exist', async () => {
    stubRepo(EmailTemplateRepository, { findOneById: async () => null });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-missing' },
    });
    await expect(getEmailTemplate(ctx)).rejects.toThrow('Email template not found');
  });

  test('returns 200 on found template', async () => {
    const tmpl = { id: 'tmpl-1', name: 'Welcome', subject: 'Hi', bodyHtml: '<p>yo</p>' };
    stubRepo(EmailTemplateRepository, { findOneById: async () => tmpl });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-1' },
    });
    const res = await getEmailTemplate(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual(tmpl);
  });
});
