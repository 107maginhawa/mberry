import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailTemplateRepository } from './repos/template.repo';
import { createEmailTemplate } from './createEmailTemplate';

describe('createEmailTemplate', () => {
  beforeEach(() => { restoreRepo(EmailTemplateRepository); });
  afterEach(() => { restoreRepo(EmailTemplateRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' } });
    await expect(createEmailTemplate(ctx)).rejects.toThrow('Admin role required');
  });

  test('throws ValidationError when missing required fields', async () => {
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _body: { name: 'Test' },
    });
    await expect(createEmailTemplate(ctx)).rejects.toThrow('Missing required fields');
  });

  test('returns 201 on success with valid body', async () => {
    const tmpl = { id: 'tmpl-1', name: 'Test', subject: 'Sub', bodyHtml: '<p>hi</p>', variables: [] };
    stubRepo(EmailTemplateRepository, {
      createTemplate: async () => tmpl,
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _body: { name: 'Test', subject: 'Sub', bodyHtml: '<p>hi</p>', variables: [] },
    });
    const res = await createEmailTemplate(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body).toEqual(tmpl);
  });
});
