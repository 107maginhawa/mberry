import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailTemplateRepository } from './repos/template.repo';
import { updateEmailTemplate } from './updateEmailTemplate';

describe('updateEmailTemplate', () => {
  beforeEach(() => { restoreRepo(EmailTemplateRepository); });
  afterEach(() => { restoreRepo(EmailTemplateRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' }, _params: { template: 'tmpl-1' } });
    await expect(updateEmailTemplate(ctx)).rejects.toThrow('Admin role required');
  });

  test('throws NotFoundError when template does not exist', async () => {
    stubRepo(EmailTemplateRepository, { findOneById: async () => null });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-missing' },
      _body: { name: 'Updated' },
    });
    await expect(updateEmailTemplate(ctx)).rejects.toThrow('Email template not found');
  });

  test('returns 200 on success', async () => {
    const updated = { id: 'tmpl-1', name: 'Updated' };
    stubRepo(EmailTemplateRepository, {
      findOneById: async () => ({ id: 'tmpl-1', name: 'Old' }),
      updateTemplate: async () => updated,
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _params: { template: 'tmpl-1' },
      _body: { name: 'Updated' },
    });
    const res = await updateEmailTemplate(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toEqual(updated);
  });
});
